import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createBearerUserClient } from '../../packages/central/src/client.ts';
import { createCentralJobs } from '../../packages/central/src/jobs.ts';
import { handleJobRequest } from '../../apps/web/lib/job-http.ts';
import { createStudioMcpServer, type McpServices } from '../../apps/web/lib/mcp.ts';
import { validateMcpSuccess } from '../../apps/web/lib/mcp-output-validation.ts';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';

const principal = 'aa100000-0000-4000-8000-000000000001';
const jobId = 'aa200000-0000-4000-8000-000000000001';
const actor = { principal_id: principal };
const job = { id: jobId, workspace_id: 'synthetic-workspace', kind: 'presentation_export', status: 'queued', stage: 'render_export', attempt: 2,
  progress_completed: 0, progress_total: null, batch_id: null, input_asset_id: null, resource_id: 'synthetic-export', error: null,
  created_at: '2026-10-30T00:00:00Z', updated_at: '2026-10-30T01:00:00Z', row_version: 10, can_retry: false, can_cancel: true };
const acknowledgement = (status = 'queued') => ({ job_id: jobId, resource_id: job.resource_id, poll_url: `/api/v1/jobs/${jobId}`, status });

async function fixture(status = 'queued', denied = false) {
  const calls: { body: unknown; headers: Headers }[] = [];
  const client = createBearerUserClient({ url: 'https://synthetic-retry.example.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-user-bearer' }, {
    fetch: async (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
      if (path === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
      assert.equal(path, '/rest/v1/rpc/eps_retry_job');
      calls.push({ body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
      return denied ? Response.json({ code: '42501', message: 'synthetic denied' }, { status: 403 })
        : Response.json({ ...job, status, can_cancel: ['queued', 'running', 'waiting_for_input'].includes(status) });
    },
  });
  return { jobs: await createCentralJobs(client), calls };
}

test('HTTP projects the actual internal retry job to the published 202 acknowledgement, including a finished replay', async () => {
  for (const status of ['queued', 'succeeded']) {
    const { jobs, calls } = await fixture(status);
    const request = new Request(`http://127.0.0.1:3000/api/v1/jobs/${jobId}/retry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ row_version: 9 }) });
    const context = { requestId: 'retry-request', clientType: 'api' as const, idempotencyKey: 'same-retry-intent' };
    const response = await handleJobRequest(request, ['jobs', jobId, 'retry'], actor, jobs, context);
    assert.equal(response.status, 202); assert.match(response.headers.get('cache-control')!, /no-store/u);
    const output = await response.json();
    assert.deepEqual(output, { request_id: context.requestId, data: acknowledgement(status) });
    assert.equal(validateMcpSuccess('retry_job', output), output);
    assert.deepEqual(calls[0].body, { p_job_id: jobId, p_input: { row_version: 9 }, p_idempotency_key: context.idempotencyKey });
    assert.equal(calls[0].headers.get('authorization'), 'Bearer synthetic-user-bearer');
  }
});

test('official MCP client receives the same valid acknowledgement and preserves current authority and intent', async () => {
  const { jobs, calls } = await fixture();
  let allowed = true;
  const studio = syntheticMcpStudio(principal);
  const ports = { jobs, studio: { async getCapabilities(acting: typeof actor) {
    const current = await studio.getCapabilities(acting);
    return { ...current, capabilities: allowed ? current.capabilities : ['workspaces.read'] };
  } } } as unknown as McpServices;
  const server = createStudioMcpServer(actor, ports), client = new Client({ name: 'synthetic-retry-ack', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  try {
    assert.ok((await client.listTools()).tools.some(tool => tool.name === 'retry_job'));
    const args = { job_id: jobId, body: { row_version: 9 }, idempotency_key: 'same-mcp-retry-intent' };
    const result = await client.callTool({ name: 'retry_job', arguments: args });
    assert.equal(result.isError, undefined);
    assert.deepEqual((result.structuredContent as { data: unknown }).data, acknowledgement());
    assert.equal(validateMcpSuccess('retry_job', result.structuredContent), result.structuredContent);
    assert.deepEqual(calls[0].body, { p_job_id: jobId, p_input: { row_version: 9 }, p_idempotency_key: args.idempotency_key });
    assert.equal(calls[0].headers.get('x-eps-client-type'), 'mcp');
    allowed = false;
    assert.equal((await client.callTool({ name: 'retry_job', arguments: args })).isError, true);
    assert.equal(calls.length, 1);
  } finally { await client.close(); await server.close(); }
});

test('central retry permission errors stay errors rather than fabricated acknowledgements', async () => {
  const { jobs, calls } = await fixture('queued', true);
  const request = new Request(`http://127.0.0.1:3000/api/v1/jobs/${jobId}/retry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ row_version: 9 }) });
  await assert.rejects(handleJobRequest(request, ['jobs', jobId, 'retry'], actor, jobs, { requestId: 'denied', idempotencyKey: 'same-denied-intent' }),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'CAPABILITY_REQUIRED');
  assert.equal(calls.length, 1);
});
