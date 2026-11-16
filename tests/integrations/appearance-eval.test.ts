import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
// @ts-expect-error The evaluation runner is a plain ESM tool without type declarations.
import { parseArgs, runEvaluation } from '../../tools/cycle7/appearance-eval.mjs';
import { APPEARANCE_ATTRIBUTE_KEYS } from '../../packages/integrations/src/openai-appearance.ts';

// Synthetic JPEG-shaped files and a recorded fake transport: no provider call, no database.
function fixture(count: number) {
  const dir = mkdtempSync(join(tmpdir(), 'eps-appearance-eval-'));
  const manifest = Array.from({ length: count }, (_value, index) => {
    writeFileSync(join(dir, `p${index}.jpg`), Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, index, 9]));
    return { candidate_id: `synthetic-${index}`, images: [{ path: `p${index}.jpg`, source_kind: 'photo' }] };
  });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest)); return join(dir, 'manifest.json');
}
const answer = (request: { text: { format: { schema: { properties: { media: { items: { properties: { media_ref: { enum: string[] } } } } } } } } }) => ({
  id: 'resp_synthetic', model: 'configured-model', status: 'completed', usage: { input_tokens: 100_000, output_tokens: 10_000, total_tokens: 110_000 },
  output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ schema_version: '1.0',
    media: request.text.format.schema.properties.media.items.properties.media_ref.enum.map(ref => ({ media_ref: ref, media_category: 'headshot', people_count: 1, ambiguous: false, quality_note: null,
      people: [{ person_index: 0, position_note: null, attributes: Object.fromEntries(APPEARANCE_ATTRIBUTE_KEYS.map(key => [key, { value: 'unknown', confidence: 'low', evidence: null }])) }] })) }) }] }] });
const env = { OPENAI_API_KEY: 'synthetic-key', OPENAI_EXTRACTION_MODEL: 'configured-model' };

test('dry run is the default and sends nothing', async () => {
  let calls = 0; const options = parseArgs(['--manifest', fixture(3)]);
  const report = await runEvaluation(options, env, async () => { calls++; return null; }, () => undefined);
  assert.equal(calls, 0); assert.equal(report.mode, 'dry_run'); assert.equal(report.candidates.length, 3); assert.equal(report.candidates[0].images[0].bytes, undefined);
});
test('execute records usage and cost from a supplied price table and stops at --max-usd', async () => {
  let calls = 0;
  // 100k input x 1 USD/Mtok + 10k output x 10 USD/Mtok = 0.2 USD per call.
  const options = parseArgs(['--manifest', fixture(5), '--execute', '--max-usd', '0.5', '--input-usd-per-mtok', '1', '--output-usd-per-mtok', '10']);
  const report = await runEvaluation(options, env, async (request: never) => { calls++; return answer(request); }, () => undefined);
  assert.equal(calls, 2); assert.equal(report.stopped_reason, 'max_usd'); assert.ok(Math.abs(report.spent_usd - 0.4) < 1e-9);
  assert.equal(report.candidates[0].status, 'analysed'); assert.equal(report.candidates[0].observations[0].people[0].attributes.hair_colour.value, 'unknown');
  assert.equal(report.totals.input_tokens, 200_000);
});
test('execute refuses without prices, cap or configured model', async () => {
  await assert.rejects(runEvaluation(parseArgs(['--manifest', fixture(1), '--execute', '--max-usd', '1']), env, undefined, () => undefined), /prices/u);
  await assert.rejects(runEvaluation(parseArgs(['--manifest', fixture(1), '--execute', '--input-usd-per-mtok', '1', '--output-usd-per-mtok', '1']), env, undefined, () => undefined), /max-usd/u);
  await assert.rejects(runEvaluation(parseArgs(['--manifest', fixture(1), '--execute', '--max-usd', '1', '--input-usd-per-mtok', '1', '--output-usd-per-mtok', '1']), { OPENAI_API_KEY: 'k' }, undefined, () => undefined), /OPENAI_EXTRACTION_MODEL/u);
  assert.throws(() => parseArgs(['--manifest', 'x', '--batch', 'y']), /exactly one/u);
});
