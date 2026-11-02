import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { evaluateOnce, SETTINGS } from './evaluate.mts';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import type { SpecsExtractionOutput } from '../../../packages/integrations/src/specs-types.ts';
const run = '00000000-0000-4000-8000-000000000001';
function fixture() {
  let claimed = false, calls = 0, persisted = 0;
  const receipts: unknown[] = [];
  const prepared = { schema_version: 'pdf47-low-effort-input.v1', job_id: '47f86513-8999-4946-b5d9-f2fd6a18fd00',
    source_asset_id: '0fbc905f-c51e-472d-9d03-74664ee9ac86', configured_model: 'gpt-6.1-sol', prepared_source_verified: true,
    prepared_text_bytes: 12_807, mapped_pages: 24, input: { sourceAssetId: '0fbc905f-c51e-472d-9d03-74664ee9ac86',
      correlationId: run, inputHash: 'a'.repeat(64), paragraphs: Array.from({ length: 219 }, (_, index) => ({ index, page: index % 24 + 1, text: 'PRIVATE_SOURCE_CANARY' })) } };
  const output = { result: { schema_version: '1.0', source_asset_id: prepared.source_asset_id, source_language_codes: [],
    roles: [], clarifications: [], general_instructions: 'PRIVATE_RESULT_CANARY' },
    metadata: { request_id: 'req_evaluation', usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } } } as unknown as SpecsExtractionOutput;
  const ports = { async read() { return prepared; }, config() { return { model: SETTINGS.model, apiKey: 'PRIVATE_KEY_CANARY' }; },
    async seals() { return { 'packages/integrations/src/openai-specs.ts': 'aa72bb5a46a91142a07968b80bcd49b0361cd51fc091cc543b5c2a874f84bdb9' }; },
    async claim() { assert(!claimed); claimed = true; }, async receipt(_phase: string, value: unknown) { receipts.push(value); },
    async extract(_input: unknown, config: unknown) { calls++; assert.deepEqual(config, { model: SETTINGS.model, apiKey: 'PRIVATE_KEY_CANARY',
      timeoutMs: 60_000, maxOutputTokens: 16_384, reasoningEffort: 'low' }); assert(claimed); return output; },
    async persist() { persisted++; } };
  return { ports, prepared, output, receipts, count: () => ({ claimed, calls, persisted }) };
}
test('one explicit low request has permanent predispatch settings and private result only', async () => {
  const value = fixture(); const result = await evaluateOnce(run, value.ports);
  assert.equal(result.result, 'validated'); assert.deepEqual(value.count(), { claimed: true, calls: 1, persisted: 1 });
  assert.equal((value.receipts[0] as { result: string }).result, 'dispatch_started');
  assert(!JSON.stringify(value.receipts).includes('PRIVATE_'));
  assert.equal(result.reasoning_token_count_observed, false);
  await assert.rejects(evaluateOnce(run, value.ports)); assert.equal(value.count().calls, 1);
});
test('source drift or malformed retained paragraphs refuse before claim or extraction', async () => {
  for (const mode of ['drift', 'paragraph', 'source', 'model']) {
    const value = fixture();
    if (mode === 'drift') value.ports.seals = async () => ({ 'packages/integrations/src/openai-specs.ts': 'b'.repeat(64) });
    if (mode === 'paragraph') value.prepared.input.paragraphs[1].index = 0;
    if (mode === 'source') value.prepared.prepared_source_verified = false;
    if (mode === 'model') value.prepared.configured_model = 'other-model';
    await assert.rejects(evaluateOnce(run, value.ports)); assert.deepEqual(value.count(), { claimed: false, calls: 0, persisted: 0 });
  }
});
test('timeout has one unknown paid outcome and same-run replay cannot dispatch', async () => {
  let dispatched = 0;
  const value = fixture(); value.ports.extract = async () => { dispatched++; throw new IntegrationError('OPENAI_TIMEOUT', 'PRIVATE_ERROR_CANARY', true,
    { request_id: 'req_timeout', http_status: 504 }); };
  const result = await evaluateOnce(run, value.ports);
  assert('code' in result);
  assert.equal(result.code, 'OPENAI_TIMEOUT'); assert.equal(result.provider_request_id, 'req_timeout');
  assert.equal(result.charge_or_remote_completion_unknown, true); assert(!JSON.stringify(value.receipts).includes('PRIVATE_'));
  await assert.rejects(evaluateOnce(run, value.ports)); assert.equal(dispatched, 1);
});
test('predispatch receipt failure consumes claim without making a provider request', async () => {
  const value = fixture(); value.ports.receipt = async () => { throw Error('PRIVATE_RECEIPT_PATH_CANARY'); };
  await assert.rejects(evaluateOnce(run, value.ports)); assert.deepEqual(value.count(), { claimed: true, calls: 0, persisted: 0 });
  await assert.rejects(evaluateOnce(run, value.ports)); assert.equal(value.count().calls, 0);
});
test('private persistence failure cannot repeat extraction or publish output', async () => {
  const value = fixture(); value.ports.persist = async () => { throw Error('PRIVATE_PATH_CANARY'); };
  const result = await evaluateOnce(run, value.ports);
  assert.equal(result.result, 'unknown_private_persistence'); assert.equal(value.count().calls, 1);
  assert(!JSON.stringify(value.receipts).includes('PRIVATE_')); await assert.rejects(evaluateOnce(run, value.ports));
  assert.equal(value.count().calls, 1);
});
test('actual disabled entry refuses before private bridge, env config or provider', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'development/m07/pdf47-low-effort-evaluation/evaluate.mts', 'evaluate', run],
    { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: 'PRIVATE_KEY_CANARY' } });
  assert.equal(result.status, 1); assert(!result.stdout.includes('PRIVATE_')); assert(!result.stderr.includes('PRIVATE_'));
  assert(result.stderr.includes('PDF47_LOW_EFFORT_EVALUATION_REFUSED'));
});
