import test from 'node:test';
import assert from 'node:assert/strict';
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { DomainError } from '@eps/domain';
import { createMcpResourceGate, type McpSessionCheck } from '../../apps/web/lib/mcp-auth.ts';
import { createMcpHttpHandler } from '../../apps/web/lib/mcp-http.ts';
import { readMcpAuthConfig, type McpOAuthConfig } from '../../apps/web/lib/mcp-auth-config.ts';
import type { McpServices } from '../../apps/web/lib/mcp.ts';

const origin = 'https://studio.synthetic.invalid', central = 'https://central.synthetic.invalid', resource = `${origin}/mcp`, issuer = `${central}/auth/v1`;
const principal = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002';
const sessionId = '20000000-0000-4000-8000-000000000001', clientId = '30000000-0000-4000-8000-000000000001';
const traceId = '40000000-0000-4000-8000-000000000001';
const runtime = { adapterMode: 'supabase', environment: 'test', baseUrl: origin };
const config = readMcpAuthConfig({ MCP_AUTH_MODE: 'oauth', MCP_RESOURCE_URL: resource, MCP_AUTH_ISSUER: issuer, MCP_AUTH_CLIENT_IDS: clientId }, runtime, central) as McpOAuthConfig;
const signing = generateKeyPair('ES256').then(async pair => ({ ...pair, jwk: { ...await exportJWK(pair.publicKey), alg: 'ES256', kid: 'synthetic-key', use: 'sig' } }));
const active: McpSessionCheck = async input => ({ active: true, principalId: input.principalId, sessionId: input.sessionId, clientId: input.clientId, capabilities: ['projects.read'] });
const fetcher: typeof fetch = async () => Response.json({ keys: [(await signing).jwk] });
async function token(patch: JWTPayload = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: principal, iss: issuer, aud: resource, exp: now + 300, iat: now, role: 'authenticated', is_anonymous: false,
    client_id: clientId, session_id: sessionId, scope: 'openid', eps_delegation: { v: 1, resource, client_id: clientId, capabilities: ['projects.read'] }, ...patch })
    .setProtectedHeader({ alg: 'ES256', kid: 'synthetic-key' }).sign((await signing).privateKey);
}
function incoming(credential?: string, extra: Record<string, string> = {}) {
  return new Request(resource, { method: 'POST', headers: { host: new URL(origin).host, 'content-type': 'application/json', accept: 'application/json, text/event-stream',
    ...(credential ? { authorization: `Bearer ${credential}` } : {}), ...extra }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
}
function last(logs: unknown[]) { return logs.at(-1); }
function event(stage: string, result: string, status: number | null, reason?: string, code?: string) {
  return { event: 'eps.mcp.authorization_stage', trace_id: traceId, stage, result, status, ...(reason ? { reason } : {}), ...(code ? { code } : {}) };
}

test('MCP auth traces boundary and malformed bearer rejection before reading any browser identity', async () => {
  const logs: unknown[] = [];
  const gate = createMcpResourceGate(config, { fetch: fetcher, checkSession: active, authorizationTrace: { traceId, log: value => logs.push(value) } });
  const boundary = await gate(incoming(undefined, { origin: 'https://private-origin.invalid' }));
  assert.ok(boundary instanceof Response); assert.equal(boundary.status, 403);
  assert.deepEqual(last(logs), event('boundary', 'denied', 403, 'origin_mismatch'));
  const malformed = await gate(incoming('private-malformed-token'));
  assert.ok(malformed instanceof Response); assert.equal(malformed.status, 401);
  assert.deepEqual(last(logs), event('bearer', 'denied', 401, 'malformed_bearer'));
  assert.ok(!JSON.stringify(logs).includes('private-'));
});

test('MCP auth trace identifies JWT audience failure and invalid delegation without logging claims', async () => {
  const logs: unknown[] = [];
  const gate = createMcpResourceGate(config, { fetch: fetcher, checkSession: active, authorizationTrace: { traceId, log: value => logs.push(value) } });
  for (const [patch, expected] of [[{ aud: 'authenticated' }, event('jwt', 'denied', 401, 'jwt_claim_invalid', 'ERR_JWT_CLAIM_VALIDATION_FAILED')],
    [{ eps_delegation: undefined }, event('delegation', 'denied', 401, 'delegation_invalid')]] as const) {
    const credential = await token(patch);
    const result = await gate(incoming(credential)); assert.ok(result instanceof Response); assert.equal(result.status, 401);
    assert.deepEqual(last(logs), expected);
    assert.ok(!JSON.stringify(logs).includes(credential));
  }
  for (const forbidden of [principal, sessionId, clientId, resource, 'authenticated', 'eps_delegation']) assert.ok(!JSON.stringify(logs).includes(forbidden));
});

test('MCP auth trace separates an inactive delegation from unavailable central session verification', async () => {
  for (const [checkSession, expected, status] of [
    [async () => ({ active: false, principalId: null, sessionId: null, clientId: null, capabilities: [] }), event('session', 'denied', 401, 'session_inactive'), 401],
    [async () => { throw new DomainError('MCP_SESSION_VALIDATION_UNAVAILABLE', 'private-session-payload', 503); }, event('session', 'unavailable', 503, 'session_check_unavailable', 'MCP_SESSION_VALIDATION_UNAVAILABLE'), 503],
  ] as const) {
    const logs: unknown[] = [];
    const gate = createMcpResourceGate(config, { fetch: fetcher, checkSession, authorizationTrace: { traceId, log: value => logs.push(value) } });
    const result = await gate(incoming(await token())); assert.ok(result instanceof Response); assert.equal(result.status, status);
    assert.deepEqual(last(logs), expected); assert.ok(!JSON.stringify(logs).includes('private-'));
  }
});

test('MCP HTTP traces business-principal mismatch and never uses cookies as bearer fallback', async () => {
  const logs: unknown[] = [];
  let businessContexts = 0, browserContexts = 0;
  const handler = createMcpHttpHandler({ config, runtime, fetch: fetcher, checkSession: active, authorizationTrace: { traceId, log: value => logs.push(value) },
    localContext: async () => { browserContexts++; throw new Error('private-browser-context'); },
    oauthContext: async () => { businessContexts++; return { studio: { getCapabilities: async () => ({ principal_id: other }) } } as unknown as McpServices; } });
  const missing = await handler(incoming(undefined, { cookie: 'private-browser-cookie' })); assert.equal(missing.status, 401);
  assert.deepEqual(last(logs), event('bearer', 'denied', 401, 'missing_bearer'));
  assert.equal(businessContexts, 0); assert.equal(browserContexts, 0);
  const mismatch = await handler(incoming(await token())); assert.equal(mismatch.status, 403);
  assert.deepEqual(last(logs), event('business_context', 'denied', 403, 'business_principal_mismatch', 'ACCESS_DENIED'));
  assert.equal(businessContexts, 1); assert.equal(browserContexts, 0); assert.ok(!JSON.stringify(logs).includes('private-'));
});

test('MCP stage observer failure preserves successful authorization and generic service failure', async () => {
  const logs: unknown[] = [];
  const throwingTrace = { traceId, log: () => { throw new Error('private-sink-failure'); } };
  const gate = createMcpResourceGate(config, { fetch: fetcher, checkSession: active, authorizationTrace: throwingTrace });
  assert.ok(!(await gate(incoming(await token())) instanceof Response));
  for (const authorizationTrace of [throwingTrace, { traceId, log: (value: unknown) => logs.push(value) }]) {
    const handler = createMcpHttpHandler({ config, runtime, fetch: fetcher, checkSession: active, authorizationTrace,
      localContext: async () => { throw new Error('private-browser-context'); }, oauthContext: async () => { throw new Error('private-service-payload'); } });
    const result = await handler(incoming(await token())); assert.equal(result.status, 503); assert.ok(!(await result.text()).includes('private-'));
  }
  assert.deepEqual(last(logs), event('business_context', 'unavailable', 503, 'business_context_unavailable'));
});

test('MCP accepted trace reaches business authorization only after the matched principal and required scope', async () => {
  const logs: unknown[] = [];
  const handler = createMcpHttpHandler({ config, runtime, fetch: fetcher, checkSession: active, authorizationTrace: { traceId, log: value => logs.push(value) },
    localContext: async () => { throw new Error('private-browser-context'); },
    oauthContext: async () => ({ studio: { getCapabilities: async () => ({ principal_id: principal, capabilities: ['projects.read'],
      timezone: 'Africa/Cairo', enabled_modules: ['casting'], upload_policy: { allowed_mime_types: ['image/png'], maximum_file_bytes: 5242880,
        recommended_batch_size: 200, available_purposes: [] } }) } }) as unknown as McpServices });
  const credential = await token();
  const response = await handler(incoming(credential)); assert.equal(response.status, 200); await response.text();
  assert.deepEqual(last(logs), event('authorized', 'accepted', null));
  logs.length = 0;
  const scope = await handler(incoming(await token({ scope: 'email' }))); assert.equal(scope.status, 403);
  assert.deepEqual(last(logs), event('bearer', 'denied', 403, 'required_scope_missing'));
  assert.ok(!JSON.stringify(logs).includes('business_context'));
  for (const privateValue of [credential, principal, sessionId, clientId, 'private-']) assert.ok(!JSON.stringify(logs).includes(privateValue));
});
