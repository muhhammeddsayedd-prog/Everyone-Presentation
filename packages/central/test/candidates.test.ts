import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DomainError, createManualCandidate } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralCandidates } from '../src/candidates.ts';

const principal = '7aa00000-0000-4000-8000-000000000001'; const actor = { principal_id: principal };
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated' })).toString('base64url')}.synthetic`;
const facts = { name: null, casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null, languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };
const full = createManualCandidate({ id: '7ca00000-0000-4000-8000-000000000001', facts, castingId: 'EPS-SYNTHETIC', actorId: principal, now: '2026-10-29T09:00:00.000Z' });
const dto = () => Object.fromEntries(Object.entries(full).filter(([key]) => !['source_kind', 'field_sources', 'reviewed_facts_fingerprint', 'age_as_of'].includes(key)));
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;
function fixture(response: unknown | ((name: string) => unknown) = dto()) {
  const calls: { name: string; input: Record<string, unknown>; headers: Headers }[] = [];
  const fetcher: typeof fetch = async (supplied, init) => {
    const url = new URL(typeof supplied === 'string' ? supplied : supplied instanceof URL ? supplied.href : supplied.url);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', is_anonymous: false });
    const name = url.pathname.split('/').at(-1)!; const input = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ name, input, headers: new Headers(init?.headers) });
    return Response.json(typeof response === 'function' ? response(name) : response);
  };
  const client = createBearerUserClient({ url: 'https://synthetic-cast.example.invalid', publishableKey: 'sb_publishable_synthetic-cast', accessToken: token }, { fetch: fetcher });
  return { client, calls };
}
test('candidate adapter uses verified actor, strict shared parsers and stable idempotency/trace metadata', async () => {
  const value = fixture(); const service = await createCentralCandidates(value.client);
  const saved = await service.createCandidate(actor, { facts }, { idempotencyKey: 'synthetic-create-candidate', requestId: 'synthetic-candidate-request', clientType: 'mcp' });
  assert.equal(saved.review_status, 'unreviewed');
  assert.deepEqual(value.calls[0].input, { p_input: { facts }, p_idempotency_key: 'synthetic-create-candidate' });
  assert.equal(value.calls[0].headers.get('X-EPS-Client-Type'), 'mcp');
  assert.equal(value.calls[0].headers.get('X-EPS-Request-ID'), 'synthetic-candidate-request');
  await assert.rejects(service.createCandidate(actor, { facts }, {}), code('INVALID_REQUEST'));
  await assert.rejects(service.getCandidate({ principal_id: 'different' }, saved.id), code('ACCESS_DENIED'));
  assert.equal(value.calls.length, 1);
});
test('search validates unknown controls and rejects malformed or hidden-field central results', async () => {
  const value = fixture({ data: [dto()], page: { next_cursor: 'opaque-filter-bound-cursor' } }); const service = await createCentralCandidates(value.client);
  assert.equal((await service.searchCandidates(actor, { limit: 1, include_unknown: false, language: 'Arabic' })).data.length, 1);
  assert.deepEqual(value.calls[0].input, { p_search: { limit: 1, include_unknown: false, language: 'Arabic' } });
  await assert.rejects(service.searchCandidates(actor, { include_unknown: 'false' } as never), code('VALIDATION_FAILED'));
  const bad = await createCentralCandidates(fixture({ ...dto(), field_sources: { secret: 'must not cross DTO' } }).client);
  await assert.rejects(bad.getCandidate(actor, full.id), code('CENTRAL_RESPONSE_INVALID'));
  const wrongMedia = await createCentralCandidates(fixture([{ id: 'media', candidate_id: 'other', source_asset_id: 'source', preview_asset_id: null, transcript_asset_id: null, original_transcript: null, languages: [], available_frames: [], selected_frame_asset_ids: [], processing_issues: [], row_version: 1 }]).client);
  await assert.rejects(wrongMedia.getCandidateMedia(actor, full.id), code('CENTRAL_RESPONSE_INVALID'));
});
test('media exposes only fixed technical issue codes and rejects raw provider diagnostic strings', async () => {
  const item = { id: 'media', candidate_id: full.id, source_asset_id: 'source', preview_asset_id: null, transcript_asset_id: null, original_transcript: 'Preserved original transcript.', languages: [], available_frames: [], selected_frame_asset_ids: [], processing_issues: ['EXTRACTION_FAILED','INSUFFICIENT_FRAMES','FRAME_SELECTION_UNAVAILABLE'], row_version: 1 };
  const service = await createCentralCandidates(fixture([item]).client);
  assert.deepEqual((await service.getCandidateMedia(actor, full.id)).data[0].processing_issues, item.processing_issues);
  const bad = await createCentralCandidates(fixture([{ ...item, processing_issues: ['raw-private-provider-error'] }]).client);
  await assert.rejects(bad.getCandidateMedia(actor, full.id), code('CENTRAL_RESPONSE_INVALID'));
});

test('English media projection is optional for legacy responses and complete or absent for new responses', async () => {
  const legacy = { id: 'media', candidate_id: full.id, source_asset_id: 'source', preview_asset_id: null,
    transcript_asset_id: null, original_transcript: 'Original source retained privately.', languages: ['Arabic'],
    available_frames: [], selected_frame_asset_ids: [], processing_issues: [], row_version: 1 };
  for (const projection of [undefined, { english_transcript: 'My name is a synthetic actor.', english_transcript_status: 'available' },
    { english_transcript: null, english_transcript_status: 'unavailable' }, { english_transcript: null, english_transcript_status: 'not_captured' }]) {
    const item = { ...legacy, ...projection };
    const service = await createCentralCandidates(fixture([item]).client);
    assert.deepEqual((await service.getCandidateMedia(actor, full.id)).data[0], item);
  }
  for (const projection of [{ english_transcript_status: 'available' }, { english_transcript: 'Incomplete' },
    { english_transcript: null, english_transcript_status: 'available' },
    { english_transcript: 'Must not be a fallback', english_transcript_status: 'not_captured' },
    { english_transcript: '\u0639\u0631\u0628\u064a', english_transcript_status: 'available' }]) {
    const service = await createCentralCandidates(fixture([{ ...legacy, ...projection }]).client);
    await assert.rejects(service.getCandidateMedia(actor, full.id), code('CENTRAL_RESPONSE_INVALID'));
  }
  const service = await createCentralCandidates(fixture([{ ...legacy, english_transcript: null,
    english_transcript_status: 'unavailable', processing_issues: ['ENGLISH_TRANSCRIPT_UNAVAILABLE'] }]).client);
  assert.deepEqual((await service.getCandidateMedia(actor, full.id)).data[0].processing_issues, ['ENGLISH_TRANSCRIPT_UNAVAILABLE']);
});
test('pool and duplicate operations preserve resource scope and require explicit merge version', async () => {
  const pool = { id: 'pool', workspace_id: 'workspace', candidate_id: full.id, selected_candidate_media_id: null, selected_frame_asset_ids: [], availability: 'Friday', fresh_material_required: false, media_confirmed: false, internal_notes: null, row_version: 1 };
  const value = fixture(pool); const service = await createCentralCandidates(value.client);
  assert.deepEqual(await service.addWorkspaceCandidate(actor, 'workspace', { candidate_id: full.id, availability: 'Friday' }, { idempotencyKey: 'synthetic-add-project' }), pool);
  assert.equal(value.calls[0].input.p_workspace_id, 'workspace');
  await assert.rejects(service.resolveCandidateDuplicate(actor, full.id, { row_version: 1, action: 'link_existing', existing_candidate_id: 'other' } as never, { idempotencyKey: 'synthetic-link-profile' }), code('VALIDATION_FAILED'));
  assert.equal(value.calls.length, 1);
});
test('retained archived/linked profiles remain readable while archive reasons cross the published boundary', async () => {
  const retained = { ...dto(), archived: true, merged_into_candidate_id: 'canonical-existing' };
  const value = fixture((name: string) => name === 'eps_archive_candidate' ? { success: true, affected_ids: [full.id] } : retained);
  const service = await createCentralCandidates(value.client);
  assert.equal((await service.getCandidate(actor, full.id)).archived, true);
  await service.archiveCandidate(actor, full.id, { row_version: 1, reason: '  Original source retained  ' }, { idempotencyKey: 'synthetic-archive-with-reason' });
  assert.deepEqual(value.calls[1].input.p_input, { row_version: 1, reason: 'Original source retained' });
  await assert.rejects(service.archiveCandidate(actor, full.id, { row_version: 1, reason: 42 } as never, { idempotencyKey: 'synthetic-invalid-reason' }), code('INVALID_REQUEST'));
});
