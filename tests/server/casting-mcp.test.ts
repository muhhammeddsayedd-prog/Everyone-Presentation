import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { DomainError, type Workspace } from '@eps/domain';
import type { Assignment, CastingOperations } from '../../packages/domain/src/casting-types';
import { createStudioMcpServer, invokeMcpTool, type McpServices } from '../../apps/web/lib/mcp';

const actor = { principal_id: 'synthetic-casting-actor' };
const castingNames = ['list_assignments', 'create_assignment', 'update_assignment', 'set_slot_main', 'undo_slot_main', 'remove_assignment'];
const assignment = (patch: Partial<Assignment> = {}): Assignment => ({ id: 'assignment', workspace_id: 'workspace', slot_id: 'slot',
  workspace_candidate_id: 'participation', position: 'option', shortlist_included: false, presentation_notes: null,
  internal_notes: null, slide_wording: {}, sort_order: 0, row_version: 1, archived: false, ...patch });
const workspace: Workspace = { id: 'workspace', project_id: 'project', module: 'casting', title: 'Synthetic project', logo_asset_id: null,
  logo_placement: 'cover', active_output: 'selection', row_version: 4, draft_revision: 3, has_unpublished_changes: true,
  created_at: '2026-10-29T00:00:00Z', updated_at: '2026-10-29T00:00:00Z' };
const slot = { id: 'slot', role_id: 'role', label: 'Synthetic slot', sort_order: 0, row_version: 2, archived: false };
const inverse = { undo_event_id: 'event', slot_id: 'slot', expected_slot_row_version: 2,
  restore_assignment_positions: [{ assignment_id: 'assignment', position: 'option' as const }] };

function fixture() {
  const calls: unknown[][] = [];
  const casting: CastingOperations = {
    async listAssignments(...args) { calls.push(['listAssignments', ...args]); return { data: [assignment()], page: { next_cursor: null } }; },
    async createAssignment(...args) { calls.push(['createAssignment', ...args]); return assignment({ shortlist_included: true }); },
    async updateAssignment(...args) { calls.push(['updateAssignment', ...args]); return assignment({ row_version: 2, presentation_notes: 'This assignment only' }); },
    async setSlotMain(...args) { calls.push(['setSlotMain', ...args]); return { slot, affected_assignments: [assignment({ position: 'main', row_version: 2 })], undo: inverse }; },
    async undoSlotMain(...args) { calls.push(['undoSlotMain', ...args]); return { slot: { ...slot, row_version: 3 }, affected_assignments: [assignment({ row_version: 3 })], undo: null }; },
    async removeAssignment(...args) { calls.push(['removeAssignment', ...args]); return { success: true, affected_ids: ['assignment'] }; },
    async reorderWorkspace(...args) { calls.push(['reorderWorkspace', ...args]); return workspace; },
  };
  const services = { casting, specs: { async reorderWorkspace(...args: unknown[]) { calls.push(['legacyReorderWorkspace', ...args]); return workspace; } } } as unknown as McpServices;
  return { calls, casting, services };
}

test('casting domain and central facades export published parsers and the service factory', async () => {
  const domain = await import('@eps/domain'); const central = await import('@eps/central');
  assert.equal(typeof domain.parseAssignmentCreate, 'function'); assert.equal(typeof domain.assignmentsForOutput, 'function');
  assert.equal(typeof central.createCentralCasting, 'function');
});

test('official MCP client advertises composed casting and validates all seven shared operation results', async () => {
  const { calls, services } = fixture(); const server = createStudioMcpServer(actor, services);
  const client = new Client({ name: 'eps-casting-protocol-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair(); await server.connect(serverTransport); await client.connect(clientTransport);
  try {
    const tools = (await client.listTools()).tools;
    for (const name of [...castingNames, 'reorder_workspace']) assert.ok(tools.some(tool => tool.name === name), name);
    type Schema = Parameters<AjvJsonSchemaValidator['getValidator']>[0]; const validator = new AjvJsonSchemaValidator();
    const key = 'synthetic-casting-protocol-intent';
    const scenarios = [
      ['list_assignments', { workspace_id: 'workspace', output_type: 'selection', limit: 25 }, 'listAssignments', ['workspace', { output_type: 'selection', limit: 25 }]],
      ['create_assignment', { workspace_id: 'workspace', body: { slot_id: 'slot', workspace_candidate_id: 'participation', expected_slot_row_version: 1, shortlist_included: true }, idempotency_key: key }, 'createAssignment'],
      ['update_assignment', { assignment_id: 'assignment', body: { row_version: 1, presentation_notes: 'This assignment only' }, idempotency_key: key }, 'updateAssignment'],
      ['update_assignment', { assignment_id: 'assignment', body: { row_version: 1, slide_wording: { skills_experience: 'Confirmed proposal' }, ai_suggestion_id: 'suggestion', expected_series_id: 'series', expected_input_fingerprint: 'a'.repeat(64) }, idempotency_key: key }, 'updateAssignment'],
      ['set_slot_main', { slot_id: 'slot', body: { assignment_id: 'assignment', expected_slot_row_version: 1, replacement_behavior: 'move_previous_to_backup' }, idempotency_key: key }, 'setSlotMain'],
      ['undo_slot_main', { slot_id: 'slot', body: inverse, idempotency_key: key }, 'undoSlotMain'],
      ['remove_assignment', { assignment_id: 'assignment', body: { row_version: 3, reason: 'This slot only' }, idempotency_key: key }, 'removeAssignment'],
      ['reorder_workspace', { workspace_id: 'workspace', body: { row_version: 3, role_ids: ['role'], slot_ids_by_role: { role: ['slot'] }, assignment_ids_by_slot: { slot: ['assignment'] } }, idempotency_key: key }, 'reorderWorkspace'],
    ] as const;
    for (const [name, args, method] of scenarios) {
      const tool = tools.find(row => row.name === name)!;
      assert.equal(validator.getValidator(tool.inputSchema as Schema)(args).valid, true, name);
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, undefined, name);
      assert.equal(validator.getValidator(tool.outputSchema as Schema)(result.structuredContent).valid, true, name);
      const call = calls.at(-1)!; assert.equal(call[0], method); assert.deepEqual(call[1], actor);
      if (name !== 'list_assignments') {
        const context = call.at(-1) as { clientType: string; idempotencyKey: string; requestId: string };
        assert.equal(context.clientType, 'mcp'); assert.equal(context.idempotencyKey, key); assert.ok(context.requestId);
        assert.deepEqual(call[3], args.body);
      }
    }
    assert.equal(calls.length, 8); assert.ok(calls.every(row => row[0] !== 'legacyReorderWorkspace'));
    for (const extra of [{ principal_id: 'forged' }, { body: { row_version: 1, position: 'main' } }, { body: { row_version: 1, ai_suggestion_id: 'suggestion' } }]) {
      assert.equal((await invokeMcpTool('update_assignment', { assignment_id: 'assignment', body: { row_version: 1 }, idempotency_key: key, ...extra }, actor, services)).isError, true);
    }
    assert.equal(calls.length, 8);
  } finally { await client.close(); await server.close(); }
});

test('uncomposed casting stays unadvertised and preserves existing M02 role-only ordering', async () => {
  const { services, calls } = fixture(); delete services.casting;
  const server = createStudioMcpServer(actor, services); const client = new Client({ name: 'eps-before-casting-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair(); await server.connect(serverTransport); await client.connect(clientTransport);
  try { const names = (await client.listTools()).tools.map(row => row.name); for (const name of castingNames) assert.ok(!names.includes(name)); }
  finally { await client.close(); await server.close(); }
  const input = { workspace_id: 'workspace', body: { row_version: 1, role_ids: ['role'] }, idempotency_key: 'synthetic-existing-role-order' };
  assert.equal((await invokeMcpTool('reorder_workspace', input, actor, services)).isError, undefined);
  assert.equal(calls[0][0], 'legacyReorderWorkspace');
  const unavailable = await invokeMcpTool('list_assignments', { workspace_id: 'workspace' }, actor, services);
  assert.equal(unavailable.isError, true); assert.equal((unavailable.structuredContent as { error: { code: string } }).error.code, 'FEATURE_NOT_IMPLEMENTED');
  assert.equal(calls.length, 1);
});

test('casting failures never fall through to legacy reordering and preserve scoped stale errors', async () => {
  const { services, casting, calls } = fixture();
  casting.reorderWorkspace = async () => { throw new DomainError('STALE_RESOURCE_VERSION', 'Reload the saved casting board.', 409, { current_row_version: 9 }); };
  const result = await invokeMcpTool('reorder_workspace', { workspace_id: 'workspace', body: { row_version: 2, slot_ids_by_role: { role: ['slot'] } }, idempotency_key: 'synthetic-stale-casting-order' }, actor, services);
  assert.equal(result.isError, true); assert.equal((result.structuredContent as { error: { code: string } }).error.code, 'STALE_RESOURCE_VERSION');
  assert.equal(calls.length, 0);
});
