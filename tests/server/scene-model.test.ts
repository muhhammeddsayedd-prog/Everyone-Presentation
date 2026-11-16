import assert from 'node:assert/strict';
import test from 'node:test';
import { affectedScenes, affectedText, appearanceText, castingFingerprint, moved, occurrenceSlots, progressText, requirementLines, roleChoices, roleProgress,
  sceneProgress } from '../../apps/web/components/workspace/scenes/scene-model.ts';
import type { Scene, SceneOccurrence } from '../../packages/domain/src/scenes-types.ts';
import type { Role, Slot } from '../../packages/domain/src/specs-types.ts';
import type { Assignment } from '../../packages/domain/src/casting-types.ts';

const role = (id: string, name: string) => ({ id, workspace_id: 'w', name, headcount: 1, category: null, requirements: {}, clarifications: [], sort_order: 0, row_version: 1, archived: false }) as unknown as Role;
const slot = (id: string, roleId: string, order = 0) => ({ id, role_id: roleId, label: id, sort_order: order, row_version: 1, archived: false }) as Slot;
const assignment = (id: string, slotId: string, position: string, shortlist = false) => ({ id, slot_id: slotId, position, shortlist_included: shortlist, archived: false }) as unknown as Assignment;
const occ = (roleId: string, status: 'proposed' | 'confirmed' = 'confirmed', slotIds: string[] = []) => ({ id: `o-${roleId}-${Math.random()}`, scene_id: 's', role_id: roleId, role_name: roleId,
  slot_ids: slotIds, display_title: null, setting_override: null, presentation_note: null, deck_placement: 'auto', status, source_refs: [], sort_order: 0, row_version: 1, proposal_stale: false }) as SceneOccurrence;
const scene = (id: string, number: string | null, occurrences: SceneOccurrence[]) => ({ id, workspace_id: 'w', scene_number: number, title: `T${id}`, sequence_label: null, setting: null,
  notes: null, requirements: { items: [] }, source_refs: [], status: 'confirmed', sort_order: 0, row_version: 1, archived: false, occurrences }) as Scene;

const father = role('father', 'Father'); const otherFather = role('father2', 'Father'); const mother = role('mother', 'Mother');
const slots = [slot('f1', 'father'), slot('f2', 'father', 1), slot('o1', 'father2'), slot('m1', 'mother')];
const scenes = [scene('a', '1', [occ('father'), occ('mother')]), scene('b', '2', [occ('mother')]), scene('c', '3', [occ('father', 'confirmed', ['f2'])]), scene('d', '5', [occ('father')])];

test('every occurrence of a role reads the same shared casting', () => {
  const assignments = [assignment('a1', 'f1', 'main', true), assignment('a2', 'f1', 'option'), assignment('a3', 'f2', 'main'), assignment('b1', 'o1', 'option')];
  const first = roleProgress(scenes[0].occurrences[0], slots, assignments); const last = roleProgress(scenes[3].occurrences[0], slots, assignments);
  assert.deepEqual(first, last);
  assert.deepEqual(first, { slots: 2, mainChosen: 2, options: 1, backups: 0, shortlisted: 1, cast: true });
  assert.deepEqual(roleProgress(scenes[2].occurrences[0], slots, assignments), { slots: 1, mainChosen: 1, options: 0, backups: 0, shortlisted: 0, cast: true });
  assert.deepEqual(occurrenceSlots(scenes[2].occurrences[0], slots).map(item => item.id), ['f2']);
  assert.equal(progressText(sceneProgress(scenes[0], slots, assignments)), '1/2 roles cast');
  assert.equal(progressText(sceneProgress(scene('e', null, [occ('father', 'proposed')]), slots, assignments)), 'No roles yet');
});

test('appearance and affected-scene messages use scene numbers; unrelated roles with the same name stay separate', () => {
  assert.equal(appearanceText('father', scenes), 'Appears in Scenes 1, 3 and 5');
  assert.equal(appearanceText('father2', scenes), '');
  const before = castingFingerprint([father, otherFather, mother], slots, [assignment('a1', 'f1', 'option')]);
  const after = castingFingerprint([father, otherFather, mother], slots, [assignment('a1', 'f1', 'main')]);
  const items = affectedScenes(before, after, [father, otherFather, mother], scenes);
  assert.deepEqual(items.map(item => item.role.id), ['father']);
  assert.equal(affectedText(items, scenes), 'Father: casting is shared by Scenes 1, 3 and 5.');
  const choices = roleChoices([father, otherFather, mother], scenes, slots, new Set(['mother']));
  assert.deepEqual(choices.map(item => [item.id, item.duplicateName]), [['father', true], ['father2', true]]);
  assert.match(choices[0].detail, /^Appears in Scenes 1, 3 and 5 · 2 slots/u);
  assert.match(choices[1].detail, /^Not in any scene yet · 1 slot/u);
});

test('ordering and requirement helpers are bounded', () => {
  assert.deepEqual(moved(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c']);
  assert.equal(moved(['a', 'b'], 'a', -1), null);
  assert.deepEqual(requirementLines(' Rain \n\n Night shoot '), ['Rain', 'Night shoot']);
  assert.equal(requirementLines(Array.from({ length: 60 }, (_, n) => `r${n}`).join('\n')).length, 50);
});
