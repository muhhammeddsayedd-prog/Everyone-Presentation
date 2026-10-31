import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { DomainError } from '@eps/domain';
import { createStudioMcpServer, type McpServices, type McpToolCompleted } from '../../apps/web/lib/mcp.ts';
import { createMcpHttpHandler, mcpProjectReadReceipt } from '../../apps/web/lib/mcp-http.ts';
import { readMcpAuthConfig, type McpOAuthConfig } from '../../apps/web/lib/mcp-auth-config.ts';

const principalId = '10000000-0000-4000-8000-000000000001';
const clientId = '20000000-0000-4000-8000-000000000001';
const sessionId = '30000000-0000-4000-8000-000000000001';
const projectId = '40000000-0000-4000-8000-000000000001';
const origin = 'http://127.0.0.1:3000', resource = `${origin}/mcp`, centralOrigin = 'https://central.example.invalid', issuer = `${centralOrigin}/auth/v1`;
const runtime = { baseUrl: origin, adapterMode: 'supabase', environment: 'test' };
const config = readMcpAuthConfig({ MCP_AUTH_MODE: 'oauth', MCP_RESOURCE_URL: resource, MCP_AUTH_ISSUER: issuer, MCP_AUTH_CLIENT_IDS: clientId }, runtime, centralOrigin) as McpOAuthConfig;
const project = { id: projectId, name: 'private-project-name', client_id: null, client_name: null, client_logo_asset_id: null,
  row_version: 1, client_row_version: null, casting_workspace_id: null, can_edit: true };
function fixture() {
  let capabilities = ['projects.read'], output: unknown = project, fails = false;
  const caps = () => ({ principal_id: principalId, capabilities, timezone: 'Africa/Cairo', enabled_modules: ['casting'],
    upload_policy: { allowed_mime_types: [], maximum_file_bytes: 5242880, recommended_batch_size: 200, available_purposes: [] } });
  const services = { studio: { getCapabilities: async () => caps(), getProject: async () => {
    if (fails) throw new DomainError('ACCESS_DENIED', 'Private project is inaccessible.', 403); return output;
  }, listProjects: async () => ({ data: [project], page: { next_cursor: null } }) } } as unknown as McpServices;
  return { services, caps, revoke: () => { capabilities = []; }, fail: () => { fails = true; }, malformed: () => { output = { ...project, private: 'private-output' }; } };
}
async function connected(services: McpServices, onToolCompleted: (event: McpToolCompleted) => void | Promise<void>) {
  const server = createStudioMcpServer({ principal_id: principalId }, services, { onToolCompleted });
  const client = new Client({ name: 'synthetic-observability', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

test('completion is emitted only after successful permission and output validation; sink failure does not alter success', async () => {
  const f = fixture(), events: McpToolCompleted[] = [];
  const connection = await connected(f.services, event => { events.push(event); throw new Error('private-sink-error'); });
  try {
    const success = await connection.client.callTool({ name: 'get_project', arguments: { project_id: projectId } });
    assert.equal(success.isError, undefined); assert.equal(events.length, 1);
    assert.equal(events[0].operation, 'get_project');
    assert.deepEqual(events[0].result, success.structuredContent);
    f.fail(); assert.equal((await connection.client.callTool({ name: 'get_project', arguments: { project_id: projectId } })).isError, true);
    f.revoke(); assert.equal((await connection.client.callTool({ name: 'get_project', arguments: { project_id: projectId } })).isError, true);
    assert.equal(events.length, 1);
  } finally { await connection.close(); }
  const malformed = fixture(); malformed.malformed(); const invalid: McpToolCompleted[] = [];
  const second = await connected(malformed.services, event => { invalid.push(event); });
  try { assert.equal((await second.client.callTool({ name: 'get_project', arguments: { project_id: projectId } })).isError, true); assert.equal(invalid.length, 0); }
  finally { await second.close(); }
});

test('HTTP completion is OAuth-only, bound to the verified identity and absent on denied authentication or local mode', async () => {
  const f = fixture(), events: { principalId: string; clientId: string; operation: string }[] = [];
  const key = await generateKeyPair('ES256');
  const jwk = { ...await exportJWK(key.publicKey), kid: 'synthetic-read-trace', alg: 'ES256', use: 'sig' };
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ sub: principalId, iss: issuer, aud: resource, role: 'authenticated', is_anonymous: false,
    exp: now + 300, iat: now, scope: 'openid', session_id: sessionId, client_id: clientId,
    eps_delegation: { v: 1, resource, client_id: clientId, capabilities: ['projects.read'] } })
    .setProtectedHeader({ alg: 'ES256', kid: 'synthetic-read-trace' }).sign(key.privateKey);
  const handle = createMcpHttpHandler({ config, runtime, fetch: async input => {
    const url = String(input);
    if (url === config.jwksUrl) return Response.json({ keys: [jwk] });
    if (url === config.discoveryUrl) return Response.json({ issuer, authorization_endpoint: config.authorizationEndpoint, token_endpoint: config.tokenEndpoint,
      jwks_uri: config.jwksUrl, response_types_supported: ['code'], code_challenge_methods_supported: ['S256'], scopes_supported: ['openid'] });
    throw new Error('Unexpected synthetic metadata request.');
  }, checkSession: async () => ({ active: true, principalId, sessionId, clientId, capabilities: ['projects.read'] }),
  localContext: async () => { throw new Error('OAuth must not construct local identity.'); }, oauthContext: async () => f.services,
  onToolCompleted: (identity, event) => { events.push({ principalId: identity.principalId, clientId: identity.clientId, operation: event.operation }); } });
  const incoming = (authorization?: string, local = false) => new Request(resource, { method: 'POST', headers: { host: '127.0.0.1:3000',
    accept: 'application/json, text/event-stream', 'content-type': 'application/json', ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
    ...(local ? { origin } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_project', arguments: { project_id: projectId } } }) });
  assert.equal((await handle(incoming())).status, 401); assert.equal(events.length, 0);
  const response = await handle(incoming(token)); assert.equal(response.status, 200); await response.text();
  assert.deepEqual(events, [{ principalId, clientId, operation: 'get_project' }]);
  let localCompletions = 0;
  const local = createMcpHttpHandler({ runtime, config: { mode: 'local', baseUrl: origin },
    localContext: async () => ({ actor: { principal_id: principalId }, services: f.services }), oauthContext: async () => { throw new Error('Local must not use OAuth.'); },
    onToolCompleted: () => { localCompletions++; } });
  const localResponse = await local(incoming(undefined, true)); assert.equal(localResponse.status, 200); await localResponse.text();
  assert.equal(events.length, 1); assert.equal(localCompletions, 0);
});

test('project read receipt contains only fixed fields and bounded UUIDs, with no names, arguments or private data', () => {
  const requestId = '50000000-0000-4000-8000-000000000001';
  const identity = { principalId, clientId };
  const result = { request_id: requestId, data: project };
  const receipt = mcpProjectReadReceipt(identity, { operation: 'get_project', result });
  assert.deepEqual(receipt, { event: 'eps.mcp.project_read_succeeded', entry_point: 'mcp_http', operation: 'get_project', success: true,
    request_id: requestId, principal_id: principalId, client_id: clientId, project_ids: [projectId] });
  assert.ok(!JSON.stringify(receipt).includes('private-'));
  const rows = Array.from({ length: 101 }, (_, index) => ({ ...project, id: `60000000-0000-4000-8000-${String(index).padStart(12, '0')}` }));
  const list = mcpProjectReadReceipt(identity, { operation: 'list_projects', result: { request_id: requestId, data: rows, page: { next_cursor: 'private-cursor' } } });
  assert.equal(list!.project_ids.length, 100);
  assert.ok(!JSON.stringify(list).includes('private-'));
  assert.equal(mcpProjectReadReceipt(identity, { operation: 'update_project', result }), null);
  assert.equal(mcpProjectReadReceipt({ ...identity, principalId: 'private-user@example.invalid' }, { operation: 'get_project', result }), null);
  assert.equal(mcpProjectReadReceipt({ ...identity, clientId: 'private-token' }, { operation: 'get_project', result }), null);
  assert.equal(mcpProjectReadReceipt({ ...identity, principalId: { toString: () => principalId, private: 'private-value' } } as unknown as typeof identity,
    { operation: 'get_project', result }), null);
  assert.equal(mcpProjectReadReceipt(identity, { operation: 'get_project', result: { ...result, request_id: 'private-request' } }), null);
  assert.equal(mcpProjectReadReceipt(identity, { operation: 'get_project', result: { ...result, data: { ...project, id: 'private-id' } } }), null);
});
