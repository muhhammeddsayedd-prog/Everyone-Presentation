import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor, type CompleteUpload, type MediaAsset, type MutationContext, type UploadCompletion, type UploadSession, type UploadSessionCreate } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import {candidateTusSession} from './tus-upload-session.ts';
const MAXIMUM = 256 * 1024 * 1024; const FRAME_MAXIMUM = 2 * 1024 * 1024;
const UUID_PATTERN = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'; const UUID = new RegExp(`^${UUID_PATTERN}$`, 'u');
const FORMATS = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-matroska': 'mkv' } as const;
export type CandidateUploadInput = Omit<UploadSessionCreate, 'purpose' | 'workspace_id'> & { purpose: 'candidate_video'; workspace_id: string };
export interface CandidateStorageRpcPort {
  reserveUpload(actor: Actor, input: CandidateUploadInput, context?: MutationContext): Promise<unknown>;
  getUpload(actor: Actor, uploadId: string): Promise<unknown>;
  completeUpload(actor: Actor, uploadId: string, input: CompleteUpload, context?: MutationContext): Promise<unknown>;
  cancelUpload(actor: Actor, uploadId: string, context?: MutationContext): Promise<unknown>;
  getMedia(actor: Actor, assetId: string): Promise<unknown>;
}
export interface CandidateStorageOptions { client: SupabaseClient; storageOrigin: string; rpc: CandidateStorageRpcPort; maximumBytes?: number; uploadsEnabled?: boolean; now?: () => number; downloadTimeoutMs?: number }
export interface CandidatePlayback { asset_id: string; url: string; expires_at: string; mime_type: string; source_version_id: null }
interface Reservation { upload_id: string; asset: MediaAsset; principal_id: string; workspace_id: string; bucket: string; object_key: string;
  expected_size_bytes: number; expected_mime_type: string; expected_sha256: string | null; expires_at: string; status: UploadSession['status'] }
function invalid(): never { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'The private candidate media response did not match its contract.', 503); }
function inputError(): never { throw new DomainError('VALIDATION_FAILED', 'Provide a supported candidate video and valid reserved upload details.', 422); }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function fields(value: unknown, keys: string[]): Record<string, unknown> { if (!object(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid(); return value; }
const id = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const integer = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= maximum;
const filename = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 255 && !/[/\\\p{C}]/u.test(value);
function asset(value: unknown): MediaAsset {
  const item = fields(value, ['id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256', 'status', 'duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms', 'created_at']);
  if (!id(item.id) || !['candidate_video', 'candidate_frame', 'audio', 'transcript'].includes(String(item.purpose)) || !filename(item.filename)
    || !integer(item.size_bytes, item.purpose === 'candidate_video' ? MAXIMUM : 20 * 1024 * 1024) || !(item.sha256 === null || hash(item.sha256))
    || !['uploading', 'ready', 'failed', 'quarantined', 'archived'].includes(String(item.status)) || typeof item.created_at !== 'string' || !Number.isFinite(Date.parse(item.created_at))) invalid();
  const ready = item.status === 'ready'; if (ready && !hash(item.sha256)) invalid();
  if (item.purpose === 'candidate_video') {
    if (typeof item.mime_type !== 'string' || !Object.hasOwn(FORMATS, item.mime_type) || item.source_asset_id !== null || item.source_timestamp_ms !== null
      || ready && (!integer(item.width, 4096) || !integer(item.height, 4096) || !integer(item.duration_ms, 1_800_000))
      || !ready && !(item.width === null && item.height === null && item.duration_ms === null || integer(item.width, 4096) && integer(item.height, 4096) && integer(item.duration_ms, 1_800_000))) invalid();
  } else if (!id(item.source_asset_id)) invalid();
  else if (item.purpose === 'candidate_frame') {
    if (item.mime_type !== 'image/jpeg' || item.duration_ms !== null || !(item.source_timestamp_ms === null && !ready || typeof item.source_timestamp_ms === 'number' && Number.isSafeInteger(item.source_timestamp_ms) && item.source_timestamp_ms >= 0 && item.source_timestamp_ms <= 1_800_000)
      || ready && (!integer(item.width, 4096) || !integer(item.height, 4096)) || !ready && (item.width !== null || item.height !== null)) invalid();
  } else if (item.purpose === 'audio') {
    if (item.mime_type !== 'audio/mpeg' || item.width !== null || item.height !== null || item.source_timestamp_ms !== null || !(item.duration_ms === null && !ready || integer(item.duration_ms, 1_800_000))) invalid();
  } else if (item.mime_type !== 'application/json' || item.width !== null || item.height !== null || item.duration_ms !== null || item.source_timestamp_ms !== null || !integer(item.size_bytes, FRAME_MAXIMUM)) invalid();
  return structuredClone(item) as unknown as MediaAsset;
}
function storageError(error: unknown): DomainError {
  const status = object(error) ? Number(error.status ?? error.statusCode) : null;
  if (status === 401) return new DomainError('AUTH_REQUIRED', 'Sign in again before accessing candidate media.', 401);
  if (status === 403) return new DomainError('ACCESS_DENIED', 'Your account cannot access this candidate media.', 403);
  if (status === 404) return new DomainError('RESOURCE_NOT_FOUND', 'The candidate media is unavailable.', 404);
  if (status === 429) return new DomainError('STORAGE_RATE_LIMITED', 'Candidate storage is temporarily rate limited.', 429, {}, true);
  return new DomainError('DEPENDENCY_UNAVAILABLE', 'Private candidate storage is temporarily unavailable.', 503, {}, true);
}
export async function createCandidateStorageAdapter(options: CandidateStorageOptions) {
  let origin: URL; try { origin = new URL(options.storageOrigin); } catch { throw new DomainError('CANDIDATE_STORAGE_CONFIGURATION_REQUIRED', 'Configure the private candidate storage origin.', 503); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname); const timeout = options.downloadTimeoutMs ?? 30_000;
  const maximum = options.maximumBytes ?? MAXIMUM;
  if (origin.protocol !== 'https:' && !(local && origin.protocol === 'http:') || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || !integer(timeout, 30_000) || !integer(maximum, MAXIMUM)
    || options.uploadsEnabled !== undefined && typeof options.uploadsEnabled !== 'boolean') throw new DomainError('CANDIDATE_STORAGE_CONFIGURATION_REQUIRED', 'Configure the private candidate storage origin and bounded media limits.', 503);
  const uploadsEnabled = options.uploadsEnabled !== false;
  const identity = await verifyCentralUser(options.client); const now = options.now ?? Date.now;
  function actor(value: Actor) { if (value?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The candidate actor does not match this verified session.', 403); }
  function requireUploads() { if (!uploadsEnabled) throw new DomainError('CANDIDATE_STORAGE_CONFIGURATION_REQUIRED', 'Candidate uploads are disabled. Existing Ready candidate media remains available.', 503); }
  function uploadSize(size: number) { if (size > maximum) throw new DomainError('UPLOAD_TOO_LARGE', 'This video exceeds this environment’s current upload limit.', 422, { maximum_bytes: maximum }); }
  async function safe<T>(operation: () => Promise<T>): Promise<T> { try { return await operation(); } catch (error) { if (error instanceof DomainError) throw error; throw storageError(error); } }
  function destination(bucket: unknown, objectKey: unknown, item: MediaAsset): { bucket: string; object_key: string } {
    if (typeof objectKey !== 'string') invalid();
    const extension = item.purpose === 'candidate_video' ? FORMATS[item.mime_type as keyof typeof FORMATS] : item.purpose === 'candidate_frame' ? 'jpg' : item.purpose === 'audio' ? 'mp3' : 'json';
    if (item.purpose === 'candidate_video') { if (bucket !== 'eps-candidate-assets' || objectKey !== `assets/${item.id}/original.${extension}`) invalid(); }
    else if (bucket !== 'eps-candidate-outputs' || !new RegExp(`^jobs/${UUID_PATTERN}/attempts/${UUID_PATTERN}/${item.id}\\.${extension}$`, 'u').test(objectKey)) invalid();
    return { bucket: String(bucket), object_key: objectKey };
  }
  function reservation(value: unknown, acting: Actor, uploadId?: string): Reservation {
    const item = fields(value, ['upload_id', 'asset', 'principal_id', 'workspace_id', 'bucket', 'object_key', 'expected_size_bytes', 'expected_mime_type', 'expected_sha256', 'expires_at', 'status']); const media = asset(item.asset);
    destination(item.bucket, item.object_key, media);
    if (!id(item.upload_id) || uploadId && item.upload_id !== uploadId || item.principal_id !== acting.principal_id || !id(item.workspace_id) || media.purpose !== 'candidate_video'
      || !integer(item.expected_size_bytes, MAXIMUM) || media.size_bytes !== item.expected_size_bytes || media.mime_type !== item.expected_mime_type
      || !(item.expected_sha256 === null || hash(item.expected_sha256)) || !['open', 'completed', 'cancelled', 'expired'].includes(String(item.status)) || typeof item.expires_at !== 'string' || !Number.isFinite(Date.parse(item.expires_at))
      || item.status === 'open' && media.status !== 'uploading') invalid();
    return { ...item, asset: media } as unknown as Reservation;
  }
  function signedURL(value: string, bucket: string, objectKey: string, upload: boolean): URL {
    let target: URL; try { target = new URL(value); } catch { return invalid(); }
    const wanted = `/storage/v1/object/${upload ? 'upload/sign' : 'sign'}/${encodeURIComponent(bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
    if (target.origin !== origin.origin || target.pathname !== wanted || target.username || target.password || target.hash || target.searchParams.getAll('token').length !== 1 || !target.searchParams.get('token') || [...target.searchParams.keys()].some(key => key !== 'token')) invalid(); return target;
  }
  async function session(item: Reservation): Promise<UploadSession> {
    if(item.status==='open' && uploadsEnabled) uploadSize(item.expected_size_bytes);
    return candidateTusSession({id:item.upload_id,assetId:item.asset.id,bucket:item.bucket,objectKey:item.object_key,mime:item.expected_mime_type,expiresAt:item.expires_at,status:item.status,maximum,enabled:uploadsEnabled},{client:options.client,storageOrigin:origin.origin,now});
  }
  async function media(acting: Actor, assetId: string) { if (!id(assetId)) inputError(); const result = fields(await options.rpc.getMedia(acting, assetId), ['asset', 'bucket', 'object_key']); const item = asset(result.asset); if (item.id !== assetId || item.status !== 'ready') invalid(); return { asset: item, ...destination(result.bucket, result.object_key, item) }; }
  return {
    uploadReady: uploadsEnabled,
    maximumBytes: maximum,
    createUploadSession: (acting: Actor, input: CandidateUploadInput, context?: MutationContext) => safe(async () => {
      actor(acting); requireUploads(); if (!object(input) || Object.keys(input).some(key => !['workspace_id', 'candidate_id', 'batch_id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256'].includes(key)) || input.purpose !== 'candidate_video' || !id(input.workspace_id) || !filename(input.filename) || typeof input.mime_type !== 'string' || !Object.hasOwn(FORMATS, input.mime_type) || !integer(input.size_bytes, MAXIMUM) || input.sha256 !== undefined && !hash(input.sha256) || input.candidate_id !== undefined && !id(input.candidate_id) || input.batch_id !== undefined && !id(input.batch_id)) inputError();
      uploadSize(input.size_bytes);
      const item = reservation(await options.rpc.reserveUpload(acting, input, context), acting);
      if (item.workspace_id !== input.workspace_id || item.asset.filename !== input.filename || item.expected_size_bytes !== input.size_bytes || item.expected_mime_type !== input.mime_type || input.sha256 && item.expected_sha256 !== input.sha256) invalid(); return session(item);
    }),
    getUploadSession: (acting: Actor, uploadId: string) => safe(async () => { actor(acting); if (!id(uploadId)) inputError(); return session(reservation(await options.rpc.getUpload(acting, uploadId), acting, uploadId)); }),
    completeUpload: (acting: Actor, uploadId: string, input: CompleteUpload, context?: MutationContext) => safe(async (): Promise<UploadCompletion> => {
      actor(acting); requireUploads(); if (!id(uploadId) || !object(input) || Object.keys(input).some(key => !['sha256', 'actual_size_bytes', 'start_processing'].includes(key)) || !integer(input.actual_size_bytes, MAXIMUM) || input.start_processing !== true || input.sha256 !== undefined && !hash(input.sha256)) inputError();
      uploadSize(input.actual_size_bytes);
      const reserved = reservation(await options.rpc.getUpload(acting, uploadId), acting, uploadId);
      if (reserved.expected_size_bytes !== input.actual_size_bytes || input.sha256 && reserved.expected_sha256 && input.sha256 !== reserved.expected_sha256) inputError();
      if(reserved.status==='open'){
        let timer:ReturnType<typeof setTimeout>|undefined;
        try{
          const deadline=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new DomainError('STORAGE_TIMEOUT','Video transfer confirmation timed out. Resume to check it.',503,{},true)),timeout);});
          const info=await Promise.race([options.client.storage.from(reserved.bucket).info(reserved.object_key),deadline]);
          if(info.error||!info.data){if(Number(info.error?.status)===404||Number((info.error as {statusCode?:unknown}|null)?.statusCode)===404)throw new DomainError('UPLOAD_INCOMPLETE','The video transfer has not finished. Resume its stored byte offset.',409);throw storageError(info.error);}
          if(info.data.size!==reserved.expected_size_bytes||info.data.contentType!==reserved.expected_mime_type)throw new DomainError('SOURCE_UNREADABLE','Stored video type or size differs from this reserved file.',422);
        }finally{clearTimeout(timer);}
      }
      // The web request never downloads/decodes this video or marks it Ready.
      // The native leased stage establishes actual size/hash/container/probe.
      const value = fields(await options.rpc.completeUpload(acting, uploadId, input, context), ['asset', 'processing_job_id', 'status']); const item = asset(value.asset);
      if (item.id !== reserved.asset.id || item.purpose !== 'candidate_video' || item.filename !== reserved.asset.filename || item.mime_type !== reserved.expected_mime_type || item.size_bytes !== reserved.expected_size_bytes || !id(value.processing_job_id) || value.status !== 'queued') invalid();
      return { asset: item, processing_job_id: value.processing_job_id, status: 'queued' };
    }),
    cancelUpload: (acting: Actor, uploadId: string, context?: MutationContext) => safe(async () => { actor(acting); requireUploads(); if (!id(uploadId)) inputError(); const result = fields(await options.rpc.cancelUpload(acting, uploadId, context), ['success', 'affected_ids']); if (result.success !== true || !Array.isArray(result.affected_ids) || !result.affected_ids.length || !result.affected_ids.every(id) || !result.affected_ids.includes(uploadId)) invalid(); return result as unknown as { success: true; affected_ids: string[] }; }),
    getMedia: (acting: Actor, assetId: string) => safe(async () => { actor(acting); return (await media(acting, assetId)).asset; }),
    playMedia: (acting: Actor, assetId: string) => safe(async (): Promise<CandidatePlayback> => { actor(acting); const item = await media(acting, assetId); const started = now(); const signed = await options.client.storage.from(item.bucket).createSignedUrl(item.object_key, 90); if (signed.error || !signed.data) throw storageError(signed.error); const target = signedURL(signed.data.signedUrl, item.bucket, item.object_key, false); return { asset_id: item.asset.id, url: target.href, expires_at: new Date(started + 90_000).toISOString(), mime_type: item.asset.mime_type, source_version_id: null }; }),
    getMediaContent: (acting: Actor, assetId: string) => safe(async () => {
      actor(acting); const item = await media(acting, assetId); if (item.asset.purpose !== 'candidate_frame') throw new DomainError('USE_PLAYBACK', 'Use authorized playback for the original video or other candidate media.', 409);
      if (item.asset.size_bytes > FRAME_MAXIMUM) throw new DomainError('SOURCE_UNREADABLE', 'This frame exceeds the supported preview limit.', 422);
      const controller = new AbortController(); let reader: ReadableStreamDefaultReader | undefined; let rejectDeadline!: (error: Error) => void;
      const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
      const timeoutError = new DomainError('STORAGE_TIMEOUT', 'The private frame read timed out.', 503, {}, true);
      const timer = setTimeout(() => { rejectDeadline(timeoutError); controller.abort(); void reader?.cancel().catch(() => undefined); }, timeout);
      try {
        const info = await Promise.race([options.client.storage.from(item.bucket).info(item.object_key), deadline]); if (info.error || !info.data) throw storageError(info.error);
        if (info.data.contentType !== 'image/jpeg' || info.data.size !== item.asset.size_bytes) throw new DomainError('SOURCE_UNREADABLE', 'The stored frame type or size does not match its verified metadata.', 422);
        const result = await Promise.race([options.client.storage.from(item.bucket).download(item.object_key, {}, { signal: controller.signal, cache: 'no-store' }).asStream(), deadline]); if (result.error || !result.data) throw storageError(result.error); reader = result.data.getReader();
        const chunks: Buffer[] = []; let size = 0;
        for (;;) { const part = await Promise.race([reader.read(), deadline]); if (controller.signal.aborted) throw timeoutError; if (part.done) break; if (!(part.value instanceof Uint8Array)) invalid(); size += part.value.length; if (size > FRAME_MAXIMUM || size > item.asset.size_bytes) throw new DomainError('SOURCE_UNREADABLE', 'The stored frame exceeds its verified size.', 422); chunks.push(Buffer.from(part.value)); }
        const bytes = Buffer.concat(chunks); if (size !== item.asset.size_bytes || createHash('sha256').update(bytes).digest('hex') !== item.asset.sha256 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new DomainError('SOURCE_UNREADABLE', 'The stored frame failed its integrity or type check.', 422);
        return { bytes, mimeType: item.asset.mime_type };
      } finally { clearTimeout(timer); controller.abort(); if (reader) { void reader.cancel().catch(() => undefined); reader.releaseLock(); } }
    }),
  };
}
export type CandidateStorageAdapter = Awaited<ReturnType<typeof createCandidateStorageAdapter>>;
