import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { executeSpecsStage, DOCUMENT_PREPARATION_VERSION, SpecsExecutionError, type SpecsStageGateway } from '../../apps/worker/src/specs-executor.ts';
import { preparePastedText } from '../../apps/worker/src/pasted-text.ts';
import { extractSpecs, IntegrationError } from '@eps/integrations';
import type { JobEvent, JobEventReceipt, StageLease } from '@eps/jobs';

const source = '\ufeffWaiter needed.\r\nالعمر غير محدد.\r\n\r\nNo shoot date.';
const sourceHash = createHash('sha256').update(source).digest('hex');
const configuration = { document_preparation_version: DOCUMENT_PREPARATION_VERSION, model_version: 'synthetic-model',
  prompt_version: 'spec_extract_v1.0.0', result_schema_version: '1.0' };
const openAI = { apiKey: 'synthetic-test-key', model: configuration.model_version };
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sorted(item)]));
}
function fixture(stage = 'prepare_document') {
  // Actual SQL kernel uses 32 random bytes encoded as64 hex characters. The
  // executor treats a bounded token as opaque, also supporting the pure kernel.
  const lease: StageLease = { job_id: 'synthetic-job', attempt_id: 'synthetic-attempt', stage, lease_token: 'a'.repeat(64),
    lease_expires_at: new Date(Date.now() + 90_000).toISOString(), already_completed: false,
    input: { input_hash: 'b'.repeat(64), source_hash: sourceHash, specs_id: 'synthetic-spec', configuration: { ...configuration } } };
  const common = { job_id: lease.job_id, attempt_id: lease.attempt_id, stage, input_hash: lease.input.input_hash,
    correlation_id: 'synthetic-correlation', configuration: { ...configuration } };
  const prepared = preparePastedText(source);
  const input = stage === 'apply_specs' ? { ...common, specs_id: 'synthetic-spec', workspace_id: 'synthetic-workspace', source_sha256: sourceHash }
    : stage === 'prepare_document' ? { ...common, source_kind: 'pasted_text', source_asset_id: null, source_sha256: sourceHash, source_text: source }
      : { ...common, source_kind: 'pasted_text', source_asset_id: null, source_sha256: sourceHash, text: prepared.text, paragraphs: prepared.paragraphs };
  const events: JobEvent[] = [];
  const receipt = (event: JobEvent): JobEventReceipt => ({ event_id: event.event_id, applied: true, duplicate: false, stale: false,
    job_status: event.event_type === 'heartbeat' ? 'running' : 'queued' });
  const gateway: SpecsStageGateway = { getInput: async () => sorted(input),
    recordEvent: async event => { events.push(structuredClone(event)); return receipt(event); } };
  return { lease, input, gateway, events, receipt, prepared };
}
const emptyResult = { schema_version: '1.0', source_asset_id: null, source_language_codes: ['en', 'ar'], roles: [], general_instructions: null, clarifications: [] };
const syntheticExtract: typeof extractSpecs = (input, config, _transport, signal) => extractSpecs(input, config, async () => ({
  id: 'resp_synthetic', _request_id: 'req_synthetic', model: 'synthetic-resolved-model', status: 'completed', error: null,
  output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(emptyResult) }] }],
  usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
}), signal);

test('real parser preparation accepts PostgreSQL JSON key order, keeps original hash and publishes refs-only metadata', async () => {
  const { lease, gateway, events, prepared } = fixture();
  await executeSpecsStage(lease, gateway);
  assert.equal(events.length, 1);
  assert.equal(events[0].event_type, 'succeeded');
  assert.equal(events[0].result_schema, 'document-preparation.v1');
  assert.deepEqual(events[0].result, { source_asset_id: null, text_asset_id: null, page_assets: [],
    paragraph_count: prepared.paragraphs.length, extraction_method: 'plain_text', warnings: [] });
  assert.ok(!JSON.stringify(events[0].result).includes('Waiter'));
  assert.equal(events[0].input_hash, lease.input.input_hash);
});

test('extraction projects evidence fields exactly and retains validated payload plus provider metadata without SDK retries', async () => {
  const { lease, gateway, events } = fixture('extract_specs'); let calls = 0;
  await executeSpecsStage(lease, gateway, { openAI, extract: async (...args) => {
    calls++;
    assert.deepEqual(Object.keys(args[0].paragraphs[0]).sort(), ['index', 'page', 'text']);
    return syntheticExtract(...args);
  } });
  assert.equal(calls, 1); assert.equal(events.length, 1);
  assert.equal(events[0].result_schema, 'specs-extraction-stage.v1');
  assert.deepEqual(events[0].result?.result, emptyResult);
  assert.equal((events[0].result?.metadata as Record<string, unknown>).correlation_id, 'synthetic-correlation');
  assert.deepEqual((events[0].result?.metadata as Record<string, unknown>).usage, { input_tokens: 10, output_tokens: 20, total_tokens: 30 });
  assert.ok(!JSON.stringify(events).includes(openAI.apiKey));
});

test('apply sends only immutable resource refs; the SQL domain operation computes facts and summary', async () => {
  const { lease, gateway, events } = fixture('apply_specs');
  await executeSpecsStage(lease, gateway, { extract: async () => { throw new Error('Provider must not run'); } });
  assert.equal(events[0].result_schema, 'specs-application.v1');
  assert.deepEqual(events[0].result, { specs_id: 'synthetic-spec', workspace_id: 'synthetic-workspace' });
});

test('heartbeats serialize with one terminal callback and stop after completion', async () => {
  const { lease, gateway, events, receipt } = fixture('extract_specs'); let active = 0; let peak = 0;
  gateway.recordEvent = async event => { active++; peak = Math.max(peak, active); await delay(20);
    events.push(structuredClone(event)); active--; return receipt(event); };
  await executeSpecsStage(lease, gateway, { openAI, heartbeatMs: 10, extract: async (...args) => { await delay(80); return syntheticExtract(...args); } });
  assert.equal(peak, 1);
  assert.ok(events.some(event => event.event_type === 'heartbeat'));
  assert.equal(events.filter(event => event.event_type === 'succeeded').length, 1);
  assert.equal(events.at(-1)?.event_type, 'succeeded');
  assert.deepEqual(events.map(event => event.sequence), events.map((_, index) => index + 1));
  const amount = events.length; await delay(40); assert.equal(events.length, amount);
});

test('unknown or stale heartbeat aborts the adapter and never fabricates a terminal callback', async () => {
  for (const stale of [false, true]) {
    const { lease, gateway, events, receipt } = fixture('extract_specs'); let aborted = false;
    gateway.recordEvent = async event => { events.push(structuredClone(event));
      if (!stale) throw new Error('synthetic private transport details');
      return { ...receipt(event), applied: false, stale: true }; };
    await assert.rejects(executeSpecsStage(lease, gateway, { openAI, heartbeatMs: 10, extract: async (_input, _config, _transport, signal) =>
      new Promise((_resolve, reject) => { signal!.addEventListener('abort', () => { aborted = true; reject(new Error('private abort reason')); }, { once: true }); }) }),
    (error: unknown) => error instanceof SpecsExecutionError && error.code === (stale ? 'LEASE_STALE' : 'CALLBACK_UNCONFIRMED')
      && !error.message.includes('private'));
    assert.equal(aborted, true); assert.equal(events.length, 1); assert.equal(events[0].event_type, 'heartbeat');
  }
});

test('known provider failure emits one safe classified failure, never a second model request', async () => {
  const { lease, gateway, events } = fixture('extract_specs'); let calls = 0;
  await executeSpecsStage(lease, gateway, { openAI, extract: async () => { calls++;
    throw new IntegrationError('OPENAI_RATE_LIMITED', 'private raw provider message', true, { retry_after_ms: 2000 }); } });
  assert.equal(calls, 1); assert.equal(events.length, 1); assert.equal(events[0].event_type, 'failed');
  assert.deepEqual(events[0].error?.details, { retry_after_seconds: 2 });
  assert.equal(events[0].error?.code, 'PROVIDER_RATE_LIMITED');
  assert.ok(!JSON.stringify(events).includes('private raw'));
});

test('tampered input scope, source, configuration and paragraph evidence are denied before provider or callback', async () => {
  for (const mutate of [(value: Record<string, unknown>) => { value.job_id = 'other'; },
    (value: Record<string, unknown>) => { value.source_sha256 = 'c'.repeat(64); },
    (value: Record<string, unknown>) => { value.paragraphs = [{ index: 0, page: null, start: 0, end: 5, text: 'Forged' }]; },
    (value: Record<string, unknown>) => { value.configuration = { ...configuration, model_version: 'other-model' }; }]) {
    const { lease, input, gateway, events } = fixture('extract_specs'); mutate(input);
    gateway.getInput = async () => input;
    await assert.rejects(executeSpecsStage(lease, gateway, { openAI, extract: async () => { throw new Error('must not call'); } }),
      (error: unknown) => error instanceof SpecsExecutionError && error.code === 'STAGE_INPUT_INVALID');
    assert.equal(events.length, 0);
  }
});

test('completed, expired and already-cancelled attempts perform no source read or provider work', async () => {
  const { lease, gateway } = fixture(); let reads = 0;
  gateway.getInput = async () => { reads++; throw new Error('must not read'); };
  assert.deepEqual(await executeSpecsStage({ ...lease, already_completed: true, lease_token: '' }, gateway), { already_completed: true, receipt: null });
  await assert.rejects(executeSpecsStage({ ...lease, lease_expires_at: '2000-01-01T00:00:00Z' }, gateway));
  await assert.rejects(executeSpecsStage(lease, gateway, { signal: AbortSignal.abort() }));
  assert.equal(reads, 0);
});

test('caller mutation cannot redirect an in-flight attempt to another job or credential', async () => {
  const { lease, gateway, input, events } = fixture('apply_specs');
  let release!: () => void;
  gateway.getInput = async () => { await new Promise<void>(resolve => { release = resolve; }); return input; };
  const running = executeSpecsStage(lease, gateway);
  await Promise.resolve();
  lease.job_id = 'other-job'; lease.lease_token = 'z'.repeat(43); lease.input.input_hash = 'c'.repeat(64);
  release(); await running;
  assert.equal(events[0].job_id, 'synthetic-job'); assert.equal(events[0].lease_token, 'a'.repeat(64));
  assert.equal(events[0].input_hash, 'b'.repeat(64));
});

test('gateway deadlines reject unresolved input and completion without repeating work', async () => {
  for (const inputTimeout of [true, false]) {
    const { lease, gateway, events } = fixture('apply_specs');
    if (inputTimeout) gateway.getInput = () => new Promise(() => {});
    else gateway.recordEvent = event => { events.push(structuredClone(event)); return new Promise(() => {}); };
    await assert.rejects(Promise.race([
      executeSpecsStage(lease, gateway, { gatewayTimeoutMs: 10 }),
      delay(200).then(() => { throw new Error('Gateway stayed hung'); }),
    ]), (error: unknown) => error instanceof SpecsExecutionError && error.code === (inputTimeout ? 'STAGE_INPUT_INVALID' : 'CALLBACK_UNCONFIRMED'));
    assert.equal(events.length, inputTimeout ? 0 : 1);
  }
});

test('an unresolved gateway heartbeat cannot hang cancellation or start a competing completion', async () => {
  const { lease, gateway, events } = fixture('extract_specs'); const controller = new AbortController();
  gateway.recordEvent = event => { events.push(structuredClone(event)); return new Promise(() => {}); };
  const running = executeSpecsStage(lease, gateway, { openAI, signal: controller.signal, heartbeatMs: 10,
    extract: async (_input, _config, _transport, signal) => new Promise((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(new Error('synthetic adapter abort')), { once: true });
    }) });
  const timer = setTimeout(() => controller.abort(), 40);
  try {
    await assert.rejects(Promise.race([running, delay(200).then(() => { throw new Error('Attempt stayed hung'); })]),
      (error: unknown) => error instanceof SpecsExecutionError && error.code === 'PROCESSING_CANCELLED');
    assert.equal(events.length, 1); assert.equal(events[0].event_type, 'heartbeat');
  } finally { clearTimeout(timer); controller.abort(); }
});

test('source fetch cancelled or expired during transport never starts paid extraction', async () => {
  for (const cancel of [false, true]) {
    const { lease, gateway, input, events } = fixture('extract_specs'); const controller = new AbortController(); let calls = 0;
    if (!cancel) lease.lease_expires_at = new Date(Date.now() + 15).toISOString();
    gateway.getInput = async () => { await delay(40); return input; };
    const running = executeSpecsStage(lease, gateway, { openAI, signal: controller.signal, extract: async (...args) => { calls++; return syntheticExtract(...args); } });
    const timer = cancel ? setTimeout(() => controller.abort(), 10) : undefined;
    try {
      await assert.rejects(running, (error: unknown) => error instanceof SpecsExecutionError && error.code === (cancel ? 'PROCESSING_CANCELLED' : 'LEASE_STALE'));
      assert.equal(calls, 0); assert.equal(events.length, 0);
    } finally { clearTimeout(timer); }
  }
});
