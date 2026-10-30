import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type MediaAsset } from '@eps/domain';
import { createHash } from 'node:crypto';
import { presentationApplicationOrigin } from '../../domain/src/presentation.ts';
import { presentationRecord, presentationResponseInvalid } from './presentation-dto.ts';
import { parseVersionTranscript } from '../../domain/src/presentation-transcript.ts';
import type { VersionTranscriptCompanion } from '../../domain/src/presentation-types.ts';

export interface PresentationAssetRead { asset: MediaAsset; bucket: string; object_key: string; transcript?: VersionTranscriptCompanion }
export interface PresentationStorageOptions { client: SupabaseClient; storageOrigin: string; now?: () => number; downloadTimeoutMs?: number }
function count(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= maximum; }
function id(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 200; }
export function presentationAssetRead(value: unknown): PresentationAssetRead {
  const hasTranscript = value !== null && typeof value === 'object' && Object.hasOwn(value, 'transcript');
  const row = presentationRecord(value, ['asset', 'bucket', 'object_key', ...(hasTranscript ? ['transcript'] : [])]);
  const asset = presentationRecord(row.asset, ['id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256', 'status', 'duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms', 'created_at']);
  if (!id(asset.id) || !['client_logo', 'candidate_frame', 'candidate_video', 'presentation_pdf'].includes(asset.purpose as string)
    || typeof asset.filename !== 'string' || !asset.filename || asset.filename.length > 255 || /[/\\\p{C}]/u.test(asset.filename)
    || !(asset.status === 'ready' || asset.status === 'archived' && ['client_logo', 'candidate_frame', 'candidate_video'].includes(asset.purpose as string))
    || typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(asset.sha256)
    || !count(asset.size_bytes, asset.purpose === 'candidate_video' ? 268435456 : asset.purpose === 'presentation_pdf' ? 67108864 : 20971520)
    || typeof asset.created_at !== 'string' || !Number.isFinite(Date.parse(asset.created_at))
    || typeof row.bucket !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,99}$/u.test(row.bucket)
    || typeof row.object_key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,1023}$/u.test(row.object_key)
    || row.object_key.split('/').some(part => !part || part === '.' || part === '..')) presentationResponseInvalid();
  for (const key of ['width', 'height', 'duration_ms']) if (!(asset[key] === null || count(asset[key]))) presentationResponseInvalid();
  if (!(asset.source_asset_id === null || id(asset.source_asset_id)) || !(asset.source_timestamp_ms === null || typeof asset.source_timestamp_ms === 'number' && Number.isSafeInteger(asset.source_timestamp_ms) && asset.source_timestamp_ms >= 0)) presentationResponseInvalid();
  const mime = asset.mime_type;
  if (asset.purpose === 'presentation_pdf' ? mime !== 'application/pdf' : asset.purpose === 'candidate_frame' ? mime !== 'image/jpeg'
    : asset.purpose === 'client_logo' ? !['image/png', 'image/jpeg', 'image/webp'].includes(mime as string)
      : !['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'].includes(mime as string)) presentationResponseInvalid();
  if (Object.hasOwn(row, 'transcript')) {
    if (asset.purpose !== 'candidate_video') presentationResponseInvalid();
    try { row.transcript = parseVersionTranscript(row.transcript); } catch { presentationResponseInvalid(); }
  }
  return structuredClone(row) as unknown as PresentationAssetRead;
}
function storageError(error: unknown): DomainError {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const status = Number(value.statusCode ?? value.status);
  return status === 403 || status === 401 ? new DomainError('ACCESS_DENIED', 'Access to this fixed-version artifact is no longer available.', 403)
    : status === 404 ? new DomainError('RESOURCE_NOT_FOUND', 'This fixed-version artifact is unavailable.', 404)
      : new DomainError('DEPENDENCY_UNAVAILABLE', 'Private presentation storage is temporarily unavailable.', 503, {}, true);
}
/** All destinations originate in the scoped version RPC. This reader has no
 * owner credential and never signs a caller-selected bucket or object path. */
export function createPresentationStorage(options: PresentationStorageOptions) {
  let origin: string; try { origin = presentationApplicationOrigin(options.storageOrigin); } catch { throw new DomainError('CENTRAL_CONFIGURATION_REQUIRED', 'Configure the verified private Storage origin.', 503); }
  const timeout = options.downloadTimeoutMs ?? 30000; if (!count(timeout, 120000)) throw new DomainError('CENTRAL_CONFIGURATION_REQUIRED', 'Configure a bounded presentation read timeout.', 503);
  const now = options.now ?? Date.now;
  async function bounded<T>(action: (signal: AbortSignal, deadline: Promise<never>) => Promise<T>): Promise<T> {
    const controller = new AbortController(); let reject!: (error: Error) => void;
    const deadline = new Promise<never>((_resolve, fail) => { reject = fail; });
    const timer = setTimeout(() => { controller.abort(); reject(new DomainError('STORAGE_TIMEOUT', 'The private presentation read timed out.', 503, {}, true)); }, timeout);
    try { return await action(controller.signal, deadline); }
    catch (error) { if (error instanceof DomainError) throw error; throw storageError(error); }
    finally { clearTimeout(timer); controller.abort(); }
  }
  async function info(item: PresentationAssetRead, deadline: Promise<never>) {
    const result = await Promise.race([options.client.storage.from(item.bucket).info(item.object_key), deadline]);
    if (result.error || !result.data) throw storageError(result.error);
    if (result.data.size !== item.asset.size_bytes || result.data.contentType !== item.asset.mime_type) throw new DomainError('SOURCE_UNREADABLE', 'The fixed-version asset no longer matches its verified type or size.', 422);
  }
  return {
    async sign(value: unknown, filename?: string) {
      const item = presentationAssetRead(value); if (!['candidate_video', 'presentation_pdf'].includes(item.asset.purpose)) presentationResponseInvalid();
      return bounded(async (_signal, deadline) => {
        await info(item, deadline); const started = now();
        const result = await Promise.race([options.client.storage.from(item.bucket).createSignedUrl(item.object_key, 90, filename ? { download: filename } : undefined), deadline]);
        if (result.error || !result.data) throw storageError(result.error);
        let target: URL; try { target = new URL(result.data.signedUrl); } catch { return presentationResponseInvalid(); }
        const expected = `/storage/v1/object/sign/${item.bucket}/${item.object_key.split('/').map(encodeURIComponent).join('/')}`;
        if (target.origin !== origin || target.pathname !== expected || target.username || target.password || target.hash
          || !target.searchParams.get('token') || [...target.searchParams.keys()].some(key => !['token', 'download'].includes(key))
          || target.searchParams.getAll('token').length !== 1 || target.searchParams.getAll('download').length > 1
          || (target.searchParams.has('download') && target.searchParams.get('download') !== filename)) presentationResponseInvalid();
        return { url: target.href, expires_at: new Date(started + 90000).toISOString() };
      });
    },
    async read(value: unknown) {
      const item = presentationAssetRead(value);
      if (item.asset.purpose === 'candidate_video') throw new DomainError('USE_PLAYBACK', 'Use fixed-version playback for this original video.', 409);
      return bounded(async (signal, deadline) => {
        await info(item, deadline); let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        try {
          const result = await Promise.race([options.client.storage.from(item.bucket).download(item.object_key, {}, { signal, cache: 'no-store' }).asStream(), deadline]);
          if (result.error || !result.data) throw storageError(result.error); reader = result.data.getReader();
          const chunks: Buffer[] = []; let size = 0;
          for (;;) {
            const part = await Promise.race([reader.read(), deadline]); if (part.done) break;
            if (!(part.value instanceof Uint8Array)) presentationResponseInvalid(); size += part.value.length;
            if (size > item.asset.size_bytes) throw new DomainError('SOURCE_UNREADABLE', 'The fixed-version asset exceeds its verified byte size.', 422); chunks.push(Buffer.from(part.value));
          }
          const bytes = Buffer.concat(chunks); const mime = item.asset.mime_type;
          const signature = mime === 'application/pdf' ? bytes.subarray(0, 5).toString('ascii') === '%PDF-'
            : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
              : mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
                : bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
          if (size !== item.asset.size_bytes || !signature || createHash('sha256').update(bytes).digest('hex') !== item.asset.sha256) throw new DomainError('SOURCE_UNREADABLE', 'The fixed-version asset failed its integrity check.', 422);
          return { bytes, mimeType: mime };
        } finally { if (reader) { void reader.cancel().catch(() => undefined); reader.releaseLock(); } }
      });
    },
  };
}
