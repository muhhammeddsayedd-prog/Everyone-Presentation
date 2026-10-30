import test from 'node:test';
import assert from 'node:assert/strict';
import { exportJWK, generateKeyPair, SignJWT, decodeJwt, type JWTPayload } from 'jose';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createBearerUserClient, createCentralStudio } from '@eps/central';
import { createMcpHttpHandler, handleMcpMetadata } from '../../apps/web/lib/mcp-http.ts';
import { createMcpCentralSessionCheck, parseMcpCentralSession } from '../../apps/web/lib/mcp-central-session.ts';
import { readMcpAuthConfig, type McpOAuthConfig } from '../../apps/web/lib/mcp-auth-config.ts';
import type { McpServices } from '../../apps/web/lib/mcp.ts';

const origin = 'http://127.0.0.1:3000', resource = `${origin}/mcp`, centralUrl = 'https://central.synthetic.invalid', issuer = `${centralUrl}/auth/v1`;
const principal = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002';
const session = '20000000-0000-4000-8000-000000000001', clientId = '30000000-0000-4000-8000-000000000001';
const projectId = '40000000-0000-4000-8000-000000000001';
const central = { url: centralUrl, publishableKey: 'sb_publishable_synthetic_m07_public_key' };
const runtime = { baseUrl: origin, adapterMode: 'supabase', environment: 'test' };
const config = readMcpAuthConfig({ MCP_AUTH_MODE: 'oauth', MCP_RESOURCE_URL: resource, MCP_AUTH_ISSUER: issuer,
  MCP_AUTH_CLIENT_IDS: clientId }, runtime, centralUrl) as McpOAuthConfig;
const signing = generateKeyPair('ES256').then(async pair => ({ ...pair, jwk: { ...await exportJWK(pair.publicKey), kid: 'm07-synthetic', alg: 'ES256', use: 'sig' } }));
const project = { id: projectId, name: 'Synthetic permitted project', client_id: null, client_name: null, client_logo_asset_id: null,
  row_version: 1, client_row_version: null, casting_workspace_id: null, can_edit: true };
const caps = (id: string) => ({ principal_id: id, capabilities: ['projects.read', 'workspaces.read'], timezone: 'Africa/Cairo', enabled_modules: ['casting'],
  upload_policy: { allowed_mime_types: ['image/png'], maximum_file_bytes: 5242880, recommended_batch_size: 200, available_purposes: [] } });
async function credential(id = principal, patch: JWTPayload = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: id, iss: issuer, aud: resource, role: 'authenticated', is_anonymous: false, exp: now + 300, iat: now,
    scope: 'openid', session_id: session, client_id: clientId,
    eps_delegation: { v: 1, resource, client_id: clientId, capabilities: ['projects.read', 'workspaces.read'] }, ...patch })
    .setProtectedHeader({ alg: 'ES256', kid: 'm07-synthetic' }).sign((await signing).privateKey);
}
function incoming(token?: string, body: unknown = { jsonrpc: '2.0', id: 1, method: 'tools/list' }) {
  return new Request(resource, { method: 'POST', headers: { host: '127.0.0.1:3000', accept: 'application/json, text/event-stream', 'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
}
async function harness() {
  let active = true, malformed = false, missing = false, badProject = false;
  const contexts: string[] = [], calls: { path: string; principalId: string; body: Record<string, unknown> }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.href === config.jwksUrl) { assert.equal(new Headers(init?.headers).has('authorization'), false); return Response.json({ keys: [(await signing).jwk] }); }
    if (url.href === config.discoveryUrl) return Response.json({ issuer, authorization_endpoint: config.authorizationEndpoint, token_endpoint: config.tokenEndpoint,
      jwks_uri: config.jwksUrl, response_types_supported: ['code'], code_challenge_methods_supported: ['S256'], scopes_supported: ['openid'] });
    const header = new Headers(init?.headers).get('authorization') ?? '';
    assert.ok(header.startsWith('Bearer ')); const payload = decodeJwt(header.slice(7));
    const id = payload.sub!;
    if (url.pathname === '/auth/v1/user') return Response.json({ id, aud: resource, role: 'authenticated', is_anonymous: false });
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    calls.push({ path: url.pathname, principalId: id, body });
    if (url.pathname === '/rest/v1/rpc/eps_validate_own_oauth_session') {
      assert.deepEqual(body, { p_resource: resource }); assert.ok(init?.signal);
      if (missing) return Response.json({ code: 'PGRST202', message: 'synthetic-private-function-diagnostics' }, { status: 404 });
      if (malformed) return Response.json({ active: true, principal_id: id, session_id: session, client_id: clientId, capabilities: ['projects.read'], private: 'synthetic-private-record' });
      return Response.json({ active, principal_id: active ? id : null, session_id: active ? session : null, client_id: active ? clientId : null,
        capabilities: active ? ['projects.read', 'workspaces.read'] : [] });
    }
    if (url.pathname === '/rest/v1/rpc/eps_get_capabilities') return Response.json(caps(id));
    if (url.pathname === '/rest/v1/rpc/eps_get_project') return Response.json(badProject ? { private: 'synthetic-private-record' } : { ...project, name: id === principal ? 'First principal project' : 'Second principal project' });
    throw new Error('Unexpected controlled central route.');
  };
  const checkSession = createMcpCentralSessionCheck(central, config.resourceUrl, { fetch: fetcher });
  const oauthContext = async (request: Request) => {
    const authorization = request.headers.get('authorization')!;
    const client = createBearerUserClient({ ...central, accessToken: authorization.slice(7) }, { fetch: fetcher });
    const studio = await createCentralStudio(client);
    contexts.push(decodeJwt(authorization.slice(7)).sub!);
    return { studio } as unknown as McpServices;
  };
  const handle = createMcpHttpHandler({ config, runtime, fetch: fetcher, checkSession, oauthContext,
    localContext: async () => { throw new Error('OAuth must never fall back to browser identity.'); } });
  return { handle, fetcher, calls, contexts, setActive: (value: boolean) => { active = value; }, setMalformed: () => { malformed = true; },
    setMissing: () => { missing = true; }, setBadProject: () => { badProject = true; } };
}

test('narrow OAuth session DTO accepts inactive nullable IDs and rejects private/forged/malformed authority', () => {
  assert.deepEqual(parseMcpCentralSession({ active: false, principal_id: null, session_id: null, client_id: null, capabilities: [] }),
    { active: false, principalId: null, sessionId: null, clientId: null, capabilities: [] });
  const valid = { active: true, principal_id: principal, session_id: session, client_id: clientId, capabilities: ['projects.read'] };
  assert.equal(parseMcpCentralSession(valid).principalId, principal);
  for (const patch of [{ private: 'unpublished' }, { active: 'true' }, { principal_id: null }, { capabilities: ['service.job-scoped'] },
    { capabilities: ['projects.read', 'projects.read'] }, { client_id: 'caller-selected' }]) {
    assert.throws(() => parseMcpCentralSession({ ...valid, ...patch }));
  }
  assert.throws(() => parseMcpCentralSession({ ...valid, active: false }));
});

test('OAuth transport authenticates before service construction and never falls back on missing/revoked/unavailable RPC', async () => {
  const h = await harness();
  const missing = await h.handle(incoming()); assert.equal(missing.status, 401); assert.equal(h.contexts.length, 0);
  const scope = await h.handle(incoming(await credential(principal, { scope: 'email' }))); assert.equal(scope.status, 403); assert.equal(h.contexts.length, 0);
  h.setActive(false); const revoked = await h.handle(incoming(await credential())); assert.equal(revoked.status, 401); assert.equal(h.contexts.length, 0);
  h.setActive(true); h.setMissing(); const unavailable = await h.handle(incoming(await credential()));
  assert.equal(unavailable.status, 503); assert.equal(h.contexts.length, 0); assert.ok(!(await unavailable.text()).includes('synthetic-private'));
  const malformed = await harness(); malformed.setMalformed();
  const rejected = await malformed.handle(incoming(await credential())); assert.equal(rejected.status, 503); assert.equal(malformed.contexts.length, 0);
});

test('official HTTP clients use signed delegation and central user RPCs with concurrent principal isolation and schema validation', async () => {
  const h = await harness();
  const run = async (id: string, modern: boolean, expectInvalid = false) => {
    const client = new Client({ name: 'eps-http-integration-test', version: '1.0.0' }, { versionNegotiation: { mode: modern ? { pin: '2026-07-28' } : 'legacy' } });
    const transport = new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { authorization: `Bearer ${await credential(id)}` } },
      fetch: async (input, init) => { const request = new Request(input, init); const headers = new Headers(request.headers); headers.set('host', '127.0.0.1:3000');
        const response = await h.handle(new Request(request, { headers })); assert.equal(response.headers.has('mcp-session-id'), false); return response; } });
    try {
      await client.connect(transport); const tools = await client.listTools(); assert.ok(tools.tools.some(tool => tool.name === 'get_project'));
      assert.ok(!tools.tools.some(tool => tool.name === 'confirm_candidate_reviewed'));
      const value = await client.callTool({ name: 'get_project', arguments: { project_id: projectId } });
      if (expectInvalid) { assert.equal(value.isError, true); assert.ok(!JSON.stringify(value).includes('synthetic-private-record')); }
      else { assert.equal(value.isError, undefined); assert.equal((value.structuredContent as { data: { name: string } }).data.name, id === principal ? 'First principal project' : 'Second principal project'); }
    } finally { await client.close(); }
  };
  await Promise.all([run(principal, true), run(other, false)]);
  assert.ok(h.contexts.includes(principal)); assert.ok(h.contexts.includes(other));
  h.setBadProject(); await run(principal, true, true);
  const second = await harness();
  const response = await second.handle(incoming(await credential(other))); assert.equal(response.status, 200);
  assert.ok(second.calls.every(call => call.principalId === other));
});

test('local transport preserves its explicit same-origin guard and disabled transport constructs no identity', async () => {
  let contexts = 0;
  const localContext = async (request: Request) => { assert.equal(request.headers.get('origin'), origin); contexts++;
    return { actor: { principal_id: principal }, services: { studio: { getCapabilities: async () => caps(principal) } } as unknown as McpServices }; };
  const local = createMcpHttpHandler({ runtime, config: { mode: 'local', baseUrl: origin }, localContext,
    oauthContext: async () => { throw new Error('Local must not manufacture OAuth.'); } });
  const denied = await local(incoming()); assert.equal(denied.status, 403); assert.equal(contexts, 0);
  const request = incoming(); const headers = new Headers(request.headers); headers.set('origin', origin);
  const response = await local(new Request(request, { headers })); assert.equal(response.status, 200); assert.equal(contexts, 1);
  const disabled = createMcpHttpHandler({ runtime, config: { mode: 'disabled' }, localContext, oauthContext: async () => { throw new Error('Disabled.'); } });
  assert.equal((await disabled(incoming())).status, 503); assert.equal(contexts, 1);
});

test('metadata HTTP entry is public and path-aware only after configured provider metadata validates', async () => {
  const h = await harness();
  const request = new Request(`${origin}/.well-known/oauth-protected-resource/mcp`, { headers: { host: '127.0.0.1:3000' } });
  const response = await handleMcpMetadata(request, { config, fetch: h.fetcher });
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).authorization_servers, [issuer]); assert.equal(h.contexts.length, 0);
  assert.equal((await handleMcpMetadata(request, { config: { mode: 'local', baseUrl: origin } })).status, 404);
});

test('OAuth identity must match the freshly composed central business principal before protocol dispatch', async () => {
  const h = await harness();
  const handler = createMcpHttpHandler({ config, runtime, fetch: h.fetcher,
    checkSession: createMcpCentralSessionCheck(central, resource, { fetch: h.fetcher }),
    localContext: async () => { throw new Error('OAuth must not use browser identity.'); },
    oauthContext: async (_request, identity) => {
      assert.equal(identity.principalId, principal);
      return { studio: { getCapabilities: async () => caps(other) } } as unknown as McpServices;
    } });
  const response = await handler(incoming(await credential())); assert.equal(response.status, 403);
  assert.ok(!JSON.stringify(await response.json()).includes(other));
});
