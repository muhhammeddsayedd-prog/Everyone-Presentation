import OpenAI, { toFile } from 'openai';
import type { TranscriptionCreateParamsNonStreaming } from 'openai/resources/audio/transcriptions';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import { createHash } from 'node:crypto';
import { IntegrationError, record, retryAfterMs, safeIdentifier } from './errors.ts';
import { CANDIDATE_PROVIDER_SCHEMA, validateCandidateExtraction, validateMediaScalars } from './media-schema.ts';
import { CANDIDATE_PROMPT, CANDIDATE_PROMPT_VERSION } from './prompts/candidate-v1.ts';
import type { AudioChunk, CandidateExtraction, MediaProviderMetadata, TranscriptionResult, TranscriptSource } from './media-types.ts';

export interface OpenAIMediaConfig { apiKey: string; model: string; timeoutMs?: number; maxOutputTokens?: number }
export type TranscriptionTransport = (request: TranscriptionCreateParamsNonStreaming<'json'>, signal: AbortSignal) => Promise<unknown>;
export type CandidateTransport = (request: ResponseCreateParamsNonStreaming, signal: AbortSignal) => Promise<unknown>;
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function config(value: OpenAIMediaConfig): Required<OpenAIMediaConfig> {
  if (!value || typeof value.apiKey !== 'string' || !value.apiKey.trim() || /[\r\n]/u.test(value.apiKey)
    || !safeIdentifier(value.model)) throw new IntegrationError('OPENAI_CONFIGURATION_INVALID', 'Configure the OpenAI media key and evaluated model.');
  const timeoutMs = value.timeoutMs ?? 60_000; const maxOutputTokens = value.maxOutputTokens ?? 8192;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 70_000 || !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 32_768)
    throw new IntegrationError('OPENAI_CONFIGURATION_INVALID', 'The media timeout or output budget is invalid.');
  return { ...value, apiKey: value.apiKey.trim(), timeoutMs, maxOutputTokens };
}
function usage(value: unknown): Record<string, number | string> | null {
  const input = record(value); if (!input) return null; const output: Record<string, number | string> = {};
  for (const key of ['input_tokens', 'output_tokens', 'total_tokens', 'seconds']) if (typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key] >= 0) output[key] = input[key];
  if (typeof input.type === 'string' && /^[a-z_]{1,40}$/u.test(input.type)) output.type = input.type;
  return Object.keys(output).length ? output : null;
}
export async function requestMediaResponse(request: ResponseCreateParamsNonStreaming, configuration: OpenAIMediaConfig, signal?: AbortSignal): Promise<unknown> {
  const settings = config(configuration); return bounded(settings, requestSignal => client(settings).responses.create(request, { signal: requestSignal }), signal);
}
export function openAIMediaConfigFromEnv(capability: 'transcription' | 'extraction', environment: Readonly<Record<string, string | undefined>> = process.env): OpenAIMediaConfig {
  return config({ apiKey: environment.OPENAI_API_KEY ?? '', model: environment[capability === 'transcription' ? 'OPENAI_TRANSCRIPTION_MODEL' : 'OPENAI_EXTRACTION_MODEL'] ?? '' });
}
function client(settings: Required<OpenAIMediaConfig>) {
  const inherited = (process.env.OPENAI_CUSTOM_HEADERS ?? '').split('\n').filter(value => value.includes(':')).map(value => value.slice(0, value.indexOf(':')).trim().toLowerCase());
  return new OpenAI({ apiKey: settings.apiKey, adminAPIKey: null, organization: null, project: null, webhookSecret: null,
    baseURL: 'https://api.openai.com/v1', maxRetries: 0, timeout: settings.timeoutMs, logLevel: 'off',
    defaultHeaders: { ...Object.fromEntries(inherited.map(name => [name, null])), authorization: `Bearer ${settings.apiKey}`,
      'api-key': null, 'openai-organization': null, 'openai-project': null, 'content-type': null, accept: 'application/json' } });
}
function providerError(error: unknown, signal?: AbortSignal): IntegrationError {
  if (error instanceof IntegrationError) return error;
  if (signal?.aborted) return new IntegrationError('PROCESSING_CANCELLED', 'Media processing was cancelled.');
  const value = record(error); const status = typeof value?.status === 'number' ? value.status : null;
  const headers = value?.headers; const retry = headers instanceof Headers ? headers.get('retry-after') : record(headers)?.['retry-after'];
  const details = { http_status: status, request_id: safeIdentifier(value?.request_id), retry_after_ms: retryAfterMs(typeof retry === 'string' ? retry : null) };
  if (String(value?.name).includes('Timeout') || value?.name === 'AbortError') return new IntegrationError('OPENAI_TIMEOUT', 'Media processing timed out.', true, details);
  if (status === 401 || status === 403) return new IntegrationError('OPENAI_ACCESS_DENIED', 'The OpenAI key or model access needs attention.', false, details);
  if (status === 429) return new IntegrationError(value?.code === 'insufficient_quota' || value?.code === 'billing_hard_limit_reached' ? 'OPENAI_QUOTA_EXCEEDED' : 'OPENAI_RATE_LIMITED', 'OpenAI media capacity needs attention.', value?.code !== 'insufficient_quota' && value?.code !== 'billing_hard_limit_reached', details);
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 409) return new IntegrationError('OPENAI_REQUEST_REJECTED', 'The configured media request was rejected.', false, details);
  return new IntegrationError('OPENAI_UNAVAILABLE', 'OpenAI media processing is temporarily unavailable.', true, details);
}
async function bounded<T>(settings: Required<OpenAIMediaConfig>, operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'Media processing was cancelled.');
  const deadline = AbortSignal.timeout(settings.timeoutMs); const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  try {
    const result = await operation(combined);
    if (deadline.aborted) throw new IntegrationError('OPENAI_TIMEOUT', 'Media processing timed out.', true);
    if (signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'Media processing was cancelled.');
    return result;
  } catch (error) { throw providerError(error, signal); }
}
/** Remove only exact multiword overlap, retaining every provider chunk unchanged
 * in segments. No translation, invented timestamp, or probabilistic rewriting. */
export function joinTranscriptChunks(texts: string[]): string {
  let result = '';
  for (const text of texts) {
    const previous = result.match(/\S+/gu) ?? []; const current = [...text.matchAll(/\S+/gu)];
    const normalize = (word: string) => word.normalize('NFKC').toLocaleLowerCase('und').replace(/[\p{P}\p{S}]/gu, '');
    let overlap = 0;
    for (let count = Math.min(100, previous.length, current.length); count >= 3; count--) {
      if (previous.slice(-count).every((word, index) => normalize(word) && normalize(word) === normalize(current[index][0]))) { overlap = count; break; }
    }
    const remainder = overlap ? text.slice((current[overlap - 1].index ?? 0) + current[overlap - 1][0].length).trimStart() : text;
    result = [result, remainder].filter(Boolean).join('\n');
  }
  return result;
}
export async function transcribeAudio(input: { source_asset_id: string; chunks: AudioChunk[]; languages?: string[] }, configuration: OpenAIMediaConfig,
  transport?: TranscriptionTransport, signal?: AbortSignal): Promise<{ result: TranscriptionResult; metadata: MediaProviderMetadata[] }> {
  const settings = config(configuration);
  if (!safeIdentifier(input.source_asset_id) || !Array.isArray(input.chunks) || !input.chunks.length || input.chunks.length > 20
    || input.languages && (input.languages.length > 10 || input.languages.some(language => !/^[a-z]{2,3}$/u.test(language)))) throw new IntegrationError('TRANSCRIPTION_SOURCE_INVALID', 'Audio chunks or language hints are invalid.');
  const segments: TranscriptionResult['segments'] = []; const metadata: MediaProviderMetadata[] = []; const languages = new Set<string>();
  let previousEnd = 0;
  for (const [index, chunk] of input.chunks.entries()) {
    if (chunk.index !== index || chunk.mime_type !== 'audio/mpeg' || !(chunk.bytes instanceof Uint8Array) || !chunk.bytes.length || chunk.bytes.length > 24 * 1024 * 1024
      || chunk.sha256 !== hash(chunk.bytes) || !Number.isSafeInteger(chunk.start_ms) || !Number.isSafeInteger(chunk.end_ms) || chunk.start_ms < 0 || chunk.end_ms <= chunk.start_ms
      || index > 0 && chunk.start_ms < previousEnd - 5000) throw new IntegrationError('TRANSCRIPTION_SOURCE_INVALID', 'Audio chunk identity, bounds or checksum is invalid.');
    previousEnd = chunk.end_ms;
    const request: TranscriptionCreateParamsNonStreaming<'json'> = { model: settings.model, file: await toFile(chunk.bytes, `chunk-${index}.mp3`, { type: 'audio/mpeg' }), response_format: 'json', stream: false,
      ...(input.languages?.length ? { languages: input.languages } : {}) };
    const raw = record(await bounded(settings, requestSignal => transport ? transport(request, requestSignal) : client(settings).audio.transcriptions.create(request, { signal: requestSignal }), signal));
    if (!raw || typeof raw.text !== 'string' || raw.text.length > 200_000) throw new IntegrationError('TRANSCRIPTION_RESULT_INVALID', 'The transcription response is invalid.');
    validateMediaScalars(raw.text);
    if (raw.languages !== undefined) {
      if (!Array.isArray(raw.languages) || raw.languages.length > 10) throw new IntegrationError('TRANSCRIPTION_RESULT_INVALID', 'Detected languages are invalid.');
      for (const language of raw.languages) { const code = record(language)?.code; if (typeof code !== 'string' || !/^[a-z]{2,3}$/u.test(code)) throw new IntegrationError('TRANSCRIPTION_RESULT_INVALID', 'Detected languages are invalid.'); languages.add(code); }
    }
    segments.push({ index, start_ms: chunk.start_ms, end_ms: chunk.end_ms, text: raw.text.trim() });
    metadata.push({ provider: 'openai', sdk_version: '7.45.1', requested_model: settings.model, resolved_model: safeIdentifier(raw.model), request_id: safeIdentifier(raw._request_id), response_id: safeIdentifier(raw.id),
      prompt_version: 'transcription-original-language.v1', input_sha256: chunk.sha256, audio_duration_ms: chunk.end_ms - chunk.start_ms, usage: usage(raw.usage) });
  }
  const original_text = joinTranscriptChunks(segments.map(segment => segment.text));
  if (!original_text.trim()) throw new IntegrationError('TRANSCRIPTION_EMPTY', 'No intelligible speech was returned; frames and manual profile entry remain available.');
  return { result: { source_asset_id: input.source_asset_id, original_text, segments, languages: [...languages], timestamp_precision: 'chunk' }, metadata };
}
export async function extractCandidate(input: TranscriptSource & { input_hash: string }, configuration: OpenAIMediaConfig,
  transport?: CandidateTransport, signal?: AbortSignal): Promise<{ result: CandidateExtraction; metadata: MediaProviderMetadata }> {
  const settings = config(configuration);
  if (!safeIdentifier(input.source_asset_id) || !/^[a-f0-9]{64}$/u.test(input.input_hash) || !Array.isArray(input.segments) || !input.segments.length || input.segments.length > 1000
    || input.segments.some((segment, index) => segment.index !== index || !Number.isSafeInteger(segment.start_ms) || !Number.isSafeInteger(segment.end_ms) || segment.start_ms < 0 || segment.end_ms <= segment.start_ms || typeof segment.text !== 'string'))
    throw new IntegrationError('CANDIDATE_SOURCE_INVALID', 'Candidate extraction requires the verified transcript and input fingerprint.');
  const source = JSON.stringify({ source_asset_id: input.source_asset_id, segments: input.segments });
  if (Buffer.byteLength(source) > 2_000_000 || !input.segments.some(segment => segment.text.trim())) throw new IntegrationError('CANDIDATE_SOURCE_INVALID', 'The candidate transcript is empty or too large.');
  validateMediaScalars(input.segments);
  const request: ResponseCreateParamsNonStreaming = { model: settings.model, stream: false, store: false, tools: [], instructions: CANDIDATE_PROMPT,
    input: [{ role: 'user', content: [{ type: 'input_text', text: source }] }], text: { format: { type: 'json_schema', name: 'candidate_extract_v1', strict: true, schema: structuredClone(CANDIDATE_PROVIDER_SCHEMA) } }, max_output_tokens: settings.maxOutputTokens };
  const response = record(await bounded(settings, requestSignal => transport ? transport(request, requestSignal) : client(settings).responses.create(request, { signal: requestSignal }), signal));
  if (!response || response.status !== 'completed' || response.error || !Array.isArray(response.output)) throw new IntegrationError('AI_RESPONSE_NOT_COMPLETE', 'Candidate extraction did not complete.');
  const texts: string[] = [];
  for (const item of response.output) {
    const message = record(item); if (message?.type === 'reasoning') continue;
    if (message?.type !== 'message' || message.role !== 'assistant' || message.status !== 'completed' || !Array.isArray(message.content)) throw new IntegrationError('AI_OUTPUT_UNEXPECTED', 'Candidate extraction returned an unexpected output.');
    for (const entry of message.content) { const content = record(entry); if (content?.type === 'refusal') throw new IntegrationError('AI_REFUSAL', 'Candidate extraction was declined; manual entry remains available.');
      if (content?.type !== 'output_text' || typeof content.text !== 'string') throw new IntegrationError('AI_OUTPUT_UNEXPECTED', 'Candidate extraction returned unexpected content.'); texts.push(content.text); }
  }
  if (texts.length !== 1 || Buffer.byteLength(texts[0]) > 2_000_000 || !safeIdentifier(response.id) || !safeIdentifier(response.model)) throw new IntegrationError('AI_RESPONSE_INVALID', 'Candidate extraction response is invalid.');
  let payload: unknown; try { payload = JSON.parse(texts[0]); } catch { throw new IntegrationError('AI_RESULT_INVALID', 'Candidate extraction was not valid JSON.'); }
  return { result: validateCandidateExtraction(payload, input), metadata: { provider: 'openai', sdk_version: '7.45.1', requested_model: settings.model, resolved_model: response.model as string,
    request_id: safeIdentifier(response._request_id), response_id: response.id as string, prompt_version: CANDIDATE_PROMPT_VERSION, prompt_sha256: hash(CANDIDATE_PROMPT),
    provider_schema_sha256: hash(JSON.stringify(CANDIDATE_PROVIDER_SCHEMA)), input_sha256: input.input_hash, usage: usage(response.usage) } };
}
