import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { JobEvent, JobEventReceipt, JsonObject, StageLease } from '@eps/jobs';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import { integrationErrorToJobFailure } from '../../../packages/integrations/src/job-errors.ts';
import type { OpenAIMediaConfig } from '../../../packages/integrations/src/openai-media.ts';
import { proposeWording, validateWordingInput, validateWordingProposal, type WordingInput } from '../../../packages/integrations/src/openai-wording.ts';
import { WORDING_PROMPT_VERSION } from '../../../packages/integrations/src/prompts/wording-v1.ts';
import { CandidateCallbackError, deliverCandidateCallback } from './candidate-callback.ts';

export interface ReviewStageScope { job_id: string; attempt_id: string; lease_token: string }
export interface ReviewStageGateway {
  getInput(scope: ReviewStageScope, signal: AbortSignal): Promise<unknown>;
  recordEvent(event: JobEvent, signal: AbortSignal): Promise<JobEventReceipt>;
}
export interface ReviewStageOptions {
  openAI: OpenAIMediaConfig; signal?: AbortSignal; heartbeatMs?: number; gatewayTimeoutMs?: number;
  generate?: typeof proposeWording;
}
export class ReviewExecutionError extends Error {
  constructor(readonly code: 'INVALID_STAGE_SCOPE' | 'STAGE_INPUT_INVALID' | 'CALLBACK_UNCONFIRMED' | 'LEASE_STALE' | 'PROCESSING_CANCELLED') {
    super('The wording attempt could not be confirmed. Durable state determines recovery.'); this.name = 'ReviewExecutionError';
  }
}
const stages = ['prepare_suggestion', 'generate_suggestion', 'validate_suggestion'];
const inputKeys = ['input_hash', 'schema_version', 'workspace_id', 'target_type', 'target_id', 'target_row_version', 'capability', 'field', 'instruction', 'source_text', 'budget', 'template', 'configuration'];
const wordingKeys = ['input_hash', 'target_type', 'target_id', 'target_row_version', 'field', 'source_text', 'instruction', 'capability', 'budget', 'template'];
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/u.test(value);
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
function fail(code: ReviewExecutionError['code']): never { throw new ReviewExecutionError(code); }
function wordingInput(value: Record<string, unknown>): WordingInput {
  const picked = Object.fromEntries(wordingKeys.map(key => [key, value[key]]));
  validateWordingInput(picked); return picked;
}

/** Only validated proposals are published. No operation port for assignment,
 * candidate facts, Shortlist, notes, review confirmation or casting exists. */
export async function executeReviewStage(suppliedLease: StageLease, gateway: ReviewStageGateway, options: ReviewStageOptions) {
  let lease: StageLease;
  try { lease = structuredClone(suppliedLease); } catch { return fail('INVALID_STAGE_SCOPE'); }
  if (!lease || !id(lease.job_id) || !stages.includes(lease.stage) || typeof lease.already_completed !== 'boolean') fail('INVALID_STAGE_SCOPE');
  if (lease.already_completed) return { already_completed: true as const, receipt: null };
  if (!id(lease.attempt_id) || typeof lease.lease_token !== 'string' || !/^[^\s\p{C}]{1,1024}$/u.test(lease.lease_token)
    || !Number.isFinite(Date.parse(lease.lease_expires_at)) || Date.parse(lease.lease_expires_at) <= Date.now()
    || !exact(lease.input, inputKeys) || !digest(lease.input.input_hash) || !options.openAI || !id(options.openAI.model)) fail('INVALID_STAGE_SCOPE');
  const timeoutMs = options.gatewayTimeoutMs ?? 15000; const heartbeatMs = options.heartbeatMs ?? 20000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 15000 || !Number.isSafeInteger(heartbeatMs) || heartbeatMs < 10 || heartbeatMs > 20000) fail('INVALID_STAGE_SCOPE');
  const controller = new AbortController(); const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  if (signal.aborted) fail('PROCESSING_CANCELLED');
  const scope: ReviewStageScope = { job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token };
  async function getInput() {
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]); let rejectAbort!: () => void;
    const stopped = new Promise<never>((_resolve, reject) => { rejectAbort = () => reject(new ReviewExecutionError(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'STAGE_INPUT_INVALID')); });
    requestSignal.addEventListener('abort', rejectAbort, { once: true }); if (requestSignal.aborted) rejectAbort();
    try { return await Promise.race([stopped, Promise.resolve().then(() => requestSignal.aborted ? stopped : gateway.getInput(scope, requestSignal))]); }
    catch { return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'STAGE_INPUT_INVALID'); }
    finally { requestSignal.removeEventListener('abort', rejectAbort); }
  }
  const input = await getInput();
  if (!exact(input, [...inputKeys, 'job_id', 'attempt_id', 'stage', 'generated']) || input.job_id !== lease.job_id || input.attempt_id !== lease.attempt_id || input.stage !== lease.stage
    || inputKeys.some(key => !isDeepStrictEqual(input[key], lease.input[key])) || input.schema_version !== '1.0' || !id(input.workspace_id)
    || !exact(input.configuration, ['model', 'prompt_version']) || input.configuration.model !== options.openAI.model || input.configuration.prompt_version !== WORDING_PROMPT_VERSION
    || lease.stage !== 'validate_suggestion' && input.generated !== null) fail('STAGE_INPUT_INVALID');
  let source: WordingInput;
  try { source = wordingInput(input); } catch { return fail('STAGE_INPUT_INVALID'); }
  let sequence = 0; let stopping = false; let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> = Promise.resolve(); let heartbeatError: unknown; let leaseDeadlineMs = Date.parse(lease.lease_expires_at);
  async function publish(fields: Pick<JobEvent, 'event_type'> & Partial<Pick<JobEvent, 'result_schema' | 'result' | 'error'>>) {
    const event: JobEvent = { event_id: randomUUID(), ...scope, stage: lease.stage, input_hash: source.input_hash, sequence: ++sequence, ...fields };
    try {
      // Reuse the proven generic fenced callback protocol; it retries only this
      // identical event and cannot invoke the model or any business operation.
      const sent = await deliverCandidateCallback(event, gateway, { signal, timeoutMs, leaseDeadlineMs });
      if (event.event_type === 'heartbeat') leaseDeadlineMs = Math.max(leaseDeadlineMs, sent.firstSentAt + 90000);
      return sent.receipt;
    } catch (error) { if (error instanceof CandidateCallbackError) return fail(error.code); return fail('CALLBACK_UNCONFIRMED'); }
  }
  function beat() {
    if (stopping) return;
    timer = setTimeout(() => { pending = publish({ event_type: 'heartbeat' }).then(() => { beat(); }).catch(error => { heartbeatError = error; controller.abort(); }); }, heartbeatMs);
  }
  async function stop() { stopping = true; clearTimeout(timer); await pending; if (heartbeatError) throw heartbeatError; }
  beat(); let result: JsonObject; let schema: string;
  try {
    if (lease.stage === 'prepare_suggestion') {
      result = { schema_version: '1.0', target_id: source.target_id, target_row_version: source.target_row_version, field: source.field, source_text: source.source_text };
      schema = 'suggestion-preparation.v1';
    } else {
      const supplied = lease.stage === 'generate_suggestion'
        ? await (options.generate ?? proposeWording)(source, options.openAI, signal)
        : input.generated;
      result = validateWordingProposal(supplied, source, options.openAI.model) as unknown as JsonObject;
      schema = lease.stage === 'generate_suggestion' ? 'contextual-suggestion.v1' : 'suggestion-validation.v1';
    }
  } catch (error) {
    await stop(); if (signal.aborted) return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'LEASE_STALE');
    if (error instanceof ReviewExecutionError) throw error;
    const failure = error instanceof IntegrationError && error.code.startsWith('AI_WORDING_')
      ? { code: 'RESULT_INVALID', message: 'A safe wording proposal could not be validated. Existing text was kept; edit it manually or revise the request.', details: {}, retryable: false }
      : integrationErrorToJobFailure(error);
    return { already_completed: false as const, receipt: await publish({ event_type: 'failed', error: failure }) };
  }
  await stop(); if (signal.aborted) return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'LEASE_STALE');
  return { already_completed: false as const, receipt: await publish({ event_type: 'succeeded', result_schema: schema, result }) };
}
