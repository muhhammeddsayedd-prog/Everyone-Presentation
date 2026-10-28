import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { JobError } from './types.ts';
import type { DispatchLease, EnqueueJob, JobActor, JobDefinition, JobErrorDto, JobEvent, JobEventReceipt, JobRecord, JobServiceOptions, JobTransaction, JsonObject, OutboxRecord, StageClaim, StageLease, StoredEvent } from './types.ts';
export * from './types.ts';

const EVENT_FIELDS = ['event_id', 'job_id', 'attempt_id', 'lease_token', 'stage', 'sequence', 'event_type', 'input_hash', 'result_schema', 'result', 'error'];
const FAILURE_MESSAGES: Record<string, { message: string; retryable: boolean }> = {
  SOURCE_UNREADABLE: { message: 'The supplied source cannot be read. Replace it or enter its information manually.', retryable: false },
  UNSUPPORTED_FORMAT: { message: 'This source format is unsupported. Convert it or use manual text entry.', retryable: false },
  RESULT_INVALID: { message: 'Processing returned an invalid result. The source and existing edits have been preserved.', retryable: false },
  EXTRACTION_REFUSED: { message: 'Extraction could not complete for this input. Use ordinary editing or another source.', retryable: false },
  PROVIDER_RATE_LIMITED: { message: 'The processing provider is temporarily rate limited.', retryable: true },
  DEPENDENCY_UNAVAILABLE: { message: 'A required processing service is temporarily unavailable.', retryable: true },
  LEASE_EXPIRED: { message: 'The processing lease expired before completion.', retryable: true },
  DISPATCH_UNAVAILABLE: { message: 'The processing request could not be dispatched.', retryable: true },
  INPUT_CHANGED: { message: 'The source or working draft changed. Existing edits were preserved.', retryable: false },
  PROCESSING_FAILED: { message: 'Processing failed. The source and existing edits have been preserved.', retryable: false },
};
function errorDto(code: string, retryable?: boolean, details: JsonObject = {}): JobErrorDto {
  const safeCode = Object.hasOwn(FAILURE_MESSAGES, code) ? code : 'PROCESSING_FAILED';
  const definition = FAILURE_MESSAGES[safeCode]!;
  return { code: safeCode, message: definition.message, details, retryable: definition.retryable && retryable !== false };
}
function nonempty(value: unknown, label: string, maximum = 200): asserts value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) throw new JobError('INVALID_REQUEST', `${label} must be bounded nonempty text.`, 400);
}
function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw new JobError('INVALID_REQUEST', 'A numeric value is outside its allowed range.', 400);
}
function object(value: unknown): asserts value is JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new JobError('INVALID_REQUEST', 'An object is required.', 400);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function digest(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex'); }
function tokenDigest(value: string) { return createHash('sha256').update(value).digest('hex'); }
function tokenMatches(token: string, expected: string | null) {
  if (!expected) return false;
  const actualBytes = Buffer.from(tokenDigest(token), 'hex'); const expectedBytes = Buffer.from(expected, 'hex');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
function boundedJson(value: JsonObject, maximum: number, referencesOnly = false) {
  object(value);
  let encoded: string;
  try { encoded = JSON.stringify(value); } catch { throw new JobError('INVALID_REQUEST', 'Cyclic processing data is not supported.', 400); }
  if (Buffer.byteLength(encoded) > maximum) throw new JobError('INVALID_REQUEST', 'Processing metadata exceeds the allowed size.', 400);
  function visit(item: unknown, depth: number) {
    if (depth > 32) throw new JobError('INVALID_REQUEST', 'Processing metadata is nested too deeply.', 400);
    if (typeof item === 'number' && !Number.isFinite(item) || item === undefined || typeof item === 'function' || typeof item === 'bigint' || typeof item === 'symbol') throw new JobError('INVALID_REQUEST', 'Processing metadata must contain JSON values.', 400);
    if (Array.isArray(item)) { item.forEach(child => visit(child, depth + 1)); return; }
    if (item && typeof item === 'object') {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new JobError('INVALID_REQUEST', 'Processing metadata must be plain JSON.', 400);
      for (const [key, child] of Object.entries(item)) {
        if (/(?:secret|password|credential|authorization|api_key|bearer|lease_token)/iu.test(key) || referencesOnly && /^(?:bytes|base64|transcript|source_text|source_document)$/iu.test(key)) throw new JobError('INVALID_REQUEST', 'Store private payloads and credentials outside job metadata; use scoped references.', 400);
        visit(child, depth + 1);
      }
    }
  }
  visit(value, 0);
}
function validateEvent(event: JobEvent) {
  object(event);
  if (Object.keys(event).some(key => !EVENT_FIELDS.includes(key))) throw new JobError('INVALID_REQUEST', 'Unknown callback fields.', 400);
  for (const key of ['event_id', 'job_id', 'attempt_id', 'stage', 'input_hash'] as const) nonempty(event[key], key);
  nonempty(event.lease_token, 'lease_token', 1024); integer(event.sequence, 1);
  if (!['heartbeat', 'progress', 'succeeded', 'failed'].includes(event.event_type)) throw new JobError('INVALID_REQUEST', 'Unknown callback event type.', 400);
  if (event.result_schema !== undefined && event.result_schema !== null) nonempty(event.result_schema, 'result_schema');
  if (event.result !== undefined) boundedJson(event.result, 256 * 1024);
  if (event.error !== undefined && event.error !== null) {
    object(event.error); nonempty(event.error.code, 'error code'); nonempty(event.error.message, 'error message', 2000); object(event.error.details);
    if (typeof event.error.retryable !== 'boolean' || Object.keys(event.error).some(key => !['code', 'message', 'details', 'retryable'].includes(key))) throw new JobError('INVALID_REQUEST', 'Malformed callback error.', 400);
    if (Buffer.byteLength(JSON.stringify(event.error.details)) > 16 * 1024) throw new JobError('INVALID_REQUEST', 'Callback error metadata is too large.', 400);
  }
  if (event.event_type === 'succeeded' && (!event.result || typeof event.result_schema !== 'string' || event.error) || event.event_type === 'failed' && (!event.error || event.result !== undefined)) throw new JobError('INVALID_REQUEST', 'Callback result and error do not match its event type.', 400);
}
function serviceActor(actor: JobActor) { nonempty(actor?.principal_id, 'service principal'); if (actor.client_type !== 'service') throw new JobError('SERVICE_AUTH_REQUIRED', 'This operation requires a scoped service identity.', 403); }
function userActor(actor: JobActor) { nonempty(actor?.principal_id, 'principal'); if (actor.client_type === 'service') throw new JobError('USER_AUTH_REQUIRED', 'This operation requires an authorized acting user.', 403); }

export function createJobService<Tx extends JobTransaction>(options: JobServiceOptions<Tx>) {
  const clock = options.clock ?? (() => new Date()); const id = options.id ?? randomUUID; const token = options.token ?? (() => randomBytes(32).toString('base64url')); const random = options.random ?? Math.random;
  const leaseSeconds = options.leaseSeconds ?? 90; const maximumAttempts = options.maxStageAttempts ?? 3;
  const maximumDispatchAttempts = options.maxDispatchAttempts ?? 5;
  const baseBackoff = options.backoffBaseSeconds ?? 2; const maximumBackoff = options.backoffMaximumSeconds ?? 300;
  integer(leaseSeconds, 1, 3600); integer(maximumAttempts, 1, 100); integer(maximumDispatchAttempts, 1, 100); integer(baseBackoff, 1, 3600); integer(maximumBackoff, baseBackoff, 86400);
  const definitions = new Map<string, JobDefinition<Tx>>();
  for (const definition of options.definitions) {
    if (definitions.has(definition.kind) || !definition.stages.length || new Set(definition.stages.map(stage => stage.key)).size !== definition.stages.length) throw new JobError('INVALID_CONFIGURATION', 'Job definitions need unique kinds and nonempty ordered unique stages.', 500);
    for (const stage of definition.stages) { nonempty(stage.key, 'stage'); nonempty(stage.result_schema, 'result schema'); }
    definitions.set(definition.kind, definition);
  }
  const now = () => clock().toISOString();
  const expires = (at: string) => new Date(Date.parse(at) + leaseSeconds * 1000).toISOString();
  function backoff(at: string, attempt: number, retryAfterSeconds = 0) {
    const jitter = random(); if (!Number.isFinite(jitter) || jitter < 0 || jitter >= 1) throw new JobError('INVALID_CONFIGURATION', 'Retry jitter must be within [0,1).', 500);
    const seconds = Math.min(maximumBackoff, baseBackoff * 2 ** Math.min(attempt - 1, 20) * (0.5 + jitter));
    return new Date(Date.parse(at) + Math.max(seconds, Math.min(retryAfterSeconds, 86400)) * 1000).toISOString();
  }
  function definition(job: JobRecord) { const found = definitions.get(job.kind); if (!found) throw new JobError('JOB_KIND_UNAVAILABLE', 'This job kind is not configured.', 503); return found; }
  async function requireJob(tx: Tx, actor: JobActor, jobId: string, action: Parameters<JobServiceOptions<Tx>['authorizeJob']>[1]) {
    const job = await tx.getJobForUpdate(jobId);
    if (!job) throw new JobError('RESOURCE_NOT_FOUND', 'Job not found.', 404);
    await options.authorizeJob(actor, action, job, tx); return job;
  }
  async function save(tx: Tx, job: JobRecord, at: string) { const previous = job.row_version; job.row_version++; job.updated_at = at; await tx.saveJob(job, previous); }
  function clearLease(job: JobRecord) { job.lease_token_digest = null; job.lease_expires_at = null; }
  async function dispatch(tx: Tx, job: JobRecord, at: string, increment = true) {
    if (increment) job.dispatch_generation++;
    const outbox: OutboxRecord = { id: id(), topic: 'jobs.stage.ready', job_id: job.id, stage: job.stage, input_hash: job.input_hash, dispatch_generation: job.dispatch_generation, dedupe_key: `${job.id}:${job.dispatch_generation}`, status: 'pending', attempt_count: 0, available_at: job.available_at, lease_token_digest: null, lease_expires_at: null, delivered_at: null, last_error: null, created_at: at };
    await tx.insertOutbox(outbox);
  }
  async function idempotent<R>(tx: Tx, actor: JobActor, operation: string, key: string, input: unknown, action: () => Promise<R>) {
    nonempty(key, 'Idempotency-Key'); const scope = `${actor.principal_id}:${operation}`; const requestDigest = digest(input);
    const previous = await tx.getIdempotency(scope, key);
    if (previous) { if (previous.digest !== requestDigest) throw new JobError('IDEMPOTENCY_KEY_REUSED', 'This key was already used with different input.'); return structuredClone(previous.result) as R; }
    const result = await action();
    await tx.putIdempotency({ scope, key, digest: requestDigest, result: structuredClone(result) as JsonObject }); return result;
  }
  async function failure(tx: Tx, job: JobRecord, error: JobErrorDto, at: string) {
    clearLease(job); job.error = error;
    const attempts = job.stage_attempts[job.stage] ?? 0;
    if (error.retryable && attempts >= maximumAttempts) {
      job.status = 'failed'; job.error = { code: 'RETRY_EXHAUSTED', message: 'The bounded retry budget for this stage has been exhausted. Existing results were preserved.', details: { cause_code: error.code }, retryable: false };
    } else if (error.retryable && options.autoRetry !== false) {
      job.status = 'queued'; const hint = error.details.retry_after_seconds; job.available_at = backoff(at, Math.max(attempts, 1), typeof hint === 'number' ? hint : 0); await dispatch(tx, job, at);
    } else job.status = 'failed';
  }
  function verifyOutboxLease(outbox: OutboxRecord, leaseToken: string, at: string) {
    if (!tokenMatches(leaseToken, outbox.lease_token_digest) || outbox.status !== 'leased' || !outbox.lease_expires_at || outbox.lease_expires_at <= at) throw new JobError('STALE_DISPATCH_LEASE', 'The dispatch lease is expired or obsolete.');
  }
  return {
    async enqueue(actor: JobActor, input: EnqueueJob, idempotencyKey: string) {
      userActor(actor); nonempty(input.dedupe_key, 'dedupe_key'); boundedJson(input.input, 64 * 1024, true);
      const defined = definitions.get(input.kind); if (!defined) throw new JobError('JOB_KIND_UNAVAILABLE', 'This job kind is not configured.', 503);
      const normalizedInput = defined.validateInput(structuredClone(input.input)); boundedJson(normalizedInput, 64 * 1024, true);
      return options.repository.transaction(async tx => {
        await options.authorizeJob(actor, 'enqueue', { id: '', workspace_id: input.workspace_id, requested_by: actor.principal_id }, tx);
        return idempotent(tx, actor, 'enqueue', idempotencyKey, input, async () => {
        const existing = await tx.findJobByDedupeKey(input.dedupe_key);
        if (existing) {
          await options.authorizeJob(actor, 'read', existing, tx);
          if (existing.input_hash !== digest(normalizedInput) || existing.kind !== input.kind || existing.workspace_id !== input.workspace_id || existing.resource_id !== (input.resource_id ?? null) || existing.input_asset_id !== (input.input_asset_id ?? null)) throw new JobError('JOB_DEDUPE_CONFLICT', 'The source/configuration dedupe identity has different content.');
          return existing;
        }
        const at = now();
        const job: JobRecord = { id: id(), kind: input.kind, workspace_id: input.workspace_id, resource_id: input.resource_id ?? null, input_asset_id: input.input_asset_id ?? null, batch_id: input.batch_id ?? null, requested_by: actor.principal_id, input: normalizedInput, input_hash: digest(normalizedInput), dedupe_key: input.dedupe_key, status: 'queued', stage: defined.stages[0]!.key, attempt: 0, current_attempt_id: null, lease_token_digest: null, lease_expires_at: null, heartbeat_at: null, last_event_sequence: 0, stage_attempts: {}, completed_stages: [], progress_completed: 0, progress_total: null, result: null, error: null, available_at: at, cancel_requested_at: null, dispatch_generation: 0, n8n_execution_id: null, created_at: at, updated_at: at, row_version: 1 };
        job.dispatch_generation = 1; await tx.insertJob(job); await dispatch(tx, job, at, false); return job;
        });
      });
    },
    async getJob(actor: JobActor, jobId: string) { return options.repository.transaction(tx => requireJob(tx, actor, jobId, 'read')); },
    async claimStage(actor: JobActor, input: StageClaim): Promise<StageLease> {
      serviceActor(actor); nonempty(input.job_id, 'job_id'); nonempty(input.stage, 'stage'); nonempty(input.input_hash, 'input_hash');
      if (input.workflow_execution_id !== undefined) nonempty(input.workflow_execution_id, 'workflow_execution_id');
      return options.repository.transaction<StageLease>(async (tx): Promise<StageLease> => {
        const job = await requireJob(tx, actor, input.job_id, 'execute'); const at = now();
        if (job.input_hash !== input.input_hash) throw new JobError('INPUT_HASH_MISMATCH', 'The requested stage does not match the frozen input.');
        const completed = job.completed_stages.find(stage => stage.stage === input.stage && stage.input_hash === input.input_hash);
        if (completed) return { job_id: job.id, stage: completed.stage, attempt_id: completed.attempt_id, lease_token: '', lease_expires_at: completed.completed_at, already_completed: true, input: { result: completed.result, result_schema: completed.result_schema, input_hash: job.input_hash } };
        if (job.cancel_requested_at || job.status === 'cancelled') throw new JobError('JOB_CANCELLED', 'This job has been cancelled.');
        if (input.stage !== job.stage || !definition(job).stages.some(stage => stage.key === input.stage)) throw new JobError('STAGE_OUT_OF_ORDER', 'Only the next configured stage may be claimed.');
        if (job.status === 'running' && job.lease_expires_at && job.lease_expires_at > at) throw new JobError('JOB_ALREADY_RUNNING', 'This job stage already has an active lease.');
        if (!['queued', 'running'].includes(job.status) || job.available_at > at) throw new JobError('JOB_NOT_AVAILABLE', 'This job is not available for processing now.');
        if ((job.stage_attempts[job.stage] ?? 0) >= maximumAttempts) throw new JobError('RETRY_EXHAUSTED', 'The retry budget for this stage is exhausted.');
        const leaseToken = token(); const attemptId = id();
        job.attempt++; job.stage_attempts[job.stage] = (job.stage_attempts[job.stage] ?? 0) + 1; job.current_attempt_id = attemptId; job.last_event_sequence = 0; job.lease_token_digest = tokenDigest(leaseToken); job.lease_expires_at = expires(at); job.heartbeat_at = at; job.status = 'running'; job.error = null; job.progress_completed = 0; job.progress_total = null;
        job.n8n_execution_id = input.workflow_execution_id ?? null;
        await save(tx, job, at);
        return { job_id: job.id, stage: job.stage, attempt_id: attemptId, lease_token: leaseToken, lease_expires_at: job.lease_expires_at!, already_completed: false, input: { ...job.input, input_hash: job.input_hash, previous_stage_results: job.completed_stages.map(stage => ({ stage: stage.stage, result_schema: stage.result_schema, result: stage.result })) } };
      });
    },
    async recordEvent(actor: JobActor, event: JobEvent): Promise<JobEventReceipt> {
      serviceActor(actor); validateEvent(event);
      return options.repository.transaction(async tx => {
        const job = await requireJob(tx, actor, event.job_id, 'execute'); const at = now(); const eventDigest = digest(event);
        const previous = await tx.findEventById(event.job_id, event.attempt_id, event.event_id);
        if (previous) { if (previous.payload_digest !== eventDigest) throw new JobError('EVENT_ID_CONFLICT', 'An existing event ID has different content.'); return { ...previous.receipt, duplicate: true, applied: false }; }
        const previousSequence = await tx.findEventBySequence(event.job_id, event.attempt_id, event.sequence);
        if (previousSequence) throw new JobError('EVENT_SEQUENCE_CONFLICT', 'Another event already used this attempt sequence.');
        const receipt: JobEventReceipt = { event_id: event.event_id, applied: false, duplicate: false, stale: false, job_status: job.status };
        if (job.status !== 'running' || job.cancel_requested_at || event.attempt_id !== job.current_attempt_id || event.stage !== job.stage || !job.lease_expires_at || job.lease_expires_at <= at) return { ...receipt, stale: true };
        if (!tokenMatches(event.lease_token, job.lease_token_digest)) throw new JobError('LEASE_INVALID', 'The callback lease credential is invalid.', 403);
        if (event.input_hash !== job.input_hash) throw new JobError('INPUT_HASH_MISMATCH', 'The callback does not match the frozen input.');
        if (event.sequence <= job.last_event_sequence) receipt.stale = true;
        else {
          job.last_event_sequence = event.sequence;
          if (event.event_type === 'heartbeat') { job.heartbeat_at = at; job.lease_expires_at = expires(at); }
          if (event.event_type === 'progress') {
            const progress = event.result ?? {}; integer(progress.progress_completed, 0); if (progress.progress_total !== null) integer(progress.progress_total, 0);
            const completed = progress.progress_completed as number; const total = progress.progress_total as number | null;
            if (Object.keys(progress).some(key => !['progress_completed', 'progress_total'].includes(key)) || total !== null && completed > total || completed < job.progress_completed) throw new JobError('INVALID_PROGRESS', 'Progress must be bounded and cannot move backward.', 422);
            job.progress_completed = completed; job.progress_total = total;
          }
          if (event.event_type === 'failed') {
            const providerError = event.error!; const safe = errorDto(providerError.code, providerError.retryable);
            const hint = providerError.details.retry_after_seconds;
            if (typeof hint === 'number' && Number.isFinite(hint) && hint >= 0) safe.details.retry_after_seconds = Math.min(hint, 86400);
            await failure(tx, job, safe, at);
          }
          if (event.event_type === 'succeeded') {
            const defined = definition(job); const index = defined.stages.findIndex(stage => stage.key === job.stage); const stage = defined.stages[index]!;
            let result: JsonObject | undefined;
            try { if (event.result_schema !== stage.result_schema) throw new Error('schema mismatch'); const candidate = stage.validateResult(structuredClone(event.result!)); boundedJson(candidate, 256 * 1024); result = candidate; }
            catch { await failure(tx, job, errorDto('RESULT_INVALID'), at); }
            if (result !== undefined) {
              const applied = await stage.applyResult(tx, structuredClone(job), structuredClone(result));
              if (applied?.waiting_for_input) { job.status = 'waiting_for_input'; job.error = errorDto('INPUT_CHANGED'); job.result = result; clearLease(job); }
              else {
                if (applied?.resource_id !== undefined) job.resource_id = applied.resource_id;
                job.completed_stages.push({ stage: job.stage, input_hash: job.input_hash, attempt_id: event.attempt_id, result_schema: stage.result_schema, result, completed_at: at }); clearLease(job);
                if (index + 1 < defined.stages.length) { job.stage = defined.stages[index + 1]!.key; job.status = 'queued'; job.available_at = at; job.progress_completed = 0; job.progress_total = null; await dispatch(tx, job, at); }
                else { job.status = 'succeeded'; job.result = result; }
              }
            }
          }
          await save(tx, job, at); receipt.applied = true; receipt.job_status = job.status;
        }
        const stored: StoredEvent = { job_id: event.job_id, attempt_id: event.attempt_id, event_id: event.event_id, sequence: event.sequence, event_type: event.event_type, stage: event.stage, payload_digest: eventDigest, receipt, created_at: at };
        await tx.insertEvent(stored); return receipt;
      });
    },
    async retryJob(actor: JobActor, jobId: string, input: { row_version: number }, idempotencyKey: string) {
      userActor(actor); integer(input.row_version, 1);
      return options.repository.transaction(async tx => {
        const job = await requireJob(tx, actor, jobId, 'retry');
        return idempotent(tx, actor, 'retry_job', idempotencyKey, { jobId, input }, async () => {
          if (job.row_version !== input.row_version) throw new JobError('STALE_RESOURCE_VERSION', 'Reload this job before retrying.');
          if (job.status !== 'failed' || !job.error?.retryable || job.cancel_requested_at || (job.stage_attempts[job.stage] ?? 0) >= maximumAttempts) throw new JobError('JOB_NOT_RETRYABLE', 'This job is not eligible for retry.');
          const at = now(); job.status = 'queued'; job.error = null; job.available_at = at; clearLease(job); await dispatch(tx, job, at); await save(tx, job, at); return job;
        });
      });
    },
    async cancelJob(actor: JobActor, jobId: string, input: { row_version: number }, idempotencyKey: string) {
      userActor(actor); integer(input.row_version, 1);
      return options.repository.transaction(async tx => {
        const job = await requireJob(tx, actor, jobId, 'cancel');
        return idempotent(tx, actor, 'cancel_job', idempotencyKey, { jobId, input }, async () => {
          if (job.row_version !== input.row_version) throw new JobError('STALE_RESOURCE_VERSION', 'Reload this job before cancelling.');
          if (job.status === 'succeeded') throw new JobError('INVALID_TRANSITION', 'A successful job cannot be cancelled.');
          const at = now(); job.status = 'cancelled'; job.cancel_requested_at ??= at; clearLease(job); await save(tx, job, at); return job;
        });
      });
    },
    async recoverExpired(actor: JobActor, limit = 50) {
      serviceActor(actor); integer(limit, 1, 100); await options.authorizeDispatcher(actor);
      return options.repository.transaction(async tx => {
        const at = now(); const jobs = await tx.listExpiredJobs(at, limit); const recovered: string[] = [];
        for (const job of jobs) { await options.authorizeJob(actor, 'recover', job, tx); if (job.status !== 'running' || !job.lease_expires_at || job.lease_expires_at > at) continue; await failure(tx, job, errorDto('LEASE_EXPIRED'), at); await save(tx, job, at); recovered.push(job.id); }
        return { recovered_ids: recovered };
      });
    },
    async claimOutbox(actor: JobActor, limit = 25): Promise<DispatchLease[]> {
      serviceActor(actor); integer(limit, 1, 100); await options.authorizeDispatcher(actor);
      return options.repository.transaction(async tx => {
        const at = now(); const records = await tx.listDispatchableOutbox(at, limit); const leases: DispatchLease[] = [];
        for (const outbox of records) {
          const job = await requireJob(tx, actor, outbox.job_id, 'dispatch');
          if (!['queued', 'running'].includes(job.status) || job.stage !== outbox.stage || job.dispatch_generation !== outbox.dispatch_generation) { outbox.status = 'dead'; outbox.last_error = { code: 'DISPATCH_OBSOLETE', message: 'This dispatch no longer names the current pending job stage.', details: {}, retryable: false }; outbox.lease_token_digest = null; outbox.lease_expires_at = null; await tx.saveOutbox(outbox); continue; }
          if (outbox.attempt_count >= maximumDispatchAttempts) {
            outbox.status = 'dead'; outbox.last_error = errorDto('DISPATCH_UNAVAILABLE'); outbox.lease_token_digest = null; outbox.lease_expires_at = null;
            if (job.status === 'queued') { job.status = 'failed'; job.error = errorDto('DISPATCH_UNAVAILABLE'); await save(tx, job, at); }
            await tx.saveOutbox(outbox); continue;
          }
          const leaseToken = token(); outbox.attempt_count++; outbox.status = 'leased'; outbox.lease_token_digest = tokenDigest(leaseToken); outbox.lease_expires_at = expires(at); await tx.saveOutbox(outbox);
          leases.push({ id: outbox.id, job_id: outbox.job_id, stage: outbox.stage, input_hash: outbox.input_hash, lease_token: leaseToken, lease_expires_at: outbox.lease_expires_at });
        }
        return leases;
      });
    },
    async acknowledgeOutbox(actor: JobActor, outboxId: string, leaseToken: string) {
      serviceActor(actor); await options.authorizeDispatcher(actor); nonempty(leaseToken, 'lease token', 1024);
      return options.repository.transaction(async tx => {
        const outbox = await tx.getOutboxForUpdate(outboxId); if (!outbox) throw new JobError('RESOURCE_NOT_FOUND', 'Dispatch not found.', 404);
        await requireJob(tx, actor, outbox.job_id, 'dispatch'); const at = now();
        if (outbox.status === 'delivered' && tokenMatches(leaseToken, outbox.lease_token_digest)) return { success: true as const };
        verifyOutboxLease(outbox, leaseToken, at); outbox.status = 'delivered'; outbox.delivered_at = at; outbox.lease_expires_at = null; await tx.saveOutbox(outbox); return { success: true as const };
      });
    },
    async failOutbox(actor: JobActor, outboxId: string, leaseToken: string) {
      serviceActor(actor); await options.authorizeDispatcher(actor); nonempty(leaseToken, 'lease token', 1024);
      return options.repository.transaction(async tx => {
        const outbox = await tx.getOutboxForUpdate(outboxId); if (!outbox) throw new JobError('RESOURCE_NOT_FOUND', 'Dispatch not found.', 404);
        const job = await requireJob(tx, actor, outbox.job_id, 'dispatch'); const at = now(); verifyOutboxLease(outbox, leaseToken, at);
        outbox.last_error = errorDto('DISPATCH_UNAVAILABLE'); outbox.lease_token_digest = null; outbox.lease_expires_at = null;
        if (outbox.attempt_count >= maximumDispatchAttempts) { outbox.status = 'dead'; if (job.status === 'queued' && job.stage === outbox.stage && job.dispatch_generation === outbox.dispatch_generation) { job.status = 'failed'; job.error = errorDto('DISPATCH_UNAVAILABLE'); await save(tx, job, at); } }
        else { outbox.status = 'pending'; outbox.available_at = backoff(at, outbox.attempt_count); }
        await tx.saveOutbox(outbox); return { success: true as const };
      });
    },
  };
}

/** Exact public Job DTO projection. Never serialize internal input, lease digests or stage results. */
export function projectJob(job: JobRecord) {
  return { id: job.id, workspace_id: job.workspace_id, kind: job.kind, status: job.status, stage: job.stage, attempt: job.attempt, progress_completed: job.progress_completed, progress_total: job.progress_total, batch_id: job.batch_id, input_asset_id: job.input_asset_id, resource_id: job.resource_id, error: job.error, created_at: job.created_at, updated_at: job.updated_at, row_version: job.row_version };
}
