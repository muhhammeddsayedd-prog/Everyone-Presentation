import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
// @ts-expect-error The evaluation runner is a plain ESM tool without type declarations.
import { parseArgs, runEvaluation, estimateCallUsd, jpegSize, compareWithSupplied } from '../../tools/cycle7/appearance-eval.mjs';
import { APPEARANCE_ATTRIBUTE_KEYS } from '../../packages/integrations/src/openai-appearance.ts';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';

// Synthetic JPEG-shaped files (with a 64x48 SOF0 header) and a recorded fake transport: no provider call, no database.
const jpeg = (seed: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x30, 0x00, 0x40, 0x03, seed, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xd9]);
const supplied = { hair_length: ['Long'], hair_colour: ['Dark Brown'], hair_texture: ['Afro'], hair_style: [], playing_age: ['Age 25-34'], skin_tone: 'Olive', tags: ['Dancer'], stated_gender: 'Female' };
function fixture(count: number) {
  const dir = mkdtempSync(join(tmpdir(), 'eps-appearance-eval-'));
  const manifest = Array.from({ length: count }, (_value, index) => {
    writeFileSync(join(dir, `p${index}.jpg`), jpeg(index));
    return { candidate_id: `synthetic-${index}`, images: [{ path: `p${index}.jpg`, source_kind: 'photo' }], supplied };
  });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest)); return { manifest: join(dir, 'manifest.json'), ledger: join(dir, 'ledger.jsonl') };
}
type Request = { text: { format: { schema: { properties: { media: { items: { properties: { media_ref: { enum: string[] } } } } } } } } };
const answer = (request: Request, values: Record<string, string> = {}) => ({
  id: 'resp_synthetic', model: 'configured-model', status: 'completed', usage: { input_tokens: 100_000, output_tokens: 10_000, total_tokens: 110_000 },
  output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ schema_version: '1.0',
    media: request.text.format.schema.properties.media.items.properties.media_ref.enum.map(ref => ({ media_ref: ref, media_category: 'headshot', people_count: 1, ambiguous: false, quality_note: null,
      people: [{ person_index: 0, position_note: null, attributes: Object.fromEntries(APPEARANCE_ATTRIBUTE_KEYS.map(key => [key, { value: values[key] ?? 'unknown', confidence: 'low', evidence: null }])) }] })) }) }] }] });
const env = { OPENAI_API_KEY: 'synthetic-key', OPENAI_EXTRACTION_MODEL: 'configured-model' };
// 1 USD/Mtok in, 10 USD/Mtok out, multiplier 1.2. Actual call: 100k x 1 + 10k x 10 = 0.2 USD.
const priced = ['--input-usd-per-mtok', '1', '--output-usd-per-mtok', '10', '--image-token-multiplier', '1.2', '--max-output-tokens', '1000'];

test('dry run is the default, sends nothing and reports a worst-case estimate from JPEG dimensions', async () => {
  let calls = 0; const files = fixture(3);
  const report = await runEvaluation(parseArgs(['--manifest', files.manifest, ...priced]), env, async () => { calls++; return null; }, () => undefined);
  assert.equal(calls, 0); assert.equal(report.mode, 'dry_run'); assert.equal(report.candidates.length, 3);
  assert.deepEqual(report.candidates[0].images[0].dimensions, { width: 64, height: 48 });
  assert.deepEqual(jpegSize(jpeg(1)), { width: 64, height: 48 });
  const estimate = estimateCallUsd([{ bytes: jpeg(1) }], parseArgs(['--manifest', 'x', ...priced]), { input_usd_per_mtok: 1, output_usd_per_mtok: 10 });
  assert.equal(estimate.output_tokens, 1000); assert.ok(estimate.usd > 0.01 && estimate.usd < 0.02, String(estimate.usd));
});
test('one aggregate budget: a call is never dispatched when its worst case could exceed what remains', async () => {
  let calls = 0; const files = fixture(5);
  const estimate = estimateCallUsd([{ bytes: jpeg(1) }], parseArgs(['--manifest', 'x', ...priced]), { input_usd_per_mtok: 1, output_usd_per_mtok: 10 }).usd;
  const cap = 0.4 + estimate / 2; // room for two actual calls; the third's worst case would cross the cap
  const report = await runEvaluation(parseArgs(['--manifest', files.manifest, '--execute', '--max-usd', String(cap), '--ledger', files.ledger, ...priced]), env,
    async (request: never) => { calls++; return answer(request, { hair_length: 'long', hair_colour: 'black', hair_texture: 'coily', playing_age: 'age_25_34', skin_tone: 'unknown' }); }, () => undefined);
  assert.equal(calls, 2); assert.equal(report.stopped_reason, 'budget_would_be_exceeded'); assert.ok(report.spent_usd <= cap);
  assert.equal(report.totals.not_dispatched, 1);
  const ledger = readFileSync(files.ledger, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(ledger.map(row => row.dispatched), [true, true, false]); assert.ok(Math.abs(ledger[1].spent_usd - 0.4) < 1e-9);
  const comparison = report.comparison;
  assert.equal(comparison.attributes.hair_length.agree, 2); assert.equal(comparison.attributes.hair_texture.agree, 2, 'Afro maps to coily');
  assert.equal(comparison.attributes.hair_colour.disagree, 2); assert.equal(comparison.attributes.skin_tone.model_unknown, 2);
  assert.equal(comparison.summary.not_observed_by_design.stated_gender, 2);
});
test('retries and failures count against the same budget; failures without usage are charged at worst case', async () => {
  const files = fixture(2); let calls = 0;
  const report = await runEvaluation(parseArgs(['--manifest', files.manifest, '--execute', '--max-usd', '5', '--retries', '1', '--ledger', files.ledger, ...priced]), env,
    async () => { calls++; throw new IntegrationError('OPENAI_UNAVAILABLE', 'synthetic outage', true); }, () => undefined);
  assert.equal(calls, 4); assert.equal(report.totals.failed, 2);
  assert.ok(report.candidates.every((entry: { attempts: { cost_basis: string }[] }) => entry.attempts.length === 2 && entry.attempts.every(attempt => attempt.cost_basis === 'worst_case_estimate')));
  assert.ok(report.spent_usd > 0);
});
test('ambiguous group photos are counted as ambiguity, never as agreement', () => {
  const result = compareWithSupplied([{ status: 'analysed', supplied, observations: [{ ambiguous: true, people: [{ attributes: { hair_length: { value: 'long' } } }, { attributes: { hair_length: { value: 'short' } } }] }] }]);
  assert.equal(result.attributes.hair_length.only_ambiguous_media, 1); assert.equal(result.attributes.hair_length.agree, 0); assert.equal(result.summary.ambiguous_media, 1);
});
test('execute refuses without prices, multiplier, cap or configured model', async () => {
  const files = fixture(1);
  await assert.rejects(runEvaluation(parseArgs(['--manifest', files.manifest, '--execute', '--max-usd', '1']), env, undefined, () => undefined), /prices/u);
  await assert.rejects(runEvaluation(parseArgs(['--manifest', files.manifest, '--execute', ...priced]), env, undefined, () => undefined), /max-usd/u);
  await assert.rejects(runEvaluation(parseArgs(['--manifest', files.manifest, '--execute', '--max-usd', '1', ...priced]), { OPENAI_API_KEY: 'k' }, undefined, () => undefined), /OPENAI_EXTRACTION_MODEL/u);
  assert.throws(() => parseArgs(['--manifest', 'x', '--batch', 'y']), /exactly one/u);
});
