import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildDraftReview, toPresentationScenes, type DraftSource, type ListedScene } from '../../apps/web/components/workspace/draft-review.ts';
import { pageForScene, stageDeck } from '../../apps/web/components/workspace/stage-pages.ts';
import type { PresentationScene } from '../../packages/domain/src/review-types.ts';
import type { RoleRequirements } from '../../packages/domain/src/specs-types.ts';

// Synthetic scenes and casting shaped like the list endpoints the live preview reads. Every value is invented.
const requirements: RoleRequirements = { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null };
const stamp = '2026-11-16T00:00:00Z';
const W = 'w';
type Link = { id: string; role: string; sort?: number; status?: string; archived?: boolean; placement?: 'auto' | 'repeat' | 'hidden'; title?: string | null; setting?: string | null; note?: string | null; slots?: string[] };
function listed(id: string, sort_order: number, links: Link[], extra: Partial<ListedScene> = {}): ListedScene {
  return { id, workspace_id: W, scene_number: null, title: `Scene ${id}`, sequence_label: null, setting: null, notes: 'internal scene notes', requirements: { items: ['a beard'] },
    source_refs: [], status: 'confirmed', sort_order, row_version: 3, archived: false, ...extra,
    occurrences: links.map((link, n) => ({ id: link.id, scene_id: id, role_id: link.role, role_name: `Role ${link.role}`, slot_ids: link.slots ?? [], display_title: link.title ?? null,
      setting_override: link.setting ?? null, presentation_note: link.note ?? null, deck_placement: link.placement ?? 'auto', status: link.status ?? 'confirmed', source_refs: [],
      sort_order: link.sort ?? n, row_version: 1, proposal_stale: false, ...(link.archived ? { archived: true } : {}) })) };
}

test('scenes map with the snapshot rules of eps.review_presentation_1_4: confirmed, active, ordered by sort_order then id, captured fields only', () => {
  const active = new Set(['father', 'mother']);
  const rows = [
    listed('00000000-0000-4000-8000-00000000000b', 1, [{ id: 'o-b', role: 'father' }]),
    listed('00000000-0000-4000-8000-00000000000a', 1, [{ id: '2', role: 'mother', sort: 0 }, { id: '1', role: 'father', sort: 0, title: 'Dad', setting: 'Car', note: 'Same person.', placement: 'repeat', slots: ['slot-f'] },
      { id: 'o-proposed', role: 'father', status: 'proposed' }, { id: 'o-rejected', role: 'father', status: 'rejected', archived: true }, { id: 'o-archived-role', role: 'retired' }]),
    listed('s-first', 0, [{ id: 'o-first', role: 'mother' }], { scene_number: '1', sequence_label: 'Morning', setting: 'Kitchen', title: '  Breakfast ' }),
    listed('s-proposed', 2, [{ id: 'o-p', role: 'mother' }], { status: 'proposed' }),
    listed('s-rejected', 3, [{ id: 'o-r', role: 'mother' }], { status: 'rejected', archived: true }),
    listed('s-archived', 4, [{ id: 'o-a', role: 'mother' }], { archived: true })];
  const before = JSON.stringify(rows);
  const scenes = toPresentationScenes(rows, active);
  assert.equal(JSON.stringify(rows), before, 'the listed scenes are not reordered or changed');
  assert.deepEqual(scenes.map(scene => scene.scene_id), ['s-first', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b']);
  // Values are kept as saved (the template trims); only the captured keys are present.
  assert.deepEqual(scenes[0], { scene_id: 's-first', scene_number: '1', title: '  Breakfast ', sequence_label: 'Morning', setting: 'Kitchen',
    occurrences: [{ occurrence_id: 'o-first', role_id: 'mother', display_title: null, setting_override: null, presentation_note: null, deck_placement: 'auto' }] });
  assert.deepEqual(scenes[1].occurrences, [
    { occurrence_id: '1', role_id: 'father', display_title: 'Dad', setting_override: 'Car', presentation_note: 'Same person.', deck_placement: 'repeat' },
    { occurrence_id: '2', role_id: 'mother', display_title: null, setting_override: null, presentation_note: null, deck_placement: 'auto' }]);
  assert.deepEqual(Object.keys(scenes[1]).sort(), ['occurrences', 'scene_id', 'scene_number', 'sequence_label', 'setting', 'title']);
  assert.equal(toPresentationScenes([], active).length, 0);
});

test('the mapping follows the SQL that captures 1.4.0 scenes (m19), so preview and snapshot use the same rules', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261116130000_m19_editorial_template_1_4.sql', import.meta.url), 'utf8').replace(/\s+/gu, ' ');
  const start = sql.indexOf('create function eps.review_presentation_1_4'); assert.ok(start > 0);
  const body = sql.slice(start, sql.indexOf('for slide in', start));
  // Scene and occurrence keys, in the same names this mapping produces.
  assert.match(body, /jsonb_build_object\('scene_id',s\.id,'scene_number',s\.scene_number,'title',s\.title,'sequence_label',s\.sequence_label,'setting',s\.setting, 'occurrences'/u);
  assert.match(body, /jsonb_build_object\('occurrence_id',o\.id,'role_id',o\.role_id,'display_title',o\.display_title,'setting_override',o\.setting_override,'presentation_note',o\.presentation_note,'deck_placement',o\.deck_placement\)order by o\.sort_order,o\.id\)/u);
  // Filters and order: confirmed, non-archived occurrences of active roles; confirmed, non-archived scenes by sort_order, id.
  assert.match(body, /join eps\.roles r on r\.id=o\.role_id and r\.workspace_id=p_workspace and r\.archived_at is null/u);
  assert.match(body, /o\.archived_at is null and o\.status='confirmed'/u);
  assert.match(body, /order by s\.sort_order,s\.id\)/u);
  assert.match(body, /s\.archived_at is null and s\.status='confirmed';/u);
});

// A small 1.4.0 draft: Father (two options), Mother (nobody yet), Kid (one option, in no scene).
function source(scenes: PresentationScene[]): DraftSource {
  const role = (id: string, name: string, sort_order: number) => ({ id, workspace_id: W, name, headcount: 1, category: null, requirements, clarifications: [], sort_order, row_version: 1, archived: false });
  const facts = (name: string) => ({ name, casting_id: name, age_or_range: null, stated_gender: null, height_measurements: null, languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null });
  const person = (id: string) => ({ id: `pool-${id}`, workspace_id: W, candidate_id: id, selected_candidate_media_id: null, selected_frame_asset_ids: [], availability: null, fresh_material_required: false, media_confirmed: false, internal_notes: null, portrait_asset_id: null, portrait_source: null, portrait_crop: null, media_selection_state: 'unset' as const, row_version: 1 });
  const assign = (id: string, slot_id: string, pool: string, sort_order: number) => ({ id, workspace_id: W, slot_id, workspace_candidate_id: pool, position: 'option' as const, shortlist_included: false, presentation_notes: null, internal_notes: null, slide_wording: {}, sort_order, row_version: 1, archived: false });
  return { workspace: { id: W, logo_asset_id: null, logo_placement: 'cover', draft_revision: 1 }, project: { name: 'Synthetic', client_name: null },
    roles: [role('father', 'Father', 0), role('mother', 'Mother', 1), role('kid', 'Kid', 2)],
    slots: [{ id: 'slot-f', role_id: 'father', label: 'Father', sort_order: 0, row_version: 1, archived: false }, { id: 'slot-m', role_id: 'mother', label: 'Mother', sort_order: 0, row_version: 1, archived: false },
      { id: 'slot-k', role_id: 'kid', label: 'Kid', sort_order: 0, row_version: 1, archived: false }],
    pool: [person('c1'), person('c2'), person('c3')], assignments: [assign('a1', 'slot-f', 'pool-c1', 0), assign('a2', 'slot-f', 'pool-c2', 1), assign('a3', 'slot-k', 'pool-c3', 0)],
    candidates: Object.fromEntries(['c1', 'c2', 'c3'].map(id => [id, { id, facts: facts(`Synthetic ${id}`), review_status: 'reviewed' as const, reviewed_at: stamp, reviewed_by: null, search_match: null, possible_duplicate: false, merged_into_candidate_id: null, archived: false, row_version: 1, created_at: stamp, updated_at: stamp }])),
    media: {}, scenes };
}
const deckOf = (scenes: PresentationScene[], templateVersion = '1.4.0') => stageDeck(buildDraftReview(source(scenes), {}, { output: 'selection', title: 'Cast Selection', templateVersion }).review);
const scene = (id: string, links: Link[], extra: Partial<ListedScene> = {}) => listed(id, 0, links, extra);
const mapped = (...rows: ListedScene[]) => toPresentationScenes(rows.map((row, n) => ({ ...row, sort_order: n })), new Set(['father', 'mother', 'kid']));

test('the scene focus opens the scene divider, or a later scene of a sequence on its own first cast page, without changing the deck', () => {
  const scenes = mapped(
    scene('s1', [{ id: 'o1', role: 'father' }, { id: 'o2', role: 'mother' }], { title: 'Kitchen', setting: 'Night' }),
    scene('s2', [{ id: 'o3', role: 'mother' }], { title: 'Office' }),
    scene('s3', [{ id: 'o4', role: 'father', placement: 'repeat' }], { title: 'Garden' }),
    scene('s4', [{ id: 'o5', role: 'mother' }], { title: 'Party', sequence_label: 'Wedding' }),
    scene('s5', [{ id: 'o6', role: 'father', placement: 'repeat' }, { id: 'o7', role: 'mother', placement: 'hidden' }], { title: 'Toast', sequence_label: 'Wedding' }));
  const deck = deckOf(scenes); const before = JSON.stringify(deck);
  // cover, Kid (no scene), Kitchen divider, Father, Mother, Garden divider, Father again, Wedding divider, Father (repeat in Toast), closing.
  assert.deepEqual(deck.pages.map(page => page.kind === 'divider' ? page.label : page.kind === 'detail' || page.kind === 'pending' ? page.slide?.role_name : page.kind),
    ['cover', 'Kid', 'Kitchen | Night. · Divider', 'Father', 'Mother', 'Garden. · Divider', 'Father', 'Wedding. · Divider', 'Father', 'closing']);
  assert.equal(pageForScene(deck, 's1'), 2);
  assert.equal(pageForScene(deck, 's2'), null, 'Mother already printed with Scene 1 and no divider is drawn for Scene 2');
  assert.equal(pageForScene(deck, 's3'), 5);
  assert.equal(pageForScene(deck, 's4'), 7, 'the first scene of a sequence opens on the shared divider');
  assert.equal(pageForScene(deck, 's5'), 8, 'a later scene of a sequence opens on the first cast page it prints');
  assert.equal(pageForScene(deck, 'unknown'), null);
  assert.equal(JSON.stringify(deck), before, 'looking a scene up never changes the composed deck');
  assert.equal(JSON.stringify(deckOf(scenes)), before, 'composition is deterministic for the same scenes');
});

test('a later scene of a group whose roles already printed opens on the shared divider; 1.3.0 finds the first page of a role in the scene', () => {
  const scenes = mapped(
    scene('a', [{ id: 'o1', role: 'father' }], { title: 'Arrival', sequence_label: 'Day one' }),
    scene('b', [{ id: 'o2', role: 'father' }], { title: 'Dinner', sequence_label: 'Day one' }),
    scene('c', [{ id: 'o3', role: 'mother' }, { id: 'o4', role: 'father', placement: 'repeat' }], { title: 'Night' }));
  const deck = deckOf(scenes);
  assert.deepEqual(deck.pages.map(page => page.label.split(' · ')[0]), ['Cover', 'Synthetic c3', 'Day one.', 'Father', 'Night.', 'Mother', 'Father', 'Thank you']);
  assert.equal(pageForScene(deck, 'a'), 2); assert.equal(pageForScene(deck, 'b'), 2); assert.equal(pageForScene(deck, 'c'), 4);
  // 1.3.0 has no scene pages: the stage opens the first page of a role the scene prints.
  const slot = deckOf(scenes, '1.3.0');
  assert.equal(slot.template, '1.3.0');
  assert.equal(pageForScene(slot, 'c', scenes), slot.pages.find(page => page.slide?.role_id === 'father')!.index);
  assert.equal(pageForScene(slot, 'c'), null, 'without the draft scenes there is nothing to follow');
});
