import assert from 'node:assert/strict';
import test from 'node:test';
import type { JobEvent, JobEventReceipt } from '@eps/jobs';
import { deliverCandidateCallback } from '../../apps/worker/src/candidate-callback.ts';
import { createJobService } from '../../packages/jobs/src/index.ts';
import { MemoryJobRepository, type MemoryTransaction } from '../jobs/memory-repository.ts';

const event: JobEvent = { event_id: 'synthetic-event', job_id: 'synthetic-job', attempt_id: 'synthetic-attempt', lease_token: 'synthetic-private-lease', stage: 'prepare_candidate', sequence: 1, event_type: 'succeeded', input_hash: 'a'.repeat(64), result_schema: 'media-preparation.v1', result: { source_asset_id: 'synthetic-source' } };
const transient = { code: 'RUNTIME_UNAVAILABLE', outcome: 'unknown', gateway_phase: 'commit', transport_code: 'ECONNRESET', message: 'private SQL/source diagnostics' };
const receipt = (input: JobEvent): JobEventReceipt => ({ event_id: input.event_id, applied: true, duplicate: false, stale: false, job_status: 'queued' });
function scheduling() {
  let time = 10_000; const waits: number[] = []; const controller = new AbortController();
  return { controller, waits, now: () => time, advance: (ms: number) => { time += ms; },
    options: { signal: controller.signal, timeoutMs: 15_000, leaseDeadlineMs: time + 90_000, now: () => time, sleep: async (ms: number) => { waits.push(ms); time += ms; } } };
}
test('transient callback exhaustion sends at most three identical events within one shared budget and exposes only a safe error', async () => {
  const state = scheduling(); const sent: JobEvent[] = [];
  await assert.rejects(deliverCandidateCallback(event, { recordEvent: async input => { sent.push(structuredClone(input)); throw transient; } }, state.options), error => {
    assert.equal((error as {code:string}).code, 'CALLBACK_UNCONFIRMED'); assert.doesNotMatch(String(error), /private|synthetic-private-lease/u); return true;
  });
  assert.equal(sent.length, 3); assert.deepEqual(sent, [event, event, event]); assert.deepEqual(state.waits, [250, 750]);
});
test('a transient pre-commit failure retries only the callback and applies one actual jobs transaction', async () => {
  const repository = new MemoryJobRepository(); const state = scheduling(); let ids = 0;
  const service = createJobService<MemoryTransaction>({ repository, clock: () => new Date(state.now()), id: () => `synthetic-${++ids}`, authorizeJob: async () => {}, authorizeDispatcher: async () => {},
    definitions: [{ kind: 'candidate_scan', validateInput: input => input, stages: ['prepare_candidate', 'transcribe_candidate'].map(stage => ({ key: stage, result_schema: 'media-preparation.v1', validateResult: result => result, applyResult: async tx => { await tx.applyResource(stage); } })) }] });
  const actor = { principal_id: 'synthetic-worker', client_type: 'service' as const };
  const job = await service.enqueue({ principal_id: 'synthetic-producer', client_type: 'browser' }, { kind: 'candidate_scan', workspace_id: 'synthetic-workspace', dedupe_key: 'pre-commit', input: {} }, 'synthetic-intent');
  const lease = await service.claimStage(actor, { job_id: job.id, stage: job.stage, input_hash: job.input_hash });
  const input = { ...event, job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token, input_hash: String(lease.input.input_hash) }; let sends = 0;
  for (const patch of [{ input_hash: 'b'.repeat(64) }, { lease_token: 'wrong-lease' }]) {
    const before = repository.inspect(); let calls = 0;
    await assert.rejects(deliverCandidateCallback({ ...input, ...patch }, { recordEvent: async value => { calls++; return service.recordEvent(actor, value); } }, state.options), { code: 'CALLBACK_UNCONFIRMED' });
    assert.equal(calls, 1); assert.deepEqual(repository.inspect(), before);
  }
  const result = await deliverCandidateCallback(input, { recordEvent: async value => { if (++sends === 1) throw { code: 'DEPENDENCY_UNAVAILABLE', outcome: 'known', gateway_phase: 'operation', transport_code: '40001' }; return service.recordEvent(actor, value); } }, state.options);
  assert.equal(result.receipt.applied, true); assert.equal(sends, 2); assert.equal(repository.inspect().applied.length, 1); assert.equal(repository.inspect().events.length, 1); assert.equal(repository.inspect().outbox.length, 2);
  // A different input/lease is never reclassified as transient or allowed to
  // create an event after the next stage has been fenced into place.
  for (const patch of [{ input_hash: 'b'.repeat(64) }, { lease_token: 'wrong-lease' }, { attempt_id: 'other-attempt' }]) {
    const before = repository.inspect(); let calls = 0;
    await assert.rejects(deliverCandidateCallback({ ...input, ...patch, sequence: 2, event_id: `fenced-${Object.keys(patch)[0]}` }, { recordEvent: async value => { calls++; return service.recordEvent(actor, value); } }, state.options), { code: 'LEASE_STALE' });
    assert.equal(calls, 1); assert.deepEqual(repository.inspect(), before);
  }
});
test('auth, TLS, role, scope, source, event conflicts and unclassified failures never trigger callback replay', async () => {
  const errors: unknown[] = ['RUNTIME_AUTH_UNVERIFIED', 'RUNTIME_CONFIG_INVALID', 'RUNTIME_ROLE_UNVERIFIED', 'LEASE_INVALID', 'INPUT_CHANGED', 'INPUT_HASH_MISMATCH', 'EVENT_ID_CONFLICT', 'EVENT_SEQUENCE_CONFLICT', 'RUNTIME_RESPONSE_INVALID', 'RUNTIME_CLOSED'].map(code => ({ ...transient, code }));
  errors.push(new Error('private exception'), { ...transient, transport_code: undefined }, { ...transient, transport_code: 'ERR_TLS_CERT_ALTNAME_INVALID' }, { ...transient, outcome: 'not-confirmed' }, { get code() { throw new Error('private getter'); } });
  for (const error of errors) { const state = scheduling(); let calls = 0;
    await assert.rejects(deliverCandidateCallback(event, { recordEvent: async () => { calls++; throw error; } }, state.options), { code: 'CALLBACK_UNCONFIRMED' });
    assert.equal(calls, 1); assert.deepEqual(state.waits, []);
  }
});
test('malformed receipts are unconfirmed and stale receipts stop immediately without another send', async () => {
  for (const [value, code] of [[{ ...receipt(event), event_id: 'foreign-event' }, 'CALLBACK_UNCONFIRMED'], [{ ...receipt(event), applied: false }, 'CALLBACK_UNCONFIRMED'], [{ ...receipt(event), extra: 'private-payload' }, 'CALLBACK_UNCONFIRMED'], [{ ...receipt(event), stale: true }, 'LEASE_STALE']] as const) {
    const state = scheduling(); let calls = 0;
    await assert.rejects(deliverCandidateCallback(event, { recordEvent: async () => { calls++; return value; } }, state.options), { code }); assert.equal(calls, 1); assert.deepEqual(state.waits, []);
  }
  const state = scheduling(); let calls = 0;
  await assert.rejects(deliverCandidateCallback(event, { recordEvent: async () => { calls++; return { ...receipt(event), get applied(): boolean { throw new Error('private receipt getter'); } }; } }, state.options), { code: 'CALLBACK_UNCONFIRMED' }); assert.equal(calls, 1);
});
test('outer budget and conservative lease expiry prevent a later send without claiming an unknown first result failed', async () => {
  for (const leaseLimited of [false, true]) {
    const state = scheduling(); let calls = 0; const options = { ...state.options, leaseDeadlineMs: state.now() + (leaseLimited ? 5000 : 90_000) };
    await assert.rejects(deliverCandidateCallback(event, { recordEvent: async () => { calls++; state.advance(leaseLimited ? 3900 : 14_900); throw transient; } }, options), { code: 'CALLBACK_UNCONFIRMED' });
    assert.equal(calls, 1); assert.deepEqual(state.waits, []);
  }
  const state = scheduling(); let calls = 0;
  await assert.rejects(deliverCandidateCallback(event, { recordEvent: async input => { calls++; return receipt(input); } }, { ...state.options, leaseDeadlineMs: state.now() + 999 }), { code: 'LEASE_STALE' }); assert.equal(calls, 0);
});
test('an unresolved callback cannot defeat its deadline and receives an aborted request without a competing event', async () => {
  let request: AbortSignal | undefined; let calls = 0;
  await assert.rejects(deliverCandidateCallback(event, { recordEvent: async (_event, signal) => { calls++; request = signal; return new Promise(() => {}); } }, { signal: new AbortController().signal, timeoutMs: 20, leaseDeadlineMs: Date.now() + 90_000 }), { code: 'CALLBACK_UNCONFIRMED' });
  assert.equal(calls, 1); assert.equal(request?.aborted, true);
});
test('cancellation during retry backoff aborts the wait and sends no later callback', async () => {
  const state = scheduling(); let calls = 0;
  await assert.rejects(deliverCandidateCallback(event, { recordEvent: async () => { calls++; throw transient; } }, { ...state.options, sleep: async () => { state.controller.abort(); return new Promise(() => {}); } }), { code: 'PROCESSING_CANCELLED' }); assert.equal(calls, 1);
});
