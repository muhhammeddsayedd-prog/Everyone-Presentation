import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { createCentralStudio, createBearerUserClient } from '@eps/central';
import { handleWorkspaceSummaryRequest } from '../../apps/web/lib/workspace-summary-http.ts';
import { createStudioMcpServer, implementedMcpTools, type McpServices } from '../../apps/web/lib/mcp.ts';
import { validateContract } from '../../apps/web/lib/validation.ts';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';
import { summaryId as id, workspaceSummaryFixture as summary } from '../fixtures/workspace-summary.ts';
import { withSyntheticApiRoute } from '../fixtures/next-api-route.ts';

async function fixture() {
  const actor = { principal_id: id(9) }; let read = true, project = true, withCast = false, calls = 0;
  const studio = await createCentralStudio(createBearerUserClient({ url: 'https://summary.synthetic.invalid', publishableKey: 'sb_publishable_synthetic_summary', accessToken: 'synthetic-summary-user' }, {
    fetch: async (input, init) => {
      const request = new Request(input, init), path = new URL(request.url).pathname;
      if (path === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
      if (path === '/rest/v1/rpc/eps_get_capabilities') return Response.json({ ...await syntheticMcpStudio(actor.principal_id).getCapabilities(actor), capabilities: ['projects.read', ...(read ? ['workspaces.read'] : []), ...(withCast ? ['cast.read'] : [])] });
      assert.equal(path, '/rest/v1/rpc/eps_get_workspace_summary'); calls++;
      if (!read || !project) return Response.json({ code: 'P0001', message: read ? 'RESOURCE_NOT_FOUND' : 'CAPABILITY_REQUIRED' }, { status: 400 });
      assert.deepEqual(await request.json(), { p_workspace_id: id(1) });
      return Response.json({ ...summary(), unreviewed_candidate_count: withCast ? 2 : null });
    },
  }));
  return { actor, studio, calls: () => calls, revokeCapability() { read = false; }, revokeProject() { project = false; }, allowCast() { withCast = true; } };
}
const url = `http://127.0.0.1/api/v1/workspaces/${id(1)}/summary`;

test('HTTP and official MCP client return the same closed summary through the same user RPC', async () => {
  const h = await fixture(), request = new Request(url);
  const http = await handleWorkspaceSummaryRequest(request, ['workspaces', id(1), 'summary'], h.actor, h.studio, 'summary-parity');
  const body = await http.json(); validateContract('WorkspaceSummary', body.data);
  assert.equal(http.headers.get('cache-control')?.includes('no-store'), true);
  const server = createStudioMcpServer(h.actor, { studio: h.studio } as McpServices);
  const client = new Client({ name: 'workspace-summary-test', version: '1.0.0' }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const tool = (await client.listTools()).tools.find(tool => tool.name === 'get_workspace_summary')!;
    assert.ok(tool); assert.equal(tool.annotations?.readOnlyHint, true); assert.equal(tool.annotations?.destructiveHint, false);
    const validator = new AjvJsonSchemaValidator();
    type Schema = Parameters<typeof validator.getValidator>[0];
    assert.equal(validator.getValidator(tool.inputSchema as Schema)({ workspace_id: id(1), principal_id: id(9) }).valid, false);
    const result = await client.callTool({ name: 'get_workspace_summary', arguments: { workspace_id: id(1) } });
    assert.equal(result.isError, undefined); assert.deepEqual((result.structuredContent as { data: unknown }).data, body.data);
    assert.equal(validator.getValidator(tool.outputSchema as Schema)(result.structuredContent).valid, true);
    assert.equal(h.calls(), 2);
    h.allowCast(); const authorized = await client.callTool({ name: 'get_workspace_summary', arguments: { workspace_id: id(1) } });
    assert.equal((authorized.structuredContent as { data: { unreviewed_candidate_count: number } }).data.unreviewed_candidate_count, 2);
    h.revokeProject(); const denied = await client.callTool({ name: 'get_workspace_summary', arguments: { workspace_id: id(1) } });
    assert.equal(denied.isError, true); assert.equal((denied.structuredContent as { error: { code: string } }).error.code, 'RESOURCE_NOT_FOUND');
    h.revokeCapability(); const before = h.calls();
    assert.equal((await client.listTools()).tools.some(tool => tool.name === 'get_workspace_summary'), false);
    assert.equal((await client.callTool({ name: 'get_workspace_summary', arguments: { workspace_id: id(1) } })).isError, true);
    assert.equal(h.calls(), before);
  } finally { await client.close(); await server.close(); }
});

test('HTTP summary rejects unsupported input before invoking the aggregate', async () => {
  const h = await fixture();
  for (const request of [new Request(`${url}?cast_read=true`), new Request(url, { method: 'POST' }), new Request(url.replace(id(1), 'bad'))]) {
    await assert.rejects(() => handleWorkspaceSummaryRequest(request, ['workspaces', request.url.includes('/bad/') ? 'bad' : id(1), 'summary'], h.actor, h.studio, 'summary-invalid'));
  }
  assert.equal(h.calls(), 0);
  assert.ok(implementedMcpTools().some(tool => tool.name === 'get_workspace_summary'));
  assert.throws(() => validateContract('WorkspaceSummary', { ...summary(), review_issue_count: 0 }));
});

test('exported Next API route catches asynchronous summary failures into safe HTTP envelopes', async t => {
  let errorCode = 'RESOURCE_NOT_FOUND', rpcCalls = 0;
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init), path = new URL(request.url).pathname;
    assert.equal(request.headers.get('authorization'), 'Bearer synthetic-summary-user');
    if (path === '/auth/v1/user') return Response.json({ id: id(9), role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    assert.equal(path, '/rest/v1/rpc/eps_get_workspace_summary'); rpcCalls++;
    return Response.json({ code: 'P0001', message: errorCode, details: 'PRIVATE_SQL_DIAGNOSTIC' }, { status: 400 });
  });
  await withSyntheticApiRoute({ NODE_ENV: 'test', APP_ENV: 'test', APP_BASE_URL: 'http://127.0.0.1:3000',
    CENTRAL_ADAPTER_MODE: 'supabase', SUPABASE_URL: 'https://summary.synthetic.invalid',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_summary' }, async call => {
    for (const [code, status] of [['RESOURCE_NOT_FOUND', 404], ['CAPABILITY_REQUIRED', 403], ['WORKSPACE_SUMMARY_INVALID', 503]] as const) {
      errorCode = code;
      const request = new Request(url, { headers: { authorization: 'Bearer synthetic-summary-user' } });
      const response = await call(request, ['workspaces', id(1), 'summary']);
      const body = await response.json();
      assert.equal(response.status, status, JSON.stringify({ error: body.error.code, rpcCalls })); assert.equal(body.error.code, code);
      assert.match(body.request_id, /^[a-f0-9-]{36}$/u); assert.equal(response.headers.get('cache-control')?.includes('no-store'), true);
      assert.equal(JSON.stringify(body).includes('PRIVATE_SQL'), false);
    }
    const request = new Request(`${url}?forged=true`, { headers: { authorization: 'Bearer synthetic-summary-user' } });
    const response = await call(request, ['workspaces', id(1), 'summary']);
    assert.equal(response.status, 400); assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
    assert.equal(rpcCalls, 3);
  });
});
