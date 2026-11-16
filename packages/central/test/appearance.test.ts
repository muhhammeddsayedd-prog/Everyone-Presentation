import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralAppearance } from '../src/appearance.ts';

// Synthetic RPC responses over a fake transport; no network, database or provider.
const principal = '10000000-0000-4000-8000-000000000001', candidate = '20000000-0000-4000-8000-000000000001', media = '30000000-0000-4000-8000-000000000001', asset = '40000000-0000-4000-8000-000000000001';
const observation = { id: '50000000-0000-4000-8000-000000000001', media_id: media, person_index: 0, position_note: null, attribute: 'hair_colour', suggested_value: 'black', confidence: 'high',
  evidence: 'Visible.', status: 'suggested', override_value: null, effective_value: null, reviewed_by: null, reviewed_at: null, row_version: 1 };
const mediaRow = { id: media, asset_id: asset, source_kind: 'photo', thumb_asset_id: asset, candidate_media_id: null, frame_timestamp_ms: null, media_category: 'headshot', recording_context: 'archive_photo',
  media_added_at: '2026-11-01T00:00:00Z', people_count: 1, ambiguous: false, target_person_index: null, quality_note: null, model: 'm', prompt_version: 'appearance-v1', analyzed_at: '2026-11-02T00:00:00Z', row_version: 1, observations: [observation] };
async function harness(responses: Record<string, unknown>) {
  const calls: { path: string; body: unknown }[] = [];
  const client = createBearerUserClient({ url: 'https://synthetic-appearance.example.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-acting-token' }, { fetch: async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    calls.push({ path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
    return Response.json(responses[url.pathname.split('/').pop()!]);
  } });
  return { api: await createCentralAppearance(client), calls };
}
const acting = { principal_id: principal } as never;
const code = (value: string) => (error: unknown) => error instanceof DomainError && error.code === value;

test('observations, review and facets go through the caller\'s own RPCs with exact shapes', async () => {
  const facets = { total: 1, filters: { facets: {}, include_unknown: false, q: null }, facets: ['talent_type', 'city', 'stated_gender', 'playing_age', 'skin_tone', 'hair_length', 'hair_colour', 'hair_texture', 'facial_hair', 'glasses', 'build', 'languages', 'look', 'tags']
    .map(key => ({ key, matched: 1, unknown: 1, values: [], selected: [] })) };
  const h = await harness({ eps_list_candidate_observations: { data: { candidate_id: candidate, supplied: { archive: null, facts: null }, media: [mediaRow] } },
    eps_review_candidate_observation: { data: { ...observation, status: 'confirmed', effective_value: 'black', reviewed_by: principal, reviewed_at: '2026-11-03T00:00:00Z', row_version: 2 }, changed: true },
    eps_candidate_facets: { data: facets } });
  assert.equal((await h.api.listCandidateObservations(acting, candidate)).media[0].observations[0].suggested_value, 'black');
  assert.equal((await h.api.reviewCandidateObservation(acting, observation.id, { row_version: 1, action: 'confirm' }, { idempotencyKey: 'appearance-review-key-1' })).status, 'confirmed');
  assert.deepEqual(h.calls[1].body, { p_observation_id: observation.id, p_input: { row_version: 1, action: 'confirm' }, p_idempotency_key: 'appearance-review-key-1' });
  assert.equal((await h.api.getCandidateFacets(acting, { facets: { city: ['Dubai'] } })).total, 1);
  assert.deepEqual(h.calls[2].body, { p_filters: { facets: { city: ['Dubai'] }, include_unknown: false } });
});
test('invalid inputs, foreign actors and contract drift are refused', async () => {
  const h = await harness({ eps_list_candidate_observations: { data: { candidate_id: candidate, supplied: { archive: null, facts: null }, media: [{ ...mediaRow, observations: [{ ...observation, attribute: 'ethnicity' }] }] } } });
  await assert.rejects(h.api.listCandidateObservations(acting, candidate), code('CENTRAL_RESPONSE_INVALID'));
  await assert.rejects(h.api.reviewCandidateObservation(acting, observation.id, { row_version: 1, action: 'confirm' }), code('INVALID_REQUEST'));
  await assert.rejects(h.api.getCandidateFacets(acting, { facets: { race: ['x'] } }), code('VALIDATION_FAILED'));
  await assert.rejects(h.api.listCandidateObservations({ principal_id: candidate } as never, candidate), code('ACCESS_DENIED'));
});
