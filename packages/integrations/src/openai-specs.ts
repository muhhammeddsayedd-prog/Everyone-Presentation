import OpenAI from 'openai';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import { IntegrationError, record, retryAfterMs, safeIdentifier } from './errors.ts';
import { SPECS_PROMPT, SPECS_PROMPT_VERSION } from './prompts/specs-v1.ts';
import {
  sha256, SPECS_PROVIDER_SCHEMA, SPECS_PROVIDER_SCHEMA_SHA256, SPECS_SCHEMA_SHA256,
  validateSpecsExtraction,
} from './specs-schema.ts';
import type { SpecsExtractionInput, SpecsExtractionOutput } from './specs-types.ts';

export interface OpenAISpecsConfig {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
}

/** Injection is for deterministic adapter tests; it does not imply a real provider call. */
export type SpecsTransport = (request: ResponseCreateParamsNonStreaming, signal?: AbortSignal) => Promise<unknown>;

export function openAISpecsConfigFromEnv(environment: Readonly<Record<string, string | undefined>> = process.env): OpenAISpecsConfig {
  return checkedConfig({ apiKey: environment.OPENAI_API_KEY ?? '', model: environment.OPENAI_EXTRACTION_MODEL ?? '' });
}

function checkedConfig(config: OpenAISpecsConfig): Required<OpenAISpecsConfig> {
  if (!config.apiKey.trim()) {
    throw new IntegrationError('OPENAI_KEY_REQUIRED', 'Configure OPENAI_API_KEY in the server secret environment.');
  }
  if (!config.model.trim()) {
    throw new IntegrationError('OPENAI_EXTRACTION_MODEL_REQUIRED', 'Configure and evaluate OPENAI_EXTRACTION_MODEL for strict specs extraction.');
  }
  if (/\s/.test(config.model) || config.model.length > 200 || /[\r\n]/.test(config.apiKey)) {
    throw new IntegrationError('OPENAI_CONFIGURATION_INVALID', 'OpenAI server configuration is invalid.');
  }
  const timeoutMs = config.timeoutMs ?? 60_000;
  const maxOutputTokens = config.maxOutputTokens ?? 16_384;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 70_000
    || !Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 32_768) {
    throw new IntegrationError('OPENAI_CONFIGURATION_INVALID', 'OpenAI extraction timeout or output budget is invalid.');
  }
  return { apiKey: config.apiKey.trim(), model: config.model, timeoutMs, maxOutputTokens };
}

function validateInput(input: SpecsExtractionInput): string {
  if (!input || typeof input !== 'object' || !safeIdentifier(input.correlationId) || !/^[a-f0-9]{64}$/.test(input.inputHash)
    || (input.sourceAssetId !== null && !safeIdentifier(input.sourceAssetId))
    || !Array.isArray(input.paragraphs) || !input.paragraphs.length || input.paragraphs.length > 10_000) {
    throw new IntegrationError('SPECS_SOURCE_INVALID', 'Prepared specs require valid identity, fingerprint and source paragraphs.');
  }
  const indexes = new Set<number>();
  for (const paragraph of input.paragraphs) {
    if (!paragraph || typeof paragraph !== 'object' || !Number.isSafeInteger(paragraph.index) || paragraph.index < 0 || indexes.has(paragraph.index)
      || (paragraph.page !== null && (!Number.isSafeInteger(paragraph.page) || paragraph.page < 1))
      || typeof paragraph.text !== 'string') {
      throw new IntegrationError('SPECS_SOURCE_INVALID', 'Prepared document paragraph mapping is invalid.');
    }
    indexes.add(paragraph.index);
  }
  const source = JSON.stringify({ source_asset_id: input.sourceAssetId, paragraphs: input.paragraphs });
  if (!input.paragraphs.some((paragraph) => paragraph.text.trim()) || Buffer.byteLength(source, 'utf8') > 2_000_000) {
    throw new IntegrationError('SPECS_SOURCE_UNREADABLE', 'Specs text is empty or exceeds the configured preparation limit.');
  }
  return source;
}

function providerError(error: unknown, signal?: AbortSignal): IntegrationError {
  if (error instanceof IntegrationError) return error;
  if (signal?.aborted) return new IntegrationError('PROCESSING_CANCELLED', 'The extraction attempt was cancelled.');
  const details = record(error);
  const status = typeof details?.status === 'number' ? details.status : null;
  const name = typeof details?.name === 'string' ? details.name : '';
  const headers = details?.headers;
  const retryHeader = headers instanceof Headers ? headers.get('retry-after') : record(headers)?.['retry-after'];
  const diagnostic = { http_status: status, request_id: safeIdentifier(details?.request_id),
    retry_after_ms: retryAfterMs(typeof retryHeader === 'string' ? retryHeader : null) };
  if (name.includes('Timeout') || name === 'AbortError') {
    return new IntegrationError('OPENAI_TIMEOUT', 'OpenAI extraction timed out; the job can retry.', true);
  }
  if (status === 401 || status === 403) {
    return new IntegrationError('OPENAI_ACCESS_DENIED', 'OpenAI credentials or model access need attention.', false, diagnostic);
  }
  if (status === 429) {
    if (details?.code === 'insufficient_quota' || details?.code === 'billing_hard_limit_reached') {
      return new IntegrationError('OPENAI_QUOTA_EXCEEDED', 'The configured OpenAI account quota needs attention.', false, diagnostic);
    }
    return new IntegrationError('OPENAI_RATE_LIMITED', 'OpenAI rate limit reached; the job can retry.', true, diagnostic);
  }
  if (status !== null && status >= 400 && status < 500 && status !== 408 && status !== 409) {
    return new IntegrationError('OPENAI_REQUEST_REJECTED', 'OpenAI rejected the configured extraction request.', false, diagnostic);
  }
  return new IntegrationError('OPENAI_UNAVAILABLE', 'OpenAI extraction is temporarily unavailable.', true,
    diagnostic);
}

function parseResponse(value: unknown): {
  payload: unknown; id: string; model: string; requestId: string | null;
  usage: SpecsExtractionOutput['metadata']['usage'];
} {
  const response = record(value);
  if (!response || !Array.isArray(response.output)) {
    throw new IntegrationError('AI_RESPONSE_INVALID', 'OpenAI returned an unsupported response envelope.');
  }
  if (response.status === 'incomplete') {
    throw new IntegrationError('AI_RESPONSE_INCOMPLETE', 'OpenAI extraction was incomplete; review the source or output budget.');
  }
  if (response.status !== 'completed' || response.error) {
    throw new IntegrationError('AI_RESPONSE_NOT_COMPLETE', 'OpenAI extraction did not complete successfully.');
  }
  const text: string[] = [];
  for (const rawItem of response.output) {
    const item = record(rawItem);
    if (item?.type === 'reasoning') continue;
    if (!item || item.type !== 'message' || item.role !== 'assistant' || item.status !== 'completed' || !Array.isArray(item.content)) {
      throw new IntegrationError('AI_OUTPUT_UNEXPECTED', 'OpenAI returned an unexpected output type.');
    }
    for (const rawContent of item.content) {
      const content = record(rawContent);
      if (content?.type === 'refusal') {
        throw new IntegrationError('AI_REFUSAL', 'OpenAI declined this extraction; manual requirements entry remains available.');
      }
      if (content?.type !== 'output_text' || typeof content.text !== 'string') {
        throw new IntegrationError('AI_OUTPUT_UNEXPECTED', 'OpenAI returned an unexpected content type.');
      }
      text.push(content.text);
    }
  }
  if (text.length !== 1 || Buffer.byteLength(text[0], 'utf8') > 4_000_000) {
    throw new IntegrationError('AI_RESPONSE_INVALID', 'OpenAI extraction did not contain one bounded structured result.');
  }
  const id = safeIdentifier(response.id);
  const model = safeIdentifier(response.model);
  if (!id || !model) throw new IntegrationError('AI_RESPONSE_INVALID', 'OpenAI response identity or model metadata is invalid.');
  let payload: unknown;
  try { payload = JSON.parse(text[0]); }
  catch { throw new IntegrationError('AI_RESULT_INVALID', 'OpenAI extraction was not valid JSON.'); }
  const rawUsage = record(response.usage);
  const usageValues = [rawUsage?.input_tokens, rawUsage?.output_tokens, rawUsage?.total_tokens];
  const usage = usageValues.every((count) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0)
    ? { input_tokens: usageValues[0] as number, output_tokens: usageValues[1] as number, total_tokens: usageValues[2] as number } : null;
  return { payload, id, model, requestId: safeIdentifier(response._request_id), usage };
}

export async function extractSpecs(
  input: SpecsExtractionInput,
  configuration: OpenAISpecsConfig,
  transport?: SpecsTransport,
  signal?: AbortSignal,
): Promise<SpecsExtractionOutput> {
  const config = checkedConfig(configuration);
  const source = validateInput(input);
  if (signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'The extraction attempt was cancelled.');
  // Official Responses strict schema path. No tools, network destinations or executable source instructions.
  // https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
  const request: ResponseCreateParamsNonStreaming = {
    model: config.model, stream: false, store: false, tools: [],
    instructions: SPECS_PROMPT,
    input: [{ role: 'user', content: [{ type: 'input_text', text: source }] }],
    text: { format: { type: 'json_schema', name: 'specs_extraction_v1', strict: true, schema: structuredClone(SPECS_PROVIDER_SCHEMA) } },
    max_output_tokens: config.maxOutputTokens,
  };
  // Application jobs own retries. Do not multiply attempts inside the SDK.
  const send = transport ?? ((body, requestSignal) => new OpenAI({
    apiKey: config.apiKey, timeout: config.timeoutMs, maxRetries: 0,
  }).responses.create(body, { signal: requestSignal }));
  const deadline = AbortSignal.timeout(config.timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let response: unknown;
  try { response = await send(request, requestSignal); }
  catch (error) { throw providerError(error, signal); }
  if (signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'The extraction attempt was cancelled.');
  if (deadline.aborted) throw new IntegrationError('OPENAI_TIMEOUT', 'OpenAI extraction timed out; the job can retry.', true);
  const parsed = parseResponse(response);
  const result = validateSpecsExtraction(parsed.payload, input);
  return { result, metadata: {
    provider: 'openai', sdk_version: '7.45.1', requested_model: config.model, resolved_model: parsed.model,
    response_id: parsed.id, request_id: parsed.requestId, correlation_id: input.correlationId,
    input_sha256: input.inputHash, prepared_source_sha256: sha256(source),
    prompt_version: SPECS_PROMPT_VERSION, prompt_sha256: sha256(SPECS_PROMPT),
    schema_version: '1.0', schema_sha256: SPECS_SCHEMA_SHA256, provider_schema_sha256: SPECS_PROVIDER_SCHEMA_SHA256,
    usage: parsed.usage,
  } };
}
