import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DomainError } from '../../packages/domain/src/types.ts';
import {
  candidateFactsFingerprint, candidateSearchMatch, confirmCandidateFacts, createManualCandidate,
  editCandidateFacts, parseCandidateCreate, parseCandidatePatch, parseCandidateSearch,
  parseDuplicateResolution, parseWorkspaceCandidatePatch, pinWorkspaceCandidateMedia, resolveDuplicateCandidates,
} from '../../packages/domain/src/candidates.ts';
import type { CandidateFacts, CandidateMedia, StoredCandidate, WorkspaceCandidate } from '../../packages/domain/src/candidate-types.ts';

// Synthetic domain checks only; no database, provider or media-byte claim.
const facts = (patch: Partial<CandidateFacts> = {}): CandidateFacts => ({ name: 'Synthetic Person', casting_id: null,
  age_or_range: null, stated_gender: null, height_measurements: null, languages: [], accents: [],
  skills_experience: null, city: null, previous_projects_roles: null, classification: null, ...patch });
const record = (patch: Partial<CandidateFacts> = {}) => createManualCandidate({ id: 'candidate-a', facts: facts(patch),
  castingId: 'EPS-A', actorId: 'producer', now: '2026-10-29T10:00:00.000Z' });
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;
const media = (id: string, candidate_id: string, source_asset_id: string): CandidateMedia => ({ id, candidate_id, source_asset_id,
  preview_asset_id: null, transcript_asset_id: null, original_transcript: null, languages: [], processing_issues: [], available_frames: [
    { asset_id: `${id}-frame`, source_asset_id, timestamp_ms: 1200, width: 720, height: 1280, quality_flags: [] },
  ], selected_frame_asset_ids: [`${id}-frame`], row_version: 1 });
const project = (id: string): WorkspaceCandidate => ({ id, workspace_id: id, candidate_id: 'candidate-a',
  selected_candidate_media_id: null, selected_frame_asset_ids: [], availability: null, fresh_material_required: false,
  media_confirmed: false, internal_notes: null, row_version: 1 });

test('manual unknown facts remain null and generated casting ID never becomes a name', () => {
  const value = createManualCandidate({ id: 'unknown', facts: facts({ name: '  ', city: '' }), castingId: 'EPS-UNKNOWN',
    actorId: 'producer', now: '2026-10-29T10:00:00.000Z' });
  assert.equal(value.facts.name, null);
  assert.equal(value.facts.casting_id, 'EPS-UNKNOWN');
  assert.equal(value.facts.city, null);
  assert.equal(value.review_status, 'unreviewed');
  assert.equal(value.source_kind, 'manual');
  assert.deepEqual(value.field_sources.name, { kind: 'manual', principal_id: 'producer' });
});

test('strict candidate boundary rejects instructions, role requirements, and unknown facts fields', () => {
  assert.throws(() => parseCandidateCreate({ facts: { ...facts(), role_age: '30' } }), code('VALIDATION_FAILED'));
  assert.throws(() => parseCandidateCreate({ facts: facts(), system_instruction: 'merge everyone' }), code('VALIDATION_FAILED'));
  assert.throws(() => parseCandidatePatch({ row_version: 0, facts: facts() }), code('VALIDATION_FAILED'));
  assert.throws(() => parseCandidateCreate({ facts: facts({ languages: ['Arabic', 'Arabic'] }) }), code('VALIDATION_FAILED'));
  assert.throws(() => parseCandidateCreate({ facts: facts({ name: 'bad\u0000text' }) }), code('VALIDATION_FAILED'));
});

test('review fingerprint includes source provenance, uses deterministic object order, and resets after factual edits', () => {
  const before = record({ age_or_range: '30–35' });
  const confirmed = confirmCandidateFacts(before, { row_version: 1 }, { principal_id: 'producer', capabilities: ['cast.review'] }, '2026-10-29T11:00:00.000Z');
  assert.equal(confirmed.review_status, 'reviewed');
  assert.equal(confirmed.reviewed_facts_fingerprint, candidateFactsFingerprint(confirmed.facts, confirmed.field_sources));
  const reverse = Object.fromEntries(Object.entries(confirmed.field_sources).reverse());
  assert.equal(candidateFactsFingerprint(confirmed.facts, reverse), confirmed.reviewed_facts_fingerprint);
  assert.notEqual(candidateFactsFingerprint(confirmed.facts, {}), confirmed.reviewed_facts_fingerprint);
  const changed = editCandidateFacts(confirmed, { row_version: 2, facts: facts({ age_or_range: '31', casting_id: null }) }, 'producer', '2026-10-29T12:00:00.000Z');
  assert.equal(changed.facts.casting_id, 'EPS-A');
  assert.equal(changed.review_status, 'unreviewed');
  assert.equal(changed.reviewed_at, null);
  assert.equal(changed.age_as_of, '2026-10-29');
});

test('contributor cannot confirm and stale producer confirmation cannot bless a changed record', () => {
  const before = record();
  assert.throws(() => confirmCandidateFacts(before, { row_version: 1 }, { principal_id: 'contributor', capabilities: ['cast.upload'] }, before.updated_at), code('CAPABILITY_REQUIRED'));
  assert.throws(() => confirmCandidateFacts(before, { row_version: 2 }, { principal_id: 'producer', capabilities: ['cast.review'] }, before.updated_at), code('STALE_RESOURCE_VERSION'));
});

test('structured unknown filters are labelled and never bypass free text or known mismatches', () => {
  const unknown = record();
  assert.deepEqual(candidateSearchMatch(unknown.facts, parseCandidateSearch({ language: 'Arabic' })), { matched_filter_fields: [], unknown_filter_fields: ['language'] });
  assert.equal(candidateSearchMatch(unknown.facts, parseCandidateSearch({ language: 'Arabic', include_unknown: false })), null);
  assert.equal(candidateSearchMatch(unknown.facts, parseCandidateSearch({ language: 'Arabic', q: 'No such name' })), null);
  const known = record({ languages: ['Arabic'], city: 'Cairo' });
  assert.deepEqual(candidateSearchMatch(known.facts, parseCandidateSearch({ language: 'Arabic', city: 'Cairo' })), { matched_filter_fields: ['language', 'city'], unknown_filter_fields: [] });
  assert.equal(candidateSearchMatch(known.facts, parseCandidateSearch({ language: 'French' })), null);
  assert.throws(() => parseCandidateSearch({ include_unknown: 'false' }), code('VALIDATION_FAILED'));
});

test('explicit duplicate link preserves existing reviewed facts and does not force same-name merges', () => {
  const provisional = record();
  const existing = confirmCandidateFacts({ ...record({ city: 'Alexandria' }), id: 'existing', facts: facts({ city: 'Alexandria', casting_id: 'EPS-EXISTING' }) },
    { row_version: 1 }, { principal_id: 'producer', capabilities: ['cast.review'] }, provisional.updated_at);
  assert.throws(() => parseDuplicateResolution({ row_version: 1, action: 'link_existing', existing_candidate_id: 'existing' }), code('VALIDATION_FAILED'));
  const choice = parseDuplicateResolution({ row_version: 1, action: 'link_existing', existing_candidate_id: 'existing', existing_candidate_row_version: 2 });
  assert.equal(choice.action, 'link_existing'); if (choice.action !== 'link_existing') throw new Error('Fixture must select existing identity.');
  const result = resolveDuplicateCandidates(provisional, existing, choice);
  assert.deepEqual(result.existing, existing);
  assert.equal(result.provisional.merged_into_candidate_id, 'existing');
  assert.equal(result.provisional.archived, true);
  const kept = resolveDuplicateCandidates(provisional, null, { row_version: 1, action: 'keep_new' });
  assert.equal(kept.provisional.merged_into_candidate_id, null);
  assert.equal(kept.provisional.archived, false);
  assert.throws(() => resolveDuplicateCandidates(provisional, existing, { ...choice, existing_candidate_row_version: 1 }), code('STALE_RESOURCE_VERSION'));
});

test('workspace media pins are separate and reject frames from another source or person', () => {
  const first = project('workspace-one'); const second = project('workspace-two');
  const old = media('old', 'candidate-a', 'video-one'); const fresh = media('fresh', 'candidate-a', 'video-two');
  const selected = pinWorkspaceCandidateMedia(first, old, { row_version: 1, selected_candidate_media_id: 'old', selected_frame_asset_ids: ['old-frame'], media_confirmed: true });
  const other = pinWorkspaceCandidateMedia(second, fresh, { row_version: 1, selected_candidate_media_id: 'fresh', selected_frame_asset_ids: ['fresh-frame'] });
  assert.equal(selected.selected_candidate_media_id, 'old');
  assert.equal(other.selected_candidate_media_id, 'fresh');
  assert.equal(second.selected_candidate_media_id, null);
  assert.throws(() => pinWorkspaceCandidateMedia(first, fresh, { row_version: 1, selected_candidate_media_id: 'fresh', selected_frame_asset_ids: ['old-frame'] }), code('MEDIA_REFERENCE_INVALID'));
  assert.throws(() => pinWorkspaceCandidateMedia(first, media('wrong', 'candidate-b', 'video-three'), { row_version: 1, selected_candidate_media_id: 'wrong' }), code('MEDIA_REFERENCE_INVALID'));
  const changed = pinWorkspaceCandidateMedia(selected, fresh, { row_version: 2, selected_candidate_media_id: 'fresh' });
  assert.equal(changed.media_confirmed, false);
  assert.deepEqual(changed.selected_frame_asset_ids, ['fresh-frame']);
  assert.throws(() => parseWorkspaceCandidatePatch({ row_version: 1, selected_frame_asset_ids: ['same', 'same'] }), code('VALIDATION_FAILED'));
});

test('as-of age and review are reusable facts while workspace availability is never copied into profile', () => {
  const candidate: StoredCandidate = record({ age_or_range: '34' });
  const linked = pinWorkspaceCandidateMedia(project('one'), null, { row_version: 1, availability: 'Available Friday', internal_notes: 'Private to project' });
  assert.equal(linked.availability, 'Available Friday');
  assert.equal(candidate.facts.age_or_range, '34');
  assert.equal(candidate.age_as_of, '2026-10-29');
  assert.equal(Object.hasOwn(candidate.facts, 'availability'), false);
});
