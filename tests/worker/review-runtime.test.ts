import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStageReadyEnvelope, type StageReadyEnvelope } from '../../packages/integrations/src/n8n-dispatch.ts';
import { validateSpecsWorkOrder } from '../../apps/worker/src/n8n-orchestrator.ts';
import { processNextSpecsStage } from '../../apps/worker/src/runtime.ts';
import type { StageRuntimeGateway, SpecsStageRouter } from '../../apps/worker/src/runtime-types.ts';
import type { StageLease } from '../../packages/jobs/src/types.ts';

const tuples = [
  ['ai_suggestion', 'prepare_suggestion', 'domain.prepare_suggestion'], ['ai_suggestion', 'generate_suggestion', 'openai.generate_suggestion'],
  ['ai_suggestion', 'validate_suggestion', 'domain.validate_suggestion'], ['review_fit', 'measure_review_fit', 'native.measure_review_fit'],
] as const;
const envelope = (kind: string, stage: string) => ({ event_id: '22222222-2222-4222-8222-222222222222', event_type: 'job.stage_ready', contract_version: '1.0', job_id: '11111111-1111-4111-8111-111111111111', kind, stage, input_hash: 'a'.repeat(64), correlation_id: 'synthetic-review-runtime' }) as StageReadyEnvelope;
test('four review stage tuples bind metadata-only n8n handlers and reject kind/stage or handler substitution', () => {
  for (const [kind, stage, handler] of tuples) {
    const scope = envelope(kind, stage); assert.doesNotThrow(() => validateStageReadyEnvelope(scope));
    const order = { schema_version: '1.0', event_id: scope.event_id, job_id: scope.job_id, kind, stage, input_hash: scope.input_hash, correlation_id: scope.correlation_id, workflow_execution_id: 'review-execution', handler };
    assert.deepEqual(validateSpecsWorkOrder(order, scope), order);
    assert.throws(() => validateSpecsWorkOrder({ ...order, handler: 'native.run_shell' }, scope));
    assert.throws(() => validateStageReadyEnvelope(envelope(kind === 'review_fit' ? 'ai_suggestion' : 'review_fit', stage)));
    assert.throws(() => validateSpecsWorkOrder({ ...order, source_text: 'must never reach n8n' }, scope));
  }
});
test('review executors run only after current claim and acknowledged dispatch, with old specs execution excluded', async () => {
  for (const [kind, stage, handler] of tuples) {
    const scope = envelope(kind, stage); const calls: string[] = [];
    const lease = { job_id: scope.job_id, stage, already_completed: false, input: { input_hash: scope.input_hash } } as unknown as StageLease;
    const gateway: StageRuntimeGateway = { async claimOutbox() { calls.push('outbox'); return { leases: [{ id: scope.event_id, lease_token: 'synthetic-dispatch-lease', lease_expires_at: new Date(Date.now() + 90000).toISOString(), envelope: scope }] }; }, async claim() { calls.push('claim'); return lease; }, async finishOutbox(_id, _token, accepted) { calls.push(accepted ? 'ack' : 'nack'); return { acknowledged: accepted, stale: false }; }, async getInput() { throw new Error('not used by injected executor'); }, async recordEvent() { throw new Error('not used by injected executor'); }, async recover() { return { recovered: 0 }; } };
    const router: SpecsStageRouter = { async route(value) { calls.push('n8n'); return { schema_version: '1.0', event_id: value.event_id, job_id: value.job_id, kind: value.kind, stage: value.stage, input_hash: value.input_hash, correlation_id: value.correlation_id, workflow_execution_id: 'review-execution', handler } as Awaited<ReturnType<SpecsStageRouter['route']>>; } };
    const execute = async () => { assert.deepEqual(calls, ['outbox', 'n8n', 'claim', 'ack']); calls.push(kind); return { already_completed: false as const, receipt: { event_id: 'synthetic-result', applied: true, duplicate: false, stale: false, job_status: 'queued' as const } }; };
    const result = await processNextSpecsStage(gateway, router, { openAI: { apiKey: 'synthetic', model: 'synthetic' }, review: { openAI: { apiKey: 'synthetic', model: 'synthetic' } }, fit: {}, executeReview: execute, executeFit: execute, execute: async () => { throw new Error('Wrong specs executor'); } });
    assert.equal(result.event, 'stage_callback_committed'); assert.equal(calls.at(-1), kind);
  }
});
