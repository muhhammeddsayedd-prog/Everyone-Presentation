import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@eps/domain';
import { createStudioMcpServer, implementedMcpTools, invokeMcpTool, requireLocalMcpRequest, type McpServices } from '../../apps/web/lib/mcp.ts';
import { Client, InMemoryTransport, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';

const actor = { principal_id: 'synthetic-producer' };
function services() {
  const calls: unknown[][] = [];
  const operation = async (...args: unknown[]) => { calls.push(args); return { id: 'synthetic', row_version: 2 }; };
  const getSpecs = async (...args: unknown[]) => { calls.push(args); return { id: 'spec', workspace_id: 'workspace', source_asset_id: null,
    source_text: 'Synthetic source.', normalized_instructions: null, clarifications: [], row_version: 1, processing_job_id: null }; };
  const ports = { specs: { updateRole: operation, getSpecs }, jobs: { getJob: operation }, candidates: { createCandidate: operation },
    studio: { getProject: operation } } as unknown as McpServices;
  return { ports, calls };
}
test('implemented M01/M02 and candidate-library tools are advertised; private callbacks and pending media extraction stay absent', () => {
  const names = implementedMcpTools().map(tool => tool.name);
  for (const name of ['get_specs','submit_specs','list_roles','resize_role_slots','reorder_workspace','retry_job','get_project','create_upload_session']) assert.ok(names.includes(name));
  for (const name of ['search_candidates','create_candidate','confirm_candidate_reviewed','update_candidate_frames','list_duplicate_matches','resolve_duplicate','add_workspace_candidate','play_media']) assert.ok(names.includes(name));
  for (const name of ['claim_job_stage','record_job_event','extract_candidate_frames','generate_version','guest_open_review']) assert.ok(!names.includes(name));
  assert.equal(new Set(names).size, names.length);
});
test('MCP exposes the same scoped original-media playback operation without arbitrary fetch destinations', async () => {
  const { ports, calls } = services();
  const playback = { asset_id:'asset',url:'https://synthetic.invalid/authorized-original',expires_at:'2026-10-29T10:00:00Z',mime_type:'video/mp4',source_version_id:null };
  ports.studio.playMedia = async (acting, assetId) => { calls.push([acting,assetId]); return playback; };
  const result = await invokeMcpTool('play_media',{asset_id:'asset'},actor,ports,'mcp-playback');
  assert.equal(result.isError,undefined);assert.deepEqual(calls,[[actor,'asset']]);
  for (const extra of [{url:'https://arbitrary.example'}, {body:{}}, {principal_id:'other'}, {download:true}]) {
    assert.equal((await invokeMcpTool('play_media',{asset_id:'asset',...extra},actor,ports)).isError,true);
  }
  assert.equal(calls.length,1);
});
test('MCP candidate creation preserves null facts and explicit identity/permission boundaries through the app operation', async () => {
  const { ports, calls } = services();
  const facts = { name: null, casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null, languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };
  const input = { body: { facts }, idempotency_key: 'synthetic-mcp-candidate-intent' };
  const result = await invokeMcpTool('create_candidate', input, actor, ports, 'mcp-candidate-request');
  assert.equal(result.isError, undefined);
  assert.deepEqual(calls, [[actor, { facts }, { requestId: 'mcp-candidate-request', clientType: 'mcp', idempotencyKey: input.idempotency_key }]]);
  assert.equal((await invokeMcpTool('create_candidate', { ...input, principal_id: 'forged' }, actor, ports)).isError, true);
  assert.equal((await invokeMcpTool('resolve_duplicate', { candidate_id: 'candidate', body: { row_version: 1, action: 'link_existing', existing_candidate_id: 'other' }, idempotency_key: 'synthetic-mcp-link-intent' }, actor, ports)).isError, true);
  assert.equal(calls.length, 1);
});
test('MCP validates the catalog, passes the fixed acting user and mcp audit context to the same specs operation', async () => {
  const { ports, calls } = services();
  const result = await invokeMcpTool('update_role', { role_id: 'role', body: { row_version: 1, name: 'Server' } }, actor, ports, 'request-one');
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, { request_id: 'request-one', data: { id: 'synthetic', row_version: 2 } });
  assert.deepEqual(calls, [[actor, 'role', { row_version: 1, name: 'Server' }, { requestId: 'request-one', clientType: 'mcp', idempotencyKey: undefined }]]);
  for (const input of [{ role_id: 'role', body: { row_version: 1, name: 'Server', reviewed_by: 'forged' } },
    { role_id: 'role', principal_id: 'other', body: { row_version: 1 } }, { role_id: '../foreign', body: { row_version: 1 } }]) {
    assert.equal((await invokeMcpTool('update_role', input, actor, ports)).isError, true);
  }
  assert.equal(calls.length, 1);
});
test('MCP preserves scoped capability/stale errors without serializing private exception messages', async () => {
  const { ports } = services();
  ports.specs.getSpecs = async () => { throw new DomainError('RESOURCE_NOT_FOUND', 'No accessible requirements.', 404); };
  let result = await invokeMcpTool('get_specs', { workspace_id: 'foreign' }, actor, ports);
  assert.equal(result.isError, true); assert.equal((result.structuredContent as { error: { code: string } }).error.code, 'RESOURCE_NOT_FOUND');
  ports.specs.getSpecs = async () => { throw new Error('private-credential-and-source'); };
  result = await invokeMcpTool('get_specs', { workspace_id: 'foreign' }, actor, ports);
  assert.ok(!JSON.stringify(result).includes('private-credential-and-source'));
});
test('local MCP allows signed-in same-origin requests or explicit bearer, denies fixtures/production/DNS rebinding', () => {
  const config = { adapterMode: 'supabase', environment: 'development', baseUrl: 'http://127.0.0.1:3000' };
  const request = (headers: Record<string,string>) => new Request(`${config.baseUrl}/mcp`, { method: 'POST', headers });
  assert.doesNotThrow(() => requireLocalMcpRequest(request({ host: '127.0.0.1:3000', origin: config.baseUrl }), config));
  assert.doesNotThrow(() => requireLocalMcpRequest(request({ host: '127.0.0.1:3000', authorization: 'Bearer synthetic' }), config));
  const deniedHeaders:Record<string,string>[]=[{ host: 'attacker.test', origin: config.baseUrl }, { host: '127.0.0.1:3000', origin: 'https://attacker.test' },
    { host: '127.0.0.1:3000' }];
  for (const headers of deniedHeaders) assert.throws(() => requireLocalMcpRequest(request(headers), config));
  for (const changed of [{ adapterMode: 'local_fixture' }, { environment: 'production' }, { baseUrl: 'https://studio.example' }]) {
    assert.throws(() => requireLocalMcpRequest(request({ host: '127.0.0.1:3000', origin: config.baseUrl }), { ...config, ...changed }));
  }
});
test('official MCP client negotiates a real protocol connection and calls the shared operation', async () => {
  const { ports, calls } = services();
  const server = createStudioMcpServer(actor, ports);
  const client = new Client({ name: 'eps-deterministic-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  try {
    const tools = await client.listTools(); assert.ok(tools.tools.some(tool => tool.name === 'get_specs'));
    const result = await client.callTool({ name: 'get_specs', arguments: { workspace_id: 'workspace' } });
    assert.equal(result.isError, undefined); assert.equal(calls.length, 1); assert.deepEqual(calls[0], [actor, 'workspace']);
  } finally { await client.close(); await server.close(); }
});
test('official SDK serves authenticated per-request Streamable HTTP and preserves current actor across tool calls', async () => {
  const { ports, calls } = services(); let authenticated = 0;
  const handler = createMcpHandler(() => createStudioMcpServer(actor, ports), { responseMode: 'json', legacy: 'stateless', maxRequestBodySize: 96 * 1024 });
  const client = new Client({ name: 'eps-http-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3000/mcp'), {
    requestInit: { headers: { authorization: 'Bearer synthetic-user-token' } },
    fetch: async (url, init) => {
      const request = new Request(url, init); const headers = new Headers(request.headers); headers.set('host','127.0.0.1:3000');
      const forwarded = new Request(request, { headers });
      requireLocalMcpRequest(forwarded, { adapterMode: 'supabase', environment: 'test', baseUrl: 'http://127.0.0.1:3000' });
      assert.equal(forwarded.headers.get('authorization'), 'Bearer synthetic-user-token'); authenticated++;
      return await handler.fetch(forwarded);
    },
  });
  try {
    await client.connect(transport); const tools = await client.listTools(); assert.equal(tools.tools.length, implementedMcpTools().length);
    const result = await client.callTool({ name: 'get_specs', arguments: { workspace_id: 'workspace' } });
    assert.equal(result.isError, undefined); assert.ok(authenticated >= 2); assert.deepEqual(calls, [[actor,'workspace']]);
  } finally { await client.close(); await handler.close(); }
});
