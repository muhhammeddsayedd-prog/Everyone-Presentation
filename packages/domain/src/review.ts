import { DomainError } from './types.ts';
import { slideWordingFields } from './casting-types.ts';
import type { CastingOutput } from './casting-types.ts';
import type { AiSuggestionCreate, CastingRetirementUndo, ReviewFields, ReviewFitRequest, ReviewOptions, ReviewProjectionInput, ReviewSlide, SeriesCreate, SeriesListOptions, SeriesPatch } from './review-types.ts';
import type { RoleRequirements } from './specs-types.ts';

function invalid(): never { throw new DomainError('VALIDATION_FAILED', 'Provide the supported series, review or assistance fields.', 400); }
function state(): never { throw new DomainError('REVIEW_STATE_INVALID', 'Review inputs changed or contain inconsistent relationships. Reload the workspace.', 409); }
function object(value: unknown, allowed: readonly string[], required: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![null, Object.prototype].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum = 65536): string {
  if (typeof value !== 'string' || value.length > maximum) invalid();
  for (const char of value as string) { const point = char.codePointAt(0)!; if (point >= 0xd800 && point <= 0xdfff || point < 32 && ![9, 10, 13].includes(point) || point === 127) invalid(); }
  return value as string;
}
function id(value: unknown): string { const checked = text(value, 200); if (!checked || checked.trim() !== checked) invalid(); return checked; }
function output(value: unknown): CastingOutput { if (value !== 'selection' && value !== 'shortlist') invalid(); return value; }
function revision(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) invalid(); return value; }
function bounded<T>(value: T): T { if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 65536) invalid(); return value; }
export const AI_SUGGESTION_FIELDS = Object.freeze({
  assignment: slideWordingFields,
  candidate: ['name', 'age_or_range', 'height_measurements', 'skills_experience', 'city', 'previous_projects_roles', 'classification'] as const,
  role: ['name', 'requirements.age_range', 'requirements.appearance_performance', 'requirements.location', 'requirements.availability_requirements', 'requirements.other_instructions'] as const,
  workspace_candidate: ['availability'] as const,
});
export function parseSeriesCreate(value: unknown): SeriesCreate {
  const row = object(value, ['workspace_id', 'output_type', 'audience_preset_id', 'title'], ['workspace_id', 'output_type', 'audience_preset_id']);
  return bounded({ workspace_id: id(row.workspace_id), output_type: output(row.output_type), audience_preset_id: id(row.audience_preset_id), ...(Object.hasOwn(row, 'title') ? { title: text(row.title, 1000).trim() } : {}) });
}
export function parseSeriesPatch(value: unknown): SeriesPatch {
  const row = object(value, ['row_version', 'title', 'archived'], ['row_version']); const result: SeriesPatch = { row_version: revision(row.row_version) };
  if (Object.hasOwn(row, 'title')) result.title = text(row.title, 1000).trim();
  if (Object.hasOwn(row, 'archived')) { if (typeof row.archived !== 'boolean') invalid(); result.archived = row.archived; }
  return bounded(result);
}
export function parseSeriesListOptions(value: unknown = {}): SeriesListOptions {
  const row = object(value, ['workspace_id', 'output_type', 'cursor', 'limit']); const result: SeriesListOptions = { limit: 25 };
  if (Object.hasOwn(row, 'workspace_id')) result.workspace_id = id(row.workspace_id);
  if (Object.hasOwn(row, 'output_type')) result.output_type = output(row.output_type);
  if (Object.hasOwn(row, 'cursor')) result.cursor = text(row.cursor, 4000);
  if (Object.hasOwn(row, 'limit')) { result.limit = revision(row.limit); if (result.limit > 100) invalid(); }
  return bounded(result);
}
export function parseReviewOptions(value: unknown): ReviewOptions {
  const row = object(value, ['series_id', 'output_type'], ['series_id']);
  return { series_id: id(row.series_id), ...(Object.hasOwn(row, 'output_type') ? { output_type: output(row.output_type) } : {}) };
}
export function parseAiSuggestionCreate(value: unknown): AiSuggestionCreate {
  const row = object(value, ['workspace_id', 'capability', 'target_type', 'target_id', 'target_row_version', 'field', 'instruction', 'source_text'], ['workspace_id', 'capability', 'target_type', 'target_id', 'target_row_version', 'field', 'instruction']);
  if (!['slide_shorten', 'normalize_english', 'contextual_instruction'].includes(row.capability as string) || !['assignment', 'role', 'workspace_candidate', 'candidate'].includes(row.target_type as string)) invalid();
  const result: AiSuggestionCreate = { workspace_id: id(row.workspace_id), capability: row.capability as AiSuggestionCreate['capability'], target_type: row.target_type as AiSuggestionCreate['target_type'], target_id: id(row.target_id), target_row_version: revision(row.target_row_version), field: id(row.field), instruction: text(row.instruction, 8000) };
  if (!result.instruction.trim()) invalid();
  if (!(AI_SUGGESTION_FIELDS[result.target_type] as readonly string[]).includes(result.field)) invalid();
  if (result.capability === 'slide_shorten' && result.target_type !== 'assignment') invalid();
  if (Object.hasOwn(row, 'source_text')) result.source_text = text(row.source_text);
  return bounded(result);
}
export function parseReviewFitRequest(value: unknown): ReviewFitRequest {
  const row = object(value, ['series_id', 'expected_input_fingerprint'], ['series_id', 'expected_input_fingerprint']);
  if (typeof row.expected_input_fingerprint !== 'string' || !/^[a-f0-9]{64}$/u.test(row.expected_input_fingerprint)) invalid();
  return { series_id: id(row.series_id), expected_input_fingerprint: row.expected_input_fingerprint };
}
export function parseCastingRetirementUndo(value: unknown): CastingRetirementUndo {
  const row = object(value, ['expected_workspace_row_version'], ['expected_workspace_row_version']);
  return { expected_workspace_row_version: revision(row.expected_workspace_row_version) };
}

const display = (value: string | null | undefined) => value?.trim() ? value : 'Not provided';
function fields(): ReviewFields { return Object.fromEntries(slideWordingFields.map(key => [key, 'Not provided'])) as ReviewFields; }
const sorted = <T extends { id: string; sort_order: number }>(rows: readonly T[]) => [...rows].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
const requirements = (source: RoleRequirements | undefined): RoleRequirements => structuredClone(source ?? { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null });
export function projectReviewSlides(input: ReviewProjectionInput): ReviewSlide[] {
  const roles = sorted(input.roles.filter(row => !row.archived)); const slots = input.slots.filter(row => !row.archived);
  const assignments = input.assignments.filter(row => !row.archived);
  const unique = (rows: readonly { id: string }[]) => new Set(rows.map(row => row.id)).size === rows.length;
  if (![roles, slots, assignments, input.pool, input.candidates, input.media].every(unique) || roles.some(row => row.workspace_id !== input.workspace_id)
    || slots.some(row => !roles.some(role => role.id === row.role_id)) || input.pool.some(row => row.workspace_id !== input.workspace_id)
    || assignments.some(row => row.workspace_id !== input.workspace_id || !slots.some(slot => slot.id === row.slot_id) || !input.pool.some(pool => pool.id === row.workspace_candidate_id))) state();
  const included = assignments.filter(row => input.output_type === 'selection' || row.shortlist_included);
  const activeKeys = assignments.map(row => `${row.slot_id}:${input.pool.find(pool => pool.id === row.workspace_candidate_id)!.candidate_id}`);
  if (new Set(activeKeys).size !== activeKeys.length || slots.some(slot => assignments.filter(row => row.slot_id === slot.id && row.position === 'main').length > 1)) state();
  const result: ReviewSlide[] = [];
  function pending(role: typeof roles[number] | undefined, slot: typeof slots[number] | undefined) {
    result.push({ kind: 'pending', role_id: role?.id ?? null, role_name: role?.name ?? 'Requirements pending', slot_id: slot?.id ?? null, slot_label: slot?.label ?? 'Pending', assignment_id: null, workspace_candidate_id: null, candidate_id: null, candidate_media_id: null, position: null, review_status: null, assignment_row_version: null, workspace_candidate_row_version: null, candidate_row_version: null, requirements: requirements(role?.requirements), provisional: slot?.provisional ?? !slot, fields: fields(), source_fields: fields(), frames: [], video_asset_id: null });
  }
  for (const role of roles) {
    const roleSlots = sorted(slots.filter(slot => slot.role_id === role.id));
    if (!roleSlots.length) pending(role, undefined);
    for (const slot of roleSlots) {
      const choices = sorted(included.filter(row => row.slot_id === slot.id)); if (!choices.length) pending(role, slot);
      for (const choice of choices) {
        const pool = input.pool.find(row => row.id === choice.workspace_candidate_id)!; const candidate = input.candidates.find(row => row.id === pool.candidate_id && !row.archived); if (!candidate) state();
        const media = pool.selected_candidate_media_id === null ? null : input.media.find(row => row.id === pool.selected_candidate_media_id && row.candidate_id === candidate.id); if (pool.selected_candidate_media_id && !media) state();
        if (pool.selected_frame_asset_ids.length > 3 || new Set(pool.selected_frame_asset_ids).size !== pool.selected_frame_asset_ids.length || pool.selected_frame_asset_ids.some(id => !media?.frames.some(frame => frame.asset_id === id && frame.source_asset_id === media.source_asset_id))) state();
        const fact = candidate.facts; const source: ReviewFields = { name_or_id: display(fact.name?.trim() ? fact.name : fact.casting_id), age_or_range: display(fact.age_or_range), height_measurements: display(fact.height_measurements), languages_accents: display([...fact.languages, ...fact.accents].join('; ')), skills_experience: display(fact.skills_experience), city: display(fact.city), previous_projects_roles: display(fact.previous_projects_roles), classification: display(fact.classification), availability: display(pool.availability), presentation_notes: display(choice.presentation_notes) };
        const rendered = { ...source }; for (const key of slideWordingFields) { const wording = choice.slide_wording[key]; if (typeof wording === 'string') rendered[key] = display(wording); }
        result.push({ kind: 'candidate', role_id: role.id, role_name: role.name, slot_id: slot.id, slot_label: slot.label, assignment_id: choice.id, workspace_candidate_id: pool.id, candidate_id: candidate.id, candidate_media_id: media?.id ?? null, position: choice.position, review_status: candidate.review_status, assignment_row_version: choice.row_version, workspace_candidate_row_version: pool.row_version, candidate_row_version: candidate.row_version, requirements: requirements(role.requirements), provisional: slot.provisional ?? false, fields: rendered, source_fields: source, frames: pool.selected_frame_asset_ids.map(id => structuredClone(media!.frames.find(row => row.asset_id === id)!)), video_asset_id: media?.source_asset_id ?? null });
      }
    }
  }
  if (!roles.length) pending(undefined, undefined);
  return result;
}
