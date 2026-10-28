import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DomainError } from '../../packages/domain/src/types.ts';
import {
  addManualRole, commitSpecsExtraction, createEmptySpecsDraft, editRole, editSlot, editSpecs,
  parseRoleCreate, parseSpecSubmit, planRoleSlotsResize, roleToDto, slotToDto,
} from '../../packages/domain/src/specs.ts';
import type { SpecsExtraction } from '../../packages/domain/src/specs-types.ts';
import { validateSpecsExtraction } from '../../packages/integrations/src/specs-schema.ts';
import { validateContract } from '../../apps/web/lib/validation.ts';

// Synthetic, provider-independent draft tests. No job, database, browser or provider call.
const source = 'Three waiters in scenes 1 and 3. العمر غير محدد. Shoot date not supplied.';
const requirements = () => ({ age_range: null, gender_requirement: null, appearance_performance: null,
  languages: [], accents: [], skills: [], scene_references: ['1', '3'], shoot_dates: [],
  location: null, availability_requirements: null, other_instructions: null });
const extraction = (count: number | null = 3): SpecsExtraction => ({
  schema_version: '1.0', source_asset_id: null, source_language_codes: ['en', 'ar'],
  roles: [{ source_role_key: 'source-waiter', name: 'Waiter', headcount: count, category: null,
    requirements: requirements(), evidence: [{ asset_id: null, page: null, paragraph: 0,
      segment_index: null, start_ms: null, end_ms: null, quote: 'Three waiters in scenes 1 and 3.' }],
    clarifications: [{ field_path: 'requirements.age_range', reason: 'Age not supplied', source: null },
      { field_path: 'requirements.shoot_dates', reason: 'Date not supplied', source: null }] }],
  general_instructions: null, clarifications: [],
});
const allocator = () => { let next = 0; return () => `allocated-${++next}`; };
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;
function draft(count: number | null = 3) {
  const ids = allocator();
  const empty = createEmptySpecsDraft({ id: 'spec-1', workspace_id: 'workspace-1', draft_revision: 0 });
  const validated = validateSpecsExtraction(extraction(count), { sourceAssetId: null,
    paragraphs: [{ index: 0, page: null, text: source }], correlationId: 'synthetic-test', inputHash: 'a'.repeat(64) });
  return { ids, value: commitSpecsExtraction(empty, { expected_spec_row_version: 1,
    expected_draft_revision: 0, source_asset_id: null, source_text: source, extraction: validated }, ids) };
}

test('grounded extraction produces ordered explicit slots without multiplying people by scenes', () => {
  const { value } = draft();
  assert.equal(value.roles.length, 1);
  assert.deepEqual(value.slots.map(slot => [slot.label, slot.ordinal, slot.sort_order]),
    [['Waiter 1', 1, 0], ['Waiter 2', 2, 1], ['Waiter 3', 3, 2]]);
  assert.equal(new Set(value.slots.map(slot => slot.id)).size, 3);
  assert.deepEqual(value.roles[0].requirements.scene_references, ['1', '3']);
  assert.equal(value.spec.source_text, source);
  assert.equal(value.roles[0].requirements.age_range, null);
  assert.equal(value.roles[0].source?.evidence[0].paragraph, 0);
  validateContract('Spec', value.spec);
  validateContract('Role', roleToDto(value.roles[0]));
  value.slots.forEach(slot => validateContract('Slot', slotToDto(slot)));
});

test('zero or omitted headcount is invalid; unknown count stays null with a provisional slot', () => {
  for (const headcount of [0, -1, 1.5, undefined]) {
    assert.throws(() => parseRoleCreate({ name: 'Waiter', headcount, requirements: requirements() }), code('VALIDATION_FAILED'));
  }
  assert.throws(() => parseRoleCreate({ name: 'Waiter', requirements: requirements() }), code('VALIDATION_FAILED'));
  const { value } = draft(null);
  assert.equal(value.roles[0].headcount, null);
  assert.equal(value.roles[0].source?.headcount, null);
  assert.equal(value.slots.length, 1);
  assert.equal(value.slots[0].provisional, true);
  assert.ok(value.roles[0].clarifications.some(item => item.field_path === 'headcount' && !item.resolved));
  assert.throws(() => parseSpecSubmit({ source_text: '', source_asset_id: 'asset-1' }), code('VALIDATION_FAILED'));
  assert.throws(() => parseSpecSubmit({ source_text: ' \n\t' }), code('SPECS_SOURCE_REQUIRED'));
  assert.equal(parseSpecSubmit({ source_text: source }).source_text, source);
});

test('no extracted roles leaves pending requirements; unknown names never become invented cast facts', () => {
  const empty = createEmptySpecsDraft({ id: 'spec-1', workspace_id: 'workspace-1', draft_revision: 0 });
  const result = extraction(); result.roles = [];
  const pending = commitSpecsExtraction(empty, { expected_spec_row_version: 1,
    expected_draft_revision: 0, source_asset_id: null, source_text: source, extraction: result }, allocator());
  assert.deepEqual(pending.roles, []); assert.deepEqual(pending.slots, []);
  const unnamed = extraction(null); unnamed.roles[0].name = null;
  const editable = commitSpecsExtraction(empty, { expected_spec_row_version: 1,
    expected_draft_revision: 0, source_asset_id: null, source_text: source, extraction: unnamed }, allocator());
  assert.equal(editable.roles[0].name, '');
  assert.equal(editable.slots[0].label, 'Slot 1');
  assert.ok(editable.roles[0].clarifications.some(item => item.field_path === 'name' && !item.resolved));
});

test('manual edits preserve original evidence and resolve only explicitly confirmed clarification entries', () => {
  const { value } = draft(); const role = value.roles[0];
  const age = role.clarifications.find(item => item.field_path === 'requirements.age_range')!;
  const edited = editRole(value, role.id, { row_version: role.row_version,
    requirements: { ...role.requirements, age_range: '20–35' }, clarifications: [{ ...age, resolved: true }] });
  assert.equal(edited.roles[0].requirements.age_range, '20–35');
  assert.equal(edited.roles[0].clarifications.find(item => item.field_path === age.field_path)?.resolved, true);
  assert.equal(edited.roles[0].clarifications.find(item => item.field_path === 'requirements.shoot_dates')?.resolved, false);
  assert.equal(edited.roles[0].source?.requirements.age_range, null);
  assert.equal(edited.spec.source_text, source);
  assert.equal(value.roles[0].requirements.age_range, null);
  assert.equal(edited.roles[0].id, role.id); assert.equal(edited.roles[0].sort_order, role.sort_order);
  assert.throws(() => editRole(edited, role.id, { row_version: role.row_version, name: 'Stale' }), code('STALE_RESOURCE_VERSION'));
  assert.throws(() => editRole(edited, role.id, { row_version: edited.roles[0].row_version, source: {} }), code('VALIDATION_FAILED'));
  assert.throws(() => editRole(edited, role.id, { row_version: edited.roles[0].row_version, headcount: 2 }), code('VALIDATION_FAILED'));
});

test('source and draft version guards prevent a late extraction overwriting manual corrections', () => {
  const existingWorkspace = createEmptySpecsDraft({ id: 'spec-nonzero', workspace_id: 'workspace-1', draft_revision: 17 });
  const accepted = commitSpecsExtraction(existingWorkspace, { expected_spec_row_version: 1, expected_draft_revision: 17,
    source_asset_id: null, source_text: source, extraction: extraction() }, allocator());
  assert.equal(accepted.draft_revision, 18);
  const { value, ids } = draft();
  const changed = editSpecs(value, { row_version: value.spec.row_version, normalized_instructions: 'Producer correction' });
  const attempt = { expected_spec_row_version: value.spec.row_version, expected_draft_revision: value.draft_revision,
    source_asset_id: null, source_text: source, extraction: extraction() };
  assert.throws(() => commitSpecsExtraction(changed, attempt, ids), code('STALE_RESOURCE_VERSION'));
  const roleEdit = editRole(value, value.roles[0].id, { row_version: value.roles[0].row_version, name: 'Server' });
  assert.throws(() => commitSpecsExtraction(roleEdit, attempt, ids), code('STALE_RESOURCE_VERSION'));
  assert.equal(roleEdit.roles[0].name, 'Server');
  assert.equal(roleEdit.spec.source_text, source);
});

test('reducing three slots to two requires explicit retirement and preserves assignment history', () => {
  const { value, ids } = draft(); const role = value.roles[0];
  const assignments = [{ id: 'assignment-1', slot_id: value.slots[1].id, row_version: 7, archived: false,
    workspace_candidate_id: 'candidate-1', choice_status: 'main' as const, notes: 'Keep the supplied assignment history' }];
  assert.throws(() => planRoleSlotsResize(role, value.slots, assignments,
    { row_version: role.row_version, desired_count: 2 }, ids), code('SLOT_RETIREMENT_REQUIRED'));
  assert.equal(assignments[0].archived, false);
  const plan = planRoleSlotsResize(role, value.slots, assignments,
    { row_version: role.row_version, desired_count: 2, retire_slot_ids: [value.slots[1].id] }, ids);
  assert.deepEqual(plan.slots.filter(slot => !slot.archived).map(slot => [slot.id, slot.ordinal, slot.label]),
    [[value.slots[0].id, 1, 'Waiter 1'], [value.slots[2].id, 3, 'Waiter 3']]);
  assert.equal(plan.slots.length, 3); assert.equal(plan.assignments.length, 1);
  assert.equal(plan.assignments[0].archived, true); assert.equal(plan.assignments[0].row_version, 8);
  assert.equal(plan.assignments[0].workspace_candidate_id, 'candidate-1');
  assert.equal(plan.assignments[0].choice_status, 'main');
  assert.equal(plan.assignments[0].notes, assignments[0].notes);
  assert.deepEqual(plan.retirements[0].assignments, assignments);
  assert.equal(plan.retirements[0].slot.id, value.slots[1].id);
  assert.equal(plan.expected_versions.assignments[0].row_version, 7);
  assert.equal(plan.role.headcount, 2);
  assert.equal(plan.role.source?.headcount, 3);
  assert.equal(role.headcount, 3);
});

test('allocation budgets reject large or aggregate headcounts before allocating while preserving valid counts', () => {
  let allocations = 0; const ids = () => `new-${++allocations}`;
  const empty = createEmptySpecsDraft({ id: 'spec-1', workspace_id: 'workspace-1', draft_revision: 0 });
  const result = extraction(); result.roles.push({ ...structuredClone(result.roles[0]), source_role_key: 'second-role' });
  const commit = { expected_spec_row_version: 1, expected_draft_revision: 0,
    source_asset_id: null, source_text: source, extraction: result };
  assert.throws(() => commitSpecsExtraction(empty, commit, ids, { maximum_new_slots: 5 }), code('SLOT_ALLOCATION_LIMIT_EXCEEDED'));
  assert.equal(allocations, 0);
  const { value } = draft();
  assert.throws(() => planRoleSlotsResize(value.roles[0], value.slots, [],
    { row_version: 1, desired_count: Number.MAX_SAFE_INTEGER }, ids), code('SLOT_ALLOCATION_LIMIT_EXCEEDED'));
  assert.equal(allocations, 0);
  assert.equal(parseRoleCreate({ name: 'Large role', headcount: 1001, requirements: requirements() }).headcount, 1001);
  const configured = addManualRole(empty, { name: 'Four', headcount: 4, requirements: requirements() }, ids, { maximum_new_slots: 4 });
  assert.equal(configured.slots.length, 4); assert.equal(configured.roles[0].headcount, 4);
});

test('growth retains existing IDs/order/labels and never reuses archived ordinals or IDs', () => {
  const { value, ids } = draft();
  const smaller = planRoleSlotsResize(value.roles[0], value.slots, [], { row_version: 1, desired_count: 2,
    retire_slot_ids: [value.slots[1].id] }, ids);
  const grown = planRoleSlotsResize(smaller.role, [...smaller.slots].reverse(), [],
    { row_version: smaller.role.row_version, desired_count: 3 }, ids);
  assert.deepEqual(grown.slots.filter(slot => !slot.archived).map(slot => [slot.id, slot.ordinal, slot.sort_order]),
    [[value.slots[0].id, 1, 0], [value.slots[2].id, 3, 2], [grown.creates[0].id, 4, 3]]);
  assert.equal(grown.creates[0].label, 'Waiter 4');
  assert.equal(grown.slots.find(slot => slot.id === value.slots[1].id)?.archived, true);
  assert.equal(grown.creates[0].provisional, false);
});

test('confirming an unknown count retains the provisional slot identity and original unknown count', () => {
  const { value, ids } = draft(null); const before = value.slots[0];
  const confirmed = planRoleSlotsResize(value.roles[0], value.slots, [], { row_version: 1, desired_count: 1 }, ids);
  assert.equal(confirmed.role.headcount, 1); assert.equal(confirmed.role.source?.headcount, null);
  assert.equal(confirmed.slots[0].id, before.id); assert.equal(confirmed.slots[0].provisional, false);
  assert.equal(confirmed.creates.length, 0);
  assert.equal(confirmed.role.clarifications.find(item => item.field_path === 'headcount')?.resolved, true);
  assert.equal(confirmed.role.clarifications.find(item => item.field_path === 'requirements.age_range')?.resolved, false);
});

test('resize rejects stale, duplicate, foreign and wrong-number retirement choices without allocating IDs', () => {
  const { value } = draft(); let allocations = 0; const ids = () => { allocations++; return 'new-slot'; };
  const role = value.roles[0]; const slot = value.slots[0];
  for (const retire_slot_ids of [[slot.id, slot.id], ['not-this-role'], [slot.id, value.slots[1].id]]) {
    assert.throws(() => planRoleSlotsResize(role, value.slots, [], { row_version: 1, desired_count: 2, retire_slot_ids }, ids),
      error => error instanceof DomainError);
  }
  assert.throws(() => planRoleSlotsResize(role, value.slots, [], { row_version: 2, desired_count: 4 }, ids), code('STALE_RESOURCE_VERSION'));
  assert.throws(() => planRoleSlotsResize(role, [{ ...slot, role_id: 'foreign-role' }], [],
    { row_version: 1, desired_count: 4 }, ids), code('SPECS_STATE_INVALID'));
  assert.equal(allocations, 0);
});

test('manual roles and slot labels are ordinary versioned edits with strict input and stable source order', () => {
  const { value, ids } = draft();
  const added = addManualRole(value, { name: 'Waiter', headcount: null, requirements: requirements() }, ids);
  assert.equal(added.roles.length, 2); assert.notEqual(added.roles[0].id, added.roles[1].id);
  assert.deepEqual(added.roles.map(role => role.sort_order), [0, 1]);
  assert.equal(added.roles[1].source, null); assert.equal(added.slots.at(-1)?.provisional, true);
  const slot = added.slots[0];
  const renamed = editSlot(added, slot.id, { row_version: slot.row_version, label: 'Waiter A' });
  assert.equal(renamed.slots[0].id, slot.id); assert.equal(renamed.slots[0].label, 'Waiter A');
  assert.equal(renamed.slots[0].ordinal, slot.ordinal); assert.equal(added.slots[0].label, 'Waiter 1');
  assert.throws(() => editSlot(renamed, slot.id, { row_version: slot.row_version, label: 'Old' }), code('STALE_RESOURCE_VERSION'));
  assert.throws(() => addManualRole(value, { name: 'Forged', headcount: 1, requirements: requirements(), principal_id: 'admin' }, ids), code('VALIDATION_FAILED'));
  assert.throws(() => addManualRole(value, { name: 'Collision', headcount: 1, requirements: requirements() },
    () => value.spec.workspace_id), code('SPECS_STATE_INVALID'));
});
