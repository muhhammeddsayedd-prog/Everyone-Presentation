import assert from 'node:assert/strict';
import test from 'node:test';
import type { StageLease } from '@eps/jobs';
import { rootCertificates } from 'node:tls';
import { processNextSpecsStage } from '../../apps/worker/src/runtime.ts';
import { verifySpecsWorkerStartup } from '../../apps/worker/src/runtime-main.ts';
import { validateSpecsWorkOrder } from '../../apps/worker/src/n8n-orchestrator.ts';
import { validateStageReadyEnvelope } from '../../packages/integrations/src/n8n-dispatch.ts';
import type { StageRuntimeGateway, SpecsStageRouter } from '../../apps/worker/src/runtime-types.ts';
const envelope = { event_id: '10000000-0000-4000-8000-000000000001', event_type: 'job.stage_ready' as const, contract_version: '1.0' as const,
  job_id: '20000000-0000-4000-8000-000000000001', kind: 'candidate_scan' as const, stage: 'prepare_candidate' as const, input_hash: 'a'.repeat(64), correlation_id: 'candidate-runtime-test' };
const order = { schema_version: '1.0' as const, event_id: envelope.event_id, job_id: envelope.job_id, kind: envelope.kind, stage: envelope.stage,
  input_hash: envelope.input_hash, correlation_id: envelope.correlation_id, workflow_execution_id: 'workflow-test', handler: 'native.prepare_candidate' as const };
const provider = { apiKey: 'synthetic-private-provider-key', model: 'synthetic-test-model' };
test('candidate order allowlist rejects a specs stage or arbitrary handler under candidate kind', () => {
  validateStageReadyEnvelope(envelope); assert.deepEqual(validateSpecsWorkOrder(order, envelope), order);
  assert.throws(() => validateStageReadyEnvelope({ ...envelope, stage: 'extract_specs' }), { code: 'DISPATCH_ENVELOPE_INVALID' });
  assert.throws(() => validateSpecsWorkOrder({ ...order, handler: 'native.shell' }, envelope), { code: 'N8N_WORK_ORDER_INVALID' });
});
function runtime() {
  const calls: string[] = []; const gateway: StageRuntimeGateway = {
    claimOutbox: async () => ({ leases: [{ id: envelope.event_id, lease_token: 'synthetic-dispatch-token', lease_expires_at: new Date(Date.now() + 90_000).toISOString(), envelope }] }),
    claim: async (): Promise<StageLease> => { calls.push('claim'); return { job_id: envelope.job_id, stage: envelope.stage, attempt_id: '30000000-0000-4000-8000-000000000001', lease_token: 'synthetic-stage-token', lease_expires_at: new Date(Date.now() + 90_000).toISOString(), already_completed: false, input: { input_hash: envelope.input_hash } }; },
    finishOutbox: async (_id, _token, accepted) => { calls.push(accepted ? 'ack' : 'nack'); return { acknowledged: accepted, stale: false }; },
    getInput: async () => { throw new Error('unexpected'); }, recordEvent: async () => { throw new Error('unexpected'); }, recover: async () => ({ recovered: 0 }),
  };
  const router: SpecsStageRouter = { route: async () => { calls.push('n8n'); return order; } }; return { calls, gateway, router };
}
test('candidate execution requires n8n work order and durable ACK; disabled candidate mode never claims', async () => {
  const disabled = runtime(); await processNextSpecsStage(disabled.gateway, disabled.router, { openAI: provider }); assert.deepEqual(disabled.calls, ['n8n', 'nack']);
  const enabled = runtime(); const unavailable = async (): Promise<never> => { throw new Error('No bytes in control-plane test'); };
  const value = await processNextSpecsStage(enabled.gateway, enabled.router, { openAI: provider, candidate: { imageId: `sha256:${'b'.repeat(64)}`, transcription: provider, extraction: provider, assets: { read: unavailable, write: unavailable } },
    execute: async () => { throw new Error('Specs executor must not run.'); }, executeCandidate: async () => { enabled.calls.push('candidate'); return { already_completed: false as const, receipt: { event_id: 'test', applied: true, duplicate: false, stale: false, job_status: 'queued' as const } }; } });
  assert.deepEqual(enabled.calls, ['n8n', 'claim', 'ack', 'candidate']); assert.equal(value.event, 'stage_callback_committed');
});
test('runtime accepts a confirmed duplicate callback but rejects stale or unconfirmed receipts', async () => {
  for (const [duplicate, stale, expected] of [[true, false, 'stage_callback_committed'], [true, true, 'stage_unconfirmed'], [false, false, 'stage_unconfirmed']] as const) {
    const state = runtime(); let executions = 0; const unavailable = async (): Promise<never> => { throw new Error('No media or provider calls expected'); };
    const result = await processNextSpecsStage(state.gateway, state.router, { openAI: provider, candidate: { imageId: `sha256:${'b'.repeat(64)}`, transcription: provider, extraction: provider, assets: { read: unavailable, write: unavailable } },
      executeCandidate: async () => { executions++; return { already_completed: false as const, receipt: { event_id: 'synthetic-event', applied: false, duplicate, stale, job_status: 'queued' as const } }; } });
    assert.equal(result.event, expected); assert.equal(executions, 1); assert.deepEqual(state.calls, ['n8n', 'claim', 'ack']);
  }
});
const environment = { OPENAI_API_KEY: provider.apiKey, OPENAI_EXTRACTION_MODEL: provider.model, OPENAI_TRANSCRIPTION_MODEL: 'transcription-test',
  N8N_DISPATCH_URL: 'https://synthetic.app.n8n.cloud/webhook/specs', N8N_DISPATCH_SECRET: 'synthetic-specs-secret-123456789012345',
  N8N_CANDIDATE_DISPATCH_URL: 'https://synthetic.app.n8n.cloud/webhook/candidate', N8N_CANDIDATE_DISPATCH_SECRET: 'synthetic-candidate-secret-1234567890',
  EPS_CANDIDATE_MEDIA_ENABLED: 'true', EPS_MEDIA_IMAGE_ID: `sha256:${'b'.repeat(64)}`, EPS_SPECS_FILES_ENABLED: 'true',
  EPS_SPECS_PG_HOST: 'aws-0-eu-west-1.pooler.supabase.com', EPS_SPECS_PG_PASSWORD: 'synthetic-runtime-private-key-long-enough', EPS_SPECS_PG_CA_BASE64: Buffer.from(rootCertificates[0]).toString('base64'),
  SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_public_key' };
test('candidate startup requires independent orchestration credentials, immutable image and verified file port', async () => {
  let factories = 0; const unavailable = async (): Promise<never> => { throw new Error('No storage/provider/network in startup test'); };
  const factory = (async () => { factories++; return { close: async () => {}, candidateFiles: { getAssetAccess: unavailable, reserveOutput: unavailable, completeOutput: unavailable } }; }) as never;
  const value = await verifySpecsWorkerStartup(environment, factory); assert(value.candidate); assert.equal(value.candidate.transcription.model, 'transcription-test'); assert.equal(factories, 1);
  for (const patch of [{ EPS_MEDIA_IMAGE_ID: 'mutable:latest' }, { N8N_CANDIDATE_DISPATCH_SECRET: environment.N8N_DISPATCH_SECRET }, { EPS_SPECS_FILES_ENABLED: 'false' }, { OPENAI_TRANSCRIPTION_MODEL: '' }])
    await assert.rejects(verifySpecsWorkerStartup({ ...environment, ...patch }, factory));
  assert.equal(factories, 1);
});
