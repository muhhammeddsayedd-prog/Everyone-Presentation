import { createHash } from 'node:crypto';
import type { CandidateSourceAsset, CandidateStageAsset, CandidateStageAssets, CandidateStageScope } from './candidate-stage-executor.ts';
import { VIDEO_LIMITS, VideoPreparationError } from './video-types.ts';
const ORIGIN = 'https://pyibofyctwnqpvktepse.supabase.co';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u; const HASH = /^[a-f0-9]{64}$/u;
const FORMATS: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-matroska': 'mkv', 'audio/mpeg': 'mp3', 'image/jpeg': 'jpg', 'application/json': 'json' };
export interface CandidateFilesPort {
  getAssetAccess(input: CandidateStageScope & { asset_id: string; access: 'read' | 'write' }, signal: AbortSignal): Promise<unknown>;
  reserveOutput(input: CandidateStageScope & { output_key: string; asset_kind: 'audio' | 'transcript' | 'candidate_frame'; filename: string; mime_type: string; expected_size_bytes: number; parent_asset_id: string; time_offset_ms: number | null }, signal: AbortSignal): Promise<unknown>;
  completeOutput(input: CandidateStageScope & { asset_id: string; sha256: string; actual_size_bytes: number; width: number | null; height: number | null; duration_ms: number | null }, signal: AbortSignal): Promise<unknown>;
}
export interface CandidateAssetsConfiguration { publishableKey: string; fetch?: typeof fetch; timeoutMs?: number; now?: () => number }
interface Access { asset_id: string; url: string; method: 'GET' | 'POST'; headers: Record<string, string>; expires_at: string; mime_type: string; size_bytes: number; sha256: string | null }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function invalid(): never { throw new VideoPreparationError('VIDEO_ASSET_CAPABILITY_INVALID', 'The private media capability could not be confirmed.'); }
function transfer(): never { throw new VideoPreparationError('VIDEO_ASSET_TRANSFER_FAILED', 'The private media transfer could not be confirmed. The original was retained.', true); }
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function maximum(mime: string): number { return mime.startsWith('video/') ? VIDEO_LIMITS.maximumBytes : mime === 'audio/mpeg' ? VIDEO_LIMITS.maximumAudioChunkBytes : mime === 'image/jpeg' ? VIDEO_LIMITS.maximumFrameBytes : mime === 'application/json' ? 2_000_000 : 0; }
function scope(input: CandidateStageScope) { if (!exact(input, ['job_id', 'attempt_id', 'lease_token']) || !UUID.test(input.job_id) || !UUID.test(input.attempt_id) || typeof input.lease_token !== 'string' || !/^[^\s\p{C}]{1,1024}$/u.test(input.lease_token)) invalid(); }
function reference(input: CandidateSourceAsset) { if (!exact(input, ['asset_id', 'sha256', 'size_bytes', 'mime_type']) || !UUID.test(input.asset_id) || !(input.sha256 === null && input.mime_type.startsWith('video/') || typeof input.sha256 === 'string' && HASH.test(input.sha256)) || !Number.isSafeInteger(input.size_bytes) || input.size_bytes < 1 || input.size_bytes > maximum(input.mime_type)) invalid(); }
/** Strict capability parsing is independent of the PG mapper. Even a malformed
 * trusted-service response cannot turn media bytes into a fetch destination. */
export function parseCandidateAssetAccess(value: unknown, input: CandidateSourceAsset, context: { scope: CandidateStageScope; method: 'GET' | 'POST'; pendingOutput?: boolean; preparingOriginal?: boolean }, configuration: CandidateAssetsConfiguration): Access {
  scope(context.scope); reference(input);
  const original = input.mime_type.startsWith('video/');
  const preparingOriginal = context.preparingOriginal === true && original && context.method === 'GET';
  if (!exact(value, ['asset_id', 'url', 'method', 'headers', 'expires_at', 'mime_type', 'size_bytes', 'sha256']) || value.asset_id !== input.asset_id || value.method !== context.method || value.mime_type !== input.mime_type || value.size_bytes !== input.size_bytes
    || typeof value.url !== 'string' || typeof value.expires_at !== 'string' || !Number.isFinite(Date.parse(value.expires_at)) || Date.parse(value.expires_at) <= (configuration.now ?? Date.now)()
    || Date.parse(value.expires_at) > (configuration.now ?? Date.now)() + 90_000 || !(value.sha256 === null || typeof value.sha256 === 'string' && HASH.test(value.sha256))
    || value.sha256 !== input.sha256 && !(value.sha256 === null && (context.method === 'POST' || context.pendingOutput || preparingOriginal)) || !object(value.headers)
    || typeof configuration.publishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]{8,4096}$/u.test(configuration.publishableKey)) invalid();
  // The first source read has a frozen declared hash but no verified asset hash.
  // Its exact leased grant and actual body still verify against that declaration.
  // Every derivative and every later source read keeps the verified-hash rule.
  if (original && (context.method !== 'GET' || (value.sha256 === null || input.sha256 === null) && !preparingOriginal)
    || context.pendingOutput && original || context.preparingOriginal && !preparingOriginal) invalid();
  const bucket = original ? 'eps-candidate-assets' : 'eps-candidate-outputs'; const extension = FORMATS[input.mime_type]; if (!extension) invalid();
  const key = original ? `assets/${input.asset_id}/original.${extension}` : `jobs/${context.scope.job_id}/attempts/${context.scope.attempt_id}/${input.asset_id}.${extension}`;
  const url = `${ORIGIN}/storage/v1/object/${context.method === 'GET' ? 'authenticated/' : ''}${bucket}/${key}`;
  const previousAttempt = !original && context.method === 'GET' && new RegExp(`^${ORIGIN.replaceAll('.', '\\.')}\\/storage\\/v1\\/object\\/authenticated\\/eps-candidate-outputs\\/jobs\\/${context.scope.job_id}\\/attempts\\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\/${input.asset_id}\\.${extension}$`, 'u').test(value.url);
  if (value.url !== url && !previousAttempt) invalid();
  const headers: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value.headers)) { const name = key.toLowerCase(); if (Object.hasOwn(headers, name) || typeof entry !== 'string' || !entry || entry.length > 8192 || /[\r\n\0]/u.test(entry)) invalid(); headers[name] = entry; }
  if (!exact(headers, context.method === 'GET' ? ['apikey', 'authorization', 'x-eps-asset-grant'] : ['apikey', 'authorization', 'x-eps-asset-grant', 'content-type', 'x-upsert'])
    || headers.apikey !== configuration.publishableKey || headers.authorization !== `Bearer ${configuration.publishableKey}` || !/^[^\s\p{C}]{1,2048}$/u.test(headers['x-eps-asset-grant'])
    || context.method === 'POST' && (headers['content-type'] !== input.mime_type || headers['x-upsert'] !== 'false')) invalid();
  return { asset_id: input.asset_id, url: value.url, method: context.method, headers, expires_at: value.expires_at, mime_type: input.mime_type, size_bytes: input.size_bytes, sha256: value.sha256 as string | null };
}
async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, configuration: CandidateAssetsConfiguration, signal: AbortSignal, expiry?: string): Promise<T> {
  const configured = configuration.timeoutMs ?? 30_000; if (!Number.isSafeInteger(configured) || configured < 1 || configured > 60_000) invalid();
  const deadlineMs = expiry ? Math.min(configured, Date.parse(expiry) - (configuration.now ?? Date.now)()) : configured; if (deadlineMs <= 0 || signal.aborted) transfer();
  const controller = new AbortController(); let rejectWait!: () => void;
  const stopped = new Promise<never>((_resolve, reject) => { rejectWait = () => reject(new VideoPreparationError('VIDEO_ASSET_TRANSFER_FAILED', 'The private media transfer could not be confirmed.', true)); });
  const abort = () => { controller.abort(); rejectWait(); }; const timer = setTimeout(abort, deadlineMs); signal.addEventListener('abort', abort, { once: true });
  try { return await Promise.race([operation(controller.signal), stopped]); } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
async function body(access: Access, expected: CandidateSourceAsset, config: CandidateAssetsConfiguration, signal: AbortSignal): Promise<Uint8Array> {
  return bounded(async requestSignal => {
    let response: Response | undefined;
    try {
      response = await (config.fetch ?? fetch)(access.url, { method: 'GET', headers: { ...access.headers, 'Accept-Encoding': 'identity' }, redirect: 'error', signal: requestSignal });
      const length = response.headers.get('content-length');
      if (requestSignal.aborted || response.status !== 200 || (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== expected.mime_type
        || length !== null && (!/^[0-9]+$/u.test(length) || Number(length) !== expected.size_bytes)) transfer();
      const reader = response.body?.getReader(); if (!reader) transfer(); const parts: Uint8Array[] = []; let total = 0;
      const cancel = () => { void reader.cancel().catch(() => undefined); }; requestSignal.addEventListener('abort', cancel, { once: true });
      try { for (;;) { const chunk = await reader.read(); if (chunk.done) break; total += chunk.value.length; if (requestSignal.aborted || total > expected.size_bytes || total > maximum(expected.mime_type)) transfer(); parts.push(chunk.value); } }
      finally { requestSignal.removeEventListener('abort', cancel); reader.releaseLock(); }
      if (requestSignal.aborted || total !== expected.size_bytes) transfer(); const bytes = Buffer.concat(parts);
      if (expected.sha256 !== null && sha(bytes) !== expected.sha256) invalid(); return bytes;
    } catch (error) { if (error instanceof VideoPreparationError) throw error; return transfer(); } finally { void response?.body?.cancel().catch(() => undefined); }
  }, config, signal, access.expires_at);
}
type Write = Parameters<CandidateStageAssets['write']>[1];
function outputAsset(value: unknown, input: Write, size: number): { id: string; ready: boolean } {
  if (!exact(value, ['id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256', 'status', 'duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms', 'created_at'])
    || !UUID.test(String(value.id)) || value.purpose !== input.purpose || value.filename !== (input.purpose === 'transcript' ? 'transcript.json' : `${input.output_key.replace('_', '-')}.${input.purpose === 'audio' ? 'mp3' : 'jpg'}`) || value.mime_type !== input.mime_type || value.size_bytes !== size || value.source_asset_id !== input.source_asset_id || value.source_timestamp_ms !== input.timestamp_ms
    || !['uploading', 'ready'].includes(String(value.status)) || value.status === 'ready' && (value.sha256 !== input.sha256 || value.width !== input.width || value.height !== input.height || value.duration_ms !== input.duration_ms)
    || value.status === 'uploading' && (value.sha256 !== null || value.width !== null || value.height !== null || value.duration_ms !== null) || typeof value.created_at !== 'string' || !Number.isFinite(Date.parse(value.created_at))) invalid();
  return { id: value.id as string, ready: value.status === 'ready' };
}
export function createCandidateStageAssets(port: CandidateFilesPort, configuration: CandidateAssetsConfiguration): CandidateStageAssets {
  return {
    async read(context, input, signal, options) { scope(context); reference(input); const access = parseCandidateAssetAccess(await bounded(requestSignal => port.getAssetAccess({ ...context, asset_id: input.asset_id, access: 'read' }, requestSignal), configuration, signal), input, { scope: context, method: 'GET', preparingOriginal: options?.preparingOriginal }, configuration); return body(access, input, configuration, signal); },
    async readFrame(context, input, signal) {
      scope(context); if (!exact(input, ['asset_id', 'sha256']) || !UUID.test(input.asset_id) || !HASH.test(input.sha256)) invalid();
      const value = await bounded(requestSignal => port.getAssetAccess({ ...context, asset_id: input.asset_id, access: 'read' }, requestSignal), configuration, signal);
      if (!object(value) || !Number.isSafeInteger(value.size_bytes) || Number(value.size_bytes) < 1 || Number(value.size_bytes) > VIDEO_LIMITS.maximumFrameBytes) invalid();
      const expected = { asset_id: input.asset_id, sha256: input.sha256, mime_type: 'image/jpeg', size_bytes: value.size_bytes as number };
      const access = parseCandidateAssetAccess(value, expected, { scope: context, method: 'GET' }, configuration);
      return body(access, expected, configuration, signal);
    },
    async write(context, input, signal): Promise<CandidateStageAsset> {
      scope(context); if (!UUID.test(input.source_asset_id) || !(input.bytes instanceof Uint8Array) || !input.bytes.length || input.bytes.length > maximum(input.mime_type) || sha(input.bytes) !== input.sha256) invalid();
      const audio = /^audio_(\d|1[0-5])$/u.exec(input.output_key); const frame = /^frame_(\d|1[01])$/u.exec(input.output_key);
      const filename = audio ? `audio-${audio[1]}.mp3` : frame ? `frame-${frame[1]}.jpg` : 'transcript.json';
      if (input.purpose === 'audio' ? !audio || input.mime_type !== 'audio/mpeg' || input.timestamp_ms !== null || input.width !== null || input.height !== null || !Number.isSafeInteger(input.duration_ms) || Number(input.duration_ms) < 1 || Number(input.duration_ms) > VIDEO_LIMITS.audioChunkMs
        : input.purpose === 'candidate_frame' ? !frame || input.mime_type !== 'image/jpeg' || !Number.isSafeInteger(input.timestamp_ms) || Number(input.timestamp_ms) < 0 || Number(input.timestamp_ms) >= VIDEO_LIMITS.maximumDurationMs || !Number.isSafeInteger(input.width) || Number(input.width) < 1 || Number(input.width) > 1280 || !Number.isSafeInteger(input.height) || Number(input.height) < 1 || Number(input.height) > 1280 || input.duration_ms !== null
          : input.purpose !== 'transcript' || input.output_key !== 'transcript' || input.mime_type !== 'application/json' || input.timestamp_ms !== null || input.width !== null || input.height !== null || input.duration_ms !== null) invalid();
      const reserved = await bounded(requestSignal => port.reserveOutput({ ...context, output_key: input.output_key, asset_kind: input.purpose, filename, mime_type: input.mime_type, expected_size_bytes: input.bytes.length, parent_asset_id: input.source_asset_id, time_offset_ms: input.timestamp_ms }, requestSignal), configuration, signal);
      if (!exact(reserved, ['asset', 'access'])) invalid(); const asset = outputAsset(reserved.asset, input, input.bytes.length);
      const expected: CandidateStageAsset = { asset_id: asset.id, sha256: input.sha256, mime_type: input.mime_type, size_bytes: input.bytes.length };
      const access = parseCandidateAssetAccess(reserved.access, expected, { scope: context, method: asset.ready ? 'GET' : 'POST' }, configuration);
      if (!asset.ready) await bounded(async requestSignal => { let response: Response | undefined; try { response = await (configuration.fetch ?? fetch)(access.url, { method: 'POST', headers: access.headers, redirect: 'error', body: Buffer.from(input.bytes), signal: requestSignal }); if (requestSignal.aborted || ![200, 201].includes(response.status)) transfer(); } catch (error) { if (error instanceof VideoPreparationError) throw error; transfer(); } finally { void response?.body?.cancel().catch(() => undefined); } }, configuration, signal, access.expires_at);
      const read = asset.ready ? access : parseCandidateAssetAccess(await bounded(requestSignal => port.getAssetAccess({ ...context, asset_id: asset.id, access: 'read' }, requestSignal), configuration, signal), expected, { scope: context, method: 'GET', pendingOutput: true }, configuration);
      const confirmed = await body(read, expected, configuration, signal); if (!Buffer.from(confirmed).equals(Buffer.from(input.bytes))) invalid();
      const completed = outputAsset(await bounded(requestSignal => port.completeOutput({ ...context, asset_id: asset.id, sha256: input.sha256, actual_size_bytes: input.bytes.length, width: input.width, height: input.height, duration_ms: input.duration_ms }, requestSignal), configuration, signal), input, input.bytes.length);
      if (completed.id !== asset.id || !completed.ready) invalid(); return expected;
    },
  };
}
