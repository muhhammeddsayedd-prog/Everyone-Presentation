import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectOAuthAuthorization, decideOAuthAuthorization, type OAuthConsentProvider } from '../../apps/web/lib/oauth-consent.ts';

const selector = 'abcdefghijklmnopqrstuvwxyz234567';
const principalId = '20000000-0000-4000-8000-000000000001';
const clientId = '30000000-0000-4000-8000-000000000001';
const requestId = '40000000-0000-4000-8000-000000000001';
const claimId = '50000000-0000-4000-8000-000000000001';
const config = { baseUrl: 'http://127.0.0.1:3000', approvedClientIds: [clientId] };
const identity = { principalId, email: 'synthetic@example.invalid' };
const binding = { authorization_id: selector, client: { id: clientId, name: 'Synthetic client' },
  redirect_uri: 'http://localhost:3118/callback', scope: 'openid', user_id: null as string | null,
  status: 'pending', expires_at: '2099-01-01T00:00:00Z' };
const full = { authorization_id: selector, redirect_uri: binding.redirect_uri, client: binding.client,
  scope: 'openid', user: { id: principalId, email: identity.email } };
const redirect = { redirect_url: `${binding.redirect_uri}?code=synthetic-private-code&state=synthetic-private-state` };
function setup(variant: 'full' | 'redirect' = 'full') {
  let phase = 'new'; const calls: string[] = [];
  const coordinator = {
    claim: async ({ action }: { action: string }) => {
      calls.push(`claim:${action}`);
      if (phase === 'done') return { claim_id: null, state: 'already_processed', binding: null };
      if (phase === 'inflight') return { claim_id: null, state: 'in_progress', binding: null };
      if (phase === 'ready' && action === 'details') return { claim_id: null, state: 'consent_ready', binding: { ...binding, user_id: principalId } };
      if (action !== 'details' && phase !== 'ready') throw new Error('Decision requires verified consent.');
      phase = 'inflight';
      return { claim_id: claimId, state: 'claimed', binding: { ...binding, user_id: action === 'details' ? null : principalId } };
    },
    finish: async ({ outcome }: { outcome: string }) => {
      calls.push(`finish:${outcome}`); phase = outcome === 'consent_ready' ? 'ready' : 'done';
      return { claim_id: null, state: outcome === 'consent_ready' ? 'consent_ready' : 'already_processed',
        binding: { ...binding, user_id: principalId, status: outcome === 'redirect' ? 'approved' : 'pending' } };
    },
  };
  const provider: OAuthConsentProvider = {
    getAuthorizationDetails: async () => { calls.push('provider:details'); return { data: variant === 'full' ? full : redirect, error: null }; },
    approveAuthorization: async () => { calls.push('provider:approve'); return { data: redirect, error: null }; },
    denyAuthorization: async () => { calls.push('provider:deny'); return { data: { redirect_url: `${binding.redirect_uri}?error=access_denied` }, error: null }; },
  };
  return { coordinator, provider, calls };
}

test('initial opaque selector resolves full details; safe repeat never repeats the consuming GET', async () => {
  const p = setup();
  assert.equal((await inspectOAuthAuthorization(p.provider, selector, identity, config, p.coordinator, requestId)).state, 'consent');
  assert.equal((await inspectOAuthAuthorization(p.provider, selector, identity, config, p.coordinator, requestId)).state, 'consent');
  assert.equal(p.calls.filter(c => c === 'provider:details').length, 1);
  assert.equal((await decideOAuthAuthorization(p.provider, selector, 'approve', identity, config, p.coordinator, requestId)).state, 'redirect');
  assert.equal(p.calls.filter(c => c === 'provider:details').length, 1);
  await assert.rejects(decideOAuthAuthorization(p.provider, selector, 'approve', identity, config, p.coordinator, requestId));
  assert.equal(p.calls.filter(c => c === 'provider:approve').length, 1);
});

test('already-consented first GET accepts redirect-only against trusted binding and confirmed native status', async () => {
  const p = setup('redirect');
  assert.deepEqual(await inspectOAuthAuthorization(p.provider, selector, identity, config, p.coordinator, requestId), { state: 'redirect', authorization_id: selector, ...redirect });
  await assert.rejects(inspectOAuthAuthorization(p.provider, selector, identity, config, p.coordinator, requestId));
  assert.equal(p.calls.filter(c => c === 'provider:details').length, 1);
});

test('concurrent details have one upstream winner; no duplicate GET, approval or lease recovery', async () => {
  const p = setup(); let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const original = p.provider.getAuthorizationDetails;
  p.provider.getAuthorizationDetails = async id => { await wait; return original(id); };
  const winner = inspectOAuthAuthorization(p.provider, selector, identity, config, p.coordinator, requestId);
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(inspectOAuthAuthorization(p.provider, selector, identity, config, p.coordinator, requestId), { code: 'OAUTH_AUTHORIZATION_IN_PROGRESS' });
  release(); assert.equal((await winner).state, 'consent');
  assert.equal(p.calls.filter(c => c === 'provider:details').length, 1);
});

test('binding rejects wrong client/user/scope/callback/expiry before contacting provider', async () => {
  for (const patch of [{ client: { ...binding.client, id: principalId } }, { user_id: clientId }, { scope: 'openid email' },
    { redirect_uri: 'javascript:alert(1)' }, { expires_at: '2000-01-01T00:00:00Z' }, { status: 'approved' }]) {
    const p = setup('redirect'); p.coordinator.claim = async () => ({ claim_id: claimId, state: 'claimed', binding: { ...binding, ...patch } });
    await assert.rejects(inspectOAuthAuthorization(p.provider, selector, identity, config, p.coordinator, requestId));
    assert.ok(!p.calls.includes('provider:details'));
  }
});

test('redirect never escapes when provider callback differs or finish cannot establish native user/status', async () => {
  const p = setup('redirect'); p.provider.getAuthorizationDetails = async () => ({ data: { redirect_url: 'http://localhost:9999/callback?code=synthetic' }, error: null });
  await assert.rejects(inspectOAuthAuthorization(p.provider, selector, identity, config, p.coordinator, requestId));
  for (const patch of [{ user_id: clientId }, { status: 'pending' }, { scope: 'openid email' }]) {
    const q = setup('redirect'); q.coordinator.finish = async () => ({ claim_id: null, state: 'already_processed', binding: { ...binding, user_id: principalId, status: 'approved', ...patch } });
    await assert.rejects(inspectOAuthAuthorization(q.provider, selector, identity, config, q.coordinator, requestId));
  }
});

test('lost approval result does not issue another consuming GET or repeat a decision', async () => {
  const p = setup(); await inspectOAuthAuthorization(p.provider, selector, identity, config, p.coordinator, requestId);
  p.provider.approveAuthorization = async () => { p.calls.push('provider:approve'); throw new Error('synthetic-private-error'); };
  assert.equal((await decideOAuthAuthorization(p.provider, selector, 'approve', identity, config, p.coordinator, requestId)).state, 'uncertain');
  await assert.rejects(decideOAuthAuthorization(p.provider, selector, 'deny', identity, config, p.coordinator, requestId));
  assert.equal(p.calls.filter(c => c === 'provider:details').length, 1);
  assert.equal(p.calls.filter(c => c === 'provider:approve').length, 1);
  assert.ok(!p.calls.includes('provider:deny'));
});

test('callback results reject duplicate, empty, mixed and unknown credential query fields', async () => {
  for (const query of ['code=', 'error=', 'code=x&code=y', 'code=x&state=a&state=b', 'code=x&error=access_denied',
    'code=x&access_token=synthetic-secret', 'code=x&state=%00', 'error=access_denied']) {
    const p = setup('redirect'); p.provider.getAuthorizationDetails = async () => ({ data: { redirect_url: `${binding.redirect_uri}?${query}` }, error: null });
    await assert.rejects(inspectOAuthAuthorization(p.provider, selector, identity, config, p.coordinator, requestId));
  }
});
