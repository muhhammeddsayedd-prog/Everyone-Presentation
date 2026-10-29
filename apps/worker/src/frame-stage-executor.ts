import { createHash, randomUUID } from 'node:crypto';
import type { JobEvent, JobEventReceipt, JsonObject, StageLease } from '@eps/jobs';
import { CandidateCallbackError, deliverCandidateCallback } from './candidate-callback.ts';
import { projectCandidateStageFailure, type CandidateStageAssets, type CandidateStageDiagnostic, type CandidateStageGateway, type CandidateStageScope } from './candidate-stage-executor.ts';
import { prepareVideoIsolated } from './video-container.ts';
import { VIDEO_LIMITS, VideoPreparationError, type VideoInput } from './video-types.ts';

export interface FrameStageOptions {
  assets: CandidateStageAssets; imageId: string; signal?: AbortSignal; heartbeatMs?: number; gatewayTimeoutMs?: number;
  onDiagnostic?: (value: CandidateStageDiagnostic) => void; prepare?: typeof prepareVideoIsolated;
}
export class FrameExecutionError extends Error {
  constructor(readonly code: 'INVALID_STAGE_SCOPE' | 'STAGE_INPUT_INVALID' | 'CALLBACK_UNCONFIRMED' | 'LEASE_STALE' | 'PROCESSING_CANCELLED') {
    super('Frame extraction could not be confirmed. Durable job state determines recovery.'); this.name = 'FrameExecutionError';
  }
}
function fail(code: FrameExecutionError['code']): never { throw new FrameExecutionError(code); }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/u.test(value);
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
function asset(value: unknown) {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'asset_id,mime_type,sha256,size_bytes' || !id(value.asset_id) || !hash(value.sha256)
    || !Number.isSafeInteger(value.size_bytes) || Number(value.size_bytes) < 1 || Number(value.size_bytes) > VIDEO_LIMITS.maximumBytes
    || typeof value.mime_type !== 'string') fail('STAGE_INPUT_INVALID');
  return { asset_id: value.asset_id, sha256: value.sha256, size_bytes: value.size_bytes as number, mime_type: value.mime_type };
}
/** No provider port exists in this executor. A failed callback can replay its
 * exact event, but never re-enters native work or repeats an asset write. */
export async function executeFrameStage(suppliedLease: StageLease, gateway: CandidateStageGateway, options: FrameStageOptions) {
  let lease: StageLease; try { lease = structuredClone(suppliedLease); } catch { return fail('INVALID_STAGE_SCOPE'); }
  if (!lease || !id(lease.job_id) || !['extract_frames', 'apply_frames'].includes(lease.stage) || typeof lease.already_completed !== 'boolean') fail('INVALID_STAGE_SCOPE');
  if (lease.already_completed) return { already_completed: true as const, receipt: null };
  if (!id(lease.attempt_id) || typeof lease.lease_token !== 'string' || !/^[^\s\p{C}]{1,1024}$/u.test(lease.lease_token) || !Number.isFinite(Date.parse(lease.lease_expires_at))
    || Date.parse(lease.lease_expires_at) <= Date.now() || !object(lease.input) || !hash(lease.input.input_hash) || !object(lease.input.configuration)) fail('INVALID_STAGE_SCOPE');
  const timeoutMs = options.gatewayTimeoutMs ?? 15_000; const heartbeatMs = options.heartbeatMs ?? 20_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 15_000 || !Number.isSafeInteger(heartbeatMs) || heartbeatMs < 10 || heartbeatMs > 20_000
    || !/^sha256:[a-f0-9]{64}$/u.test(options.imageId)) fail('INVALID_STAGE_SCOPE');
  const controller = new AbortController(); const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  if (signal.aborted) fail('PROCESSING_CANCELLED');
  const scope: CandidateStageScope = { job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token };
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]); let abort!: () => void;
  const interrupted = new Promise<never>((_resolve, reject) => { abort = () => reject(new FrameExecutionError(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'STAGE_INPUT_INVALID')); bounded.addEventListener('abort', abort, { once: true }); if (bounded.aborted) abort(); });
  let input: unknown;
  try { input = await Promise.race([interrupted, Promise.resolve().then(() => { if (bounded.aborted) return interrupted; return gateway.getInput(scope, bounded); })]); }
  catch { return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'STAGE_INPUT_INVALID'); } finally { bounded.removeEventListener('abort', abort); }
  if (!object(input) || Object.keys(input).length !== 9 || input.job_id !== lease.job_id || input.attempt_id !== lease.attempt_id || input.stage !== lease.stage || input.input_hash !== lease.input.input_hash
    || !object(input.configuration) || Object.keys(input.configuration).sort().join(',') !== 'implementation_version,native_image_id' || input.configuration.implementation_version !== 'frame-extraction.v1' || input.configuration.native_image_id !== options.imageId
    || input.configuration.implementation_version !== lease.input.configuration.implementation_version || input.configuration.native_image_id !== lease.input.configuration.native_image_id || input.candidate_media_id !== lease.input.candidate_media_id || !id(input.candidate_media_id)
    || !same(input.timestamps_ms, lease.input.timestamps_ms) || !Array.isArray(input.timestamps_ms) || input.timestamps_ms.length < 1 || input.timestamps_ms.length > 10
    || input.source_duration_ms !== lease.input.source_duration_ms || !Number.isSafeInteger(input.source_duration_ms) || Number(input.source_duration_ms) < 1 || Number(input.source_duration_ms) > VIDEO_LIMITS.maximumDurationMs
    || input.timestamps_ms.some((time, index, values) => !Number.isSafeInteger(time) || Number(time) < 0 || Number(time) >= Number(input.source_duration_ms) || index > 0 && Number(time) <= Number(values[index - 1]))) fail('STAGE_INPUT_INVALID');
  const source = asset(input.source);
  if (source.asset_id !== lease.input.source_asset_id || source.sha256 !== lease.input.source_sha256 || source.size_bytes !== lease.input.source_size_bytes || source.mime_type !== lease.input.source_mime_type
    || !['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'].includes(source.mime_type)) fail('STAGE_INPUT_INVALID');
  let sequence = 0; let leaseDeadlineMs = Date.parse(lease.lease_expires_at); let stopped = false; let timer: ReturnType<typeof setTimeout> | undefined; let pending = Promise.resolve(); let heartbeatError: unknown;
  async function publish(fields: Pick<JobEvent, 'event_type'> & Partial<Pick<JobEvent, 'result_schema' | 'result' | 'error'>>): Promise<JobEventReceipt> {
    const event: JobEvent = { event_id: randomUUID(), ...scope, stage: lease.stage, input_hash: lease.input.input_hash as string, sequence: ++sequence, ...fields };
    try { const result = await deliverCandidateCallback(event, gateway, { signal, timeoutMs, leaseDeadlineMs }); if (event.event_type === 'heartbeat') leaseDeadlineMs = Math.max(leaseDeadlineMs, result.firstSentAt + 90_000); return result.receipt; }
    catch (error) { return fail(error instanceof CandidateCallbackError ? error.code : 'CALLBACK_UNCONFIRMED'); }
  }
  function beat() { if (stopped) return; timer = setTimeout(() => { pending = publish({ event_type: 'heartbeat' }).then(() => { beat(); }).catch(error => { heartbeatError = error; controller.abort(); }); }, heartbeatMs); }
  async function stop() { stopped = true; clearTimeout(timer); await pending; if (heartbeatError) throw heartbeatError; }
  beat(); let operation: CandidateStageDiagnostic['operation'] = 'read_source'; let result: JsonObject;
  try {
    if (lease.stage === 'apply_frames') result = { source_asset_id: source.asset_id };
    else {
      const bytes = await options.assets.read(scope, source, signal);
      if (!(bytes instanceof Uint8Array) || bytes.length !== source.size_bytes || sha(bytes) !== source.sha256) throw new VideoPreparationError('VIDEO_SOURCE_INVALID');
      if (signal.aborted) fail('PROCESSING_CANCELLED');
      operation = 'extract_frames'; const prepared = await (options.prepare ?? prepareVideoIsolated)({ source_asset_id: source.asset_id, mime_type: source.mime_type as VideoInput['mime_type'], bytes }, { imageId: options.imageId, signal, timestampsMs: input.timestamps_ms as number[] });
      if (prepared.source_asset_id !== source.asset_id || prepared.source_sha256 !== source.sha256 || prepared.audio_chunks.length || !prepared.display_geometry || prepared.probe.duration_ms !== input.source_duration_ms) fail('STAGE_INPUT_INVALID');
      if (signal.aborted) fail('PROCESSING_CANCELLED');
      if (prepared.sampled_frames.length > 10 || prepared.sampled_frames.some(frame => !(input.timestamps_ms as number[]).includes(frame.requested_timestamp_ms!))) fail('STAGE_INPUT_INVALID');
      if (!prepared.sampled_frames.length && prepared.warnings.includes('FRAME_PREPARATION_FAILED')) throw new VideoPreparationError('VIDEO_DECODE_FAILED');
      const frames: JsonObject[] = []; const requests: JsonObject[] = []; const saved = new Map<string, JsonObject>();
      for (const time of input.timestamps_ms as number[]) {
        const actual = prepared.sampled_frames.filter(frame => frame.requested_timestamp_ms === time); if (actual.length > 1) fail('STAGE_INPUT_INVALID'); const frame = actual[0];
        if (!frame) { requests.push({ requested_timestamp_ms: time, frame_asset_id: null, actual_timestamp_ms: null, unavailable_reason: 'FRAME_TIMESTAMP_UNAVAILABLE' }); continue; }
        if (frame.source_asset_id !== source.asset_id || frame.timestamp_ms < time || frame.timestamp_ms >= Number(input.source_duration_ms) || sha(frame.bytes) !== frame.sha256) fail('STAGE_INPUT_INVALID');
        const key = `${frame.timestamp_ms}:${frame.sha256}`; let reference = saved.get(key);
        if (!reference) {
          if (signal.aborted) fail('PROCESSING_CANCELLED');
          operation = 'write_frame'; const output = asset(await options.assets.write(scope, { purpose: 'candidate_frame', output_key: `frame_${frames.length}`, source_asset_id: source.asset_id, mime_type: 'image/jpeg', sha256: frame.sha256, bytes: frame.bytes, timestamp_ms: frame.timestamp_ms, width: frame.width, height: frame.height, duration_ms: null }, signal));
          if (output.sha256 !== frame.sha256 || output.size_bytes !== frame.bytes.length || output.mime_type !== 'image/jpeg') fail('STAGE_INPUT_INVALID');
          reference = { ...output, source_asset_id: source.asset_id, timestamp_ms: frame.timestamp_ms, width: frame.width, height: frame.height, quality_flags: frame.quality_flags }; saved.set(key, reference); frames.push(reference);
        }
        requests.push({ requested_timestamp_ms: time, frame_asset_id: reference.asset_id, actual_timestamp_ms: frame.timestamp_ms, unavailable_reason: null });
      }
      const warnings = prepared.warnings.filter(warning => !['FRAME_TIMESTAMP_SHARED', 'FRAME_TIMESTAMP_UNAVAILABLE'].includes(warning));
      if (requests.some(request => request.frame_asset_id === null)) warnings.push('FRAME_TIMESTAMP_UNAVAILABLE');
      if (requests.filter(request => request.frame_asset_id !== null).length > frames.length) warnings.push('FRAME_TIMESTAMP_SHARED');
      result = { source_asset_id: source.asset_id, source_sha256: source.sha256, frames, requests, warnings, implementation_version: 'frame-extraction.v1', native_image_id: options.imageId, ffmpeg_version: prepared.ffmpeg_version, display_geometry: prepared.display_geometry as unknown as JsonObject };
    }
  } catch (error) {
    await stop(); if (signal.aborted) return fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'LEASE_STALE'); if (error instanceof FrameExecutionError) throw error;
    try { options.onDiagnostic?.({ job_id: lease.job_id, attempt_id: lease.attempt_id, stage: lease.stage, input_hash: String(lease.input.input_hash), operation, ...projectCandidateStageFailure(error) }); } catch { /* Observer cannot change outcome. */ }
    const unreadable = error instanceof VideoPreparationError && ['VIDEO_UNREADABLE', 'VIDEO_TYPE_UNSUPPORTED', 'VIDEO_DECODE_FAILED'].includes(error.code);
    const retryable = error instanceof VideoPreparationError && ['VIDEO_ASSET_TRANSFER_FAILED', 'VIDEO_PREPARATION_BUSY'].includes(error.code) && error.retryable;
    return { already_completed: false as const, receipt: await publish({ event_type: 'failed', error: { code: unreadable ? 'SOURCE_UNREADABLE' : retryable ? 'DEPENDENCY_UNAVAILABLE' : 'PROCESSING_FAILED', message: 'Chosen-frame extraction could not complete. Existing material was preserved.', details: {}, retryable } }) };
  }
  await stop(); if (signal.aborted) return fail('PROCESSING_CANCELLED');
  return { already_completed: false as const, receipt: await publish({ event_type: 'succeeded', result_schema: lease.stage === 'extract_frames' ? 'frame-extraction-stage.v1' : 'frame-application.v1', result }) };
}
