import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestServerClient, verifyCentralUser } from '@eps/central';
import { createOAuthConsentCoordinator } from '../../apps/web/lib/oauth-consent-coordinator.ts';

const authorizationId = 'abcdefghijklmnopqrstuvwxyz234567';
const requestId = '40000000-0000-4000-8000-000000000001';
const claimId = '50000000-0000-4000-8000-000000000001';
const principalId = '20000000-0000-4000-8000-000000000001';
const resource = 'https://studio.example.invalid/mcp';

test('coordinator sends only the declared claim/finish arguments and returns unknown data for domain validation', async () => {
  const calls: unknown[] = [];
  const envelope = { claim_id: claimId, state: 'claimed', binding: null };
  const client = { rpc(name: string, args: unknown) { return { abortSignal(signal: AbortSignal) {
    assert.ok(signal instanceof AbortSignal); assert.equal(signal.aborted, false); calls.push({ name, args });
    return Promise.resolve({ data: envelope, error: null });
  } }; } } as unknown as SupabaseClient;
  const coordinator = createOAuthConsentCoordinator(client, resource);
  assert.deepEqual(await coordinator.claim({ authorizationId, action: 'details', requestId }), envelope);
  assert.deepEqual(await coordinator.finish({ authorizationId, claimId, outcome: 'consent_ready' }), envelope);
  assert.deepEqual(calls, [{ name: 'eps_oauth_consent_claim', args: { p_authorization_id: authorizationId, p_resource: resource, p_action: 'details', p_request_id: requestId } },
    { name: 'eps_oauth_consent_finish', args: { p_authorization_id: authorizationId, p_resource: resource, p_claim_id: claimId, p_outcome: 'consent_ready' } }]);
});

test('coordinator maps RPC errors and thrown exceptions to generic errors without serializing provider details', async () => {
  for (const throws of [false, true]) {
    const client = { rpc() { return { abortSignal() {
      if (throws) throw new Error('private-sql-token');
      return Promise.resolve({ data: null, error: { code: 'private-code', message: 'private-sql-token', details: 'private-records' } });
    } }; } } as unknown as SupabaseClient;
    const coordinator = createOAuthConsentCoordinator(client, resource);
    for (const action of [() => coordinator.claim({ authorizationId, requestId, action: 'details' }),
      () => coordinator.finish({ authorizationId, claimId, outcome: 'rejected' })]) {
      await assert.rejects(action, (error: unknown) => {
        assert.ok(error instanceof Error); assert.ok(!JSON.stringify(error).includes('private-')); assert.ok(!error.message.includes('private-'));
        assert.equal((error as { code?: string }).code, 'OAUTH_AUTHORIZATION_UNAVAILABLE'); return true;
      });
    }
  }
});

test('coordinator and OAuth provider use the same verified HttpOnly browser SDK session', async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = `${Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principalId,
    aud: 'authenticated', role: 'authenticated', exp: now + 3600 })).toString('base64url')}.synthetic-signature`;
  const user = { id: principalId, email: 'synthetic-owner@example.invalid', aud: 'authenticated', role: 'authenticated', is_anonymous: false,
    app_metadata: {}, user_metadata: {}, created_at: '2026-10-30T00:00:00Z' };
  const jar = new Map<string, string>();
  const calls: string[] = [];
  const config = { url: 'https://central.example.invalid', publishableKey: 'sb_publishable_synthetic_coordinator', cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (values: { name: string; value: string; options: { httpOnly?: boolean } }[]) => {
      for (const cookie of values) { assert.equal(cookie.options.httpOnly, true); jar.set(cookie.name, cookie.value); }
    },
  } };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/token') return Response.json({ access_token: token, refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer', user });
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${token}`);
    if (url.pathname === '/auth/v1/user') { calls.push('verified-user'); return Response.json(user); }
    if (url.pathname === '/rest/v1/rpc/eps_oauth_consent_claim') {
      assert.deepEqual(JSON.parse(String(init?.body)), { p_authorization_id: authorizationId, p_resource: resource, p_action: 'details', p_request_id: requestId });
      calls.push('claim'); return Response.json({ claim_id: claimId, state: 'claimed', binding: null });
    }
    if (url.pathname === `/auth/v1/oauth/authorizations/${authorizationId}`) { calls.push('provider-details'); return Response.json({ redirect_url: 'http://localhost:3118/callback?code=synthetic-private' }); }
    if (url.pathname === '/rest/v1/rpc/eps_oauth_consent_finish') { calls.push('finish'); return Response.json({ claim_id: null, state: 'already_processed', binding: null }); }
    throw new Error('Unexpected synthetic path.');
  };
  const bootstrap = createRequestServerClient(config, { fetch: fetcher });
  assert.equal((await bootstrap.auth.signInWithPassword({ email: user.email, password: 'synthetic-password' })).error, null);
  const client = createRequestServerClient(config, { fetch: fetcher });
  assert.equal((await verifyCentralUser(client)).principal_id, principalId);
  const coordinator = createOAuthConsentCoordinator(client, resource);
  await coordinator.claim({ authorizationId, action: 'details', requestId });
  assert.equal((await client.auth.oauth.getAuthorizationDetails(authorizationId)).error, null);
  await coordinator.finish({ authorizationId, claimId, outcome: 'redirect' });
  assert.deepEqual(calls, ['verified-user', 'claim', 'provider-details', 'finish']);
});
