import assert from 'node:assert/strict';
import test from 'node:test';
import { rootCertificates } from 'node:tls';
import type { StageLease } from '@eps/jobs';
import { processNextSpecsStage } from '../../apps/worker/src/runtime.ts';
import { verifySpecsWorkerStartup } from '../../apps/worker/src/runtime-main.ts';
import { validateSpecsWorkOrder } from '../../apps/worker/src/n8n-orchestrator.ts';
import { validateStageReadyEnvelope } from '../../packages/integrations/src/n8n-dispatch.ts';
import type { SpecsStageRouter, StageRuntimeGateway } from '../../apps/worker/src/runtime-types.ts';
const envelope = { event_id: '10000000-0000-4000-8000-000000000001', event_type: 'job.stage_ready' as const, contract_version: '1.0' as const, job_id: '20000000-0000-4000-8000-000000000001', kind: 'frame_extract' as const, stage: 'extract_frames' as const, input_hash: 'a'.repeat(64), correlation_id: 'synthetic-frame-runtime' };
const order = { schema_version: '1.0' as const, event_id: envelope.event_id, job_id: envelope.job_id, kind: envelope.kind, stage: envelope.stage, input_hash: envelope.input_hash, correlation_id: envelope.correlation_id, workflow_execution_id: 'synthetic-real-work-order', handler: 'native.extract_frames' as const };
const unavailable = async (): Promise<never> => { throw new Error('No native/byte/provider operation in this control-plane test'); };
const provider = { apiKey: 'synthetic-unused-key', model: 'synthetic-unused-model' };
function fixture() {
  const calls: string[] = [];
  const gateway: StageRuntimeGateway = { claimOutbox: async () => ({ leases: [{ id: envelope.event_id, lease_token: 'synthetic-dispatch-lease', lease_expires_at: new Date(Date.now() + 90_000).toISOString(), envelope }] }),
    claim: async (): Promise<StageLease> => { calls.push('claim'); return { job_id: envelope.job_id, stage: envelope.stage, attempt_id: '30000000-0000-4000-8000-000000000001', lease_token: 'synthetic-stage-lease', lease_expires_at: new Date(Date.now() + 90_000).toISOString(), already_completed: false, input: { input_hash: envelope.input_hash } }; },
    finishOutbox: async (_id, _token, accepted) => { calls.push(accepted ? 'ack' : 'nack'); return { acknowledged: accepted, stale: false }; }, getInput: unavailable, recordEvent: unavailable, recover: async () => ({ recovered: 0 }) };
  const router: SpecsStageRouter = { route: async () => { calls.push('n8n'); return order; } }; return { calls, gateway, router };
}
test('frame kind/stages are closed and a disabled frame executor cannot claim or perform native work', async () => {
  validateStageReadyEnvelope(envelope); assert.deepEqual(validateSpecsWorkOrder(order, envelope), order);
  assert.throws(() => validateStageReadyEnvelope({ ...envelope, stage: 'transcribe_candidate' }), { code: 'DISPATCH_ENVELOPE_INVALID' });
  assert.throws(() => validateSpecsWorkOrder({ ...order, handler: 'native.shell' }, envelope), { code: 'N8N_WORK_ORDER_INVALID' });
  const state = fixture(); await processNextSpecsStage(state.gateway, state.router, { openAI: provider }); assert.deepEqual(state.calls, ['n8n', 'nack']);
});
test('frame execution starts only after bound n8n order/claim/ACK and never chooses a provider executor', async () => {
  const state = fixture(); const result = await processNextSpecsStage(state.gateway, state.router, { openAI: provider, frames: { imageId: `sha256:${'e'.repeat(64)}`, assets: { read: unavailable, write: unavailable } },
    execute: unavailable, executeCandidate: unavailable, executeFrames: async () => { state.calls.push('frames'); return { already_completed: false as const, receipt: { event_id: 'synthetic-event', applied: false, duplicate: true, stale: false, job_status: 'queued' as const } }; } });
  assert.equal(result.event, 'stage_callback_committed'); assert.deepEqual(state.calls, ['n8n', 'claim', 'ack', 'frames']);
});
const environment = { OPENAI_API_KEY: provider.apiKey, OPENAI_EXTRACTION_MODEL: provider.model, EPS_CANDIDATE_MEDIA_ENABLED: 'false', EPS_FRAME_EXTRACTION_ENABLED: 'true', EPS_FRAME_IMAGE_ID: `sha256:${'e'.repeat(64)}`, EPS_SPECS_FILES_ENABLED: 'true',
  N8N_DISPATCH_URL: 'https://synthetic.app.n8n.cloud/webhook/specs', N8N_DISPATCH_SECRET: 'synthetic-specs-secret-123456789012345', N8N_CANDIDATE_DISPATCH_URL: 'https://synthetic.app.n8n.cloud/webhook/media', N8N_CANDIDATE_DISPATCH_SECRET: 'synthetic-media-secret-123456789012345',
  EPS_SPECS_PG_HOST: 'aws-0-eu-west-1.pooler.supabase.com', EPS_SPECS_PG_PASSWORD: 'synthetic-private-runtime-key-long-enough', EPS_SPECS_PG_CA_BASE64: Buffer.from(rootCertificates[0]).toString('base64'), SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_public_key' };
test('frame startup is independently enabled with an immutable pin and verified scoped bytes port', async () => {
  let factories = 0;
  const factory = (async (_configuration: unknown, _dependencies: unknown, _files: unknown, _replay: unknown, mediaEnabled: boolean) => { factories++; assert.equal(mediaEnabled, true); return { close: async () => {}, candidateFiles: { getAssetAccess: unavailable, reserveOutput: unavailable, completeOutput: unavailable } }; }) as never;
  const context = await verifySpecsWorkerStartup(environment, factory); assert(context.frames); assert.equal(context.frames.imageId, environment.EPS_FRAME_IMAGE_ID); assert.equal(context.candidate, undefined); assert.equal(factories, 1);
  for (const changed of [{ EPS_FRAME_EXTRACTION_ENABLED: 'yes' }, { EPS_FRAME_IMAGE_ID: 'mutable:latest' }, { EPS_SPECS_FILES_ENABLED: 'false' }]) await assert.rejects(verifySpecsWorkerStartup({ ...environment, ...changed }, factory), { code: 'FRAME_RUNTIME_CONFIGURATION_INVALID' });
  assert.equal(factories, 1);
});
