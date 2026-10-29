import { createHash, randomUUID } from 'node:crypto';
import type { JobEvent, JobEventReceipt, JsonObject, StageLease } from '@eps/jobs';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import { integrationErrorToJobFailure } from '../../../packages/integrations/src/job-errors.ts';
import { extractCandidate, transcribeAudio, type OpenAIMediaConfig } from '../../../packages/integrations/src/openai-media.ts';
import type { TranscriptSource } from '../../../packages/integrations/src/media-types.ts';
import { validateFrameSelection } from '../../../packages/integrations/src/media-schema.ts';
import { prepareVideoIsolated } from './video-container.ts';
import { selectRealFrames } from './video-quality.ts';
import { VIDEO_LIMITS, VideoPreparationError, type RealFrame, type VideoInput, type VideoProbe } from './video-types.ts';
import { CandidateCallbackError, deliverCandidateCallback } from './candidate-callback.ts';
import { SpecsRuntimeGatewayError, specsRuntimeFailureDiagnostics } from '@eps/central/specs-runtime';

export interface CandidateStageScope { job_id: string; attempt_id: string; lease_token: string }
export interface CandidateStageAsset { asset_id: string; sha256: string; size_bytes: number; mime_type: string }
export interface CandidateSourceAsset extends Omit<CandidateStageAsset, 'sha256'> { sha256: string | null }
export interface CandidateStageAssets {
  /** Adapter verifies active lease, exact asset scope and original/derivative ownership. */
  read(scope: CandidateStageScope, asset: CandidateSourceAsset, signal: AbortSignal, options?: { preparingOriginal: true }): Promise<Uint8Array>;
  /** Adapter reserves, uploads, verifies checksum/body and finalizes a new immutable
   * private asset under this lease. No arbitrary object destination is accepted. */
  write(scope: CandidateStageScope, output: { purpose: 'audio' | 'candidate_frame' | 'transcript'; output_key: string; source_asset_id: string; mime_type: string; sha256: string; bytes: Uint8Array;
    timestamp_ms: number | null; width: number | null; height: number | null; duration_ms: number | null }, signal: AbortSignal): Promise<CandidateStageAsset>;
}
export interface PreparedMediaReferences {
  source_asset_id: string; source_sha256: string; probe: VideoProbe;
  audio_chunks: (CandidateStageAsset & { index: number; start_ms: number; end_ms: number })[];
  sampled_frames: Omit<RealFrame, 'bytes'>[]; warnings: string[];
  implementation_version: 'video-preparation.v1'; ffmpeg_version: string;
}
export interface CandidateStageGateway {
  getInput(scope: CandidateStageScope, signal: AbortSignal): Promise<unknown>;
  recordEvent(event: JobEvent, signal: AbortSignal): Promise<JobEventReceipt>;
}
type CandidateStageOperation = 'validate_stage_input' | 'read_source' | 'prepare_media' | 'write_audio' | 'write_frame' | 'read_audio' | 'transcribe_audio' | 'write_transcript' | 'read_transcript' | 'extract_facts' | 'select_frames' | 'prepare_application';
export interface CandidateStageDiagnostic {
  job_id: string; attempt_id: string; stage: string; input_hash: string; operation: CandidateStageOperation;
  error_kind: 'native' | 'integration' | 'gateway' | 'javascript' | 'unknown'; code: string;
  gateway_outcome?: 'known' | 'unknown' | 'unconfirmed'; gateway_phase?: string; transport_code?: string;
}
export interface CandidateStageOptions { assets: CandidateStageAssets; imageId: string; transcription: OpenAIMediaConfig; extraction: OpenAIMediaConfig;
  signal?: AbortSignal; heartbeatMs?: number; gatewayTimeoutMs?: number;
  onDiagnostic?: (value: CandidateStageDiagnostic) => void;
  prepare?: typeof prepareVideoIsolated; transcribe?: typeof transcribeAudio; extract?: typeof extractCandidate }
export class CandidateExecutionError extends Error {
  constructor(readonly code: 'INVALID_STAGE_SCOPE' | 'STAGE_INPUT_INVALID' | 'CALLBACK_UNCONFIRMED' | 'LEASE_STALE' | 'PROCESSING_CANCELLED') { super('The candidate attempt could not be confirmed. Durable state determines recovery.'); this.name = 'CandidateExecutionError'; }
}
function fail(code: CandidateExecutionError['code']): never { throw new CandidateExecutionError(code); }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/u.test(value);
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const stages = ['prepare_candidate', 'transcribe_candidate', 'extract_candidate', 'select_frames', 'apply_candidate'];
const videoDiagnosticCodes = new Set(['VIDEO_ASSET_CAPABILITY_INVALID', 'VIDEO_ASSET_TRANSFER_FAILED', 'VIDEO_CONTAINER_CLEANUP_FAILED',
  'VIDEO_CONTAINER_CONFIGURATION_INVALID', 'VIDEO_CONTAINER_IMAGE_INVALID', 'VIDEO_CONTAINER_INSPECTION_FAILED', 'VIDEO_CONTAINER_OWNERSHIP_INVALID',
  'VIDEO_CONTAINER_UNAVAILABLE', 'VIDEO_CONTAINER_REQUIRED', 'VIDEO_LIMIT_EXCEEDED', 'VIDEO_OUTPUT_LIMIT', 'VIDEO_PREPARATION_BUSY',
  'VIDEO_PREPARATION_CANCELLED', 'VIDEO_PROCESS_FAILED', 'VIDEO_PROCESS_TIMEOUT', 'VIDEO_TIMESTAMP_INVALID', 'VIDEO_DECODE_FAILED',
  'VIDEO_FRAME_INVALID', 'VIDEO_SOURCE_INVALID', 'VIDEO_TEMP_OWNERSHIP_INVALID', 'VIDEO_TOOL_UNAVAILABLE', 'VIDEO_TYPE_UNSUPPORTED', 'VIDEO_UNREADABLE']);
const videoSourceCodes = new Set(['VIDEO_TYPE_UNSUPPORTED', 'VIDEO_UNREADABLE', 'VIDEO_DECODE_FAILED', 'VIDEO_LIMIT_EXCEEDED', 'VIDEO_TIMESTAMP_INVALID']);
const integrationDiagnosticCodes = new Set(['MEDIA_ASSET_INVALID', 'OPENAI_CONFIGURATION_INVALID', 'TRANSCRIPTION_SOURCE_INVALID', 'TRANSCRIPTION_RESULT_INVALID', 'TRANSCRIPTION_EMPTY',
  'CANDIDATE_SOURCE_INVALID', 'AI_REFUSAL', 'AI_RESULT_INVALID', 'AI_EVIDENCE_INVALID', 'AI_EVIDENCE_MISSING', 'AI_SOURCE_MISMATCH', 'AI_RESPONSE_INVALID', 'AI_RESPONSE_INCOMPLETE', 'AI_RESPONSE_NOT_COMPLETE', 'AI_OUTPUT_UNEXPECTED', 'AI_FRAME_RESULT_INVALID', 'AI_FRAME_REFERENCE_INVALID',
  'PROCESSING_CANCELLED', 'OPENAI_TIMEOUT', 'OPENAI_ACCESS_DENIED', 'OPENAI_QUOTA_EXCEEDED', 'OPENAI_RATE_LIMITED', 'OPENAI_REQUEST_REJECTED', 'OPENAI_UNAVAILABLE']);
const gatewayDiagnosticCodes = new Set(['INVALID_REQUEST', 'RESOURCE_NOT_FOUND', 'CAPABILITY_REQUIRED', 'LEASE_INVALID', 'INPUT_CHANGED', 'INPUT_HASH_MISMATCH', 'JOB_CANCELLED',
  'JOB_ALREADY_RUNNING', 'JOB_NOT_AVAILABLE', 'RETRY_EXHAUSTED', 'STAGE_OUT_OF_ORDER', 'STAGE_STATE_INVALID', 'STALE_STAGE_LEASE', 'EVENT_ID_CONFLICT', 'EVENT_SEQUENCE_CONFLICT', 'RESULT_INVALID', 'INVALID_TRANSITION',
  'FEATURE_NOT_IMPLEMENTED', 'DEPENDENCY_UNAVAILABLE', 'SLOT_ALLOCATION_LIMIT_EXCEEDED', 'IDEMPOTENCY_KEY_REUSED', 'SPECS_STATE_INVALID', 'CLAIM_REPLAY_KEY_UNAVAILABLE',
  'RUNTIME_CONFIG_INVALID', 'RUNTIME_AUTH_UNVERIFIED', 'RUNTIME_ROLE_UNVERIFIED', 'RUNTIME_UNAVAILABLE', 'RUNTIME_RESPONSE_INVALID', 'RUNTIME_ABORTED', 'RUNTIME_CLOSED']);
function diagnostic(error: unknown): Pick<CandidateStageDiagnostic, 'error_kind' | 'code' | 'gateway_outcome' | 'gateway_phase' | 'transport_code'> {
  try {
    if (error instanceof VideoPreparationError) { const code = error.code; return { error_kind: 'native', code: videoDiagnosticCodes.has(code) ? code : 'VIDEO_FAILURE_UNCONFIRMED' }; }
    if (error instanceof IntegrationError) { const code = error.code; return { error_kind: 'integration', code: integrationDiagnosticCodes.has(code) ? code : 'INTEGRATION_FAILURE_UNCONFIRMED' }; }
    if (error instanceof SpecsRuntimeGatewayError) {
      const code = error.code; const outcome = error.outcome; const safe = specsRuntimeFailureDiagnostics(error);
      return { error_kind: 'gateway', code: gatewayDiagnosticCodes.has(code) ? code : 'GATEWAY_FAILURE_UNCONFIRMED', gateway_outcome: outcome === 'known' || outcome === 'unknown' ? outcome : 'unconfirmed',
        ...(safe.gateway_phase ? { gateway_phase: safe.gateway_phase } : {}), ...(safe.transport_code ? { transport_code: safe.transport_code } : {}) };
    }
    for (const [type, code] of [[TypeError, 'JS_TYPE_ERROR'], [RangeError, 'JS_RANGE_ERROR'], [SyntaxError, 'JS_SYNTAX_ERROR'], [ReferenceError, 'JS_REFERENCE_ERROR'], [URIError, 'JS_URI_ERROR'], [EvalError, 'JS_EVAL_ERROR'], [Error, 'JS_ERROR']] as const)
      if (error instanceof type) return { error_kind: 'javascript', code };
  } catch { /* Hostile getters cannot add private properties or defeat redaction. */ }
  return { error_kind: 'unknown', code: 'CANDIDATE_FAILURE_UNCONFIRMED' };
}
function asset(value: unknown): CandidateStageAsset {
  if (!object(value) || !id(value.asset_id) || !digest(value.sha256) || typeof value.size_bytes !== 'number' || !Number.isSafeInteger(value.size_bytes) || value.size_bytes < 1 || value.size_bytes > VIDEO_LIMITS.maximumBytes || typeof value.mime_type !== 'string' || value.mime_type.length > 100) fail('STAGE_INPUT_INVALID');
  return { asset_id: value.asset_id, sha256: value.sha256, size_bytes: value.size_bytes, mime_type: value.mime_type };
}
function preparedReferences(value: unknown, source: CandidateSourceAsset): PreparedMediaReferences {
  if (!object(value) || value.source_asset_id !== source.asset_id || value.source_sha256 !== source.sha256 || !object(value.probe)
    || !Array.isArray(value.audio_chunks) || value.audio_chunks.length > VIDEO_LIMITS.maximumChunks || !Array.isArray(value.sampled_frames) || value.sampled_frames.length > VIDEO_LIMITS.maximumSamples
    || !Array.isArray(value.warnings) || value.warnings.some(warning => typeof warning !== 'string' || !/^[A-Z_]{1,100}$/u.test(warning))
    || value.implementation_version !== 'video-preparation.v1' || typeof value.ffmpeg_version !== 'string') fail('STAGE_INPUT_INVALID');
  const duration = value.probe.duration_ms;
  if (typeof duration !== 'number' || !Number.isSafeInteger(duration) || duration < 1 || duration > VIDEO_LIMITS.maximumDurationMs) fail('STAGE_INPUT_INVALID');
  for (const [index, raw] of value.audio_chunks.entries()) { asset(raw); if (!object(raw) || raw.index !== index || raw.mime_type !== 'audio/mpeg' || typeof raw.start_ms !== 'number' || !Number.isSafeInteger(raw.start_ms) || raw.start_ms < 0
    || typeof raw.end_ms !== 'number' || !Number.isSafeInteger(raw.end_ms) || raw.end_ms <= raw.start_ms || raw.end_ms > duration || Number(raw.size_bytes) > VIDEO_LIMITS.maximumAudioChunkBytes) fail('STAGE_INPUT_INVALID'); }
  const seen = new Set();
  for (const frame of value.sampled_frames) { if (!object(frame) || !id(frame.frame_asset_id) || seen.has(frame.frame_asset_id) || frame.source_asset_id !== source.asset_id || !digest(frame.sha256)
    || typeof frame.timestamp_ms !== 'number' || !Number.isSafeInteger(frame.timestamp_ms) || frame.timestamp_ms < 0 || frame.timestamp_ms >= duration
    || !object(frame.quality) || typeof frame.quality.difference_hash !== 'string' || !/^[a-f0-9]{16}$/u.test(frame.quality.difference_hash)
    || !['luminance', 'contrast', 'sharpness'].every(key => object(frame.quality) && typeof frame.quality[key] === 'number' && Number.isFinite(frame.quality[key]))) fail('STAGE_INPUT_INVALID'); seen.add(frame.frame_asset_id); }
  return structuredClone(value) as unknown as PreparedMediaReferences;
}
async function checkedRead(port: CandidateStageAssets, scope: CandidateStageScope, reference: CandidateSourceAsset, signal: AbortSignal, options?: { preparingOriginal: true }) {
  // Prepared chunks carry timing/index metadata; the capability port accepts
  // only an asset reference and independently validates that exact boundary.
  const readReference = { asset_id: reference.asset_id, sha256: reference.sha256, size_bytes: reference.size_bytes, mime_type: reference.mime_type };
  const bytes = await port.read(scope, readReference, signal, options);
  if (!(bytes instanceof Uint8Array) || bytes.length !== reference.size_bytes || reference.sha256 !== null && sha(bytes) !== reference.sha256) throw new IntegrationError('MEDIA_ASSET_INVALID', 'The private media asset failed checksum verification.'); return bytes;
}
function transcript(bytes: Uint8Array, sourceAssetId: string): TranscriptSource {
  if (bytes.length > 2_000_000) fail('STAGE_INPUT_INVALID'); let value: unknown; try { value = JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { fail('STAGE_INPUT_INVALID'); }
  if (!object(value) || value.source_asset_id !== sourceAssetId || !Array.isArray(value.segments) || value.segments.length > 1000 || !value.segments.length
    || value.segments.some((segment, index) => !object(segment) || segment.index !== index || typeof segment.text !== 'string' || segment.text.length > 200_000 || typeof segment.start_ms !== 'number' || !Number.isSafeInteger(segment.start_ms) || segment.start_ms < 0 || typeof segment.end_ms !== 'number' || !Number.isSafeInteger(segment.end_ms) || segment.end_ms <= segment.start_ms)) fail('STAGE_INPUT_INVALID');
  return value as unknown as TranscriptSource;
}
/** Execute one authenticated, already-claimed stage. No queue, SQL connection,
 * permission fallback, provider retry or cloud workflow mutation lives here. */
export async function executeCandidateStage(lease: StageLease, gateway: CandidateStageGateway, options: CandidateStageOptions) {
  try { lease = structuredClone(lease); } catch { fail('INVALID_STAGE_SCOPE'); }
  if (!lease || !id(lease.job_id) || !stages.includes(lease.stage) || typeof lease.already_completed !== 'boolean') fail('INVALID_STAGE_SCOPE');
  if (lease.already_completed) return { already_completed: true as const, receipt: null };
  if (!id(lease.attempt_id) || typeof lease.lease_token !== 'string' || !lease.lease_token || lease.lease_token.length > 1024 || /[\s\p{C}]/u.test(lease.lease_token)
    || !Number.isFinite(Date.parse(lease.lease_expires_at)) || Date.parse(lease.lease_expires_at) <= Date.now() || !object(lease.input) || !digest(lease.input.input_hash)) fail('INVALID_STAGE_SCOPE');
  const controller = new AbortController(); const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const heartbeatMs = options.heartbeatMs ?? 20_000; const timeoutMs = options.gatewayTimeoutMs ?? 15_000;
  if (!Number.isSafeInteger(heartbeatMs) || heartbeatMs < 10 || heartbeatMs > 20_000 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 15_000) fail('INVALID_STAGE_SCOPE');
  const scope = { job_id: lease.job_id, attempt_id: lease.attempt_id, lease_token: lease.lease_token };
  async function call<T>(operation: (requestSignal: AbortSignal) => Promise<T>, code: CandidateExecutionError['code']): Promise<T> {
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]); let abort!: () => void;
    const stopped = new Promise<never>((_resolve, reject) => { abort = () => reject(new CandidateExecutionError(options.signal?.aborted ? 'PROCESSING_CANCELLED' : code)); bounded.addEventListener('abort', abort, { once: true }); if (bounded.aborted) abort(); });
    try { return await Promise.race([stopped, Promise.resolve().then(() => { if (bounded.aborted) return stopped; return operation(bounded); })]); }
    catch (error) { if (error instanceof CandidateExecutionError) throw error; return fail(code); } finally { bounded.removeEventListener('abort', abort); }
  }
  const input = await call(requestSignal => gateway.getInput(scope, requestSignal), 'STAGE_INPUT_INVALID');
  if (!object(input) || input.job_id !== lease.job_id || input.attempt_id !== lease.attempt_id || input.stage !== lease.stage || input.input_hash !== lease.input.input_hash
    || !object(input.configuration) || input.configuration.media_preparation_version !== 'video-preparation.v1' || input.configuration.prompt_version !== 'candidate_extract_v1' || input.configuration.result_schema_version !== '1.0'
    || input.configuration.transcription_model_version !== options.transcription.model || input.configuration.extraction_model_version !== options.extraction.model) fail('STAGE_INPUT_INVALID');
  if (!object(lease.input.configuration)) fail('STAGE_INPUT_INVALID');
  const frozen = lease.input.configuration;
  if ((frozen.transcription_model_version ?? frozen.transcription_model) !== options.transcription.model || (frozen.extraction_model_version ?? frozen.extraction_model) !== options.extraction.model) fail('STAGE_INPUT_INVALID');
  let source: CandidateSourceAsset;
  if (lease.stage === 'prepare_candidate' && object(input.source) && input.source.sha256 === null) { const checked = asset({ ...input.source, sha256: '0'.repeat(64) }); source = { ...checked, sha256: null }; }
  else source = asset(input.source);
  let sequence = 0; let stopped = false; let timer: ReturnType<typeof setTimeout> | undefined; let pending: Promise<void> = Promise.resolve(); let heartbeatError: unknown;
  let leaseDeadlineMs = Date.parse(lease.lease_expires_at);
  async function publish(fields: Pick<JobEvent, 'event_type'> & Partial<Pick<JobEvent, 'result_schema' | 'result' | 'error'>>) {
    const event: JobEvent = { event_id: randomUUID(), ...scope, stage: lease.stage, input_hash: lease.input.input_hash as string, sequence: ++sequence, ...fields };
    try {
      const delivered = await deliverCandidateCallback(event, gateway, { signal, timeoutMs, leaseDeadlineMs });
      // SQL17 extends a confirmed heartbeat by90s. Its first send time is a
      // conservative lower bound even when the acknowledged receipt is duplicate.
      if (event.event_type === 'heartbeat') leaseDeadlineMs = Math.max(leaseDeadlineMs, delivered.firstSentAt + 90_000);
      return delivered.receipt;
    } catch (error) { if (error instanceof CandidateCallbackError) return fail(error.code); return fail('CALLBACK_UNCONFIRMED'); }
  }
  function beat() { if (stopped) return; timer = setTimeout(() => { pending = publish({ event_type: 'heartbeat' }).then(() => { beat(); }).catch(error => { heartbeatError = error; controller.abort(); }); }, heartbeatMs); }
  async function stop() { stopped = true; clearTimeout(timer); await pending; if (heartbeatError) throw heartbeatError; }
  beat(); let result: JsonObject; let schema: string; let operation: CandidateStageOperation = 'validate_stage_input';
  try {
    if (lease.stage === 'prepare_candidate') {
      operation = 'read_source';
      const bytes = await checkedRead(options.assets, scope, source, signal, { preparingOriginal: true });
      operation = 'prepare_media';
      const prepared = await (options.prepare ?? prepareVideoIsolated)({ source_asset_id: source.asset_id, bytes, mime_type: source.mime_type as VideoInput['mime_type'] }, { imageId: options.imageId, signal });
      if (source.sha256 !== null && prepared.source_sha256 !== source.sha256 || prepared.source_asset_id !== source.asset_id || prepared.source_sha256 !== sha(bytes)) fail('STAGE_INPUT_INVALID');
        const audio: PreparedMediaReferences['audio_chunks'] = []; const frames: PreparedMediaReferences['sampled_frames'] = [];
        async function save(purpose: 'audio' | 'candidate_frame', mime: string, bytes: Uint8Array, checksum: string, output_key: string, metadata: { timestamp_ms: number | null; width: number | null; height: number | null; duration_ms: number | null }) {
          operation = purpose === 'audio' ? 'write_audio' : 'write_frame';
          const saved = asset(await options.assets.write(scope, { purpose, source_asset_id: source.asset_id, mime_type: mime, bytes, sha256: checksum, output_key, ...metadata }, signal));
          if (saved.sha256 !== checksum || saved.size_bytes !== bytes.length || saved.mime_type !== mime) fail('STAGE_INPUT_INVALID'); return saved;
        }
        for (const chunk of prepared.audio_chunks) audio.push({ ...await save('audio', chunk.mime_type, chunk.bytes, chunk.sha256, `audio_${chunk.index}`, { timestamp_ms: null, width: null, height: null, duration_ms: chunk.end_ms - chunk.start_ms }), index: chunk.index, start_ms: chunk.start_ms, end_ms: chunk.end_ms });
        for (const [index, frame] of prepared.sampled_frames.entries()) { const saved = await save('candidate_frame', 'image/jpeg', frame.bytes, frame.sha256, `frame_${index}`, { timestamp_ms: frame.timestamp_ms, width: frame.width, height: frame.height, duration_ms: null }); frames.push({ frame_asset_id: saved.asset_id, source_asset_id: frame.source_asset_id, timestamp_ms: frame.timestamp_ms, width: frame.width, height: frame.height, sha256: frame.sha256, quality_flags: frame.quality_flags, quality: frame.quality }); }
        result = { ...prepared, audio_chunks: audio, sampled_frames: frames } as unknown as JsonObject; schema = 'media-preparation.v1';
    } else if (lease.stage === 'transcribe_candidate') {
      const prepared = preparedReferences(input.prepared, source);
      if (!prepared.audio_chunks.length) { result = { source_asset_id: source.asset_id, transcript_asset: null, original_transcript: null, languages: [], segment_count: 0, timestamp_precision: 'chunk', missing_transcript_reason: 'NO_INTELLIGIBLE_AUDIO', provider_metadata: [] }; }
      else {
        operation = 'read_audio';
        const chunks = []; for (const chunk of prepared.audio_chunks) chunks.push({ index: chunk.index, start_ms: chunk.start_ms, end_ms: chunk.end_ms, mime_type: 'audio/mpeg' as const, sha256: chunk.sha256, bytes: await checkedRead(options.assets, scope, chunk, signal) });
        try {
          operation = 'transcribe_audio';
          const output = await (options.transcribe ?? transcribeAudio)({ source_asset_id: source.asset_id, chunks }, options.transcription, undefined, signal);
          operation = 'write_transcript';
          const bytes = Buffer.from(JSON.stringify(output.result)); const saved = asset(await options.assets.write(scope, { purpose: 'transcript', output_key: 'transcript', source_asset_id: source.asset_id, mime_type: 'application/json', sha256: sha(bytes), bytes, timestamp_ms: null, width: null, height: null, duration_ms: null }, signal));
          if (saved.sha256 !== sha(bytes) || saved.size_bytes !== bytes.length || saved.mime_type !== 'application/json') fail('STAGE_INPUT_INVALID');
          result = { source_asset_id: source.asset_id, transcript_asset: saved as unknown as JsonObject, original_transcript: output.result as unknown as JsonObject, languages: output.result.languages, segment_count: output.result.segments.length, timestamp_precision: 'chunk', missing_transcript_reason: null, provider_metadata: output.metadata as unknown as JsonObject[] };
        } catch (error) {
          const providerCodes = ['TRANSCRIPTION_EMPTY', 'TRANSCRIPTION_RESULT_INVALID', 'OPENAI_ACCESS_DENIED', 'OPENAI_QUOTA_EXCEEDED', 'OPENAI_RATE_LIMITED', 'OPENAI_TIMEOUT', 'OPENAI_UNAVAILABLE', 'OPENAI_REQUEST_REJECTED'];
          if (error instanceof IntegrationError && providerCodes.includes(error.code) && (!error.retryable || input.allow_partial_transcription === true))
            result = { source_asset_id: source.asset_id, transcript_asset: null, original_transcript: null, languages: [], segment_count: 0, timestamp_precision: 'chunk', missing_transcript_reason: error.code === 'TRANSCRIPTION_EMPTY' ? 'NO_INTELLIGIBLE_AUDIO' : 'TRANSCRIPTION_FAILED', provider_error_code: error.code, provider_metadata: [] };
          else throw error;
        }
      }
      schema = 'candidate-transcript-stage.v1';
    } else if (lease.stage === 'extract_candidate') {
      if (input.transcript_asset === null) result = { source_asset_id: source.asset_id, result: null, manual_profile_required: true, provider_metadata: null };
      else { const reference = asset(input.transcript_asset); if (reference.mime_type !== 'application/json') fail('STAGE_INPUT_INVALID'); operation = 'read_transcript'; const original = transcript(await checkedRead(options.assets, scope, reference, signal), source.asset_id);
        try { operation = 'extract_facts'; const output = await (options.extract ?? extractCandidate)({ ...original, input_hash: lease.input.input_hash as string }, options.extraction, undefined, signal); result = { source_asset_id: source.asset_id, ...output } as unknown as JsonObject; }
        catch (error) {
          const providerCodes = ['AI_REFUSAL', 'AI_RESULT_INVALID', 'AI_EVIDENCE_INVALID', 'AI_EVIDENCE_MISSING', 'AI_SOURCE_MISMATCH', 'AI_RESPONSE_INVALID', 'AI_RESPONSE_NOT_COMPLETE', 'AI_OUTPUT_UNEXPECTED', 'OPENAI_ACCESS_DENIED', 'OPENAI_QUOTA_EXCEEDED', 'OPENAI_RATE_LIMITED', 'OPENAI_TIMEOUT', 'OPENAI_UNAVAILABLE', 'OPENAI_REQUEST_REJECTED'];
          if (error instanceof IntegrationError && providerCodes.includes(error.code) && (!error.retryable || input.allow_partial_extraction === true))
            result = { source_asset_id: source.asset_id, result: null, manual_profile_required: true, missing_extraction_reason: 'CANDIDATE_EXTRACTION_FAILED', provider_error_code: error.code, metadata: null };
          else throw error;
        }
      }
      schema = 'candidate-extraction-stage.v1';
    } else if (lease.stage === 'select_frames') {
      operation = 'select_frames';
      const prepared = preparedReferences(input.prepared, source); result = validateFrameSelection(selectRealFrames(source.asset_id, prepared.sampled_frames), source.asset_id, prepared.sampled_frames) as unknown as JsonObject; schema = 'frame-selection-stage.v1';
    } else { operation = 'prepare_application'; result = { source_asset_id: source.asset_id }; schema = 'candidate-application.v1'; }
  } catch (error) {
    await stop(); if (signal.aborted) fail(options.signal?.aborted ? 'PROCESSING_CANCELLED' : 'LEASE_STALE'); if (error instanceof CandidateExecutionError) throw error;
    try { options.onDiagnostic?.({ job_id: lease.job_id, attempt_id: lease.attempt_id, stage: lease.stage, input_hash: lease.input.input_hash as string, operation, ...diagnostic(error) }); }
    catch { /* An operator sink cannot change the durable outcome or repeat work. */ }
    let failure;
    if (error instanceof VideoPreparationError) {
      const known = videoDiagnosticCodes.has(error.code); const sourceFailure = videoSourceCodes.has(error.code);
      const retryable = known && !sourceFailure && error.retryable === true;
      failure = { code: sourceFailure ? 'SOURCE_UNREADABLE' : retryable ? 'DEPENDENCY_UNAVAILABLE' : 'PROCESSING_FAILED', message: 'Video processing could not complete. The original was retained.', details: {}, retryable };
    } else failure = integrationErrorToJobFailure(error);
    return { already_completed: false as const, receipt: await publish({ event_type: 'failed', error: failure }) };
  }
  await stop(); if (signal.aborted) fail('PROCESSING_CANCELLED');
  return { already_completed: false as const, receipt: await publish({ event_type: 'succeeded', result_schema: schema, result }) };
}
