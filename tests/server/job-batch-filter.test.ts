import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { DomainError } from '@eps/domain';
import { createBearerUserClient, createCentralJobs } from '@eps/central';
import { handleJobRequest, type JobOperations } from '../../apps/web/lib/job-http.ts';
import { createStudioMcpServer, type McpServices } from '../../apps/web/lib/mcp.ts';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';
import { withSyntheticApiRoute } from '../fixtures/next-api-route.ts';

const actor = { principal_id: 'batch-reader' };
const batch = 'b8380001-0000-4000-8000-000000000001';
const workspace = 'b8380002-0000-4000-8000-000000000001';

test('HTTP and official MCP list_jobs pass the same typed batch filter and retain read-only page shape', async () => {
  const calls: unknown[][] = [];
  const jobs = { async listJobs(...args: unknown[]) { calls.push(args); return { data: [], page: { next_cursor: null } }; } } as unknown as JobOperations;
  const options = { workspace_id: workspace, batch_id: batch, status: 'failed', cursor: 'previous-job', limit: 2 };
  const response = await handleJobRequest(new Request('http://127.0.0.1:3000/api/v1/jobs?' + new URLSearchParams({ ...options, limit: '2' })), ['jobs'], actor, jobs, { requestId: 'batch-http' });
  assert.deepEqual(await response.json(), { request_id: 'batch-http', data: [], page: { next_cursor: null } });
  const server = createStudioMcpServer(actor, { studio: syntheticMcpStudio(actor.principal_id), jobs } as McpServices);
  const client = new Client({ name: 'job-batch-filter', version: '1.0.0' }, { capabilities: {} });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  try {
    const listed = (await client.listTools()).tools.find(tool => tool.name === 'list_jobs')!;
    assert.equal(listed.annotations!.readOnlyHint, true);
    assert.equal(listed.annotations!.idempotentHint, true);
    const result = await client.callTool({ name: 'list_jobs', arguments: options });
    assert.notEqual(result.isError, true);
    assert(result.structuredContent !== null && typeof result.structuredContent === 'object' && 'page' in result.structuredContent);
    assert.deepEqual(result.structuredContent.page, { next_cursor: null });
    const validator = new AjvJsonSchemaValidator().getValidator(listed.outputSchema!);
    assert.equal(validator(result.structuredContent).valid, true);
    assert.deepEqual(calls, [[actor, options], [actor, options]]);
    const before = calls.length;
    assert.equal((await client.callTool({ name: 'list_jobs', arguments: { batch_id: 'not-a-uuid' } })).isError, true);
    assert.equal((await client.callTool({ name: 'list_jobs', arguments: { batch_id: batch, principal_id: 'other' } })).isError, true);
    assert.equal(calls.length, before);
  } finally { await client.close(); await server.close(); }
});

test('batch filtering never overrides scope denial; duplicate/malformed filters stop before service', async () => {
  let calls = 0;
  const jobs = { async listJobs() { calls++; throw new DomainError('RESOURCE_NOT_FOUND', 'Accessible jobs not found.', 404); } } as unknown as JobOperations;
  for (const query of [`?batch_id=${batch}&batch_id=${batch}`, '?batch_id=bad', `?batch_id=${batch}&actor=other`]) {
    await assert.rejects(handleJobRequest(new Request('http://127.0.0.1:3000/api/v1/jobs' + query), ['jobs'], actor, jobs, { requestId: 'bad-batch' }), (e: unknown) => e instanceof DomainError && e.code === 'INVALID_REQUEST');
  }
  assert.equal(calls, 0);
  await assert.rejects(handleJobRequest(new Request(`http://127.0.0.1:3000/api/v1/jobs?batch_id=${batch}&workspace_id=${workspace}`), ['jobs'], actor, jobs, { requestId: 'denied-batch' }), (e: unknown) => e instanceof DomainError && e.code === 'RESOURCE_NOT_FOUND');
  assert.equal(calls, 1);
});

test('exported HTTP route sends only the typed batch RPC body and catches current-scope denial', async t => {
  const calls: unknown[] = [];
  let denied = false;
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init), pathname = new URL(request.url).pathname;
    if (pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    assert.equal(pathname, '/rest/v1/rpc/eps_list_jobs_by_batch'); calls.push(await request.json());
    return denied ? Response.json({ code: 'P0001', message: 'RESOURCE_NOT_FOUND', details: 'PRIVATE_SCOPE_DIAGNOSTIC' }, { status: 400 })
      : Response.json({ data: [], page: { next_cursor: null } });
  });
  const origin = 'http://127.0.0.1:3000';
  await withSyntheticApiRoute({ NODE_ENV: 'test', APP_ENV: 'test', APP_BASE_URL: origin, CENTRAL_ADAPTER_MODE: 'supabase',
    SUPABASE_URL: 'https://batch.synthetic.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_batch' }, async call => {
    const request = (id: string) => new Request(`${origin}/api/v1/jobs?workspace_id=${workspace}&batch_id=${id}`, { headers: { authorization: 'Bearer synthetic-batch-user' } });
    assert.equal((await call(request(batch), ['jobs'])).status, 200);
    assert.deepEqual(calls, [{ p_workspace_id: workspace, p_status: null, p_cursor: null, p_limit: 25, p_batch_id: batch }]);
    assert.equal((await call(request('invalid'), ['jobs'])).status, 400); assert.equal(calls.length, 1);
    denied = true;
    const response = await call(request(batch), ['jobs']);
    assert.equal(response.status, 404); const body = await response.json(); assert.equal(body.error.code, 'RESOURCE_NOT_FOUND');
    assert.doesNotMatch(JSON.stringify(body), /PRIVATE_SCOPE/u);
  });
});

test('cast-only official MCP preserves own-frame reads and forwards ordinary/foreign denials to the scoped RPC boundary', async () => {
  const principal = 'b8380001-0000-4000-8000-000000000005';
  const own = 'b8380006-0000-4000-8000-000000000007';
  const other = 'b8380006-0000-4000-8000-000000000008';
  const ordinary = 'b8380006-0000-4000-8000-000000000001';
  const row = { id: own, workspace_id: workspace, kind: 'frame_extract', status: 'queued', stage: 'extract_frames', attempt: 0,
    progress_completed: 0, progress_total: null, batch_id: batch, input_asset_id: null, resource_id: null, error: null,
    created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', row_version: 1 };
  const calls: string[] = [];
  // Controlled RPC responses verify the transport boundary, not native RLS.
  // The separate owned SQL fixture exercises real requester/project policies.
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init), path = new URL(request.url).pathname;
    if (path === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    calls.push(path); const args = await request.json();
    if (path === '/rest/v1/rpc/eps_list_jobs_by_batch') return Response.json({ data: [row], page: { next_cursor: null } });
    assert.equal(path, '/rest/v1/rpc/eps_get_job');
    return args.p_job_id === own ? Response.json(row) : Response.json({ code: 'P0001', message: 'RESOURCE_NOT_FOUND', details: 'PRIVATE_FRAME_SCOPE' }, { status: 400 });
  };
  const jobs = await createCentralJobs(createBearerUserClient({ url: 'https://cast-only.synthetic.invalid', publishableKey: 'sb_publishable_synthetic_cast', accessToken: 'synthetic-cast-only' }, { fetch: fetcher }));
  const studio = syntheticMcpStudio(principal);
  const server = createStudioMcpServer({ principal_id: principal }, { jobs, studio: { async getCapabilities(a: { principal_id: string }) {
    return { ...await studio.getCapabilities(a), capabilities: ['cast.read'] };
  } } } as McpServices);
  const client = new Client({ name: 'cast-only-batch-filter', version: '1.0.0' }, { capabilities: {} });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  try {
    const tools = (await client.listTools()).tools.map(tool => tool.name);
    assert(tools.includes('list_jobs')); assert(tools.includes('get_job'));
    assert(!tools.includes('retry_job')); assert(!tools.includes('cancel_job'));
    assert.notEqual((await client.callTool({ name: 'list_jobs', arguments: { batch_id: batch } })).isError, true);
    assert.notEqual((await client.callTool({ name: 'get_job', arguments: { job_id: own } })).isError, true);
    for (const id of [other, ordinary]) {
      const result = await client.callTool({ name: 'get_job', arguments: { job_id: id } });
      assert.equal(result.isError, true); assert.match(JSON.stringify(result), /RESOURCE_NOT_FOUND/u); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_FRAME_SCOPE/u);
    }
    assert.deepEqual(calls, ['/rest/v1/rpc/eps_list_jobs_by_batch', '/rest/v1/rpc/eps_get_job', '/rest/v1/rpc/eps_get_job', '/rest/v1/rpc/eps_get_job']);
  } finally { await client.close(); await server.close(); }
});
