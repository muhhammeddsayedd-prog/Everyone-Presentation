export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type JobKind = 'specs_extract' | 'candidate_scan' | 'frame_extract' | 'ai_suggestion' | 'presentation_render' | 'presentation_export';
export type JobStatus = 'queued' | 'running' | 'waiting_for_input' | 'succeeded' | 'failed' | 'cancelled';
export interface JobActor { principal_id: string; client_type: 'browser' | 'api' | 'mcp' | 'service' }
export interface JobErrorDto { code: string; message: string; details: JsonObject; retryable: boolean }
export interface JobEvent {
  event_id: string; job_id: string; attempt_id: string; lease_token: string; stage: string; sequence: number;
  event_type: 'heartbeat' | 'progress' | 'succeeded' | 'failed'; input_hash: string;
  result_schema?: string | null; result?: JsonObject; error?: JobErrorDto | null;
}
export interface JobEventReceipt { event_id: string; applied: boolean; duplicate: boolean; stale: boolean; job_status: JobStatus }
export interface StageClaim { job_id: string; stage: string; input_hash: string; workflow_execution_id?: string }
export interface StageLease {
  job_id: string; stage: string; attempt_id: string; lease_token: string; lease_expires_at: string;
  already_completed: boolean; input: JsonObject;
}
export interface StageResult { stage: string; input_hash: string; attempt_id: string; result_schema: string; result: JsonObject; completed_at: string }
export interface JobRecord {
  id: string; workspace_id: string | null; kind: JobKind; resource_id: string | null; input_asset_id: string | null;
  batch_id: string | null; requested_by: string; input: JsonObject; input_hash: string; dedupe_key: string;
  status: JobStatus; stage: string; attempt: number; current_attempt_id: string | null;
  lease_token_digest: string | null; lease_expires_at: string | null; heartbeat_at: string | null;
  last_event_sequence: number; stage_attempts: Record<string, number>; completed_stages: StageResult[];
  progress_completed: number; progress_total: number | null; result: JsonObject | null; error: JobErrorDto | null;
  available_at: string; cancel_requested_at: string | null; dispatch_generation: number;
  n8n_execution_id: string | null; created_at: string; updated_at: string; row_version: number;
}
export interface StoredEvent {
  job_id: string; attempt_id: string; event_id: string; sequence: number; event_type: JobEvent['event_type'];
  stage: string; payload_digest: string; receipt: JobEventReceipt; created_at: string;
}
export interface OutboxRecord {
  id: string; topic: 'jobs.stage.ready'; job_id: string; stage: string; input_hash: string; dedupe_key: string;
  dispatch_generation: number;
  status: 'pending' | 'leased' | 'delivered' | 'dead'; attempt_count: number; available_at: string;
  lease_token_digest: string | null; lease_expires_at: string | null; delivered_at: string | null;
  last_error: JobErrorDto | null; created_at: string;
}
export interface DispatchLease { id: string; job_id: string; stage: string; input_hash: string; lease_token: string; lease_expires_at: string }
export interface IdempotencyRecord { scope: string; key: string; digest: string; result: JsonObject }

/** Implement using parameterized queries and locks in one central DB transaction.
 * Reads return detached snapshots. saveJob is a row_version compare-and-set.
 * Unique DB indexes must cover job/outbox dedupe and both event identities.
 * Never perform provider/network work in this transaction callback. */
export interface JobTransaction {
  getJobForUpdate(id: string): Promise<JobRecord | null>;
  findJobByDedupeKey(key: string): Promise<JobRecord | null>;
  insertJob(job: JobRecord): Promise<void>;
  saveJob(job: JobRecord, expectedRowVersion: number): Promise<void>;
  findEventById(jobId: string, attemptId: string, eventId: string): Promise<StoredEvent | null>;
  findEventBySequence(jobId: string, attemptId: string, sequence: number): Promise<StoredEvent | null>;
  insertEvent(event: StoredEvent): Promise<void>;
  getIdempotency(scope: string, key: string): Promise<IdempotencyRecord | null>;
  putIdempotency(record: IdempotencyRecord): Promise<void>;
  insertOutbox(event: OutboxRecord): Promise<void>;
  getOutboxForUpdate(id: string): Promise<OutboxRecord | null>;
  saveOutbox(event: OutboxRecord): Promise<void>;
  /** SELECT ... FOR UPDATE SKIP LOCKED, ordered by available_at/id; include expired leased rows. */
  listDispatchableOutbox(now: string, limit: number): Promise<OutboxRecord[]>;
  /** SELECT ... FOR UPDATE SKIP LOCKED, bounded and ordered. */
  listExpiredJobs(now: string, limit: number): Promise<JobRecord[]>;
}
export interface JobRepository<Tx extends JobTransaction = JobTransaction> { transaction<R>(operation: (tx: Tx) => Promise<R>): Promise<R> }
export type JobAction = 'enqueue' | 'read' | 'execute' | 'retry' | 'cancel' | 'dispatch' | 'recover';
export interface StageApplication {
  resource_id?: string | null;
  waiting_for_input?: { code: string };
}
export interface StageDefinition<Tx extends JobTransaction> {
  key: string; result_schema: string;
  /** Pure schema parse; throw on invalid values; never invoke a model or external service. */
  validateResult(result: JsonObject): JsonObject;
  /** Verify reserved output ownership, source versions, and apply domain changes in THIS transaction.
   * This hook must use only this tx; no separate DB connection or external side effects. */
  applyResult(tx: Tx, job: Readonly<JobRecord>, result: JsonObject): Promise<StageApplication | void>;
}
export interface JobDefinition<Tx extends JobTransaction> { kind: JobKind; validateInput(input: JsonObject): JsonObject; stages: StageDefinition<Tx>[] }
export interface JobServiceOptions<Tx extends JobTransaction> {
  repository: JobRepository<Tx>; definitions: JobDefinition<Tx>[];
  /** These gates MUST resolve trusted current user/service grants. No permissive defaults exist. */
  authorizeJob(actor: JobActor, action: JobAction, job: Readonly<Pick<JobRecord, 'id' | 'workspace_id' | 'requested_by'>>, tx: Tx): Promise<void>;
  authorizeDispatcher(actor: JobActor): Promise<void>;
  clock?: () => Date; id?: () => string; token?: () => string; random?: () => number;
  leaseSeconds?: number; maxStageAttempts?: number; maxDispatchAttempts?: number;
  backoffBaseSeconds?: number; backoffMaximumSeconds?: number; autoRetry?: boolean;
}
export interface EnqueueJob {
  kind: JobKind; workspace_id: string | null; resource_id?: string | null; input_asset_id?: string | null;
  batch_id?: string | null; input: JsonObject; dedupe_key: string;
}
export class JobError extends Error {
  readonly code: string; readonly status: number;
  constructor(code: string, message: string, status = 409) { super(message); this.name = 'JobError'; this.code = code; this.status = status; }
}
