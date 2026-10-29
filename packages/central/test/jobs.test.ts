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
