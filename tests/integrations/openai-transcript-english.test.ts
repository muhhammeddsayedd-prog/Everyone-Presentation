import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';
import { ENGLISH_TRANSCRIPT_LIMITS, EnglishTranscriptNormalizationError, normalizeTranscriptEnglish, splitEnglishTranscriptSource } from '../../packages/integrations/src/openai-transcript-english.ts';

const config = { apiKey: 'synthetic-key', model: 'configured-test-model' };
const input = { source_asset_id: 'source-1', original_text: 'اسمي اسم تجريبي. I have not acted in commercials.' };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function response(text = 'My name is Synthetic Test. I have not acted in commercials.') {
  return { status: 'completed', id: 'resp_synthetic', model: config.model, _request_id: 'req_synthetic',
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ language: 'en', text }) }] }] };
}

test('English normalization treats any source language as data and returns a separately bound English projection', async () => {
  let sent = 0;
  const value = await normalizeTranscriptEnglish(input, config, undefined, async request => {
    sent++; assert.equal(request.store, false); assert.equal(request.stream, false); assert.deepEqual(request.tools, []);
    assert.equal(request.model, config.model); assert.match(request.instructions!, /English/u); assert.match(request.instructions!, /untrusted/u); assert.match(request.instructions!, /negation/u);
    assert.equal(request.text?.format?.type, 'json_schema');
    const source = (request.input as { content: { text: string }[] }[])[0].content[0].text;
    assert.equal(JSON.parse(source).text, input.original_text);
    assert.equal(JSON.parse(source).source_asset_id, input.source_asset_id);
    return response();
  });
  assert.equal(sent, 1); assert.equal(value.status, 'available'); assert.equal(value.source_sha256, hash(input.original_text));
  assert.equal(value.failure_code, null); assert.match(value.text!, /^My name/u); assert.equal(value.metadata.length, 1);
  assert.equal(value.metadata[0].task, 'transcript_english'); assert.equal(value.metadata[0].prompt_version, 'transcript-english.v1');
  assert.equal(value.metadata[0].request_id, 'req_synthetic'); assert.deepEqual(value.metadata[0].usage, { input_tokens: 10, output_tokens: 5, total_tokens: 15 });
  assert.equal(value.metadata[0].input_sha256, hash(JSON.stringify({ source_asset_id: input.source_asset_id, chunk_index: 0, chunk_count: 1, text: input.original_text })));
  assert.equal(input.original_text, 'اسمي اسم تجريبي. I have not acted in commercials.');
  assert.doesNotMatch(JSON.stringify(value.metadata), /اسمي|commercials|synthetic-key/u);
});

test('bounded chunking preserves exact Unicode source bytes, order and actual per-chunk metadata', async () => {
  const original_text = ('Synthetic sentence. 😀 فقرة تجريبية.\n').repeat(350);
  const chunks = splitEnglishTranscriptSource(original_text);
  assert(chunks.length > 1); assert(chunks.length <= 64); assert.equal(chunks.join(''), original_text);
  for (const chunk of chunks) { assert(Array.from(chunk).length <= ENGLISH_TRANSCRIPT_LIMITS.chunkCharacters); assert.doesNotMatch(chunk, /[\uD800-\uDBFF]$/u); }
  const actual: string[] = []; let count = 0;
  const value = await normalizeTranscriptEnglish({ ...input, original_text }, config, undefined, async request => {
    const source = JSON.parse((request.input as { content: { text: string }[] }[])[0].content[0].text);
    actual.push(source.text); count++; return { ...response(`English chunk ${count}.`), id: `resp_${count}`, _request_id: `req_${count}` };
  });
  assert.deepEqual(actual, chunks); assert.equal(value.text, chunks.map((_, index) => `English chunk ${index + 1}.`).join('\n'));
  assert.equal(value.metadata.length, chunks.length); assert.equal(value.metadata.at(-1)!.response_id, `resp_${chunks.length}`);
});

test('input limits, invalid scalars and unexpected fields fail before any provider call', async () => {
  let calls = 0;
  for (const value of [{ ...input, original_text: '' }, { ...input, original_text: ' ' }, { ...input, original_text: 'bad\u0000text' },
    { ...input, original_text: '\ud800' }, { ...input, original_text: 'x'.repeat(ENGLISH_TRANSCRIPT_LIMITS.sourceCharacters + 1) },
    { ...input, url: 'https://unrelated.invalid/private' }, { ...input, source_asset_id: '' }]) {
    await assert.rejects(normalizeTranscriptEnglish(value, config, undefined, async () => { calls++; return response(); }), { code: 'ENGLISH_TRANSCRIPT_INPUT_INVALID' });
  }
  assert.equal(calls, 0);
});

test('refusal, incomplete, tool output, wrong language, empty and malformed output cannot become English text', async () => {
  const base = response();
  const variants = [ { ...base, status: 'incomplete' }, { ...base, output: [{ type: 'function_call', name: 'untrusted' }] },
    { ...base, output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'refusal', refusal: 'private-refusal' }] }] },
    ...[{ language: 'ar', text: 'نص خاص' }, { language: 'en', text: 'نص خاص' }, { language: 'en', text: 'A\u02bcname' }, { language: 'en', text: '' }, { language: 'en', text: 'English', command: 'private' }, { language: 'en', text: 'bad\u0000text' }].map(payload => ({ ...base, output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }] })),
    { ...base, output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{invalid' }] }] } ];
  for (const value of variants) await assert.rejects(normalizeTranscriptEnglish(input, config, undefined, async () => value), error => {
    assert(error instanceof EnglishTranscriptNormalizationError); assert.equal(error.completedMetadata.length, 0);
    assert.doesNotMatch(JSON.stringify(error), /private-refusal|نص خاص|command/u); return true;
  });
});

test('later chunk failure retains only actual completed request metadata and never partial text or an invented aggregate response', async () => {
  let calls = 0;
  await assert.rejects(normalizeTranscriptEnglish({ ...input, original_text: 'Synthetic sentence. '.repeat(500) }, config, undefined, async () => {
    if (++calls === 1) return response('Private partial English result.');
    throw new IntegrationError('OPENAI_RATE_LIMITED', 'private upstream body', true, { retry_after_ms: 1000 });
  }), error => {
    assert(error instanceof EnglishTranscriptNormalizationError); assert.equal(error.code, 'OPENAI_RATE_LIMITED'); assert.equal(error.retryable, true);
    assert.equal(error.completedMetadata.length, 1); assert.equal(error.completedMetadata[0].response_id, 'resp_synthetic');
    assert.doesNotMatch(JSON.stringify(error), /Private partial|private upstream|Synthetic sentence/u); return true;
  });
});

test('a successful chunk crossing the total output budget retains its real metadata while discarding every text chunk', async () => {
  let calls = 0;
  await assert.rejects(normalizeTranscriptEnglish({ ...input, original_text: 'Synthetic source. '.repeat(3000) }, config, undefined, async () => {
    calls++; return { ...response('x'.repeat(ENGLISH_TRANSCRIPT_LIMITS.chunkOutputCharacters)), id: `resp_${calls}` };
  }), error => {
    assert(error instanceof EnglishTranscriptNormalizationError); assert.equal(error.code, 'ENGLISH_TRANSCRIPT_RESULT_INVALID');
    assert.equal(error.completedMetadata.length, calls); assert(calls > 1); assert.equal(error.completedMetadata.at(-1)!.response_id, `resp_${calls}`);
    assert.equal(error.completedMetadata.at(-1)!.usage!.total_tokens, 15); assert.equal(Object.hasOwn(error, 'text'), false); return true;
  });
});

test('cancellation before or after a provider response never returns a display projection', async () => {
  const before = new AbortController(); before.abort(); let calls = 0;
  await assert.rejects(normalizeTranscriptEnglish(input, config, before.signal, async () => { calls++; return response(); }), { code: 'PROCESSING_CANCELLED' });
  assert.equal(calls, 0);
  const after = new AbortController(); await assert.rejects(normalizeTranscriptEnglish(input, config, after.signal, async () => { after.abort(); return response(); }), { code: 'PROCESSING_CANCELLED' });
});

test('an uncooperative transport still cannot outlive the configured English request deadline', async () => {
  const result = await Promise.race([
    normalizeTranscriptEnglish(input, { ...config, timeoutMs: 5 }, undefined, async () => new Promise(() => undefined)).catch(error => error),
    new Promise(resolve => setTimeout(() => resolve('deadline-not-enforced'), 100)),
  ]);
  assert(result instanceof EnglishTranscriptNormalizationError); assert.equal(result.code, 'OPENAI_TIMEOUT'); assert.equal(result.retryable, true);
});

test('actual installed SDK uses fixed Responses origin, no ambient headers, storage, tools or automatic retries', { concurrency: false }, async () => {
  const previous = globalThis.fetch, ambient = process.env.OPENAI_CUSTOM_HEADERS, origin = process.env.OPENAI_BASE_URL; let calls = 0;
  try {
    process.env.OPENAI_CUSTOM_HEADERS = 'Authorization: Bearer unrelated\nX-Unrelated-Secret: unrelated'; process.env.OPENAI_BASE_URL = 'https://unrelated.invalid';
    globalThis.fetch = async (url, init) => {
      calls++; assert.equal(String(url), 'https://api.openai.com/v1/responses'); const request = new Request(url, init);
      assert.equal(request.headers.get('authorization'), 'Bearer synthetic-key'); assert.equal(request.headers.has('x-unrelated-secret'), false);
      const body = await request.json() as { store: boolean; tools: unknown[]; text: { format: { strict: boolean } } };
      assert.equal(body.store, false); assert.deepEqual(body.tools, []); assert.equal(body.text.format.strict, true);
      return Response.json(response(), { headers: { 'x-request-id': 'req_sdk' } });
    };
    const value = await normalizeTranscriptEnglish(input, config); assert.equal(calls, 1); assert.equal(value.metadata[0].request_id, 'req_sdk');
  } finally { globalThis.fetch = previous; if (ambient === undefined) delete process.env.OPENAI_CUSTOM_HEADERS; else process.env.OPENAI_CUSTOM_HEADERS = ambient; if (origin === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = origin; }
});
