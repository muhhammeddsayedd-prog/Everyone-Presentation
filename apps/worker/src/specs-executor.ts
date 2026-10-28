import { createHash, randomUUID } from 'node:crypto';
import { extractSpecs, integrationErrorToJobFailure, type OpenAISpecsConfig } from '@eps/integrations';
import { SPECS_PROMPT_VERSION } from '../../../packages/integrations/src/prompts/specs-v1.ts';
import type { JobEvent, JobEventReceipt, JsonObject, StageLease } from '@eps/jobs';
import { prepareDocumentIsolated } from './process.ts';
import { preparePastedText } from './pasted-text.ts';
import { DocumentPreparationError, type SourceParagraph } from './types.ts';

export const DOCUMENT_PREPARATION_VERSION = 'document-preparation.v1';
export interface SpecsStageGateway {
  /** Trusted transport authenticates the service independently of this JSON scope. */
  getInput(scope: { job_id: string; attempt_id: string; lease_token: string }, signal: AbortSignal): Promise<unknown>;
  recordEvent(event: JobEvent, signal: AbortSignal): Promise<JobEventReceipt>;
}
export interface SpecsExecutionOptions {
  openAI?: OpenAISpecsConfig;
  signal?: AbortSignal;
  heartbeatMs?: number;
  gatewayTimeoutMs?: number;
  /** Deterministic adapter injection only; normal runtime uses the real SDK. */
  extract?: typeof extractSpecs;
}
export class SpecsExecutionError extends Error {
  constructor(readonly code: 'INVALID_STAGE_SCOPE' | 'STAGE_INPUT_INVALID' | 'CALLBACK_UNCONFIRMED' | 'LEASE_STALE' | 'PROCESSING_CANCELLED') {
    super('This processing attempt could not be confirmed. Durable job state determines recovery.');
    this.name = 'SpecsExecutionError';
  }
}
function fail(code: SpecsExecutionError['code']): never { throw new SpecsExecutionError(code); }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/u.test(value);
const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const statuses = ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'];
const common = ['job_id', 'attempt_id', 'stage', 'input_hash', 'correlation_id', 'configuration'];
type Configuration = { document_preparation_version: string; model_version: string; prompt_version: string; result_schema_version: string };
interface InputBase { correlation_id: string; configuration: Configuration }
type StageInput = InputBase & ({ stage: 'prepare_document'; source_text: string; source_sha256: string }
  | { stage: 'extract_specs'; text: string; paragraphs: SourceParagraph[]; source_sha256: string }
  | { stage: 'apply_specs'; specs_id: string; workspace_id: string });

function parseInput(value: unknown, lease: StageLease): StageInput {
  if (!object(value)) fail('STAGE_INPUT_INVALID');
  const configuration = value.configuration; const frozenConfiguration = lease.input.configuration;
  const configurationFields = ['document_preparation_version', 'model_version', 'prompt_version', 'result_schema_version'];
  if (!object(configuration) || !object(frozenConfiguration) || !exact(configuration, configurationFields)
    || !exact(frozenConfiguration, configurationFields)) fail('STAGE_INPUT_INVALID');
  if (value.job_id !== lease.job_id || value.attempt_id !== lease.attempt_id || value.stage !== lease.stage
    || value.input_hash !== lease.input.input_hash || !id(value.correlation_id)
    || Object.values(configuration).some(item => typeof item !== 'string' || !item.trim() || item.length > 200)
    || configurationFields.some(key => configuration[key] !== frozenConfiguration[key])) fail('STAGE_INPUT_INVALID');
  const base = { correlation_id: value.correlation_id, configuration: configuration as unknown as Configuration };
  if (value.stage === 'apply_specs') {
    if (!exact(value, [...common, 'specs_id', 'workspace_id', 'source_sha256']) || !id(value.specs_id) || !id(value.workspace_id)
      || value.source_sha256 !== lease.input.source_hash
      || value.specs_id !== lease.input.specs_id) fail('STAGE_INPUT_INVALID');
    return { ...base, stage: 'apply_specs', specs_id: value.specs_id, workspace_id: value.workspace_id };
  }
  const sourceFields = ['source_kind', 'source_asset_id', 'source_sha256'];
  if (value.source_kind !== 'pasted_text' || value.source_asset_id !== null || !digest(value.source_sha256)
    || value.source_sha256 !== lease.input.source_hash) fail('STAGE_INPUT_INVALID');
  if (value.stage === 'prepare_document') {
    if (!exact(value, [...common, ...sourceFields, 'source_text']) || typeof value.source_text !== 'string'
      || hash(value.source_text) !== value.source_sha256) fail('STAGE_INPUT_INVALID');
    return { ...base, stage: 'prepare_document', source_text: value.source_text, source_sha256: value.source_sha256 };
  }
  if (value.stage !== 'extract_specs' || !exact(value, [...common, ...sourceFields, 'text', 'paragraphs'])
    || typeof value.text !== 'string' || !Array.isArray(value.paragraphs)) fail('STAGE_INPUT_INVALID');
  // Reconstruct the worker's LF/UTF16 paragraph mapping; reject injected text,
  // offsets, extra fields and reordered evidence before any provider request.
  const prepared = preparePastedText(value.text);
  if (prepared.text !== value.text || prepared.paragraphs.length !== value.paragraphs.length
    || prepared.paragraphs.some((paragraph, index) => {
      const supplied = (value.paragraphs as unknown[])[index];
      return !object(supplied) || !exact(supplied, ['index', 'page', 'start', 'end', 'text'])
        || Object.entries(paragraph).some(([key, item]) => supplied[key] !== item);
    })) fail('STAGE_INPUT_INVALID');
  return { ...base, stage: 'extract_specs', text: value.text, paragraphs: prepared.paragraphs, source_sha256: value.source_sha256 };
}

/** Execute ONE already-claimed attempt. No scheduler, HTTP service, SQL, secret
 * loader, queue or permission fallback lives here. Heartbeats and completion
 * serialize; an unknown callback aborts work and leaves recovery to durable
 * leases. It never repeats a model request or emits a second terminal event. */
export async function executeSpecsStage(lease: StageLease, gateway: SpecsStageGateway, options: SpecsExecutionOptions = {}) {
  try { lease = structuredClone(lease); } catch { fail('INVALID_STAGE_SCOPE'); }
  const openAI = options.openAI ? { ...options.openAI } : undefined;
  const extract = options.extract ?? extractSpecs;
  const externalSignal = options.signal;
  if (!lease || !id(lease.job_id) || !['prepare_document', 'extract_specs', 'apply_specs'].includes(lease.stage)
    || typeof lease.already_completed !== 'boolean') fail('INVALID_STAGE_SCOPE');
  if (lease.already_completed) return { already_completed: true as const, receipt: null };
  if (!id(lease.attempt_id) || typeof lease.lease_token !== 'string' || lease.lease_token.length < 1 || lease.lease_token.length > 1024
    || /[\s\p{C}]/u.test(lease.lease_token)
    || !Number.isFinite(Date.parse(lease.lease_expires_at)) || Date.parse(lease.lease_expires_at) <= Date.now()
    || !object(lease.input) || !digest(lease.input.input_hash) || !digest(lease.input.source_hash)) fail('INVALID_STAGE_SCOPE');
  const heartbeatMs = options.heartbeatMs ?? 20_000;
  const gatewayTimeoutMs = options.gatewayTimeoutMs ?? 15_000;
  if (!Number.isSafeInteger(heartbeatMs) || heartbeatMs < 10 || heartbeatMs > 20_000
    || !Number.isSafeInteger(gatewayTimeoutMs) || gatewayTimeoutMs < 10 || gatewayTimeoutMs > 15_000) fail('INVALID_STAGE_SCOPE');
  const controller = new AbortController();
  const signal = externalSignal ? AbortSignal.any([externalSignal, controller.signal]) : controller.signal;
  if (signal.aborted) fail('PROCESSING_CANCELLED');
  async function gatewayCall<T>(call: (requestSignal: AbortSignal) => Promise<T>, code: 'STAGE_INPUT_INVALID' | 'CALLBACK_UNCONFIRMED'): Promise<T> {
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(gatewayTimeoutMs)]);
    let abort!: () => void;
    const interrupted = new Promise<never>((_resolve, reject) => {
      abort = () => reject(new SpecsExecutionError(externalSignal?.aborted ? 'PROCESSING_CANCELLED' : code));
      requestSignal.addEventListener('abort', abort, { once: true });
      if (requestSignal.aborted) abort();
    });
    try {
      return await Promise.race([interrupted, Promise.resolve().then(() => {
        if (requestSignal.aborted) return interrupted;
        return call(requestSignal);
      }).catch(() => fail(externalSignal?.aborted ? 'PROCESSING_CANCELLED' : code))]);
    } finally { requestSignal.removeEventListener('abort', abort); }
  }
  let input: StageInput;
  try { input = parseInput(await gatewayCall(requestSignal => gateway.getInput(
    { job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token }, requestSignal), 'STAGE_INPUT_INVALID'), lease); }
  catch (error) { if (error instanceof SpecsExecutionError) throw error; return fail('STAGE_INPUT_INVALID'); }
  if (signal.aborted) fail('PROCESSING_CANCELLED');
  if (Date.parse(lease.lease_expires_at) <= Date.now()) fail('LEASE_STALE');
  if (input.configuration.document_preparation_version !== DOCUMENT_PREPARATION_VERSION
    || input.configuration.prompt_version !== SPECS_PROMPT_VERSION || input.configuration.result_schema_version !== '1.0') fail('STAGE_INPUT_INVALID');
  let sequence = 0; let timer: ReturnType<typeof setTimeout> | undefined; let stopped = false;
  let heartbeat: Promise<void> = Promise.resolve(); let heartbeatError: SpecsExecutionError | null = null;
  async function publish(fields: Pick<JobEvent, 'event_type'> & Partial<Pick<JobEvent, 'result_schema' | 'result' | 'error'>>) {
    const event: JobEvent = { event_id: randomUUID(), job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token,
      stage: lease.stage, input_hash: lease.input.input_hash as string, sequence: ++sequence, ...fields };
    const receipt = await gatewayCall(requestSignal => gateway.recordEvent(event, requestSignal), 'CALLBACK_UNCONFIRMED');
    if (!object(receipt) || !exact(receipt, ['event_id', 'applied', 'duplicate', 'stale', 'job_status']) || receipt.event_id !== event.event_id
      || !['applied', 'duplicate', 'stale'].every(key => typeof receipt[key as keyof JobEventReceipt] === 'boolean')
      || !statuses.includes(receipt.job_status) || !receipt.applied && !receipt.duplicate && !receipt.stale) fail('CALLBACK_UNCONFIRMED');
    if (receipt.stale) fail('LEASE_STALE');
    return receipt;
  }
  function scheduleHeartbeat() {
    if (stopped) return;
    timer = setTimeout(() => {
      heartbeat = publish({ event_type: 'heartbeat' }).then(() => { scheduleHeartbeat(); }).catch(error => {
        heartbeatError = error instanceof SpecsExecutionError ? error : new SpecsExecutionError('CALLBACK_UNCONFIRMED');
        controller.abort();
      });
    }, heartbeatMs);
  }
  async function stopHeartbeats() { stopped = true; clearTimeout(timer); await heartbeat; if (heartbeatError) throw heartbeatError; }
  scheduleHeartbeat();
  let result: JsonObject; let schema: string;
  try {
    if (input.stage === 'prepare_document') {
      const prepared = await prepareDocumentIsolated({ sourceKind: 'pasted_text', sourceAssetId: null, text: input.source_text }, { signal });
      if (prepared.sourceSha256 !== input.source_sha256) fail('STAGE_INPUT_INVALID');
      result = { source_asset_id: null, text_asset_id: null, page_assets: [], paragraph_count: prepared.paragraphs.length,
        extraction_method: prepared.extractionMethod, warnings: prepared.warnings };
      schema = 'document-preparation.v1';
    } else if (input.stage === 'extract_specs') {
      if (!openAI || openAI.model !== input.configuration.model_version) fail('STAGE_INPUT_INVALID');
      const output = await extract({ sourceAssetId: null,
        paragraphs: input.paragraphs.map(({ index, page, text }) => ({ index, page, text })), correlationId: input.correlation_id,
        inputHash: lease.input.input_hash as string }, openAI, undefined, signal);
      result = output as unknown as JsonObject; schema = 'specs-extraction-stage.v1';
    } else {
      result = { specs_id: input.specs_id, workspace_id: input.workspace_id }; schema = 'specs-application.v1';
    }
  } catch (error) {
    await stopHeartbeats();
    if (signal.aborted) fail('PROCESSING_CANCELLED');
    if (error instanceof SpecsExecutionError) throw error;
    const failure = error instanceof DocumentPreparationError
      ? { code: error.retryable ? 'DEPENDENCY_UNAVAILABLE' : 'SOURCE_UNREADABLE', message: 'Document preparation could not complete. The source was retained.', details: {}, retryable: error.retryable }
      : integrationErrorToJobFailure(error);
    return { already_completed: false as const, receipt: await publish({ event_type: 'failed', error: failure }) };
  }
  await stopHeartbeats();
  if (signal.aborted) fail('PROCESSING_CANCELLED');
  return { already_completed: false as const, receipt: await publish({ event_type: 'succeeded', result_schema: schema, result }) };
}
