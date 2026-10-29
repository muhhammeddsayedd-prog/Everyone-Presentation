import assert from 'node:assert/strict';
import test from 'node:test';
import { readRetirementChoice, readRetirementUndo, retirementUnavailable } from '../../apps/web/components/retirement-undo';

const choice = { workspace_id: 'workspace', resource_id: 'role', operation: 'archive_role', undo_event_id: 'event', expected_workspace_row_version: 7, assignment_ids: ['assignment'], slot_ids: ['slot'], main_count: 1, shortlist_count: 0, can_undo: true, unavailable_reason: null };
test('restoration choice parsing requires exact scoped identities, complete revisions and unique bounded effects', () => {
  assert.deepEqual(readRetirementChoice(choice, 'workspace', 'role'), choice);
  for (const bad of [{ ...choice, workspace_id: 'other' }, { ...choice, resource_id: 'foreign' }, { ...choice, expected_workspace_row_version: 0 }, { ...choice, private_notes: 'not accepted' }, { ...choice, assignment_ids: ['assignment', 'assignment'] }, { ...choice, main_count: 2 }, { ...choice, can_undo: true, unavailable_reason: 'MAIN_CHANGED' }]) assert.throws(() => readRetirementChoice(bad, 'workspace', 'role'));
});
test('a restoration acknowledgement must advance the captured revision and cannot carry private fields', () => {
  const response = { success: true, affected_ids: ['assignment', 'role'], workspace_row_version: 8 };
  assert.deepEqual(readRetirementUndo(response, 7), response);
  for (const bad of [{ ...response, workspace_row_version: 7 }, { ...response, success: false }, { ...response, affected_ids: ['assignment', 'assignment'] }, { ...response, audit_payload: {} }]) assert.throws(() => readRetirementUndo(bad, 7));
});
test('safe fixed reasons explain current-state denial without publishing unknown diagnostics', () => {
  assert.match(retirementUnavailable('MAIN_CHANGED'), /Main changed/);
  assert.match(retirementUnavailable('ALREADY_UNDONE'), /already been undone/);
  assert.match(retirementUnavailable('RETIREMENT_CHANGED'), /newer casting edit/);
  assert.match(retirementUnavailable('RETIREMENT_TOO_LARGE'), /size limit/);
  assert.equal(retirementUnavailable('private-diagnostic'), 'Restoration is unavailable for the current saved state.');
});
