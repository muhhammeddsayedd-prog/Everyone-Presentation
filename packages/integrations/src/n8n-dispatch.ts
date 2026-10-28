import { IntegrationError, retryAfterMs, safeIdentifier } from './errors.ts';

/** Small trusted outbox envelope; no source bytes, bearer grants or lease credentials. */
export interface StageReadyEnvelope {
  event_id: string;
  event_type: 'job.stage_ready';
  contract_version: '1.0';
  job_id: string;
  kind: 'specs_extract';
  stage: 'prepare_document' | 'extract_specs' | 'apply_specs';
  input_hash: string;
  correlation_id: string;
}

export interface N8nDispatchConfig {
  url: string;
  secret: string;
  timeoutMs?: number;
}

export type DispatchFetch = (url: string, init: RequestInit) => Promise<Response>;

export function n8nDispatchConfigFromEnv(environment: Readonly<Record<string, string | undefined>> = process.env): N8nDispatchConfig {
  const config = { url: environment.N8N_DISPATCH_URL ?? '', secret: environment.N8N_DISPATCH_SECRET ?? '' };
  checkedConfiguration(config);
  return config;
}

function checkedConfiguration(config: N8nDispatchConfig): { url: string; secret: string; timeoutMs: number } {
  if (!config.url.trim() || !config.secret.trim()) {
    throw new IntegrationError('N8N_CONFIGURATION_REQUIRED', 'Configure N8N_DISPATCH_URL and N8N_DISPATCH_SECRET in server secret configuration.');
  }
  let destination: URL;
  try { destination = new URL(config.url); }
  catch { throw new IntegrationError('N8N_CONFIGURATION_INVALID', 'The configured n8n dispatch destination is invalid.'); }
  if (destination.protocol !== 'https:' || destination.username || destination.password
    || destination.search || destination.hash || destination.pathname.includes('/webhook-test/')
    || config.secret.trim().length < 32 || /[\r\n]/.test(config.secret)) {
    throw new IntegrationError('N8N_CONFIGURATION_INVALID', 'Use an HTTPS production webhook and a server-managed dispatch secret of at least 32 characters.');
  }
  const timeoutMs = config.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new IntegrationError('N8N_CONFIGURATION_INVALID', 'The configured n8n dispatch timeout is invalid.');
  }
  return { url: destination.href, secret: config.secret.trim(), timeoutMs };
}

export function validateStageReadyEnvelope(value: StageReadyEnvelope): void {
  const expectedKeys = ['event_id', 'event_type', 'contract_version', 'job_id', 'kind', 'stage', 'input_hash', 'correlation_id'];
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== expectedKeys.length || Object.keys(value).some((key) => !expectedKeys.includes(key))
    || !safeIdentifier(value.event_id) || !safeIdentifier(value.job_id) || !safeIdentifier(value.correlation_id)
    || value.event_type !== 'job.stage_ready' || value.contract_version !== '1.0' || value.kind !== 'specs_extract'
    || !['prepare_document', 'extract_specs', 'apply_specs'].includes(value.stage)
    || typeof value.input_hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.input_hash)) {
    throw new IntegrationError('DISPATCH_ENVELOPE_INVALID', 'The outbox dispatch envelope is invalid.');
  }
}

/**
 * One delivery attempt. Durable outbox owns lease, retry and completion decisions.
 * Webhook must use Header Auth with Authorization: Bearer <configured server secret>.
 * Source: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook
 */
export class N8nDispatcher {
  readonly #config: { url: string; secret: string; timeoutMs: number };
  readonly #fetch: DispatchFetch;

  constructor(config: N8nDispatchConfig, fetchTransport: DispatchFetch = fetch) {
    this.#config = checkedConfiguration(config);
    this.#fetch = fetchTransport;
  }

  async dispatch(envelope: StageReadyEnvelope, signal?: AbortSignal): Promise<{
    accepted: true; event_id: string; http_status: number;
  }> {
    validateStageReadyEnvelope(envelope);
    if (signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'Dispatch was cancelled.');
    const deadline = AbortSignal.timeout(this.#config.timeoutMs);
    let response: Response;
    try {
      response = await this.#fetch(this.#config.url, {
        method: 'POST', redirect: 'error', signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
        headers: {
          Authorization: `Bearer ${this.#config.secret}`, 'Content-Type': 'application/json',
          'Idempotency-Key': envelope.event_id, 'X-Request-ID': envelope.correlation_id,
        },
        body: JSON.stringify(envelope),
      });
    } catch {
      if (signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'Dispatch was cancelled.');
      if (deadline.aborted) throw new IntegrationError('N8N_DISPATCH_TIMEOUT', 'n8n dispatch timed out; the outbox can retry.', true);
      throw new IntegrationError('N8N_DISPATCH_UNAVAILABLE', 'n8n dispatch is temporarily unavailable.', true);
    }
    if (signal?.aborted || deadline.aborted) {
      await response.body?.cancel().catch(() => undefined);
      if (signal?.aborted) throw new IntegrationError('PROCESSING_CANCELLED', 'Dispatch was cancelled.');
      throw new IntegrationError('N8N_DISPATCH_TIMEOUT', 'n8n dispatch timed out; the outbox can retry.', true);
    }
    // Do not parse or log an arbitrary response body; HTTP acceptance is not stage success.
    if (!response.ok) {
      const status = response.status;
      const details = { http_status: status, retry_after_ms: retryAfterMs(response.headers.get('retry-after')) };
      await response.body?.cancel().catch(() => undefined);
      if (status === 401 || status === 403) {
        throw new IntegrationError('N8N_DISPATCH_ACCESS_DENIED', 'n8n webhook authentication needs attention.', false, details);
      }
      const retryable = [408, 425, 429].includes(status) || status >= 500;
      throw new IntegrationError(retryable ? 'N8N_DISPATCH_RETRYABLE' : 'N8N_DISPATCH_REJECTED',
        retryable ? 'n8n could not accept this delivery; the outbox can retry.' : 'n8n rejected this dispatch; inspect webhook configuration.',
        retryable, details);
    }
    await response.body?.cancel().catch(() => undefined);
    return { accepted: true, event_id: envelope.event_id, http_status: response.status };
  }
}
