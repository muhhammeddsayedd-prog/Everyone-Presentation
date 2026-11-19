import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractSpecs, IntegrationError } from '../../packages/integrations/src/index.ts';
import type { SpecsExtraction, SpecsExtractionInput, SpecsExtractionV2 } from '../../packages/integrations/src/index.ts';
import {
  sha256, SPECS_PROVIDER_SCHEMA_SHA256, SPECS_SCHEMA_SHA256, SPECS_V2_PROVIDER_SCHEMA, SPECS_V2_PROVIDER_SCHEMA_SHA256,
  SPECS_V2_SCHEMA_SHA256,
} from '../../packages/integrations/src/specs-schema.ts';
import { SPECS_PROMPT } from '../../packages/integrations/src/prompts/specs-v1.ts';
import { SPECS_V2_PROMPT, SPECS_V2_PROMPT_VERSION } from '../../packages/integrations/src/prompts/specs-v2.ts';

// Deterministic synthetic fixtures only; no provider calls occur.
const v1Config = { apiKey: 'unit-test-placeholder-key', model: 'configured-test-model' };
const config = { ...v1Config, promptVersion: 'spec_extract_v2.0.0' as const };
const paragraphs = [
  'SCENE 1 - INT. KITCHEN - NIGHT. The young father cooks dinner.',
  'SCENE 3A - EXT. GARDEN - DAY. The old father waters the roses. Two waiters pass by.',
  'The old father is the same character as the young father, decades later.',
];
const input: SpecsExtractionInput = { sourceAssetId: null, correlationId: 'request-fixture-v2', inputHash: 'c'.repeat(64),
  paragraphs: paragraphs.map((text, index) => ({ index, page: null, text })) };
const ref = (paragraph: number, quote: string) => ({ asset_id: null, page: null, paragraph, segment_index: null,
  start_ms: null, end_ms: null, quote });
const requirements = (sceneReferences: string[]) => ({ age_range: null, gender_requirement: null, appearance_performance: null,
  languages: [], accents: [], skills: [], scene_references: sceneReferences, shoot_dates: [], location: null,
  availability_requirements: null, other_instructions: null });

function result(): SpecsExtractionV2 {
  return {
    schema_version: '2.0', source_asset_id: null, source_language_codes: ['en'],
    roles: [
      { source_role_key: 'father-young', name: 'Father (young)', headcount: 1, category: null, requirements: requirements(['1']),
        evidence: [ref(0, 'The young father cooks dinner.')], clarifications: [],
        occurrences: [{ scene_key: 'scene-1', display_title: 'Father (young)', evidence: [ref(0, 'The young father cooks dinner.')] }],
        same_character_as: null },
      { source_role_key: 'father-old', name: 'Father (old)', headcount: 1, category: null, requirements: requirements(['3A']),
        evidence: [ref(1, 'The old father waters the roses.')], clarifications: [],
        occurrences: [{ scene_key: 'scene-3a', display_title: null, evidence: [ref(1, 'The old father waters the roses.')] }],
        same_character_as: { source_role_key: 'father-young',
          evidence: [ref(2, 'The old father is the same character as the young father')] } },
      { source_role_key: 'waiters', name: 'Waiter', headcount: 2, category: 'Background', requirements: requirements(['3A']),
        evidence: [ref(1, 'Two waiters pass by.')], clarifications: [],
        occurrences: [{ scene_key: 'scene-3a', display_title: null, evidence: [ref(1, 'Two waiters pass by.')] }],
        same_character_as: null },
    ],
    scenes: [
      { scene_key: 'scene-1', scene_number: '1', title: 'Kitchen at night', sequence_label: null, setting: 'INT. KITCHEN - NIGHT',
        notes: null, requirements: [], evidence: [ref(0, 'SCENE 1 - INT. KITCHEN - NIGHT.')] },
      { scene_key: 'scene-3a', scene_number: '3A', title: 'Garden by day', sequence_label: null, setting: 'EXT. GARDEN - DAY',
        notes: null, requirements: ['Roses in bloom'], evidence: [ref(1, 'SCENE 3A - EXT. GARDEN - DAY.')] },
    ],
    general_instructions: null,
    clarifications: [{ field_path: 'scenes[1].scene_number', reason: 'Scene 2 is not described.', source: null }],
  };
}
function response(payload: unknown): Record<string, unknown> {
  return { id: 'resp_v2_fixture', _request_id: 'req_v2_fixture', model: 'resolved-test-snapshot', status: 'completed', error: null,
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }],
    usage: { input_tokens: 40, output_tokens: 80, total_tokens: 120 } };
}
const errorCode = (code: string) => (error: unknown) => error instanceof IntegrationError && error.code === code;
const reject = (payload: unknown, code: string) => assert.rejects(extractSpecs(input, config, async () => response(payload)), errorCode(code));

test('v1 prompt, schema and provider-schema hashes stay byte-identical to the m02 SQL pins', () => {
  assert.equal(sha256(SPECS_PROMPT), 'ab03fd026edb3d139fd93fdd51cb475474d6c4e3c8f6395b65014574e7e29eee');
  assert.equal(SPECS_SCHEMA_SHA256, 'e8ffee51eee20f687abbfc12c2476248ccb5a59c1122fde418bc89db3ff58085');
  assert.equal(SPECS_PROVIDER_SCHEMA_SHA256, 'd73a11450f2714c5649ab9a663f0a3483f68feefd1f482bc62575a9a608a1216');
});

test('v2 hashes equal the literals pinned by the m17/m22 extraction migrations', async () => {
  // m22 re-pins the v2 provider schema hash; the other pins stay in m17.
  const sql = await readFile(new URL('../../supabase/migrations/20261116110500_m17_specs_extraction_v2.sql', import.meta.url), 'utf8')
    + await readFile(new URL('../../supabase/migrations/20261119090000_m22_specs_v2_provider_schema.sql', import.meta.url), 'utf8');
  const pinned = (name: string) => [...sql.matchAll(new RegExp(`p_value->>'${name}'='([a-f0-9]{64})'`, 'gu'))].map(match => match[1]);
  assert.ok(sql.includes(`p_value->>'prompt_version'='${SPECS_V2_PROMPT_VERSION}'`));
  assert.ok(pinned('prompt_sha256').includes(sha256(SPECS_V2_PROMPT)));
  assert.ok(pinned('schema_sha256').includes(SPECS_V2_SCHEMA_SHA256));
  assert.ok(pinned('provider_schema_sha256').includes(SPECS_V2_PROVIDER_SCHEMA_SHA256));
  // v1 pins are carried over unchanged.
  assert.ok(pinned('prompt_sha256').includes(sha256(SPECS_PROMPT)));
  assert.ok(pinned('schema_sha256').includes(SPECS_SCHEMA_SHA256));
  assert.ok(pinned('provider_schema_sha256').includes(SPECS_PROVIDER_SCHEMA_SHA256));
  assert.equal(new Set([sha256(SPECS_V2_PROMPT), SPECS_V2_SCHEMA_SHA256, SPECS_V2_PROVIDER_SCHEMA_SHA256,
    sha256(SPECS_PROMPT), SPECS_SCHEMA_SHA256, SPECS_PROVIDER_SCHEMA_SHA256]).size, 6);
});

test('v2 request uses the v2 prompt and strict provider schema; metadata reports v2 versions and hashes', async () => {
  let calls = 0;
  const extracted = await extractSpecs(input, config, async (request) => {
    calls++;
    assert.equal(request.store, false); assert.deepEqual(request.tools, []);
    assert.equal(request.instructions, SPECS_V2_PROMPT);
    assert.deepEqual(request.text, { format: { type: 'json_schema', name: 'specs_extraction_v2', strict: true, schema: SPECS_V2_PROVIDER_SCHEMA } });
    const schema = JSON.stringify(request.text?.format);
    assert.ok(schema.includes('"enum":["2.0"]') && !schema.includes('"const"') && !schema.includes('minLength'));
    assert.ok(schema.includes('"same_character_as"') && schema.includes('"occurrences"') && schema.includes('"scenes"'));
    return response(result());
  });
  assert.equal(calls, 1);
  assert.equal(extracted.metadata.prompt_version, 'spec_extract_v2.0.0');
  assert.equal(extracted.metadata.schema_version, '2.0');
  assert.equal(extracted.metadata.prompt_sha256, sha256(SPECS_V2_PROMPT));
  assert.equal(extracted.metadata.schema_sha256, SPECS_V2_SCHEMA_SHA256);
  assert.equal(extracted.metadata.provider_schema_sha256, SPECS_V2_PROVIDER_SCHEMA_SHA256);
  assert.equal(extracted.result.schema_version, '2.0');
});

test('same-character links append exactly one reviewable role clarification; other data is returned unchanged', async () => {
  const extracted = (await extractSpecs(input, config, async () => response(result()))).result as SpecsExtractionV2;
  const expected = result();
  expected.roles[1].clarifications.push({ field_path: 'same_character_as',
    reason: 'The source may describe the same character as "Father (young)". Roles stay separately cast unless you link this role to the same scenes explicitly.',
    source: ref(2, 'The old father is the same character as the young father') });
  assert.deepEqual(extracted, expected);
  assert.equal(extracted.roles[0].clarifications.length, 0);
  // An existing same_character_as clarification is kept, not duplicated.
  const already = result();
  already.roles[1].clarifications.push({ field_path: 'same_character_as', reason: 'Source links the roles.', source: null });
  const kept = (await extractSpecs(input, config, async () => response(already))).result as SpecsExtractionV2;
  assert.deepEqual(kept.roles[1].clarifications, [{ field_path: 'same_character_as', reason: 'Source links the roles.', source: null }]);
  // Unnamed target falls back to its key.
  const unnamed = result(); unnamed.roles[0].name = null;
  const fallback = (await extractSpecs(input, config, async () => response(unnamed))).result as SpecsExtractionV2;
  assert.match(fallback.roles[1].clarifications[0].reason, /same character as "father-young"/u);
});

test('v2 rejects invented quotes, dangling or repeated keys, self links and missing evidence', async () => {
  const badQuote = result(); badQuote.scenes[0].evidence[0].quote = 'An invented scene heading';
  await reject(badQuote, 'AI_EVIDENCE_INVALID');
  const badOccurrenceQuote = result(); badOccurrenceQuote.roles[2].occurrences[0].evidence[0].quote = 'Three waiters';
  await reject(badOccurrenceQuote, 'AI_EVIDENCE_INVALID');
  const badLinkParagraph = result(); badLinkParagraph.roles[1].same_character_as!.evidence[0].paragraph = 9;
  await reject(badLinkParagraph, 'AI_EVIDENCE_INVALID');
  const dangling = result(); dangling.roles[0].occurrences[0].scene_key = 'scene-2';
  await reject(dangling, 'AI_RESULT_INVALID');
  const repeated = result(); repeated.roles[2].occurrences.push(structuredClone(repeated.roles[2].occurrences[0]));
  await reject(repeated, 'AI_RESULT_INVALID');
  const duplicateScene = result(); duplicateScene.scenes[1].scene_key = 'scene-1';
  await reject(duplicateScene, 'AI_RESULT_INVALID');
  const blankScene = result(); blankScene.scenes[0].scene_key = ' '; blankScene.roles[0].occurrences[0].scene_key = ' ';
  await reject(blankScene, 'AI_RESULT_INVALID');
  const blankTitle = result(); blankTitle.scenes[0].title = ' ';
  await reject(blankTitle, 'AI_RESULT_INVALID');
  const selfLink = result(); selfLink.roles[1].same_character_as!.source_role_key = 'father-old';
  await reject(selfLink, 'AI_ROLE_KEYS_INVALID');
  const unknownLink = result(); unknownLink.roles[1].same_character_as!.source_role_key = 'grandfather';
  await reject(unknownLink, 'AI_ROLE_KEYS_INVALID');
  const sceneEvidence = result(); sceneEvidence.scenes[0].evidence = [];
  await reject(sceneEvidence, 'AI_EVIDENCE_MISSING');
  const occurrenceEvidence = result(); occurrenceEvidence.roles[0].occurrences[0].evidence = [];
  await reject(occurrenceEvidence, 'AI_EVIDENCE_MISSING');
  const linkEvidence = result(); linkEvidence.roles[1].same_character_as!.evidence = [];
  await reject(linkEvidence, 'AI_EVIDENCE_MISSING');
  const roleEvidence = result(); roleEvidence.roles[0].evidence = [];
  await reject(roleEvidence, 'AI_EVIDENCE_MISSING');
  const nulScene = result(); nulScene.scenes[0].notes = 'synthetic\u0000';
  await reject(nulScene, 'AI_RESULT_INVALID');
  const missingField = result() as unknown as Record<string, unknown>; delete missingField.scenes;
  await reject(missingField, 'AI_RESULT_INVALID');
  const extraField = result(); (extraField.scenes[0] as unknown as Record<string, unknown>).scene_id = 'cloud-id';
  await reject(extraField, 'AI_RESULT_INVALID');
  const missingRoleField = result() as unknown as { roles: Record<string, unknown>[] }; delete missingRoleField.roles[0].same_character_as;
  await reject(missingRoleField, 'AI_RESULT_INVALID');
});

test('result schema versions cannot cross prompt versions, and unknown prompt versions are configuration errors', async () => {
  const v1Shaped = { ...result(), schema_version: '1.0', roles: result().roles.map(role => {
    const copy: Partial<typeof role> = { ...role }; delete copy.occurrences; delete copy.same_character_as; return copy;
  }) } as Record<string, unknown>;
  delete v1Shaped.scenes;
  await reject(v1Shaped, 'AI_RESULT_INVALID');
  await assert.rejects(extractSpecs(input, v1Config, async () => response(result())), errorCode('AI_RESULT_INVALID'));
  const v1 = await extractSpecs(input, v1Config, async (request) => {
    assert.equal(request.text?.format?.type === 'json_schema' && request.text.format.name, 'specs_extraction_v1');
    assert.equal(request.instructions, SPECS_PROMPT);
    return response(v1Shaped);
  });
  assert.equal(v1.metadata.schema_version, '1.0'); assert.equal(v1.metadata.prompt_version, 'spec_extract_v1.0.0');
  assert.deepEqual(v1.result, v1Shaped as unknown as SpecsExtraction);
  let called = false;
  for (const promptVersion of ['spec_extract_v3.0.0', 'toString', '']) {
    await assert.rejects(extractSpecs(input, { ...v1Config, promptVersion: promptVersion as 'spec_extract_v2.0.0' },
      async () => { called = true; return response(result()); }), errorCode('OPENAI_CONFIGURATION_INVALID'));
  }
  assert.equal(called, false);
});

test('document v2 evidence binds to the source asset and page', async () => {
  const asset = '11111111-1111-4111-8111-111111111111';
  const documentInput: SpecsExtractionInput = { ...input, sourceAssetId: asset,
    paragraphs: paragraphs.map((text, index) => ({ index, page: index + 1, text })) };
  const pageRefs = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(pageRefs);
    else if (value && typeof value === 'object') {
      const item = value as Record<string, unknown>;
      if ('quote' in item && 'paragraph' in item) { item.asset_id = asset; item.page = (item.paragraph as number) + 1; }
      Object.values(item).forEach(pageRefs);
    }
  };
  const payload = result(); payload.source_asset_id = asset; pageRefs(payload);
  const extracted = await extractSpecs(documentInput, config, async () => response(payload));
  assert.equal((extracted.result as SpecsExtractionV2).scenes[1].evidence[0].page, 2);
  const wrongPage = structuredClone(payload); wrongPage.scenes[1].evidence[0].page = 3;
  await assert.rejects(extractSpecs(documentInput, config, async () => response(wrongPage)), errorCode('AI_EVIDENCE_INVALID'));
  const wrongAsset = structuredClone(payload); wrongAsset.roles[0].occurrences[0].evidence[0].asset_id = null;
  await assert.rejects(extractSpecs(documentInput, config, async () => response(wrongAsset)), errorCode('AI_EVIDENCE_INVALID'));
});

// OpenAI strict Structured Outputs: every object lists exactly its properties in `required` and forbids extras.
// Regression: the adapter once dropped a property named "title" (Scene) while keeping it in `required` (HTTP 400).
test('v1 and v2 provider schemas satisfy strict structured-output rules', async () => {
  const { SPECS_PROVIDER_SCHEMA, SPECS_V2_PROVIDER_SCHEMA } = await import('../../packages/integrations/src/specs-schema.ts');
  const problems: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) { node.forEach((item, index) => walk(item, `${path}/${index}`)); return; }
    if (!node || typeof node !== 'object') return;
    const schema = node as Record<string, unknown>;
    if (schema.type === 'object' || schema.properties) {
      const props = Object.keys((schema.properties as Record<string, unknown>) ?? {}); const required = (schema.required as string[]) ?? [];
      if (schema.additionalProperties !== false || props.length !== required.length || props.some(key => !required.includes(key))) problems.push(path || '(root)');
    }
    for (const [key, value] of Object.entries(schema)) walk(value, `${path}/${key}`);
  };
  walk(SPECS_PROVIDER_SCHEMA, 'v1'); walk(SPECS_V2_PROVIDER_SCHEMA, 'v2');
  assert.deepEqual(problems, []);
  assert.deepEqual(((SPECS_V2_PROVIDER_SCHEMA.$defs as Record<string, { properties: Record<string, unknown> }>).Scene.properties.title), { type: 'string' });
});
