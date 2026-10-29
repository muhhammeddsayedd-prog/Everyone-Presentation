import assert from 'node:assert/strict';
import test from 'node:test';
import type { StageLease } from '@eps/jobs';
import type { StageRuntimeGateway, SpecsStageRouter } from '../../apps/worker/src/runtime-types.ts';
import { processNextSpecsStage, runSpecsWorker, specsWorkerFilesConfiguration } from '../../apps/worker/src/runtime.ts';
import type { SpecsAssetPort } from '../../apps/worker/src/specs-assets.ts';

const job = '11111111-1111-4111-8111-111111111111';
const envelope = { event_id: '22222222-2222-4222-8222-222222222222', event_type: 'job.stage_ready' as const,
  contract_version: '1.0' as const, job_id: job, kind: 'specs_extract' as const, stage: 'extract_specs' as const,
  input_hash: 'a'.repeat(64), correlation_id: 'test-runtime' };
function fixture() {
  const calls: string[] = [];
  const lease = { job_id: job, stage: 'extract_specs', already_completed: false, input: { input_hash: envelope.input_hash } } as unknown as StageLease;
  const gateway: StageRuntimeGateway = {
    async claimOutbox(limit) { assert.equal(limit, 1); calls.push('outbox'); return { leases: [{ id: envelope.event_id,
      lease_token: 'synthetic-private-dispatch-token', lease_expires_at: new Date(Date.now() + 90_000).toISOString(), envelope }] }; },
    async claim(input) { calls.push('claim'); assert.equal(input.workflow_execution_id, 'actual-n8n-test-execution'); return lease; },
    async finishOutbox(_id, _token, accepted) { calls.push(accepted ? 'ack' : 'nack'); return { acknowledged: accepted, stale: false }; },
    async getInput() { throw new Error('unexpected private read'); }, async recordEvent() { throw new Error('unexpected callback'); },
    async recover() { return { recovered: 0 }; },
  };
  const router: SpecsStageRouter = { async route(value) { calls.push('n8n'); return { schema_version: '1.0', event_id: value.event_id,
    job_id: value.job_id, kind: value.kind, stage: value.stage, input_hash: value.input_hash, correlation_id: value.correlation_id,
    workflow_execution_id: 'actual-n8n-test-execution', handler: 'openai.extract_specs' }; } };
  return { gateway, router, calls, lease, execution: async () => { calls.push('provider'); return { already_completed: false as const,
    receipt: { event_id: 'test-event', applied: true, duplicate: false, stale: false, job_status: 'queued' as const } }; } };
}
const options = { apiKey: 'synthetic-injected-executor-only', model: 'synthetic-model' };

test('file mode is explicit and fixed-target, with no user JWT or service-key fallback', () => {
  assert.equal(specsWorkerFilesConfiguration({ SUPABASE_URL: 'https://foreign.invalid' }), undefined);
  assert.equal(specsWorkerFilesConfiguration({ EPS_SPECS_FILES_ENABLED: 'false' }), undefined);
  const enabled = { EPS_SPECS_FILES_ENABLED: 'true', SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_public_key' };
  assert.deepEqual(specsWorkerFilesConfiguration(enabled), { storageOrigin: enabled.SUPABASE_URL, publishableKey: enabled.SUPABASE_PUBLISHABLE_KEY });
  for (const bad of [{ ...enabled, SUPABASE_URL: 'https://foreign.invalid' }, { ...enabled, SUPABASE_PUBLISHABLE_KEY: 'eyJsynthetic-user-jwt' },
    { ...enabled, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_synthetic-private-key' }, { ...enabled, EPS_SPECS_FILES_ENABLED: '1' }]) assert.throws(() => specsWorkerFilesConfiguration(bad));
});
test('optional verified file port reaches the executor only after the n8n order and durable ACK', async () => {
  const f = fixture(); const forbidden = async (): Promise<never> => { throw new Error('No Storage transfer in this test.'); };
  const port: SpecsAssetPort = { getAssetAccess: forbidden, reserveOutput: forbidden, completeOutput: forbidden, storePreparation: forbidden };
  let received = false;
  const result = await processNextSpecsStage(f.gateway, f.router, { openAI: options, files: { port, publishableKey: 'sb_publishable_synthetic_public_key' },
    execute: async (_lease, _gateway, supplied) => {
      assert.deepEqual(f.calls, ['outbox', 'n8n', 'claim', 'ack']); assert.ok(supplied); assert.equal(supplied.files?.port, port);
      assert.equal(supplied.files?.publishableKey, 'sb_publishable_synthetic_public_key'); received = true; return f.execution();
    } });
  assert.equal(received, true); assert.equal(result.event, 'stage_callback_committed');
});

test('actual n8n work order and durable dispatch acknowledgement precede costly execution', async () => {
  const f = fixture(); const result = await processNextSpecsStage(f.gateway, f.router, { openAI: options, execute: f.execution });
  assert.deepEqual(f.calls, ['outbox', 'n8n', 'claim', 'ack', 'provider']); assert.equal(result.event, 'stage_callback_committed');
  assert.ok(!JSON.stringify(result).includes('synthetic-private-dispatch-token'));
});
test('router failure has no stage/provider bypass and records failed delivery only', async () => {
  const f = fixture(); f.router.route = async () => { throw new Error('private provider or webhook diagnostic'); };
  const result = await processNextSpecsStage(f.gateway, f.router, { openAI: options, execute: f.execution });
  assert.deepEqual(f.calls, ['outbox', 'nack']); assert.equal(result.event, 'dispatch_rejected');
  assert.ok(!JSON.stringify(result).includes('private provider'));
});
test('unknown claim and acknowledgement each stop before provider with no competing delivery action', async () => {
  for (const operation of ['claim', 'finishOutbox'] as const) {
    const f = fixture(); f.gateway[operation] = async () => { throw { code: 'DB_RESPONSE_UNKNOWN', status: 503, outcome: 'unknown', message: 'private' }; };
    const result = await processNextSpecsStage(f.gateway, f.router, { openAI: options, execute: f.execution });
    assert.equal(result.event, 'dispatch_unconfirmed'); assert.ok(!f.calls.includes('provider') && !f.calls.includes('nack'));
  }
});
test('a stale durable ACK never starts costly work', async () => {
  const f = fixture(); f.gateway.finishOutbox = async () => ({ acknowledged: false, stale: true });
  const result = await processNextSpecsStage(f.gateway, f.router, { openAI: options, execute: f.execution });
  assert.equal(result.event, 'dispatch_unconfirmed'); assert.ok(!f.calls.includes('provider'));
});
test('completed stage replay acknowledges dispatch and performs no provider work', async () => {
  const f = fixture(); f.lease.already_completed = true;
  const result = await processNextSpecsStage(f.gateway, f.router, { openAI: options, execute: f.execution });
  assert.equal(result.event, 'stage_callback_committed'); assert.deepEqual(f.calls, ['outbox', 'n8n', 'claim', 'ack']);
});
test('misbound work order cannot claim another stage or job', async () => {
  const f = fixture(); const route = f.router.route;
  f.router.route = async (...args) => ({ ...await route(...args), job_id: '33333333-3333-4333-8333-333333333333' });
  await processNextSpecsStage(f.gateway, f.router, { openAI: options, execute: f.execution });
  assert.deepEqual(f.calls, ['outbox', 'n8n', 'nack']);
});
test('an unresolved claim is aborted by the independent deadline without provider or competing ACK', async () => {
  const f = fixture(); let signal: AbortSignal | undefined;
  f.gateway.claim = async (_input, value) => { signal = value; return await new Promise(() => undefined); };
  const result = await processNextSpecsStage(f.gateway, f.router, { openAI: options, execute: f.execution, gatewayTimeoutMs: 10 });
  assert.equal(signal?.aborted, true); assert.equal(result.event, 'dispatch_unconfirmed'); assert.ok(!f.calls.includes('provider') && !f.calls.includes('nack'));
});
test('serial polling schedules recovery, stops on abort, and closes the authenticated gateway', async () => {
  const f = fixture(); const controller = new AbortController(); let recovered = 0; let closed = 0;
  f.gateway.claimOutbox = async () => ({ leases: [] }); f.gateway.recover = async () => { recovered++; return { recovered: 0 }; };
  f.gateway.close = async () => { closed++; };
  await runSpecsWorker(f.gateway, f.router, { openAI: options, signal: controller.signal,
    sleep: async () => { controller.abort(); } });
  assert.equal(recovered, 1); assert.equal(closed, 1); assert.ok(!f.calls.includes('provider'));
});
test('idle dispatch diagnostics retain only fixed gateway codes and never driver messages or properties', async () => {
  for (const code of ['RUNTIME_UNAVAILABLE', 'RUNTIME_RESPONSE_INVALID', 'RUNTIME_ROLE_UNVERIFIED', 'DEPENDENCY_UNAVAILABLE', 'private-code-containing-source']) {
    const f = fixture();
    f.gateway.claimOutbox = async () => { throw { code, message: 'private connection/source diagnostic', detail: 'secret-token', outcome: 'unknown' }; };
    const notice = await processNextSpecsStage(f.gateway, f.router, { openAI: options, execute: f.execution });
    assert.deepEqual(notice, { event: 'dispatch_unconfirmed', code: code.startsWith('private-') ? 'WORKER_OPERATION_UNCONFIRMED' : code });
    assert.deepEqual(f.calls, []);
  }
});
test('idle recovery diagnostics preserve fixed gateway codes with generic fallback and no private payload', async () => {
  for (const code of ['RUNTIME_UNAVAILABLE', 'RUNTIME_RESPONSE_INVALID', 'DEPENDENCY_UNAVAILABLE', 'private-recovery-code']) {
    const f = fixture(); const controller = new AbortController(); const notices: unknown[] = [];
    f.gateway.claimOutbox = async () => ({ leases: [] });
    f.gateway.recover = async () => { throw { code, message: 'private SQL/source diagnostic', parameters: ['private-token'] }; };
    await runSpecsWorker(f.gateway, f.router, { openAI: options, signal: controller.signal, notice: notice => notices.push(notice),
      sleep: async () => { controller.abort(); } });
    assert.deepEqual(notices, [{ event: 'recovery_unconfirmed', code: code.startsWith('private-') ? 'WORKER_OPERATION_UNCONFIRMED' : code }]);
    assert.deepEqual(f.calls, []);
  }
});
test('hostile code getters cannot bypass diagnostic redaction or break the worker loop', async () => {
  for (const hostile of [() => { let reads = 0; return { get code() { return ++reads <= 2 ? 'RUNTIME_UNAVAILABLE' : 'private-getter-value'; } }; },
    () => ({ get code(): string { throw new Error('private-getter-error'); } })]) {
    const f = fixture(); f.gateway.claimOutbox = async () => { throw hostile(); };
    const result = await processNextSpecsStage(f.gateway, f.router, { openAI: options });
    assert.ok(['RUNTIME_UNAVAILABLE', 'WORKER_OPERATION_UNCONFIRMED'].includes(result.code!));
    assert.doesNotMatch(JSON.stringify(result), /private/u);
    const controller = new AbortController(); const notices: unknown[] = [];
    f.gateway.claimOutbox = async () => ({ leases: [] }); f.gateway.recover = async () => { throw hostile(); };
    await runSpecsWorker(f.gateway, f.router, { openAI: options, signal: controller.signal, notice: value => notices.push(value), sleep: async () => { controller.abort(); } });
    assert.equal(notices.length, 1); assert.doesNotMatch(JSON.stringify(notices), /private/u);
  }
});
