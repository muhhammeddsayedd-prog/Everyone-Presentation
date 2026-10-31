import { createHash } from 'node:crypto';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import { IntegrationError, record, safeIdentifier } from './errors.ts';
import { requestMediaResponse, type OpenAIMediaConfig } from './openai-media.ts';
import type { EnglishTranscript, MediaProviderMetadata } from './media-types.ts';
import { TRANSCRIPT_ENGLISH_PROMPT, TRANSCRIPT_ENGLISH_PROMPT_VERSION } from './prompts/transcript-english-v1.ts';

export const ENGLISH_TRANSCRIPT_LIMITS = Object.freeze({ sourceCharacters: 200000, chunkCharacters: 4000, chunks: 64, chunkOutputCharacters: 20000, totalOutputCharacters: 200000 });
export interface EnglishTranscriptInput { source_asset_id: string; original_text: string }
export type EnglishTranscriptTransport = (request: ResponseCreateParamsNonStreaming, configuration: OpenAIMediaConfig, signal?: AbortSignal) => Promise<unknown>;
const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(record(value)) && Object.keys(value as object).length === keys.length && keys.every(key => Object.hasOwn(value as object, key));
const SCHEMA = { type: 'object', additionalProperties: false, properties: { language: { type: 'string', enum: ['en'] }, text: { type: 'string' } }, required: ['language', 'text'] };
const SAFE_CODES = new Set(['OPENAI_CONFIGURATION_INVALID', 'OPENAI_TIMEOUT', 'OPENAI_ACCESS_DENIED', 'OPENAI_QUOTA_EXCEEDED', 'OPENAI_RATE_LIMITED', 'OPENAI_REQUEST_REJECTED', 'OPENAI_UNAVAILABLE', 'PROCESSING_CANCELLED', 'AI_REFUSAL', 'AI_RESPONSE_NOT_COMPLETE', 'AI_OUTPUT_UNEXPECTED', 'ENGLISH_TRANSCRIPT_INPUT_INVALID', 'ENGLISH_TRANSCRIPT_RESULT_INVALID']);

/** Carries actual successful-chunk metadata only, never source/partial text or raw errors. */
export class EnglishTranscriptNormalizationError extends IntegrationError {
  readonly completedMetadata: MediaProviderMetadata[];
  constructor(code: string, retryable: boolean, completedMetadata: MediaProviderMetadata[], retryAfterMs?: number) {
    super(SAFE_CODES.has(code) ? code : 'OPENAI_UNAVAILABLE', 'English transcript normalization could not complete.', retryable,
      typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs >= 0 ? { retry_after_ms: Math.min(retryAfterMs, 300000) } : {});
    this.completedMetadata = structuredClone(completedMetadata);
  }
}
function stopped(signal?: AbortSignal) { if (signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'English transcript normalization was cancelled.'); }
/** A script guard, not a semantic language/translation accuracy classifier. */
export function englishDisplayScript(text: string): boolean {
  for (const char of text) if (/\p{L}/u.test(char) && !/\p{Script=Latin}/u.test(char)) return false;
  return true;
}
function validText(value: unknown, maximum: number): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2 * maximum) return false;
  let length = 0;
  for (const char of value) { const point = char.codePointAt(0)!;
    if (++length > maximum || point >= 0xd800 && point <= 0xdfff || point === 127 || point < 32 && ![9, 10, 13].includes(point)) return false;
  }
  return true;
}
/** Every source character occurs exactly once; boundaries never split a surrogate pair. */
export function splitEnglishTranscriptSource(text: string): string[] {
  if (!validText(text, ENGLISH_TRANSCRIPT_LIMITS.sourceCharacters)) throw new IntegrationError('ENGLISH_TRANSCRIPT_INPUT_INVALID', 'English transcript normalization requires bounded original source text.');
  const points = Array.from(text), chunks: string[] = [];
  for (let start = 0; start < points.length;) {
    let end = Math.min(start + ENGLISH_TRANSCRIPT_LIMITS.chunkCharacters, points.length);
    if (end < points.length) {
      for (let index = end - 1; index >= start + ENGLISH_TRANSCRIPT_LIMITS.chunkCharacters - 500; index--) {
        if (/\s/u.test(points[index])) { end = index + 1; break; }
      }
    }
    chunks.push(points.slice(start, end).join('')); start = end;
  }
  if (!chunks.length || chunks.length > ENGLISH_TRANSCRIPT_LIMITS.chunks) throw new IntegrationError('ENGLISH_TRANSCRIPT_INPUT_INVALID', 'English transcript normalization exceeded its source limits.');
  return chunks;
}
function usage(value: unknown): MediaProviderMetadata['usage'] {
  const row = record(value), counts = [row?.input_tokens, row?.output_tokens, row?.total_tokens];
  return counts.every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
    ? { input_tokens: counts[0] as number, output_tokens: counts[1] as number, total_tokens: counts[2] as number } : null;
}
function englishText(raw: unknown): { text: string; response: Record<string, unknown> } {
  const response = record(raw);
  if (!response || response.status !== 'completed' || response.error || !Array.isArray(response.output) || !safeIdentifier(response.id) || !safeIdentifier(response.model))
    throw new IntegrationError('AI_RESPONSE_NOT_COMPLETE', 'English transcript normalization did not complete.');
  const texts: string[] = [];
  for (const item of response.output) {
    const message = record(item); if (message?.type === 'reasoning') continue;
    if (message?.type !== 'message' || message.role !== 'assistant' || message.status !== 'completed' || !Array.isArray(message.content)) throw new IntegrationError('AI_OUTPUT_UNEXPECTED', 'English transcript normalization returned unexpected output.');
    for (const entry of message.content) {
      const content = record(entry);
      if (content?.type === 'refusal') throw new IntegrationError('AI_REFUSAL', 'English transcript normalization was declined.');
      if (content?.type !== 'output_text' || typeof content.text !== 'string') throw new IntegrationError('AI_OUTPUT_UNEXPECTED', 'English transcript normalization returned unexpected content.');
      texts.push(content.text);
    }
  }
  if (texts.length !== 1 || Buffer.byteLength(texts[0]) > 4 * ENGLISH_TRANSCRIPT_LIMITS.chunkOutputCharacters + 1024) throw new IntegrationError('ENGLISH_TRANSCRIPT_RESULT_INVALID', 'English transcript normalization exceeded its output limit.');
  let value: unknown; try { value = JSON.parse(texts[0]); } catch { throw new IntegrationError('ENGLISH_TRANSCRIPT_RESULT_INVALID', 'English transcript normalization returned invalid JSON.'); }
  if (!exact(value, ['language', 'text']) || value.language !== 'en' || !validText(value.text, ENGLISH_TRANSCRIPT_LIMITS.chunkOutputCharacters) || !englishDisplayScript(value.text)) throw new IntegrationError('ENGLISH_TRANSCRIPT_RESULT_INVALID', 'English transcript normalization did not match its contract.');
  return { text: value.text, response };
}
export async function normalizeTranscriptEnglish(input: EnglishTranscriptInput, configuration: OpenAIMediaConfig, signal?: AbortSignal,
  transport: EnglishTranscriptTransport = requestMediaResponse): Promise<EnglishTranscript> {
  stopped(signal);
  if (!exact(input, ['source_asset_id', 'original_text']) || !safeIdentifier(input.source_asset_id)) throw new IntegrationError('ENGLISH_TRANSCRIPT_INPUT_INVALID', 'English transcript normalization requires a verified source.');
  const chunks = splitEnglishTranscriptSource(input.original_text);
  const timeoutMs = configuration.timeoutMs ?? 60000, maximumTokens = configuration.maxOutputTokens ?? 8192;
  if (!safeIdentifier(configuration.model) || typeof configuration.apiKey !== 'string' || !configuration.apiKey.trim() || /[\r\n]/u.test(configuration.apiKey)
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 70000 || !Number.isSafeInteger(maximumTokens) || maximumTokens < 256 || maximumTokens > 32768)
    throw new IntegrationError('OPENAI_CONFIGURATION_INVALID', 'Configure the existing evaluated text model for English normalization.');
  const metadata: MediaProviderMetadata[] = [], output: string[] = [];
  try {
    for (const [index, chunk] of chunks.entries()) {
      stopped(signal);
      const source = JSON.stringify({ source_asset_id: input.source_asset_id, chunk_index: index, chunk_count: chunks.length, text: chunk });
      const request: ResponseCreateParamsNonStreaming = { model: configuration.model, store: false, stream: false, tools: [], instructions: TRANSCRIPT_ENGLISH_PROMPT,
        input: [{ role: 'user', content: [{ type: 'input_text', text: source }] }],
        text: { format: { type: 'json_schema', name: 'transcript_english_v1', strict: true, schema: structuredClone(SCHEMA) } }, max_output_tokens: Math.min(maximumTokens, 8192) };
      const deadline = AbortSignal.timeout(timeoutMs), combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
      let abort!: () => void;
      const expired = new Promise<never>((_resolve, reject) => { abort = () => reject(new IntegrationError(signal?.aborted ? 'PROCESSING_CANCELLED' : 'OPENAI_TIMEOUT', 'English transcript normalization stopped before completion.', !signal?.aborted)); combined.addEventListener('abort', abort, { once: true }); if (combined.aborted) abort(); });
      let raw: unknown;
      try { raw = await Promise.race([expired, Promise.resolve().then(() => { stopped(signal); return transport(request, configuration, combined); })]); }
      finally { combined.removeEventListener('abort', abort); }
      stopped(signal);
      if (deadline.aborted) throw new IntegrationError('OPENAI_TIMEOUT', 'English transcript normalization timed out.', true);
      const result = englishText(raw);
      metadata.push({ provider: 'openai', task: 'transcript_english', sdk_version: '7.45.1', requested_model: configuration.model, resolved_model: result.response.model as string,
        request_id: safeIdentifier(result.response._request_id), response_id: result.response.id as string, prompt_version: TRANSCRIPT_ENGLISH_PROMPT_VERSION,
        prompt_sha256: sha(TRANSCRIPT_ENGLISH_PROMPT), schema_sha256: sha(JSON.stringify(SCHEMA)), input_sha256: sha(source), usage: usage(result.response.usage) });
      if (Array.from([...output, result.text].join('\n')).length > ENGLISH_TRANSCRIPT_LIMITS.totalOutputCharacters) throw new IntegrationError('ENGLISH_TRANSCRIPT_RESULT_INVALID', 'English transcript normalization exceeded its total output limit.');
      output.push(result.text);
    }
  } catch (error) {
    stopped(signal);
    if (error instanceof IntegrationError) throw new EnglishTranscriptNormalizationError(error.code, error.retryable, metadata,
      typeof error.details.retry_after_ms === 'number' ? error.details.retry_after_ms : undefined);
    throw new EnglishTranscriptNormalizationError('OPENAI_UNAVAILABLE', true, metadata);
  }
  stopped(signal);
  return { status: 'available', text: output.join('\n'), source_sha256: sha(input.original_text), metadata, failure_code: null };
}
