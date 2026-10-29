import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { JobEvent, JobEventReceipt, JsonObject, StageLease } from '@eps/jobs';
import type { WorkspaceReview } from '../../../packages/domain/src/review-types.ts';
import { workspaceReviewDto } from '../../../packages/central/src/review-dto.ts';
import { CandidateCallbackError, deliverCandidateCallback } from './candidate-callback.ts';
import type { ReviewStageGateway, ReviewStageScope } from './review-stage-executor.ts';
import { measureReviewFit, REVIEW_FIT_RENDERER_VERSION, ReviewFitError, type ReviewFitMeasurement } from './review-fit.ts';

export interface ReviewFitStageOptions { signal?: AbortSignal; heartbeatMs?: number; gatewayTimeoutMs?: number; measure?: typeof measureReviewFit }
export class ReviewFitExecutionError extends Error {
  constructor(readonly code: 'INVALID_STAGE_SCOPE' | 'STAGE_INPUT_INVALID' | 'CALLBACK_UNCONFIRMED' | 'LEASE_STALE' | 'PROCESSING_CANCELLED') { super('Layout measurement could not be confirmed. Durable state determines recovery.'); this.name = 'ReviewFitExecutionError'; }
}
const keys = ['schema_version', 'workspace_id', 'series_id', 'expected_input_fingerprint', 'template', 'configuration', 'input_hash'];
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, fields: readonly string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/u.test(value);
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
function fail(code: ReviewFitExecutionError['code']): never { throw new ReviewFitExecutionError(code); }
function measurement(value: unknown, review: WorkspaceReview): ReviewFitMeasurement {
  if (!exact(value, ['schema_version', 'input_fingerprint', 'template_content_sha256', 'renderer_version', 'chromium_version', 'font_hashes', 'overflows', 'measured_at']) || value.schema_version !== '1.0' || value.input_fingerprint !== review.input_fingerprint || value.template_content_sha256 !== review.template.content_sha256 || value.renderer_version !== REVIEW_FIT_RENDERER_VERSION || typeof value.chromium_version !== 'string' || !/^[0-9]+(?:\.[0-9]+){2,3}$/u.test(value.chromium_version) || !object(value.font_hashes) || Object.keys(value.font_hashes).length !== 6 || Object.entries(value.font_hashes).some(([key, sha]) => !/^apps\/web\/public\/fonts\/IBMPlexSans(?:Arabic)?-(?:Regular|Medium|SemiBold)\.woff2$/u.test(key) || !digest(sha)) || !Array.isArray(value.overflows) || value.overflows.length > 10000 || typeof value.measured_at !== 'string' || value.measured_at.length > 50 || !Number.isFinite(Date.parse(value.measured_at))) fail('STAGE_INPUT_INVALID');
  const fields = ['name_or_id', 'age_or_range', 'height_measurements', 'languages_accents', 'skills_experience', 'city', 'previous_projects_roles', 'classification', 'availability', 'presentation_notes', 'role_name', 'slot_label', 'requirements', 'project_name', 'client_name', 'title', 'layout'];
  for (const overflow of value.overflows) if (!exact(overflow, ['slide_index', 'field', 'axis', 'overflow_px']) || !Number.isSafeInteger(overflow.slide_index) || Number(overflow.slide_index) < 0 || Number(overflow.slide_index) > review.slides.length || !fields.includes(overflow.field as string) || !['horizontal', 'vertical'].includes(overflow.axis as string) || typeof overflow.overflow_px !== 'number' || !Number.isFinite(overflow.overflow_px) || overflow.overflow_px <= 0) fail('STAGE_INPUT_INVALID');
  return value as unknown as ReviewFitMeasurement;
}
export async function executeReviewFitStage(supplied: StageLease, gateway: ReviewStageGateway, options: ReviewFitStageOptions) {
  let lease: StageLease; try { lease = structuredClone(supplied); } catch { return fail('INVALID_STAGE_SCOPE'); }
  if (!lease || !id(lease.job_id) || lease.stage !== 'measure_review_fit' || typeof lease.already_completed !== 'boolean') fail('INVALID_STAGE_SCOPE');
  if (lease.already_completed) return { already_completed: true as const, receipt: null };
  if (!id(lease.attempt_id) || typeof lease.lease_token !== 'string' || !/^[^\s\p{C}]{1,1024}$/u.test(lease.lease_token) || !Number.isFinite(Date.parse(lease.lease_expires_at)) || Date.parse(lease.lease_expires_at) <= Date.now() || !exact(lease.input, keys) || !digest(lease.input.input_hash)) fail('INVALID_STAGE_SCOPE');
  const timeoutMs = options.gatewayTimeoutMs ?? 15000; const heartbeatMs = options.heartbeatMs ?? 20000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 15000 || !Number.isSafeInteger(heartbeatMs) || heartbeatMs < 10 || heartbeatMs > 20000) fail('INVALID_STAGE_SCOPE');
  const controller = new AbortController(); const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  if (signal.aborted) fail('PROCESSING_CANCELLED'); const scope: ReviewStageScope = { job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token };
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]); let abort!: () => void;
  const stopped = new Promise<never>((_resolve, reject) => { abort = () => reject(new ReviewFitExecutionError(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'STAGE_INPUT_INVALID')); requestSignal.addEventListener('abort', abort, { once: true }); if (requestSignal.aborted) abort(); });
  let input: unknown;
  try { input = await Promise.race([stopped, Promise.resolve().then(() => requestSignal.aborted ? stopped : gateway.getInput(scope, requestSignal))]); }
  catch { return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'STAGE_INPUT_INVALID'); } finally { requestSignal.removeEventListener('abort', abort); }
  if (!exact(input, [...keys, 'job_id', 'attempt_id', 'stage', 'review']) || input.job_id !== lease.job_id || input.attempt_id !== lease.attempt_id || input.stage !== lease.stage || keys.some(key => !isDeepStrictEqual(input[key], lease.input[key])) || input.schema_version !== '1.0' || !id(input.workspace_id) || !id(input.series_id) || !digest(input.expected_input_fingerprint) || !exact(input.configuration, ['renderer_version']) || input.configuration.renderer_version !== REVIEW_FIT_RENDERER_VERSION || !object(input.review) || Object.hasOwn(input.review, 'fit')) fail('STAGE_INPUT_INVALID');
  let review: WorkspaceReview;
  try { review = workspaceReviewDto({ ...input.review, can_generate: false, fit: { status: 'unmeasured', input_fingerprint: null, measured_at: null, overflows: [], error_code: 'FIT_MEASUREMENT_REQUIRED' } }); } catch { return fail('STAGE_INPUT_INVALID'); }
  if (review.workspace_id !== input.workspace_id || review.series_id !== input.series_id || review.input_fingerprint !== input.expected_input_fingerprint || !isDeepStrictEqual(review.template, input.template)) fail('STAGE_INPUT_INVALID');
  let sequence = 0; let leaseDeadlineMs = Date.parse(lease.lease_expires_at); let stopping = false; let timer: ReturnType<typeof setTimeout> | undefined; let pending: Promise<void> = Promise.resolve(); let heartbeatError: unknown;
  async function publish(fields: Pick<JobEvent, 'event_type'> & Partial<Pick<JobEvent, 'result_schema' | 'result' | 'error'>>): Promise<JobEventReceipt> {
    const event: JobEvent = { event_id: randomUUID(), ...scope, stage: lease.stage, input_hash: lease.input.input_hash as string, sequence: ++sequence, ...fields };
    try { const sent = await deliverCandidateCallback(event, gateway, { signal, timeoutMs, leaseDeadlineMs }); if (event.event_type === 'heartbeat') leaseDeadlineMs = Math.max(leaseDeadlineMs, sent.firstSentAt + 90000); return sent.receipt; }
    catch (error) { if (error instanceof CandidateCallbackError) return fail(error.code); return fail('CALLBACK_UNCONFIRMED'); }
  }
  function beat() { if (stopping) return; timer = setTimeout(() => { pending = publish({ event_type: 'heartbeat' }).then(() => { beat(); }).catch(error => { heartbeatError = error; controller.abort(); }); }, heartbeatMs); }
  async function stop() { stopping = true; clearTimeout(timer); await pending; if (heartbeatError) throw heartbeatError; }
  if (leaseDeadlineMs - 1000 <= Date.now()) fail('LEASE_STALE'); beat(); let result: ReviewFitMeasurement;
  try { result = measurement(await (options.measure ?? measureReviewFit)(review, { signal }), review); }
  catch (error) {
    await stop(); if (signal.aborted) return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'LEASE_STALE'); if (error instanceof ReviewFitExecutionError) throw error;
    const retryable = !(error instanceof ReviewFitError) || error.code === 'FIT_MEASUREMENT_FAILED';
    return { already_completed: false as const, receipt: await publish({ event_type: 'failed', error: { code: retryable ? 'DEPENDENCY_UNAVAILABLE' : 'PROCESSING_FAILED', message: 'The exact template layout could not be measured. Existing text and casting choices were preserved.', details: {}, retryable } }) };
  }
  await stop(); if (signal.aborted) return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'LEASE_STALE');
  return { already_completed: false as const, receipt: await publish({ event_type: 'succeeded', result_schema: 'review-fit-measurement.v1', result: result as unknown as JsonObject }) };
}
