import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError, parseReorderWorkspace, planRoleOrder, type Role } from '@eps/domain';

const workspace = { id: 'workspace', row_version: 19, draft_revision: 17 };
const role = (id: string, order: number, archived = false) => ({ id, workspace_id: workspace.id,
  sort_order: order, row_version: 4, archived, name: id, requirements: { supplied: 'unchanged' },
  clarifications: [{ supplied: 'unchanged' }] }) as unknown as Role;
const roles = [role('a', 0), role('b', 2), role('c', 7), role('old', 1, true)];
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;

test('role reorder plans exact active permutation and changes only moved order/version pairs', () => {
  const original = structuredClone(roles);
  const plan = planRoleOrder(workspace, roles, { row_version: 19, role_ids: ['b', 'a', 'c'] });
  assert.equal(plan.changed, true);
  assert.equal(plan.next_row_version, 20); assert.equal(plan.next_draft_revision, 18);
  assert.deepEqual(plan.changes, [{ id: 'b', expected_row_version: 4, sort_order: 0 },
    { id: 'a', expected_row_version: 4, sort_order: 1 }, { id: 'c', expected_row_version: 4, sort_order: 2 }]);
  assert.deepEqual(roles, original); // No role/source/requirement/history object is mutated.
  for (const role_ids of [['a', 'a', 'c'], ['a', 'b'], ['a', 'b', 'foreign'], ['a', 'b', 'old']]) {
    assert.throws(() => planRoleOrder(workspace, roles, { row_version: 19, role_ids }), code('ROLE_ORDER_INVALID'));
  }
  assert.throws(() => planRoleOrder(workspace, roles, { row_version: 18, role_ids: ['b', 'a', 'c'] }), code('STALE_RESOURCE_VERSION'));
});

test('missing role_ids/current order/empty workspace are true no-ops despite sparse historic sort values', () => {
  for (const input of [{ row_version: 19 }, { row_version: 19, role_ids: ['a', 'b', 'c'] }]) {
    const plan = planRoleOrder(workspace, roles, input);
    assert.equal(plan.changed, false); assert.deepEqual(plan.changes, []);
    assert.equal(plan.next_row_version, 19); assert.equal(plan.next_draft_revision, 17);
  }
  assert.equal(planRoleOrder(workspace, [], { row_version: 19, role_ids: [] }).changed, false);
});

test('role-only boundary retains exact optional shape, rejects authority and never ignores supplied other ordering', () => {
  assert.deepEqual(parseReorderWorkspace({ row_version: 1 }), { row_version: 1 });
  assert.deepEqual(parseReorderWorkspace({ row_version: 1, role_ids: [] }), { row_version: 1, role_ids: [] });
  for (const input of [{ row_version: 1, slot_ids_by_role: {} }, { row_version: 1, assignment_ids_by_slot: { slot: ['assignment'] } }]) {
    assert.throws(() => parseReorderWorkspace(input), code('FEATURE_NOT_IMPLEMENTED'));
  }
  for (const input of [{ row_version: 0 }, { row_version: 1, role_ids: [null] }, { row_version: 1, principal_id: 'other' },
    { row_version: 1, slot_ids_by_role: [] }, { row_version: 1, assignment_ids_by_slot: { slot: 2 } }]) {
    assert.throws(() => parseReorderWorkspace(input), code('INVALID_REQUEST'));
  }
});
