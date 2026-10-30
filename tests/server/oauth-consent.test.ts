import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@eps/domain';
import { createRequestServerClient, verifyCentralUser } from '@eps/central';
import { inspectOAuthAuthorization, decideOAuthAuthorization, requestOAuthBusinessSignIn, safeOAuthRedirect,
  type OAuthConsentProvider } from '../../apps/web/lib/oauth-consent.ts';
import { handleOAuthConsentRequest, handleOAuthConsentSignIn, handleOAuthConsentCallback } from '../../apps/web/lib/oauth-consent-http.ts';
import { parseOAuthConsentEnvelope } from '../../apps/web/lib/oauth-consent-contract.ts';

const origin = 'http://127.0.0.1:3000', authorizationId = '10000000-0000-4000-8000-000000000001';
const principalId = '20000000-0000-4000-8000-000000000001', clientId = '30000000-0000-4000-8000-000000000001';
const requestId = '40000000-0000-4000-8000-000000000001';
const config = { baseUrl: origin, approvedClientIds: [clientId] };
const identity = { principalId, email: 'synthetic-owner@example.invalid' };
const details = { authorization_id: authorizationId, redirect_uri: 'http://localhost:54321/callback',
  client: { id: clientId, name: 'Synthetic Claude Code', uri: 'https://client.example.invalid/product', logo_uri: '' },
  user: { id: principalId, email: identity.email }, scope: 'openid' };
const redirect = { redirect_url: 'http://localhost:54321/callback?code=synthetic-private-code&state=synthetic-state' };
function provider() {
  const calls: string[] = []; let approved = false, uncertain = false, malformed = false;
  const api: OAuthConsentProvider = {
    getAuthorizationDetails: async id => { assert.equal(id, authorizationId); calls.push('details'); return { data: approved ? redirect : details, error: null }; },
    approveAuthorization: async (id, options) => { assert.equal(id, authorizationId); assert.deepEqual(options, { skipBrowserRedirect: true }); calls.push('approve');
      if (uncertain) throw new Error('synthetic-private-provider-body'); approved = true; return { data: malformed ? { redirect_url: 'javascript:alert(1)' } : redirect, error: null }; },
    denyAuthorization: async (id, options) => { assert.equal(id, authorizationId); assert.deepEqual(options, { skipBrowserRedirect: true }); calls.push('deny'); return { data: { redirect_url: 'http://localhost:54321/callback?error=access_denied&state=synthetic-state' }, error: null }; },
  };
  return { api, calls, uncertain: () => { uncertain = true; }, malformed: () => { malformed = true; } };
}
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/oauth/authorization`, { method: 'POST', headers: { host: '127.0.0.1:3000', origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
const body = (action = 'details') => ({ authorization_id: authorizationId, action, request_id: requestId });

test('consent displays only provider-verified client/account/scope and rejects mismatched or extra authority fields', async () => {
  const p = provider(); const result = await inspectOAuthAuthorization(p.api, authorizationId, identity, config);
  assert.deepEqual(result, { state: 'consent', authorization_id: authorizationId, client: { id: clientId, name: 'Synthetic Claude Code', website: 'https://client.example.invalid' },
    account_email: identity.email, scopes: ['openid'] });
  for (const patch of [{ authorization_id: principalId }, { client: { ...details.client, id: principalId } }, { user: { id: clientId, email: identity.email } },
    { scope: 'openid email' }, { secret: 'synthetic-private-code' }, { redirect_uri: 'javascript:alert(1)' }]) {
    await assert.rejects(inspectOAuthAuthorization({ ...p.api, getAuthorizationDetails: async () => ({ data: { ...details, ...patch }, error: null }) }, authorizationId, identity, config));
  }
});

test('pinned Auth omitempty client metadata supports omitted URI/logo fields without weakening the closed consent view', async () => {
  // Auth v2.197.0 / commit4eee58f: ClientDetailsResponse omits empty uri/logo_uri.
  // A display name remains a deliberate Studio approved-client setup requirement.
  const clients = [
    { id: clientId, name: details.client.name },
    { id: clientId, name: details.client.name, uri: details.client.uri },
    { id: clientId, name: details.client.name, logo_uri: 'https://client.example.invalid/logo.png' },
    { id: clientId, name: details.client.name, uri: null, logo_uri: null },
    { id: clientId, name: details.client.name, uri: '', logo_uri: '' },
  ];
  for (const client of clients) {
    const api = { ...provider().api, getAuthorizationDetails: async () => ({ data: { ...details, client }, error: null }) };
    const result = await inspectOAuthAuthorization(api, authorizationId, identity, config);
    assert.deepEqual(result, { state: 'consent', authorization_id: authorizationId, client: { id: clientId, name: details.client.name,
      website: 'uri' in client && client.uri ? 'https://client.example.invalid' : null }, account_email: identity.email, scopes: ['openid'] });
    const response = await handleOAuthConsentRequest(request(body()), { config, getBrowserContext: async () => ({ ...identity, provider: api }) });
    assert.equal(response.status, 200);
    assert.deepEqual(parseOAuthConsentEnvelope(await response.json(), requestId), result);
    assert.ok(!JSON.stringify(result).includes('logo.png'));
  }
});

test('optional client metadata still rejects explicit undefined, malformed fields, unknown authority and unsafe website URLs', async () => {
  const required = { id: clientId, name: details.client.name };
  const clients: unknown[] = [{}, { id: clientId }, { name: details.client.name }, { ...required, id: principalId },
    { ...required, name: null }, { ...required, name: '   ' }, { ...required, name: 'x'.repeat(201) }, { ...required, name: 'bad\nname' },
    { ...required, capabilities: ['cast.review'] }, { ...required, redirect_url: redirect.redirect_url }];
  for (const value of [undefined, 1, false, {}, []]) clients.push({ ...required, uri: value }, { ...required, logo_uri: value });
  for (const uri of ['javascript:alert(1)', 'file:///private', 'data:text/html,secret', 'http://public.invalid/client',
    'https://user:secret@client.invalid/', 'https://client.invalid/#private', ' https://client.invalid/', 'x'.repeat(4097)]) clients.push({ ...required, uri });
  clients.push({ ...required, logo_uri: 'x'.repeat(2049) });
  for (const client of clients) {
    const api = { ...provider().api, getAuthorizationDetails: async () => ({ data: { ...details, client }, error: null }) };
    await assert.rejects(inspectOAuthAuthorization(api, authorizationId, identity, config), { code: 'OAUTH_PROVIDER_RESPONSE_INVALID' });
  }
});

test('approve/deny use the installed SDK methods once with automatic redirects suppressed', async () => {
  const p = provider();
  const approved = await decideOAuthAuthorization(p.api, authorizationId, 'approve', identity, config);
  assert.deepEqual(approved, { state: 'redirect', authorization_id: authorizationId, ...redirect });
  assert.deepEqual(p.calls, ['details', 'approve']);
  const denied = provider(); const value = await decideOAuthAuthorization(denied.api, authorizationId, 'deny', identity, config);
  assert.equal(value.state, 'redirect'); assert.deepEqual(denied.calls, ['details', 'deny']);
  await assert.rejects(decideOAuthAuthorization(p.api, authorizationId, 'approve', identity, config));
  assert.deepEqual(p.calls, ['details', 'approve', 'details']);
});

test('metadata-free initial redirects cannot bypass approved client, user, scope and callback validation', async () => {
  const p = provider();
  const unbound = { ...p.api, getAuthorizationDetails: async () => ({ data: redirect, error: null }) };
  await assert.rejects(inspectOAuthAuthorization(unbound, authorizationId, identity, config), { code: 'OAUTH_PROVIDER_RESPONSE_INVALID' });
  for (const action of ['approve', 'deny'] as const) {
    await assert.rejects(decideOAuthAuthorization(unbound, authorizationId, action, identity, config), { code: 'OAUTH_PROVIDER_RESPONSE_INVALID' });
  }
  const response = await handleOAuthConsentRequest(request(body()), { config, getBrowserContext: async () => ({ ...identity, provider: unbound }) });
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('synthetic-private-code'));
  assert.deepEqual(p.calls, []);
});

test('post-decision recovery rejects redirects outside the callback verified earlier in that request', async () => {
  const p = provider(); let reads = 0;
  const wrong = { ...p.api,
    getAuthorizationDetails: async () => ({ data: ++reads === 1 ? details : { redirect_url: 'https://unrelated-client.example.invalid/callback?code=synthetic' }, error: null }),
    approveAuthorization: async () => { throw new Error('Synthetic lost result.'); },
  };
  assert.deepEqual(await decideOAuthAuthorization(wrong, authorizationId, 'approve', identity, config), { state: 'uncertain', authorization_id: authorizationId });
  assert.equal(reads, 2);
});

test('an uncertain decision only re-queries provider state and never repeats approval or creates another grant', async () => {
  const p = provider(); p.uncertain();
  const value = await decideOAuthAuthorization(p.api, authorizationId, 'approve', identity, config);
  assert.deepEqual(value, { state: 'uncertain', authorization_id: authorizationId }); assert.deepEqual(p.calls, ['details', 'approve', 'details']);
  await inspectOAuthAuthorization(p.api, authorizationId, identity, config); assert.deepEqual(p.calls, ['details', 'approve', 'details', 'details']);
  const recovered = provider(); recovered.malformed();
  assert.equal((await decideOAuthAuthorization(recovered.api, authorizationId, 'approve', identity, config)).state, 'redirect');
  assert.deepEqual(recovered.calls, ['details', 'approve', 'details']);
});

test('redirects are provider-returned HTTPS or HTTP loopback only and remain bound to verified callback path', () => {
  assert.equal(safeOAuthRedirect(redirect.redirect_url, details.redirect_uri), redirect.redirect_url);
  for (const value of ['javascript:alert(1)', 'file:///private', 'data:text/html,secret', '//evil.invalid', 'http://public.invalid/callback',
    'https://user:secret@client.invalid/callback', 'https://client.invalid/callback#secret', 'http://localhost:54321/other?code=secret']) {
    assert.throws(() => safeOAuthRedirect(value, details.redirect_uri));
  }
});

test('browser-only consent rejects MCP bearers, CSRF, extra JSON fields and malformed request IDs before obtaining cookies/provider', async () => {
  const p = provider(); let contexts = 0;
  const dependencies = { config, getBrowserContext: async () => { contexts++; return { ...identity, provider: p.api }; } };
  for (const [payload, headers] of [[body(), { authorization: 'Bearer synthetic-user-token' }], [body(), { origin: 'https://attacker.invalid' }],
    [{ ...body(), principal_id: principalId }, {}], [{ ...body(), request_id: 'not-a-uuid' }, {}], [{ ...body(), redirect_url: 'https://evil.invalid' }, {}],
    [{ ...body(), action: ['details'] }, {}]]) {
    const response = await handleOAuthConsentRequest(request(payload, headers as Record<string, string>), dependencies); assert.ok(response.status >= 400);
  }
  assert.equal(contexts, 0); assert.deepEqual(p.calls, []);
  for (const bytes of [new Uint8Array([0xff]), new TextEncoder().encode('x'.repeat(4097))]) {
    const invalid = new Request(`${origin}/api/oauth/authorization`, { method: 'POST', headers: { host: '127.0.0.1:3000', origin, 'content-type': 'application/json' }, body: bytes });
    assert.equal((await handleOAuthConsentRequest(invalid, dependencies)).status, 400);
  }
  assert.equal(contexts, 0);
  const response = await handleOAuthConsentRequest(request(body()), dependencies); assert.equal(response.status, 200);
  const envelope = await response.json(); assert.equal(envelope.request_id, requestId); assert.equal(parseOAuthConsentEnvelope(envelope, requestId).state, 'consent');
  assert.throws(() => parseOAuthConsentEnvelope({ ...envelope, token: 'private' }, requestId));
  assert.throws(() => parseOAuthConsentEnvelope({ ...envelope, request_id: authorizationId }, requestId));
});

test('consent sign-in sends one existing-account-only link with a closed local return path', async () => {
  const calls: unknown[] = [];
  const input = { authorization_id: authorizationId, request_id: requestId, email: ' synthetic-owner@example.invalid ' };
  const value = await requestOAuthBusinessSignIn(input, origin, async value => { calls.push(value); return { error: null }; });
  assert.deepEqual(value, { state: 'sign_in_sent', authorization_id: authorizationId });
  assert.deepEqual(calls, [{ email: identity.email, options: { shouldCreateUser: false, emailRedirectTo: `${origin}/api/oauth/callback?authorization_id=${authorizationId}` } }]);
  await assert.rejects(requestOAuthBusinessSignIn({ ...input, redirect: 'https://evil.invalid' }, origin, async () => { throw new Error('Must not send.'); }));
  const response = await handleOAuthConsentSignIn(request(input, { authorization: 'Bearer synthetic' }), { config, requestLink: async () => { throw new Error('Must not send.'); } });
  assert.equal(response.status, 403); assert.equal(calls.length, 1);
});

test('consent callback exchanges code once and returns only to the validated authorization selector', async () => {
  let calls = 0;
  const exchange = async (code: string) => { assert.equal(code, 'synthetic-private-code'); calls++; return { error: null }; };
  const response = await handleOAuthConsentCallback(new Request(`${origin}/api/oauth/callback?authorization_id=${authorizationId}&code=synthetic-private-code`), { baseUrl: origin, exchangeCode: exchange });
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), `${origin}/oauth/consent?authorization_id=${authorizationId}`); assert.equal(calls, 1);
  const denied = await handleOAuthConsentCallback(new Request(`${origin}/api/oauth/callback?authorization_id=${authorizationId}&code=synthetic-private-code&redirect=https://evil.invalid`), { baseUrl: origin, exchangeCode: exchange });
  assert.equal(calls, 1); assert.ok(!denied.headers.get('location')!.includes('synthetic-private')); assert.ok(!denied.headers.get('location')!.includes('evil.invalid'));
});

test('provider failures and unknown decision outcomes never expose private messages or callback codes', async () => {
  const p = provider(); p.uncertain();
  const result = await handleOAuthConsentRequest(request(body('approve')), { config, getBrowserContext: async () => ({ ...identity, provider: p.api }) });
  assert.equal(result.status, 202); assert.ok(!(await result.text()).includes('synthetic-private'));
  const denied = await handleOAuthConsentRequest(request(body()), { config, getBrowserContext: async () => { throw new DomainError('AUTH_REQUIRED', 'Sign in to continue.', 401); } });
  assert.equal(denied.status, 401);
});

test('installed Supabase SSR/OAuth SDK uses the verified HttpOnly browser session for details and consent', async () => {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = `${Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principalId, aud: 'authenticated', role: 'authenticated', exp: now + 3600 })).toString('base64url')}.synthetic-signature`;
  const user = { id: principalId, email: identity.email, aud: 'authenticated', role: 'authenticated', is_anonymous: false,
    app_metadata: {}, user_metadata: {}, created_at: '2026-10-30T00:00:00Z' };
  const jar = new Map<string, string>(); const sdkCalls: string[] = [];
  const browserConfig = { url: 'https://consent.synthetic.invalid', publishableKey: 'sb_publishable_synthetic_consent_key', cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (cookies: { name: string; value: string; options: { httpOnly?: boolean; sameSite?: unknown } }[]) => {
      for (const cookie of cookies) { assert.equal(cookie.options.httpOnly, true); assert.equal(cookie.options.sameSite, 'lax'); jar.set(cookie.name, cookie.value); }
    } } };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/token') { sdkCalls.push('synthetic-sign-in'); return Response.json({ access_token: accessToken, refresh_token: 'synthetic-only-refresh', expires_in: 3600, token_type: 'bearer', user }); }
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${accessToken}`);
    if (url.pathname === '/auth/v1/user') { sdkCalls.push('verified-user'); return Response.json(user); }
    if (url.pathname === `/auth/v1/oauth/authorizations/${authorizationId}`) { sdkCalls.push('details'); return Response.json({ ...details, client: { id: clientId, name: details.client.name } }); }
    if (url.pathname === `/auth/v1/oauth/authorizations/${authorizationId}/consent`) { sdkCalls.push('approve'); assert.deepEqual(JSON.parse(String(init?.body)), { action: 'approve' }); return Response.json(redirect); }
    throw new Error('Unexpected synthetic SDK route.');
  };
  const bootstrap = createRequestServerClient(browserConfig, { fetch: fetcher });
  assert.equal((await bootstrap.auth.signInWithPassword({ email: identity.email, password: 'synthetic-only-password' })).error, null);
  assert.ok(jar.size > 0);
  const browser = createRequestServerClient(browserConfig, { fetch: fetcher });
  const verified = await verifyCentralUser(browser); assert.equal(verified.principal_id, principalId);
  const response = await handleOAuthConsentRequest(request(body('approve')), { config,
    getBrowserContext: async () => ({ principalId: verified.principal_id, email: verified.email, provider: browser.auth.oauth }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).data.state, 'redirect');
  assert.deepEqual(sdkCalls, ['synthetic-sign-in', 'verified-user', 'details', 'approve']);
});
