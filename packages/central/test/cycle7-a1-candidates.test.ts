import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DomainError, createManualCandidate } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralCandidates } from '../src/candidates.ts';
import { createCentralJobs } from '../src/jobs.ts';
import { centralRpcError } from '../src/errors.ts';

// Cycle 7 A1: library rows, idempotent membership, picture fields, uploads list, media repairs, job candidate_result.
const principal = '7aa10000-0000-4000-8000-000000000001'; const actor = { principal_id: principal };
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated' })).toString('base64url')}.synthetic`;
const facts = { name: 'Synthetic Person', casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null, languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };
const full = createManualCandidate({ id: '7ca10000-0000-4000-8000-000000000001', facts, castingId: 'EPS-A1', actorId: principal, now: '2026-11-16T09:00:00.000Z' });
const profile = Object.fromEntries(Object.entries(full).filter(([key]) => !['source_kind', 'field_sources', 'reviewed_facts_fingerprint', 'age_as_of'].includes(key)));
const library = { ...profile, name_ar: 'شخص', talent_type: 'talent', tape_count: 2, portrait_photo: { photo_id: 'photo', asset_id: 'photo-asset', thumb_asset_id: 'photo-thumb' },
  portrait_frame_asset_id: null, processing: false, membership: { workspace_candidate_id: 'pool', state: 'in_project' } };
const pool = { id: 'pool', workspace_id: 'workspace', candidate_id: full.id, selected_candidate_media_id: 'media', selected_frame_asset_ids: ['frame'], availability: null,
  fresh_material_required: false, media_confirmed: false, internal_notes: null, portrait_asset_id: 'frame', portrait_source: 'frame', portrait_crop: { focal_x: 0.5, focal_y: 0.4 },
  media_selection_state: 'pinned', row_version: 1 };
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;
function fixture(response: unknown | ((name: string) => unknown)) {
  const calls: { name: string; input: Record<string, unknown> }[] = [];
  const fetcher: typeof fetch = async (supplied, init) => {
    const url = new URL(typeof supplied === 'string' ? supplied : supplied instanceof URL ? supplied.href : supplied.url);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', is_anonymous: false });
    const name = url.pathname.split('/').at(-1)!; calls.push({ name, input: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return Response.json(typeof response === 'function' ? response(name) : response);
  };
  return { client: createBearerUserClient({ url: 'https://synthetic-a1.example.invalid', publishableKey: 'sb_publishable_synthetic-a1', accessToken: token }, { fetch: fetcher }), calls };
}

test('an old add key after removal is 409 MEMBERSHIP_REMOVED naming only the removed row', async () => {
  const removedId = '7ca10000-0000-4000-8000-0000000000aa';
  const fetcher: typeof fetch = async supplied => {
    const url = new URL(typeof supplied === 'string' ? supplied : supplied instanceof URL ? supplied.href : supplied.url);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', is_anonymous: false });
    return Response.json({ code: 'P0001', message: 'MEMBERSHIP_REMOVED', hint: null,
      details: JSON.stringify({ message: 'raw', status: 409, removed_workspace_candidate_id: removedId, private: 'PRIVATE_RAW_DIAGNOSTIC' }) }, { status: 400 });
  };
  const service = await createCentralCandidates(createBearerUserClient({ url: 'https://synthetic-a1.example.invalid', publishableKey: 'sb_publishable_synthetic-a1', accessToken: token }, { fetch: fetcher }));
  await assert.rejects(service.addWorkspaceCandidate(actor, 'workspace', { candidate_id: full.id }, { idempotencyKey: 'synthetic-add-a1-0009' }), (error: unknown) =>
    error instanceof DomainError && error.code === 'MEMBERSHIP_REMOVED' && error.status === 409
    && JSON.stringify(error.details) === JSON.stringify({ removed_workspace_candidate_id: removedId }) && !JSON.stringify(error).includes('PRIVATE'));
});

test('library search sends workspace_id and accepts only well-formed card fields', async () => {
  const value = fixture({ data: [library], page: { next_cursor: 'eyJ2IjoyfQ==' } });
  const service = await createCentralCandidates(value.client);
  const result = await service.searchCandidates(actor, { q: 'Synthetic', workspace_id: 'workspace', limit: 10 });
  assert.equal(result.data[0].membership?.workspace_candidate_id, 'pool');
  assert.equal(result.data[0].name_ar, 'شخص');
  assert.deepEqual(value.calls[0].input, { p_search: { q: 'Synthetic', workspace_id: 'workspace', limit: 10 } });
  for (const broken of [{ ...library, membership: { workspace_candidate_id: 'pool', state: 'maybe' } }, { ...library, tape_count: -1 }, { ...library, talent_type: 'star' },
    { ...library, processing: 'no' }, Object.fromEntries(Object.entries(library).filter(([key]) => key !== 'membership'))]) {
    const bad = await createCentralCandidates(fixture({ data: [broken], page: { next_cursor: null } }).client);
    await assert.rejects(bad.searchCandidates(actor, {}), code('CENTRAL_RESPONSE_INVALID'));
  }
});

test('add returns already_member without a conflict; picture fields are validated before the call', async () => {
  const value = fixture({ ...pool, already_member: true });
  const service = await createCentralCandidates(value.client);
  const added = await service.addWorkspaceCandidate(actor, 'workspace', { candidate_id: full.id }, { idempotencyKey: 'synthetic-add-a1-0001' });
  assert.equal(added.already_member, true); assert.equal(added.portrait_source, 'frame');
  for (const input of [{ candidate_id: full.id, portrait_asset_id: 'frame' }, { candidate_id: full.id, portrait_source: 'frame' },
    { candidate_id: full.id, portrait_asset_id: 'frame', portrait_source: 'video' }, { candidate_id: full.id, media_selection_state: 'unset' },
    { candidate_id: full.id, portrait_crop: { focal_x: 2, focal_y: 0 } }, { candidate_id: full.id, portrait_crop: { focal_x: 0.5, focal_y: 0.5, rect: { x: 0, y: 0, width: 1, height: 1 } } },
    { candidate_id: full.id, media_selection_state: 'intentionally_empty', portrait_asset_id: 'frame', portrait_source: 'frame' }]) {
    await assert.rejects(service.addWorkspaceCandidate(actor, 'workspace', input as never, { idempotencyKey: 'synthetic-add-a1-0002' }), code('VALIDATION_FAILED'));
  }
  assert.equal(value.calls.length, 1);
  const missingFlag = await createCentralCandidates(fixture(pool).client);
  await assert.rejects(missingFlag.addWorkspaceCandidate(actor, 'workspace', { candidate_id: full.id }, { idempotencyKey: 'synthetic-add-a1-0003' }), code('CENTRAL_RESPONSE_INVALID'));
  const inconsistent = await createCentralCandidates(fixture({ ...pool, media_selection_state: 'intentionally_empty' }).client);
  await assert.rejects(inconsistent.updateWorkspaceCandidate(actor, 'pool', { row_version: 1 }, { idempotencyKey: 'synthetic-upd-a1-0001' }), code('CENTRAL_RESPONSE_INVALID'));
});

test('project list accepts the versioned base64 cursor and rejects other shapes before the call', async () => {
  const value = fixture({ data: [pool], page: { next_cursor: null } });
  const service = await createCentralCandidates(value.client);
  const cursor = Buffer.from(JSON.stringify({ v: 2, c: '2026-11-16T09:00:00+00:00', i: full.id, q: '0'.repeat(32) })).toString('base64');
  await service.listWorkspaceCandidates(actor, 'workspace', { cursor, limit: 2 });
  assert.equal(value.calls[0].input.p_cursor, cursor);
  await assert.rejects(service.listWorkspaceCandidates(actor, 'workspace', { cursor: 'not a cursor!' }), code('INVALID_REQUEST'));
  const mapped = centralRpcError({ code: 'P0001', message: 'INVALID_CURSOR', details: '{"status":400}' });
  assert.equal(mapped.code, 'INVALID_CURSOR'); assert.equal(mapped.status, 400);
});

test('uploads list, repair suggestion and repair result keep their published shapes', async () => {
  const row = { upload_id: 'upload', workspace_id: 'workspace', asset_id: 'asset', filename: 'intro.mp4', size_bytes: 1000, mime_type: 'video/mp4', target_candidate_id: null,
    created_at: '2026-11-16T09:00:00Z', upload_status: 'completed', state: 'ready', job: { id: 'job', status: 'succeeded', stage: 'apply_candidate', error_code: null, retryable: false, row_version: 4, updated_at: '2026-11-16T09:05:00Z' },
    candidate_id: full.id, workspace_candidate_id: 'pool' };
  const responses: Record<string, unknown> = {
    eps_list_workspace_uploads: { data: [row], page: { next_cursor: null } },
    eps_suggest_media_repairs: { data: [{ workspace_candidate_id: 'pool', candidate_id: full.id, row_version: 1, reason: 'default_available',
      suggestion: { selected_candidate_media_id: 'media', selected_frame_asset_ids: ['frame'], portrait_asset_id: 'frame', portrait_source: 'frame' } }], has_more: false },
    eps_apply_media_repairs: { applied: [pool], skipped: [{ workspace_candidate_id: 'other', reason: 'changed', current_row_version: 3 }] },
  };
  const value = fixture((name: string) => responses[name]);
  const service = await createCentralCandidates(value.client);
  assert.deepEqual((await service.listWorkspaceUploads(actor, 'workspace', { limit: 5 })).data[0], row);
  assert.equal((await service.suggestMediaRepairs(actor, 'workspace')).data[0].reason, 'default_available');
  const applied = await service.applyMediaRepairs(actor, 'workspace', { items: [{ workspace_candidate_id: 'pool', row_version: 1 }, { workspace_candidate_id: 'other', row_version: 2 }] }, { idempotencyKey: 'synthetic-repair-a1-01' });
  assert.equal(applied.skipped[0].reason, 'changed');
  await assert.rejects(service.applyMediaRepairs(actor, 'workspace', { items: [{ workspace_candidate_id: 'pool', row_version: 1 }, { workspace_candidate_id: 'pool', row_version: 1 }] }, { idempotencyKey: 'synthetic-repair-a1-02' }), code('VALIDATION_FAILED'));
  await assert.rejects(service.applyMediaRepairs(actor, 'workspace', { items: [] }, { idempotencyKey: 'synthetic-repair-a1-03' }), code('VALIDATION_FAILED'));
  const broken = await createCentralCandidates(fixture({ data: [{ ...row, state: 'done' }], page: { next_cursor: null } }).client);
  await assert.rejects(broken.listWorkspaceUploads(actor, 'workspace'), code('CENTRAL_RESPONSE_INVALID'));
});

test('a succeeded candidate job exposes candidate_result; other kinds may not carry it', async () => {
  const base = { id: 'job', workspace_id: 'workspace', kind: 'candidate_scan', status: 'succeeded', stage: 'apply_candidate', attempt: 1, progress_completed: 0, progress_total: null,
    batch_id: null, input_asset_id: 'asset', resource_id: 'upload', error: null, created_at: '2026-11-16T09:00:00Z', updated_at: '2026-11-16T09:01:00Z', row_version: 5,
    candidate_result: { candidate_id: full.id, candidate_media_id: 'media', workspace_candidate_id: 'pool' } };
  const jobs = await createCentralJobs(fixture(base).client);
  assert.equal((await jobs.getJob(actor, 'job')).candidate_result?.workspace_candidate_id, 'pool');
  for (const broken of [{ ...base, status: 'running' }, { ...base, kind: 'specs_extract', stage: 'apply_specs' }, { ...base, candidate_result: { candidate_id: full.id } }]) {
    const other = await createCentralJobs(fixture(broken).client);
    await assert.rejects(other.getJob(actor, 'job'), code('CENTRAL_RESPONSE_INVALID'));
  }
});
