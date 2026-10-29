import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { FRAME_INSUFFICIENT_REASON, FRAME_TECHNICAL_REASONS, frameVisionFingerprint, selectVisionFrames, type FrameVisionInput } from '../../packages/integrations/src/openai-frames.ts';
const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02]);
const digest = createHash('sha256').update(bytes).digest('hex');
const config = { apiKey: 'synthetic-api-key', model: 'evaluated-image-model' };
const input: FrameVisionInput = { source_asset_id: 'source-1', input_hash: 'a'.repeat(64), frames: [{ frame_asset_id: 'frame-1', source_asset_id: 'source-1', timestamp_ms: 1000, width: 853, height: 480, sha256: digest, bytes }] };
const selection = () => ({ schema_version: '1.0', source_asset_id: 'source-1', selected_frames: [{ frame_asset_id: 'frame-1', reason: FRAME_TECHNICAL_REASONS[0] }], insufficient_frames_reason: FRAME_INSUFFICIENT_REASON });
const response = (value: unknown = selection()) => ({ status: 'completed', id: 'resp_synthetic', model: config.model, _request_id: 'req_synthetic', usage: { input_tokens: 10, output_tokens: 3, total_tokens: 13 }, output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });

test('vision request binds actual verified JPEGs to allowlisted IDs, technical reasons and frozen provider metadata', async () => {
  let sent = 0;
  const result = await selectVisionFrames(input, config, undefined, async request => {
    sent++; assert.equal(request.store, false); assert.equal(request.stream, false); assert.deepEqual(request.tools, []);
    assert.equal(request.model, config.model); assert.match(request.instructions!, /closed|blink/u); assert.match(request.instructions!, /Never identify/u); assert.match(request.instructions!, /casting fit/u);
    const content = (request.input as { content: { type: string; image_url?: string }[] }[])[0].content;
    assert.equal(content.filter(value => value.type === 'input_image').length, 1); assert.equal(content.find(value => value.type === 'input_image')!.image_url, 'data:image/jpeg;base64,' + Buffer.from(bytes).toString('base64'));
    const format = request.text!.format as { type: string; strict: boolean; schema: { properties: { source_asset_id: { enum: string[] }; selected_frames: { maxItems: number; items: { properties: { frame_asset_id: { enum: string[] }; reason: { enum: string[] } } } } } } };
    assert.equal(format.type, 'json_schema'); assert.equal(format.strict, true); assert.equal(format.schema.properties.selected_frames.maxItems, 3);
    assert.deepEqual(format.schema.properties.source_asset_id.enum, ['source-1']); assert.deepEqual(format.schema.properties.selected_frames.items.properties.frame_asset_id.enum, ['frame-1']); assert.deepEqual(format.schema.properties.selected_frames.items.properties.reason.enum, [...FRAME_TECHNICAL_REASONS]);
    return response();
  });
  assert.equal(sent, 1); assert.deepEqual(result.result, selection()); assert.equal(result.metadata.input_sha256, input.input_hash); assert.equal(result.metadata.frame_input_sha256, frameVisionFingerprint(input.frames));
  assert.equal(result.metadata.prompt_version, 'frame_selection_vision_v1'); assert.equal(result.metadata.sdk_version, '7.45.1'); assert.deepEqual(result.metadata.usage, { input_tokens: 10, output_tokens: 3, total_tokens: 13 }); assert.match(result.metadata.schema_sha256!, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(JSON.stringify(result.metadata), /synthetic-api-key|data:image|bytes/u);
});
test('image identity, checksum, content, bounds and forbidden inputs fail before any provider request', async () => {
  let calls = 0; const transport = async () => { calls++; return response(); };
  const patches: unknown[] = [
    { ...input, frames: [] }, { ...input, frames: Array.from({ length: 13 }, (_, i) => ({ ...input.frames[0], frame_asset_id: 'frame-' + i })) },
    { ...input, role_requirements: 'untrusted' }, { ...input, frames: [{ ...input.frames[0], url: 'https://unrelated.invalid/private' }] },
    { ...input, frames: [{ ...input.frames[0], source_asset_id: 'other' }] }, { ...input, frames: [input.frames[0], input.frames[0]] },
    { ...input, frames: [{ ...input.frames[0], sha256: 'b'.repeat(64) }] }, { ...input, frames: [{ ...input.frames[0], bytes: new Uint8Array([1, 2, 3]) }] },
    { ...input, frames: [{ ...input.frames[0], timestamp_ms: -1 }] }, { ...input, frames: [{ ...input.frames[0], width: 1281 }] },
    { ...input, frames: [{ ...input.frames[0], bytes: new Uint8Array(2 * 1024 * 1024 + 1) }] },
  ];
  for (const value of patches) await assert.rejects(selectVisionFrames(value as FrameVisionInput, config, undefined, transport), { code: 'FRAME_SELECTION_INPUT_INVALID' });
  assert.equal(calls, 0);
});
test('untrusted provider cannot select unknown, duplicate or invented frames or emit personal/suitability reasons', async () => {
  const values = [
    { ...selection(), source_asset_id: 'other' },
    { ...selection(), selected_frames: [{ frame_asset_id: 'unseen', reason: FRAME_TECHNICAL_REASONS[0] }] },
    { ...selection(), selected_frames: [selection().selected_frames[0], selection().selected_frames[0]] },
    { ...selection(), selected_frames: [{ frame_asset_id: 'frame-1', reason: 'Attractive person suitable for this role.' }] },
    { ...selection(), facts: { age: 20 } }, { ...selection(), insufficient_frames_reason: 'Young actor' },
  ];
  for (const value of values) await assert.rejects(selectVisionFrames(input, config, undefined, async () => response(value)), error => Boolean(error && typeof error === 'object' && 'code' in error && ['AI_SOURCE_MISMATCH', 'AI_FRAME_REFERENCE_INVALID', 'AI_FRAME_RESULT_INVALID'].includes(String(error.code))));
});
test('refusal, incomplete response, tools and malformed result never become a successful frame review', async () => {
  const variants = [
    { ...response(), status: 'incomplete' }, { ...response(), id: null },
    { ...response(), output: [{ type: 'function_call', name: 'untrusted' }] },
    { ...response(), output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'refusal', refusal: 'private-provider-text' }] }] },
    { ...response(), output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{invalid' }] }] },
  ];
  for (const value of variants) await assert.rejects(selectVisionFrames(input, config, undefined, async () => value));
});
test('cancellation before and after provider computation cannot publish reviewed frames', async () => {
  const before = new AbortController(); before.abort(); let sent = 0;
  await assert.rejects(selectVisionFrames(input, config, before.signal, async () => { sent++; return response(); }), { code: 'PROCESSING_CANCELLED' }); assert.equal(sent, 0);
  const after = new AbortController(); await assert.rejects(selectVisionFrames(input, config, after.signal, async () => { after.abort(); return response(); }), { code: 'PROCESSING_CANCELLED' });
});
test('actual SDK sends one image request to fixed OpenAI origin without ambient headers, storage or retries', { concurrency: false }, async () => {
  const previous = globalThis.fetch; const headers = process.env.OPENAI_CUSTOM_HEADERS; const origin = process.env.OPENAI_BASE_URL; let calls = 0;
  try {
    process.env.OPENAI_CUSTOM_HEADERS = 'Authorization: Bearer unrelated\nX-Unrelated-Secret: unrelated'; process.env.OPENAI_BASE_URL = 'https://unrelated.invalid';
    globalThis.fetch = async (url, options) => {
      calls++; assert.equal(String(url), 'https://api.openai.com/v1/responses'); const request = new Request(url, options);
      assert.equal(request.headers.get('authorization'), 'Bearer ' + config.apiKey); assert.equal(request.headers.has('x-unrelated-secret'), false);
      const body = await request.json() as { store: boolean; tools: unknown[]; input: { content: { type: string }[] }[] };
      assert.equal(body.store, false); assert.deepEqual(body.tools, []); assert.equal(body.input[0].content.filter(value => value.type === 'input_image').length, 1);
      return Response.json(response(), { headers: { 'x-request-id': 'req_sdk' } });
    };
    const value = await selectVisionFrames(input, config); assert.equal(calls, 1); assert.equal(value.metadata.request_id, 'req_sdk');
  } finally { globalThis.fetch = previous; if (headers === undefined) delete process.env.OPENAI_CUSTOM_HEADERS; else process.env.OPENAI_CUSTOM_HEADERS = headers; if (origin === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = origin; }
});
test('raw upstream exceptions stay redacted and invalid usage is not invented', async () => {
  await assert.rejects(selectVisionFrames(input, config, undefined, async () => { throw new Error('private-provider-body-and-secret'); }), error => Boolean(error && typeof error === 'object' && 'message' in error && !String(error.message).includes('private-provider')));
  const value = await selectVisionFrames(input, config, undefined, async () => ({ ...response(), usage: { input_tokens: -1, output_tokens: 3, total_tokens: 2 } })); assert.equal(value.metadata.usage, null);
});
