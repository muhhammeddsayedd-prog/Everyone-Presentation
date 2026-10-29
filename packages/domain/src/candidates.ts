import { createHash } from 'node:crypto';
import { DomainError } from './types.ts';
import type { SourceReference } from './specs-types.ts';
import type { CandidateConfirmation, CandidateCreate, CandidateExtraction, CandidateFacts, CandidateMedia,
  CandidatePatch, CandidateSearch, CandidateSearchMatch, CandidateSource, DuplicateResolution,
  FrameSelection, StoredCandidate, WorkspaceCandidate, WorkspaceCandidateCreate, WorkspaceCandidatePatch } from './candidate-types.ts';
export type * from './candidate-types.ts';

const scalars = ['name', 'casting_id', 'age_or_range', 'stated_gender', 'height_measurements', 'skills_experience', 'city', 'previous_projects_roles', 'classification'] as const;
const fields = [...scalars, 'languages', 'accents'] as const;
const filters = ['age_or_range', 'stated_gender', 'height_measurements', 'language', 'accent', 'skill', 'city', 'previous_project_role', 'classification'] as const;
const invalid = (): never => { throw new DomainError('VALIDATION_FAILED', 'Request does not match the candidate operation contract.', 400); };
function object(value: unknown, allowed: readonly string[], required: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![null, Object.prototype].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum = 10000): string {
  if (typeof value !== 'string' || value.length > maximum) invalid();
  for (const char of value as string) { const point = char.codePointAt(0)!; if (point >= 0xd800 && point <= 0xdfff || point < 32 && ![9, 10, 13].includes(point) || point === 127) invalid(); }
  return (value as string).trim();
}
function nullable(value: unknown): string | null { return value === null ? null : text(value) || null; }
function id(value: unknown): string { const result = text(value, 200); if (!result) invalid(); return result; }
function integer(value: unknown, minimum = 1): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) invalid(); return value as number; }
function strings(value: unknown, maximum = 100, maximumItemLength = 1000): string[] {
  if (!Array.isArray(value) || value.length > maximum) invalid();
  const result = (value as unknown[]).map(item => text(item, maximumItemLength));
  if (result.some(item => !item) || new Set(result.map(item => item.toLocaleLowerCase('en'))).size !== result.length) invalid();
  return result;
}
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') invalid(); return value as boolean; }
function compare(expected: number, actual: number) {
  integer(expected);
  if (expected !== actual) throw new DomainError('STALE_RESOURCE_VERSION', 'This record changed. Reload it before saving.', 409, { current_row_version: actual });
}
export function parseCandidateFacts(value: unknown): CandidateFacts {
  const item = object(value, fields, fields);
  return { name: nullable(item.name), casting_id: nullable(item.casting_id), age_or_range: nullable(item.age_or_range),
    stated_gender: nullable(item.stated_gender), height_measurements: nullable(item.height_measurements),
    languages: strings(item.languages), accents: strings(item.accents), skills_experience: nullable(item.skills_experience),
    city: nullable(item.city), previous_projects_roles: nullable(item.previous_projects_roles), classification: nullable(item.classification) };
}
export function parseCandidateCreate(value: unknown): CandidateCreate {
  const item = object(value, ['facts', 'source_asset_ids'], ['facts']);
  return { facts: parseCandidateFacts(item.facts), ...(Object.hasOwn(item, 'source_asset_ids') ? { source_asset_ids: strings(item.source_asset_ids, 100, 200).map(id) } : {}) };
}
export function parseCandidatePatch(value: unknown): CandidatePatch {
  const item = object(value, ['row_version', 'facts'], ['row_version', 'facts']);
  return { row_version: integer(item.row_version), facts: parseCandidateFacts(item.facts) };
}
export function parseCandidateConfirmation(value: unknown): CandidateConfirmation {
  const item = object(value, ['row_version', 'confirmation_note'], ['row_version']);
  return { row_version: integer(item.row_version), ...(Object.hasOwn(item, 'confirmation_note') ? { confirmation_note: nullable(item.confirmation_note) } : {}) };
}
export function parseCandidateSearch(value: unknown): CandidateSearch {
  const item = object(value, ['q', 'cursor', 'limit', 'include_unknown', 'review_status', ...filters]);
  const result: CandidateSearch = {};
  for (const key of ['q', 'cursor', ...filters] as const) if (Object.hasOwn(item, key)) result[key] = text(item[key], key === 'cursor' ? 4000 : 500);
  if (Object.hasOwn(item, 'limit')) { result.limit = integer(item.limit); if (result.limit > 100) invalid(); }
  if (Object.hasOwn(item, 'include_unknown')) result.include_unknown = boolean(item.include_unknown);
  if (Object.hasOwn(item, 'review_status')) { if (!['unreviewed', 'reviewed'].includes(item.review_status as string)) invalid(); result.review_status = item.review_status as 'unreviewed' | 'reviewed'; }
  return result;
}
export function parseFrameSelection(value: unknown): FrameSelection {
  const item = object(value, ['row_version', 'selected_frame_asset_ids'], ['row_version', 'selected_frame_asset_ids']);
  return { row_version: integer(item.row_version), selected_frame_asset_ids: strings(item.selected_frame_asset_ids, 3, 200).map(id) };
}
export function parseDuplicateResolution(value: unknown): DuplicateResolution {
  const item = object(value, ['row_version', 'action', 'existing_candidate_id', 'existing_candidate_row_version'], ['row_version', 'action']);
  if (item.action === 'keep_new') { if (Object.hasOwn(item, 'existing_candidate_id') || Object.hasOwn(item, 'existing_candidate_row_version')) invalid(); return { row_version: integer(item.row_version), action: 'keep_new' }; }
  if (item.action !== 'link_existing') invalid();
  return { row_version: integer(item.row_version), action: 'link_existing', existing_candidate_id: id(item.existing_candidate_id), existing_candidate_row_version: integer(item.existing_candidate_row_version) };
}
export function parseWorkspaceCandidateCreate(value: unknown): WorkspaceCandidateCreate {
  const item = object(value, ['candidate_id', 'selected_candidate_media_id', 'availability', 'fresh_material_required'], ['candidate_id']);
  const result: WorkspaceCandidateCreate = { candidate_id: id(item.candidate_id) };
  if (Object.hasOwn(item, 'selected_candidate_media_id')) result.selected_candidate_media_id = item.selected_candidate_media_id === null ? null : id(item.selected_candidate_media_id);
  if (Object.hasOwn(item, 'availability')) result.availability = nullable(item.availability);
  if (Object.hasOwn(item, 'fresh_material_required')) result.fresh_material_required = boolean(item.fresh_material_required);
  return result;
}
export function parseWorkspaceCandidatePatch(value: unknown): WorkspaceCandidatePatch {
  const item = object(value, ['row_version', 'selected_candidate_media_id', 'selected_frame_asset_ids', 'availability', 'fresh_material_required', 'media_confirmed', 'internal_notes'], ['row_version']);
  const result: WorkspaceCandidatePatch = { row_version: integer(item.row_version) };
  if (Object.hasOwn(item, 'selected_candidate_media_id')) result.selected_candidate_media_id = item.selected_candidate_media_id === null ? null : id(item.selected_candidate_media_id);
  if (Object.hasOwn(item, 'selected_frame_asset_ids')) result.selected_frame_asset_ids = strings(item.selected_frame_asset_ids, 3, 200).map(id);
  for (const key of ['availability', 'internal_notes'] as const) if (Object.hasOwn(item, key)) result[key] = nullable(item[key]);
  for (const key of ['fresh_material_required', 'media_confirmed'] as const) if (Object.hasOwn(item, key)) result[key] = boolean(item[key]);
  return result;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function candidateFactsFingerprint(facts: CandidateFacts, sources: Record<string, CandidateSource>): string {
  return createHash('sha256').update(canonical({ facts, field_sources: sources })).digest('hex');
}
export function createManualCandidate(input: { id: string; facts: CandidateFacts; castingId: string; actorId: string; now: string }): StoredCandidate {
  const facts = parseCandidateFacts(input.facts); facts.casting_id ??= id(input.castingId);
  const field_sources = Object.fromEntries(fields.map(field => [field, { kind: 'manual' as const, principal_id: input.actorId }]));
  return { id: input.id, facts, review_status: 'unreviewed', reviewed_at: null, reviewed_by: null, search_match: null,
    possible_duplicate: false, merged_into_candidate_id: null, archived: false, row_version: 1,
    created_at: input.now, updated_at: input.now, source_kind: 'manual', field_sources, reviewed_facts_fingerprint: null,
    age_as_of: facts.age_or_range === null ? null : input.now.slice(0, 10) };
}
export function editCandidateFacts(before: StoredCandidate, input: CandidatePatch, actorId: string, now: string): StoredCandidate {
  compare(input.row_version, before.row_version);
  const facts = parseCandidateFacts(input.facts); facts.casting_id ??= before.facts.casting_id;
  const sources = structuredClone(before.field_sources);
  for (const field of fields) if (canonical(facts[field]) !== canonical(before.facts[field])) sources[field] = { kind: 'manual', principal_id: actorId };
  const changed = candidateFactsFingerprint(facts, sources) !== candidateFactsFingerprint(before.facts, before.field_sources);
  return { ...structuredClone(before), facts, field_sources: sources, row_version: before.row_version + 1, updated_at: now,
    age_as_of: facts.age_or_range !== before.facts.age_or_range ? facts.age_or_range === null ? null : now.slice(0, 10) : before.age_as_of,
    ...(changed ? { review_status: 'unreviewed', reviewed_at: null, reviewed_by: null, reviewed_facts_fingerprint: null } : {}) };
}
export function confirmCandidateFacts(before: StoredCandidate, input: CandidateConfirmation,
  actor: { principal_id: string; capabilities: string[] }, now: string): StoredCandidate {
  if (!actor.capabilities.includes('cast.review')) throw new DomainError('CAPABILITY_REQUIRED', 'This account cannot confirm reusable facts.', 403);
  compare(input.row_version, before.row_version);
  if (before.archived || before.merged_into_candidate_id !== null) throw new DomainError('INVALID_TRANSITION', 'Archived profiles cannot be confirmed.', 409);
  return { ...structuredClone(before), review_status: 'reviewed', reviewed_at: now, reviewed_by: actor.principal_id,
    reviewed_facts_fingerprint: candidateFactsFingerprint(before.facts, before.field_sources), row_version: before.row_version + 1, updated_at: now };
}
function searchText(value: string): string { return value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/gu, ''); }
/** Interpret only explicitly stated bounded integer ages/ranges. Raw facts remain untouched. */
function suppliedAgeBounds(value: string): [number, number] | null {
  const match = /^([0-9]{1,3})(?: *[-–—] *([0-9]{1,3}))?$/u.exec(searchText(value));
  if (!match) return null;
  const minimum = Number(match[1]); const maximum = Number(match[2] ?? match[1]);
  return minimum <= maximum && maximum <= 130 ? [minimum, maximum] : null;
}
export function candidateSearchMatch(facts: CandidateFacts, search: CandidateSearch): CandidateSearchMatch | null {
  const lower = (value: string) => value.toLocaleLowerCase('en');
  const haystack = lower(fields.map(field => Array.isArray(facts[field]) ? facts[field].join(' ') : facts[field] ?? '').join(' '));
  if (search.q?.trim() && !haystack.includes(lower(search.q.trim()))) return null;
  const result: CandidateSearchMatch = { matched_filter_fields: [], unknown_filter_fields: [] };
  const map = { language: 'languages', accent: 'accents', skill: 'skills_experience', previous_project_role: 'previous_projects_roles' } as const;
  for (const key of filters) if (search[key]?.trim()) {
    const field = Object.hasOwn(map, key) ? map[key as keyof typeof map] : key as keyof CandidateFacts;
    const value = facts[field]; const wanted = searchText(search[key]!);
    if (value === null || Array.isArray(value) && value.length === 0) { if (search.include_unknown === false) return null; result.unknown_filter_fields.push(key); }
    else if (key === 'stated_gender' && typeof value === 'string') {
      if (lower(searchText(value)) !== lower(wanted)) return null;
      result.matched_filter_fields.push(key);
    } else if (key === 'age_or_range' && typeof value === 'string') {
      const actualAge = suppliedAgeBounds(value); const wantedAge = suppliedAgeBounds(wanted);
      if (actualAge && wantedAge ? actualAge[0] > wantedAge[1] || wantedAge[0] > actualAge[1] : !lower(value).includes(lower(wanted))) return null;
      result.matched_filter_fields.push(key);
    }
    else if ((Array.isArray(value) ? value : [value]).some(item => lower(item).includes(lower(wanted)))) result.matched_filter_fields.push(key);
    else return null;
  }
  return result;
}
export function resolveDuplicateCandidates(provisional: StoredCandidate, existing: StoredCandidate | null, input: DuplicateResolution) {
  compare(input.row_version, provisional.row_version);
  if (provisional.archived || provisional.merged_into_candidate_id) throw new DomainError('INVALID_TRANSITION', 'This provisional profile was already resolved.', 409);
  if (input.action === 'keep_new') return { provisional: { ...structuredClone(provisional), possible_duplicate: false, row_version: provisional.row_version + 1 }, existing: null };
  if (!existing || existing.id !== input.existing_candidate_id || existing.id === provisional.id || existing.archived || existing.merged_into_candidate_id) throw new DomainError('RESOURCE_NOT_FOUND', 'Choose an active existing profile.', 404);
  compare(input.existing_candidate_row_version, existing.row_version);
  return { provisional: { ...structuredClone(provisional), possible_duplicate: false, archived: true, merged_into_candidate_id: existing.id, row_version: provisional.row_version + 1 }, existing: structuredClone(existing) };
}
export function pinWorkspaceCandidateMedia(before: WorkspaceCandidate, media: CandidateMedia | null, input: WorkspaceCandidatePatch): WorkspaceCandidate {
  compare(input.row_version, before.row_version);
  const next = { ...structuredClone(before), ...structuredClone(input), row_version: before.row_version + 1 };
  const selectionChanged = Object.hasOwn(input, 'selected_candidate_media_id') && input.selected_candidate_media_id !== before.selected_candidate_media_id;
  if (next.selected_candidate_media_id !== null && (!media || media.id !== next.selected_candidate_media_id || media.candidate_id !== before.candidate_id)) throw new DomainError('MEDIA_REFERENCE_INVALID', 'Choose media belonging to this candidate.', 422);
  if (selectionChanged && input.selected_frame_asset_ids === undefined) next.selected_frame_asset_ids = media?.selected_frame_asset_ids.slice() ?? [];
  if (!next.selected_candidate_media_id && next.selected_frame_asset_ids.length || next.selected_frame_asset_ids.some(frame => !media?.available_frames.some(item => item.asset_id === frame && item.source_asset_id === media.source_asset_id))) throw new DomainError('MEDIA_REFERENCE_INVALID', 'Select frames from the chosen source recording.', 422);
  if (selectionChanged && input.media_confirmed === undefined) next.media_confirmed = false;
  return next;
}

/** Shape validation only; source-grounding is checked against the actual transcript by the worker. */
export function parseCandidateExtraction(value: unknown): CandidateExtraction {
  const item = object(value, ['schema_version', 'source_asset_id', 'facts', 'project_availability_statement', 'evidence', 'uncertainties'], ['schema_version', 'source_asset_id', 'facts', 'project_availability_statement', 'evidence', 'uncertainties']);
  if (item.schema_version !== '1.0' || !Array.isArray(item.evidence) || item.evidence.length > 500 || !Array.isArray(item.uncertainties) || item.uncertainties.length > 100) invalid();
  const coordinate = (value: unknown, minimum: number) => value === null ? null : integer(value, minimum);
  const source = (value: unknown): SourceReference => {
    const ref = object(value, ['asset_id', 'page', 'paragraph', 'segment_index', 'start_ms', 'end_ms', 'quote'], ['asset_id', 'page', 'paragraph', 'segment_index', 'start_ms', 'end_ms', 'quote']);
    return { asset_id: ref.asset_id === null ? null : id(ref.asset_id), page: coordinate(ref.page, 1), paragraph: coordinate(ref.paragraph, 0), segment_index: coordinate(ref.segment_index, 0), start_ms: coordinate(ref.start_ms, 0), end_ms: coordinate(ref.end_ms, 0), quote: nullable(ref.quote) };
  };
  return { schema_version: '1.0', source_asset_id: id(item.source_asset_id), facts: parseCandidateFacts(item.facts), project_availability_statement: nullable(item.project_availability_statement),
    evidence: (item.evidence as unknown[]).map(value => { const entry = object(value, ['field_path', 'source'], ['field_path', 'source']); return { field_path: text(entry.field_path, 200), source: source(entry.source) }; }),
    uncertainties: (item.uncertainties as unknown[]).map(value => { const entry = object(value, ['field_path', 'reason'], ['field_path', 'reason']); return { field_path: text(entry.field_path, 200), reason: text(entry.reason) }; }) };
}
