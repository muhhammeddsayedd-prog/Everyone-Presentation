import assert from 'node:assert/strict';
import test from 'node:test';
import { proposeWording, validateWordingProposal, type WordingInput } from '../../packages/integrations/src/openai-wording.ts';

const input: WordingInput = { input_hash: 'a'.repeat(64), target_type: 'assignment', target_id: 'synthetic-assignment', target_row_version: 3,
  field: 'skills_experience', source_text: 'I worked in 2 student films, but no television commercials.',
  instruction: 'Shorten this supplied text without adding credits.', capability: 'slide_shorten',
  budget: { max_characters: 100, max_lines: 2 }, template: { key: 'everyone-casting', version: '1.0', content_sha256: 'b'.repeat(64), font_key: 'everyone-default' } };
const config = { apiKey: 'synthetic-worker-key', model: 'gpt-6.1-sol' };
const text = '2 student films; no TV commercials.';
function response(payload: unknown = { schema_version: '1.0', assignment_id: input.target_id, field: input.field, suggested_text: text, facts_preserved: ['2 student films', 'no television commercials'], warnings: [] }) {
  return { id: 'resp_synthetic_wording', model: config.model, status: 'completed', error: null,
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }],
    usage: { input_tokens: 100, output_tokens: 30, total_tokens: 130 }, _request_id: 'req_synthetic_wording' };
}

test('wording requests only a strict source-bound proposal and builds the ordinary field diff itself', async () => {
  const result = await proposeWording(input, config, undefined, async request => {
    assert.equal(request.store, false); assert.deepEqual(request.tools, []); assert.equal(request.stream, false);
    assert.equal(request.text?.format?.type, 'json_schema');
    const schema = (request.text?.format as { schema: Record<string, unknown> }).schema;
    assert.deepEqual((schema.properties as Record<string, { enum?: unknown[] }>).assignment_id.enum, [input.target_id]);
    assert.ok(request.instructions?.includes('untrusted'));
    assert.equal(JSON.stringify(request.input).includes(input.source_text), true);
    return response();
  });
  assert.deepEqual(result.proposed_changes, [{ field: input.field, old_value: input.source_text, new_value: text }]);
  assert.equal(result.suggested_text, text); assert.deepEqual(result.warnings, []);
  assert.equal(result.metadata.input_sha256, input.input_hash); assert.equal(result.metadata.sdk_version, '7.45.1');
  assert.deepEqual(validateWordingProposal(result, input, config.model), result);
});

test('new numbers, lost negation, material qualifiers, and inflated proficiency are rejected', async () => {
  for (const suggested of ['3 student films; no TV commercials.', '2 student films; TV commercials.', '2 films; no TV commercials.']) {
    await assert.rejects(proposeWording(input, config, undefined, async () => response({ schema_version: '1.0', assignment_id: input.target_id, field: input.field, suggested_text: suggested, facts_preserved: [], warnings: [] })), { code: 'AI_WORDING_FACTS_CHANGED' });
  }
  const languages = { ...input, field: 'languages_accents', source_text: 'English', capability: 'normalize_english' as const };
  await assert.rejects(proposeWording(languages, config, undefined, async () => response({ schema_version: '1.0', assignment_id: input.target_id, field: languages.field, suggested_text: 'Fluent English', facts_preserved: ['English'], warnings: [] })), { code: 'AI_WORDING_FACTS_CHANGED' });
});

test('range and uncertainty stay present, with equivalent Arabic numeric digits accepted', async () => {
  const age = { ...input, field: 'age_or_range', source_text: 'About ٣٥–٤٠ years old', capability: 'normalize_english' as const };
  const payload = (value: string) => ({ schema_version: '1.0', assignment_id: age.target_id, field: age.field, suggested_text: value, facts_preserved: ['٣٥–٤٠'], warnings: [] });
  const result = await proposeWording(age, config, undefined, async () => response(payload('Approximately 35–40 years old')));
  assert.equal(result.suggested_text, 'Approximately 35–40 years old');
  for (const value of ['35–40 years old', 'Approximately 35 years old', 'Approximately 35 and 40 years old'])
    await assert.rejects(proposeWording(age, config, undefined, async () => response(payload(value))), { code: 'AI_WORDING_FACTS_CHANGED' });
});

test('numeric punctuation and large supplied numbers are never reinterpreted into new facts', async () => {
  for (const [source, proposed] of [['3,500 units', '3.5 units'], ['9'.repeat(400) + ' units', '8'.repeat(400) + ' units']]) {
    const value = { ...input, capability: 'normalize_english' as const, source_text: source, budget: { max_characters: 1000, max_lines: 2 } };
    await assert.rejects(proposeWording(value, config, undefined, async () => response({ schema_version: '1.0', assignment_id: input.target_id, field: input.field, suggested_text: proposed, facts_preserved: [], warnings: [] })), { code: 'AI_WORDING_FACTS_CHANGED' });
  }
});

test('another qualifier or another English name cannot disguise unsupported wording', async () => {
  for (const [field, source, proposed] of [['skills_experience', '2 student films', '2 amateur films'], ['skills_experience', 'Expert actor', 'Award-winning actor'], ['name_or_id', 'Avery Morgan', 'Taylor Morgan']]) {
    const value = { ...input, field, capability: 'normalize_english' as const, source_text: source };
    await assert.rejects(proposeWording(value, config, undefined, async () => response({ schema_version: '1.0', assignment_id: input.target_id, field, suggested_text: proposed, facts_preserved: [], warnings: [] })), { code: 'AI_WORDING_FACTS_CHANGED' });
  }
});

test('private fields, missing source, extra authority and over-budget wording never produce a proposal', async () => {
  let sent = 0;
  for (const patch of [{ field: 'internal_notes' }, { source_text: '' }, { source_text: 'Not provided' }, { target_type: 'candidate' }, { source_text: '\0' }, { source_text: '\ud800' }, { url: 'https://untrusted.invalid' }]) {
    await assert.rejects(proposeWording({ ...input, ...patch } as WordingInput, config, undefined, async () => { sent++; return response(); }));
  }
  assert.equal(sent, 0);
  await assert.rejects(proposeWording({ ...input, budget: { max_characters: 10, max_lines: 1 } }, config, undefined, async () => response()), { code: 'AI_WORDING_BUDGET_EXCEEDED' });
});

test('non-assignment wording binds its own target ID and source field without an assignment identity', async () => {
  const availability = { ...input, target_type: 'workspace_candidate' as const, field: 'availability', capability: 'normalize_english' as const, source_text: 'Not available on Monday' };
  const result = await proposeWording(availability, config, undefined, async request => {
    const format = request.text?.format; assert.equal(format?.type, 'json_schema');
    if (format?.type !== 'json_schema') throw new Error('Strict schema required');
    const properties = format.schema.properties as Record<string, unknown>;
    assert.equal(Object.hasOwn(properties, 'assignment_id'), false); assert.ok(properties.target_id);
    return response({ schema_version: '1.0', target_id: availability.target_id, field: availability.field, suggested_text: 'Unavailable Monday', facts_preserved: ['Not available on Monday'], warnings: [] });
  });
  assert.equal(result.proposed_changes[0].old_value, availability.source_text);
});

test('input and result drift cannot publish an arbitrary model change or unrelated metadata', async () => {
  const result = await proposeWording(input, config, undefined, async () => response());
  for (const patch of [{ proposed_changes: [{ field: 'position', old_value: 'option', new_value: 'main' }] }, { suggested_text: 'Different unbound text' },
    { metadata: { ...result.metadata, input_sha256: 'c'.repeat(64) } }, { metadata: { ...result.metadata, prompt_sha256: 'c'.repeat(64) } }, { warnings: [{ code: 'forged' }] }, { target_id: 'other' }])
    assert.throws(() => validateWordingProposal({ ...result, ...patch }, input, config.model));
  const mutable = structuredClone(input);
  const pending = proposeWording(mutable, config, undefined, async () => { mutable.source_text = 'Different private text'; return response(); });
  assert.equal((await pending).proposed_changes[0].old_value, input.source_text);
});

test('refusal, unexpected tools, malformed output and raw upstream errors remain safe', async () => {
  for (const value of [{ ...response(), status: 'incomplete' }, { ...response(), output: [{ type: 'function_call', name: 'write_facts' }] },
    { ...response(), output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'refusal', refusal: 'private source' }] }] },
    response({ schema_version: '1.0', assignment_id: 'foreign', field: input.field, suggested_text: text, facts_preserved: [], warnings: [] })])
    await assert.rejects(proposeWording(input, config, undefined, async () => value));
  await assert.rejects(proposeWording(input, config, undefined, async () => { throw new Error('private-provider-body-and-secret'); }), error => {
    assert.equal((error as Error).message.includes('private-provider'), false); return true;
  });
  const aborted = new AbortController(); aborted.abort(); let sent = 0;
  await assert.rejects(proposeWording(input, config, aborted.signal, async () => { sent++; return response(); }), { code: 'PROCESSING_CANCELLED' }); assert.equal(sent, 0);
});

test('the actual SDK uses the fixed OpenAI endpoint once without ambient headers or retention', { concurrency: false }, async () => {
  const previous = globalThis.fetch; const oldOrigin = process.env.OPENAI_BASE_URL; const oldHeaders = process.env.OPENAI_CUSTOM_HEADERS; let sent = 0;
  try {
    process.env.OPENAI_BASE_URL = 'https://unrelated.invalid'; process.env.OPENAI_CUSTOM_HEADERS = 'X-Unrelated-Secret: unrelated';
    globalThis.fetch = async (url, options) => {
      sent++; assert.equal(String(url), 'https://api.openai.com/v1/responses'); const request = new Request(url, options);
      assert.equal(request.headers.get('authorization'), 'Bearer ' + config.apiKey); assert.equal(request.headers.has('x-unrelated-secret'), false);
      const body = await request.json(); assert.equal(body.store, false); assert.deepEqual(body.tools, []);
      return Response.json(response(), { headers: { 'x-request-id': 'req_sdk_wording' } });
    };
    const result = await proposeWording(input, config); assert.equal(result.metadata.request_id, 'req_sdk_wording'); assert.equal(sent, 1);
  } finally {
    globalThis.fetch = previous;
    if (oldOrigin === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = oldOrigin;
    if (oldHeaders === undefined) delete process.env.OPENAI_CUSTOM_HEADERS; else process.env.OPENAI_CUSTOM_HEADERS = oldHeaders;
  }
});
