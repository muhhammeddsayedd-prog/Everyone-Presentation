import assert from 'node:assert/strict';
import test from 'node:test';
import { createJobService, JobError } from '../../packages/jobs/src/index.ts';
import type { JobActor, JobEvent, StageLease } from '../../packages/jobs/src/index.ts';
import { MemoryJobRepository } from './memory-repository.ts';
import type { MemoryTransaction } from './memory-repository.ts';

const user: JobActor = { principal_id: 'producer', client_type: 'browser' };
const worker: JobActor = { principal_id: 'specs-worker', client_type: 'service' };
const denied: JobActor = { principal_id: 'denied', client_type: 'service' };
function fixture(settings: { autoRetry?: boolean; maxStageAttempts?: number; maxDispatchAttempts?: number } = {}) {
  const repository = new MemoryJobRepository();
  let time = Date.parse('2026-10-28T12:00:00Z'); let id = 0;
  const service = createJobService<MemoryTransaction>({ repository, ...settings,
    definitions: [{ kind: 'specs_extract', validateInput: input => input, stages: ['prepare_document', 'extract_specs', 'apply_specs'].map(key => ({ key, result_schema: `${key}.v1`, validateResult: result => { if (result.valid !== true) throw new Error('invalid'); return result; }, applyResult: async (tx, job, result) => {
      if (result.draft_changed) return { waiting_for_input: { code: 'INPUT_CHANGED' } };
      await tx.applyResource(`${job.id}:${key}`);
      if (result.throw_after_apply) throw new Error('injected domain transaction failure');
    } })) }],
    authorizeJob: async (actor, _action, job) => { if (![user.principal_id, worker.principal_id].includes(actor.principal_id) || job.workspace_id !== 'workspace-one') throw new JobError('CAPABILITY_REQUIRED', 'Denied.', 403); },
    authorizeDispatcher: async actor => { if (actor.principal_id !== worker.principal_id) throw new JobError('CAPABILITY_REQUIRED', 'Denied.', 403); },
    clock: () => new Date(time), id: () => `id-${++id}`, token: () => `lease-${++id}`, random: () => 0.5,
  });
  const enqueue = () => service.enqueue(user, { kind: 'specs_extract', workspace_id: 'workspace-one', input: { source_asset_id: 'source-one', source_sha256: 'source-hash', prompt_version: 'v1' }, dedupe_key: 'source-and-configuration-one' }, 'enqueue-one');
  return { repository, service, enqueue, advance: (ms: number) => { time += ms; } };
}
function event(lease: StageLease, type: JobEvent['event_type'], sequence = 1): JobEvent {
  return { event_id: `${type}-${sequence}`, job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token, stage: lease.stage, sequence, event_type: type, input_hash: String(lease.input.input_hash), ...(type === 'succeeded' ? { result_schema: `${lease.stage}.v1`, result: { valid: true } } : {}) };
}
const code = (expected: string) => (e: unknown) => e instanceof JobError && e.code === expected;

test('enqueue atomically records the job/outbox and concurrent idempotent requests reuse one job', async () => {
  const { repository, enqueue } = fixture();
  repository.failNextCommit = true;
  await assert.rejects(enqueue(), /injected transaction/);
  assert.equal(repository.inspect().jobs.length, 0); assert.equal(repository.inspect().outbox.length, 0);
  const results = await Promise.all([enqueue(), enqueue()]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(repository.inspect().jobs.length, 1); assert.equal(repository.inspect().outbox.length, 1);
});

test('stage lease has one claim winner and callback duplicates cannot repeat domain effects', async () => {
  const { repository, service, enqueue } = fixture(); const job = await enqueue();
  const claims = await Promise.allSettled([service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash }), service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash })]);
  assert.equal(claims.filter(x => x.status === 'fulfilled').length, 1);
  const lease = claims.find(x => x.status === 'fulfilled')!.value;
  const complete = event(lease, 'succeeded');
  assert.equal((await service.recordEvent(worker, complete)).applied, true);
  assert.equal((await service.recordEvent(worker, complete)).duplicate, true);
  assert.equal(repository.inspect().applied.length, 1);
  assert.equal(repository.inspect().outbox.length, 2);
  const persisted = JSON.stringify(repository.inspect());
  assert.equal(persisted.includes(lease.lease_token), false);
});

test('user/project and worker scopes are checked and credentials cannot enter durable job input', async () => {
  const { service, enqueue, repository } = fixture(); const job = await enqueue();
  await assert.rejects(service.claimStage(user, { job_id: job.id, stage: job.stage, input_hash: job.input_hash }), code('SERVICE_AUTH_REQUIRED'));
  await assert.rejects(service.claimStage(denied, { job_id: job.id, stage: job.stage, input_hash: job.input_hash }), code('CAPABILITY_REQUIRED'));
  await assert.rejects(service.getJob(denied, job.id), code('CAPABILITY_REQUIRED'));
  await assert.rejects(service.claimOutbox(denied), code('CAPABILITY_REQUIRED'));
  await assert.rejects(service.enqueue(user, { kind: 'specs_extract', workspace_id: 'workspace-one', input: { api_key: 'never-persist-this' }, dedupe_key: 'unsafe' }, 'unsafe'), code('INVALID_REQUEST'));
  await assert.rejects(service.enqueue(user, { kind: 'specs_extract', workspace_id: 'workspace-other', input: {}, dedupe_key: 'other' }, 'other'), code('CAPABILITY_REQUIRED'));
  assert.equal(JSON.stringify(repository.inspect()).includes('never-persist-this'), false);
});

test('event ID/sequence conflicts, lease credentials and out-of-order events cannot corrupt progress', async () => {
  const { service, repository, enqueue } = fixture(); const job = await enqueue();
  const lease = await service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash });
  const progress = { ...event(lease, 'progress', 2), result: { progress_completed: 2, progress_total: 3 } };
  await service.recordEvent(worker, progress);
  const late = await service.recordEvent(worker, { ...event(lease, 'progress', 1), result: { progress_completed: 1, progress_total: 3 } });
  assert.equal(late.stale, true); assert.equal(late.applied, false);
  assert.equal((await service.getJob(user, job.id)).progress_completed, 2);
  await assert.rejects(service.recordEvent(worker, { ...progress, result: { progress_completed: 3, progress_total: 3 } }), code('EVENT_ID_CONFLICT'));
  await assert.rejects(service.recordEvent(worker, { ...progress, event_id: 'another-event' }), code('EVENT_SEQUENCE_CONFLICT'));
  await assert.rejects(service.recordEvent(worker, { ...event(lease, 'heartbeat', 3), lease_token: 'wrong' }), code('LEASE_INVALID'));
  await assert.rejects(service.recordEvent(worker, { ...event(lease, 'heartbeat', 3), input_hash: 'wrong' }), code('INPUT_HASH_MISMATCH'));
  await service.recordEvent(worker, event(lease, 'succeeded', 3));
  assert.equal((await service.recordEvent(worker, { ...event(lease, 'progress', 4), result: { progress_completed: 0, progress_total: 3 } })).stale, true);
  assert.equal(repository.inspect().applied.length, 1);
});

test('heartbeat extends a lease and expiry recovery fences the old attempt with delayed bounded retry', async () => {
  const { service, enqueue, advance } = fixture(); const job = await enqueue();
  const lease = await service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash });
  advance(80_000); await service.recordEvent(worker, event(lease, 'heartbeat'));
  advance(20_000); assert.deepEqual((await service.recoverExpired(worker)).recovered_ids, []);
  advance(80_000); assert.deepEqual((await service.recoverExpired(worker)).recovered_ids, [job.id]);
  await assert.rejects(service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash }), code('JOB_NOT_AVAILABLE'));
  advance(2_000);
  const next = await service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash });
  assert.notEqual(next.attempt_id, lease.attempt_id); assert.notEqual(next.lease_token, lease.lease_token);
  assert.equal((await service.recordEvent(worker, event(lease, 'succeeded', 2))).stale, true);
  await service.recordEvent(worker, { ...event(next, 'progress'), result: { progress_completed: 0, progress_total: 3 } });
  await service.recordEvent(worker, event(next, 'succeeded', 2));
  assert.equal((await service.getJob(user, job.id)).stage, 'extract_specs');
});

test('retry budget is per stage/input while total lease attempts remain monotonic across stages', async () => {
  const { service, enqueue, advance } = fixture({ maxStageAttempts: 2 }); const job = await enqueue();
  let lease = await service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash });
  const transient = { ...event(lease, 'failed'), error: { code: 'PROVIDER_RATE_LIMITED', message: 'sensitive provider exception must not persist', details: { retry_after_seconds: 10, bearer: 'private-value' }, retryable: true } };
  assert.equal((await service.recordEvent(worker, transient)).job_status, 'queued');
  advance(2_000); await assert.rejects(service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash }), code('JOB_NOT_AVAILABLE'));
  advance(8_000); lease = await service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash });
  await service.recordEvent(worker, event(lease, 'succeeded'));
  const second = await service.claimStage(worker, { job_id: job.id, stage: 'extract_specs', input_hash: job.input_hash });
  assert.equal((await service.getJob(user, job.id)).attempt, 3);
  await service.recordEvent(worker, { ...event(second, 'failed'), error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'temporary', details: {}, retryable: true } });
  advance(2_000); const final = await service.claimStage(worker, { job_id: job.id, stage: 'extract_specs', input_hash: job.input_hash });
  await service.recordEvent(worker, { ...event(final, 'failed'), error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'temporary', details: {}, retryable: true } });
  const failed = await service.getJob(user, job.id);
  assert.equal(failed.status, 'failed'); assert.equal(failed.error?.code, 'RETRY_EXHAUSTED');
  assert.equal(failed.completed_stages.length, 1);
  await assert.rejects(service.retryJob(user, job.id, { row_version: failed.row_version }, 'bypass-budget'), code('JOB_NOT_RETRYABLE'));
  assert.equal(JSON.stringify(failed).includes('private-value'), false);
  assert.equal(JSON.stringify(failed).includes('sensitive provider exception'), false);
});

test('schema-invalid success is terminal without app effects or scheduling the next stage', async () => {
  const { service, repository, enqueue } = fixture(); const job = await enqueue();
  const lease = await service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash });
  const receipt = await service.recordEvent(worker, { ...event(lease, 'succeeded'), result: { valid: false } });
  assert.equal(receipt.job_status, 'failed'); assert.equal((await service.getJob(user, job.id)).error?.code, 'RESULT_INVALID');
  assert.equal(repository.inspect().applied.length, 0); assert.equal(repository.inspect().outbox.length, 1);
});

test('domain commit and event/next-outbox commit share rollback, while changed drafts can wait without edits', async () => {
  const { service, repository, enqueue } = fixture(); const job = await enqueue();
  const lease = await service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash });
  await assert.rejects(service.recordEvent(worker, { ...event(lease, 'succeeded'), result: { valid: true, throw_after_apply: true } }), /injected domain/);
  assert.equal(repository.inspect().applied.length, 0); assert.equal(repository.inspect().events.length, 0); assert.equal(repository.inspect().outbox.length, 1);
  assert.equal((await service.getJob(user, job.id)).status, 'running');
  const receipt = await service.recordEvent(worker, { ...event(lease, 'succeeded'), result: { valid: true, draft_changed: true } });
  assert.equal(receipt.job_status, 'waiting_for_input');
  assert.equal(repository.inspect().applied.length, 0); assert.equal(repository.inspect().outbox.length, 1);
});

test('cancellation is durable, idempotent and prevents late effects and unsent dispatch', async () => {
  const { service, repository, enqueue } = fixture(); const job = await enqueue();
  const lease = await service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash });
  const current = await service.getJob(user, job.id);
  await service.cancelJob(user, job.id, { row_version: current.row_version }, 'cancel-one');
  await service.cancelJob(user, job.id, { row_version: current.row_version }, 'cancel-one');
  assert.equal((await service.recordEvent(worker, event(lease, 'succeeded'))).stale, true);
  await assert.rejects(service.claimStage(worker, { job_id: job.id, stage: job.stage, input_hash: job.input_hash }), code('JOB_CANCELLED'));
  assert.deepEqual(await service.claimOutbox(worker), []);
  assert.equal(repository.inspect().outbox[0]!.status, 'dead'); assert.equal(repository.inspect().applied.length, 0);
});

test('outbox crash recovery is at-least-once with lease fencing and accepted-dispatch acknowledgement', async () => {
  const { service, repository, enqueue, advance } = fixture(); await enqueue();
  const claims = await Promise.all([service.claimOutbox(worker), service.claimOutbox(worker)]);
  assert.equal(claims.flat().length, 1); const first = claims.flat()[0]!;
  advance(91_000); const recovered = (await service.claimOutbox(worker))[0]!;
  assert.equal(first.id, recovered.id); assert.notEqual(first.lease_token, recovered.lease_token);
  await assert.rejects(service.acknowledgeOutbox(worker, first.id, first.lease_token), code('STALE_DISPATCH_LEASE'));
  await service.acknowledgeOutbox(worker, recovered.id, recovered.lease_token);
  await service.acknowledgeOutbox(worker, recovered.id, recovered.lease_token);
  assert.equal(repository.inspect().outbox[0]!.status, 'delivered');
  assert.equal(JSON.stringify(repository.inspect()).includes(recovered.lease_token), false);
});

test('bounded failed dispatch becomes actionable and explicit retry reuses the same job', async () => {
  const { service, repository, enqueue, advance } = fixture({ maxDispatchAttempts: 2 }); const job = await enqueue();
  const first = (await service.claimOutbox(worker))[0]!; await service.failOutbox(worker, first.id, first.lease_token);
  assert.deepEqual(await service.claimOutbox(worker), []); advance(2_000);
  const second = (await service.claimOutbox(worker))[0]!; await service.failOutbox(worker, second.id, second.lease_token);
  const failed = await service.getJob(user, job.id); assert.equal(failed.status, 'failed'); assert.equal(failed.error?.retryable, true);
  const retried = await service.retryJob(user, job.id, { row_version: failed.row_version }, 'retry-one');
  assert.equal(retried.id, job.id); assert.equal(retried.status, 'queued');
  await service.retryJob(user, job.id, { row_version: failed.row_version }, 'retry-one');
  assert.equal(repository.inspect().jobs.length, 1); assert.equal(repository.inspect().outbox.length, 2);
  assert.equal((await service.claimOutbox(worker)).length, 1);
});

test('completed stages return saved results and three sequential stages finish without redundant work', async () => {
  const { service, repository, enqueue } = fixture(); const job = await enqueue();
  for (const stage of ['prepare_document', 'extract_specs', 'apply_specs']) {
    const lease = await service.claimStage(worker, { job_id: job.id, stage, input_hash: job.input_hash });
    await service.recordEvent(worker, event(lease, 'succeeded'));
    const replay = await service.claimStage(worker, { job_id: job.id, stage, input_hash: job.input_hash });
    assert.equal(replay.already_completed, true); assert.equal(replay.lease_token, ''); assert.deepEqual(replay.input.result, { valid: true });
  }
  const result = await service.getJob(user, job.id); assert.equal(result.status, 'succeeded'); assert.equal(result.attempt, 3);
  assert.equal(repository.inspect().applied.length, 3);
});
