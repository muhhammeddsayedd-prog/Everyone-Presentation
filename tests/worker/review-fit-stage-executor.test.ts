import assert from 'node:assert/strict';
import test from 'node:test';
import type { JobEvent, JobEventReceipt, JsonObject, StageLease } from '@eps/jobs';
import { executeReviewFitStage } from '../../apps/worker/src/review-fit-stage-executor.ts';
import { ReviewFitError, type ReviewFitMeasurement } from '../../apps/worker/src/review-fit.ts';
import type { ReviewStageGateway } from '../../apps/worker/src/review-stage-executor.ts';
import registry from '../../packages/templates/registry.json';
import { fitReview } from './review-fit-fixture.ts';

function harness() {
  const review = fitReview(); const snapshot = structuredClone(review) as Partial<typeof review>; delete snapshot.fit;
  const input = { schema_version: '1.0', workspace_id: review.workspace_id, series_id: review.series_id,
    expected_input_fingerprint: review.input_fingerprint, template: review.template,
    configuration: { renderer_version: 'everyone-casting-fit-v1' }, input_hash: 'b'.repeat(64) };
  const lease: StageLease = { job_id: 'synthetic-job', attempt_id: 'synthetic-attempt', stage: 'measure_review_fit',
    lease_token: 'synthetic-lease', lease_expires_at: new Date(Date.now() + 90000).toISOString(), already_completed: false, input: structuredClone(input) as unknown as JsonObject };
  const events: JobEvent[] = []; let reads = 0;
  const gateway: ReviewStageGateway = {
    async getInput(scope) { reads++; assert.deepEqual(scope, { job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token });
      return { ...structuredClone(input), job_id: lease.job_id, attempt_id: lease.attempt_id, stage: lease.stage, review: structuredClone(snapshot) }; },
    async recordEvent(event) { events.push(structuredClone(event)); return { event_id: event.event_id, applied: true, duplicate: false, stale: false, job_status: event.event_type === 'succeeded' ? 'succeeded' : 'running' }; },
  };
  const proof: ReviewFitMeasurement = { schema_version: '1.0', input_fingerprint: review.input_fingerprint,
    template_content_sha256: review.template.content_sha256, renderer_version: 'everyone-casting-fit-v1', chromium_version: '145.0.0.0',
    font_hashes: Object.fromEntries(registry.fonts.map(font => [font.path, font.sha256])), overflows: [], measured_at: new Date().toISOString() };
  return { review, lease, gateway, events, proof, reads: () => reads };
}

test('fit executor measures the fenced snapshot once and publishes only exact measurement metadata', async () => {
  const h = harness(); let calls = 0;
  const result = await executeReviewFitStage(h.lease, h.gateway, { measure: async (review, { signal } = {}) => {
    calls++; assert.deepEqual(review, h.review); assert.equal(signal?.aborted, false); return h.proof;
  } });
  assert.equal(calls, 1); assert.equal(result.receipt?.applied, true); assert.equal(h.events.length, 1);
  assert.equal(h.events[0].event_type, 'succeeded'); assert.equal(h.events[0].result_schema, 'review-fit-measurement.v1');
  assert.equal(h.events[0].sequence, 1); assert.equal(h.events[0].input_hash, h.lease.input.input_hash);
  assert.deepEqual(h.events[0].result, h.proof); assert.equal(JSON.stringify(h.events).includes('Synthetic fixture'), false);
});

test('completed replay, malformed scope and changed snapshot binding do no measurement or business mutation', async () => {
  const h = harness(); let calls = 0; const measure = async () => { calls++; return h.proof; };
  assert.deepEqual(await executeReviewFitStage({ ...h.lease, already_completed: true }, h.gateway, { measure }), { already_completed: true, receipt: null });
  assert.equal(h.reads(), 0);
  for (const patch of [{ stage: 'generate_suggestion' }, { lease_token: 'invalid token' }, { lease_expires_at: '2000-01-01T00:00:00Z' }, { input: { ...h.lease.input, extra: true } }]) {
    await assert.rejects(executeReviewFitStage({ ...h.lease, ...patch } as StageLease, h.gateway, { measure }), { code: 'INVALID_STAGE_SCOPE' });
  }
  for (const patch of [{ expected_input_fingerprint: 'c'.repeat(64) }, { template: { ...h.review.template, content_sha256: 'c'.repeat(64) } },
    { review: { ...h.review, fit: undefined } }, { review: { ...h.review, workspace_id: 'different' } }, { extra: true }]) {
    const original = h.gateway.getInput; h.gateway.getInput = async (...args) => ({ ...await original(...args) as object, ...patch });
    await assert.rejects(executeReviewFitStage(h.lease, h.gateway, { measure }), { code: 'STAGE_INPUT_INVALID' }); h.gateway.getInput = original;
  }
  assert.equal(calls, 0); assert.equal(h.events.length, 0);
});

test('invalid proof is never published as succeeded and permanent asset errors stay redacted', async () => {
  for (const patch of [{ input_fingerprint: 'c'.repeat(64) }, { font_hashes: {} }, { extra: true },
    { overflows: [{ slide_index: 1, field: 'private_source', axis: 'vertical', overflow_px: 1 }] }]) {
    const h = harness(); await assert.rejects(executeReviewFitStage(h.lease, h.gateway, { measure: async () => ({ ...h.proof, ...patch }) as ReviewFitMeasurement }), { code: 'STAGE_INPUT_INVALID' });
    assert.equal(h.events.length, 0);
  }
  for (const [error, retryable] of [[new ReviewFitError('FIT_TEMPLATE_MISMATCH'), false], [new ReviewFitError('FIT_MEASUREMENT_FAILED'), true], [new Error('private browser launch path'), true]] as const) {
    const h = harness(); await executeReviewFitStage(h.lease, h.gateway, { measure: async () => { throw error; } });
    assert.equal(h.events[0].event_type, 'failed'); assert.equal(h.events[0].error?.retryable, retryable);
    assert.equal(JSON.stringify(h.events).includes('private browser'), false);
  }
});

test('lost fit callback retries the same event without measuring twice', async () => {
  const h = harness(); let calls = 0; const sent: JobEvent[] = [];
  h.gateway.recordEvent = async event => { sent.push(structuredClone(event)); if (sent.length === 1) throw Object.assign(new Error('private transport response'), { code: 'RUNTIME_UNAVAILABLE', outcome: 'unknown', gateway_phase: 'commit', transport_code: 'ECONNRESET' });
    return { event_id: event.event_id, applied: false, duplicate: true, stale: false, job_status: 'succeeded' }; };
  const result = await executeReviewFitStage(h.lease, h.gateway, { gatewayTimeoutMs: 2000, measure: async () => { calls++; return h.proof; } });
  assert.equal(result.receipt?.duplicate, true); assert.equal(calls, 1); assert.equal(sent.length, 2); assert.deepEqual(sent[0], sent[1]);
});

test('fit heartbeat ordering is serialized and cancellation or stale ownership suppresses late success', async () => {
  const h = harness(); await executeReviewFitStage(h.lease, h.gateway, { heartbeatMs: 10, measure: async () => { await new Promise(resolve => setTimeout(resolve, 35)); return h.proof; } });
  assert.ok(h.events.some(event => event.event_type === 'heartbeat')); assert.equal(h.events.at(-1)?.event_type, 'succeeded');
  assert.deepEqual(h.events.map(event => event.sequence), h.events.map((_event, index) => index + 1));
  const stale = harness(); const sent: JobEvent[] = [];
  stale.gateway.recordEvent = async (event): Promise<JobEventReceipt> => { sent.push(event); return { event_id: event.event_id, applied: false, duplicate: false, stale: true, job_status: 'running' }; };
  await assert.rejects(executeReviewFitStage(stale.lease, stale.gateway, { heartbeatMs: 10, measure: async () => { await new Promise(resolve => setTimeout(resolve, 35)); return stale.proof; } }), { code: 'LEASE_STALE' });
  assert.ok(sent.every(event => event.event_type === 'heartbeat'));
  const canceled = harness(); const controller = new AbortController();
  await assert.rejects(executeReviewFitStage(canceled.lease, canceled.gateway, { signal: controller.signal, measure: async () => { controller.abort(); return canceled.proof; } }), { code: 'PROCESSING_CANCELLED' });
  assert.equal(canceled.events.length, 0);
});
