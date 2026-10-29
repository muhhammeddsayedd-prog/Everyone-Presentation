import { validateStageReadyEnvelope, type StageReadyEnvelope, type N8nDispatchConfig } from '@eps/integrations';
import type { SpecsStageRouter, StageWorkOrder } from './runtime-types.ts';

const handlers = { prepare_document: 'native.prepare_document', extract_specs: 'openai.extract_specs', apply_specs: 'domain.apply_specs',
  prepare_candidate: 'native.prepare_candidate', transcribe_candidate: 'openai.transcribe_candidate', extract_candidate: 'openai.extract_candidate', select_frames: 'openai.select_frames', apply_candidate: 'domain.apply_candidate', extract_frames: 'native.extract_frames', apply_frames: 'domain.apply_frames' } as const;
const fields = ['schema_version', 'event_id', 'job_id', 'kind', 'stage', 'input_hash', 'correlation_id', 'workflow_execution_id', 'handler'];
export class SpecsOrchestrationError extends Error {
  constructor(readonly code: 'N8N_RUNTIME_CONFIGURATION_REQUIRED' | 'N8N_WORK_ORDER_INVALID' | 'N8N_ORCHESTRATION_UNCONFIRMED') {
    super('The configured specs orchestration operation could not be confirmed.'); this.name = 'SpecsOrchestrationError';
  }
}
function fail(code: SpecsOrchestrationError['code']): never { throw new SpecsOrchestrationError(code); }
export function validateSpecsWorkOrder(value: unknown, scope: StageReadyEnvelope): StageWorkOrder {
  validateStageReadyEnvelope(scope);
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('N8N_WORK_ORDER_INVALID');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== fields.length || fields.some(field => !Object.hasOwn(row, field))
    || row.schema_version !== '1.0' || row.kind !== scope.kind || row.event_id !== scope.event_id || row.job_id !== scope.job_id
    || row.stage !== scope.stage || row.input_hash !== scope.input_hash || row.correlation_id !== scope.correlation_id
    || row.handler !== handlers[scope.stage] || typeof row.workflow_execution_id !== 'string'
    || !/^[A-Za-z0-9._:-]{1,200}$/u.test(row.workflow_execution_id)) fail('N8N_WORK_ORDER_INVALID');
  return structuredClone(row) as unknown as StageWorkOrder;
}
/** Outbound metadata only. No source, provider payload, lease or DB credential
 * is sent to n8n. The real workflow must return a bound work order, not 2xx alone.
 * https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook */
export class N8nSpecsOrchestrator implements SpecsStageRouter {
  readonly #url: string; readonly #secret: string; readonly #timeout: number;
  constructor(config: N8nDispatchConfig, readonly fetchTransport: typeof fetch = fetch) {
    let url: URL;
    try { url = new URL(config.url); } catch { fail('N8N_RUNTIME_CONFIGURATION_REQUIRED'); }
    const timeout = config.timeoutMs ?? 10_000;
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname.includes('/webhook-test/')
      || typeof config.secret !== 'string' || config.secret.trim().length < 32 || /[\r\n\0]/u.test(config.secret)
      || !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30_000) fail('N8N_RUNTIME_CONFIGURATION_REQUIRED');
    this.#url = url.href; this.#secret = config.secret.trim(); this.#timeout = timeout;
  }
  async route(envelope: StageReadyEnvelope, signal?: AbortSignal): Promise<StageWorkOrder> {
    const scope = structuredClone(envelope); validateStageReadyEnvelope(scope);
    const controller = new AbortController();
    let expired = false; const abort = () => { expired = true; controller.abort(); };
    if (signal?.aborted) fail('N8N_ORCHESTRATION_UNCONFIRMED');
    signal?.addEventListener('abort', abort, { once: true });
    let rejectDeadline: (() => void) | undefined;
    const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = () => reject(new SpecsOrchestrationError('N8N_ORCHESTRATION_UNCONFIRMED')); });
    const timer = setTimeout(() => { abort(); rejectDeadline?.(); }, this.#timeout);
    const callerAbort = () => rejectDeadline?.(); signal?.addEventListener('abort', callerAbort, { once: true });
    const operation = async () => {
      let response: Response | undefined;
      try {
        response = await this.fetchTransport(this.#url, { method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${this.#secret}`, 'Content-Type': 'application/json', Accept: 'application/json',
            'Idempotency-Key': scope.event_id, 'X-Request-ID': scope.correlation_id }, body: JSON.stringify(scope) });
        if (expired || response.status !== 200 || !/^application\/json(?:\s*;|$)/iu.test(response.headers.get('content-type') ?? '')) fail('N8N_ORCHESTRATION_UNCONFIRMED');
        const reader = response.body?.getReader(); if (!reader) fail('N8N_WORK_ORDER_INVALID');
        const parts: Uint8Array[] = []; let size = 0;
        try { for (;;) { const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength; if (expired || size > 16_384) fail('N8N_WORK_ORDER_INVALID'); parts.push(part.value);
        } } finally { reader.releaseLock(); }
        if (expired) fail('N8N_ORCHESTRATION_UNCONFIRMED');
        const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; }
        let value: unknown; try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('N8N_WORK_ORDER_INVALID'); }
        return validateSpecsWorkOrder(value, scope);
      } catch (error) { if (error instanceof SpecsOrchestrationError) throw error; fail('N8N_ORCHESTRATION_UNCONFIRMED'); }
      finally { await response?.body?.cancel().catch(() => undefined); }
    };
    try { return await Promise.race([operation(), deadline]); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); signal?.removeEventListener('abort', callerAbort); }
  }
}
