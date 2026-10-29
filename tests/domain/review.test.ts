import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSeriesCreate, parseSeriesListOptions, parseReviewOptions, parseAiSuggestionCreate, projectReviewSlides } from '../../packages/domain/src/review.ts';
import { slideWordingFields } from '../../packages/domain/src/casting-types.ts';
import type { ReviewProjectionInput } from '../../packages/domain/src/review-types.ts';
import happy from '../../fixtures/casting-happy-path.json';

test('review contracts bind an exact series and reject forged context and invalid assistance targets', () => {
  assert.deepEqual(parseSeriesCreate({ workspace_id: 'workspace', output_type: 'selection', audience_preset_id: 'audience' }), { workspace_id: 'workspace', output_type: 'selection', audience_preset_id: 'audience' });
  assert.deepEqual(parseSeriesListOptions({ limit: 100, cursor: 'opaque', output_type: 'shortlist' }), { limit: 100, cursor: 'opaque', output_type: 'shortlist' });
  assert.deepEqual(parseReviewOptions({ series_id: 'series' }), { series_id: 'series' });
  for (const body of [{}, { series_id: 'series', actor: 'forged' }, { series_id: 'series', output_type: 'anything' }]) assert.throws(() => parseReviewOptions(body));
  for (const body of [{ workspace_id: 'workspace', output_type: 'selection', audience_preset_id: 'audience', template_content_sha256: 'forged' }, { workspace_id: 'workspace', output_type: 'selection', audience_preset_id: 'audience', title: '\0' }]) assert.throws(() => parseSeriesCreate(body));
  assert.throws(() => parseSeriesListOptions({ limit: 101 }));
  const suggestion = { workspace_id: 'workspace', capability: 'slide_shorten', target_type: 'assignment', target_id: 'assignment', target_row_version: 1, field: 'skills_experience', instruction: 'Preserve qualifications' };
  assert.deepEqual(parseAiSuggestionCreate(suggestion), suggestion);
  for (const body of [{ ...suggestion, field: 'gender' }, { ...suggestion, target_row_version: 0 }, { ...suggestion, source_text: 'x'.repeat(65537) }]) assert.throws(() => parseAiSuggestionCreate(body));
});

function source(): ReviewProjectionInput {
  return { workspace_id: 'workspace', output_type: 'selection',
    roles: [{ id: 'father', workspace_id: 'workspace', name: 'Father', sort_order: 0, archived: false }, { id: 'manager', workspace_id: 'workspace', name: 'Manager', sort_order: 1, archived: false }],
    slots: [{ id: 'father-1', role_id: 'father', label: 'Father 1', sort_order: 0, archived: false }, { id: 'manager-1', role_id: 'manager', label: 'Manager 1', sort_order: 0, archived: false }, { id: 'manager-2', role_id: 'manager', label: 'Manager 2', sort_order: 1, archived: false }],
    pool: [{ id: 'pool', workspace_id: 'workspace', candidate_id: 'person', selected_candidate_media_id: null, selected_frame_asset_ids: [], availability: 'Monday only', fresh_material_required: false, row_version: 1 }],
    candidates: [{ id: 'person', review_status: 'unreviewed', archived: false, row_version: 1, facts: { name: 'Synthetic Person', casting_id: 'SYNTHETIC', age_or_range: null, stated_gender: null, height_measurements: null, languages: ['Arabic'], accents: ['Uncertain'], skills_experience: 'No prior acting credits; available for rehearsals only.', city: null, previous_projects_roles: null, classification: null } }],
    assignments: [{ id: 'a', workspace_id: 'workspace', slot_id: 'father-1', workspace_candidate_id: 'pool', position: 'main', shortlist_included: false, presentation_notes: null, internal_notes: 'Never render this', slide_wording: {}, sort_order: 0, row_version: 1, archived: false }, { id: 'b', workspace_id: 'workspace', slot_id: 'manager-1', workspace_candidate_id: 'pool', position: 'option', shortlist_included: true, presentation_notes: 'Only Manager', internal_notes: null, slide_wording: { skills_experience: 'No acting credits; rehearsals only.' }, sort_order: 0, row_version: 1, archived: false }], media: [] };
}

test('ten fields, independent notes/wording, missing content and explicit Shortlist preserve source facts', () => {
  const input = source(); const before = structuredClone(input); const selection = projectReviewSlides(input);
  assert.equal(selection.length, 3); assert.deepEqual(selection.map(row => row.assignment_id), ['a', 'b', null]);
  for (const row of selection) assert.deepEqual(Object.keys(row.fields), [...slideWordingFields]);
  assert.equal(selection[0].fields.height_measurements, 'Not provided');
  assert.equal(selection[0].fields.presentation_notes, 'Not provided'); assert.equal(selection[1].fields.presentation_notes, 'Only Manager');
  assert.equal(selection[1].fields.skills_experience, 'No acting credits; rehearsals only.');
  assert.equal(selection[1].source_fields.skills_experience, input.candidates[0].facts.skills_experience);
  assert.equal(JSON.stringify(selection).includes('Never render this'), false); assert.deepEqual(input, before);
  assert.deepEqual(projectReviewSlides({ ...input, output_type: 'shortlist' }).map(row => row.assignment_id), [null, 'b', null]);
  input.candidates[0].facts.height_measurements = '178 cm';
  assert.equal(projectReviewSlides(input).filter(row => row.kind === 'candidate' && row.fields.height_measurements === '178 cm').length, 2);
});

test('foreign relations, duplicate assignments and unavailable selected media fail rather than fabricate', () => {
  const foreign = source(); foreign.pool[0].workspace_id = 'other'; assert.throws(() => projectReviewSlides(foreign));
  const duplicate = source(); duplicate.assignments.push({ ...duplicate.assignments[0], id: 'c' }); assert.throws(() => projectReviewSlides(duplicate));
  const missing = source(); missing.pool[0].selected_candidate_media_id = 'missing'; assert.throws(() => projectReviewSlides(missing));
  const empty = projectReviewSlides({ ...source(), roles: [], slots: [], assignments: [] });
  assert.equal(empty.length, 1); assert.equal(empty[0].role_id, null); assert.equal(empty[0].slot_id, null);
});

test('supplied happy-path fixture independently projects Selection8 and Shortlist6 in role/slot/assignment order', () => {
  // Explicit fixture spelling adaptation, not a cloud seed or real-media claim.
  const input: ReviewProjectionInput = {
    workspace_id: happy.workspace.id, output_type: 'selection',
    roles: happy.roles.map(row => ({ id: row.id, workspace_id: happy.workspace.id, name: row.name, sort_order: row.sort_order, archived: false })),
    slots: happy.slots.map(row => ({ id: row.id, role_id: row.role_id, label: row.name, sort_order: row.sort_order, archived: false })),
    candidates: happy.candidates.map(row => ({ id: row.id, archived: false, row_version: 1, review_status: row.review_status === 'reviewed' ? 'reviewed' : 'unreviewed', facts: { name: row.facts.name, casting_id: row.casting_id, age_or_range: row.facts.age, stated_gender: row.facts.gender, height_measurements: row.facts.height_measurements, languages: row.facts.languages_accents ? [row.facts.languages_accents] : [], accents: [], skills_experience: row.facts.skills_experience, city: row.facts.city, previous_projects_roles: row.facts.previous_projects_roles, classification: row.facts.category } })),
    pool: happy.workspace_candidates.map(row => ({ id: row.id, workspace_id: row.workspace_id, candidate_id: row.candidate_id, selected_candidate_media_id: row.selected_media_set_id, selected_frame_asset_ids: happy.selected_frames.find(group => group.media_set_id === row.selected_media_set_id)?.frames.map(frame => frame.asset_id) ?? [], availability: row.availability, fresh_material_required: false, row_version: 1 })),
    media: happy.candidates.filter(row => row.media_set_id).map(row => ({ id: row.media_set_id!, candidate_id: row.id, source_asset_id: 'source_' + row.media_set_id, frames: happy.selected_frames.find(group => group.media_set_id === row.media_set_id)!.frames.map(frame => ({ ...frame, source_asset_id: 'source_' + row.media_set_id, width: 640, height: 480, sha256: 'a'.repeat(64) })) })),
    assignments: happy.assignments.map(row => ({ id: row.id, workspace_id: happy.workspace.id, slot_id: row.slot_id, workspace_candidate_id: row.workspace_candidate_id, position: row.position as 'main' | 'option' | 'backup', shortlist_included: row.shortlisted, presentation_notes: row.presentation_notes, internal_notes: row.internal_note, slide_wording: row.slide_wording, sort_order: row.sort_order, row_version: 1, archived: false })),
  };
  const selection = projectReviewSlides(input); const shortlist = projectReviewSlides({ ...input, output_type: 'shortlist' });
  assert.equal(selection.length + 1, 8); assert.equal(shortlist.length + 1, 6); // plus cover
  assert.deepEqual(selection.map(row => row.assignment_id ?? row.slot_id), ['assignment_father_samir', 'assignment_father_omar', 'assignment_manager_samir', 'assignment_manager_maya', 'assignment_waiter1_omar', 'assignment_waiter2_maya', 'slot_waiter_3']);
  assert.deepEqual(shortlist.map(row => row.assignment_id ?? row.slot_id), ['assignment_father_samir', 'assignment_manager_samir', 'assignment_waiter1_omar', 'slot_waiter_2', 'slot_waiter_3']);
  assert.equal(selection.some(row => row.candidate_id === 'candidate_lina'), false);
  assert.equal(JSON.stringify(selection).includes('INTERNAL ONLY'), false);
});
