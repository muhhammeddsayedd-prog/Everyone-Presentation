import { createHash, randomUUID } from 'node:crypto';
import type { JobEvent, JobEventReceipt, JsonObject, StageLease } from '@eps/jobs';
import { analyzeAppearance, type AppearanceImage, type AppearanceDetail } from '../../../packages/integrations/src/openai-appearance.ts';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import type { OpenAIMediaConfig } from '../../../packages/integrations/src/openai-media.ts';
import { CandidateCallbackError, deliverCandidateCallback } from './candidate-callback.ts';

/** candidate_appearance / analyze_appearance: read the frozen authorised photos/frames through scoped read grants, send
 * them once to the configured model, and post the validated result through the existing job-event path. The database
 * apply validates the result again and never overwrites human-reviewed observations. No video is reprocessed here. */
export interface AppearanceStageScope { job_id: string; attempt_id: string; lease_token: string }
export interface AppearanceFilesPort {
  getAssetAccess(input: AppearanceStageScope & { asset_id: string }, signal: AbortSignal): Promise<{ asset_id: string; url: string; method: 'GET'; headers: Record<string, string>;
    expires_at: string; mime_type: string; size_bytes: number; sha256: string }>;
}
export interface AppearanceStageGateway { getInput(scope: AppearanceStageScope, signal: AbortSignal): Promise<unknown>; recordEvent(event: JobEvent, signal: AbortSignal): Promise<JobEventReceipt> }
export interface AppearanceStageOptions {
  openAI: OpenAIMediaConfig; files: AppearanceFilesPort; detail?: AppearanceDetail; signal?: AbortSignal; heartbeatMs?: number; gatewayTimeoutMs?: number;
  /** Offline seams only. */ fetch?: typeof fetch; analyze?: typeof analyzeAppearance;
  onMetadata?: (value: Record<string, unknown>) => void;
}
export class AppearanceExecutionError extends Error {
  constructor(readonly code: 'INVALID_STAGE_SCOPE' | 'STAGE_INPUT_INVALID' | 'CALLBACK_UNCONFIRMED' | 'LEASE_STALE' | 'PROCESSING_CANCELLED') { super('Appearance analysis could not be confirmed. Durable state determines recovery.'); this.name = 'AppearanceExecutionError'; }
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function fail(code: AppearanceExecutionError['code']): never { throw new AppearanceExecutionError(code); }
const INPUT_KEYS = ['schema_version', 'batch_id', 'item_id', 'candidate_id', 'configuration', 'media', 'input_hash', 'job_id', 'attempt_id', 'stage'];
const MEDIA_KEYS = ['media_ref', 'asset_id', 'source_kind', 'candidate_media_id', 'frame_timestamp_ms', 'mime_type', 'size_bytes', 'sha256', 'width', 'height'];
interface FrozenMedia { media_ref: string; asset_id: string; source_kind: 'photo' | 'frame'; frame_timestamp_ms: number | null; size_bytes: number; sha256: string }
export function parseAppearanceStageInput(value: unknown, lease: StageLease): { model: string; candidate_id: string; media: FrozenMedia[] } {
  if (!exact(value, INPUT_KEYS) || value.schema_version !== '1.0' || value.job_id !== lease.job_id || value.attempt_id !== lease.attempt_id || value.stage !== 'analyze_appearance'
    || value.input_hash !== lease.input.input_hash || typeof value.candidate_id !== 'string' || !UUID.test(value.candidate_id)
    || !exact(value.configuration, ['model', 'prompt_version', 'schema_version', 'taxonomy_version', 'max_images']) || value.configuration.prompt_version !== 'appearance-v1'
    || value.configuration.taxonomy_version !== 'appearance-taxonomy.v1' || typeof value.configuration.model !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/u.test(value.configuration.model)
    || !Array.isArray(value.media) || !value.media.length || value.media.length > 12) fail('STAGE_INPUT_INVALID');
  const media = (value.media as unknown[]).map((entry, index) => {
    if (!exact(entry, MEDIA_KEYS) || entry.media_ref !== `m${index + 1}` || typeof entry.asset_id !== 'string' || !UUID.test(entry.asset_id) || !['photo', 'frame'].includes(String(entry.source_kind))
      || entry.mime_type !== 'image/jpeg' || !Number.isSafeInteger(entry.size_bytes) || Number(entry.size_bytes) < 1 || Number(entry.size_bytes) > 5 * 1024 * 1024
      || typeof entry.sha256 !== 'string' || !HASH.test(entry.sha256) || (entry.source_kind === 'frame' ? !Number.isSafeInteger(entry.frame_timestamp_ms) : entry.frame_timestamp_ms !== null)) fail('STAGE_INPUT_INVALID');
    return { media_ref: entry.media_ref as string, asset_id: entry.asset_id as string, source_kind: entry.source_kind as 'photo' | 'frame', frame_timestamp_ms: entry.frame_timestamp_ms as number | null,
      size_bytes: Number(entry.size_bytes), sha256: entry.sha256 as string };
  });
  return { model: value.configuration.model as string, candidate_id: value.candidate_id as string, media };
}
class ReadError extends Error { constructor() { super('A stored image could not be read or failed verification.'); } }
async function readImage(access: Awaited<ReturnType<AppearanceFilesPort['getAssetAccess']>>, expected: FrozenMedia, fetcher: typeof fetch, signal: AbortSignal): Promise<Uint8Array> {
  if (access.asset_id !== expected.asset_id || access.method !== 'GET' || access.mime_type !== 'image/jpeg' || access.size_bytes !== expected.size_bytes || access.sha256 !== expected.sha256
    || !access.url.startsWith('https://pyibofyctwnqpvktepse.supabase.co/storage/v1/object/authenticated/eps-candidate-')) throw new ReadError();
  const response = await fetcher(access.url, { method: 'GET', headers: { ...access.headers, 'Accept-Encoding': 'identity' }, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
  try {
    if (response.status !== 200 || (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'image/jpeg') throw new ReadError();
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== expected.size_bytes || createHash('sha256').update(bytes).digest('hex') !== expected.sha256 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new ReadError();
    return bytes;
  } finally { void response.body?.cancel().catch(() => undefined); }
}
function failure(error: unknown): { code: string; message: string; details: JsonObject; retryable: boolean } {
  const usage: JsonObject = error instanceof IntegrationError && Number.isSafeInteger(error.details.input_tokens) ? { usage: { input_tokens: Number(error.details.input_tokens), output_tokens: Number(error.details.output_tokens ?? 0) } } : {};
  if (error instanceof ReadError) return { code: 'DEPENDENCY_UNAVAILABLE', message: 'A stored image could not be read. Existing observations were kept.', details: {}, retryable: true };
  if (!(error instanceof IntegrationError)) return { code: 'PROCESSING_FAILED', message: 'Appearance analysis failed. Existing observations were kept.', details: {}, retryable: false };
  if (error.code === 'OPENAI_RATE_LIMITED') return { code: 'PROVIDER_RATE_LIMITED', message: 'The provider is temporarily rate limited.', details: usage, retryable: true };
  if (['OPENAI_UNAVAILABLE', 'OPENAI_TIMEOUT'].includes(error.code)) return { code: 'DEPENDENCY_UNAVAILABLE', message: 'The provider is temporarily unavailable.', details: usage, retryable: true };
  if (error.code === 'AI_APPEARANCE_RESULT_INVALID') return { code: 'RESULT_INVALID', message: 'The analysis result failed validation. Existing observations were kept.', details: usage, retryable: false };
  return { code: 'PROCESSING_FAILED', message: 'Appearance analysis did not complete. Existing observations were kept.', details: usage, retryable: false };
}
export async function executeAppearanceStage(supplied: StageLease, gateway: AppearanceStageGateway, options: AppearanceStageOptions) {
  let lease: StageLease; try { lease = structuredClone(supplied); } catch { return fail('INVALID_STAGE_SCOPE'); }
  if (!lease || lease.stage !== 'analyze_appearance' || typeof lease.already_completed !== 'boolean' || !UUID.test(String(lease.job_id))) fail('INVALID_STAGE_SCOPE');
  if (lease.already_completed) return { already_completed: true as const, receipt: null };
  if (!UUID.test(String(lease.attempt_id)) || typeof lease.lease_token !== 'string' || !HASH.test(lease.lease_token) || !Number.isFinite(Date.parse(lease.lease_expires_at))
    || Date.parse(lease.lease_expires_at) <= Date.now() || !object(lease.input) || typeof lease.input.input_hash !== 'string' || !HASH.test(lease.input.input_hash)) fail('INVALID_STAGE_SCOPE');
  const timeoutMs = options.gatewayTimeoutMs ?? 15_000; const heartbeatMs = options.heartbeatMs ?? 20_000;
  const controller = new AbortController(); const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  if (signal.aborted) fail('PROCESSING_CANCELLED');
  const scope: AppearanceStageScope = { job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token };
  let input: ReturnType<typeof parseAppearanceStageInput>;
  try { input = parseAppearanceStageInput(await gateway.getInput(scope, AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])), lease); }
  catch (error) { if (error instanceof AppearanceExecutionError) throw error; return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'STAGE_INPUT_INVALID'); }
  let sequence = 0; let leaseDeadlineMs = Date.parse(lease.lease_expires_at); let stopping = false; let timer: ReturnType<typeof setTimeout> | undefined; let pending: Promise<void> = Promise.resolve(); let heartbeatError: unknown;
  async function publish(fields: Pick<JobEvent, 'event_type'> & Partial<Pick<JobEvent, 'result_schema' | 'result' | 'error'>>): Promise<JobEventReceipt> {
    const event: JobEvent = { event_id: randomUUID(), ...scope, stage: 'analyze_appearance', input_hash: lease.input.input_hash as string, sequence: ++sequence, ...fields };
    try { const sent = await deliverCandidateCallback(event, gateway, { signal, timeoutMs, leaseDeadlineMs }); if (event.event_type === 'heartbeat') leaseDeadlineMs = Math.max(leaseDeadlineMs, sent.firstSentAt + 90_000); return sent.receipt; }
    catch (error) { if (error instanceof CandidateCallbackError) return fail(error.code); return fail('CALLBACK_UNCONFIRMED'); }
  }
  function beat() { if (stopping) return; timer = setTimeout(() => { pending = publish({ event_type: 'heartbeat' }).then(() => { beat(); }).catch(error => { heartbeatError = error; controller.abort(); }); }, heartbeatMs); }
  async function stop() { stopping = true; clearTimeout(timer); await pending; if (heartbeatError) throw heartbeatError; }
  if (leaseDeadlineMs - 1000 <= Date.now()) fail('LEASE_STALE');
  // The job froze the model at enqueue time; a worker configured with another model must not answer for it.
  if (input.model !== options.openAI.model) return { already_completed: false as const, receipt: await publish({ event_type: 'failed', error: { code: 'PROCESSING_FAILED',
    message: 'The worker model does not match the model frozen for this analysis. Existing observations were kept.', details: {}, retryable: false } }) };
  beat();
  try {
    const images: AppearanceImage[] = [];
    for (const media of input.media) {
      const access = await options.files.getAssetAccess({ ...scope, asset_id: media.asset_id }, AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])).catch(() => { throw new ReadError(); });
      images.push({ media_ref: media.media_ref, asset_id: media.asset_id, source_kind: media.source_kind, frame_timestamp_ms: media.frame_timestamp_ms, sha256: media.sha256,
        bytes: await readImage(access, media, options.fetch ?? fetch, signal) });
    }
    const { result, metadata } = await (options.analyze ?? analyzeAppearance)({ candidate_ref: input.candidate_id, input_hash: lease.input.input_hash as string, images, ...(options.detail ? { detail: options.detail } : {}) }, options.openAI, signal);
    try { options.onMetadata?.({ job_id: lease.job_id, ...metadata }); } catch { /* Observability cannot change the result. */ }
    await stop(); if (signal.aborted) return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'LEASE_STALE');
    return { already_completed: false as const, receipt: await publish({ event_type: 'succeeded', result_schema: 'candidate-appearance-result.v1', result: result as unknown as JsonObject }) };
  } catch (error) {
    await stop(); if (signal.aborted) return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'LEASE_STALE');
    if (error instanceof AppearanceExecutionError) throw error;
    return { already_completed: false as const, receipt: await publish({ event_type: 'failed', error: failure(error) }) };
  }
}
