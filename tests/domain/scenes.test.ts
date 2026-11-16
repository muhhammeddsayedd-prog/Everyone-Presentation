import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError, formatSceneAppearance, parseRoleOccurrence, parseScene, parseSceneConfirm, parseSceneConfirmResult, parseSceneCreate, parseSceneOccurrence, parseSceneRejectResult,
  parseSceneOccurrenceLink, parseSceneOccurrencePatch, parseSceneOrder, parseScenePatch, parseSceneReorder, parseSceneVersion } from '@eps/domain';
import { validateContract } from '../../apps/web/lib/validation.ts';

const rejected = (error: unknown) => error instanceof DomainError && error.code === 'VALIDATION_FAILED' && error.status === 400;
const ref = { asset_id: 'asset', page: 2, paragraph: 0, segment_index: null, start_ms: null, end_ms: null, quote: 'Scene 3 - the kitchen' };
const occurrence = (overrides: Record<string, unknown> = {}) => ({ id: 'occ-1', scene_id: 'scene-1', role_id: 'role-1', role_name: 'Father',
  slot_ids: [], display_title: null, setting_override: null, presentation_note: null, deck_placement: 'auto', status: 'confirmed',
  source_refs: [], sort_order: 0, row_version: 1, proposal_stale: false, ...overrides });
const scene = (overrides: Record<string, unknown> = {}) => ({ id: 'scene-1', workspace_id: 'workspace', scene_number: '3A', title: 'Kitchen',
  sequence_label: null, setting: 'INT. KITCHEN - NIGHT', notes: null, requirements: { items: ['Rain outside'] }, source_refs: [ref],
  status: 'proposed', sort_order: 0, row_version: 1, archived: false, occurrences: [occurrence()], ...overrides });

test('scene create/patch parsers keep exact keys, bounded text and a non-blank title', () => {
  assert.deepEqual(parseSceneCreate({ title: 'Kitchen' }), { title: 'Kitchen' });
  const full = { title: 'Kitchen', scene_number: '3A', sequence_label: 'Act 1', setting: 'INT. KITCHEN', notes: null, requirements: { items: ['Rain'] } };
  assert.deepEqual(parseSceneCreate(full), full);
  validateContract('SceneCreate', full);
  for (const bad of [{}, { title: '   ' }, { title: '' }, { title: 'x'.repeat(301) }, { title: 'K', scene_number: 'x'.repeat(41) },
    { title: 'K', setting: '' }, { title: 'K', notes: 'x'.repeat(4001) }, { title: 'K', requirements: { items: Array(51).fill('a') } },
    { title: 'K', requirements: { items: [''] } }, { title: 'K', requirements: { items: [], extra: 1 } }, { title: 'K', status: 'confirmed' },
    { title: 'K', source_refs: [] }, { title: 'K', workspace_id: 'other' }, null, [], 'Kitchen']) {
    assert.throws(() => parseSceneCreate(bad), rejected, JSON.stringify(bad));
  }
  // Characters, not UTF-16 units, like SQL length(): 300 emoji are allowed.
  assert.equal(parseSceneCreate({ title: '🎬'.repeat(300) }).title.length, 600);
  assert.deepEqual(parseScenePatch({ row_version: 2, notes: null }), { row_version: 2, notes: null });
  assert.throws(() => parseScenePatch({ row_version: 2 }), rejected);
  assert.throws(() => parseScenePatch({ title: 'x' }), rejected);
  assert.throws(() => parseScenePatch({ row_version: 0, title: 'x' }), rejected);
  assert.throws(() => validateContract('ScenePatch', { row_version: 2 }));
  validateContract('ScenePatch', { row_version: 2, title: 'Garden' });
  assert.throws(() => validateContract('SceneCreate', { title: '  ' }));
});

test('reorder, archive/unlink and confirm inputs are revision-fenced id sets without duplicates', () => {
  assert.deepEqual(parseSceneReorder({ row_version: 7, scene_ids: ['b', 'a'] }), { row_version: 7, scene_ids: ['b', 'a'] });
  for (const bad of [{ row_version: 7 }, { scene_ids: [] }, { row_version: 7, scene_ids: ['a', 'a'] }, { row_version: 7, scene_ids: [''] },
    { row_version: 7, scene_ids: ['a'], role_ids: [] }]) assert.throws(() => parseSceneReorder(bad), rejected);
  assert.deepEqual(parseSceneVersion({ row_version: 3 }), { row_version: 3 });
  assert.throws(() => parseSceneVersion({ row_version: 3, reason: 'x' }), rejected);
  assert.deepEqual(parseSceneConfirm({ row_version: 4 }), { row_version: 4 });
  assert.deepEqual(parseSceneConfirm({ row_version: 4, scene_ids: ['s'], occurrence_ids: [] }), { row_version: 4, scene_ids: ['s'], occurrence_ids: [] });
  assert.throws(() => parseSceneConfirm({ row_version: 4, scene_ids: ['s', 's'] }), rejected);
  validateContract('SceneProposalConfirm', { row_version: 4 });
  validateContract('SceneReorder', { row_version: 7, scene_ids: ['b', 'a'] });
  assert.throws(() => validateContract('SceneReorder', { row_version: 7, scene_ids: ['a', 'a'] }));
});

test('occurrence link is explicit by role id; patch needs a change; placement and note are bounded', () => {
  assert.deepEqual(parseSceneOccurrenceLink({ role_id: 'role-1' }), { role_id: 'role-1' });
  const full = { role_id: 'role-1', slot_ids: ['slot-2'], display_title: 'Father (young)', setting_override: 'EXT. GARDEN',
    presentation_note: 'Flashback', deck_placement: 'repeat' };
  assert.deepEqual(parseSceneOccurrenceLink(full), full);
  validateContract('SceneOccurrenceLink', full);
  for (const bad of [{}, { role_name: 'Father' }, { role_id: 'r', deck_placement: 'always' }, { role_id: 'r', presentation_note: 'x'.repeat(501) },
    { role_id: 'r', slot_ids: ['s', 's'] }, { role_id: 'r', slot_ids: Array.from({ length: 1001 }, (_, i) => `s${i}`) }, { role_id: 'r', status: 'confirmed' }]) {
    assert.throws(() => parseSceneOccurrenceLink(bad), rejected, JSON.stringify(bad));
  }
  assert.deepEqual(parseSceneOccurrencePatch({ row_version: 2, slot_ids: [] }), { row_version: 2, slot_ids: [] });
  assert.throws(() => parseSceneOccurrencePatch({ row_version: 2 }), rejected);
  assert.throws(() => parseSceneOccurrencePatch({ row_version: 2, role_id: 'other' }), rejected);
});

test('scene, role occurrence, order and confirm DTOs are exact and agree with the published contract', () => {
  const value = scene();
  assert.deepEqual(parseScene(value), value);
  validateContract('Scene', value);
  for (const bad of [{ ...value, extra: 1 }, { ...value, status: 'draft' }, { ...value, archived: 'no' }, { ...value, title: ' ' },
    { ...value, occurrences: [occurrence({ scene_id: 'other' })] }, { ...value, occurrences: [occurrence(), occurrence({ id: 'occ-2' })] },
    { ...value, occurrences: [occurrence({ sort_order: 2 }), occurrence({ id: 'occ-2', role_id: 'role-2', sort_order: 1 })] },
    { ...value, source_refs: [{ ...ref, quote: undefined }] }, { ...value, occurrences: [occurrence({ deck_placement: 'never' })] }]) {
    assert.throws(() => parseScene(bad), rejected);
  }
  const role = { occurrence_id: 'occ-1', scene_id: 'scene-1', scene_number: null, scene_title: 'Kitchen', setting: null, scene_position: 1,
    scene_status: 'confirmed', status: 'proposed' };
  assert.deepEqual(parseRoleOccurrence(role), role);
  validateContract('RoleOccurrence', role);
  assert.throws(() => parseRoleOccurrence({ ...role, scene_position: 0 }), rejected);
  assert.deepEqual(parseSceneOrder({ workspace_id: 'w', row_version: 3, scene_ids: ['a'] }), { workspace_id: 'w', row_version: 3, scene_ids: ['a'] });
  const confirmed = { workspace_id: 'w', row_version: 3, confirmed_scene_ids: ['a'], confirmed_occurrence_ids: [], skipped_occurrence_ids: ['b'] };
  assert.deepEqual(parseSceneConfirmResult(confirmed), confirmed);
  validateContract('SceneProposalConfirmResult', confirmed);
  assert.throws(() => parseSceneConfirmResult({ ...confirmed, row_version: undefined }), rejected);
  assert.throws(() => parseSceneConfirmResult({ ...confirmed, skipped_occurrence_ids: undefined }), rejected);
  const rejectedResult = { workspace_id: 'w', row_version: 4, rejected_scene_ids: ['a'], rejected_occurrence_ids: ['b', 'c'] };
  assert.deepEqual(parseSceneRejectResult(rejectedResult), rejectedResult);
  validateContract('SceneProposalRejectResult', rejectedResult);
  assert.throws(() => parseSceneRejectResult({ ...rejectedResult, confirmed_scene_ids: [] }), rejected);
  assert.throws(() => parseSceneOccurrence(occurrence({ proposal_stale: 'no' })), rejected);
});

test('scene appearance text uses scene numbers when present, otherwise the scene position', () => {
  assert.equal(formatSceneAppearance([]), '');
  assert.equal(formatSceneAppearance([4]), 'Appears in Scene 4');
  assert.equal(formatSceneAppearance([1, 3]), 'Appears in Scenes 1 and 3');
  assert.equal(formatSceneAppearance([1, 3, 5]), 'Appears in Scenes 1, 3 and 5');
  assert.equal(formatSceneAppearance([{ scene_number: '12A', scene_position: 1 }, { scene_number: null, scene_position: 4 },
    { scene_number: ' ', scene_position: 6 }]), 'Appears in Scenes 12A, 4 and 6');
  assert.equal(formatSceneAppearance(['2', '2', 7]), 'Appears in Scenes 2 and 7');
});
