import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { createCentralSettings, createCentralStudio } from '@eps/central';
import { createBearerUserClient } from '../../packages/central/src/client.ts';
import { createStudioMcpServer, type McpServices } from '../../apps/web/lib/mcp.ts';
import { handleSettingsRequest } from '../../apps/web/lib/settings-http.ts';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';

const principal = '10000000-0000-4000-8000-000000000001', actor = { principal_id: principal };
const settings = { template_version: '1.1.0', default_timezone: 'Africa/Cairo', default_review_expiry_days: 30 as const, models: {}, row_version: 1 };
async function fixture() {
  let current = { ...settings }, updates = 0; let allowed = true;
  const trace: { method: string; key?: string; clientType: string | null }[] = [];
  const client = createBearerUserClient({ url: 'https://synthetic-settings.example.invalid', publishableKey: 'sb_publishable_synthetic_settings', accessToken: 'synthetic-settings-user-token' }, {
    fetch: async (input, init) => {
      const request = new Request(input, init), path = new URL(request.url).pathname;
      assert.equal(request.headers.get('authorization'), 'Bearer synthetic-settings-user-token');
      if (path === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
      if (path === '/rest/v1/rpc/eps_get_capabilities') return Response.json({ ...await syntheticMcpStudio(principal).getCapabilities(actor), capabilities: allowed ? ['settings.manage', 'workspaces.read'] : ['workspaces.read'] });
      const body = await request.json();
      if (path === '/rest/v1/rpc/eps_get_settings') { trace.push({ method: 'get', clientType: request.headers.get('x-eps-client-type') }); return Response.json(current); }
      assert.equal(path, '/rest/v1/rpc/eps_update_settings');
      assert.equal(body.p_input.row_version, 1); assert.ok(body.p_idempotency_key.length >= 16);
      updates++; trace.push({ method: 'update', key: body.p_idempotency_key, clientType: request.headers.get('x-eps-client-type') });
      current = { ...current, ...body.p_input, row_version: 2 }; return Response.json(current);
    },
  });
  const service = await createCentralSettings(client), studio = await createCentralStudio(client);
  return { service, studio, trace, updates: () => updates, revoke() { allowed = false; } };
}
test('settings HTTP rejects malformed or unkeyed mutations before any central change', async () => {
  const h = await fixture();
  for (const body of [{ row_version: 1, models: { secret: 'forbidden' } }, { row_version: 1, default_timezone: 'not-a-zone' }, { row_version: 1, default_timezone: 'UTC' }]) {
    const response = await handleSettingsRequest(new Request('http://127.0.0.1/api/v1/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), ['settings'], actor, h.service, { requestId: 'settings-negative' });
    assert.equal(response.status, 400);
  }
  const response = await handleSettingsRequest(new Request('http://127.0.0.1/api/v1/settings?principal=other'), ['settings'], actor, h.service, { requestId: 'settings-query' });
  assert.equal(response.status, 400); assert.equal(h.updates(), 0);
});
test('official MCP settings schemas, acting-user facade and trace metadata agree', async () => {
  const h = await fixture(), server = createStudioMcpServer(actor, { studio: h.studio, settings: h.service } as unknown as McpServices);
  const client = new Client({ name: 'eps-settings-protocol', version: '1.0.0' }); const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  try {
    const tools = (await client.listTools()).tools, tool = tools.find(value => value.name === 'update_settings')!; assert.ok(tool);
    const validator = new AjvJsonSchemaValidator(); type Schema = Parameters<AjvJsonSchemaValidator['getValidator']>[0];
    const input = { body: { row_version: 1, default_timezone: 'UTC' }, idempotency_key: 'synthetic-settings-mcp-intent' };
    assert.equal(validator.getValidator(tool.inputSchema as Schema)(input).valid, true);
    assert.equal(validator.getValidator(tool.inputSchema as Schema)({ body: input.body }).valid, false);
    assert.equal((await client.callTool({ name: 'get_settings', arguments: {} })).isError, undefined);
    const result = await client.callTool({ name: 'update_settings', arguments: input }); assert.equal(result.isError, undefined);
    assert.equal(validator.getValidator(tool.outputSchema as Schema)(result.structuredContent).valid, true);
    assert.equal((result.structuredContent as { data: { default_timezone: string } }).data.default_timezone, 'UTC');
    assert.deepEqual(h.trace.find(value => value.method === 'update'), { method: 'update', key: input.idempotency_key, clientType: 'mcp' });
    h.revoke(); assert.ok(!(await client.listTools()).tools.some(value => value.name === 'get_settings'));
    assert.equal((await client.callTool({ name: 'update_settings', arguments: input })).isError, true); assert.equal(h.updates(), 1);
  } finally { await client.close(); await server.close(); }
});
