import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@eps/domain';
import { createStudioMcpServer, implementedMcpTools, invokeMcpTool, requireLocalMcpRequest, type McpServices } from '../../apps/web/lib/mcp.ts';
import { Client, InMemoryTransport, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { createBearerUserClient } from '../../packages/central/src/client.ts';
import { createCentralCandidateSupport } from '../../packages/central/src/candidate-support.ts';

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

test('support archive publishes version-only input and Success through the official MCP client',async()=>{
 const principal='10000000-0000-4000-8000-000000000001',support='30000000-0000-4000-8000-000000000001';let rpcCalls=0;
 const sdk=createBearerUserClient({url:'https://synthetic-support.example.invalid',publishableKey:'sb_publishable_synthetic',accessToken:'synthetic-user-token'},{fetch:async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input));if(url.pathname==='/auth/v1/user')return Response.json({id:principal,role:'authenticated',aud:'authenticated',is_anonymous:false});
  assert.equal(url.pathname,'/rest/v1/rpc/eps_archive_candidate_support');assert.equal(JSON.parse(String(init?.body)).p_support_id,support);rpcCalls++;return Response.json({ok:true});
 }});
 const{ports}=services();ports.candidates.archiveCandidateSupport=(await createCentralCandidateSupport(sdk)).archiveCandidateSupport;
 const acting={principal_id:principal},server=createStudioMcpServer(acting,ports),client=new Client({name:'eps-support-archive-test',version:'1.0.0'});
 const[clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();await server.connect(serverTransport);await client.connect(clientTransport);
 try{
  const tool=(await client.listTools()).tools.find(v=>v.name==='archive_candidate_support')!;assert.ok(tool);
  // The protocol DTO permits wider JSON values than the SDK validator's schema
  // type; compilation below validates the advertised schemas at runtime.
  type Schema=Parameters<AjvJsonSchemaValidator['getValidator']>[0];
  const validator=new AjvJsonSchemaValidator(),inputCheck=validator.getValidator(tool.inputSchema as Schema),outputCheck=validator.getValidator(tool.outputSchema as Schema);
  const args={candidate_support_id:support,body:{row_version:1},idempotency_key:'synthetic-support-archive'};assert.equal(inputCheck(args).valid,true);
  for(const reason of [null,'Unsupported reason'])assert.equal(inputCheck({...args,body:{...args.body,reason}}).valid,false);
  const result=await client.callTool({name:tool.name,arguments:args});assert.equal(result.isError,undefined);assert.equal(outputCheck(result.structuredContent).valid,true);
  assert.deepEqual((result.structuredContent as {data:unknown}).data,{success:true,affected_ids:[support]});assert.equal(outputCheck({request_id:'test',data:{ok:true}}).valid,false);
  for(const reason of [null,'Unsupported reason'])assert.equal((await invokeMcpTool(tool.name,{...args,body:{...args.body,reason}},acting,ports)).isError,true);
  assert.equal(rpcCalls,1);
 }finally{await client.close();await server.close();}
});
test('implemented candidate tools include filters and frame extraction; private callbacks and future generation stay absent', () => {
  const names = implementedMcpTools().map(tool => tool.name);
  for (const name of ['get_specs','submit_specs','list_roles','resize_role_slots','reorder_workspace','retry_job','get_project','create_upload_session']) assert.ok(names.includes(name));
  for (const name of ['search_candidates','create_candidate','confirm_candidate_reviewed','update_candidate_frames','list_duplicate_matches','resolve_duplicate','add_workspace_candidate','play_media','suggest_candidate_filters','extract_candidate_frames']) assert.ok(names.includes(name));
  for (const name of ['claim_job_stage','record_job_event','generate_version','guest_open_review']) assert.ok(!names.includes(name));
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
test('MCP role filters and chosen frame jobs use the shared actor-scoped operations',async()=>{
  const {ports,calls}=services();
  ports.candidates.suggestCandidateFilters=async(...args)=>{calls.push(args);return {role_id:'role',include_unknown:true,suggested_filters:[],explanations:[]};};
  ports.candidates.extractCandidateFrames=async(...args)=>{calls.push(args);return {job_id:'job',resource_id:'media',poll_url:'/api/v1/jobs/job',status:'queued'};};
  assert.equal((await invokeMcpTool('suggest_candidate_filters',{role_id:'role'},actor,ports)).isError,undefined);
  assert.deepEqual(calls[0],[actor,'role']);
  const body={source_asset_id:'source',timestamps_ms:[1234]};
  assert.equal((await invokeMcpTool('extract_candidate_frames',{candidate_media_id:'media',body,idempotency_key:'synthetic-frame-intent'},actor,ports,'frame-request')).isError,undefined);
  assert.deepEqual(calls[1],[actor,'media',body,{requestId:'frame-request',clientType:'mcp',idempotencyKey:'synthetic-frame-intent'}]);
  assert.equal((await invokeMcpTool('extract_candidate_frames',{candidate_media_id:'media',body:{...body,url:'https://outside.invalid'},idempotency_key:'synthetic-frame-intent'},actor,ports)).isError,true);
  assert.equal(calls.length,2);
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
