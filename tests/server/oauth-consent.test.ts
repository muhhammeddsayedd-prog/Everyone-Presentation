import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@eps/domain';
import { createRequestServerClient, verifyCentralUser } from '@eps/central';
import { inspectOAuthAuthorization, decideOAuthAuthorization, requestOAuthBusinessSignIn, safeOAuthRedirect,
  type OAuthConsentProvider, type OAuthConsentCoordinator } from '../../apps/web/lib/oauth-consent.ts';
import { handleOAuthConsentRequest, handleOAuthConsentSignIn, handleOAuthConsentCallback } from '../../apps/web/lib/oauth-consent-http.ts';
import { parseOAuthConsentEnvelope } from '../../apps/web/lib/oauth-consent-contract.ts';

const origin = 'http://127.0.0.1:3000', authorizationId = 'abcdefghijklmnopqrstuvwxyz234567';
const principalId = '20000000-0000-4000-8000-000000000001', clientId = '30000000-0000-4000-8000-000000000001';
const requestId = '40000000-0000-4000-8000-000000000001', claimId = '50000000-0000-4000-8000-000000000001';
const config = { baseUrl: origin, approvedClientIds: [clientId] };
const identity = { principalId, email: 'synthetic-owner@example.invalid' };
const details = { authorization_id: authorizationId, redirect_uri: 'http://localhost:54321/callback',
  client: { id: clientId, name: 'Synthetic Claude Code', uri: 'https://client.example.invalid/product', logo_uri: '' },
  user: { id: principalId, email: identity.email }, scope: 'openid' };
const redirect = { redirect_url: 'http://localhost:54321/callback?code=synthetic-private-code&state=synthetic-state' };

/** Synthetic native state is pending until one provider action consumes it.
 * Consumed GETs return400; unlike the former fixture, they never replay redirects. */
function provider(autoApproved = false) {
  const calls: string[] = []; let uncertain = false, malformed = false;
  let phase: 'new' | 'claimed' | 'ready' | 'done' = 'new';
  const native = { user_id: null as string | null, status: 'pending' };
  const binding = () => ({ authorization_id: authorizationId, redirect_uri: details.redirect_uri, client: details.client,
    scope: 'openid', ...native, expires_at: '2099-01-01T00:00:00Z' });
  const coordinator: OAuthConsentCoordinator = {
    claim: async input => {
      assert.equal(input.authorizationId, authorizationId); assert.equal(input.requestId, requestId);
      if (phase === 'claimed') return { claim_id: null, state: 'in_progress', binding: null };
      if (phase === 'done') return { claim_id: null, state: 'already_processed', binding: null };
      if (phase === 'ready' && input.action === 'details') return { claim_id: null, state: 'consent_ready', binding: binding() };
      if (input.action !== 'details') assert.equal(phase, 'ready', 'A decision requires verified details first.');
      phase = 'claimed'; return { claim_id: claimId, state: 'claimed', binding: binding() };
    },
    finish: async input => {
      assert.equal(input.authorizationId, authorizationId); assert.equal(input.claimId, claimId);
      if (input.outcome === 'consent_ready') {
        assert.equal(native.user_id, principalId); assert.equal(native.status, 'pending'); phase = 'ready';
      } else {
        if (input.outcome === 'redirect') { assert.equal(native.user_id, principalId); assert.ok(['approved', 'denied'].includes(native.status)); }
        phase = 'done';
      }
      return { claim_id: null, state: input.outcome === 'consent_ready' ? 'consent_ready' : 'already_processed', binding: binding() };
    },
  };
  const consumed = () => ({ data: null, error: { status: 400, code: 'validation_failed', message: 'synthetic-private-consumed-body' } });
  const api: OAuthConsentProvider = {
    getAuthorizationDetails: async id => {
      assert.equal(id, authorizationId); calls.push('details'); if (native.status !== 'pending') return consumed();
      native.user_id = principalId;
      if (autoApproved) { native.status = 'approved'; return { data: redirect, error: null }; }
      return { data: details, error: null };
    },
    approveAuthorization: async (id, options) => {
      assert.equal(id, authorizationId); assert.deepEqual(options, { skipBrowserRedirect: true }); calls.push('approve');
      if (native.status !== 'pending') return consumed(); native.status = 'approved';
      if (uncertain) throw new Error('synthetic-private-provider-body');
      return { data: malformed ? { redirect_url: 'javascript:alert(1)' } : redirect, error: null };
    },
    denyAuthorization: async (id, options) => {
      assert.equal(id, authorizationId); assert.deepEqual(options, { skipBrowserRedirect: true }); calls.push('deny');
      if (native.status !== 'pending') return consumed(); native.status = 'denied';
      return { data: { redirect_url: 'http://localhost:54321/callback?error=access_denied&state=synthetic-state' }, error: null };
    },
  };
  const inspect = () => inspectOAuthAuthorization(api, authorizationId, identity, config, coordinator, requestId);
  const decide = (action: 'approve' | 'deny') => decideOAuthAuthorization(api, authorizationId, action, identity, config, coordinator, requestId);
  const context = () => ({ ...identity, provider: api, coordinator });
  return { api, coordinator, calls, native, binding, inspect, decide, context,
    uncertain: () => { uncertain = true; }, malformed: () => { malformed = true; } };
}
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/oauth/authorization`, { method: 'POST', headers: { host: '127.0.0.1:3000', origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
const body = (action = 'details') => ({ authorization_id: authorizationId, action, request_id: requestId });

function replaceDetails(p: ReturnType<typeof provider>, replacement: unknown) {
  const original = p.api.getAuthorizationDetails;
  p.api.getAuthorizationDetails = async id => { await original(id); return { data: replacement, error: null }; };
}

test('consent displays only provider-verified client/account/scope and rejects mismatched or extra authority fields', async () => {
  const p = provider();
  assert.deepEqual(await p.inspect(), { state: 'consent', authorization_id: authorizationId, client: { id: clientId, name: 'Synthetic Claude Code', website: 'https://client.example.invalid' }, account_email: identity.email, scopes: ['openid'] });
  for (const patch of [{ authorization_id: principalId }, { client: { ...details.client, id: principalId } }, { user: { id: clientId, email: identity.email } },
    { scope: 'openid email' }, { secret: 'synthetic-private-code' }, { redirect_uri: 'javascript:alert(1)' }]) {
    const q = provider(); replaceDetails(q, { ...details, ...patch }); await assert.rejects(q.inspect(), { code: 'OAUTH_PROVIDER_RESPONSE_INVALID' });
  }
});

test('pinned Auth omitempty client metadata supports omitted URI/logo fields without weakening the closed consent view', async () => {
  const clients = [{ id: clientId, name: details.client.name }, { id: clientId, name: details.client.name, uri: details.client.uri },
    { id: clientId, name: details.client.name, logo_uri: 'https://client.example.invalid/logo.png' },
    { id: clientId, name: details.client.name, uri: null, logo_uri: null }, { id: clientId, name: details.client.name, uri: '', logo_uri: '' }];
  for (const client of clients) {
    const p = provider(); replaceDetails(p, { ...details, client });
    const response = await handleOAuthConsentRequest(request(body()), { config, getBrowserContext: async () => p.context() });
    assert.equal(response.status, 200); const result = parseOAuthConsentEnvelope(await response.json(), requestId);
    assert.deepEqual(result, { state: 'consent', authorization_id: authorizationId, client: { id: clientId, name: details.client.name,
      website: 'uri' in client && client.uri ? 'https://client.example.invalid' : null }, account_email: identity.email, scopes: ['openid'] });
    assert.ok(!JSON.stringify(result).includes('logo.png')); assert.deepEqual(p.calls, ['details']);
  }
});

test('optional client metadata still rejects undefined, malformed fields, unknown authority and unsafe website URLs', async () => {
  const required = { id: clientId, name: details.client.name };
  const clients: unknown[] = [{}, { id: clientId }, { name: details.client.name }, { ...required, id: principalId },
    { ...required, name: null }, { ...required, name: '   ' }, { ...required, name: 'x'.repeat(201) }, { ...required, name: 'bad\nname' },
    { ...required, capabilities: ['cast.review'] }, { ...required, redirect_url: redirect.redirect_url }];
  for (const value of [undefined, 1, false, {}, []]) clients.push({ ...required, uri: value }, { ...required, logo_uri: value });
  for (const uri of ['javascript:alert(1)', 'file:///private', 'data:text/html,secret', 'http://public.invalid/client',
    'https://user:secret@client.invalid/', 'https://client.invalid/#private', ' https://client.invalid/', 'x'.repeat(4097)]) clients.push({ ...required, uri });
  clients.push({ ...required, logo_uri: 'x'.repeat(2049) });
  for (const client of clients) { const p = provider(); replaceDetails(p, { ...details, client }); await assert.rejects(p.inspect(), { code: 'OAUTH_PROVIDER_RESPONSE_INVALID' }); }
});

test('approve/deny call SDK methods once without a second consuming GET or an automatic SDK redirect', async () => {
  const p = provider(); await p.inspect();
  assert.deepEqual(await p.decide('approve'), { state: 'redirect', authorization_id: authorizationId, ...redirect });
  assert.deepEqual(p.calls, ['details', 'approve']);
  await assert.rejects(p.decide('approve'), { code: 'OAUTH_AUTHORIZATION_PROCESSED' });
  await assert.rejects(p.decide('deny'), { code: 'OAUTH_AUTHORIZATION_PROCESSED' }); assert.deepEqual(p.calls, ['details', 'approve']);
  const denied = provider(); await denied.inspect(); assert.equal((await denied.decide('deny')).state, 'redirect'); assert.deepEqual(denied.calls, ['details', 'deny']);
  assert.deepEqual((await p.api.getAuthorizationDetails(authorizationId)).error, { status: 400, code: 'validation_failed', message: 'synthetic-private-consumed-body' });
});

test('redirect-only initial reconnect needs authoritative approved binding and confirmed native principal/status', async () => {
  const p = provider(true); assert.deepEqual(await p.inspect(), { state: 'redirect', authorization_id: authorizationId, ...redirect }); assert.deepEqual(p.calls, ['details']);
  const unbound = provider(true);
  unbound.coordinator.claim = async () => ({ claim_id: claimId, state: 'claimed', binding: { ...unbound.binding(), client: { ...details.client, id: principalId } } });
  const response = await handleOAuthConsentRequest(request(body()), { config, getBrowserContext: async () => unbound.context() });
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('synthetic-private-code')); assert.deepEqual(unbound.calls, []);
  const wrongUser = provider(true); const original = wrongUser.coordinator.finish;
  wrongUser.coordinator.finish = async input => { await original(input); return { claim_id: null, state: 'already_processed', binding: { ...wrongUser.binding(), user_id: clientId } }; };
  await assert.rejects(wrongUser.inspect(), { code: 'OAUTH_PROVIDER_RESPONSE_INVALID' });
});

test('a malformed decision redirect produces uncertainty without a consuming recovery GET', async () => {
  const p = provider(); await p.inspect(); p.malformed();
  assert.deepEqual(await p.decide('approve'), { state: 'uncertain', authorization_id: authorizationId }); assert.deepEqual(p.calls, ['details', 'approve']);
  await assert.rejects(p.inspect(), { code: 'OAUTH_AUTHORIZATION_PROCESSED' }); assert.deepEqual(p.calls, ['details', 'approve']);
});

test('a lost decision response never repeats approval or re-queries a consumed authorization', async () => {
  const p = provider(); await p.inspect(); p.uncertain();
  assert.deepEqual(await p.decide('approve'), { state: 'uncertain', authorization_id: authorizationId });
  assert.equal(p.native.status, 'approved'); assert.deepEqual(p.calls, ['details', 'approve']);
  await assert.rejects(p.inspect(), { code: 'OAUTH_AUTHORIZATION_PROCESSED' });
  await assert.rejects(p.decide('approve'), { code: 'OAUTH_AUTHORIZATION_PROCESSED' }); assert.deepEqual(p.calls, ['details', 'approve']);
});

test('redirects are HTTPS or HTTP loopback only and bound to verified callback path', () => {
  assert.equal(safeOAuthRedirect(redirect.redirect_url, details.redirect_uri), redirect.redirect_url);
  for (const value of ['javascript:alert(1)', 'file:///private', 'data:text/html,secret', '//evil.invalid', 'http://public.invalid/callback',
    'https://user:secret@client.invalid/callback', 'https://client.invalid/callback#secret', 'http://localhost:54321/other?code=secret']) assert.throws(() => safeOAuthRedirect(value, details.redirect_uri));
});

test('browser-only consent denies bearers, CSRF, extra fields and invalid correlations before cookie/provider access', async () => {
  const p = provider(); let contexts = 0; const dependencies = { config, getBrowserContext: async () => { contexts++; return p.context(); } };
  for (const [payload, headers] of [[body(), { authorization: 'Bearer synthetic-user-token' }], [body(), { origin: 'https://attacker.invalid' }],
    [{ ...body(), principal_id: principalId }, {}], [{ ...body(), request_id: 'not-a-uuid' }, {}], [{ ...body(), redirect_url: 'https://evil.invalid' }, {}], [{ ...body(), action: ['details'] }, {}]]) {
    assert.ok((await handleOAuthConsentRequest(request(payload, headers as Record<string, string>), dependencies)).status >= 400);
  }
  assert.equal(contexts, 0); assert.deepEqual(p.calls, []);
  for (const bytes of [new Uint8Array([0xff]), new TextEncoder().encode('x'.repeat(4097))]) {
    const invalid = new Request(`${origin}/api/oauth/authorization`, { method: 'POST', headers: { host: '127.0.0.1:3000', origin, 'content-type': 'application/json' }, body: bytes });
    assert.equal((await handleOAuthConsentRequest(invalid, dependencies)).status, 400);
  }
  assert.equal(contexts, 0); const response = await handleOAuthConsentRequest(request(body()), dependencies); assert.equal(response.status, 200);
  const envelope = await response.json(); assert.equal(parseOAuthConsentEnvelope(envelope, requestId).state, 'consent');
  assert.throws(() => parseOAuthConsentEnvelope({ ...envelope, token: 'private' }, requestId));
  assert.throws(() => parseOAuthConsentEnvelope({ ...envelope, request_id: authorizationId }, requestId));
});

test('consent sign-in requests an existing-account-only link with a closed local return path', async () => {
  const calls: unknown[] = []; const input = { authorization_id: authorizationId, request_id: requestId, email: ' synthetic-owner@example.invalid ' };
  assert.deepEqual(await requestOAuthBusinessSignIn(input, origin, async value => { calls.push(value); return { error: null }; }), { state: 'sign_in_sent', authorization_id: authorizationId });
  assert.deepEqual(calls, [{ email: identity.email, options: { shouldCreateUser: false, emailRedirectTo: `${origin}/api/oauth/callback?authorization_id=${authorizationId}` } }]);
  await assert.rejects(requestOAuthBusinessSignIn({ ...input, redirect: 'https://evil.invalid' }, origin, async () => { throw new Error('Must not send.'); }));
  assert.equal((await handleOAuthConsentSignIn(request(input, { authorization: 'Bearer synthetic' }), { config, requestLink: async () => { throw new Error('Must not send.'); } })).status, 403);
});

test('consent callback exchanges code once and preserves only the validated opaque selector', async () => {
  let calls = 0; const exchange = async (code: string) => { assert.equal(code, 'synthetic-private-code'); calls++; return { error: null }; };
  const response = await handleOAuthConsentCallback(new Request(`${origin}/api/oauth/callback?authorization_id=${authorizationId}&code=synthetic-private-code`), { baseUrl: origin, exchangeCode: exchange });
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), `${origin}/oauth/consent?authorization_id=${authorizationId}`); assert.equal(calls, 1);
  const denied = await handleOAuthConsentCallback(new Request(`${origin}/api/oauth/callback?authorization_id=${authorizationId}&code=synthetic-private-code&redirect=https://evil.invalid`), { baseUrl: origin, exchangeCode: exchange });
  assert.equal(calls, 1); assert.ok(!denied.headers.get('location')!.includes('synthetic-private')); assert.ok(!denied.headers.get('location')!.includes('evil.invalid'));
});

test('provider failures and unknown decisions never expose private messages or callback codes', async () => {
  const p = provider(); await p.inspect(); p.uncertain();
  const result = await handleOAuthConsentRequest(request(body('approve')), { config, getBrowserContext: async () => p.context() });
  assert.equal(result.status, 202); assert.ok(!(await result.text()).includes('synthetic-private'));
  assert.equal((await handleOAuthConsentRequest(request(body()), { config, getBrowserContext: async () => { throw new DomainError('AUTH_REQUIRED', 'Sign in to continue.', 401); } })).status, 401);
});

for (const expired of [false, true]) test(`installed Supabase SSR/OAuth SDK ${expired ? 'refreshes an expired cookie session and persists its replacement' : 'uses the verified HttpOnly cookie session'} for details and consent`, async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = (exp: number) => `${Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principalId, aud: 'authenticated', role: 'authenticated', exp })).toString('base64url')}.synthetic-signature`;
  const accessToken = token(now + 3600), expiredToken = token(now - 60);
  const user = { id: principalId, email: identity.email, aud: 'authenticated', role: 'authenticated', is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: '2026-10-30T00:00:00Z' };
  const jar = new Map<string, string>(); const sdkCalls: string[] = []; let cookieWrites = 0;
  const browserConfig = { url: 'https://consent.synthetic.invalid', publishableKey: 'sb_publishable_synthetic_consent_key', cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (cookies: { name: string; value: string; options: { httpOnly?: boolean; sameSite?: unknown } }[]) => {
      cookieWrites++; for (const cookie of cookies) { assert.equal(cookie.options.httpOnly, true); assert.equal(cookie.options.sameSite, 'lax'); jar.set(cookie.name, cookie.value); }
    } } };
  const p = provider();
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/token') {
      const refresh = url.searchParams.get('grant_type') === 'refresh_token'; sdkCalls.push(refresh ? 'refresh-session' : 'synthetic-sign-in');
      if (refresh) assert.equal(JSON.parse(String(init?.body)).refresh_token, 'synthetic-only-refresh');
      return Response.json({ access_token: expired && !refresh ? expiredToken : accessToken, refresh_token: refresh ? 'synthetic-refreshed-value' : 'synthetic-only-refresh', expires_in: expired && !refresh ? -60 : 3600, token_type: 'bearer', user });
    }
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${accessToken}`);
    if (url.pathname === '/auth/v1/user') { sdkCalls.push('verified-user'); return Response.json(user); }
    if (url.pathname === `/auth/v1/oauth/authorizations/${authorizationId}`) { sdkCalls.push('details'); return Response.json((await p.api.getAuthorizationDetails(authorizationId)).data); }
    if (url.pathname === `/auth/v1/oauth/authorizations/${authorizationId}/consent`) {
      sdkCalls.push('approve'); assert.deepEqual(JSON.parse(String(init?.body)), { action: 'approve' }); return Response.json((await p.api.approveAuthorization(authorizationId, { skipBrowserRedirect: true })).data);
    }
    throw new Error('Unexpected synthetic SDK route.');
  };
  const bootstrap = createRequestServerClient(browserConfig, { fetch: fetcher });
  assert.equal((await bootstrap.auth.signInWithPassword({ email: identity.email, password: 'synthetic-only-password' })).error, null);
  assert.ok(jar.size > 0); const cookiesBeforeRefresh = [...jar]; const writesBeforeRefresh = cookieWrites;
  const dependencies = { config, getBrowserContext: async () => {
    const browser = createRequestServerClient(browserConfig, { fetch: fetcher }); const verified = await verifyCentralUser(browser); assert.equal(verified.principal_id, principalId);
    return { principalId: verified.principal_id, email: verified.email, provider: browser.auth.oauth, coordinator: p.coordinator };
  } };
  const shown = await handleOAuthConsentRequest(request(body()), dependencies); assert.equal(shown.status, 200); assert.equal((await shown.json()).data.state, 'consent');
  const response = await handleOAuthConsentRequest(request(body('approve')), dependencies); assert.equal(response.status, 200); assert.equal((await response.json()).data.state, 'redirect');
  assert.deepEqual(sdkCalls, ['synthetic-sign-in', ...(expired ? ['refresh-session'] : []), 'verified-user', 'details', 'verified-user', 'approve']);
  if (expired) { assert.ok(cookieWrites > writesBeforeRefresh); assert.notDeepEqual([...jar], cookiesBeforeRefresh); }
  assert.deepEqual(p.calls, ['details', 'approve']);
});
