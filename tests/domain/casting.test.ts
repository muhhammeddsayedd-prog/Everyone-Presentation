import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DomainError } from '../../packages/domain/src/types.ts';
import type { Assignment, CastingAuthority, CastingDraft } from '../../packages/domain/src/casting-types.ts';
import { createAssignment, updateAssignment, setSlotMain, undoSlotMain, removeAssignment, assignmentsForOutput,
  parseAssignmentCreate, parseAssignmentPatch, parseMainUndo, parseCastingMutationContext, parseAssignmentListOptions, parseCastingReorderWorkspace } from '../../packages/domain/src/casting.ts';

const authority: CastingAuthority = { principal_id: 'producer', project_id: 'project', capabilities: ['workspaces.read', 'workspaces.write'], can_read: true, can_write: true };
const code = (value: string) => (error: unknown) => error instanceof DomainError && error.code === value;
function assignment(id: string, slot_id = 'slot-one', workspace_candidate_id = 'pool-one', position: Assignment['position'] = 'option'): Assignment {
  return { id, workspace_id: 'workspace', slot_id, workspace_candidate_id, position, shortlist_included: false,
    presentation_notes: null, internal_notes: null, slide_wording: {}, sort_order: 0, row_version: 1, archived: false };
}
function draft(): CastingDraft {
  const requirements = { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [],
    skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null };
  return { workspace: { id: 'workspace', project_id: 'project', row_version: 1, draft_revision: 1 }, roles: ['one', 'two'].map((value, index) => ({
    id: `role-${value}`, workspace_id: 'workspace', name: value, headcount: 1, category: null, requirements,
    clarifications: [], sort_order: index, row_version: 1, archived: false,
  })), slots: ['one', 'two'].map(value => ({ id: `slot-${value}`, role_id: `role-${value}`, workspace_id: 'workspace',
    ordinal: 1, provisional: false, label: value, sort_order: 0, row_version: 1, archived: false })),
  workspace_candidates: ['one', 'two', 'three'].map(value => ({ id: `pool-${value}`, workspace_id: 'workspace', candidate_id: `candidate-${value}`, archived: false })), assignments: [] };
}

test('new assignments start Option; direct Shortlist is also Selection; existing choices are reused unchanged', () => {
  const before = draft(); const one = createAssignment(before, authority, 'workspace', { slot_id: 'slot-one', workspace_candidate_id: 'pool-one', expected_slot_row_version: 1, shortlist_included: true }, 'assignment-one');
  assert.equal(one.result.position, 'option'); assert.equal(one.result.shortlist_included, true);
  assert.equal(one.draft.slots[0].row_version, 2); assert.equal(one.draft.workspace.draft_revision, 2); assert.equal(before.assignments.length, 0);
  assert.equal(assignmentsForOutput(one.draft, authority, 'selection').length, 1); assert.equal(assignmentsForOutput(one.draft, authority, 'shortlist').length, 1);
  const reuse = createAssignment(one.draft, authority, 'workspace', { slot_id: 'slot-one', workspace_candidate_id: 'pool-one', expected_slot_row_version: 2, shortlist_included: false, presentation_notes: 'do not replace' }, 'unused-id');
  assert.equal(reuse.changed, false); assert.deepEqual(reuse.result, one.result); assert.equal(reuse.draft.assignments.length, 1);
});

test('one person has independent per-role notes, position and shortlist; removing one keeps the other and pool', () => {
  const before = draft(); before.assignments = [assignment('a'), assignment('b', 'slot-two')];
  const edit = updateAssignment(before, authority, 'a', { row_version: 1, position: 'backup', shortlist_included: true, presentation_notes: 'Only Father', internal_notes: 'Private', slide_wording: { skills_experience: 'Short truthful wording' } });
  assert.equal(edit.result.position, 'backup'); assert.equal(edit.draft.assignments[1].presentation_notes, null);
  assert.deepEqual(edit.draft.workspace_candidates, before.workspace_candidates);
  const removed = removeAssignment(edit.draft, authority, 'a', { row_version: 2, reason: 'One role only' });
  assert.deepEqual(removed.result, { success: true, affected_ids: ['a'] }); assert.equal(removed.draft.assignments[0].archived, true);
  assert.equal(assignmentsForOutput(removed.draft, authority, 'selection')[0].id, 'b');
  assert.deepEqual(removed.draft.workspace_candidates, before.workspace_candidates);
});

test('Main replacement/clear are atomic plans with an exact inverse and do not change shortlist or sort', () => {
  const before = draft(); before.assignments = [assignment('a', 'slot-one', 'pool-one', 'main'), { ...assignment('b', 'slot-one', 'pool-two'), sort_order: 4, shortlist_included: true }];
  const main = setSlotMain(before, authority, 'slot-one', { assignment_id: 'b', expected_slot_row_version: 1, replacement_behavior: 'move_previous_to_backup' }, 'event-one');
  assert.deepEqual(main.result.affected_assignments.map(value => [value.id, value.position, value.row_version]), [['a', 'backup', 2], ['b', 'main', 2]]);
  assert.equal(main.result.affected_assignments[1].sort_order, 4); assert.equal(main.result.affected_assignments[1].shortlist_included, true);
  assert.equal(before.assignments[0].position, 'main'); assert.equal(main.draft.workspace.draft_revision, 2);
  assert.deepEqual(Object.keys(main.result.slot).sort(), ['archived', 'id', 'label', 'role_id', 'row_version', 'sort_order']);
  assert.deepEqual(main.result.undo?.restore_assignment_positions, [{ assignment_id: 'a', position: 'main' }, { assignment_id: 'b', position: 'option' }]);
  const clear = setSlotMain(main.draft, authority, 'slot-one', { assignment_id: null, expected_slot_row_version: 2, replacement_behavior: 'move_previous_to_backup' }, 'event-clear');
  assert.equal(clear.draft.assignments.filter(value => value.position === 'main').length, 0); assert.equal(clear.result.affected_assignments[0].position, 'backup');
  assert.equal(assignmentsForOutput(clear.draft, authority, 'selection').length, 2);
});

test('current Main cannot be demoted by patch; its notes/shortlist can change; position-only no-op stays unchanged', () => {
  const before = draft(); before.assignments = [assignment('a', 'slot-one', 'pool-one', 'main')];
  assert.throws(() => updateAssignment(before, authority, 'a', { row_version: 1, position: 'backup' }), code('MAIN_OPERATION_REQUIRED'));
  const edited = updateAssignment(before, authority, 'a', { row_version: 1, presentation_notes: 'Specific note', shortlist_included: true });
  assert.equal(edited.result.position, 'main'); assert.equal(edited.draft.slots[0].row_version, 1);
  const same = setSlotMain(edited.draft, authority, 'slot-one', { assignment_id: 'a', expected_slot_row_version: 1, replacement_behavior: 'move_previous_to_backup' }, 'unused-event');
  assert.equal(same.changed, false); assert.equal(same.result.undo, null); assert.deepEqual(same.result.affected_assignments, []);
});

test('Undo requires server-recorded inverse, slot revision and affected assignment revisions; unrelated notes survive', () => {
  const before = draft(); before.assignments = [assignment('a', 'slot-one', 'pool-one', 'main'), assignment('b', 'slot-one', 'pool-two'), assignment('c', 'slot-one', 'pool-three')];
  const main = setSlotMain(before, authority, 'slot-one', { assignment_id: 'b', expected_slot_row_version: 1, replacement_behavior: 'move_previous_to_backup' }, 'event-one');
  assert(main.result.undo && main.undo_record);
  const changed = updateAssignment(main.draft, authority, 'c', { row_version: 1, internal_notes: 'Keep this independent note' });
  const undo = undoSlotMain(changed.draft, authority, 'slot-one', main.result.undo, main.undo_record);
  assert.deepEqual(undo.result.affected_assignments.map(value => [value.id, value.position, value.row_version]), [['a', 'main', 3], ['b', 'option', 3]]);
  assert.equal(undo.draft.assignments[2].internal_notes, 'Keep this independent note'); assert.equal(undo.consume_undo_event_id, 'event-one'); assert.equal(undo.result.undo, null);
  const affected = updateAssignment(main.draft, authority, 'a', { row_version: 2, presentation_notes: 'Newer note' });
  assert.throws(() => undoSlotMain(affected.draft, authority, 'slot-one', main.result.undo, main.undo_record!), code('STALE_RESOURCE_VERSION'));
  assert.throws(() => undoSlotMain(main.draft, authority, 'slot-one', { ...main.result.undo!, restore_assignment_positions: [{ assignment_id: 'a', position: 'option' }] }, main.undo_record!), code('MAIN_UNDO_INVALID'));
  assert.throws(() => undoSlotMain(main.draft, authority, 'slot-two', main.result.undo, main.undo_record!), code('MAIN_UNDO_INVALID'));
  assert.throws(() => undoSlotMain(main.draft, authority, 'slot-one', main.result.undo, { ...main.undo_record!, consumed: true }), code('MAIN_UNDO_ALREADY_USED'));
});

test('stale slot versions cannot displace a winning Main plan; this is not SQL concurrency proof', () => {
  const before = draft(); before.assignments = [assignment('a'), assignment('b', 'slot-one', 'pool-two')];
  const main = setSlotMain(before, authority, 'slot-one', { assignment_id: 'a', expected_slot_row_version: 1, replacement_behavior: 'move_previous_to_backup' }, 'event-one');
  assert.throws(() => setSlotMain(main.draft, authority, 'slot-one', { assignment_id: 'b', expected_slot_row_version: 1, replacement_behavior: 'move_previous_to_backup' }, 'event-two'), code('STALE_RESOURCE_VERSION'));
  assert.equal(main.draft.assignments.filter(value => value.position === 'main').length, 1);
});

test('wording null removes only the explicit override and never edits another assignment or source', () => {
  const before = draft(); before.assignments = [{ ...assignment('a'), slide_wording: { city: 'Alexandria', skills_experience: 'Existing full-safe display' } }, assignment('b', 'slot-two')];
  const edit = updateAssignment(before, authority, 'a', { row_version: 1, slide_wording: { city: null, skills_experience: '  Short wording  ' } });
  assert.deepEqual(edit.result.slide_wording, { skills_experience: 'Short wording' }); assert.deepEqual(edit.draft.assignments[1], before.assignments[1]);
  assert.deepEqual(before.assignments[0].slide_wording, { city: 'Alexandria', skills_experience: 'Existing full-safe display' });
});

test('strict boundaries reject Selection flags, Main patch, unrecognized wording and malformed revisions', () => {
  for (const value of [{ slot_id: 'slot-one', workspace_candidate_id: 'pool-one', expected_slot_row_version: 1, selection_included: true },
    { slot_id: 'slot-one', workspace_candidate_id: 'pool-one', expected_slot_row_version: 0 }]) assert.throws(() => parseAssignmentCreate(value), code('VALIDATION_FAILED'));
  for (const value of [{ row_version: 1, position: 'main' }, { row_version: 1, slide_wording: { contact: 'private' } }, { row_version: 1, internal_notes: 'bad\u0000text' }, { row_version: Number.MAX_SAFE_INTEGER + 1 }]) assert.throws(() => parseAssignmentPatch(value), code('VALIDATION_FAILED'));
  assert.throws(() => parseMainUndo({ undo_event_id: 'e', slot_id: 'slot-one', expected_slot_row_version: 2, restore_assignment_positions: [{ assignment_id: 'a', position: 'main' }, { assignment_id: 'a', position: 'backup' }] }), code('VALIDATION_FAILED'));
  assert.throws(() => parseCastingMutationContext({ idempotencyKey: '', clientType: 'mcp' }), code('VALIDATION_FAILED'));
  assert.throws(() => parseCastingMutationContext({ idempotencyKey: 'key\nX-Injected: value' }), code('VALIDATION_FAILED'));
  assert.deepEqual(parseCastingMutationContext({ idempotencyKey: 'same-request', clientType: 'mcp' }), { idempotencyKey: 'same-request', clientType: 'mcp' });
});

test('cross-workspace/foreign relation, archived parent and current permission denial cannot mutate state', () => {
  const before = draft(); before.assignments = [assignment('a')];
  assert.throws(() => updateAssignment(before, { ...authority, can_write: false }, 'a', { row_version: 1, shortlist_included: true }), code('RESOURCE_NOT_FOUND'));
  assert.throws(() => updateAssignment(before, { ...authority, capabilities: ['cast.write'] }, 'a', { row_version: 1, shortlist_included: true }), code('CAPABILITY_REQUIRED'));
  assert.throws(() => createAssignment(before, authority, 'other-workspace', { slot_id: 'slot-one', workspace_candidate_id: 'pool-one', expected_slot_row_version: 1 }, 'new'), code('RESOURCE_NOT_FOUND'));
  const archived = draft(); archived.slots[0].archived = true;
  assert.throws(() => createAssignment(archived, authority, 'workspace', { slot_id: 'slot-one', workspace_candidate_id: 'pool-one', expected_slot_row_version: 1 }, 'new'), code('RESOURCE_NOT_FOUND'));
  const corrupt = draft(); corrupt.workspace_candidates[0].workspace_id = 'other';
  assert.throws(() => createAssignment(corrupt, authority, 'workspace', { slot_id: 'slot-one', workspace_candidate_id: 'pool-one', expected_slot_row_version: 1 }, 'new'), code('ASSIGNMENT_STATE_INVALID'));
  assert.equal(before.assignments[0].row_version, 1);
});

test('explicit role/slot/assignment order and ID ties drive output; Main never grants Shortlist membership', () => {
  const before = draft(); before.roles[0].sort_order = 2;
  before.assignments = [{ ...assignment('z-main', 'slot-one', 'pool-one', 'main'), sort_order: 5 },
    { ...assignment('a-option', 'slot-one', 'pool-two'), sort_order: 5, shortlist_included: true },
    { ...assignment('second-role', 'slot-two', 'pool-three'), shortlist_included: true }];
  assert.deepEqual(assignmentsForOutput(before, authority, 'selection').map(row => row.id), ['second-role', 'a-option', 'z-main']);
  assert.deepEqual(assignmentsForOutput(before, authority, 'shortlist').map(row => row.id), ['second-role', 'a-option']);
  assert.deepEqual(parseAssignmentListOptions({ output_type: 'shortlist', cursor: 'opaque', limit: 100 }), { output_type: 'shortlist', cursor: 'opaque', limit: 100 });
  for (const value of [{ limit: 101 }, { limit: '25' }, { output_type: ['selection'] }, { q: 'unpublished filter' }]) assert.throws(() => parseAssignmentListOptions(value), code('VALIDATION_FAILED'));
});

test('removal retains history; a new assignment is Option and does not resurrect the archived choices', () => {
  const before = draft(); before.assignments = [{ ...assignment('old-main', 'slot-one', 'pool-one', 'main'), shortlist_included: true, presentation_notes: 'Old choice' }];
  const removed = removeAssignment(before, authority, 'old-main', { row_version: 1 });
  const fresh = createAssignment(removed.draft, authority, 'workspace', { slot_id: 'slot-one', workspace_candidate_id: 'pool-one', expected_slot_row_version: 2 }, 'fresh');
  assert.equal(fresh.draft.assignments.length, 2); assert.equal(fresh.draft.assignments[0].presentation_notes, 'Old choice');
  assert.equal(fresh.result.position, 'option'); assert.equal(fresh.result.shortlist_included, false); assert.equal(fresh.result.presentation_notes, null);
  assert.deepEqual(assignmentsForOutput(fresh.draft, authority, 'selection').map(row => row.id), ['fresh']);
});

test('empty/no-op saves do not create revisions and a contributor needs no reusable-fact capability', () => {
  const before = draft(); before.assignments = [assignment('a')];
  const contributor = { ...authority, principal_id: 'contributor', capabilities: ['workspaces.write'] };
  const same = updateAssignment(before, contributor, 'a', { row_version: 1 });
  assert.equal(same.changed, false); assert.deepEqual(same.draft, before);
  const empty = setSlotMain(before, contributor, 'slot-one', { assignment_id: null, expected_slot_row_version: 1, replacement_behavior: 'move_previous_to_backup' }, 'unused');
  assert.equal(empty.changed, false); assert.equal(empty.undo_record, null); assert.deepEqual(empty.draft.workspace, before.workspace);
  assert.equal(updateAssignment(before, contributor, 'a', { row_version: 1, shortlist_included: true }).result.shortlist_included, true);
});

test('valid Undo remains available to another permitted actor; revoked authority and unrelated event are denied', () => {
  const before = draft(); before.assignments = [assignment('a')];
  const main = setSlotMain(before, authority, 'slot-one', { assignment_id: 'a', expected_slot_row_version: 1, replacement_behavior: 'move_previous_to_backup' }, 'event');
  assert(main.result.undo && main.undo_record);
  const other = { ...authority, principal_id: 'authorized-mcp' };
  assert.equal(undoSlotMain(main.draft, other, 'slot-one', main.result.undo, main.undo_record).result.affected_assignments[0].position, 'option');
  assert.throws(() => undoSlotMain(main.draft, { ...other, can_write: false }, 'slot-one', main.result.undo, main.undo_record!), code('RESOURCE_NOT_FOUND'));
  assert.throws(() => undoSlotMain(main.draft, other, 'slot-one', main.result.undo, { ...main.undo_record!, workspace_id: 'foreign' }), code('MAIN_UNDO_INVALID'));
});

test('corrupt duplicate assignment or two-Main projections fail closed rather than emitting duplicate candidate pages', () => {
  const before = draft(); before.assignments = [assignment('a'), assignment('duplicate')];
  assert.throws(() => assignmentsForOutput(before, authority, 'selection'), code('ASSIGNMENT_STATE_INVALID'));
  before.assignments = [assignment('a', 'slot-one', 'pool-one', 'main'), assignment('b', 'slot-one', 'pool-two', 'main')];
  assert.throws(() => assignmentsForOutput(before, authority, 'selection'), code('ASSIGNMENT_STATE_INVALID'));
});

test('full reorder parser preserves optional scope intent and rejects key aliases rather than silently overwriting a scope', () => {
  const input = { row_version: 2, role_ids: ['role-one'], slot_ids_by_role: { 'role-one': [] }, assignment_ids_by_slot: { 'slot-one': ['a', 'b'] } };
  assert.deepEqual(parseCastingReorderWorkspace(input), input);
  assert.deepEqual(parseCastingReorderWorkspace({ row_version: 2 }), { row_version: 2 });
  assert.throws(() => parseCastingReorderWorkspace({ row_version: 2, slot_ids_by_role: { 'role-one': ['slot-one'], ' role-one ': ['slot-two'] } }), code('VALIDATION_FAILED'));
});

test('assignment text follows the aggregate technical budget without an undocumented10k field cutoff', () => {
  assert.equal(parseAssignmentPatch({ row_version: 1, presentation_notes: 'x'.repeat(11000) }).presentation_notes?.length, 11000);
  assert.equal(parseAssignmentPatch({ row_version: 1, presentation_notes: '\t Note\r\n' }).presentation_notes, 'Note');
  assert.equal(parseAssignmentPatch({ row_version: 1, presentation_notes: '\u00a0Arabic العربية\u00a0' }).presentation_notes, '\u00a0Arabic العربية\u00a0');
  const wording = Object.fromEntries(['name_or_id', 'age_or_range', 'height_measurements', 'languages_accents', 'skills_experience', 'city', 'previous_projects_roles', 'classification', 'availability', 'presentation_notes'].map(key => [key, 'x'.repeat(8000)]));
  assert.throws(() => parseAssignmentPatch({ row_version: 1, slide_wording: wording }), code('VALIDATION_FAILED'));
});
