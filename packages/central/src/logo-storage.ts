import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor, type CompleteUpload, type LogoDecoded, type MediaAsset, type MutationContext, type UploadCompletion, type UploadSession, type UploadSessionCreate } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import type { LogoReceipt, LogoReceiptClaims } from './logo-receipt.ts';

const MAXIMUM_BYTES = 5 * 1024 * 1024;
const MAXIMUM_PIXELS = 40_000_000;
const MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
type LogoMime = typeof MIME_TYPES[number];
type UploadStatus = 'open' | 'completed' | 'cancelled' | 'expired';
export type LogoUploadSession = UploadSession;
export interface LogoReservation {
  upload_id: string; asset: MediaAsset; principal_id: string; workspace_id: string;
  reservation_revision: number; verification_id: string; bucket: string; object_key: string;
  expected_size_bytes: number; expected_mime_type: LogoMime; expected_sha256: string | null;
  expires_at: string; status: UploadStatus;
}
export interface LogoMediaRecord { asset: MediaAsset; bucket: string; object_key: string }
export type LogoVerificationFacts = Pick<LogoReceiptClaims, 'verification_id' | 'upload_id' | 'asset_id' | 'principal_id' |
  'workspace_id' | 'reservation_revision' | 'bucket' | 'object_key' | 'size_bytes' | 'sha256' | 'mime_type' | 'width' | 'height'>;
/** All methods must check the current JWT actor and scope; SQL owns authorization and atomicity. */
export interface LogoStorageRpcPort {
  reserveUpload(actor: Actor, input: UploadSessionCreate, context?: MutationContext): Promise<unknown>;
  getUpload(actor: Actor, uploadId: string): Promise<unknown>;
  /** Must recheck scope BEFORE returning a completed idempotency replay. */
  prepareCompletion(actor: Actor, uploadId: string, input: CompleteUpload, context?: MutationContext): Promise<unknown>;
  finalizeCompletion(actor: Actor, uploadId: string, input: CompleteUpload, proof: LogoReceipt, context?: MutationContext): Promise<unknown>;
  cancelUpload(actor: Actor, uploadId: string, context?: MutationContext): Promise<unknown>;
  getMedia(actor: Actor, assetId: string): Promise<unknown>;
}
export interface LogoStorageOptions {
  client: SupabaseClient; storageOrigin: string; brandBucket: string; rpc: LogoStorageRpcPort;
  decodeLogo?(bytes: Uint8Array): Promise<LogoDecoded>;
  signReceipt?(facts: LogoVerificationFacts): LogoReceipt | Promise<LogoReceipt>;
  now?: () => number;
  /** Tests may shorten this deadline; it cannot exceed the production 30-second bound. */
  downloadTimeoutMs?: number;
}
function invalid(): never { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'The private logo response did not match its contract.', 503); }
function inputError(message: string): never { throw new DomainError('VALIDATION_FAILED', message, 422); }
function configurationError(): never { throw new DomainError('LOGO_STORAGE_CONFIGURATION_REQUIRED', 'Configure the private logo storage origin, bucket and bounded verifier.', 503); }
function integer(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= maximum; }
function id(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 200; }
function hash(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value); }
function simpleFilename(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 255 && !/[/\\]/u.test(value)
    && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(); return value as Record<string, unknown>; }
function fields(value: unknown, names: readonly string[]) {
  const result = record(value);
  if (Object.keys(result).length !== names.length || names.some(name => !Object.hasOwn(result, name))) invalid();
  return result;
}
function inputFields(value: unknown, allowed: readonly string[], required: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) inputError('Provide a valid logo operation input object.');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(result, key))) inputError('The logo request does not match the operation contract.');
  return result;
}
function mediaAsset(value: unknown): MediaAsset {
  const asset = fields(value, ['id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256', 'status', 'duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms', 'created_at']);
  if (!id(asset.id) || asset.purpose !== 'client_logo' || typeof asset.filename !== 'string' || !asset.filename || asset.filename.length > 255
    || !MIME_TYPES.includes(asset.mime_type as LogoMime) || !integer(asset.size_bytes, MAXIMUM_BYTES)
    || !(asset.sha256 === null || hash(asset.sha256)) || !['uploading', 'ready', 'failed', 'quarantined', 'archived'].includes(String(asset.status))
    || asset.duration_ms !== null || asset.source_asset_id !== null || asset.source_timestamp_ms !== null
    || !(asset.width === null || integer(asset.width, MAXIMUM_PIXELS)) || !(asset.height === null || integer(asset.height, MAXIMUM_PIXELS))
    || typeof asset.created_at !== 'string' || Number.isNaN(Date.parse(asset.created_at))) invalid();
  if (asset.status === 'ready' && (!hash(asset.sha256) || !integer(asset.width) || !integer(asset.height) || asset.width * asset.height > MAXIMUM_PIXELS)) invalid();
  return structuredClone(asset) as unknown as MediaAsset;
}
function completion(value: unknown, reservation: LogoReservation, input: CompleteUpload): UploadCompletion {
  const result = fields(value, ['asset', 'processing_job_id', 'status']);
  const asset = mediaAsset(result.asset);
  if (result.processing_job_id !== null || result.status !== 'ready' || asset.status !== 'ready' || asset.id !== reservation.asset.id
    || asset.size_bytes !== reservation.expected_size_bytes || asset.size_bytes !== input.actual_size_bytes
    || asset.mime_type !== reservation.expected_mime_type || input.sha256 && asset.sha256 !== input.sha256
    || reservation.expected_sha256 && asset.sha256 !== reservation.expected_sha256) invalid();
  return { asset, processing_job_id: null, status: 'ready' };
}
type LogoPhase = 'reserve' | 'sign_upload' | 'sign_upload_response' | 'prepare_completion' | 'download' | 'stream' | 'decode' | 'sign_verification' | 'finalize_completion' | 'unclassified';
// Official Storage codes, never free-form error/message/header values.
// https://supabase.com/docs/guides/storage/debugging/error-codes
const storageCodes = new Set(['NoSuchBucket', 'NoSuchKey', 'NoSuchUpload', 'InvalidJWT', 'InvalidRequest', 'TenantNotFound',
  'EntityTooLarge', 'InternalError', 'ResourceAlreadyExists', 'DatabaseTimeout', 'InvalidSignature', 'SignatureDoesNotMatch',
  'AccessDenied', 'ResourceLocked', 'DatabaseError']);
function storageError(error: unknown, reading = false, phase: LogoPhase = 'unclassified'): DomainError {
  const http = (value: unknown): number | null => {
    const number = typeof value === 'number' ? value : typeof value === 'string' && /^[1-5][0-9]{2}$/u.test(value) ? Number(value) : null;
    return number !== null && Number.isInteger(number) && number >= 100 && number <= 599 ? number : null;
  };
  let wire: number | null = null, body: number | null = null, code: string | null = null;
  try {
    const value = error && typeof error === 'object' ? error as { status?: unknown; statusCode?: unknown; code?: unknown } : {};
    wire = http(value.status); body = http(value.statusCode);
    const rawCode = value.code;
    if (typeof rawCode === 'string' && storageCodes.has(rawCode)) code = rawCode;
  } catch { /* Unsafe getters never copy an error or defeat the static projection. */ }
  const details = { logo_phase: phase, storage_http_status: wire, storage_body_status: body, storage_code: code };
  // Storage's documented legacy JSON envelope can use wire400 with body403/404.
  // Preserve both values; a body status cannot override another wire failure.
  const status = wire === null ? body : wire === 400 && (body === 403 || body === 404) ? body : wire;
  if (reading && status === 404) return new DomainError('UPLOAD_INCOMPLETE', 'The uploaded logo bytes are not available yet.', 409, details);
  if (status === 401) return new DomainError('AUTH_REQUIRED', 'Sign in again before accessing this logo.', 401, details);
  if (status === 403) return new DomainError('ACCESS_DENIED', 'Your account cannot access this logo operation.', 403, details);
  if (status === 429) return new DomainError('STORAGE_RATE_LIMITED', 'Logo storage is temporarily rate limited. Try again shortly.', 429, details, true);
  return new DomainError('DEPENDENCY_UNAVAILABLE', 'Private logo storage is temporarily unavailable.', 503, details, true);
}
async function inLogoPhase<T>(phase: LogoPhase, action: () => T | PromiseLike<T>, reading = false): Promise<T> {
  try { return await action(); }
  catch (error) {
    if (error instanceof DomainError) {
      if (error.details.logo_phase) throw error;
      throw new DomainError(error.code, error.message, error.status, { ...error.details, logo_phase: phase }, error.retryable);
    }
    throw storageError(error, reading, phase);
  }
}

export async function createLogoStorageAdapter(options: LogoStorageOptions) {
  let origin: URL;
  try { origin = new URL(options.storageOrigin); } catch { return configurationError(); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  const timeout = options.downloadTimeoutMs ?? 30_000;
  if ((origin.protocol !== 'https:' && !(local && origin.protocol === 'http:')) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/'
    || !/^[a-z0-9][a-z0-9._-]{0,99}$/u.test(options.brandBucket) || !integer(timeout, 30_000)) configurationError();
  const identity = await verifyCentralUser(options.client);
  const verifier = typeof options.decodeLogo === 'function' && typeof options.signReceipt === 'function'
    ? { decodeLogo: options.decodeLogo.bind(options), signReceipt: options.signReceipt.bind(options) } : undefined;
  function requireVerifier() {
    if (!verifier) throw new DomainError('LOGO_STORAGE_CONFIGURATION_REQUIRED', 'Private logo uploads require the byte decoder and verification signer. Existing Ready logos remain available.', 503);
    return verifier;
  }
  function checkActor(actor: Actor) { if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The logo actor does not match this verified session.', 403); }
  function destination(bucket: unknown, objectKey: unknown) {
    if (bucket !== options.brandBucket || typeof objectKey !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u.test(objectKey)
      || objectKey.split('/').some(part => !part || part === '.' || part === '..')) invalid();
    return { bucket: options.brandBucket, object_key: objectKey };
  }
  function reservation(value: unknown, actor: Actor, uploadId?: string): LogoReservation {
    const result = fields(value, ['upload_id', 'asset', 'principal_id', 'workspace_id', 'reservation_revision', 'verification_id', 'bucket', 'object_key', 'expected_size_bytes', 'expected_mime_type', 'expected_sha256', 'expires_at', 'status']);
    const asset = mediaAsset(result.asset);
    destination(result.bucket, result.object_key);
    if (!id(result.upload_id) || uploadId && result.upload_id !== uploadId || result.principal_id !== actor.principal_id || !id(result.workspace_id)
      || !integer(result.reservation_revision) || !id(result.verification_id) || !integer(result.expected_size_bytes, MAXIMUM_BYTES)
      || !MIME_TYPES.includes(result.expected_mime_type as LogoMime) || !(result.expected_sha256 === null || hash(result.expected_sha256))
      || typeof result.expires_at !== 'string' || Number.isNaN(Date.parse(result.expires_at)) || !['open', 'completed', 'cancelled', 'expired'].includes(String(result.status))
      || asset.size_bytes !== result.expected_size_bytes || asset.mime_type !== result.expected_mime_type) invalid();
    return { ...structuredClone(result), asset } as unknown as LogoReservation;
  }
  function currentStatus(item: LogoReservation): UploadStatus { return item.status === 'open' && Date.parse(item.expires_at) <= (options.now ?? Date.now)() ? 'expired' : item.status; }
  async function transferSession(item: LogoReservation): Promise<LogoUploadSession> {
    const status = currentStatus(item);
    let url: string | null = null;
    if (status === 'open') {
      requireVerifier();
      // from() constructs a new file client; setHeader clones its headers, never global user state.
      const { data, error } = await inLogoPhase('sign_upload', () => options.client.storage.from(item.bucket).setHeader('x-upsert', 'false').createSignedUploadUrl(item.object_key, { upsert: false }));
      if (error || !data) throw storageError(error, false, 'sign_upload');
      const target = await inLogoPhase('sign_upload_response', () => new URL(data.signedUrl));
      const path = `/storage/v1/object/upload/sign/${encodeURIComponent(item.bucket)}/${item.object_key.split('/').map(encodeURIComponent).join('/')}`;
      if (target.origin !== origin.origin || target.pathname !== path || target.username || target.password || target.hash
        || Array.from(target.searchParams.keys()).some(key => key !== 'token') || target.searchParams.getAll('token').length !== 1
        || !target.searchParams.get('token') || data.path !== item.object_key || data.token !== target.searchParams.get('token')) invalid();
      url = target.href;
    }
    return { id: item.upload_id, asset_id: item.asset.id, protocol: 'signed_put', upload_url: url,
      upload_headers: url ? { 'Content-Type': item.expected_mime_type, 'x-upsert': 'false' } : {}, expires_at: item.expires_at, status, maximum_bytes: MAXIMUM_BYTES };
  }
  async function bytesFor(item: { bucket: string; object_key: string }): Promise<Buffer> {
    destination(item.bucket, item.object_key);
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader | undefined;
    const timeoutError = new DomainError('STORAGE_TIMEOUT', 'The logo download timed out. Try again.', 503, {}, true);
    let rejectDeadline: (error: Error) => void = () => undefined;
    const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
    const timer = setTimeout(() => { controller.abort(); rejectDeadline(timeoutError); void reader?.cancel().catch(() => undefined); }, timeout);
    let failed = false, failure: unknown;
    let output: Buffer | undefined;
    try {
      // The package's user-client fetch already enforces redirect:error; SDK FetchParameters
      // exposes signal/cache but does not expose redirect as an operation option.
      const result = await inLogoPhase('download', () => Promise.race([options.client.storage.from(item.bucket).download(item.object_key, {}, { signal: controller.signal, cache: 'no-store' }).asStream(), deadline]), true);
      if (result.error || !result.data) throw storageError(result.error, true, 'download');
      output = await inLogoPhase('stream', async () => {
        reader = result.data.getReader();
        const chunks: Buffer[] = []; let size = 0;
        while (true) {
          const next = await Promise.race([reader.read(), deadline]);
          if (next.done) break;
          if (!(next.value instanceof Uint8Array)) throw new DomainError('SOURCE_UNREADABLE', 'The logo storage response was invalid.', 422);
          size += next.value.byteLength;
          if (size > MAXIMUM_BYTES) { controller.abort(); void reader.cancel().catch(() => undefined); throw new DomainError('SOURCE_UNREADABLE', 'The stored logo exceeds 5 MiB. Upload a smaller image.', 422); }
          chunks.push(Buffer.from(next.value));
        }
        if (size === 0) throw new DomainError('UPLOAD_INCOMPLETE', 'The uploaded logo is empty.', 409);
        return Buffer.concat(chunks, size);
      }, true);
    } catch (error) { failed = true; failure = error; }
    finally {
      clearTimeout(timer); controller.abort();
      if (reader) {
        try { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
        catch (error) { if (!failed) { failed = true; failure = storageError(error, true, 'stream'); } }
      }
    }
    if (failed) throw failure;
    return output!;
  }
  async function safe<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); } catch (error) { if (error instanceof DomainError) throw error; throw storageError(error); }
  }
  function completeInput(input: CompleteUpload) {
    inputFields(input, ['actual_size_bytes', 'start_processing', 'sha256'], ['actual_size_bytes', 'start_processing']);
    if (!integer(input.actual_size_bytes, MAXIMUM_BYTES)
      || typeof input.start_processing !== 'boolean' || input.sha256 !== undefined && !hash(input.sha256)) inputError('Provide a valid logo completion size, processing flag and optional SHA256.');
  }
  async function readableMedia(actor: Actor, assetId: string) {
    const value = fields(await options.rpc.getMedia(actor, assetId), ['asset', 'bucket', 'object_key']);
    const asset = mediaAsset(value.asset);
    if (asset.id !== assetId) invalid();
    return { asset, ...destination(value.bucket, value.object_key) };
  }
  return {
    uploadReady: verifier !== undefined,
    createUploadSession: (actor: Actor, input: UploadSessionCreate, context?: MutationContext) => safe(async () => {
      checkActor(actor);
      requireVerifier();
      inputFields(input, ['workspace_id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256'], ['workspace_id', 'purpose', 'filename', 'mime_type', 'size_bytes']);
      if (input.purpose !== 'client_logo' || !id(input.workspace_id) || !integer(input.size_bytes, MAXIMUM_BYTES) || !MIME_TYPES.includes(input.mime_type as LogoMime)
        || !simpleFilename(input.filename)
        || input.sha256 !== undefined && !hash(input.sha256)) inputError('Choose a workspace and a PNG, JPEG or WebP logo up to 5 MiB with a simple filename.');
      const item = reservation(await inLogoPhase('reserve', () => options.rpc.reserveUpload(actor, input, context)), actor);
      if (item.workspace_id !== input.workspace_id || item.expected_size_bytes !== input.size_bytes || item.expected_mime_type !== input.mime_type || input.sha256 && item.expected_sha256 !== input.sha256) invalid();
      return transferSession(item);
    }),
    getUploadSession: (actor: Actor, uploadId: string) => safe(async () => { checkActor(actor); return transferSession(reservation(await options.rpc.getUpload(actor, uploadId), actor, uploadId)); }),
    completeUpload: (actor: Actor, uploadId: string, input: CompleteUpload, context?: MutationContext) => safe(async () => {
      checkActor(actor); completeInput(input);
      const prepared = fields(await inLogoPhase('prepare_completion', () => options.rpc.prepareCompletion(actor, uploadId, input, context)), ['reservation', 'replay']);
      const item = reservation(prepared.reservation, actor, uploadId);
      if (prepared.replay !== null) { if (item.status !== 'completed') invalid(); return completion(prepared.replay, item, input); }
      const activeVerifier = requireVerifier();
      if (currentStatus(item) !== 'open') throw new DomainError('UPLOAD_EXPIRED', 'This logo upload is no longer open. Start another upload.', 409);
      if (input.actual_size_bytes !== item.expected_size_bytes) inputError('Completion size does not match the reserved logo.');
      const bytes = await bytesFor(item);
      if (bytes.length !== item.expected_size_bytes) inputError('Stored bytes do not match the reserved logo size.');
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (input.sha256 && input.sha256 !== digest || item.expected_sha256 && item.expected_sha256 !== digest) inputError('The stored logo checksum does not match the upload.');
      let decoded: LogoDecoded;
      try { decoded = await activeVerifier.decodeLogo(bytes); } catch { throw new DomainError('SOURCE_UNREADABLE', 'This logo could not be decoded. Upload a valid PNG, JPEG or WebP.', 422, { logo_phase: 'decode' }); }
      if (decoded.mimeType !== item.expected_mime_type || !integer(decoded.width, MAXIMUM_PIXELS) || !integer(decoded.height, MAXIMUM_PIXELS) || decoded.width * decoded.height > MAXIMUM_PIXELS) inputError('The decoded logo type or dimensions are unsupported.');
      const proof = await inLogoPhase('sign_verification', () => activeVerifier.signReceipt({ verification_id: item.verification_id, upload_id: item.upload_id, asset_id: item.asset.id, principal_id: actor.principal_id,
        workspace_id: item.workspace_id, reservation_revision: item.reservation_revision, bucket: item.bucket, object_key: item.object_key,
        size_bytes: bytes.length, sha256: digest, mime_type: decoded.mimeType as LogoMime, width: decoded.width, height: decoded.height }));
      const result = completion(await inLogoPhase('finalize_completion', () => options.rpc.finalizeCompletion(actor, uploadId, input, proof, context)), item, input);
      if (result.asset.sha256 !== digest || result.asset.width !== decoded.width || result.asset.height !== decoded.height) invalid();
      return result;
    }),
    cancelUpload: (actor: Actor, uploadId: string, context?: MutationContext) => safe(async () => { checkActor(actor); const result = fields(await options.rpc.cancelUpload(actor, uploadId, context), ['success', 'affected_ids']); if (result.success !== true || !Array.isArray(result.affected_ids) || !result.affected_ids.every(id)) invalid(); return structuredClone(result) as unknown as { success: true; affected_ids: string[] }; }),
    getMedia: (actor: Actor, assetId: string) => safe(async () => { checkActor(actor); return (await readableMedia(actor, assetId)).asset; }),
    getMediaContent: (actor: Actor, assetId: string) => safe(async () => {
      checkActor(actor); const item = await readableMedia(actor, assetId);
      if (item.asset.status !== 'ready') throw new DomainError('RESOURCE_NOT_FOUND', 'The verified logo is unavailable.', 404);
      const bytes = await bytesFor(item);
      if (bytes.length !== item.asset.size_bytes || createHash('sha256').update(bytes).digest('hex') !== item.asset.sha256) throw new DomainError('SOURCE_UNREADABLE', 'The stored logo failed its integrity check.', 422);
      return { bytes, mimeType: item.asset.mime_type };
    }),
  };
}
export type LogoStorageAdapter = Awaited<ReturnType<typeof createLogoStorageAdapter>>;
