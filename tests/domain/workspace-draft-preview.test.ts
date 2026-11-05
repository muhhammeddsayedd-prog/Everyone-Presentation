import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDraftReview, draftKey, focusFor, type DraftSource } from '../../apps/web/components/workspace/draft-review.ts';
import { pageForFocus, stageDeck } from '../../apps/web/components/workspace/stage-pages.ts';
import { composeCastingDeck } from '../../packages/templates/versions/1.2.0/compose-casting.ts';
import { renderRegisteredReviewDocument } from '../../packages/templates/src/registered.ts';
import type { WorkspaceReview } from '../../packages/domain/src/review-types.ts';
import type { RoleRequirements } from '../../packages/domain/src/specs-types.ts';

// Synthetic records shaped exactly like the list endpoints the live preview reads. Every value is invented.
const requirements = (age: string | null = null): RoleRequirements => ({ age_range: age, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null });
const stamp = '2026-11-05T00:00:00Z';
function source(): DraftSource {
  const facts = (name: string | null, casting: string, city: string | null) => ({ name, casting_id: casting, age_or_range: '30', stated_gender: null, height_measurements: '  180 cm  ', languages: ['Arabic'], accents: ['Cairene'], skills_experience: null, city, previous_projects_roles: null, classification: null });
  const candidate = (id: string, name: string | null, city: string | null) => ({ id, facts: facts(name, `EPS-${id}`, city), review_status: 'reviewed' as const, reviewed_at: stamp, reviewed_by: null, search_match: null, possible_duplicate: false, merged_into_candidate_id: null, archived: false, row_version: 1, created_at: stamp, updated_at: stamp });
  const frame = (id: string) => ({ asset_id: id, source_asset_id: 'video-1', timestamp_ms: 1000, width: 1080, height: 1350, quality_flags: [] });
  return {
    workspace: { id: 'w', logo_asset_id: null, logo_placement: 'cover', draft_revision: 4 },
    project: { name: 'Synthetic Campaign', client_name: 'Synthetic Client' },
    roles: [{ id: 'kids', workspace_id: 'w', name: 'Kids', headcount: 2, category: 'Supporting', requirements: requirements('8-11'), clarifications: [], sort_order: 1, row_version: 1, archived: false },
      { id: 'father', workspace_id: 'w', name: 'Father', headcount: 1, category: 'Lead', requirements: requirements('38-45'), clarifications: [], sort_order: 0, row_version: 1, archived: false }],
    slots: [{ id: 'kid-2', role_id: 'kids', label: 'Kid 2', sort_order: 1, row_version: 1, archived: false }, { id: 'kid-1', role_id: 'kids', label: 'Kid 1', sort_order: 0, row_version: 1, archived: false },
      { id: 'father-1', role_id: 'father', label: 'Father', sort_order: 0, row_version: 1, archived: false }],
    pool: [{ id: 'p1', workspace_id: 'w', candidate_id: 'c1', selected_candidate_media_id: 'm1', selected_frame_asset_ids: ['f1', 'f2'], availability: '  12–14 Dec ', fresh_material_required: false, media_confirmed: true, internal_notes: 'Never on a slide', row_version: 1 },
      { id: 'p2', workspace_id: 'w', candidate_id: 'c2', selected_candidate_media_id: null, selected_frame_asset_ids: [], availability: null, fresh_material_required: false, media_confirmed: false, internal_notes: null, row_version: 1 },
      { id: 'p3', workspace_id: 'w', candidate_id: 'c3', selected_candidate_media_id: null, selected_frame_asset_ids: [], availability: null, fresh_material_required: false, media_confirmed: false, internal_notes: null, row_version: 1 }],
    assignments: [
      { id: 'a2', workspace_id: 'w', slot_id: 'father-1', workspace_candidate_id: 'p2', position: 'option', shortlist_included: false, presentation_notes: null, internal_notes: null, slide_wording: {}, sort_order: 1, row_version: 1, archived: false },
      { id: 'a1', workspace_id: 'w', slot_id: 'father-1', workspace_candidate_id: 'p1', position: 'main', shortlist_included: true, presentation_notes: 'Strong chemistry', internal_notes: 'Agency prefers him', slide_wording: { skills_experience: 'Short wording' }, sort_order: 0, row_version: 1, archived: false },
      { id: 'a3', workspace_id: 'w', slot_id: 'kid-1', workspace_candidate_id: 'p3', position: 'option', shortlist_included: false, presentation_notes: null, internal_notes: null, slide_wording: {}, sort_order: 0, row_version: 1, archived: false }],
    candidates: { c1: candidate('c1', 'Synthetic Actor', ' Cairo '), c2: candidate('c2', null, null), c3: candidate('c3', 'Synthetic Kid', 'Giza') },
    media: { c1: [{ id: 'm1', candidate_id: 'c1', source_asset_id: 'video-1', preview_asset_id: null, transcript_asset_id: null, original_transcript: null, languages: [], available_frames: [frame('f1'), frame('f2'), frame('f3')], selected_frame_asset_ids: [], processing_issues: [], row_version: 1 }] },
  };
}
const context = { output: 'selection' as const, title: 'Cast Selection', templateVersion: '1.2.0' };

test('the draft follows the server review order and field rules: roles, slots and assignments by order; Pending slots; trimmed facts; saved wording', () => {
  const { review, notes } = buildDraftReview(source(), {}, context);
  assert.deepEqual(notes, []);
  assert.deepEqual(review.slides.map(slide => [slide.role_name, slide.slot_label, slide.kind, slide.assignment_id]),
    [['Father', 'Father', 'candidate', 'a1'], ['Father', 'Father', 'candidate', 'a2'], ['Kids', 'Kid 1', 'candidate', 'a3'], ['Kids', 'Kid 2', 'pending', null]]);
  const main = review.slides[0];
  assert.equal(main.fields.height_measurements, '180 cm'); assert.equal(main.fields.city, 'Cairo'); assert.equal(main.fields.availability, '12–14 Dec');
  assert.equal(main.fields.languages_accents, 'Arabic; Cairene'); assert.equal(main.fields.skills_experience, 'Short wording'); assert.equal(main.source_fields.skills_experience, 'Not provided');
  assert.equal(main.fields.presentation_notes, 'Strong chemistry'); assert.ok(!JSON.stringify(review).includes('Agency prefers him') && !JSON.stringify(review).includes('Never on a slide'));
  assert.deepEqual(main.frames.map(frame => frame.asset_id), ['f1', 'f2']); assert.equal(main.video_asset_id, 'video-1');
  assert.equal(review.slides[1].fields.name_or_id, 'EPS-c2', 'a missing name falls back to the casting ID, as on the server');
  assert.equal(review.slides[3].requirements.age_range, '8-11'); assert.equal(review.slides[3].role_category, 'Supporting');
  assert.equal(review.candidate_slide_count, 3); assert.equal(review.pending_slide_count, 1);
});

test('Shortlist keeps only explicitly included assignments; empty slots become Pending pages', () => {
  const { review } = buildDraftReview(source(), {}, { ...context, output: 'shortlist', title: 'Cast Shortlist' });
  assert.deepEqual(review.slides.map(slide => slide.assignment_id ?? `pending:${slide.slot_id}`), ['a1', 'pending:kid-1', 'pending:kid-2']);
  assert.equal(review.cover.title, 'Cast Shortlist'); assert.equal(review.cover.output_type, 'shortlist');
});

test('unsaved panel edits reach the slide; clearing them restores the saved records', () => {
  const overlay = { [draftKey.projectName]: 'Renamed campaign', [draftKey.clientName]: null, [draftKey.logoPlacement]: 'every_slide', [draftKey.roleName('father')]: 'Dad', [draftKey.roleCategory('kids')]: 'Children',
    [draftKey.roleRequirements('kids')]: requirements('9-10'), [draftKey.slotLabel('kid-2')]: 'Girl', [draftKey.availability('p1')]: 'Weekends', [draftKey.presentationNotes('a1')]: '  Typed note ',
    [draftKey.material('p1')]: { mediaId: 'm1', frames: ['f3'] } };
  const { review } = buildDraftReview(source(), overlay, context);
  assert.equal(review.cover.project_name, 'Renamed campaign'); assert.equal(review.cover.client_name, null); assert.equal(review.cover.logo_placement, 'every_slide');
  assert.equal(review.slides[0].role_name, 'Dad'); assert.equal(review.slides[0].fields.availability, 'Weekends'); assert.equal(review.slides[0].fields.presentation_notes, 'Typed note');
  assert.deepEqual(review.slides[0].frames.map(frame => frame.asset_id), ['f3']);
  assert.equal(review.slides[3].slot_label, 'Girl'); assert.equal(review.slides[3].requirements.age_range, '9-10'); assert.equal(review.slides[3].role_category, 'Children');
  const saved = buildDraftReview(source(), {}, context).review;
  assert.equal(saved.slides[0].role_name, 'Father'); assert.equal(saved.cover.project_name, 'Synthetic Campaign');
});

test('frames outside the chosen introduction are left out (as generation would) and reported; inconsistent records pause the preview', () => {
  const { review, notes } = buildDraftReview(source(), { [draftKey.material('p1')]: { mediaId: 'm1', frames: ['f1', 'foreign'] } }, context);
  assert.deepEqual(review.slides[0].frames.map(frame => frame.asset_id), ['f1']); assert.deepEqual(notes, ['frames']);
  const orphan = source(); orphan.assignments.push({ ...orphan.assignments[0], id: 'a9', workspace_candidate_id: 'missing' });
  assert.throws(() => buildDraftReview(orphan, {}, context));
  const twoMains = source(); twoMains.assignments[0] = { ...twoMains.assignments[0], position: 'main' };
  assert.throws(() => buildDraftReview(twoMains, {}, context));
  const hidden = source(); delete hidden.candidates.c3;
  assert.throws(() => buildDraftReview(hidden, {}, context), /DRAFT_PROFILE_UNAVAILABLE/);
  assert.throws(() => buildDraftReview(source(), {}, { ...context, templateVersion: '9.9.9' }), /TEMPLATE_VERSION_UNAVAILABLE/);
});

test('1.2.0 stage pages are the composed print pages, and panel records find their own page', () => {
  const { review } = buildDraftReview(source(), {}, context);
  const deck = stageDeck(review);
  assert.equal(deck.template, '1.2.0');
  if (deck.template !== '1.2.0') return;
  assert.equal(deck.pages.length, composeCastingDeck(review as WorkspaceReview).pages.length);
  assert.deepEqual(deck.pages.map(page => page.kind), ['cover', 'divider', 'overview', 'detail', 'detail', 'divider', 'detail', 'pending', 'closing']);
  assert.equal(new Set(deck.pages.map(page => page.key)).size, deck.pages.length, 'page keys are unique so the strip keeps its place while editing');
  assert.equal(deck.pages[pageForFocus(deck.pages, { kind: 'assignment', id: 'a2' })!].label, 'EPS-c2');
  assert.equal(deck.pages[pageForFocus(deck.pages, { kind: 'pool', id: 'p3' })!].label, 'Synthetic Kid');
  assert.equal(deck.pages[pageForFocus(deck.pages, { kind: 'slot', id: 'kid-2' })!].kind, 'pending');
  assert.equal(pageForFocus(deck.pages, { kind: 'cover' }), 0);
  assert.equal(pageForFocus(deck.pages, { kind: 'pool', id: 'nobody' }), null);
  assert.deepEqual(focusFor(deck.pages[3].slide), { kind: 'assignment', id: 'a1' });
});

test('1.0/1.1 stage pages are the registered document pages: cover plus one page per slide, rendered by the worker renderer', () => {
  for (const version of ['1.0.0', '1.1.0']) {
    const { review } = buildDraftReview(source(), {}, { ...context, templateVersion: version });
    const deck = stageDeck(review); assert.equal(deck.pages.length, review.slides.length + 1);
    const html = renderRegisteredReviewDocument(review as WorkspaceReview, {});
    assert.equal((html.match(/<article class="eps-page/gu) ?? []).length, deck.pages.length);
    assert.ok(html.includes('Draft preview') && html.includes('Strong chemistry'));
  }
});
