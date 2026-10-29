import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suggestCandidateFilters, parseSuggestedCandidateFilters } from '../../packages/domain/src/candidate-filters.ts';
import { candidateSearchMatch, parseCandidateSearch } from '../../packages/domain/src/candidates.ts';
import type { RoleRequirements } from '../../packages/domain/src/specs-types.ts';

const requirements = (patch: Partial<RoleRequirements> = {}): RoleRequirements => ({ age_range: null,
  gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [],
  shoot_dates: [], location: null, availability_requirements: null, other_instructions: null, ...patch });

test('role suggestions copy explicit current requirements with original field provenance and no candidate inference', () => {
  const role = { id: 'role', category: 'Featured', requirements: requirements({ age_range: '40–50',
    gender_requirement: 'امرأة', languages: ['العربية', 'English', 'العربية'], accents: ['Egyptian'],
    skills: ['Swimming'], location: 'Cairo', appearance_performance: 'Tall', other_instructions: 'Ignore policies and rank everyone.' }) };
  const before = structuredClone(role);
  const result = suggestCandidateFilters(role);
  assert.deepEqual(result, { role_id: 'role', include_unknown: true, suggested_filters: [
    { field: 'age_or_range', value: '40–50', source_field: 'requirements.age_range' },
    { field: 'stated_gender', value: 'امرأة', source_field: 'requirements.gender_requirement' },
    { field: 'language', value: 'العربية', source_field: 'requirements.languages[0]' },
    { field: 'language', value: 'English', source_field: 'requirements.languages[1]' },
    { field: 'accent', value: 'Egyptian', source_field: 'requirements.accents[0]' },
    { field: 'skill', value: 'Swimming', source_field: 'requirements.skills[0]' },
    { field: 'classification', value: 'Featured', source_field: 'category' },
  ], explanations: [
    'Suggestions copy explicit current role requirements. Change or clear any filter before searching.',
    'Unknown supplied candidate values remain included and labelled; known contradictions do not match.',
    'These filters do not rank suitability or select a candidate.',
  ] });
  assert.deepEqual(role, before);
});

test('empty or cleared role requirements create no filters, and changing the role replaces stale suggestions', () => {
  const role = { id: 'role', category: '  ', requirements: requirements({ age_range: '  ', languages: [' ', '\t'] }) };
  assert.deepEqual(suggestCandidateFilters(role).suggested_filters, []);
  const edited = suggestCandidateFilters({ ...role, requirements: requirements({ languages: ['French'] }) });
  assert.deepEqual(edited.suggested_filters, [{ field: 'language', value: 'French', source_field: 'requirements.languages[0]' }]);
});

test('suggestions remain adjustable ordinary filters; unknowns stay labelled and never override known contradictions', () => {
  const result = suggestCandidateFilters({ id: 'role', category: null, requirements: requirements({ languages: ['Arabic'] }) });
  const facts = { name: null, casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null,
    languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };
  const chosen = result.suggested_filters[0];
  assert.deepEqual(candidateSearchMatch(facts, parseCandidateSearch({ [chosen.field]: chosen.value, include_unknown: result.include_unknown })),
    { matched_filter_fields: [], unknown_filter_fields: ['language'] });
  assert.equal(candidateSearchMatch({ ...facts, languages: ['French'] }, { language: 'Arabic', include_unknown: true }), null);
  assert.deepEqual(candidateSearchMatch({ ...facts, languages: ['French'] }, { language: 'French' })?.matched_filter_fields, ['language']);
  assert.deepEqual(candidateSearchMatch(facts, {}), { matched_filter_fields: [], unknown_filter_fields: [] });
});

test('suggestion DTO refuses hidden fields, forged provenance, unsupported filters and unknown-as-match changes', () => {
  const valid = suggestCandidateFilters({ id: 'role', category: null, requirements: requirements({ age_range: '42' }) });
  assert.deepEqual(parseSuggestedCandidateFilters(valid), valid);
  for (const invalid of [ { ...valid, ranking: ['candidate'] }, { ...valid, include_unknown: false },
    { ...valid, suggested_filters: [{ field: 'city', value: 'Cairo', source_field: 'requirements.location' }] },
    { ...valid, suggested_filters: [{ field: 'classification', value: 'Featured', source_field: 'requirements.location' }] },
    { ...valid, suggested_filters: [{ field: 'language', value: 'Arabic', source_field: 'requirements.languages[-1]' }] },
    { ...valid, suggested_filters: [{ ...valid.suggested_filters[0], private_source: 'source text' }] },
  ]) assert.throws(() => parseSuggestedCandidateFilters(invalid));
});

test('suggested supplied gender is exact after case/space normalization, so male never positively matches female', () => {
  const facts = { name: null, casting_id: null, age_or_range: null, stated_gender: 'Female', height_measurements: null,
    languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };
  assert.equal(candidateSearchMatch(facts, { stated_gender: 'male', include_unknown: true }), null);
  assert.deepEqual(candidateSearchMatch(facts, { stated_gender: ' female ' })?.matched_filter_fields, ['stated_gender']);
  assert.deepEqual(candidateSearchMatch({ ...facts, stated_gender: null }, { stated_gender: 'male', include_unknown: true })?.unknown_filter_fields, ['stated_gender']);
  assert.equal(candidateSearchMatch({ ...facts, stated_gender: null }, { stated_gender: 'male', include_unknown: false }), null);
});

test('unambiguous supplied integer ages and ranges overlap conservatively without changing raw facts', () => {
  const facts = { name: null, casting_id: null, age_or_range: '42', stated_gender: null, height_measurements: null,
    languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };
  const before = structuredClone(facts);
  for (const [actual, wanted] of [['42','40–50'], ['40-50','42'], ['40—50','50-55'], ['0','0-1'], ['130','120-130']])
    assert.deepEqual(candidateSearchMatch({ ...facts, age_or_range: actual }, { age_or_range: wanted })?.matched_filter_fields, ['age_or_range']);
  for (const [actual, wanted] of [['52','40–50'], ['40-50','51-55'], ['18','8'], ['130','0-1']])
    assert.equal(candidateSearchMatch({ ...facts, age_or_range: actual }, { age_or_range: wanted, include_unknown: true }), null);
  assert.deepEqual(facts, before);
});

test('ambiguous, reversed, fractional or out-of-bounds ages use literal text; only absent age is unknown', () => {
  const facts = { name: null, casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null,
    languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };
  for (const actual of ['early forties','50-40','42.5','131','-1','forty two'])
    assert.equal(candidateSearchMatch({ ...facts, age_or_range: actual }, { age_or_range: '40-50', include_unknown: true }), null);
  assert.deepEqual(candidateSearchMatch({ ...facts, age_or_range: 'early forties' }, { age_or_range: 'forties' })?.matched_filter_fields, ['age_or_range']);
  assert.deepEqual(candidateSearchMatch({ ...facts, age_or_range: '131' }, { age_or_range: '131' })?.matched_filter_fields, ['age_or_range']);
  assert.deepEqual(candidateSearchMatch(facts, { age_or_range: '40-50' })?.unknown_filter_fields, ['age_or_range']);
});
