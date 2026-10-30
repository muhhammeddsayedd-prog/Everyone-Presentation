import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createStudioMcpServer, invokeMcpTool, type McpServices } from '../../apps/web/lib/mcp.ts';

const actor = { principal_id: '10000000-0000-4000-8000-000000000001' };
const project = { id: '20000000-0000-4000-8000-000000000001', name: 'Synthetic MCP authority project', client_id: null,
  client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: null, can_edit: true };
function ports(initial = ['workspaces.read', 'projects.read', 'projects.write']) {
  let capabilities = initial;
  let writes = 0;
  const service = { studio: {
    async getCapabilities() { return { principal_id: actor.principal_id, capabilities, timezone: 'Africa/Cairo', enabled_modules: ['casting'],
      upload_policy: { allowed_mime_types: [], maximum_file_bytes: 5242880, recommended_batch_size: 200, available_purposes: [] } }; },
    async getProject() { return project; },
    async updateProject() { writes++; return project; },
  }, specs: {}, jobs: {}, candidates: {} } as unknown as McpServices;
  return { service, setCapabilities(value: string[]) { capabilities = value; }, writes: () => writes };
}
async function connection(service: McpServices, allowedCapabilities?: string[]) {
  const server = createStudioMcpServer(actor, service, { allowedCapabilities });
  const client = new Client({ name: 'eps-m07-authority-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  return { client, async close() { await client.close(); await server.close(); } };
}

test('M07 tools/list exposes only the current business capabilities', async () => {
  const p = ports(['workspaces.read', 'projects.read']); const c = await connection(p.service);
  try {
    const names = (await c.client.listTools()).tools.map(tool => tool.name);
    assert.ok(names.includes('get_project'));
    assert.ok(!names.includes('update_project'));
    assert.ok(!names.includes('confirm_candidate_reviewed'));
    assert.ok(!names.includes('create_review_link'));
  } finally { await c.close(); }
});
test('M07 discovery evaluates the published compound capabilities without replacing resource checks', async () => {
  const p = ports(['workspaces.read', 'cast.read', 'cast.upload']); const c = await connection(p.service);
  try {
    let names = (await c.client.listTools()).tools.map(tool => tool.name);
    for (const name of ['suggest_candidate_filters', 'play_media', 'get_media', 'list_jobs', 'get_job', 'create_upload_session']) {
      assert.ok(names.includes(name), name);
    }
    assert.ok(!names.includes('add_workspace_candidate'));
    p.setCapabilities(['workspaces.write', 'cast.read']);
    names = (await c.client.listTools()).tools.map(tool => tool.name);
    assert.ok(names.includes('add_workspace_candidate'));
    assert.ok(names.includes('create_upload_session'));
    assert.ok(!names.includes('suggest_candidate_filters'));
    assert.ok(!names.includes('list_jobs'));
  } finally { await c.close(); }
});
test('M07 delegation intersects signed limits with business authority for discovery and calls', async () => {
  const p = ports(); const c = await connection(p.service, ['workspaces.read', 'projects.read']);
  try {
    assert.ok(!(await c.client.listTools()).tools.some(tool => tool.name === 'update_project'));
    const result = await c.client.callTool({ name: 'update_project', arguments: { project_id: project.id, body: { row_version: 1, name: 'Forbidden' } } });
    assert.equal(result.isError, true); assert.equal(p.writes(), 0);
  } finally { await c.close(); }
});
test('M07 capability revocation is re-read for every call and list, without session authority cache', async () => {
  const p = ports(); const c = await connection(p.service);
  try {
    assert.ok((await c.client.listTools()).tools.some(tool => tool.name === 'update_project'));
    p.setCapabilities(['workspaces.read', 'projects.read']);
    const result = await c.client.callTool({ name: 'update_project', arguments: { project_id: project.id, body: { row_version: 1, name: 'Denied' } } });
    assert.equal(result.isError, true); assert.equal(p.writes(), 0);
    assert.ok(!(await c.client.listTools()).tools.some(tool => tool.name === 'update_project'));
  } finally { await c.close(); }
});
test('M07 malformed successful service output fails closed without publishing its private fields', async () => {
  const p = ports(); p.service.studio.getProject = async () => ({ ...project, unexpected_private_field: 'synthetic-private-output-marker' });
  const result = await invokeMcpTool('get_project', { project_id: project.id }, actor, p.service, 'output-request');
  assert.equal(result.isError, true);
  assert.equal((result.structuredContent as { error: { code: string } }).error.code, 'OPERATION_RESPONSE_INVALID');
  assert.ok(!JSON.stringify(result).includes('synthetic-private-output-marker'));
});
test('M07 correct published output remains available through the official SDK', async () => {
  const p = ports(); const c = await connection(p.service);
  try {
    const result = await c.client.callTool({ name: 'get_project', arguments: { project_id: project.id } });
    assert.equal(result.isError, undefined);
    assert.deepEqual((result.structuredContent as { data: unknown }).data, project);
  } finally { await c.close(); }
});
