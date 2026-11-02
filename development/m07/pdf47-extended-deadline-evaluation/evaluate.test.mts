import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { EVALUATION_ENABLED, evaluateOnce, loadVerifiedConfiguration, PRODUCTION_PINS, type Ports } from './evaluate.mts';
import { captureProductionRequest, validateProductionResponse, sendExtendedRequest, SETTINGS } from './transport.mts';
import { extractSpecs } from '../../../packages/integrations/src/openai-specs.ts';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import type { SpecsExtractionInput } from '../../../packages/integrations/src/specs-types.ts';

const run = '00000000-0000-4000-8000-000000000001';
const asset = '0fbc905f-c51e-472d-9d03-74664ee9ac86';
const config = { apiKey: 'PRIVATE_KEY_CANARY', model: 'gpt-6.1-sol' };
const input: SpecsExtractionInput = { sourceAssetId: asset, inputHash: 'a'.repeat(64), correlationId: run,
  paragraphs: Array.from({ length: 219 }, (_, index) => ({ index, page: index % 24 + 1, text: 'PRIVATE_SOURCE_CANARY' })) };
function payload() {
  return { schema_version: '1.0', source_asset_id: asset, source_language_codes: ['en'], general_instructions: 'PRIVATE_RESULT_CANARY', clarifications: [],
    roles: [{ source_role_key: 'synthetic-role', name: null, headcount: null, category: null,
      requirements: { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [],
        scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null },
      evidence: [{ asset_id: asset, page: 1, paragraph: 0, quote: 'PRIVATE_SOURCE_CANARY', segment_index: null, start_ms: null, end_ms: null }],
      clarifications: [{ field_path: 'headcount', reason: 'PRIVATE_CLARIFICATION_CANARY', source: null }] }] };
}
function response(value: unknown = payload()) {
  return { id: 'resp_synthetic', model: config.model, status: 'completed', error: null,
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } };
}
const fakeResponse = (body: unknown = response(), requestId = 'req_synthetic') => Response.json(body, { headers: { 'x-request-id': requestId } });
const code = (value: string) => (error: unknown) => error instanceof IntegrationError && error.code === value;

test('loader source refusal happens before import/credential access and valid loader config exposes only its two fields', async () => {
  const calls: string[] = [];
  const load = async () => { calls.push('load'); return { OPENAI_API_KEY: config.apiKey, OPENAI_EXTRACTION_MODEL: config.model, N8N_API_KEY: 'PRIVATE_OTHER_KEY_CANARY' }; };
  await assert.rejects(loadVerifiedConfiguration(async () => { calls.push('verify'); throw Error('Source hash mismatch'); }, load));
  assert.deepEqual(calls, ['verify']); calls.length = 0;
  const result = await loadVerifiedConfiguration(async () => { calls.push('verify'); }, load);
  assert.deepEqual(calls, ['verify', 'load']); assert.equal(result.apiKey, config.apiKey); assert.equal(result.model, config.model);
  assert(!('N8N_API_KEY' in result));
});

test('production request capture has zero SDK fetches and exact low/schema/body settings; production cap stays70s', async t => {
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; throw Error('No provider permitted'); });
  const capture = await captureProductionRequest(input, config);
  assert.equal(calls, 0); assert.equal(JSON.stringify(capture.request), capture.bytes);
  assert.equal(capture.request.model, config.model); assert.equal(capture.request.max_output_tokens, 16_384);
  assert.deepEqual(capture.request.reasoning, { effort: 'low' }); assert.equal(capture.request.store, false);
  assert.equal(capture.request.stream, false); assert.deepEqual(capture.request.tools, []);
  assert.equal((capture.request.text!.format as { strict: boolean }).strict, true);
  await assert.rejects(extractSpecs(input, { ...config, timeoutMs: 120_000 }, async () => { calls++; return response(); }), code('OPENAI_CONFIGURATION_INVALID'));
  assert.equal(calls, 0); assert.equal(SETTINGS.timeout_ms, 120_000); assert.equal(SETTINGS.production_timeout_cap_ms, 70_000);
});

test('actual SDK makes one canonical POST with exact captured bytes and production revalidation preserves evidence', async () => {
  const capture = await captureProductionRequest(input, config); let calls = 0;
  const exchange = await sendExtendedRequest(capture, config, async (url, init) => {
    calls++; assert.equal(String(url), 'https://api.openai.com/v1/responses'); assert.equal(init?.method, 'POST');
    assert.equal(init.body, capture.bytes); assert.equal(init.redirect, 'error');
    assert.equal(new Headers(init.headers).get('x-stainless-retry-count'), '0'); return fakeResponse();
  });
  const result = await validateProductionResponse(input, config, capture, exchange.response);
  assert.equal(calls, 1); assert.equal(exchange.http_status, 200); assert.equal(exchange.provider_request_id, 'req_synthetic');
  assert.equal(result.result.roles.length, 1); assert.equal(result.metadata.request_id, 'req_synthetic');
  assert.deepEqual(result.metadata.usage, { input_tokens: 10, output_tokens: 20, total_tokens: 30 });
  const drift = { ...capture, bytes: capture.bytes + ' ' };
  await assert.rejects(validateProductionResponse(input, config, drift, exchange.response), code('EVALUATION_REQUEST_DRIFT'));
});

test('actual SDK auth response exposes only static code/status/requestID, with no retry or raw error', async () => {
  const capture = await captureProductionRequest(input, config); let calls = 0;
  await assert.rejects(sendExtendedRequest(capture, config, async () => {
    calls++; return Response.json({ error: { message: 'PRIVATE_PROVIDER_BODY_CANARY', code: 'PRIVATE_ERROR_CODE_CANARY' } },
      { status: 401, headers: { 'x-request-id': 'req_denied' } });
  }), error => {
    assert(error instanceof IntegrationError); assert.equal(error.code, 'OPENAI_ACCESS_DENIED');
    assert.deepEqual(error.details, { http_status: 401, request_id: 'req_denied' });
    assert(!JSON.stringify(error).includes('PRIVATE_')); assert(!error.message.includes('PRIVATE_')); return true;
  });
  assert.equal(calls, 1);
});

test('actual SDK pending fetch remains before120s then aborts once at120s; cancellation wins', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const capture = await captureProductionRequest(input, config); let calls = 0, signal: AbortSignal | undefined;
  const pending = sendExtendedRequest(capture, config, async (_url, init) => {
    calls++; signal = init!.signal!;
    return await new Promise<Response>((_resolve, reject) => signal!.addEventListener('abort', () => reject(new DOMException('PRIVATE_ABORT_CANARY', 'AbortError')), { once: true }));
  });
  const settled = assert.rejects(pending, code('OPENAI_TIMEOUT'));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 1);
  t.mock.timers.tick(119_999); assert.equal(signal!.aborted, false);
  t.mock.timers.tick(1); await settled; assert.equal(calls, 1); assert.equal(signal!.aborted, true);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(sendExtendedRequest(capture, config, async () => { calls++; return fakeResponse(); }, controller.signal), code('PROCESSING_CANCELLED'));
  assert.equal(calls, 1);
});

function fixture() {
  let claimed = false, calls = 0, responses = 0, outputs = 0;
  const receipts: unknown[] = [];
  const prepared = { schema_version: 'pdf47-extended-input.v1', job_id: '47f86513-8999-4946-b5d9-f2fd6a18fd00', source_asset_id: asset,
    configured_model: config.model, prepared_source_verified: true, prepared_text_bytes: 12_807, mapped_pages: 24, input: structuredClone(input) };
  const ports: Ports = {
    read: async () => prepared, config: () => config, seals: async () => ({ ...PRODUCTION_PINS }),
    claim: async () => { assert(!claimed); claimed = true; }, receipt: async (_phase, value) => { receipts.push(value); },
    send: async (capture, configured) => { assert(claimed); return sendExtendedRequest(capture, configured, async () => { calls++; return fakeResponse(); }); },
    persistResponse: async () => { responses++; }, persist: async () => { outputs++; },
  };
  return { ports, receipts, prepared, count: () => ({ claimed, calls, responses, outputs }) };
}

test('one claimed actual-SDK request persists raw privately before production validation and keeps public evidence narrow', async () => {
  const f = fixture(), result = await evaluateOnce(run, f.ports);
  assert.equal(result.result, 'validated'); assert.deepEqual(f.count(), { claimed: true, calls: 1, responses: 1, outputs: 1 });
  assert.equal(result.request_semantic_bytes_equal, true); assert.equal(result.production_schema_and_evidence_validation, true);
  assert.equal(result.whole_production_function_acceptance, false); assert.equal(result.job_outbox_or_writeback, false);
  assert(!JSON.stringify(f.receipts).includes('PRIVATE_'));
  await assert.rejects(evaluateOnce(run, f.ports)); assert.equal(f.count().calls, 1);
});

test('bad evidence and incomplete responses remain private and cannot become accepted output or replay', async () => {
  for (const mode of ['evidence', 'incomplete']) {
    const f = fixture(); const bad = payload(); bad.roles[0].evidence[0].quote = 'UNSUPPORTED_QUOTE_CANARY';
    f.ports.send = async (capture, configured) => sendExtendedRequest(capture, configured, async () => fakeResponse(mode === 'evidence' ? response(bad) : { ...response(), status: 'incomplete' }));
    const result = await evaluateOnce(run, f.ports);
    assert.equal(result.result, 'failed_or_unknown'); assert.equal(result.phase, 'production_response_validation');
    assert.equal(result.code, mode === 'evidence' ? 'AI_EVIDENCE_INVALID' : 'AI_RESPONSE_INCOMPLETE');
    assert.equal(f.count().responses, 1); assert.equal(f.count().outputs, 0); assert(!JSON.stringify(f.receipts).includes('CANARY'));
    await assert.rejects(evaluateOnce(run, f.ports));
  }
});

test('unknown transport and private response/output persistence failures retain once claim without provider replay', async () => {
  for (const mode of ['transport', 'response', 'output']) {
    const f = fixture(); let calls = 0;
    if (mode === 'transport') f.ports.send = async () => { calls++; throw new IntegrationError('OPENAI_TIMEOUT', 'PRIVATE_TIMEOUT_CANARY'); };
    if (mode === 'response') f.ports.persistResponse = async () => { throw Error('PRIVATE_RESPONSE_PATH_CANARY'); };
    if (mode === 'output') f.ports.persist = async () => { throw Error('PRIVATE_OUTPUT_PATH_CANARY'); };
    const result = await evaluateOnce(run, f.ports); assert.equal(result.result, 'failed_or_unknown');
    assert.equal(result.automatic_retry, false); assert.equal(result.charge_or_remote_completion_unknown, true);
    assert(!JSON.stringify(f.receipts).includes('PRIVATE_')); const before = mode === 'transport' ? calls : f.count().calls;
    await assert.rejects(evaluateOnce(run, f.ports)); assert.equal(mode === 'transport' ? calls : f.count().calls, before); assert.equal(before, 1);
  }
});

test('drift/input and predispatch receipt failures dispatch zero SDK requests; outcome receipt failure does not write twice', async () => {
  for (const mode of ['source', 'input', 'dispatch_receipt', 'result_receipt']) {
    const f = fixture(); let resultWrites = 0;
    if (mode === 'source') f.ports.seals = async () => ({ ...PRODUCTION_PINS, 'packages/integrations/src/openai-specs.ts': 'f'.repeat(64) });
    if (mode === 'input') f.prepared.input.paragraphs[1].index = 0;
    if (mode === 'dispatch_receipt') f.ports.receipt = async () => { throw Error('PRIVATE_RECEIPT_PATH_CANARY'); };
    if (mode === 'result_receipt') f.ports.receipt = async phase => { if (phase === 'result') { resultWrites++; throw Error('PRIVATE_RECEIPT_PATH_CANARY'); } };
    await assert.rejects(evaluateOnce(run, f.ports)); assert.equal(f.count().calls, mode === 'result_receipt' ? 1 : 0);
    assert.equal(resultWrites, mode === 'result_receipt' ? 1 : 0);
  }
});

test('actual new entry remains disabled before private config/bridge/network access', () => {
  assert.equal(EVALUATION_ENABLED, false);
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'development/m07/pdf47-extended-deadline-evaluation/evaluate.mts', 'evaluate', run],
    { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: 'PRIVATE_KEY_CANARY' } });
  assert.equal(r.status, 1); assert(r.stderr.includes('PDF47_EXTENDED_EVALUATION_REFUSED'));
  assert(!r.stdout.includes('PRIVATE_')); assert(!r.stderr.includes('PRIVATE_'));
});
