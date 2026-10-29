import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { extractCandidate, joinTranscriptChunks, transcribeAudio } from '../../packages/integrations/src/openai-media.ts';
const bytes = new Uint8Array([1, 2, 3]); const checksum = createHash('sha256').update(bytes).digest('hex');
const settings = { apiKey: 'synthetic-key', model: 'configured-test-model' };
const chunk = { index: 0, start_ms: 0, end_ms: 2000, mime_type: 'audio/mpeg' as const, sha256: checksum, bytes };
test('original multilingual transcription uses current JSON contract and only actual chunk bounds', async () => {
  const value = await transcribeAudio({ source_asset_id: 'source-1', chunks: [chunk], languages: ['ar', 'en'] }, settings, async request => {
    assert.equal(request.response_format, 'json'); assert.deepEqual(request.languages, ['ar', 'en']); assert.equal(request.language, undefined); assert.equal(request.file instanceof File, true);
    return { text: 'اسمي لينا. I live in Cairo.', languages: [{ code: 'ar' }, { code: 'en' }], _request_id: 'req_synthetic' };
  });
  assert.equal(value.result.original_text, 'اسمي لينا. I live in Cairo.'); assert.equal(value.result.timestamp_precision, 'chunk'); assert.equal(value.result.segments[0].end_ms, 2000);
  assert.deepEqual(value.result.languages, ['ar', 'en']);
});
test('audio checksum and silent provider response fail safely before extraction', async () => {
  let sent = false;
  await assert.rejects(transcribeAudio({ source_asset_id: 'source-1', chunks: [{ ...chunk, sha256: 'invalid' }] }, settings, async () => { sent = true; }), { code: 'TRANSCRIPTION_SOURCE_INVALID' }); assert.equal(sent, false);
  await assert.rejects(transcribeAudio({ source_asset_id: 'source-1', chunks: [chunk] }, settings, async () => ({ text: '' })), { code: 'TRANSCRIPTION_EMPTY' });
  await assert.rejects(transcribeAudio({ source_asset_id: 'source-1', chunks: [chunk] }, settings, async () => { throw { status: 429, code: 'insufficient_quota', message: 'private upstream payload' }; }), { code: 'OPENAI_QUOTA_EXCEEDED', retryable: false });
});
test('chunk joining removes only exact multiword boundary overlap without translating or changing chunks', () => {
  assert.equal(joinTranscriptChunks(['I live in Cairo and speak Arabic.', 'and speak Arabic. I also speak English.']), 'I live in Cairo and speak Arabic.\nI also speak English.');
  assert.equal(joinTranscriptChunks(['أنا أعيش في القاهرة', 'أعيش في القاهرة وأتكلم العربية']), 'أنا أعيش في القاهرة\nوأتكلم العربية');
  assert.equal(joinTranscriptChunks(['Yes yes', 'yes I am here']), 'Yes yes\nyes I am here');
});
test('candidate adapter disables storage/tools and validates source-grounded null result', async () => {
  const facts = { name: null, casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null, languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };
  const result = { schema_version: '1.0', source_asset_id: 'source-1', facts, project_availability_statement: null, evidence: [], uncertainties: [] };
  const value = await extractCandidate({ source_asset_id: 'source-1', input_hash: 'a'.repeat(64), segments: [{ index: 0, start_ms: 0, end_ms: 2000, text: 'Can you speak French? No.' }] }, settings, async request => {
    assert.equal(request.store, false); assert.deepEqual(request.tools, []); assert.match(request.instructions!, /hypothetical question/); assert.equal(request.text?.format?.type, 'json_schema');
    return { status: 'completed', id: 'resp_synthetic', model: 'configured-test-model', output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] };
  });
  assert.deepEqual(value.result, result); assert.equal(value.metadata.requested_model, settings.model);
});
test('actual SDK emits bounded multipart audio to fixed OpenAI origin without ambient headers or retries', { concurrency: false }, async () => {
  const original = globalThis.fetch; const custom = process.env.OPENAI_CUSTOM_HEADERS; const base = process.env.OPENAI_BASE_URL;
  let calls = 0;
  try {
    process.env.OPENAI_CUSTOM_HEADERS = 'Authorization: Bearer unrelated\nContent-Type: text/html\nX-Unrelated-Secret: unrelated';
    process.env.OPENAI_BASE_URL = 'https://unrelated.invalid';
    globalThis.fetch = async (url, init) => {
      if (String(url) === 'data:,') return new Response(''); // SDK-local FormData support probe, no provider/network request.
      calls++; assert.equal(String(url), 'https://api.openai.com/v1/audio/transcriptions'); const request = new Request(url, { ...init, duplex: 'half' } as RequestInit);
      assert.equal(request.headers.get('authorization'), `Bearer ${settings.apiKey}`); assert.equal(request.headers.has('x-unrelated-secret'), false); assert.match(request.headers.get('content-type')!, /^multipart\/form-data; boundary=/u);
      const form = await request.formData(); assert.equal(form.get('model'), settings.model); assert.equal(form.get('response_format'), 'json'); assert(form.get('file') instanceof File);
      return Response.json({ text: 'اسمي لينا', languages: [{ code: 'ar' }], usage: { type: 'duration', seconds: 2 } }, { headers: { 'x-request-id': 'req_synthetic_audio' } });
    };
    const value = await transcribeAudio({ source_asset_id: 'source-1', chunks: [chunk] }, settings);
    assert.equal(calls, 1); assert.equal(value.metadata[0].request_id, 'req_synthetic_audio'); assert.deepEqual(value.metadata[0].usage, { seconds: 2, type: 'duration' });
  } finally { globalThis.fetch = original; if (custom === undefined) delete process.env.OPENAI_CUSTOM_HEADERS; else process.env.OPENAI_CUSTOM_HEADERS = custom; if (base === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = base; }
});
