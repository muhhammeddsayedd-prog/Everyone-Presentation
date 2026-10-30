import test from 'node:test';
import assert from 'node:assert/strict';
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, Server, type AuthInfo } from '@modelcontextprotocol/server';
import { readMcpAuthConfig, type McpOAuthConfig } from '../../apps/web/lib/mcp-auth-config.ts';
import { createMcpResourceGate, loadMcpAuthorizationMetadata, mcpMetadataResponse,
  verifiedMcpIdentity, requireMcpCapability, type McpSessionCheck } from '../../apps/web/lib/mcp-auth.ts';

const origin = 'https://studio.synthetic.invalid';
const central = 'https://central.synthetic.invalid';
const issuer = `${central}/auth/v1`;
const resource = `${origin}/mcp`;
const principal = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const session = '20000000-0000-4000-8000-000000000001';
const clientId = '30000000-0000-4000-8000-000000000001';
const runtime = { adapterMode: 'supabase', environment: 'test', baseUrl: origin };
const env = { MCP_AUTH_MODE: 'oauth', MCP_RESOURCE_URL: resource, MCP_AUTH_ISSUER: issuer, MCP_AUTH_CLIENT_IDS: clientId };
const config = () => readMcpAuthConfig(env, runtime, central) as McpOAuthConfig;
const signing = generateKeyPair('ES256').then(async ({ privateKey, publicKey }) => ({ privateKey,
  jwk: { ...await exportJWK(publicKey), kid: 'synthetic-key', alg: 'ES256', use: 'sig' } }));
const metadata = { issuer, authorization_endpoint: `${issuer}/oauth/authorize`, token_endpoint: `${issuer}/oauth/token`,
  jwks_uri: `${issuer}/.well-known/jwks.json`, response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'], scopes_supported: ['openid', 'email'], token_endpoint_auth_methods_supported: ['none'] };
const requests: string[] = [];
const fetcher: typeof fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input); requests.push(url);
  assert.equal(new Headers(init?.headers).has('authorization'), false);
  assert.equal(init?.redirect, 'error');
  if (url === `${issuer}/.well-known/jwks.json`) return Response.json({ keys: [(await signing).jwk] });
  if (url === `${central}/.well-known/oauth-authorization-server/auth/v1`) return Response.json(metadata);
  throw new Error('Unapproved synthetic fetch destination.');
};
const liveSession: McpSessionCheck = async input => ({ active: true, principalId: input.principalId,
  sessionId: input.sessionId, clientId: input.clientId, capabilities: ['workspaces.read', 'workspaces.write'] });
async function token(patch: JWTPayload = {}, key?: CryptoKey) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: principal, iss: issuer, aud: resource, exp: now + 300, iat: now, nbf: now - 1,
    role: 'authenticated', is_anonymous: false, session_id: session, client_id: clientId, scope: 'openid',
    eps_delegation: { v: 1, resource, client_id: clientId, capabilities: ['workspaces.read', 'cast.review'] }, ...patch })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'synthetic-key' }).sign(key ?? (await signing).privateKey);
}
function request(accessToken?: string, changes: Record<string, string> = {}) {
  return new Request(resource, { method: 'POST', headers: { host: new URL(origin).host, ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}), ...changes } });
}
async function accepted(value: AuthInfo | Response) { assert.ok(!(value instanceof Response)); return value; }

test('MCP config keeps local mode explicit, rejects production local mode and pins issuer/resource without arbitrary URLs', () => {
  assert.equal(readMcpAuthConfig({}, { ...runtime, baseUrl: 'http://127.0.0.1:3000' }, central).mode, 'local');
  assert.equal(readMcpAuthConfig({}, runtime, central).mode, 'disabled');
  assert.equal(readMcpAuthConfig({ NODE_ENV: 'production' }, { ...runtime, baseUrl: 'http://127.0.0.1:3000' }, central).mode, 'disabled');
  assert.equal(config().jwksUrl, `${issuer}/.well-known/jwks.json`);
  for (const change of [{ MCP_AUTH_ISSUER: 'https://attacker.invalid/auth/v1' }, { MCP_RESOURCE_URL: `${resource}?url=private` },
    { MCP_RESOURCE_URL: `${origin}/other` }, { MCP_AUTH_CLIENT_IDS: '' }, { MCP_AUTH_MODE: 'invented' }, { MCP_AUTH_ISSUER: '' }]) {
    assert.throws(() => readMcpAuthConfig({ ...env, ...change }, runtime, central));
  }
});

test('explicit OAuth mode permits only development/test HTTP loopback resources while issuer and JWKS stay HTTPS', () => {
  for (const hostname of ['127.0.0.1', 'localhost', '[::1]']) {
    const baseUrl = `http://${hostname}:3000`;
    const value = readMcpAuthConfig({ ...env, MCP_RESOURCE_URL: `${baseUrl}/mcp` }, { ...runtime, baseUrl }, central);
    assert.equal(value.mode, 'oauth');
    assert.equal((value as McpOAuthConfig).resourceUrl, `${baseUrl}/mcp`);
    assert.ok((value as McpOAuthConfig).issuer.startsWith('https:'));
    assert.ok((value as McpOAuthConfig).jwksUrl.startsWith('https:'));
  }
  const baseUrl = 'http://127.0.0.1:3000';
  for (const change of [{ environment: 'staging' }, { environment: 'production' }, { baseUrl: 'http://public.synthetic.invalid' }]) {
    const changed = { ...runtime, baseUrl, ...change };
    assert.throws(() => readMcpAuthConfig({ ...env, MCP_RESOURCE_URL: `${changed.baseUrl}/mcp` }, changed, central));
  }
  assert.throws(() => readMcpAuthConfig({ ...env, NODE_ENV: 'production', MCP_RESOURCE_URL: `${baseUrl}/mcp` }, { ...runtime, baseUrl }, central));
  assert.throws(() => readMcpAuthConfig({ ...env, MCP_RESOURCE_URL: `${baseUrl}/mcp`, MCP_AUTH_ISSUER: `${baseUrl}/auth/v1` }, { ...runtime, baseUrl }, baseUrl));
});

test('OAuth metadata uses only pinned discovery, validates issuer/endpoints and serves path-aware public metadata', async () => {
  requests.length = 0;
  const discovered = await loadMcpAuthorizationMetadata(config(), { fetch: fetcher });
  assert.deepEqual(requests, [`${central}/.well-known/oauth-authorization-server/auth/v1`]);
  const response = mcpMetadataResponse(new Request(`${origin}/.well-known/oauth-protected-resource/mcp`, { headers: { host: new URL(origin).host } }), config(), discovered)!;
  assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.resource, resource); assert.deepEqual(body.authorization_servers, [issuer]);
  assert.deepEqual(body.scopes_supported, ['openid']); assert.ok(!JSON.stringify(body).includes('studio:'));
  const copied = mcpMetadataResponse(new Request(`${origin}/.well-known/oauth-protected-resource/mcp`, { headers: { host: new URL(origin).host } }), config(), { ...discovered })!;
  assert.equal(copied.status, 503);
  assert.equal(mcpMetadataResponse(new Request(`${origin}/unrelated`), config(), discovered), undefined);
  for (const change of [{ issuer: 'https://attacker.invalid' }, { token_endpoint: 'https://attacker.invalid/token' },
    { jwks_uri: 'http://127.0.0.1/private' }, { code_challenge_methods_supported: ['plain'] }, { scopes_supported: ['email'] }]) {
    await assert.rejects(loadMcpAuthorizationMetadata(config(), { fetch: async () => Response.json({ ...metadata, ...change }) }));
  }
  await assert.rejects(loadMcpAuthorizationMetadata(config(), { fetch: async () => new Response('', { status: 302, headers: { location: 'http://127.0.0.1/private' } }) }));
});

test('MCP authenticates signed resource-specific user delegation and intersects current capabilities', async () => {
  const gate = createMcpResourceGate(config(), { fetch: fetcher, checkSession: liveSession });
  const value = await accepted(await gate(request(await token())));
  assert.equal(value.resource?.href, resource); assert.equal(value.clientId, clientId); assert.deepEqual(value.scopes, ['openid']);
  const identity = verifiedMcpIdentity(value); assert.equal(identity.principalId, principal);
  assert.deepEqual(identity.capabilities, ['workspaces.read']);
  requireMcpCapability(value, 'workspaces.read');
  assert.throws(() => requireMcpCapability(value, 'cast.review'));
  assert.throws(() => verifiedMcpIdentity({ ...value }));
});

test('MCP rejects missing, browser-audience, expired, future, privileged, anonymous, bad-client and forged tokens', async () => {
  let checks = 0;
  const gate = createMcpResourceGate(config(), { fetch: fetcher, checkSession: async value => { checks++; return liveSession(value); } });
  const missing = await gate(request()); assert.ok(missing instanceof Response); assert.equal(missing.status, 401);
  assert.match(missing.headers.get('www-authenticate')!, /resource_metadata="https:\/\/studio.synthetic.invalid\/\.well-known\/oauth-protected-resource\/mcp"/);
  const now = Math.floor(Date.now() / 1000);
  for (const patch of [{ aud: 'authenticated' }, { aud: ['authenticated', resource] }, { iss: 'https://attacker.invalid' }, { exp: now - 1 },
    { exp: undefined }, { iat: now + 60 }, { nbf: now + 60 }, { role: 'service_role' }, { role: 'supabase_admin' }, { is_anonymous: true },
    { is_anonymous: undefined }, { client_id: other }, { client_id: undefined }, { sub: 'invented' }, { session_id: undefined },
    { eps_delegation: undefined }, { eps_delegation: { v: 1, resource, client_id: other, capabilities: ['workspaces.read'] } },
    { eps_delegation: { v: 1, resource, client_id: clientId, capabilities: ['service.job-scoped'] } }]) {
    const response = await gate(request(await token(patch))); assert.ok(response instanceof Response); assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'invalid_token');
  }
  const rogue = await generateKeyPair('ES256');
  const forged = await gate(request(await token({}, rogue.privateKey))); assert.ok(forged instanceof Response); assert.equal(forged.status, 401);
  for (const authorization of ['Bearer one two', 'Bearer one,Bearer two', 'Basic secret', 'Bearer '.concat('x'.repeat(17_000))]) {
    const response = await gate(request(undefined, { authorization })); assert.ok(response instanceof Response); assert.equal(response.status, 401);
  }
  assert.equal(checks, 0);
});

test('MCP rejects insufficient identity scope, invalid Origin/Host and query-string credentials', async () => {
  const gate = createMcpResourceGate(config(), { fetch: fetcher, checkSession: liveSession });
  const scope = await gate(request(await token({ scope: 'email' }))); assert.ok(scope instanceof Response); assert.equal(scope.status, 403);
  assert.match(scope.headers.get('www-authenticate')!, /scope="openid"/);
  const boundaryHeaders: Record<string, string>[] = [{ origin: 'https://attacker.invalid' }, { origin: 'null' }, { host: 'attacker.invalid' }];
  for (const change of boundaryHeaders) {
    const response = await gate(request(await token(), change)); assert.ok(response instanceof Response); assert.equal(response.status, 403);
  }
  const query = await gate(new Request(`${resource}?access_token=synthetic`, { headers: { host: new URL(origin).host } }));
  assert.ok(query instanceof Response); assert.equal(query.status, 400);
});

test('MCP session revocation is rechecked each request and unavailable/mismatched checks fail closed', async () => {
  let active = true;
  const gate = createMcpResourceGate(config(), { fetch: fetcher, checkSession: async value => ({ ...await liveSession(value), active }) });
  const credential = await token(); await accepted(await gate(request(credential))); active = false;
  const revoked = await gate(request(credential)); assert.ok(revoked instanceof Response); assert.equal(revoked.status, 401);
  for (const checkSession of [undefined, async () => { throw new Error('synthetic-private-database-credential'); }]) {
    const result = await createMcpResourceGate(config(), { fetch: fetcher, checkSession })(request(credential));
    assert.ok(result instanceof Response); assert.equal(result.status, 503); assert.ok(!(await result.text()).includes('synthetic-private'));
  }
  const mismatch = await createMcpResourceGate(config(), { fetch: fetcher, checkSession: async value => ({ ...await liveSession(value), principalId: other }) })(request(credential));
  assert.ok(mismatch instanceof Response); assert.equal(mismatch.status, 401);
});

test('MCP metadata/key retrieval rejects oversized and redirected responses and never follows token-controlled key URLs', async () => {
  for (const response of [() => new Response('x'.repeat(65 * 1024), { headers: { 'Content-Type': 'application/json' } }),
    () => new Response('', { status: 302, headers: { location: 'http://127.0.0.1/private' } })]) {
    const gate = createMcpResourceGate(config(), { fetch: async () => response(), checkSession: liveSession });
    const value = await gate(request(await token())); assert.ok(value instanceof Response); assert.equal(value.status, 503);
  }
  let called = false;
  const gate = createMcpResourceGate(config(), { fetch: async (url, init) => { called = true; return fetcher(url, init); }, checkSession: liveSession });
  const now = Math.floor(Date.now() / 1000);
  const credential = await new SignJWT({ sub: principal, iss: issuer, aud: resource, exp: now + 300, iat: now,
    role: 'authenticated', is_anonymous: false, session_id: session, client_id: clientId, scope: 'openid',
    eps_delegation: { v: 1, resource, client_id: clientId, capabilities: ['workspaces.read'] } })
    .setProtectedHeader({ alg: 'ES256', kid: 'synthetic-key', jku: 'http://127.0.0.1/private' }).sign((await signing).privateKey);
  await accepted(await gate(request(credential))); assert.equal(called, true);
});

test('official SDK handles signed OAuth modern and legacy requests without sharing concurrent principals or sessions', async () => {
  const gate = createMcpResourceGate(config(), { fetch: fetcher, checkSession: liveSession });
  const eras: string[] = []; const principals: string[] = []; const versions = new Set<string>();
  const handler = createMcpHandler(context => {
    eras.push(context.era);
    const identity = verifiedMcpIdentity(context.authInfo!); principals.push(identity.principalId);
    const server = new Server({ name: 'synthetic-auth-test', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler('tools/list', async () => ({ tools: [] }));
    return server;
  }, { legacy: 'stateless', responseMode: 'json' });
  const call = async (principalId: string, supportedProtocolVersions?: string[]) => {
    const credential = await token({ sub: principalId });
    const client = new Client({ name: 'eps-signed-auth-test', version: '1.0.0' }, supportedProtocolVersions ? { supportedProtocolVersions,
      versionNegotiation: { mode: supportedProtocolVersions.includes('2026-07-28') ? { pin: '2026-07-28' } : 'legacy' } } : undefined);
    const transport = new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { authorization: `Bearer ${credential}` } }, fetch: async (url, init) => {
      const input = new Request(url, init); const headers = new Headers(input.headers); headers.set('host', new URL(origin).host);
      const forwarded = new Request(input, { headers }); const version = headers.get('mcp-protocol-version'); if (version) versions.add(version);
      const auth = await gate(forwarded); if (auth instanceof Response) return auth;
      const response = await handler.fetch(forwarded, { authInfo: auth }); assert.equal(response.headers.has('mcp-session-id'), false); return response;
    } });
    try { await client.connect(transport); await client.listTools(); } finally { await client.close(); }
  };
  try {
    await Promise.all([call(principal, ['2026-07-28']), call(other, ['2026-07-28']), call(principal, ['2025-11-25'])]);
    assert.ok(eras.includes('modern')); assert.ok(eras.includes('legacy')); assert.ok(versions.has('2026-07-28')); assert.ok(versions.has('2025-11-25'));
    assert.ok(principals.includes(principal)); assert.ok(principals.includes(other));
  } finally { await handler.close(); }
});
