import { createHash } from 'node:crypto';
import type { ResponseCreateParamsNonStreaming, ResponseInputContent } from 'openai/resources/responses/responses';
import { IntegrationError, record, safeIdentifier } from './errors.ts';
import { requestMediaResponse, type OpenAIMediaConfig } from './openai-media.ts';
import { validateFrameSelection } from './media-schema.ts';
import type { FrameSelection, MediaProviderMetadata } from './media-types.ts';
import { FRAME_SELECTION_PROMPT, FRAME_SELECTION_PROMPT_VERSION } from './prompts/frame-selection-v1.ts';

export const FRAME_VISION_LIMITS = Object.freeze({ samples: 12, frameBytes: 2 * 1024 * 1024, totalBytes: 24 * 1024 * 1024, dimension: 1280 });
export const FRAME_TECHNICAL_REASONS = ['Clear frontal source frame.', 'Clear wider source frame.', 'Clear profile source frame.', 'Clear distinct source framing.'] as const;
export const FRAME_INSUFFICIENT_REASON = 'Fewer than three clear, distinct source frames are available.';
export interface VisionFrame { frame_asset_id: string; source_asset_id: string; timestamp_ms: number; width: number; height: number; sha256: string; bytes: Uint8Array }
export interface FrameVisionInput { source_asset_id: string; input_hash: string; frames: VisionFrame[] }
export interface FrameVisionMetadata extends MediaProviderMetadata { frame_input_sha256: string }
export type FrameVisionTransport = (request: ResponseCreateParamsNonStreaming, configuration: OpenAIMediaConfig, signal?: AbortSignal) => Promise<unknown>;
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(record(value)) && Object.keys(value as object).length === keys.length && keys.every(key => Object.hasOwn(value as object, key));
function inputError(): never { throw new IntegrationError('FRAME_SELECTION_INPUT_INVALID', 'Frame review requires verified images from the bounded source sample.'); }
function stopped(signal?: AbortSignal) { if (signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'Frame review was cancelled.'); }
export function frameVisionFingerprint(frames: Omit<VisionFrame, 'bytes'>[]) {
  return sha(frames.map(frame => [frame.frame_asset_id, frame.source_asset_id, frame.timestamp_ms, frame.width, frame.height, frame.sha256].join('\n')).join('\n\n'));
}
function validateInput(input: FrameVisionInput) {
  if (!exact(input, ['source_asset_id', 'input_hash', 'frames']) || !safeIdentifier(input.source_asset_id) || !/^[a-f0-9]{64}$/u.test(input.input_hash) || !Array.isArray(input.frames) || !input.frames.length || input.frames.length > FRAME_VISION_LIMITS.samples) inputError();
  let total = 0; const ids = new Set<string>();
  for (const frame of input.frames) {
    if (!exact(frame, ['frame_asset_id', 'source_asset_id', 'timestamp_ms', 'width', 'height', 'sha256', 'bytes']) || !safeIdentifier(frame.frame_asset_id) || ids.has(frame.frame_asset_id) || frame.source_asset_id !== input.source_asset_id
      || !Number.isSafeInteger(frame.timestamp_ms) || frame.timestamp_ms < 0 || frame.timestamp_ms >= 1_800_000 || ![frame.width, frame.height].every(value => Number.isSafeInteger(value) && value > 0 && value <= FRAME_VISION_LIMITS.dimension)
      || !(frame.bytes instanceof Uint8Array) || frame.bytes.length < 3 || frame.bytes.length > FRAME_VISION_LIMITS.frameBytes || !/^[a-f0-9]{64}$/u.test(frame.sha256) || sha(frame.bytes) !== frame.sha256
      || frame.bytes[0] !== 0xff || frame.bytes[1] !== 0xd8 || frame.bytes[2] !== 0xff) inputError();
    ids.add(frame.frame_asset_id); total += frame.bytes.length; if (total > FRAME_VISION_LIMITS.totalBytes) inputError();
  }
}
export async function selectVisionFrames(input: FrameVisionInput, configuration: OpenAIMediaConfig, signal?: AbortSignal,
  transport: FrameVisionTransport = requestMediaResponse): Promise<{ result: FrameSelection; metadata: FrameVisionMetadata }> {
  stopped(signal); validateInput(input);
  if (!safeIdentifier(configuration.model) || typeof configuration.apiKey !== 'string' || !configuration.apiKey.trim()) throw new IntegrationError('OPENAI_CONFIGURATION_INVALID', 'Configure the evaluated image-capable frame review model.');
  const schema = { type: 'object', additionalProperties: false, properties: {
    schema_version: { type: 'string', enum: ['1.0'] }, source_asset_id: { type: 'string', enum: [input.source_asset_id] },
    selected_frames: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, properties: { frame_asset_id: { type: 'string', enum: input.frames.map(frame => frame.frame_asset_id) }, reason: { type: 'string', enum: [...FRAME_TECHNICAL_REASONS] } }, required: ['frame_asset_id', 'reason'] } },
    insufficient_frames_reason: { anyOf: [{ type: 'string', enum: [FRAME_INSUFFICIENT_REASON] }, { type: 'null' }] },
  }, required: ['schema_version', 'source_asset_id', 'selected_frames', 'insufficient_frames_reason'] };
  const content: ResponseInputContent[] = [{ type: 'input_text', text: JSON.stringify({ source_asset_id: input.source_asset_id, frames: input.frames.map(frame => ({ frame_asset_id: frame.frame_asset_id, source_asset_id: frame.source_asset_id, timestamp_ms: frame.timestamp_ms, width: frame.width, height: frame.height, sha256: frame.sha256 })) }) }];
  for (const frame of input.frames) content.push({ type: 'input_text', text: JSON.stringify({ frame_asset_id: frame.frame_asset_id, timestamp_ms: frame.timestamp_ms }) }, { type: 'input_image', image_url: 'data:image/jpeg;base64,' + Buffer.from(frame.bytes).toString('base64'), detail: 'high' });
  const request: ResponseCreateParamsNonStreaming = { model: configuration.model, stream: false, store: false, tools: [], instructions: FRAME_SELECTION_PROMPT,
    input: [{ role: 'user', content }], text: { format: { type: 'json_schema', name: FRAME_SELECTION_PROMPT_VERSION, strict: true, schema } }, max_output_tokens: Math.min(configuration.maxOutputTokens ?? 8192, 8192) };
  let raw: unknown;
  try { raw = await transport(request, configuration, signal); }
  catch (error) { stopped(signal); if (error instanceof IntegrationError) throw error; throw new IntegrationError('OPENAI_UNAVAILABLE', 'Automatic frame review is temporarily unavailable.', true); }
  stopped(signal); const response = record(raw);
  if (!response || response.status !== 'completed' || response.error || !Array.isArray(response.output) || !safeIdentifier(response.id) || !safeIdentifier(response.model)) throw new IntegrationError('AI_RESPONSE_NOT_COMPLETE', 'Automatic frame review did not complete.');
  const texts: string[] = [];
  for (const item of response.output) {
    const message = record(item); if (message?.type === 'reasoning') continue;
    if (message?.type !== 'message' || message.role !== 'assistant' || message.status !== 'completed' || !Array.isArray(message.content)) throw new IntegrationError('AI_OUTPUT_UNEXPECTED', 'Automatic frame review returned unexpected output.');
    for (const entry of message.content) { const value = record(entry); if (value?.type === 'refusal') throw new IntegrationError('AI_REFUSAL', 'Automatic frame review was declined; manual selection remains available.');
      if (value?.type !== 'output_text' || typeof value.text !== 'string') throw new IntegrationError('AI_OUTPUT_UNEXPECTED', 'Automatic frame review returned unexpected content.'); texts.push(value.text); }
  }
  if (texts.length !== 1 || Buffer.byteLength(texts[0]) > 16_384) throw new IntegrationError('AI_FRAME_RESULT_INVALID', 'Automatic frame review exceeded its result contract.');
  let payload: unknown; try { payload = JSON.parse(texts[0]); } catch { throw new IntegrationError('AI_FRAME_RESULT_INVALID', 'Automatic frame review returned invalid JSON.'); }
  const result = validateFrameSelection(payload, input.source_asset_id, input.frames);
  if (result.selected_frames.some(frame => !FRAME_TECHNICAL_REASONS.some(reason => reason === frame.reason)) || !(result.insufficient_frames_reason === null || result.insufficient_frames_reason === FRAME_INSUFFICIENT_REASON)
    || result.selected_frames.length === 3 && result.insufficient_frames_reason !== null) throw new IntegrationError('AI_FRAME_RESULT_INVALID', 'Automatic frame review must use only technical reason codes.');
  const rawUsage = record(response.usage); const counts = [rawUsage?.input_tokens, rawUsage?.output_tokens, rawUsage?.total_tokens];
  const usage = counts.every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) ? { input_tokens: counts[0] as number, output_tokens: counts[1] as number, total_tokens: counts[2] as number } : null;
  return { result, metadata: { provider: 'openai', sdk_version: '7.45.1', requested_model: configuration.model, resolved_model: response.model as string, request_id: safeIdentifier(response._request_id), response_id: response.id as string,
    prompt_version: FRAME_SELECTION_PROMPT_VERSION, prompt_sha256: sha(FRAME_SELECTION_PROMPT), schema_sha256: sha(JSON.stringify(schema)), input_sha256: input.input_hash, frame_input_sha256: frameVisionFingerprint(input.frames), usage } };
}
