import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { DomainError } from '@eps/domain';
import { optionalSharing } from '../../apps/web/lib/optional-sharing.ts';
import { createStudioMcpServer, type McpServices } from '../../apps/web/lib/mcp.ts';

test('missing guest keys leave existing project operations available through official MCP transport', async () => {
  const sharing = await optionalSharing(async () => { throw new DomainError('REVIEW_CONFIGURATION_REQUIRED', 'Synthetic private configuration unavailable.', 503); });
  const actor = { principal_id: 'synthetic-producer' }; let read = false;
  const project = { id: 'synthetic-project', name: 'Synthetic project', client_id: null, client_name: null, client_logo_asset_id: null,
    row_version: 1, client_row_version: null, casting_workspace_id: null, can_edit: true };
  const services = { sharing, studio: { getProject: async (acting: unknown, id: string) => { assert.deepEqual(acting, actor); assert.equal(id, project.id); read = true; return project; } } } as unknown as McpServices;
  const server = createStudioMcpServer(actor, services), client = new Client({ name: 'eps-optional-sharing', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const tools = (await client.listTools()).tools;
    assert.ok(tools.some(item => item.name === 'get_project'));
    assert.ok(!tools.some(item => item.name === 'create_review_link'));
    const result = await client.callTool({ name: 'get_project', arguments: { project_id: project.id } });
    assert.equal(result.isError, undefined); assert.equal(read, true);
    assert.deepEqual((result.structuredContent as { data: unknown }).data, project);
  } finally { await client.close(); await server.close(); }
});

test('optional sharing does not swallow unexpected service or authorization errors', async () => {
  const problem = new DomainError('ACCESS_DENIED', 'Synthetic denial.', 403);
  await assert.rejects(optionalSharing(async () => { throw problem; }), error => error === problem);
});
