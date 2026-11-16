import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { APPEARANCE_ATTRIBUTES, APPEARANCE_TAXONOMY, FACET_KEYS, appearanceValues, facetFiltersFromSearchParams, facetFiltersToSearchParams, hairColourFamily,
  isAppearanceValue, isForbiddenAttribute, isTagFacetAllowed, normalizeAppearanceLabel, normalizeAppearancePhrase, normalizeSearchText, parseEnrichmentBatchStart, parseFacetFilters,
  parseObservationReview, effectiveObservationValue } from '../../packages/domain/src/appearance.ts';
import { DomainError } from '../../packages/domain/src/types.ts';

const migration = readFileSync(new URL('../../supabase/migrations/20261116140000_m20_appearance_observations.sql', import.meta.url), 'utf8');
function sqlJson(name: string) {
  const match = new RegExp(`create function eps\\.${name}\\(\\) returns jsonb language sql immutable set search_path='' as \\$\\$select '([\\s\\S]*?)'::jsonb\\$\\$;`, 'u').exec(migration);
  assert.ok(match, name); return JSON.parse(match[1]) as Record<string, unknown>;
}

test('SQL vocabulary is exactly the taxonomy contract', () => {
  assert.deepEqual(sqlJson('appearance_vocabulary'), Object.fromEntries(APPEARANCE_ATTRIBUTES.map(attribute => [attribute, appearanceValues(attribute)])));
  const facets = /appearance_facet_keys_allowed\(\) returns text\[\] language sql immutable set search_path='' as \$\$\n select array\[([^\]]+)\]/u.exec(migration);
  assert.deepEqual(facets?.[1].split(',').map(value => value.replace(/'/gu, '')), [...FACET_KEYS]);
});
test('SQL supplied-label map agrees with taxonomy aliases', () => {
  const map = sqlJson('appearance_supplied_map') as Record<string, Record<string, string>>;
  for (const [attribute, labels] of Object.entries(map)) for (const [label, key] of Object.entries(labels)) {
    assert.equal(normalizeAppearanceLabel(attribute, label), key, `${attribute}:${label}`);
  }
  // Every closed m09 label list maps to a key.
  for (const label of ['Short', 'Shoulder Length', 'Long']) assert.ok(map.hair_length[label.toLowerCase()]);
  for (const label of ['Curly', 'Wavy', 'Straight', 'Afro']) assert.ok(map.hair_texture[label.toLowerCase()]);
  for (const label of ['Dark', 'Black', 'Brown', 'Dark Brown', 'Light Brown', 'Blonde', 'Auburn', 'Red', 'Ginger', 'Grey', 'White']) assert.ok(map.hair_colour[label.toLowerCase()], label);
  for (const label of ['Baby', 'Kids', 'Child', 'Teen 13-17', 'Age 18-24', 'Age 25-34', 'Age 35-44', 'Age 45-54', 'Age 55-64', 'Age 65+']) assert.ok(map.playing_age[label.toLowerCase()], label);
});
test('taxonomy is closed, neutral and never names a forbidden attribute', () => {
  for (const attribute of APPEARANCE_ATTRIBUTES) assert.equal(isForbiddenAttribute(attribute), false, attribute);
  for (const name of ['ethnicity', 'Race', 'nationality', 'religion', 'gender identity', 'passport', 'city', 'skills', 'look']) assert.equal(isForbiddenAttribute(name), true, name);
  const labels = JSON.stringify(APPEARANCE_TAXONOMY.attributes).toLowerCase();
  for (const word of ['ethnic', 'arab', 'african', 'asian', 'european', 'muslim', 'christian', 'hijab', 'nationality']) assert.equal(labels.includes(`"${word}`), false, word);
  assert.equal(isAppearanceValue('hair_colour', 'unknown'), true);
  assert.equal(isAppearanceValue('hair_colour', 'purple'), false);
  assert.equal(isAppearanceValue('ethnicity', 'unknown'), false);
});
test('phrases normalise to attribute keys with context', () => {
  assert.deepEqual(normalizeAppearancePhrase('long dark hair'), { hair_length: 'long', hair_colour: 'dark' });
  assert.deepEqual(normalizeAppearancePhrase('Short dark-brown curly hair, glasses and a beard'), { hair_length: 'short', hair_colour: 'dark_brown', hair_texture: 'curly', facial_hair: 'beard', glasses: 'glasses' });
  assert.deepEqual(normalizeAppearancePhrase('wears a long coat in dark light'), {}, 'no hair context, no hair attributes');
  assert.deepEqual(normalizeAppearancePhrase('blonde, slim, sunglasses'), { hair_colour: 'blonde', build: 'slim', glasses: 'sunglasses' });
  assert.deepEqual(hairColourFamily('dark'), ['black', 'dark', 'dark_brown']);
  assert.equal(normalizeAppearanceLabel('hair_texture', 'Afro'), 'coily');
  assert.equal(normalizeAppearanceLabel('skin_tone', 'Olive'), 'medium');
  assert.equal(normalizeAppearanceLabel('skin_tone', 'Mediterranean'), null);
});
test('Arabic and Latin search normalisation matches the SQL rule', () => {
  assert.equal(normalizeSearchText('  أَحْمَد  '), 'احمد');
  assert.equal(normalizeSearchText('مـــصطفى'), 'مصطفي');
  assert.equal(normalizeSearchText('إيمان'), 'ايمان');
  assert.equal(normalizeSearchText('  Dubai   Marina '), 'dubai marina');
  assert.equal(normalizeSearchText('  '), null);
});
test('facet filters round-trip through URL params and reject unsupported facets', () => {
  const filters = parseFacetFilters({ facets: { hair_colour: ['black', 'dark', 'black'], city: ['دبي'], glasses: [] }, include_unknown: true });
  assert.deepEqual(filters, { facets: { hair_colour: ['black', 'dark'], city: ['دبي'] }, include_unknown: true });
  const params = facetFiltersToSearchParams(filters, new URLSearchParams('q=sara'));
  assert.equal(params.toString(), 'q=sara&facet=city%3A%D8%AF%D8%A8%D9%8A&facet=hair_colour%3Ablack&facet=hair_colour%3Adark&include_unknown=true');
  assert.deepEqual(facetFiltersFromSearchParams(params), filters);
  const code = (value: string) => (error: unknown) => error instanceof DomainError && error.code === value;
  assert.throws(() => parseFacetFilters({ facets: { ethnicity: ['x'] } }), code('VALIDATION_FAILED'));
  assert.throws(() => parseFacetFilters({ facets: {}, extra: true }), code('VALIDATION_FAILED'));
  assert.throws(() => parseObservationReview({ row_version: 1, action: 'override' }), code('VALIDATION_FAILED'));
  assert.deepEqual(parseObservationReview({ row_version: 2, action: 'override', value: 'beard' }), { row_version: 2, action: 'override', value: 'beard' });
  assert.throws(() => parseEnrichmentBatchStart({ workspace_id: '10000000-0000-4000-8000-000000000001', limit: 5, spend_cap_cents: 10 }), code('VALIDATION_FAILED'));
  assert.equal(parseEnrichmentBatchStart({ workspace_id: '10000000-0000-4000-8000-000000000001', filters: { facets: { city: ['x'] } }, limit: 5, spend_cap_cents: 10 }).filters?.include_unknown, false);
  assert.equal(effectiveObservationValue({ status: 'suggested', suggested_value: 'black', override_value: null }), null);
  assert.equal(effectiveObservationValue({ status: 'overridden', suggested_value: 'black', override_value: 'brown' }), 'brown');
});
test('generated TypeScript taxonomy (sealed into worker images) equals the JSON contract', async () => {
  const { APPEARANCE_TAXONOMY_SOURCE } = await import('../../packages/domain/src/appearance-taxonomy.ts');
  assert.deepEqual(APPEARANCE_TAXONOMY_SOURCE, JSON.parse(readFileSync(new URL('../../contracts/appearance-taxonomy.json', import.meta.url), 'utf8')));
  const sqlTerms = /appearance_forbidden_terms\(\) returns text\[\] language sql immutable set search_path='' as \$\$select array\[([^\]]+)\]/u.exec(migration)![1].split(',').map(term => term.slice(1, -1).replace(/''/gu, "'"));
  assert.deepEqual(sqlTerms, [...APPEARANCE_TAXONOMY_SOURCE.forbidden_terms]);
});
test('look, nationality and country labels are never facets; screened archive tags never become facet keys', async () => {
  for (const key of FACET_KEYS) assert.equal(isForbiddenAttribute(key) && !['city', 'languages'].includes(key), false, key);
  for (const key of ['look', 'regional_look', 'nationality', 'country']) assert.equal(FACET_KEYS.includes(key), false, key);
  assert.equal(migration.includes("'look:'"), false, 'the projection never builds look facet keys');
  for (const tag of ['European Look', 'Middle Eastern Look', 'Gulf Look', 'Model Look', 'Saudi Lookalikes', 'Khaleeji', 'Emirati', 'Kuwaiti', 'Arab', 'خليجي', 'مظهر اوروبي', 'look-alike'])
    assert.equal(isTagFacetAllowed(tag), false, tag);
  for (const tag of ['Dancer', ' DANCER ', 'رقص', 'Voice over', 'Lookout tower']) assert.equal(isTagFacetAllowed(tag), true, tag);
  assert.equal(isTagFacetAllowed('Sudan', 'Sudan', null), false, 'supplied nationality');
  assert.equal(isTagFacetAllowed('Oman', null, ' oman '), false, 'supplied country');
  const { createAppearanceFixture } = await import('../../packages/domain/src/appearance-fixture.ts');
  const facets = await createAppearanceFixture().getCandidateFacets({ principal_id: 'a4f00000-0000-4000-8000-0000000000aa' } as never, {});
  const tags = facets.facets.find(facet => facet.key === 'tags')!.values.map(value => value.value);
  assert.deepEqual(tags, ['dancer']);
  assert.equal(facets.facets.some(facet => facet.key === 'look'), false);
  assert.throws(() => parseFacetFilters({ facets: { look: ['european look'] } }));
});
test('fixture review records the Idempotency-Key: same key and body replays, a different body is refused', async () => {
  const { createAppearanceFixture } = await import('../../packages/domain/src/appearance-fixture.ts');
  const fixture = createAppearanceFixture(); const actor = { principal_id: 'a4f00000-0000-4000-8000-0000000000aa' } as never;
  const listed = await fixture.listCandidateObservations(actor, 'a4f00000-0000-4000-8000-000000000002');
  const observation = listed.media[0].observations.find(o => o.attribute === 'facial_hair')!;
  const context = { idempotencyKey: 'fixture-review-key-0001' };
  const first = await fixture.reviewCandidateObservation(actor, observation.id, { row_version: observation.row_version, action: 'confirm' }, context);
  assert.equal(first.status, 'confirmed');
  assert.deepEqual(await fixture.reviewCandidateObservation(actor, observation.id, { row_version: observation.row_version, action: 'confirm' }, context), first);
  await assert.rejects(fixture.reviewCandidateObservation(actor, observation.id, { row_version: first.row_version, action: 'reject' }, context),
    (error: unknown) => (error as { code?: string }).code === 'IDEMPOTENCY_KEY_REUSED');
});
