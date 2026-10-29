import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStageReadyEnvelope, type StageReadyEnvelope } from '../../packages/integrations/src/n8n-dispatch.ts';
import { validateSpecsWorkOrder } from '../../apps/worker/src/n8n-orchestrator.ts';
import { processNextSpecsStage } from '../../apps/worker/src/runtime.ts';
import type { StageRuntimeGateway, SpecsStageRouter } from '../../apps/worker/src/runtime-types.ts';
import type { StageLease } from '../../packages/jobs/src/types.ts';
const stages = ['prepare_presentation', 'render_presentation', 'validate_presentation', 'publish_presentation'] as const;
test('four WF03 work orders bind only the canonical native/domain handlers', () => {
  for (const stage of stages) {
    const envelope = { event_id: '22222222-2222-4222-8222-222222222222', event_type: 'job.stage_ready', contract_version: '1.0', job_id: '11111111-1111-4111-8111-111111111111', kind: 'presentation_render', stage, input_hash: 'a'.repeat(64), correlation_id: 'synthetic-presentation-runtime' } as StageReadyEnvelope;
    assert.doesNotThrow(() => validateStageReadyEnvelope(envelope)); const order = { schema_version: '1.0', event_id: envelope.event_id, job_id: envelope.job_id, kind: envelope.kind, stage, input_hash: envelope.input_hash, correlation_id: envelope.correlation_id, workflow_execution_id: 'synthetic-wf03', handler: `${stage === 'publish_presentation' ? 'domain' : 'native'}.${stage}` };
    assert.deepEqual(validateSpecsWorkOrder(order, envelope), order); assert.throws(() => validateSpecsWorkOrder({ ...order, handler: 'native.run_shell' }, envelope)); assert.throws(() => validateStageReadyEnvelope({ ...envelope, kind: 'presentation_export' } as unknown as StageReadyEnvelope));
  }
});
test('native rendering runs only after an active claim and acknowledged dispatch; disabled mode does not claim', async () => {
  for (const enabled of [false, true]) {
    const envelope = { event_id: '22222222-2222-4222-8222-222222222222', event_type: 'job.stage_ready', contract_version: '1.0', job_id: '11111111-1111-4111-8111-111111111111', kind: 'presentation_render', stage: 'render_presentation', input_hash: 'a'.repeat(64), correlation_id: 'synthetic-presentation-runtime' } as StageReadyEnvelope; const calls: string[] = [];
    const gateway: StageRuntimeGateway = { async claimOutbox() { calls.push('outbox'); return { leases: [{ id: envelope.event_id, lease_token: 'synthetic-dispatch', lease_expires_at: new Date(Date.now() + 90000).toISOString(), envelope }] }; }, async claim() { calls.push('claim'); return { job_id: envelope.job_id, stage: envelope.stage, input: { input_hash: envelope.input_hash }, already_completed: false } as unknown as StageLease; }, async finishOutbox(_id, _token, accepted) { calls.push(accepted ? 'ack' : 'nack'); return { acknowledged: accepted, stale: false }; }, async getInput() { throw Error('unused'); }, async recordEvent() { throw Error('unused'); }, async recover() { return { recovered: 0 }; } };
    const router: SpecsStageRouter = { async route(value) { calls.push('n8n'); return { schema_version: '1.0', event_id: value.event_id, job_id: value.job_id, kind: value.kind, stage: value.stage, input_hash: value.input_hash, correlation_id: value.correlation_id, workflow_execution_id: 'synthetic-wf03', handler: 'native.render_presentation' }; } };
    const result = await processNextSpecsStage(gateway, router, { openAI: { apiKey: 'synthetic', model: 'synthetic' }, ...(enabled ? { presentation: { assets: { async read() { throw Error('unused'); }, async write() { throw Error('unused'); } } } } : {}), executePresentation: async () => { assert.deepEqual(calls, ['outbox', 'n8n', 'claim', 'ack']); calls.push('native'); return { already_completed: false, receipt: { event_id: 'synthetic-result', applied: true, duplicate: false, stale: false, job_status: 'running' } }; }, execute: async () => { throw Error('Wrong executor'); } });
    assert.equal(result.event, enabled ? 'stage_callback_committed' : 'dispatch_rejected'); assert.equal(calls.includes('claim'), enabled); assert.equal(calls.includes('native'), enabled);
  }
});
