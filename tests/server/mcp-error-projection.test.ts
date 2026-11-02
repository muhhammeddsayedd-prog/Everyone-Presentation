import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { DomainError, type Actor, type MutationContext, type WorkspaceCandidateCreate } from '@eps/domain';
import catalog from '../../contracts/mcp-tool-catalog.json';
import { createStudioMcpServer, invokeMcpTool, type McpServices } from '../../apps/web/lib/mcp.ts';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';

const actor = { principal_id: 'synthetic-mcp-producer' };
const key = 'synthetic-stable-mutation-intent';
const generate = { series_id: 'synthetic-series', idempotency_key: key,
  body: { expected_workspace_row_version: 4, expected_draft_revision: 7, expected_input_fingerprint: 'a'.repeat(64) } };
function services(): McpServices {
  return { studio: syntheticMcpStudio(actor.principal_id), candidates: {}, specs: {}, jobs: {} } as McpServices;
}
function textError(result: { content: unknown; structuredContent?: unknown }) {
  assert.ok(Array.isArray(result.content));
  const item = result.content.find((entry: { type?: unknown }) => entry.type === 'text');
  assert.equal(typeof item?.text, 'string');
  const error = JSON.parse(item.text) as { request_id: string; error: { code: string; message: string; details: Record<string, unknown>; retryable: boolean } };
  const structured = result.structuredContent as typeof error;
  assert.equal(error.request_id, structured.request_id);
  assert.equal(error.error.code, structured.error.code);
  return error;
}
async function connect(ports: McpServices, allowedCapabilities?: string[]) {
  const server = createStudioMcpServer(actor, ports, { allowedCapabilities });
  const client = new Client({ name: 'eps-error-projection-regression', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  return { client, async close() { await client.close(); await server.close(); } };
}

test('SDK error text distinguishes business capability discovery from a restricted delegation before generation', async () => {
  const ports = services(); let generated = 0;
  ports.presentation = { async generateVersion() { generated++; throw Error('must not dispatch'); } } as unknown as McpServices['presentation'];
  const c = await connect(ports, ['projects.read', 'workspaces.read']);
  try {
    const capabilities = await c.client.callTool({ name: 'get_capabilities', arguments: {} });
    assert.ok((capabilities.structuredContent as { data: { capabilities: string[] } }).data.capabilities.includes('presentations.generate'));
    const result = await c.client.callTool({ name: 'generate_version', arguments: generate });
    assert.equal(result.isError, true); assert.equal(textError(result).error.code, 'CAPABILITY_REQUIRED');
    assert.match(textError(result).error.message, /delegation/u); assert.equal(generated, 0);
  } finally { await c.close(); }
});

test('generation precondition errors expose the safe request and current revision without reflecting arbitrary details', async () => {
  const ports = services(); let generated = 0;
  ports.presentation = { async generateVersion() { generated++; throw new DomainError('INPUT_CHANGED', 'Refresh and measure the current review before generating.', 409,
    { current_row_version: 8, private_payload: 'synthetic-private-details' }); } } as unknown as McpServices['presentation'];
  const result = await invokeMcpTool('generate_version', generate, actor, ports, 'synthetic-generate-request');
  assert.equal(result.isError, true); const value = textError(result);
  assert.equal(value.request_id, 'synthetic-generate-request'); assert.equal(value.error.code, 'INPUT_CHANGED');
  assert.equal(value.error.details.current_row_version, 8); assert.equal(value.error.retryable, false);
  assert.ok(!JSON.stringify(value).includes('synthetic-private-details')); assert.equal(generated, 1);
});

test('advertised optional revoke reason currently fails before mutation and its error must reach text-only clients', async () => {
  const validator = new AjvJsonSchemaValidator();
  const args = { review_link_id: 'synthetic-link', idempotency_key: key, body: { row_version: 1, reason: 'Synthetic revocation reason' } };
  type Schema = Parameters<AjvJsonSchemaValidator['getValidator']>[0];
  assert.equal(validator.getValidator(catalog.tools.find(tool => tool.name === 'revoke_review_link')!.inputSchema as unknown as Schema)(args).valid, true);
  const ports = services(); let revoked = 0;
  ports.sharing = { async revokeReviewLink() { revoked++; throw Error('must not dispatch'); } } as unknown as McpServices['sharing'];
  const result = await invokeMcpTool('revoke_review_link', args, actor, ports, 'synthetic-revoke-request');
  assert.equal(result.isError, true); assert.equal(textError(result).error.code, 'VALIDATION_FAILED'); assert.equal(revoked, 0);
});

test('post-commit response rejection exposes reconciliation guidance without leaking the invalid candidate output', async () => {
  const ports = services(); let commits = 0; const receipts = new Set<string>();
  const candidate = { id: 'synthetic-pool', workspace_id: 'synthetic-workspace', candidate_id: 'synthetic-candidate', selected_candidate_media_id: null,
    selected_frame_asset_ids: [], availability: null, fresh_material_required: false, media_confirmed: false, internal_notes: null, row_version: 1 };
  ports.candidates = { async addWorkspaceCandidate(_actor: Actor, _workspace: string, _body: WorkspaceCandidateCreate, context?: MutationContext) {
    if (!receipts.has(context!.idempotencyKey!)) { receipts.add(context!.idempotencyKey!); commits++; }
    return { ...candidate, private_field: 'synthetic-private-output' };
  }, async listWorkspaceCandidates() { return { data: [candidate], page: { next_cursor: null } }; } } as unknown as McpServices['candidates'];
  const args = { workspace_id: candidate.workspace_id, idempotency_key: key, body: { candidate_id: candidate.candidate_id } };
  const c = await connect(ports);
  try {
    const result = await c.client.callTool({ name: 'add_workspace_candidate', arguments: args });
    assert.equal(result.isError, true); const error = textError(result);
    assert.equal(error.error.code, 'OPERATION_RESPONSE_INVALID'); assert.match(error.error.message, /same idempotency key/iu);
    assert.ok(!JSON.stringify(result).includes('synthetic-private-output'));
    await c.client.callTool({ name: 'add_workspace_candidate', arguments: args }); assert.equal(commits, 1);
    const readback = await c.client.callTool({ name: 'list_workspace_candidates', arguments: { workspace_id: candidate.workspace_id } });
    assert.equal(readback.isError, undefined); assert.deepEqual((readback.structuredContent as { data: unknown[] }).data, [candidate]);
  } finally { await c.close(); }
});

test('unknown internal errors retain closed public error text and never serialize private diagnostics', async () => {
  const ports = services(); ports.presentation = { async generateVersion() { throw new Error('synthetic-private-internal-token'); } } as unknown as McpServices['presentation'];
  const result = await invokeMcpTool('generate_version', generate, actor, ports, 'synthetic-internal-request');
  assert.equal(result.isError, true); assert.equal(textError(result).error.code, 'DEPENDENCY_UNAVAILABLE');
  assert.ok(!JSON.stringify(result).includes('synthetic-private-internal-token'));
  assert.match(textError(result).error.message, /same idempotency key/iu);
});

test('a central post-commit DTO failure retains its code and warns to reconcile before reusing the same intent', async () => {
  const ports = services(); let commits = 0;
  ports.candidates = { async addWorkspaceCandidate() { commits++; throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central candidate data did not match its published contract.', 503); } } as unknown as McpServices['candidates'];
  const result = await invokeMcpTool('add_workspace_candidate', { workspace_id: 'synthetic-workspace', body: { candidate_id: 'synthetic-candidate' }, idempotency_key: key }, actor, ports);
  assert.equal(result.isError, true); assert.equal(textError(result).error.code, 'CENTRAL_RESPONSE_INVALID');
  assert.match(textError(result).error.message, /read the saved state/iu); assert.match(textError(result).error.message, /same idempotency key/iu); assert.equal(commits, 1);
});
