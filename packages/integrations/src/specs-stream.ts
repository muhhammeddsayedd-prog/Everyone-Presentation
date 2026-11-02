import OpenAI from 'openai';
import type { ResponseCreateParamsNonStreaming, ResponseCreateParamsStreaming } from 'openai/resources/responses/responses';
import { IntegrationError, record } from './errors.ts';

const MAXIMUM_WIRE_BYTES = 8 * 1024 * 1024;
const MAXIMUM_EVENTS = 50_000;
const safeRequestId = (value: unknown) => typeof value === 'string' && /^req_[A-Za-z0-9_-]{1,128}$/u.test(value) ? value : null;
interface StreamOptions { apiKey: string; timeoutMs: number; headers: Record<string, string | null> }
interface StreamSignals { request: AbortSignal; deadline: AbortSignal; caller?: AbortSignal }
interface StreamResult { response: unknown; requestId: string | null; httpStatus: number | null }

/** One private terminal response, never deltas. Caller owns strict final validation. */
export async function sendBoundedSpecsStream(request: ResponseCreateParamsNonStreaming, options: StreamOptions,
  signals: StreamSignals, projectError: (error: unknown) => IntegrationError): Promise<StreamResult> {
  let httpStatus: number | null = null, requestId: string | null = null, calls = 0, bytes = 0, events = 0;
  let limitFailure: IntegrationError | undefined;
  const details = () => ({ http_status: httpStatus, request_id: requestId });
  const controller = new AbortController();
  const signal = AbortSignal.any([signals.request, controller.signal]);
  let rejectStop!: (error: IntegrationError) => void;
  const stopped = new Promise<never>((_, reject) => { rejectStop = reject; });
  void stopped.catch(() => {});
  const stop = (error: IntegrationError) => { rejectStop(error); controller.abort(); };
  const interrupt = () => stop(new IntegrationError(signals.caller?.aborted ? 'PROCESSING_CANCELLED' : 'OPENAI_TIMEOUT',
    signals.caller?.aborted ? 'The extraction attempt was cancelled.' : 'OpenAI extraction timed out; the job can retry.', !signals.caller?.aborted, details()));
  signals.request.addEventListener('abort', interrupt, { once: true });
  let abortStream: (() => void) | undefined, returnIterator: (() => Promise<unknown>) | undefined, cancelBody: (() => Promise<unknown>) | undefined;
  try {
    if (signals.request.aborted) { interrupt(); throw await stopped; }
    const client = new OpenAI({ apiKey: options.apiKey, adminAPIKey: null, organization: null, project: null, webhookSecret: null,
      baseURL: 'https://api.openai.com/v1', timeout: options.timeoutMs, maxRetries: 0, logLevel: 'off', defaultHeaders: options.headers,
      fetchOptions: { redirect: 'error' }, fetch: async (input, init) => {
        if (++calls !== 1 || String(input) !== 'https://api.openai.com/v1/responses' || init?.method !== 'POST') {
          throw new IntegrationError('OPENAI_UNAVAILABLE', 'The specs request could not be dispatched safely.', false);
        }
        const raw = await globalThis.fetch(input, { ...init, redirect: 'error' });
        httpStatus = Number.isInteger(raw.status) && raw.status >= 100 && raw.status <= 599 ? raw.status : null;
        requestId = safeRequestId(raw.headers.get('x-request-id'));
        if (!raw.body) return raw;
        const reader = raw.body.getReader(); cancelBody = () => reader.cancel();
        const body = new ReadableStream<Uint8Array>({
          async pull(output) {
            try {
              const chunk = await reader.read(); if (chunk.done) { output.close(); return; }
              bytes += chunk.value.byteLength;
              if (bytes > MAXIMUM_WIRE_BYTES) {
                limitFailure = new IntegrationError('AI_RESPONSE_INVALID', 'OpenAI extraction exceeded the supported response limit.', false, details());
                stop(limitFailure); output.error(limitFailure); void reader.cancel().catch(() => {}); return;
              }
              output.enqueue(chunk.value);
            } catch { output.error(new Error('SPECS_STREAM_INTERRUPTED')); }
          },
          cancel() { controller.abort(); return reader.cancel(); },
        });
        return new Response(body, { status: raw.status, headers: raw.headers });
      } });
    const wire: ResponseCreateParamsStreaming = { ...request, stream: true };
    const received = await Promise.race([client.responses.create(wire, { signal }).withResponse(), stopped]);
    const stream = received.data, iterator = stream[Symbol.asyncIterator]();
    abortStream = () => stream.controller.abort(); returnIterator = () => iterator.return?.() ?? Promise.resolve();
    for (;;) {
      const next = await Promise.race([iterator.next(), stopped]);
      if (signals.request.aborted) { interrupt(); throw await stopped; }
      if (next.done) throw new IntegrationError('AI_RESPONSE_INVALID', 'OpenAI extraction ended without a terminal response.', false, details());
      if (++events > MAXIMUM_EVENTS) throw new IntegrationError('AI_RESPONSE_INVALID', 'OpenAI extraction exceeded the supported event limit.', false, details());
      const event = record(next.value);
      if (!event || typeof event.type !== 'string') throw new IntegrationError('AI_RESPONSE_INVALID', 'OpenAI returned an unsupported stream event.', false, details());
      if (['response.completed', 'response.incomplete', 'response.failed'].includes(event.type)) {
        const response = record(event.response);
        if (!response || response.status !== event.type.slice('response.'.length)) {
          throw new IntegrationError('AI_RESPONSE_INVALID', 'OpenAI returned an inconsistent terminal response.', false, details());
        }
        return { response, requestId, httpStatus }; // No synthesized response._request_id.
      }
    }
  } catch (error) {
    const failure = projectError(limitFailure ?? error);
    throw new IntegrationError(failure.code, failure.message, failure.retryable,
      { ...failure.details, http_status: httpStatus ?? failure.details.http_status ?? null, request_id: requestId ?? failure.details.request_id ?? null });
  } finally {
    signals.request.removeEventListener('abort', interrupt); controller.abort(); abortStream?.();
    // Cleanup cannot make an uncooperative response body defeat the whole deadline.
    void returnIterator?.().catch(() => {}); void cancelBody?.().catch(() => {});
  }
}
