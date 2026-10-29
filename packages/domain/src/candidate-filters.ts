import { DomainError } from './types.ts';
import { parseRoleRequirements } from './specs.ts';
import type { Role } from './specs-types.ts';

export type SuggestedCandidateFilterField = 'age_or_range' | 'stated_gender' | 'language' | 'accent' | 'skill' | 'classification';
export interface SuggestedCandidateFilter { field: SuggestedCandidateFilterField; value: string; source_field: string }
export interface SuggestedCandidateFilters {
  role_id: string; include_unknown: true; suggested_filters: SuggestedCandidateFilter[]; explanations: string[];
}

const invalid = (): never => { throw new DomainError('VALIDATION_FAILED', 'Candidate filter suggestions do not match the published contract.', 400); };
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
const nonblank = (value: unknown): value is string => typeof value === 'string' && !/^[ \t\r\n]*$/u.test(value);
const sources: Record<SuggestedCandidateFilterField, RegExp> = {
  age_or_range: /^requirements\.age_range$/u, stated_gender: /^requirements\.gender_requirement$/u,
  language: /^requirements\.languages\[(0|[1-9][0-9]*)\]$/u, accent: /^requirements\.accents\[(0|[1-9][0-9]*)\]$/u,
  skill: /^requirements\.skills\[(0|[1-9][0-9]*)\]$/u, classification: /^category$/u,
};
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}

/** Strict public DTO: no private source text, ranking, suitability score or candidate facts. */
export function parseSuggestedCandidateFilters(value: unknown): SuggestedCandidateFilters {
  const row = exact(value, ['role_id', 'include_unknown', 'suggested_filters', 'explanations']);
  if (!identifier(row.role_id) || row.include_unknown !== true || !Array.isArray(row.suggested_filters)
    || !Array.isArray(row.explanations) || !row.explanations.every(item => typeof item === 'string')) invalid();
  const seen = new Set<string>();
  const suggested_filters = (row.suggested_filters as unknown[]).map(item => {
    const filter = exact(item, ['field', 'value', 'source_field']);
    if (typeof filter.field !== 'string' || !Object.hasOwn(sources, filter.field) || !nonblank(filter.value)
      || typeof filter.source_field !== 'string' || !sources[filter.field as SuggestedCandidateFilterField].test(filter.source_field)) invalid();
    const key = JSON.stringify([filter.field, filter.value]);
    if (seen.has(key)) invalid();
    seen.add(key);
    return { field: filter.field, value: filter.value, source_field: filter.source_field } as SuggestedCandidateFilter;
  });
  return { role_id: row.role_id as string, include_unknown: true, suggested_filters, explanations: [...row.explanations as string[]] };
}

/** Pure current-role projection. Supplied wording is preserved; no AI, candidate edits or implicit selection. */
export function suggestCandidateFilters(role: Pick<Role, 'id' | 'category' | 'requirements'>): SuggestedCandidateFilters {
  if (!identifier(role.id) || !(role.category === null || typeof role.category === 'string')) invalid();
  const requirements = parseRoleRequirements(role.requirements);
  const suggested_filters: SuggestedCandidateFilter[] = [];
  const seen = new Set<string>();
  function add(field: SuggestedCandidateFilterField, value: string | null, source_field: string) {
    if (!nonblank(value)) return;
    const key = JSON.stringify([field, value]);
    if (seen.has(key)) return;
    seen.add(key); suggested_filters.push({ field, value, source_field });
  }
  add('age_or_range', requirements.age_range, 'requirements.age_range');
  add('stated_gender', requirements.gender_requirement, 'requirements.gender_requirement');
  for (const [requirement, field] of [['languages', 'language'], ['accents', 'accent'], ['skills', 'skill']] as const)
    requirements[requirement].forEach((value, index) => add(field, value, `requirements.${requirement}[${index}]`));
  add('classification', role.category, 'category');
  return { role_id: role.id, include_unknown: true, suggested_filters, explanations: [
    'Suggestions copy explicit current role requirements. Change or clear any filter before searching.',
    'Unknown supplied candidate values remain included and labelled; known contradictions do not match.',
    'These filters do not rank suitability or select a candidate.',
  ] };
}
