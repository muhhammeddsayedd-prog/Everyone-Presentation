import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralJobs } from '../src/jobs.ts';

const principal = 'a1111111-1111-4111-8111-111111111111';
const jobId = 'a2222222-2222-4222-8222-222222222222';
const workspace = 'a3333333-3333-4333-8333-333333333333';
const actor = { principal_id: principal };
const config = { url: 'https://synthetic-jobs.example.invalid', publishableKey: 'sb_publishable_synthetic-test-key' };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated' })).toString('base64url')}.synthetic`;
const job = { id: jobId, workspace_id: workspace, kind: 'specs_extract', status: 'queued', stage: 'prepare_document', attempt: 0,
  progress_completed: 0, progress_total: null, batch_id: null, input_asset_id: null, resource_id: null, error: null,
  created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z', row_version: 1 };
function service(response: unknown = job, status = 200) {
  const calls: { path: string; body: Record<string, unknown>; headers: Headers }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
    calls.push({ path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : {}, headers: new Headers(init?.headers) });
    if (path === '/auth/v1/user') return Response.json({ id: principal, email: 'jobs@example.invalid', email_confirmed_at: '2026-10-28T00:00:00Z',
      role: 'authenticated', aud: 'authenticated', is_anonymous: false, app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-10-28T00:00:00Z' });
    return Response.json(response, { status });
  };
  return { calls, client: createBearerUserClient({ ...config, accessToken: token }, { fetch: fetcher }) };
}
const code = (expected: string) => (value: unknown) => value instanceof DomainError && value.code === expected;

test('batch job listing uses one distinct RPC and preserves legacy unfiltered RPC and page shape', async () => {
  const batch = 'b8380001-0000-4000-8000-000000000001';
  const fixture = service({ data: [{ ...job, batch_id: batch }], page: { next_cursor: jobId } });
  const jobs = await createCentralJobs(fixture.client);
  const result = await jobs.listJobs(actor, { workspace_id: workspace, status: 'queued', cursor: jobId, limit: 1, batch_id: batch });
  assert.deepEqual(result, { data: [{ ...job, batch_id: batch }], page: { next_cursor: jobId } });
  assert.equal(fixture.calls[1]!.path, '/rest/v1/rpc/eps_list_jobs_by_batch');
  assert.deepEqual(fixture.calls[1]!.body, { p_workspace_id: workspace, p_status: 'queued', p_cursor: jobId, p_limit: 1, p_batch_id: batch });
  await jobs.listJobs(actor);
  assert.equal(fixture.calls[2]!.path, '/rest/v1/rpc/eps_list_jobs');
  assert.deepEqual(fixture.calls[2]!.body, { p_workspace_id: null, p_status: null, p_cursor: null, p_limit: 25 });
  const calls = fixture.calls.length;
  await assert.rejects(jobs.listJobs(actor, { batch_id: 'not-a-uuid' }), code('INVALID_REQUEST'));
  await assert.rejects(jobs.listJobs({ principal_id: 'foreign' }, { batch_id: batch }), code('ACCESS_DENIED'));
  assert.equal(fixture.calls.length, calls);
  const mismatch = service({ data: [job], page: { next_cursor: null } });
  await assert.rejects((await createCentralJobs(mismatch.client)).listJobs(actor, { batch_id: batch }), code('CENTRAL_RESPONSE_INVALID'));
});

test('unreadable source DTO gives safe replacement or manual-information guidance with retry policy intact', async () => {
  const row = { ...job, kind: 'candidate_scan', status: 'failed', stage: 'prepare_candidate',
    error: { code: 'SOURCE_UNREADABLE', message: 'private-provider-diagnostic https://private.invalid?token=secret', details: { cause_code: 'SOURCE_UNREADABLE' }, retryable: false } };
  const fixture = service(row); const result = await (await createCentralJobs(fixture.client)).getJob(actor, jobId);
  assert.equal(result.error!.message, 'The supplied source could not be read. Replace it with a valid supported file, or enter the available information manually.');
  assert.equal(result.error!.retryable, false); assert.equal(result.status, 'failed');
  assert.deepEqual(result.error!.details, { cause_code: 'SOURCE_UNREADABLE' });
  assert.doesNotMatch(JSON.stringify(result), /private-provider|private\.invalid|token=secret/u);
  const bad = service({ ...row, error: { ...row.error, details: { source_url: 'https://private.invalid?token=secret' } } });
  await assert.rejects((await createCentralJobs(bad.client)).getJob(actor, jobId), code('CENTRAL_RESPONSE_INVALID'));
});
test('review-fit and suggestion jobs retain the same bounded public polling contract', async () => {
  for (const kind of ['review_fit', 'ai_suggestion']) {
    const row = { ...job, kind, stage: kind === 'review_fit' ? 'measure_review_fit' : 'prepare_suggestion', resource_id: 'synthetic-resource' };
    const fixture = service(row); const jobs = await createCentralJobs(fixture.client);
    assert.deepEqual(await jobs.getJob(actor, jobId), row);
  }
});
test('presentation jobs expose explicit current-authority actions independent of their lifetime attempt count', async () => {
  for (const kind of ['presentation_render', 'presentation_export']) {
    const row = { ...job, kind, status: 'failed', stage: kind === 'presentation_render' ? 'render_presentation' : 'render_export', attempt: 10, resource_id: 'synthetic-version', can_retry: true, can_cancel: false,
      error: { code: 'PDF_RENDER_FAILED', message: 'Must be replaced by the fixed safe message', details: {}, retryable: false } };
    const fixture = service(row); const result = await (await createCentralJobs(fixture.client)).getJob(actor, jobId);
    assert.equal(result.can_retry, true); assert.equal(result.can_cancel, false); assert.equal(result.attempt, 10);
    assert.equal(result.error!.message, 'The fixed-version PDF could not be rendered. Retry uses the same captured content.');
    for (const bad of [{ ...row, can_cancel: true }, { ...row, status: 'succeeded', error: null }, { ...row, kind: 'specs_extract' },
      { ...row, error: { ...row.error, code: 'JOB_CANCELLED' } }]) {
      const h = service(bad); await assert.rejects((await createCentralJobs(h.client)).getJob(actor, jobId), code('CENTRAL_RESPONSE_INVALID'));
    }
    const missing: Record<string, unknown> = { ...row }; delete missing.can_retry; delete missing.can_cancel;
    const h = service(missing); await assert.rejects((await createCentralJobs(h.client)).getJob(actor, jobId), code('CENTRAL_RESPONSE_INVALID'));
  }
});
test('mixed job pages accept M06 export action fields while preserving current authority and terminal states', async () => {
  const exports = [
    { ...job, id: 'export-queued', kind: 'presentation_export', stage: 'render_export', can_retry: false, can_cancel: false },
    { ...job, id: 'export-running', kind: 'presentation_export', stage: 'render_export', status: 'running', can_retry: false, can_cancel: true },
    { ...job, id: 'export-failed', kind: 'presentation_export', stage: 'render_export', status: 'failed', can_retry: false, can_cancel: false,
      error: { code: 'PDF_RENDER_FAILED', message: 'A bounded diagnostic', details: {}, retryable: true } },
    { ...job, id: 'export-ready', kind: 'presentation_export', stage: 'render_export', status: 'succeeded', can_retry: false, can_cancel: false },
    { ...job, id: 'export-cancelled', kind: 'presentation_export', stage: 'render_export', status: 'cancelled', can_retry: false, can_cancel: false },
  ];
  const rows = [job, { ...job, id: 'render-queued', kind: 'presentation_render', can_retry: false, can_cancel: false }, ...exports];
  const fixture = service({ data: rows, page: { next_cursor: null } });
  const page = await (await createCentralJobs(fixture.client)).listJobs(actor);
  assert.deepEqual(page.data.map(row => ({ id: row.id, status: row.status, can_retry: row.can_retry, can_cancel: row.can_cancel })),
    rows.map(row => ({ id: row.id, status: row.status, can_retry: 'can_retry' in row ? row.can_retry : undefined, can_cancel: 'can_cancel' in row ? row.can_cancel : undefined })));
  assert.deepEqual(page.page, { next_cursor: null });
  assert.equal(page.data.find(row => row.id === 'export-failed')!.error!.retryable, true);
});
test('presentation action fields stay complete, typed and closed to other job kinds', async () => {
  const exportJob = { ...job, kind: 'presentation_export', stage: 'render_export', can_retry: false, can_cancel: false };
  const invalidRows: Record<string, unknown>[] = [
    { ...exportJob, can_retry: undefined }, { ...exportJob, can_cancel: 'false' },
    { ...exportJob, can_retry: true }, { ...exportJob, status: 'failed', can_cancel: true },
    { ...exportJob, status: 'cancelled', can_cancel: true }, { ...exportJob, private_export_input: {} },
  ];
  const missing = { ...exportJob } as Record<string, unknown>; delete missing.can_cancel; invalidRows.push(missing);
  for (const kind of ['specs_extract', 'candidate_scan', 'frame_extract', 'ai_suggestion', 'review_fit']) invalidRows.push({ ...exportJob, kind });
  for (const row of invalidRows) {
    const fixture = service(row);
    await assert.rejects((await createCentralJobs(fixture.client)).getJob(actor, jobId), code('CENTRAL_RESPONSE_INVALID'));
  }
});
test('frame jobs expose only bounded timestamp outcomes and reject private payloads',async()=>{
  const outcome={requested_count:3,extracted_count:1,unavailable_timestamps_ms:[1500],warnings:['FRAME_TIMESTAMP_SHARED','FRAME_TIMESTAMP_UNAVAILABLE']};
  const row={...job,kind:'frame_extract',status:'succeeded',stage:'apply_frames',frame_extraction:outcome};
  const fixture=service(row);assert.deepEqual((await(await createCentralJobs(fixture.client)).getJob(actor,jobId)).frame_extraction,outcome);
  for(const changed of [{...outcome,original_transcript:'private'}, {...outcome,requested_count:11}, {...outcome,unavailable_timestamps_ms:[-1]}, {...outcome,warnings:['PRIVATE_DETAIL'] }]){
    const bad=service({...row,frame_extraction:changed});await assert.rejects((await createCentralJobs(bad.client)).getJob(actor,jobId),code('CENTRAL_RESPONSE_INVALID'));
  }
  const ordinary=service({...job,frame_extraction:outcome});await assert.rejects((await createCentralJobs(ordinary.client)).getJob(actor,jobId),code('CENTRAL_RESPONSE_INVALID'));
});

test('job facade binds every fixed RPC and trace label to the verified user', async () => {
  const fixture = service(); const jobs = await createCentralJobs(fixture.client);
  assert.deepEqual(await jobs.getJob(actor, jobId), job);
  await jobs.retryJob(actor, jobId, { row_version: 1 }, { idempotencyKey: 'retry-key', requestId: 'safe-request', clientType: 'mcp' });
  await jobs.cancelJob(actor, jobId, { row_version: 1 }, { idempotencyKey: 'cancel-key' });
  assert.deepEqual(fixture.calls.slice(1).map(call => call.path), ['/rest/v1/rpc/eps_get_job', '/rest/v1/rpc/eps_retry_job', '/rest/v1/rpc/eps_cancel_job']);
  assert.deepEqual(fixture.calls[2]!.body, { p_job_id: jobId, p_input: { row_version: 1 }, p_idempotency_key: 'retry-key' });
  assert.equal(fixture.calls[2]!.headers.get('x-eps-client-type'), 'mcp');
  assert.equal(fixture.calls[2]!.headers.get('x-eps-request-id'), 'safe-request');
  assert.ok(fixture.calls.every(call => call.headers.get('authorization') === `Bearer ${token}`));
});

test('job list validates filters and exact public cursor/page shape', async () => {
  const fixture = service({ data: [job], page: { next_cursor: jobId } }); const jobs = await createCentralJobs(fixture.client);
  assert.deepEqual((await jobs.listJobs(actor, { workspace_id: workspace, status: 'queued', limit: 2 })).data, [job]);
  assert.deepEqual(fixture.calls[1]!.body, { p_workspace_id: workspace, p_status: 'queued', p_cursor: null, p_limit: 2 });
  await assert.rejects(() => jobs.listJobs(actor, { limit: 101 }), code('INVALID_REQUEST'));
  await assert.rejects(() => jobs.listJobs(actor, { status: 'forged' } as never), code('INVALID_REQUEST'));
});

test('private job fields, malformed counters and unrecognized provider error detail fail closed', async () => {
  for (const response of [{ ...job, input: { private_source: true } }, { ...job, lease_token_digest: 'private' }, { ...job, attempt: -1 },
    { ...job, error: { code: 'UNKNOWN', message: 'provider secret', details: {}, retryable: true } }, { ...job, progress_total: 0, progress_completed: 1 }]) {
    const fixture = service(response); const jobs = await createCentralJobs(fixture.client);
    await assert.rejects(() => jobs.getJob(actor, jobId), code('CENTRAL_RESPONSE_INVALID'));
  }
});

test('actor mismatch and malformed mutations never reach a job RPC', async () => {
  const fixture = service(); const jobs = await createCentralJobs(fixture.client);
  await assert.rejects(() => jobs.getJob({ principal_id: 'another-user' }, jobId), code('ACCESS_DENIED'));
  await assert.rejects(() => jobs.retryJob(actor, jobId, { row_version: 1 }), code('INVALID_REQUEST'));
  await assert.rejects(() => jobs.cancelJob(actor, jobId, { row_version: 0 }, { idempotencyKey: 'key' }), code('INVALID_REQUEST'));
  assert.equal(fixture.calls.length, 1);
});

test('contracted optional nullable reason is preserved exactly and nontext is rejected', async () => {
  const fixture = service(); const jobs = await createCentralJobs(fixture.client);
  for (const reason of [null, '', 'Operator requested retry']) {
    await jobs.retryJob(actor, jobId, { row_version: 1, reason }, { idempotencyKey: 'reason-key' });
    assert.deepEqual(fixture.calls.at(-1)!.body.p_input, { row_version: 1, reason });
  }
  await assert.rejects(() => jobs.cancelJob(actor, jobId, { row_version: 1, reason: 42 } as never, { idempotencyKey: 'bad-reason' }), code('INVALID_REQUEST'));
});

test('provider diagnostics are redacted while known stale-version errors retain only bounded revision', async () => {
  const fixture = service({ code: 'P0001', message: 'STALE_RESOURCE_VERSION', details: JSON.stringify({ current_row_version: 3, secret: 'private' }) }, 400);
  const jobs = await createCentralJobs(fixture.client);
  await assert.rejects(() => jobs.retryJob(actor, jobId, { row_version: 1 }, { idempotencyKey: 'key' }), value =>
    value instanceof DomainError && value.status === 409 && value.details.current_row_version === 3 && !JSON.stringify(value).includes('private'));
  const unknown = service({ code: 'XX000', message: 'credential in provider detail', details: 'private' }, 500);
  await assert.rejects(() => createCentralJobs(unknown.client).then(jobs => jobs.getJob(actor, jobId)), value =>
    value instanceof DomainError && !value.message.includes('credential') && !JSON.stringify(value).includes('private'));
});
