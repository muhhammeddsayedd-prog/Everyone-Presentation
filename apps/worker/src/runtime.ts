import { validateStageReadyEnvelope, type OpenAISpecsConfig, type StageReadyEnvelope } from '@eps/integrations';
import { specsRuntimeFailureDiagnostics } from '@eps/central/specs-runtime';
import { executeSpecsStage, type SpecsExecutionOptions } from './specs-executor.ts';
import { executeCandidateStage, type CandidateStageOptions } from './candidate-stage-executor.ts';
import { executeFrameStage, type FrameStageOptions } from './frame-stage-executor.ts';
import { executeReviewStage, type ReviewStageOptions } from './review-stage-executor.ts';
import { executeReviewFitStage, type ReviewFitStageOptions } from './review-fit-stage-executor.ts';
import { executePresentationStage, type PresentationStageOptions } from './presentation-stage-executor.ts';
import { executePresentationExportStage, type PresentationExportOptions } from './presentation-export-executor.ts';
import { validateSpecsWorkOrder } from './n8n-orchestrator.ts';
import type { SpecsStageRouter, StageRuntimeGateway, WorkerNotice } from './runtime-types.ts';

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(value);
const exact = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const codes = new Set(['JOB_ALREADY_RUNNING', 'JOB_NOT_AVAILABLE', 'INPUT_CHANGED', 'INPUT_HASH_MISMATCH', 'CAPABILITY_REQUIRED',
  'RESOURCE_NOT_FOUND', 'RETRY_EXHAUSTED', 'STAGE_OUT_OF_ORDER', 'LEASE_STALE', 'CALLBACK_UNCONFIRMED', 'PROCESSING_CANCELLED',
  'N8N_RUNTIME_CONFIGURATION_REQUIRED', 'N8N_WORK_ORDER_INVALID', 'N8N_ORCHESTRATION_UNCONFIRMED',
  'RUNTIME_CONFIG_INVALID', 'RUNTIME_AUTH_UNVERIFIED', 'RUNTIME_ROLE_UNVERIFIED', 'RUNTIME_UNAVAILABLE',
  'RUNTIME_RESPONSE_INVALID', 'RUNTIME_ABORTED', 'RUNTIME_CLOSED', 'DEPENDENCY_UNAVAILABLE', 'SNAPSHOT_INVALID', 'PERMISSION_CHANGED']);
function safeCode(error: unknown): string {
  try { const code = object(error) ? error.code : undefined; return typeof code === 'string' && codes.has(code) ? code : 'WORKER_OPERATION_UNCONFIRMED'; }
  catch { return 'WORKER_OPERATION_UNCONFIRMED'; }
}
const unknown = (error: unknown) => !object(error) || error.outcome !== 'known';
function invalid(): never { throw new Error('WORKER_CONTRACT_INVALID'); }
interface RuntimeOptions { openAI: OpenAISpecsConfig; signal?: AbortSignal; execute?: typeof executeSpecsStage; gatewayTimeoutMs?: number; files?: SpecsExecutionOptions['files']; vision?: SpecsExecutionOptions['vision']; onSpecsDiagnostic?: SpecsExecutionOptions['onDiagnostic']; candidate?: Omit<CandidateStageOptions, 'signal'>; executeCandidate?: typeof executeCandidateStage; frames?: Omit<FrameStageOptions, 'signal'>; executeFrames?: typeof executeFrameStage; review?: Omit<ReviewStageOptions, 'signal'>; executeReview?: typeof executeReviewStage; fit?: Omit<ReviewFitStageOptions, 'signal'>; executeFit?: typeof executeReviewFitStage; presentation?: Omit<PresentationStageOptions, 'signal'>; executePresentation?: typeof executePresentationStage; presentationExport?: Omit<PresentationExportOptions,'signal'>; executePresentationExport?: typeof executePresentationExportStage }
/** Public storage configuration is opt-in, fixed-target and separate from the
 * protected five-field database/webhook configuration. No ambient JWT fallback. */
export function specsWorkerFilesConfiguration(environment: Record<string, string | undefined>): { storageOrigin: string; publishableKey: string } | undefined {
  const enabled = environment.EPS_SPECS_FILES_ENABLED;
  if (enabled === undefined || enabled === 'false') return undefined;
  if (enabled !== 'true' || environment.SUPABASE_URL !== 'https://pyibofyctwnqpvktepse.supabase.co'
    || typeof environment.SUPABASE_PUBLISHABLE_KEY !== 'string' || environment.SUPABASE_PUBLISHABLE_KEY.length > 4096
    || !/^sb_publishable_[A-Za-z0-9_-]{8,}$/u.test(environment.SUPABASE_PUBLISHABLE_KEY)) invalid();
  return { storageOrigin: environment.SUPABASE_URL, publishableKey: environment.SUPABASE_PUBLISHABLE_KEY };
}
async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, options: RuntimeOptions): Promise<T> {
  const timeout = options.gatewayTimeoutMs ?? 15_000;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30_000) invalid();
  const controller = new AbortController(); let rejectWait: (() => void) | undefined;
  const abort = () => { controller.abort(); rejectWait?.(); };
  const interrupted = new Promise<never>((_resolve, reject) => { rejectWait = () => reject(new Error('WORKER_GATEWAY_UNCONFIRMED')); });
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort, { once: true }); const timer = setTimeout(abort, timeout);
  try { return await Promise.race([options.signal?.aborted ? interrupted : operation(controller.signal), interrupted]); }
  finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}
export async function processNextSpecsStage(gateway: StageRuntimeGateway, router: SpecsStageRouter, options: RuntimeOptions): Promise<WorkerNotice> {
  const files = options.files ? { ...options.files } : undefined;
  let event: { id: string; lease_token: string; envelope: StageReadyEnvelope } | undefined;
  let claimAttempted = false; let finishAttempted = false; let acknowledged = false;
  try {
    if (options.signal?.aborted) return { event: 'idle' };
    const batch = await bounded(signal => gateway.claimOutbox(1, signal), options);
    if (!object(batch) || !exact(batch, ['leases']) || !Array.isArray(batch.leases) || batch.leases.length > 1) invalid();
    if (batch.leases.length === 0) return { event: 'idle' };
    const row = batch.leases[0];
    if (!object(row) || !exact(row, ['id', 'lease_token', 'lease_expires_at', 'envelope']) || !uuid(row.id)
      || typeof row.lease_token !== 'string' || !/^[^\s\p{C}]{1,1024}$/u.test(row.lease_token)
      || typeof row.lease_expires_at !== 'string' || Date.parse(row.lease_expires_at) <= Date.now()
      || !Number.isFinite(Date.parse(row.lease_expires_at)) || !object(row.envelope)) invalid();
    const envelope = structuredClone(row.envelope) as unknown as StageReadyEnvelope; validateStageReadyEnvelope(envelope);
    if (envelope.event_id !== row.id) invalid();
    event = { id: row.id, lease_token: row.lease_token, envelope };
    const order = validateSpecsWorkOrder(await router.route(envelope, options.signal), envelope);
    if (order.kind === 'candidate_scan' && !options.candidate) invalid();
    if (order.kind === 'frame_extract' && !options.frames) invalid();
    if (order.kind === 'ai_suggestion' && !options.review || order.kind === 'review_fit' && !options.fit) invalid();
    if (order.kind === 'presentation_render' && !options.presentation) invalid();
    if (order.kind === 'presentation_export' && (!options.presentationExport || !gateway.mintReviewMediaGrant)) invalid();
    if (options.signal?.aborted) return { event: 'dispatch_unconfirmed', job_id: envelope.job_id, stage: envelope.stage };
    claimAttempted = true;
    const lease = await bounded(signal => gateway.claim({ job_id: order.job_id, stage: order.stage, input_hash: order.input_hash,
      workflow_execution_id: order.workflow_execution_id }, signal), options);
    if (lease.job_id !== order.job_id || lease.stage !== order.stage || lease.input?.input_hash !== order.input_hash
      || typeof lease.already_completed !== 'boolean') invalid();
    finishAttempted = true;
    const dispatch = event;
    const ack = await bounded(signal => gateway.finishOutbox(dispatch.id, dispatch.lease_token, true, signal), options);
    if (!object(ack) || !exact(ack, ['acknowledged', 'stale']) || ack.acknowledged !== true || ack.stale !== false) {
      return { event: 'dispatch_unconfirmed', job_id: order.job_id, stage: order.stage };
    }
    acknowledged = true;
    if (!lease.already_completed) {
      const execution = order.kind === 'presentation_export'
        ? await (options.executePresentationExport ?? executePresentationExportStage)(lease, gateway, { ...options.presentationExport!, signal: options.signal })
        : order.kind === 'presentation_render'
        ? await (options.executePresentation ?? executePresentationStage)(lease, gateway, { ...options.presentation!, signal: options.signal })
        : order.kind === 'review_fit'
        ? await (options.executeFit ?? executeReviewFitStage)(lease, gateway, { ...options.fit!, signal: options.signal })
        : order.kind === 'ai_suggestion'
        ? await (options.executeReview ?? executeReviewStage)(lease, gateway, { ...options.review!, signal: options.signal })
        : order.kind === 'frame_extract'
        ? await (options.executeFrames ?? executeFrameStage)(lease, gateway, { ...options.frames!, signal: options.signal })
        : order.kind === 'candidate_scan'
        ? await (options.executeCandidate ?? executeCandidateStage)(lease, gateway, { ...options.candidate!, signal: options.signal })
        : await (options.execute ?? executeSpecsStage)(lease, gateway, { openAI: options.openAI, signal: options.signal, files, vision: options.vision, onDiagnostic: options.onSpecsDiagnostic });
      if (!execution.already_completed && (!execution.receipt || !execution.receipt.applied && !execution.receipt.duplicate || execution.receipt.stale)) invalid();
    }
    return { event: 'stage_callback_committed', job_id: order.job_id, stage: order.stage };
  } catch (error) {
    const scope = event ? { job_id: event.envelope.job_id, stage: event.envelope.stage } : {};
    if (acknowledged) return { event: 'stage_unconfirmed', ...scope, code: safeCode(error), ...specsRuntimeFailureDiagnostics(error) };
    if (!event || finishAttempted || options.signal?.aborted || claimAttempted && unknown(error)) {
      return { event: 'dispatch_unconfirmed', ...scope, code: safeCode(error), ...specsRuntimeFailureDiagnostics(error) };
    }
    try {
      // Another worker's live lease is already durable. A duplicate dispatch may
      // be acknowledged; neither this process nor n8n repeats the provider call.
      const busy = object(error) && error.code === 'JOB_ALREADY_RUNNING';
      const dispatch = event;
      await bounded(signal => gateway.finishOutbox(dispatch.id, dispatch.lease_token, busy, signal), options);
    } catch { return { event: 'dispatch_unconfirmed', ...scope, code: 'WORKER_OPERATION_UNCONFIRMED' }; }
    return { event: 'dispatch_rejected', ...scope, code: safeCode(error), ...specsRuntimeFailureDiagnostics(error) };
  }
}
export interface SpecsWorkerOptions extends RuntimeOptions {
  pollMs?: number; recoverMs?: number; notice?: (event: WorkerNotice) => void;
  /** Offline scheduler seam only, not an arbitrary runtime command. */
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  clock?: () => number;
}
function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise(resolve => { if (signal?.aborted) return resolve();
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, milliseconds); signal?.addEventListener('abort', finish, { once: true });
  });
}
/** One bounded serial worker. Durable SQL owns retry delays, attempts and stage
 * order. No provider retry, user impersonation, test transport or HTTP listener. */
export async function runSpecsWorker(gateway: StageRuntimeGateway, router: SpecsStageRouter, options: SpecsWorkerOptions): Promise<void> {
  const poll = options.pollMs ?? 3000; const recovery = options.recoverMs ?? 30_000;
  if (!Number.isSafeInteger(poll) || poll < 100 || poll > 60_000 || !Number.isSafeInteger(recovery) || recovery < 1000 || recovery > 300_000
    || !options.openAI.apiKey.trim() || !options.openAI.model.trim()) invalid();
  const clock = options.clock ?? Date.now; let recoverAt = 0;
  const notify = (value: WorkerNotice) => { try { options.notice?.(value); } catch { /* Operator sink cannot change durable work. */ } };
  try { while (!options.signal?.aborted) {
    if (clock() >= recoverAt) {
      try { const value = await bounded(signal => gateway.recover(25, signal), options);
        if (!object(value) || !Number.isSafeInteger(value.recovered) || (value.recovered as number) < 0) invalid();
        notify({ event: 'recovery_completed' });
      } catch (error) { notify({ event: 'recovery_unconfirmed', code: safeCode(error), ...specsRuntimeFailureDiagnostics(error) }); }
      recoverAt = clock() + recovery;
    }
    const result = await processNextSpecsStage(gateway, router, options); if (result.event !== 'idle') notify(result);
    if (result.event !== 'stage_callback_committed') await (options.sleep ?? delay)(poll, options.signal);
  } } finally { await gateway.close?.(); }
}
