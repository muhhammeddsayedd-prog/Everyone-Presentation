import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor, type MutationContext } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';

const STATUSES = ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'] as const;
const KINDS = ['specs_extract', 'candidate_scan', 'frame_extract', 'ai_suggestion', 'review_fit', 'presentation_render', 'presentation_export'] as const;
const SAFE_ERRORS: Record<string, string> = {
  SOURCE_UNREADABLE: 'The supplied source cannot be read.', UNSUPPORTED_FORMAT: 'The source format is unsupported.',
  RESULT_INVALID: 'The processing result failed validation.', EXTRACTION_REFUSED: 'Extraction could not complete for this input.',
  PROVIDER_RATE_LIMITED: 'The processing provider is temporarily rate limited.', DEPENDENCY_UNAVAILABLE: 'A processing dependency is unavailable.',
  LEASE_EXPIRED: 'The processing lease expired.', DISPATCH_UNAVAILABLE: 'The processing request could not be dispatched.',
  INPUT_CHANGED: 'The source or draft changed; existing edits were preserved.', PROCESSING_FAILED: 'Processing failed; existing data was preserved.',
  RETRY_EXHAUSTED: 'The bounded retry budget was exhausted.',
  PDF_TEMPLATE_MISMATCH: 'The captured presentation template or fonts are unavailable.',
  PDF_ASSET_INVALID: 'A captured presentation image failed verification.',
  PDF_OVERFLOW: 'Captured presentation content does not fit. Correct the working draft and generate a new version.',
  PDF_RENDER_FAILED: 'The fixed-version PDF could not be rendered. Retry uses the same captured content.',
  PDF_VALIDATION_FAILED: 'The generated PDF failed its independent integrity or layout checks.',
  PDF_ABORTED: 'The presentation attempt stopped before publication.',
  PDF_BUDGET_EXCEEDED: 'This fixed presentation exceeds the supported rendering budget.',
  JOB_CANCELLED: 'This presentation job was cancelled. Generate a new version to continue.',
  PDF_SOURCE_UNAVAILABLE: 'A captured source asset is unavailable or failed verification.',
  PDF_TEMPLATE_UNAVAILABLE: 'The captured presentation template or fonts are unavailable.',
  PDF_LAYOUT_OVERFLOW: 'Captured content overflows its registered layout. Correct the draft and generate a new version.',
  PDF_INVALID: 'The generated PDF failed validation.',
  PDF_PAGE_COUNT_MISMATCH: 'The PDF page count does not match the captured presentation.',
  PDF_LINKS_INVALID: 'The PDF original-video links do not match the fixed version.',
  PDF_OUTPUT_UNVERIFIED: 'The stored presentation artifacts could not be verified.',
  SNAPSHOT_INVALID: 'The captured presentation snapshot failed its integrity check.',
  PERMISSION_CHANGED: 'The original requester no longer has the required presentation permissions.',
};
export interface FrameExtractionOutcome {
  requested_count: number; extracted_count: number; unavailable_timestamps_ms: number[];
  warnings: ('FRAME_TIMESTAMP_SHARED'|'FRAME_TIMESTAMP_UNAVAILABLE')[];
}
export interface CentralJob {
  id: string; workspace_id: string | null; kind: typeof KINDS[number]; status: typeof STATUSES[number]; stage: string;
  attempt: number; progress_completed: number; progress_total: number | null; batch_id: string | null; input_asset_id: string | null;
  resource_id: string | null; error: { code: string; message: string; details: Record<string, string | number>; retryable: boolean } | null;
  created_at: string; updated_at: string; row_version: number; frame_extraction?: FrameExtractionOutcome;
  can_retry?: boolean; can_cancel?: boolean;
}
export interface JobListOptions { workspace_id?: string; status?: typeof STATUSES[number]; cursor?: string; limit?: number }
export interface JobMutationInput { row_version: number; reason?: string | null }
function fail(): never { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central job data did not match its public contract.', 503); }
function invalid(): never { throw new DomainError('INVALID_REQUEST', 'Provide bounded job identifiers, filters, row version and Idempotency-Key.', 400); }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(); return value as Record<string, unknown>; }
function exact(value: unknown, fields: string[]) { const result = object(value); if (Object.keys(result).length !== fields.length || fields.some(field => !Object.hasOwn(result, field))) fail(); return result; }
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function jobDto(value: unknown): CentralJob {
  const hasOutcome=Object.hasOwn(object(value),'frame_extraction');
  const hasActions = object(value).kind === 'presentation_render' || Object.hasOwn(object(value), 'can_retry') || Object.hasOwn(object(value), 'can_cancel');
  const row = exact(value, ['id', 'workspace_id', 'kind', 'status', 'stage', 'attempt', 'progress_completed', 'progress_total', 'batch_id', 'input_asset_id', 'resource_id', 'error', 'created_at', 'updated_at', 'row_version',...(hasOutcome?['frame_extraction']:[]), ...(hasActions ? ['can_retry', 'can_cancel'] : [])]);
  if(hasOutcome!==(row.kind==='frame_extract'&&row.status==='succeeded'))fail();
  if(hasOutcome){
    const outcome=exact(row.frame_extraction,['requested_count','extracted_count','unavailable_timestamps_ms','warnings']);
    if(!count(outcome.requested_count)||outcome.requested_count<1||outcome.requested_count>10||!count(outcome.extracted_count)||outcome.extracted_count>outcome.requested_count
      ||!Array.isArray(outcome.unavailable_timestamps_ms)||outcome.unavailable_timestamps_ms.length>outcome.requested_count
      ||outcome.unavailable_timestamps_ms.some(time=>!count(time)||time>=1_800_000)||new Set(outcome.unavailable_timestamps_ms).size!==outcome.unavailable_timestamps_ms.length
      ||outcome.extracted_count+outcome.unavailable_timestamps_ms.length>outcome.requested_count
      ||!Array.isArray(outcome.warnings)||outcome.warnings.length>2||new Set(outcome.warnings).size!==outcome.warnings.length
      ||outcome.warnings.some(warning=>!['FRAME_TIMESTAMP_SHARED','FRAME_TIMESTAMP_UNAVAILABLE'].includes(warning)))fail();
  }
  if (!id(row.id) || ![row.workspace_id, row.batch_id, row.input_asset_id, row.resource_id].every(value => value === null || id(value))
    || !KINDS.includes(row.kind as CentralJob['kind']) || !STATUSES.includes(row.status as CentralJob['status']) || !id(row.stage)
    || !count(row.attempt) || !count(row.progress_completed) || !(row.progress_total === null || count(row.progress_total) && row.progress_total >= row.progress_completed)
    || !count(row.row_version) || row.row_version < 1
    || ![row.created_at, row.updated_at].every(value => typeof value === 'string' && value.length <= 100 && Number.isFinite(Date.parse(value)))) fail();
  if (row.error !== null) {
    const error = exact(row.error, ['code', 'message', 'details', 'retryable']); const details = object(error.details);
    if (typeof error.code !== 'string' || !Object.hasOwn(SAFE_ERRORS, error.code) || typeof error.retryable !== 'boolean'
      || typeof error.message !== 'string' || error.message.length > 2000 || Object.keys(details).some(key => !['cause_code', 'retry_after_seconds'].includes(key))
      || details.cause_code !== undefined && (typeof details.cause_code !== 'string' || !Object.hasOwn(SAFE_ERRORS, details.cause_code))
      || details.retry_after_seconds !== undefined && (typeof details.retry_after_seconds !== 'number' || !Number.isFinite(details.retry_after_seconds) || details.retry_after_seconds < 0 || details.retry_after_seconds > 86400)) fail();
    row.error = { code: error.code, message: SAFE_ERRORS[error.code], details: structuredClone(details), retryable: error.retryable };
  }
  if (hasActions && (row.kind !== 'presentation_render' || typeof row.can_retry !== 'boolean' || typeof row.can_cancel !== 'boolean'
    || row.can_retry && (row.status !== 'failed' || row.error === null || object(row.error).code === 'JOB_CANCELLED')
    || row.can_cancel && !['queued', 'running', 'waiting_for_input'].includes(row.status as string))) fail();
  return structuredClone(row) as unknown as CentralJob;
}

/** Curated user-JWT RPC facade, NOT a fake multi-request SQL transaction adapter. */
export async function createCentralJobs(client: SupabaseClient) {
  const identity = await verifyCentralUser(client);
  function actorCheck(actor: Actor) { if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The job actor does not match the verified session.', 403); }
  async function rpc(actor: Actor, name: string, args: Record<string, unknown>, context?: MutationContext) {
    actorCheck(actor);
    try {
      let request = client.rpc(name, args);
      if (context?.requestId && /^[A-Za-z0-9._:-]{1,128}$/u.test(context.requestId)) request = request.setHeader('X-EPS-Request-ID', context.requestId);
      if (context?.clientType) { if (!['browser', 'api', 'mcp'].includes(context.clientType)) invalid(); request = request.setHeader('X-EPS-Client-Type', context.clientType); }
      const { data, error } = await request;
      if (error) throw centralRpcError(error);
      return data;
    } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Central job processing is temporarily unavailable.', 503, {}, true); }
  }
  async function mutation(actor: Actor, name: string, jobId: string, input: JobMutationInput, context?: MutationContext) {
    actorCheck(actor);
    const idempotencyKey = context?.idempotencyKey;
    if (!id(jobId) || !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(field => !['row_version', 'reason'].includes(field))
      || Object.hasOwn(input, 'reason') && input.reason !== null && typeof input.reason !== 'string'
      || !count(input.row_version) || input.row_version < 1 || !id(idempotencyKey)) invalid();
    const result = jobDto(await rpc(actor, name, { p_job_id: jobId, p_input: input, p_idempotency_key: idempotencyKey }, context));
    if (result.id !== jobId) fail(); return result;
  }
  return {
    async getJob(actor: Actor, jobId: string) { actorCheck(actor); if (!id(jobId)) invalid(); const result = jobDto(await rpc(actor, 'eps_get_job', { p_job_id: jobId })); if (result.id !== jobId) fail(); return result; },
    async listJobs(actor: Actor, options: JobListOptions = {}) {
      actorCheck(actor);
      if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => !['workspace_id', 'status', 'cursor', 'limit'].includes(key))
        || options.workspace_id !== undefined && !id(options.workspace_id) || options.cursor !== undefined && !id(options.cursor)
        || options.status !== undefined && !STATUSES.includes(options.status) || options.limit !== undefined && (!count(options.limit) || options.limit < 1 || options.limit > 100)) invalid();
      const value = exact(await rpc(actor, 'eps_list_jobs', { p_workspace_id: options.workspace_id ?? null, p_status: options.status ?? null, p_cursor: options.cursor ?? null, p_limit: options.limit ?? 25 }), ['data', 'page']);
      const page = exact(value.page, ['next_cursor']);
      if (!Array.isArray(value.data) || value.data.length > (options.limit ?? 25) || !(page.next_cursor === null || id(page.next_cursor))) fail();
      return { data: value.data.map(jobDto), page: { next_cursor: page.next_cursor as string | null } };
    },
    retryJob: (actor: Actor, jobId: string, input: JobMutationInput, context?: MutationContext) => mutation(actor, 'eps_retry_job', jobId, input, context),
    cancelJob: (actor: Actor, jobId: string, input: JobMutationInput, context?: MutationContext) => mutation(actor, 'eps_cancel_job', jobId, input, context),
  };
}
