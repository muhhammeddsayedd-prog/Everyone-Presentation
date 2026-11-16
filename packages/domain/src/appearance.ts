import taxonomyJson from '../../../contracts/appearance-taxonomy.json' with { type: 'json' };
import { DomainError } from './types.ts';

/** Neutral observable appearance taxonomy (contracts/appearance-taxonomy.json). Closed vocabularies only. */
export interface TaxonomyValue { key: string; label: string; label_ar: string; aliases?: string[]; standalone?: boolean }
export interface TaxonomyAttribute { label: string; label_ar: string; changeable: boolean; phrase_context?: string[]; lighting_sensitive?: boolean; note?: string;
  values: TaxonomyValue[]; families?: Record<string, { label: string; label_ar: string; members: string[] }> }
export interface AppearanceTaxonomy {
  version: string; description: string; rules: string[]; forbidden_attributes: string[]; confidence: string[]; statuses: string[];
  media_categories: { key: string; label: string; label_ar: string }[]; attributes: Record<string, TaxonomyAttribute>;
  supplied_values: Record<string, { key: string; label: string; label_ar: string }[]>;
  facets: { key: string; label: string; label_ar: string; sources: string[] }[];
}
export const APPEARANCE_TAXONOMY = taxonomyJson as AppearanceTaxonomy;
export const APPEARANCE_ATTRIBUTES = Object.freeze(Object.keys(APPEARANCE_TAXONOMY.attributes)) as readonly string[];
export const FACET_KEYS = Object.freeze(APPEARANCE_TAXONOMY.facets.map(facet => facet.key)) as readonly string[];
export type AppearanceConfidence = 'low' | 'medium' | 'high';
export type ObservationStatus = 'suggested' | 'confirmed' | 'rejected' | 'overridden';
export type MediaCategory = 'portfolio_photo' | 'headshot' | 'full_body' | 'video_frame';

export interface AppearanceObservation {
  id: string; media_id: string; person_index: number; position_note: string | null; attribute: string; suggested_value: string;
  confidence: AppearanceConfidence; evidence: string | null; status: ObservationStatus; override_value: string | null; effective_value: string | null;
  reviewed_by: string | null; reviewed_at: string | null; row_version: number;
}
export interface ObservationMedia {
  id: string; asset_id: string; source_kind: 'photo' | 'frame'; thumb_asset_id: string | null; candidate_media_id: string | null; frame_timestamp_ms: number | null;
  media_category: MediaCategory; recording_context: 'archive_photo' | 'introduction_video'; media_added_at: string; people_count: number; ambiguous: boolean;
  target_person_index: number | null; quality_note: string | null; model: string; prompt_version: string; analyzed_at: string; row_version: number;
  observations: AppearanceObservation[];
}
/** Supplied information shown beside observations, each with its real source. Archive labels are imported, never
 * self-reported or human-confirmed; stated age is supplied information, separate from playing-age suggestions. */
export interface SuppliedAppearance {
  archive: null | { source: { kind: 'archive_import'; source_project: string | null; source_id: string | null; imported_at: string | null }; name_ar: string | null;
    talent_type: string; look: string | null; skin_tone: string | null; playing_age: string[]; hair_length: string[]; hair_texture: string[]; hair_colour: string[];
    hair_style: string[]; hair_colouring: string[]; tags: string[] };
  facts: { key: 'stated_gender' | 'age_or_range' | 'city' | 'languages'; value: string | string[] | null; source: 'manual' | 'transcript' | 'archive' | null }[];
}
export interface CandidateObservations { candidate_id: string; supplied: SuppliedAppearance; media: ObservationMedia[] }
export type ObservationReview = { row_version: number; action: 'confirm' | 'reject' | 'reset' } | { row_version: number; action: 'override'; value: string };

/** Library facet filter: OR within one facet, AND across facets. "unknown" may be selected as a value. */
export interface FacetFilters { facets: Partial<Record<string, string[]>>; include_unknown: boolean; q?: string }
export interface FacetValueCount { value: string; count: number }
export interface FacetCounts { key: string; matched: number; unknown: number; values: FacetValueCount[]; selected: string[] }
export interface CandidateFacets { total: number; filters: { facets: Partial<Record<string, string[]>>; include_unknown: boolean; q: string | null }; facets: FacetCounts[] }
export interface EnrichmentBatchStart { workspace_id: string; candidate_ids?: string[]; filters?: FacetFilters; limit: number; spend_cap_cents: number }
export interface EnrichmentBatch {
  id: string; workspace_id: string; status: 'running' | 'completed' | 'stopped_spend_cap' | 'cancelled'; scope: Record<string, unknown>; item_limit: number;
  spend_cap_cents: number; spent_micro_usd: number; model: string; prompt_version: string; created_at: string; updated_at: string; completed_at: string | null; row_version: number;
  counts: { total: number; pending: number; queued: number; succeeded: number; failed: number; skipped: number; input_tokens: number; output_tokens: number };
  items: { candidate_id: string; position: number; status: 'pending' | 'queued' | 'succeeded' | 'failed' | 'skipped'; job_id: string | null; error_code: string | null; cost_micro_usd: number }[];
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const invalid = (message: string): never => { throw new DomainError('VALIDATION_FAILED', message, 400); };

export function appearanceValues(attribute: string): string[] { return APPEARANCE_TAXONOMY.attributes[attribute]?.values.map(value => value.key) ?? []; }
export function isAppearanceValue(attribute: string, value: string) { return value === 'unknown' ? Object.hasOwn(APPEARANCE_TAXONOMY.attributes, attribute) : appearanceValues(attribute).includes(value); }
export function isForbiddenAttribute(name: string) { return APPEARANCE_TAXONOMY.forbidden_attributes.includes(name.trim().toLowerCase().replace(/[\s-]+/gu, '_')); }

/** Same normalisation as eps.appearance_norm: case, whitespace, tatweel, Arabic diacritics, alef forms, alef maqsura. */
export function normalizeSearchText(value: string | null | undefined): string | null {
  const text = (value ?? '').toLowerCase().replace(/[\u0640\u064B-\u065F\u0670]/gu, '').replace(/[\u0623\u0625\u0622\u0671]/gu, '\u0627').replace(/\u0649/gu, '\u064A')
    .replace(/\s+/gu, ' ').trim();
  return text || null;
}
const fold = (value: string) => value.toLowerCase().replace(/[-_]+/gu, ' ').replace(/\s+/gu, ' ').trim();

/** A single supplied label (e.g. m09 "Dark Brown", "Afro") -> taxonomy key, or null when it is not a known alias. */
export function normalizeAppearanceLabel(attribute: string, label: string): string | null {
  const definition = APPEARANCE_TAXONOMY.attributes[attribute]; if (!definition) return null; const wanted = fold(label);
  for (const value of definition.values) if (fold(value.key) === wanted || fold(value.label) === wanted || value.aliases?.some(alias => fold(alias) === wanted)) return value.key;
  return null;
}

/** Free-text phrase ("long dark hair", "curly blonde hair with glasses") -> one key per attribute it names.
 * Context-dependent aliases (dark, long, brown) need the attribute's context word (hair); standalone aliases do not.
 * Longer aliases win (e.g. "dark brown" over "dark"). Forbidden attributes are never produced. */
export function normalizeAppearancePhrase(phrase: string): Partial<Record<string, string>> {
  const text = ` ${fold(phrase).replace(/[^\p{L}\p{N}+ ]/gu, ' ').replace(/\s+/gu, ' ')} `; const result: Partial<Record<string, string>> = {};
  for (const [attribute, definition] of Object.entries(APPEARANCE_TAXONOMY.attributes)) {
    const contextual = !definition.phrase_context || definition.phrase_context.some(word => text.includes(` ${word} `));
    const candidates = definition.values.flatMap(value => [value.label, ...(value.aliases ?? [])].map(alias => ({ key: value.key, alias: fold(alias), standalone: value.standalone === true })))
      .sort((a, b) => b.alias.length - a.alias.length);
    for (const candidate of candidates) {
      if (!candidate.alias || !(contextual || candidate.standalone)) continue;
      if (text.includes(` ${candidate.alias} `)) { result[attribute] = candidate.key; break; }
    }
  }
  return result;
}
export function hairColourFamily(family: string): string[] { return APPEARANCE_TAXONOMY.attributes.hair_colour.families?.[family]?.members ?? []; }
export function appearanceValueLabel(attribute: string, value: string, arabic = false): string {
  if (value === 'unknown') return arabic ? 'غير معروف' : 'Unknown';
  const entry = APPEARANCE_TAXONOMY.attributes[attribute]?.values.find(item => item.key === value) ?? APPEARANCE_TAXONOMY.supplied_values[attribute]?.find(item => item.key === value);
  return entry ? (arabic ? entry.label_ar : entry.label) : value;
}

export function parseFacetFilters(value: unknown): FacetFilters {
  if (value === undefined || value === null) return { facets: {}, include_unknown: false };
  if (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['facets', 'include_unknown', 'q'].includes(key))) invalid('Provide facets, include_unknown and q only.');
  const input = value as Record<string, unknown>;
  if (input.q !== undefined && (typeof input.q !== 'string' || input.q.length > 200)) invalid('q is a short text query.');
  if (input.include_unknown !== undefined && typeof input.include_unknown !== 'boolean') invalid('include_unknown must be a boolean.');
  const facets: Partial<Record<string, string[]>> = {};
  if (input.facets !== undefined) {
    if (!input.facets || typeof input.facets !== 'object' || Array.isArray(input.facets)) invalid('facets must be an object of value lists.');
    for (const [key, list] of Object.entries(input.facets as Record<string, unknown>)) {
      if (!FACET_KEYS.includes(key) || !Array.isArray(list) || list.length > 50 || list.some(item => typeof item !== 'string' || !item.length || item.length > 200)) invalid('Unsupported facet filter.');
      if ((list as string[]).length) facets[key] = [...new Set(list as string[])];
    }
  }
  return { facets, include_unknown: input.include_unknown === true, ...(typeof input.q === 'string' && input.q.trim() ? { q: input.q } : {}) };
}
/** Library URL state: facet=hair_colour:black&facet=city:Dubai&include_unknown=true (repeatable "facet"). */
export function facetFiltersToSearchParams(filters: FacetFilters, params = new URLSearchParams()): URLSearchParams {
  params.delete('facet'); params.delete('include_unknown');
  for (const key of FACET_KEYS) for (const value of filters.facets[key] ?? []) params.append('facet', `${key}:${value}`);
  if (filters.include_unknown) params.set('include_unknown', 'true');
  return params;
}
export function facetFiltersFromSearchParams(params: URLSearchParams): FacetFilters {
  const facets: Partial<Record<string, string[]>> = {};
  for (const entry of params.getAll('facet')) {
    const at = entry.indexOf(':'); const key = entry.slice(0, at); const value = entry.slice(at + 1);
    if (at < 1 || !FACET_KEYS.includes(key) || !value || value.length > 200) continue;
    facets[key] = [...new Set([...(facets[key] ?? []), value])];
  }
  return { facets, include_unknown: params.get('include_unknown') === 'true' };
}
export function parseObservationReview(value: unknown): ObservationReview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('Provide a review decision.');
  const input = value as Record<string, unknown>;
  if (!Number.isSafeInteger(input.row_version) || Number(input.row_version) < 1 || !['confirm', 'reject', 'override', 'reset'].includes(String(input.action))
    || Object.keys(input).some(key => !['row_version', 'action', 'value'].includes(key)) || (input.action === 'override') !== (typeof input.value === 'string')) invalid('Provide row_version, an action and a value only for override.');
  return structuredClone(input) as unknown as ObservationReview;
}
export function parseEnrichmentBatchStart(value: unknown): EnrichmentBatchStart {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('Provide an enrichment batch.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['workspace_id', 'candidate_ids', 'filters', 'limit', 'spend_cap_cents'].includes(key)) || typeof input.workspace_id !== 'string' || !UUID.test(input.workspace_id)
    || (input.candidate_ids === undefined) === (input.filters === undefined) || !Number.isSafeInteger(input.limit) || Number(input.limit) < 1 || Number(input.limit) > 1000
    || !Number.isSafeInteger(input.spend_cap_cents) || Number(input.spend_cap_cents) < 1 || Number(input.spend_cap_cents) > 1_000_000
    || input.candidate_ids !== undefined && (!Array.isArray(input.candidate_ids) || !input.candidate_ids.length || input.candidate_ids.length > 1000 || input.candidate_ids.some(id => typeof id !== 'string' || !UUID.test(id))))
    invalid('Provide workspace_id, either candidate_ids or filters, limit (1-1000) and spend_cap_cents (1-1000000).');
  return { ...structuredClone(input), ...(input.filters !== undefined ? { filters: parseFacetFilters(input.filters) } : {}) } as unknown as EnrichmentBatchStart;
}
/** Effective value shown in search: confirmed suggestion or human override; suggestions and rejections never count. */
export function effectiveObservationValue(observation: Pick<AppearanceObservation, 'status' | 'suggested_value' | 'override_value'>): string | null {
  return observation.status === 'confirmed' ? observation.suggested_value : observation.status === 'overridden' ? observation.override_value : null;
}
