import { JobError, type JobKind } from './types.ts';

/** Operator-only correlation metadata. Never accept a job/input/event object here. */
export interface JobStageAttemptTrace {
  schema_version: '1.0';
  job_id: string;
  attempt_id: string;
  kind: JobKind;
  stage: string;
  attempt: number;
  stage_attempt: number;
  dispatch_generation: number;
  correlation_id: string;
  input_hash: string;
  workflow_execution_id: string | null;
  workflow_execution_ref_state: 'recorded' | 'not_provided' | 'invalid_omitted';
  claimed_at: string;
  job_row_version: number;
}

const stages: Record<JobKind, readonly string[]> = {
  specs_extract: ['prepare_document', 'extract_specs', 'apply_specs'],
  candidate_scan: ['prepare_candidate', 'transcribe_candidate', 'extract_candidate', 'select_frames', 'apply_candidate'],
  frame_extract: ['extract_frames', 'apply_frames'],
  ai_suggestion: ['prepare_suggestion', 'generate_suggestion', 'validate_suggestion'],
  review_fit: ['measure_review_fit'],
  presentation_render: ['prepare_presentation', 'render_presentation', 'validate_presentation', 'publish_presentation'],
  presentation_export: ['render_export'],
};
const fields = ['schema_version', 'job_id', 'attempt_id', 'kind', 'stage', 'attempt', 'stage_attempt', 'dispatch_generation',
  'correlation_id', 'input_hash', 'workflow_execution_id', 'workflow_execution_ref_state', 'claimed_at', 'job_row_version'];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const reference = /^[A-Za-z0-9._:-]{1,200}$/u;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 1;
function invalid(): never { throw new JobError('ATTEMPT_TRACE_INVALID', 'Processing correlation metadata is unavailable.', 503); }

/** Strict parser for a trusted operator query's explicit metadata projection.
 * Unknown keys fail closed, so payloads cannot silently become trace fields. */
export function parseJobStageAttemptTrace(value: unknown): JobStageAttemptTrace {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const row = value as Record<string, unknown>;
  if (Reflect.ownKeys(row).length !== fields.length || fields.some(key => !Object.hasOwn(row, key)
    || !Object.hasOwn(Object.getOwnPropertyDescriptor(row, key)!, 'value'))
    || row.schema_version !== '1.0' || typeof row.job_id !== 'string' || !uuid.test(row.job_id)
    || typeof row.attempt_id !== 'string' || !uuid.test(row.attempt_id)
    || typeof row.kind !== 'string' || !Object.hasOwn(stages, row.kind)
    || typeof row.stage !== 'string' || !stages[row.kind as JobKind].includes(row.stage)
    || !positive(row.attempt) || row.attempt > 2147483647 || !positive(row.stage_attempt)
    || row.stage_attempt > row.attempt || !positive(row.dispatch_generation) || !positive(row.job_row_version)
    || typeof row.correlation_id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/u.test(row.correlation_id)
    || typeof row.input_hash !== 'string' || !/^[a-f0-9]{64}$/u.test(row.input_hash)
    || typeof row.claimed_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.test(row.claimed_at)
    || !Number.isFinite(Date.parse(row.claimed_at))) invalid();
  if (row.workflow_execution_ref_state === 'recorded') {
    if (typeof row.workflow_execution_id !== 'string' || !reference.test(row.workflow_execution_id)) invalid();
  } else if (!['not_provided', 'invalid_omitted'].includes(String(row.workflow_execution_ref_state))
    || row.workflow_execution_id !== null) invalid();
  // Build a detached allowlist instead of returning the caller's object.
  return Object.fromEntries(fields.map(key => [key, row[key]])) as unknown as JobStageAttemptTrace;
}
