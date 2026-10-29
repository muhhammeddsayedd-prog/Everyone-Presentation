import type { CentralJob } from '@eps/central';

export type ProcessingJob = CentralJob;
export type ProcessingStatus = ProcessingJob['status'];
export type JobAction = 'retry' | 'cancel';
export type JobPage = { jobs: ProcessingJob[]; cursor: string | null };
export type JobIntent = { jobId: string; action: JobAction; body: { row_version: number }; key: string };
export const JOB_STATUSES: ProcessingStatus[] = ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'];
export const JOB_KINDS: Record<ProcessingJob['kind'], string> = { specs_extract: 'Specs extraction', candidate_scan: 'Candidate scan', frame_extract: 'Frame extraction',
  ai_suggestion: 'AI suggestion', presentation_render: 'Presentation generation', presentation_export: 'PDF export' };
export const STATUS_LABELS: Record<ProcessingStatus, string> = { queued: 'Queued', running: 'In progress', waiting_for_input: 'Needs input', succeeded: 'Completed', failed: 'Failed', cancelled: 'Cancelled' };
const STAGES: Record<string, string> = { prepare_document: 'Document preparation', extract_specs: 'Requirements extraction', apply_specs: 'Applying requirements',
  prepare_media: 'Media preparation', transcribe: 'Spoken information', extract_facts: 'Supplied facts', extract_frames: 'Frame extraction', select_frames: 'Source frame selection',
  prepare_candidate: 'Video preparation', transcribe_candidate: 'Original-language transcription', extract_candidate: 'Supplied fact extraction',
  apply_candidate: 'Saving candidate profile', apply_frames: 'Saving extracted frames',
  render: 'Presentation layout', export_pdf: 'PDF preparation' };
const FAILURES: Record<string, string> = { SOURCE_UNREADABLE: 'The supplied source could not be read.', UNSUPPORTED_FORMAT: 'The supplied source format is unsupported.',
  RESULT_INVALID: 'The result could not be validated. Existing work has been retained.', EXTRACTION_REFUSED: 'Extraction could not complete for this input.',
  PROVIDER_RATE_LIMITED: 'Processing is temporarily rate limited.', DEPENDENCY_UNAVAILABLE: 'A processing dependency is temporarily unavailable.',
  LEASE_EXPIRED: 'Processing was interrupted before it could finish.', DISPATCH_UNAVAILABLE: 'The processing request could not be dispatched.',
  INPUT_CHANGED: 'The source or draft changed. Existing edits have been retained.', PROCESSING_FAILED: 'Processing could not complete. Existing work has been retained.',
  RETRY_EXHAUSTED: 'The retry limit has been reached. Existing work has been retained.' };
export const validProcessingId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
export function jobStageLabel(stage: string): string { return Object.hasOwn(STAGES, stage) ? STAGES[stage] : 'Processing step'; }
export function jobFailureMessage(error: ProcessingJob['error']): string {
  return error && Object.hasOwn(FAILURES, error.code) ? FAILURES[error.code] : FAILURES.PROCESSING_FAILED;
}
function invalid(): never { throw new Error('The saved processing details could not be read. Reload to try again.'); }
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function readProcessingJob(value: unknown, expectedId?: string): ProcessingJob {
  if (!record(value) || !validProcessingId(value.id) || expectedId && value.id !== expectedId
    || ![value.workspace_id, value.batch_id, value.input_asset_id, value.resource_id].every(id => id === null || validProcessingId(id))
    || typeof value.kind !== 'string' || !Object.hasOwn(JOB_KINDS, value.kind) || !JOB_STATUSES.includes(value.status as ProcessingStatus)
    || !validProcessingId(value.stage) || !count(value.attempt) || !count(value.progress_completed)
    || !(value.progress_total === null || count(value.progress_total) && value.progress_total >= value.progress_completed)
    || !count(value.row_version) || value.row_version < 1
    || ![value.created_at, value.updated_at].every(date => typeof date === 'string' && date.length <= 100 && Number.isFinite(Date.parse(date)))) invalid();
  if (value.error !== null && (!record(value.error) || typeof value.error.code !== 'string' || typeof value.error.retryable !== 'boolean')) invalid();
  return structuredClone(value) as unknown as ProcessingJob;
}
export function readJobPage(value: unknown, status: ProcessingStatus | null, requestedCursor: string | null): JobPage {
  if (!record(value) || !Array.isArray(value.data) || value.data.length > 25 || !record(value.page)
    || !(value.page.next_cursor === null || validProcessingId(value.page.next_cursor))) invalid();
  const jobs = value.data.map(item => readProcessingJob(item)); const cursor = value.page.next_cursor;
  if (new Set(jobs.map(job => job.id)).size !== jobs.length || status && jobs.some(job => job.status !== status)
    || cursor !== null && (!jobs.length || cursor === requestedCursor)) invalid();
  return { jobs, cursor };
}
export function retainJobIntent(previous: JobIntent | null, job: ProcessingJob, action: JobAction, createKey: () => string): JobIntent {
  if (previous) {
    if (previous.jobId !== job.id || previous.action !== action) throw new Error('Resolve the previous request before starting another operation.');
    return previous;
  }
  return { jobId: job.id, action, body: { row_version: job.row_version }, key: createKey() };
}
export function processingDelay(status: ProcessingStatus | null, failures: number, list: boolean): number | null {
  if (failures > 0) return Math.min(60_000, 5000 * 2 ** Math.min(4, failures - 1));
  if (!list && status && ['succeeded', 'failed', 'cancelled'].includes(status)) return null;
  return status === 'queued' || status === 'running' ? 5000 : 10000;
}
export function workspaceResultHref(job: Pick<ProcessingJob, 'workspace_id' | 'kind'>, workspace: { id: string; project_id: string }): string {
  if (!job.workspace_id || workspace.id !== job.workspace_id || !validProcessingId(workspace.project_id)) invalid();
  const step = job.kind === 'specs_extract' ? 'specs' : ['candidate_scan', 'frame_extract'].includes(job.kind) ? 'cast' : 'project';
  return `/projects/${encodeURIComponent(workspace.project_id)}/casting/${encodeURIComponent(workspace.id)}/${step}`;
}
export function processingHref({ job, status, cursor }: { job?: string | null; status?: ProcessingStatus | null; cursor?: string | null } = {}): string {
  const query = new URLSearchParams();
  if (job) query.set('job', job); if (status) query.set('status', status); if (cursor) query.set('cursor', cursor);
  return `/processing${query.size ? `?${query}` : ''}`;
}
