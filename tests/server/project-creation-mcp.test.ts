import test from 'node:test';
import assert from 'node:assert/strict';
import { invokeMcpTool, type McpServices } from '../../apps/web/lib/mcp.ts';
import { mcpCapabilityAllowed } from '../../apps/web/lib/mcp-capabilities.ts';
import { validateContract } from '../../apps/web/lib/validation';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import catalog from '../../contracts/mcp-tool-catalog.json';

test('create_project MCP forwards acting identity, intent, key and context to the canonical operation', async () => {
  const actor = { principal_id: '10000000-0000-4000-8000-000000000001' };
  const body = { name: 'New project', presentation_type: 'wardrobe' };
  const project = { id: '20000000-0000-4000-8000-000000000001', ...body, client_id: null, client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: null, can_edit: true };
  const calls: unknown[][] = [];
  const services = { studio: { createProject: async (...args: unknown[]) => { calls.push(args); return project; } } } as unknown as McpServices;
  type Schema = Parameters<AjvJsonSchemaValidator['getValidator']>[0];
  const check = new AjvJsonSchemaValidator().getValidator(catalog.tools.find(tool => tool.name === 'create_project')!.outputSchema as unknown as Schema);
  const checked = check({ request_id: 'project-request', data: project });
  assert.equal(checked.valid, true, JSON.stringify(checked));
  const result = await invokeMcpTool('create_project', { body, idempotency_key: 'mcp-project-create-intent' }, actor, services, 'project-request');
  assert.equal(result.isError, undefined, JSON.stringify(result));
  assert.deepEqual(calls, [[actor, body, { requestId: 'project-request', clientType: 'mcp', idempotencyKey: 'mcp-project-create-intent' }]]);
  validateContract('Project', (result.structuredContent as { data: unknown }).data);
  for (const malicious of [{ ...body, principal_id: actor.principal_id }, { ...body, presentation_type: 'unknown' }]) {
    assert.equal((await invokeMcpTool('create_project', { body: malicious, idempotency_key: 'mcp-project-create-intent' }, actor, services)).isError, true);
  }
  assert.equal(calls.length, 1);
  assert.equal(mcpCapabilityAllowed('projects.read AND projects.write', new Set(['projects.write'])), false);
  assert.equal(mcpCapabilityAllowed('projects.read AND projects.write', new Set(['projects.read', 'projects.write'])), true);
});
