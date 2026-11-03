import { createHash, randomUUID } from 'node:crypto';
import { extractSpecs, IntegrationError, integrationErrorToJobFailure, type OpenAIMediaConfig, type OpenAISpecsConfig } from '@eps/integrations';
import { SPECS_PROMPT_VERSION } from '../../../packages/integrations/src/prompts/specs-v1.ts';
import type { JobEvent, JobEventReceipt, JsonObject, StageLease } from '@eps/jobs';
import { prepareDocumentIsolated } from './process.ts';
import { preparePastedText } from './pasted-text.ts';
import { DocumentPreparationError, type SourceParagraph } from './types.ts';
import { prepareSpecsFileStage, type SpecsAssetPort, type SpecsSourceMime } from './specs-assets.ts';
import type { PdfOCRMetadata } from '../../../packages/integrations/src/openai-pdf-ocr.ts';

export const DOCUMENT_PREPARATION_VERSION = 'document-preparation.v1';
export interface SpecsStageGateway {
  /** Trusted transport authenticates the service independently of this JSON scope. */
  getInput(scope: { job_id: string; attempt_id: string; lease_token: string }, signal: AbortSignal): Promise<unknown>;
  recordEvent(event: JobEvent, signal: AbortSignal): Promise<JobEventReceipt>;
}
/** Operator metadata only. Never pass the exception, provider body or source. */
export interface SpecsStageDiagnostic {
  job_id: string; attempt_id: string; stage: string; correlation_id: string;
  error_kind: 'integration' | 'unknown'; code: string; http_status: number | null; request_id: string | null;
}
export interface SpecsExecutionOptions {
  openAI?: OpenAISpecsConfig;
  signal?: AbortSignal;
  heartbeatMs?: number;
  gatewayTimeoutMs?: number;
  onDiagnostic?: (value: SpecsStageDiagnostic) => void;
  /** Deterministic adapter injection only; normal runtime uses the real SDK. */
  extract?: typeof extractSpecs;
  /** Optional real file capability port. Absence cannot fall back to pasted text. */
  files?: { port: SpecsAssetPort; publishableKey: string; fetch?: typeof fetch };
  vision?: { imageId: string; openAI: OpenAIMediaConfig; onMetadata?: (metadata: PdfOCRMetadata & { rasterizer_version: string; job_id: string; attempt_id: string; input_hash: string }) => void };
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
const diagnosticCodes = new Set(['SPECS_SOURCE_INVALID', 'SPECS_SOURCE_UNREADABLE', 'AI_REFUSAL', 'AI_RESULT_INVALID',
  'AI_EVIDENCE_INVALID', 'AI_EVIDENCE_MISSING', 'AI_SOURCE_MISMATCH', 'AI_ROLE_KEYS_INVALID', 'AI_RESPONSE_INVALID',
  'AI_RESPONSE_INCOMPLETE', 'AI_RESPONSE_NOT_COMPLETE', 'AI_OUTPUT_UNEXPECTED', 'OPENAI_KEY_REQUIRED',
  'OPENAI_EXTRACTION_MODEL_REQUIRED', 'OPENAI_CONFIGURATION_INVALID', 'OPENAI_TIMEOUT', 'OPENAI_ACCESS_DENIED',
  'OPENAI_QUOTA_EXCEEDED', 'OPENAI_RATE_LIMITED', 'OPENAI_REQUEST_REJECTED', 'OPENAI_UNAVAILABLE']);
export function projectSpecsStageFailure(error: unknown): Pick<SpecsStageDiagnostic, 'error_kind' | 'code' | 'http_status' | 'request_id'> {
  try {
    if (error instanceof IntegrationError) {
      const code = error.code;
      if (!diagnosticCodes.has(code)) return { error_kind: 'integration', code: 'INTEGRATION_FAILURE_UNCONFIRMED', http_status: null, request_id: null };
      const status = error.details.http_status; const request = error.details.request_id;
      return { error_kind: 'integration', code,
        http_status: typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
        request_id: typeof request === 'string' && /^req_[A-Za-z0-9_-]{1,128}$/u.test(request) ? request : null };
    }
  } catch { /* Hostile getters cannot defeat redaction or change durable work. */ }
  return { error_kind: 'unknown', code: 'SPECS_FAILURE_UNCONFIRMED', http_status: null, request_id: null };
}
type Configuration = { document_preparation_version: string; model_version: string; prompt_version: string; result_schema_version: string };
interface InputBase { correlation_id: string; configuration: Configuration }
type StageInput = InputBase & ({ stage: 'prepare_document'; source_kind: 'pasted_text'; source_text: string; source_sha256: string }
  | { stage: 'prepare_document'; source_kind: 'asset'; source_asset_id: string; source_sha256: string; mime_type: SpecsSourceMime; size_bytes: number }
  | { stage: 'extract_specs'; source_asset_id: string | null; text: string; paragraphs: SourceParagraph[]; source_sha256: string }
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
  const file = value.source_kind === 'asset';
  if ((!file && value.source_kind !== 'pasted_text') || !digest(value.source_sha256)
    || value.source_sha256 !== lease.input.source_hash) fail('STAGE_INPUT_INVALID');
  if (file ? typeof value.source_asset_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value.source_asset_id)
    || value.source_asset_id !== lease.input.source_asset_id || lease.input.schema_version !== '1.1'
    : value.source_asset_id !== null || lease.input.source_asset_id !== undefined && lease.input.source_asset_id !== null) fail('STAGE_INPUT_INVALID');
  if (value.stage === 'prepare_document') {
    if (file) {
      if (!exact(value, [...common, ...sourceFields, 'mime_type', 'size_bytes'])
        || !['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(String(value.mime_type))
        || typeof value.size_bytes !== 'number' || !Number.isSafeInteger(value.size_bytes) || value.size_bytes < 1 || value.size_bytes > 20 * 1024 * 1024) fail('STAGE_INPUT_INVALID');
      return { ...base, stage: 'prepare_document', source_kind: 'asset', source_asset_id: value.source_asset_id as string,
        source_sha256: value.source_sha256, mime_type: value.mime_type as SpecsSourceMime, size_bytes: value.size_bytes };
    }
    if (!exact(value, [...common, ...sourceFields, 'source_text']) || typeof value.source_text !== 'string'
      || hash(value.source_text) !== value.source_sha256) fail('STAGE_INPUT_INVALID');
    return { ...base, stage: 'prepare_document', source_kind: 'pasted_text', source_text: value.source_text, source_sha256: value.source_sha256 };
  }
  if (value.stage !== 'extract_specs' || !exact(value, [...common, ...sourceFields, 'text', 'paragraphs'])
    || typeof value.text !== 'string' || !Array.isArray(value.paragraphs)) fail('STAGE_INPUT_INVALID');
  // Reconstruct the worker's LF/UTF16 paragraph mapping; reject injected text,
  // offsets, extra fields and reordered evidence before any provider request.
  const prepared = preparePastedText(value.text);
  const paged = file && (value.paragraphs as unknown[]).some(paragraph => object(paragraph) && paragraph.page !== null);
  let previousPage = 0;
  if (prepared.text !== value.text || prepared.paragraphs.length !== value.paragraphs.length
    || prepared.paragraphs.some((paragraph, index) => {
      const supplied = (value.paragraphs as unknown[])[index];
      if (!object(supplied) || !exact(supplied, ['index', 'page', 'start', 'end', 'text'])
        || Object.entries(paragraph).some(([key, item]) => key !== 'page' && supplied[key] !== item)) return true;
      if (!paged) return supplied.page !== null;
      if (typeof supplied.page !== 'number' || !Number.isSafeInteger(supplied.page) || supplied.page < 1 || supplied.page > 200 || supplied.page < previousPage) return true;
      previousPage = supplied.page; return false;
    })) fail('STAGE_INPUT_INVALID');
  const paragraphs = prepared.paragraphs.map((paragraph, index) => ({ ...paragraph,
    page: paged ? (value.paragraphs as SourceParagraph[])[index].page : null }));
  return { ...base, stage: 'extract_specs', source_asset_id: file ? value.source_asset_id as string : null,
    text: value.text, paragraphs, source_sha256: value.source_sha256 };
}

/** Execute ONE already-claimed attempt. No scheduler, HTTP service, SQL, secret
 * loader, queue or permission fallback lives here. Heartbeats and completion
 * serialize; an unknown callback aborts work and leaves recovery to durable
 * leases. It never repeats a model request or emits a second terminal event. */
export async function executeSpecsStage(lease: StageLease, gateway: SpecsStageGateway, options: SpecsExecutionOptions = {}) {
  try { lease = structuredClone(lease); } catch { fail('INVALID_STAGE_SCOPE'); }
  const openAI = options.openAI ? { ...options.openAI } : undefined;
  const vision = options.vision ? { ...options.vision, openAI: { ...options.vision.openAI } } : undefined;
  const extract = options.extract ?? extractSpecs;
  const files = options.files ? { ...options.files } : undefined;
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
      if (input.source_kind === 'asset') {
        if (!files) fail('STAGE_INPUT_INVALID');
        result = await prepareSpecsFileStage({ source_asset_id: input.source_asset_id, source_sha256: input.source_sha256,
          mime_type: input.mime_type, size_bytes: input.size_bytes }, { job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token },
        files.port, { publishableKey: files.publishableKey, fetch: files.fetch, signal,
          ...(vision && vision.openAI.model === input.configuration.model_version ? { vision: { imageId: vision.imageId, openAI: vision.openAI,
            onMetadata: metadata => vision.onMetadata?.({ ...metadata, job_id: lease.job_id, attempt_id: lease.attempt_id, input_hash: lease.input.input_hash as string }) } } : {}) }) as unknown as JsonObject;
      } else {
        const prepared = await prepareDocumentIsolated({ sourceKind: 'pasted_text', sourceAssetId: null, text: input.source_text }, { signal });
        if (prepared.sourceSha256 !== input.source_sha256) fail('STAGE_INPUT_INVALID');
        result = { source_asset_id: null, text_asset_id: null, page_assets: [], paragraph_count: prepared.paragraphs.length,
          extraction_method: prepared.extractionMethod, warnings: prepared.warnings };
      }
      schema = 'document-preparation.v1';
    } else if (input.stage === 'extract_specs') {
      if (!openAI || openAI.model !== input.configuration.model_version) fail('STAGE_INPUT_INVALID');
      const output = await extract({ sourceAssetId: input.source_asset_id,
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
    try { options.onDiagnostic?.({ job_id: lease.job_id, attempt_id: lease.attempt_id, stage: lease.stage,
      correlation_id: input.correlation_id, ...projectSpecsStageFailure(error) }); }
    catch { /* An operator sink cannot change the durable outcome or repeat work. */ }
    const failure = error instanceof DocumentPreparationError
      ? { code: error.retryable ? 'DEPENDENCY_UNAVAILABLE' : 'SOURCE_UNREADABLE', message: 'Document preparation could not complete. The source was retained.', details: {}, retryable: error.retryable }
      : integrationErrorToJobFailure(error);
    return { already_completed: false as const, receipt: await publish({ event_type: 'failed', error: failure }) };
  }
  await stopHeartbeats();
  if (signal.aborted) fail('PROCESSING_CANCELLED');
  return { already_completed: false as const, receipt: await publish({ event_type: 'succeeded', result_schema: schema, result }) };
}
