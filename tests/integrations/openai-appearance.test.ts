import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { analyzeAppearance, appearanceCostUsd, appearanceSchema, APPEARANCE_ATTRIBUTE_KEYS, type AppearanceImage } from '../../packages/integrations/src/openai-appearance.ts';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';
import { APPEARANCE_PROMPT } from '../../packages/integrations/src/prompts/appearance-v1.ts';

// Synthetic JPEG-shaped bytes only; no real person, no network.
const jpeg = (seed: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, seed, 1, 2, 3]);
const image = (ref: string, kind: 'photo' | 'frame', seed: number): AppearanceImage => { const bytes = jpeg(seed);
  return { media_ref: ref, asset_id: `asset-${seed}`, source_kind: kind, frame_timestamp_ms: kind === 'frame' ? 1500 : null, sha256: createHash('sha256').update(bytes).digest('hex'), bytes }; };
const input = { candidate_ref: 'candidate-1', input_hash: 'a'.repeat(64), images: [image('m1', 'photo', 1), image('m2', 'frame', 2)] };
const config = { apiKey: 'synthetic-key', model: 'configured-model' };
const person = (index: number, overrides: Record<string, string> = {}) => ({ person_index: index, position_note: index ? 'right' : null,
  attributes: Object.fromEntries(APPEARANCE_ATTRIBUTE_KEYS.map(key => [key, { value: overrides[key] ?? 'unknown', confidence: 'low', evidence: null }])) });
const recorded = (payload: unknown, extra: Record<string, unknown> = {}) => ({ id: 'resp_synthetic', model: 'configured-model-2026-01-01', status: 'completed', _request_id: 'req_synthetic',
  usage: { input_tokens: 2400, output_tokens: 600, total_tokens: 3000 },
  output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }], ...extra });
const good = { schema_version: '1.0', media: [
  { media_ref: 'm1', media_category: 'headshot', people_count: 2, ambiguous: false, quality_note: null, people: [person(0, { hair_colour: 'black' }), person(1, { hair_colour: 'blonde' })] },
  { media_ref: 'm2', media_category: 'headshot', people_count: 1, ambiguous: false, quality_note: 'strong coloured lighting', people: [person(0, { hair_length: 'long', hair_colour: 'dark', skin_tone: 'medium' })] }] };

test('request uses configured model, store:false, no tools, strict closed schema and base64 JPEG image inputs', async () => {
  let seen: Record<string, unknown> | undefined;
  const { result, metadata } = await analyzeAppearance(input, config, undefined, async request => { seen = request as unknown as Record<string, unknown>; return recorded(good); });
  assert.equal(seen?.model, 'configured-model'); assert.equal(seen?.store, false); assert.deepEqual(seen?.tools, []); assert.equal(seen?.instructions, APPEARANCE_PROMPT);
  const format = (seen?.text as { format: { type: string; strict: boolean; schema: unknown } }).format;
  assert.equal(format.type, 'json_schema'); assert.equal(format.strict, true); assert.deepEqual(format.schema, appearanceSchema(['m1', 'm2']));
  const content = (seen?.input as { content: { type: string; image_url?: string; detail?: string }[] }[])[0].content;
  assert.deepEqual(content.filter(item => item.type === 'input_image').map(item => [item.image_url?.slice(0, 23), item.detail]), [['data:image/jpeg;base64,', 'high'], ['data:image/jpeg;base64,', 'high']]);
  assert.equal(JSON.stringify(seen).includes('ethnicity"'), false);
  // Multi-person media is ambiguous whatever the model says; frames are always video frames.
  assert.equal(result.media[0].ambiguous, true); assert.equal(result.media[0].people.length, 2);
  assert.equal(result.media[1].media_category, 'video_frame'); assert.equal(result.media[1].asset_id, 'asset-2');
  assert.equal(result.media[1].people[0].attributes.hair_colour.value, 'dark');
  assert.deepEqual(result.usage, { input_tokens: 2400, output_tokens: 600 }); assert.equal(result.model, 'configured-model-2026-01-01');
  assert.equal(metadata.requested_model, 'configured-model'); assert.equal(metadata.usage.total_tokens, 3000);
  assert.equal(appearanceCostUsd(result.usage, { input_usd_per_mtok: 2, output_usd_per_mtok: 8 }), 0.0096);
});
test('schema has no forbidden attribute and every attribute allows unknown', () => {
  const schema = JSON.stringify(appearanceSchema(['m1']));
  for (const word of ['ethnicity', 'race', 'nationality', 'religion', 'gender', 'city', 'skills']) assert.equal(schema.includes(`"${word}"`), false, word);
  for (const key of APPEARANCE_ATTRIBUTE_KEYS) assert.ok(schema.includes(`"${key}"`));
});
const code = (value: string) => (error: unknown) => error instanceof IntegrationError && error.code === value;
test('outputs outside the taxonomy, extra attributes, unknown refs and duplicated people are refused with usage kept', async () => {
  const bad = (payload: unknown) => analyzeAppearance(input, config, undefined, async () => recorded(payload));
  const ethnic = structuredClone(good); (ethnic.media[0].people[0].attributes as Record<string, unknown>).ethnicity = { value: 'unknown', confidence: 'low', evidence: null };
  await assert.rejects(bad(ethnic), (error: unknown) => code('AI_APPEARANCE_RESULT_INVALID')(error) && (error as IntegrationError).details.input_tokens === 2400);
  const purple = structuredClone(good); purple.media[1].people[0].attributes.hair_colour.value = 'purple';
  await assert.rejects(bad(purple), code('AI_APPEARANCE_RESULT_INVALID'));
  const foreign = structuredClone(good); foreign.media[1].media_ref = 'm9';
  await assert.rejects(bad(foreign), code('AI_APPEARANCE_RESULT_INVALID'));
  const twice = structuredClone(good); twice.media[0].people[1].person_index = 0;
  await assert.rejects(bad(twice), code('AI_APPEARANCE_RESULT_INVALID'));
  const extraPeople = structuredClone(good); extraPeople.media[1].people.push(person(1));
  await assert.rejects(bad(extraPeople), code('AI_APPEARANCE_RESULT_INVALID'));
  await assert.rejects(analyzeAppearance(input, config, undefined, async () => ({ ...recorded(good), usage: undefined })), code('AI_USAGE_MISSING'));
  await assert.rejects(analyzeAppearance(input, config, undefined, async () => ({ ...recorded(good), output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'refusal', refusal: 'no' }] }] })), code('AI_REFUSAL'));
  await assert.rejects(analyzeAppearance(input, config, undefined, async () => ({ ...recorded(good), status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } })), code('AI_RESPONSE_NOT_COMPLETE'));
});
test('inputs must be verified JPEG bytes within bounds', async () => {
  const tampered = { ...input, images: [{ ...input.images[0], sha256: 'b'.repeat(64) }] };
  await assert.rejects(analyzeAppearance(tampered, config, undefined, async () => recorded(good)), code('APPEARANCE_INPUT_INVALID'));
  const png = { ...input, images: [{ ...image('m1', 'photo', 3), bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]) }] };
  await assert.rejects(analyzeAppearance(png, config, undefined, async () => recorded(good)), code('APPEARANCE_INPUT_INVALID'));
  await assert.rejects(analyzeAppearance(input, { apiKey: '', model: 'x' }, undefined, async () => recorded(good)), code('OPENAI_CONFIGURATION_INVALID'));
  assert.throws(() => appearanceCostUsd({ input_tokens: 1, output_tokens: 1 }, { input_usd_per_mtok: -1, output_usd_per_mtok: 1 }), code('PRICE_TABLE_INVALID'));
});
test('protected identity terms in any free-text field are refused (schema has no such field; post-validation catches prose)', async () => {
  const { forbiddenIdentityTerm } = await import('../../packages/integrations/src/openai-appearance.ts');
  for (const phrase of ['Middle Eastern look', 'Saudi lookalike', 'looks Arab', 'a woman on the left', 'wears a hijab', 'رجل على اليسار', 'ملامح خليجية', 'non-binary presentation'])
    assert.ok(forbiddenIdentityTerm(phrase), phrase);
  for (const phrase of ['hair reaches below the shoulders', 'person on the left, foreground', 'strong coloured lighting', 'white hair', 'dark brown wavy hair', 'mannequin in background'])
    assert.equal(forbiddenIdentityTerm(phrase), null, phrase);
  for (const [field, mutate] of [
    ['evidence', (value: typeof good) => { value.media[1].people[0].attributes.skin_tone = { value: 'medium', confidence: 'low', evidence: 'Middle Eastern look' } as never; }],
    ['position_note', (value: typeof good) => { (value.media[0].people[1] as { position_note: string | null }).position_note = 'Saudi lookalike on the right'; }],
    ['quality_note', (value: typeof good) => { (value.media[1] as { quality_note: string | null }).quality_note = 'Arab man, clear face'; }],
  ] as const) {
    const payload = structuredClone(good); mutate(payload);
    await assert.rejects(analyzeAppearance(input, config, undefined, async () => recorded(payload)), code('AI_APPEARANCE_FORBIDDEN_INFERENCE'), field);
  }
  const schema = appearanceSchema(['m1']); const enums = JSON.stringify(schema).match(/"enum":\[[^\]]*\]/gu)!.join(' ');
  for (const term of ['look', 'arab', 'saudi', 'middle_eastern', 'male', 'female', 'muslim']) assert.equal(enums.includes(`"${term}"`), false, term);
});
