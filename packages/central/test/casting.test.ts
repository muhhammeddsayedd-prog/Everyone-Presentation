import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '../../domain/src/types.ts';
import { slideWordingFields, type Assignment, type MainUndo, type SetSlotMainResult } from '../../domain/src/casting-types.ts';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralCasting } from '../src/casting.ts';

// Installed SDK with a synthetic HTTP boundary; no SQL, permission or live-service claim.
const principal = '10000000-0000-4000-8000-000000000001', actor = { principal_id: principal };
const workspace = '20000000-0000-4000-8000-000000000001', slot = '30000000-0000-4000-8000-000000000001';
const role = '40000000-0000-4000-8000-000000000001', pool = '50000000-0000-4000-8000-000000000001';
const assignmentId = '60000000-0000-4000-8000-000000000001', event = '70000000-0000-4000-8000-000000000001';
const trace = { idempotencyKey: 'stable-casting-operation', requestId: 'casting-request-1', clientType: 'mcp' as const };
const code = (value: string) => (error: unknown) => error instanceof DomainError && error.code === value;
const assignment = (patch: Partial<Assignment> = {}): Assignment => ({ id: assignmentId, workspace_id: workspace, slot_id: slot,
  workspace_candidate_id: pool, position: 'option', shortlist_included: false, presentation_notes: null, internal_notes: null,
  slide_wording: {}, sort_order: 0, row_version: 1, archived: false, ...patch });
const slotDto = { id: slot, role_id: role, label: 'Synthetic slot', sort_order: 0, row_version: 2, archived: false };
const inverse: MainUndo = { undo_event_id: event, slot_id: slot, expected_slot_row_version: 2, restore_assignment_positions: [{ assignment_id: assignmentId, position: 'option' }] };
const mainResult = (): SetSlotMainResult => ({ slot: { ...slotDto }, affected_assignments: [assignment({ position: 'main', row_version: 2 })], undo: structuredClone(inverse) });
async function fixture() {
  let response: unknown = assignment(); let parentOverride: unknown; let error: unknown;
  const calls: { name: string; args: Record<string, unknown>; headers: Headers }[] = [];
  const client = createBearerUserClient({ url: 'https://synthetic-casting.example.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-casting-user-token' }, { fetch: async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    const name = url.pathname.split('/').at(-1)!; const args = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ name, args, headers: new Headers(init?.headers) });
    if (error && name !== 'eps_get_casting_context') return Response.json(error, { status: 400 });
    if (name === 'eps_get_casting_context') return Response.json(parentOverride ?? { workspace_id: workspace, slot_id: slot, role_id: role, workspace_candidate_id: args.p_resource_type === 'assignment' ? pool : null });
    return response instanceof Response ? response : Response.json(response);
  } });
  return { api: await createCentralCasting(client), calls, set: (value: unknown) => { response = value; }, parent: (value: unknown) => { parentOverride = value; }, error: (value: unknown) => { error = value; } };
}

test('assignment create/update/remove use exact curated RPC params, stable key, actor and correlation', async () => {
  const h = await fixture();
  const input = { slot_id: slot, workspace_candidate_id: pool, expected_slot_row_version: 1, shortlist_included: true };
  h.set(assignment({ shortlist_included: true })); assert.equal((await h.api.createAssignment(actor, workspace, input, trace)).id, assignmentId);
  assert.deepEqual(h.calls.map(value => value.name), ['eps_get_casting_context', 'eps_create_assignment']);
  assert.deepEqual(h.calls[1].args, { p_workspace_id: workspace, p_input: input, p_idempotency_key: trace.idempotencyKey });
  assert.equal(h.calls[1].headers.get('X-EPS-Request-ID'), trace.requestId); assert.equal(h.calls[1].headers.get('X-EPS-Client-Type'), 'mcp');
  h.set(assignment({ row_version: 2, presentation_notes: 'Only this assignment', slide_wording: { city: null } }));
  await h.api.updateAssignment(actor, assignmentId, { row_version: 1, presentation_notes: 'Only this assignment', slide_wording: { city: null } }, trace);
  assert.deepEqual(h.calls.at(-1)?.args, { p_assignment_id: assignmentId, p_input: { row_version: 1, presentation_notes: 'Only this assignment', slide_wording: { city: null } }, p_idempotency_key: trace.idempotencyKey });
  h.set({ success: true, affected_ids: [assignmentId] }); assert.deepEqual(await h.api.removeAssignment(actor, assignmentId, { row_version: 2, reason: 'This slot only' }, trace), { success: true, affected_ids: [assignmentId] });
  assert.equal(h.calls.at(-1)?.name, 'eps_remove_assignment');
});

test('published Main and Undo params bind exact slot/workspace/role/affected rows and inverse', async () => {
  const h = await fixture(); h.set(mainResult());
  const main = { assignment_id: assignmentId, expected_slot_row_version: 1, replacement_behavior: 'move_previous_to_backup' as const };
  const result = await h.api.setSlotMain(actor, slot, main, trace); assert.deepEqual(result, mainResult());
  assert.deepEqual(h.calls.at(-1)?.args, { p_slot_id: slot, p_input: main, p_idempotency_key: trace.idempotencyKey });
  h.set({ slot: { ...slotDto, row_version: 3 }, affected_assignments: [assignment({ row_version: 3 })], undo: null });
  await h.api.undoSlotMain(actor, slot, inverse, trace); assert.equal(h.calls.at(-1)?.name, 'eps_undo_slot_main');
  const count = h.calls.length;
  await assert.rejects(h.api.undoSlotMain(actor, 'foreign-slot', inverse, trace), code('VALIDATION_FAILED')); assert.equal(h.calls.length, count);
});

test('list forwards scoped output/cursor/limit and refuses foreign, duplicate, unshortlisted or malformed pages', async () => {
  const h = await fixture(); h.set({ data: [assignment({ shortlist_included: true })], page: { next_cursor: 'opaque-next' } });
  const list = await h.api.listAssignments(actor, workspace, { output_type: 'shortlist', cursor: 'opaque-first', limit: 1 });
  assert.equal(list.page.next_cursor, 'opaque-next'); assert.deepEqual(h.calls[0].args, { p_workspace_id: workspace, p_output_type: 'shortlist', p_cursor: 'opaque-first', p_limit: 1 });
  for (const rows of [[assignment({ workspace_id: 'foreign', shortlist_included: true })], [assignment()], [assignment({ shortlist_included: true }), assignment({ shortlist_included: true })]]) {
    h.set({ data: rows, page: { next_cursor: null } }); await assert.rejects(h.api.listAssignments(actor, workspace, { output_type: 'shortlist' }), code('CENTRAL_RESPONSE_INVALID'));
  }
  h.set({ data: [assignment()], page: { next_cursor: ['forged'] } }); await assert.rejects(h.api.listAssignments(actor, workspace), code('CENTRAL_RESPONSE_INVALID'));
});

test('foreign actor, malformed body, missing key and parent substitution never dispatch a mutation', async () => {
  const h = await fixture();
  await assert.rejects(h.api.updateAssignment({ principal_id: 'other' }, assignmentId, { row_version: 1 }, trace), code('ACCESS_DENIED'));
  await assert.rejects(h.api.updateAssignment(actor, assignmentId, { row_version: 1, position: 'main' } as never, trace), code('VALIDATION_FAILED'));
  await assert.rejects(h.api.updateAssignment(actor, assignmentId, { row_version: 1 }, undefined as never), code('IDEMPOTENCY_KEY_REQUIRED')); assert.equal(h.calls.length, 0);
  await assert.rejects(h.api.updateAssignment(actor, assignmentId, { row_version: 1, slide_wording: Object.fromEntries(slideWordingFields.map(field => [field, 'x'.repeat(8000)])) }, trace), code('VALIDATION_FAILED')); assert.equal(h.calls.length, 0);
  h.parent({ workspace_id: 'foreign', slot_id: slot, role_id: role, workspace_candidate_id: null });
  await assert.rejects(h.api.createAssignment(actor, workspace, { slot_id: slot, workspace_candidate_id: pool, expected_slot_row_version: 1 }, trace), code('RESOURCE_NOT_FOUND'));
  assert(h.calls.every(value => value.name === 'eps_get_casting_context'));
});

test('strict result decoding rejects array enums, extra private fields, wrong identities and invalid Main inverses', async () => {
  const h = await fixture();
  for (const value of [assignment({ position: ['main'] as never }), assignment({ shortlist_included: [true] as never }),
    { ...assignment(), private_audit_payload: {} }, assignment({ id: 'other' }), assignment({ slide_wording: { contact: 'private' } as never })]) {
    h.set(value); await assert.rejects(h.api.updateAssignment(actor, assignmentId, { row_version: 1 }, trace), code('CENTRAL_RESPONSE_INVALID'));
  }
  for (const value of [{ ...mainResult(), slot: { ...slotDto, role_id: 'foreign' } }, { ...mainResult(), affected_assignments: [assignment({ position: 'main', slot_id: 'foreign' })] },
    { ...mainResult(), undo: { ...inverse, restore_assignment_positions: [{ assignment_id: 'foreign', position: 'main' }] } }, { ...mainResult(), raw_inverse: {} }]) {
    h.set(value); await assert.rejects(h.api.setSlotMain(actor, slot, { assignment_id: assignmentId, expected_slot_row_version: 1, replacement_behavior: 'move_previous_to_backup' }, trace), code('CENTRAL_RESPONSE_INVALID'));
  }
});

test('typed SQL denials and stale details survive, while raw diagnostics and unknown failures stay private', async () => {
  const h = await fixture();
  for (const [error, status] of [['MAIN_OPERATION_REQUIRED', 409], ['MAIN_UNDO_INVALID', 409], ['MAIN_UNDO_ALREADY_USED', 409], ['ASSIGNMENT_STATE_INVALID', 409], ['CAPABILITY_REQUIRED', 403], ['RESOURCE_NOT_FOUND', 404]]) {
    h.error({ code: 'P0001', message: error, details: 'PRIVATE_RAW_DIAGNOSTIC' });
    await assert.rejects(h.api.updateAssignment(actor, assignmentId, { row_version: 1 }, trace), (value: unknown) => value instanceof DomainError && value.code === error && value.status === status && !JSON.stringify(value).includes('PRIVATE_RAW_DIAGNOSTIC'));
  }
  h.error({ code: 'P0001', message: 'STALE_RESOURCE_VERSION', details: JSON.stringify({ current_row_version: 9, private: 'PRIVATE_RAW_DIAGNOSTIC' }) });
  await assert.rejects(h.api.updateAssignment(actor, assignmentId, { row_version: 1 }, trace), (value: unknown) => value instanceof DomainError && value.code === 'STALE_RESOURCE_VERSION' && JSON.stringify(value.details) === '{"current_row_version":9}');
  h.error({ code: 'P0001', message: 'PRIVATE_RAW_DIAGNOSTIC', details: 'PRIVATE_RAW_DIAGNOSTIC' });
  await assert.rejects(h.api.listAssignments(actor, workspace), (value: unknown) => value instanceof DomainError && value.code === 'DEPENDENCY_UNAVAILABLE' && !JSON.stringify(value).includes('PRIVATE_RAW_DIAGNOSTIC'));
  h.error({ code: 'P0001', message: ['MAIN_OPERATION_REQUIRED'], details: 'PRIVATE_RAW_DIAGNOSTIC' });
  await assert.rejects(h.api.listAssignments(actor, workspace), code('DEPENDENCY_UNAVAILABLE'));
});

test('full reorder transports only the published scoped ID maps; output must remain the same workspace', async () => {
  const h = await fixture(); const value = { id: workspace, project_id: 'project', module: 'casting', title: 'Synthetic', logo_asset_id: null,
    logo_placement: 'cover', active_output: 'selection', row_version: 2, draft_revision: 2, has_unpublished_changes: true,
    created_at: '2026-10-29T00:00:00Z', updated_at: '2026-10-29T00:00:00Z' };
  h.set(value); const body = { row_version: 1, role_ids: [role], slot_ids_by_role: { [role]: [slot] }, assignment_ids_by_slot: { [slot]: [assignmentId] } };
  assert.deepEqual(await h.api.reorderWorkspace(actor, workspace, body, trace), value);
  assert.deepEqual(h.calls[0].args, { p_workspace_id: workspace, p_input: body, p_idempotency_key: trace.idempotencyKey });
  h.set({ ...value, id: 'foreign' }); await assert.rejects(h.api.reorderWorkspace(actor, workspace, body, trace), code('CENTRAL_RESPONSE_INVALID'));
});

test('idempotency remains a server transaction: original requests replay through RPC and changed keys/bodies are never cached locally', async () => {
  const h = await fixture(); h.set(assignment({ row_version: 2, shortlist_included: true }));
  const body = { row_version: 1, shortlist_included: true };
  const first = await h.api.updateAssignment(actor, assignmentId, body, trace);
  assert.deepEqual(await h.api.updateAssignment(actor, assignmentId, body, trace), first);
  assert.equal(h.calls.filter(call => call.name === 'eps_update_assignment').length, 2);
  assert.equal(h.calls.filter(call => call.name === 'eps_get_casting_context').length, 2);
  h.error({ code: 'P0001', message: 'IDEMPOTENCY_KEY_REUSED', details: 'PRIVATE_DIAGNOSTIC' });
  await assert.rejects(h.api.updateAssignment(actor, assignmentId, { row_version: 1, shortlist_included: false }, trace), code('IDEMPOTENCY_KEY_REUSED'));
  assert.equal(h.calls.filter(call => call.name === 'eps_update_assignment').length, 3);
  assert.deepEqual(h.calls.at(-1)?.args.p_input, { row_version: 1, shortlist_included: false });
});

test('malformed parent results and mutation metadata stop before a write; removal accepts only published Success', async () => {
  const h = await fixture(); h.parent({ workspace_id: workspace, slot_id: slot, role_id: role, workspace_candidate_id: pool, raw_scope: 'PRIVATE' });
  await assert.rejects(h.api.updateAssignment(actor, assignmentId, { row_version: 1 }, trace), code('CENTRAL_RESPONSE_INVALID'));
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].name, 'eps_get_casting_context');
  await assert.rejects(h.api.updateAssignment(actor, assignmentId, { row_version: 1 }, { ...trace, idempotencyKey: 'bad\nkey' }), code('VALIDATION_FAILED'));
  assert.equal(h.calls.length, 1); h.parent(undefined);
  for (const value of [{ ok: true }, { success: true, affected_ids: ['foreign'] }, { success: true, affected_ids: [assignmentId, assignmentId] }, { success: [true], affected_ids: [assignmentId] }]) {
    h.set(value); await assert.rejects(h.api.removeAssignment(actor, assignmentId, { row_version: 1 }, trace), code('CENTRAL_RESPONSE_INVALID'));
  }
});
