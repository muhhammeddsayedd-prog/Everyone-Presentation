/** Evaluation transport only. Production extraction limits and sources remain unchanged. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import { extractSpecs, type OpenAISpecsConfig } from '../../../packages/integrations/src/openai-specs.ts';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import type { SpecsExtractionInput } from '../../../packages/integrations/src/specs-types.ts';

export const SETTINGS = { model: 'gpt-6.1-sol', reasoning_effort: 'low', timeout_ms: 120_000,
  production_builder_validation_timeout_ms: 60_000, production_timeout_cap_ms: 70_000,
  max_output_tokens: 16_384, sdk_retries: 0, maximum_provider_requests: 1,
  store: false, stream: false, tools: 0 } as const;
export type Capture = { request: ResponseCreateParamsNonStreaming; bytes: string; sha256: string };
export type Exchange = { response: unknown; http_status: number | null; provider_request_id: string | null };
const safeId = (value: unknown) => typeof value === 'string' && /^req_[A-Za-z0-9_-]{1,128}$/u.test(value) ? value : null;
const safeStatus = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
const productionConfig = (config: OpenAISpecsConfig): OpenAISpecsConfig => ({ ...config,
  timeoutMs: SETTINGS.production_builder_validation_timeout_ms, maxOutputTokens: SETTINGS.max_output_tokens, reasoningEffort: 'low' });

export async function captureProductionRequest(input: SpecsExtractionInput, config: OpenAISpecsConfig): Promise<Capture> {
  assert.equal(config.model, SETTINGS.model);
  const sentinel = new IntegrationError('EVALUATION_CAPTURE_ONLY', 'Request capture only; no transport is available.');
  let captured: ResponseCreateParamsNonStreaming | undefined, calls = 0;
  try {
    await extractSpecs(input, productionConfig(config), async request => {
      assert.equal(++calls, 1); captured = structuredClone(request); throw sentinel;
    });
    assert.fail('Capture must not return a provider response.');
  } catch (error) { if (error !== sentinel) throw error; }
  assert.equal(calls, 1); assert(captured);
  const bytes = JSON.stringify(captured);
  return { request: captured, bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function validateProductionResponse(input: SpecsExtractionInput, config: OpenAISpecsConfig, capture: Capture, response: unknown) {
  let calls = 0;
  const output = await extractSpecs(input, productionConfig(config), async rebuilt => {
    assert.equal(++calls, 1);
    if (JSON.stringify(rebuilt) !== capture.bytes || JSON.stringify(capture.request) !== capture.bytes)
      throw new IntegrationError('EVALUATION_REQUEST_DRIFT', 'Captured and validation request bytes differ.');
    return response; // The exact SDK response object retains its nonenumerable request ID.
  });
  assert.equal(calls, 1); return output;
}

/** Actual pinned SDK, one POST, one120s overall deadline including response-body parsing. */
export async function sendExtendedRequest(capture: Capture, config: OpenAISpecsConfig,
  dispatch: typeof fetch, externalSignal?: AbortSignal): Promise<Exchange> {
  assert.equal(config.model, SETTINGS.model);
  assert.equal(JSON.stringify(capture.request), capture.bytes);
  assert.equal(createHash('sha256').update(capture.bytes).digest('hex'), capture.sha256);
  assert(!Object.keys(process.env).some(name => name.startsWith('OPENAI_') && !['OPENAI_API_KEY', 'OPENAI_EXTRACTION_MODEL'].includes(name)));
  if (externalSignal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'Evaluation was cancelled.');
  const controller = new AbortController(); let expired = false, calls = 0, httpStatus: number | null = null, requestId: string | null = null;
  const timer = setTimeout(() => { expired = true; controller.abort(); }, SETTINGS.timeout_ms);
  const signal = externalSignal ? AbortSignal.any([externalSignal, controller.signal]) : controller.signal;
  try {
    const client = new OpenAI({ apiKey: config.apiKey.trim(), adminAPIKey: null, organization: null, project: null, webhookSecret: null,
      baseURL: 'https://api.openai.com/v1', timeout: SETTINGS.timeout_ms, maxRetries: 0, logLevel: 'off', fetchOptions: { redirect: 'error' },
      fetch: async (input, init) => {
        assert.equal(calls++, 0); assert.equal(String(input), 'https://api.openai.com/v1/responses');
        assert.equal(init?.method, 'POST'); assert.equal(init.body, capture.bytes);
        const response = await dispatch(input, { ...init, redirect: 'error' });
        httpStatus = safeStatus(response.status); requestId = safeId(response.headers.get('x-request-id')); return response;
      } });
    const { data } = await client.responses.create(JSON.parse(capture.bytes) as ResponseCreateParamsNonStreaming, { signal }).withResponse();
    if (externalSignal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'Evaluation was cancelled.');
    if (expired) throw new IntegrationError('OPENAI_TIMEOUT', 'The extended evaluation deadline elapsed.');
    return { response: data, http_status: httpStatus, provider_request_id: requestId };
  } catch (error) {
    if (externalSignal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'Evaluation was cancelled.');
    if (error instanceof IntegrationError) throw error;
    const details = { http_status: httpStatus ?? safeStatus(error instanceof OpenAI.APIError ? error.status : null),
      request_id: requestId ?? safeId(error instanceof OpenAI.APIError ? error.requestID : null) };
    const code = expired || error instanceof OpenAI.APIConnectionTimeoutError ? 'OPENAI_TIMEOUT'
      : details.http_status === 401 || details.http_status === 403 ? 'OPENAI_ACCESS_DENIED'
      : details.http_status === 429 ? 'OPENAI_RATE_LIMITED'
      : details.http_status !== null && details.http_status >= 400 && details.http_status < 500 && ![408, 409].includes(details.http_status) ? 'OPENAI_REQUEST_REJECTED'
      : 'OPENAI_UNAVAILABLE';
    throw new IntegrationError(code, 'The extended evaluation transport did not complete.', false, details);
  } finally { clearTimeout(timer); }
}
