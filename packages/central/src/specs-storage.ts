import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor, type CompleteUpload, type MediaAsset, type MutationContext, type UploadCompletion, type UploadSession, type UploadSessionCreate } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import type { SpecsReceipt, SpecsReceiptClaims } from './specs-receipt.ts';

const MAXIMUM_BYTES = 20 * 1024 * 1024;
const MIME_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'] as const;
const FORMATS = ['pdf', 'docx', 'utf8_text'] as const;
const EXTENSIONS = ['pdf', 'docx', 'txt'] as const;
const BUCKET = 'eps-specs-assets';
const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export type SpecsMime = typeof MIME_TYPES[number];
export type SpecsFormat = typeof FORMATS[number];
export interface SpecsVerifiedDocument { mimeType: SpecsMime; format: SpecsFormat }
export type SpecsUploadInput = Omit<UploadSessionCreate, 'purpose' | 'candidate_id' | 'batch_id' | 'workspace_id'> & { purpose: 'specs'; workspace_id: string };
type UploadStatus = 'open' | 'completed' | 'cancelled' | 'expired';
export type SpecsUploadSession = UploadSession;
export interface SpecsReservation {
  upload_id: string; asset: MediaAsset; principal_id: string; workspace_id: string;
  reservation_revision: number; verification_id: string; bucket: string; object_key: string;
  spec_row_version: number; expected_size_bytes: number; expected_mime_type: SpecsMime; expected_sha256: string | null;
  expires_at: string; status: UploadStatus;
}
export interface SpecsMediaRecord { asset: MediaAsset; bucket: string; object_key: string }
export type SpecsVerificationFacts = Pick<SpecsReceiptClaims, 'verification_id' | 'upload_id' | 'asset_id' | 'principal_id' |
  'workspace_id' | 'reservation_revision' | 'bucket' | 'object_key' | 'size_bytes' | 'sha256' | 'mime_type' | 'verified_format'>;
/** All methods must check the current JWT actor and scope; SQL owns authorization and atomicity. */
export interface SpecsStorageRpcPort {
  reserveUpload(actor: Actor, input: SpecsUploadInput, context?: MutationContext): Promise<unknown>;
  getUpload(actor: Actor, uploadId: string): Promise<unknown>;
  /** Must recheck scope BEFORE returning a completed idempotency replay. */
  prepareCompletion(actor: Actor, uploadId: string, input: CompleteUpload, context?: MutationContext): Promise<unknown>;
  finalizeCompletion(actor: Actor, uploadId: string, input: CompleteUpload, proof: SpecsReceipt, context?: MutationContext): Promise<unknown>;
  cancelUpload(actor: Actor, uploadId: string, context?: MutationContext): Promise<unknown>;
  getMedia(actor: Actor, assetId: string): Promise<unknown>;
}
export interface SpecsStorageOptions {
  client: SupabaseClient; storageOrigin: string; rpc: SpecsStorageRpcPort;
  verifyDocument?(bytes: Uint8Array, mimeType: SpecsMime, context: { sourceAssetId: string }): Promise<SpecsVerifiedDocument>;
  signReceipt?(facts: SpecsVerificationFacts): SpecsReceipt | Promise<SpecsReceipt>;
  now?: () => number;
  /** Tests may shorten this deadline; it cannot exceed the production 30-second bound. */
  downloadTimeoutMs?: number;
}
function invalid(): never { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'The private document response did not match its contract.', 503); }
function inputError(message: string): never { throw new DomainError('VALIDATION_FAILED', message, 422); }
function configurationError(): never { throw new DomainError('SPECS_STORAGE_CONFIGURATION_REQUIRED', 'Configure the private document storage origin, bucket and bounded verifier.', 503); }
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) inputError('Provide a valid document operation input object.');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(result, key))) inputError('The document request does not match the operation contract.');
  return result;
}
function mediaAsset(value: unknown): MediaAsset {
  const asset = fields(value, ['id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256', 'status', 'duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms', 'created_at']);
  if (!id(asset.id) || asset.purpose !== 'specs' || typeof asset.filename !== 'string' || !asset.filename || asset.filename.length > 255
    || !MIME_TYPES.includes(asset.mime_type as SpecsMime) || !integer(asset.size_bytes, MAXIMUM_BYTES)
    || !(asset.sha256 === null || hash(asset.sha256)) || !['uploading', 'ready', 'failed', 'quarantined', 'archived'].includes(String(asset.status))
    || asset.duration_ms !== null || asset.source_asset_id !== null || asset.source_timestamp_ms !== null
    || asset.width !== null || asset.height !== null
    || typeof asset.created_at !== 'string' || Number.isNaN(Date.parse(asset.created_at))) invalid();
  if (asset.status === 'ready' && !hash(asset.sha256)) invalid();
  return structuredClone(asset) as unknown as MediaAsset;
}
function completion(value: unknown, reservation: SpecsReservation, input: CompleteUpload): UploadCompletion {
  const result = fields(value, ['asset', 'processing_job_id', 'status']);
  const asset = mediaAsset(result.asset);
  if ((input.start_processing ? !id(result.processing_job_id) || result.status !== 'queued' : result.processing_job_id !== null || result.status !== 'ready') || asset.status !== 'ready' || asset.id !== reservation.asset.id
    || asset.size_bytes !== reservation.expected_size_bytes || asset.size_bytes !== input.actual_size_bytes
    || asset.filename !== reservation.asset.filename
    || asset.mime_type !== reservation.expected_mime_type || input.sha256 && asset.sha256 !== input.sha256
    || reservation.expected_sha256 && asset.sha256 !== reservation.expected_sha256) invalid();
  return { asset, processing_job_id: input.start_processing ? result.processing_job_id as string : null, status: input.start_processing ? 'queued' : 'ready' };
}
function storageError(error: unknown, reading = false): DomainError {
  const value = error && typeof error === 'object' ? error as { status?: unknown; statusCode?: unknown } : {};
  const status = Number(value.status ?? value.statusCode);
  if (reading && status === 404) return new DomainError('UPLOAD_INCOMPLETE', 'The uploaded document bytes are not available yet.', 409);
  if (status === 401) return new DomainError('AUTH_REQUIRED', 'Sign in again before accessing this document.', 401);
  if (status === 403) return new DomainError('ACCESS_DENIED', 'Your account cannot access this document operation.', 403);
  if (status === 429) return new DomainError('STORAGE_RATE_LIMITED', 'Specs storage is temporarily rate limited. Try again shortly.', 429, {}, true);
  return new DomainError('DEPENDENCY_UNAVAILABLE', 'Private document storage is temporarily unavailable.', 503, {}, true);
}

export async function createSpecsStorageAdapter(options: SpecsStorageOptions) {
  let origin: URL;
  try { origin = new URL(options.storageOrigin); } catch { return configurationError(); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  const timeout = options.downloadTimeoutMs ?? 30_000;
  if ((origin.protocol !== 'https:' && !(local && origin.protocol === 'http:')) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/'
    || !integer(timeout, 30_000)) configurationError();
  const identity = await verifyCentralUser(options.client);
  const verifier = typeof options.verifyDocument === 'function' && typeof options.signReceipt === 'function'
    ? { verifyDocument: options.verifyDocument.bind(options), signReceipt: options.signReceipt.bind(options) } : undefined;
  function requireVerifier() {
    if (!verifier) throw new DomainError('SPECS_STORAGE_CONFIGURATION_REQUIRED', 'Private document uploads require a document verifier and verification signer. Existing Ready documents remain available.', 503);
    return verifier;
  }
  function checkActor(actor: Actor) { if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The document actor does not match this verified session.', 403); }
  function destination(bucket: unknown, objectKey: unknown, asset?: MediaAsset) {
    if (bucket !== BUCKET || typeof objectKey !== 'string' || !new RegExp(`^assets/${UUID}/original\\.(pdf|docx|txt)$`, 'u').test(objectKey)) invalid();
    if (asset && objectKey !== `assets/${asset.id}/original.${EXTENSIONS[MIME_TYPES.indexOf(asset.mime_type as SpecsMime)]}`) invalid();
    return { bucket: BUCKET, object_key: objectKey };
  }
  function reservation(value: unknown, actor: Actor, uploadId?: string): SpecsReservation {
    const result = fields(value, ['upload_id', 'asset', 'principal_id', 'workspace_id', 'reservation_revision', 'verification_id', 'bucket', 'object_key', 'expected_size_bytes', 'expected_mime_type', 'expected_sha256', 'expires_at', 'status', 'spec_row_version']);
    const asset = mediaAsset(result.asset);
    destination(result.bucket, result.object_key, asset);
    if (!id(result.upload_id) || uploadId && result.upload_id !== uploadId || result.principal_id !== actor.principal_id || !id(result.workspace_id)
      || !integer(result.spec_row_version) || !integer(result.reservation_revision) || !id(result.verification_id) || !integer(result.expected_size_bytes, MAXIMUM_BYTES)
      || !MIME_TYPES.includes(result.expected_mime_type as SpecsMime) || !(result.expected_sha256 === null || hash(result.expected_sha256))
      || typeof result.expires_at !== 'string' || Number.isNaN(Date.parse(result.expires_at)) || !['open', 'completed', 'cancelled', 'expired'].includes(String(result.status))
      || asset.size_bytes !== result.expected_size_bytes || asset.mime_type !== result.expected_mime_type) invalid();
    if (result.status === 'open' && asset.status !== 'uploading' || result.status === 'completed' && asset.status !== 'ready') invalid();
    return { ...structuredClone(result), asset } as unknown as SpecsReservation;
  }
  function currentStatus(item: SpecsReservation): UploadStatus { return item.status === 'open' && Date.parse(item.expires_at) <= (options.now ?? Date.now)() ? 'expired' : item.status; }
  async function transferSession(item: SpecsReservation): Promise<SpecsUploadSession> {
    const status = currentStatus(item);
    let url: string | null = null;
    if (status === 'open') {
      requireVerifier();
      // from() constructs a new file client; setHeader clones its headers, never global user state.
      const { data, error } = await options.client.storage.from(item.bucket).setHeader('x-upsert', 'false').createSignedUploadUrl(item.object_key, { upsert: false });
      if (error || !data) throw storageError(error);
      const target = new URL(data.signedUrl);
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
    const timeoutError = new DomainError('STORAGE_TIMEOUT', 'The document download timed out. Try again.', 503, {}, true);
    let rejectDeadline: (error: Error) => void = () => undefined;
    const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
    const timer = setTimeout(() => { controller.abort(); rejectDeadline(timeoutError); void reader?.cancel().catch(() => undefined); }, timeout);
    try {
      // The package's user-client fetch already enforces redirect:error; SDK FetchParameters
      // exposes signal/cache but does not expose redirect as an operation option.
      const result = await Promise.race([options.client.storage.from(item.bucket).download(item.object_key, {}, { signal: controller.signal, cache: 'no-store' }).asStream(), deadline]);
      if (result.error || !result.data) throw storageError(result.error, true);
      reader = result.data.getReader();
      const chunks: Buffer[] = []; let size = 0;
      while (true) {
        const next = await Promise.race([reader.read(), deadline]);
        if (next.done) break;
        if (!(next.value instanceof Uint8Array)) throw new DomainError('SOURCE_UNREADABLE', 'The document storage response was invalid.', 422);
        size += next.value.byteLength;
        if (size > MAXIMUM_BYTES) { controller.abort(); void reader.cancel().catch(() => undefined); throw new DomainError('SOURCE_UNREADABLE', 'The stored document exceeds 20 MiB. Upload a smaller document.', 422); }
        chunks.push(Buffer.from(next.value));
      }
      if (size === 0) throw new DomainError('UPLOAD_INCOMPLETE', 'The uploaded document is empty.', 409);
      return Buffer.concat(chunks, size);
    } finally { clearTimeout(timer); controller.abort(); if (reader) { void reader.cancel().catch(() => undefined); reader.releaseLock(); } }
  }
  async function safe<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); } catch (error) { if (error instanceof DomainError) throw error; throw storageError(error); }
  }
  function completeInput(input: CompleteUpload) {
    inputFields(input, ['actual_size_bytes', 'start_processing', 'sha256'], ['actual_size_bytes', 'start_processing']);
    if (!integer(input.actual_size_bytes, MAXIMUM_BYTES)
      || typeof input.start_processing !== 'boolean' || input.sha256 !== undefined && !hash(input.sha256)) inputError('Provide a valid document completion size, processing flag and optional SHA256.');
  }
  async function readableMedia(actor: Actor, assetId: string) {
    const value = fields(await options.rpc.getMedia(actor, assetId), ['asset', 'bucket', 'object_key']);
    const asset = mediaAsset(value.asset);
    if (asset.id !== assetId) invalid();
    return { asset, ...destination(value.bucket, value.object_key, asset) };
  }
  return {
    uploadReady: verifier !== undefined,
    createUploadSession: (actor: Actor, input: SpecsUploadInput, context?: MutationContext) => safe(async () => {
      checkActor(actor);
      requireVerifier();
      inputFields(input, ['workspace_id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256'], ['workspace_id', 'purpose', 'filename', 'mime_type', 'size_bytes']);
      if (input.purpose !== 'specs' || !id(input.workspace_id) || !integer(input.size_bytes, MAXIMUM_BYTES) || !MIME_TYPES.includes(input.mime_type as SpecsMime)
        || !simpleFilename(input.filename)
        || input.sha256 !== undefined && !hash(input.sha256)) inputError('Choose a workspace and a PDF, DOCX or UTF-8 text document up to 20 MiB with a simple filename.');
      const item = reservation(await options.rpc.reserveUpload(actor, input, context), actor);
      if (item.workspace_id !== input.workspace_id || item.asset.filename !== input.filename || item.expected_size_bytes !== input.size_bytes || item.expected_mime_type !== input.mime_type || input.sha256 && item.expected_sha256 !== input.sha256) invalid();
      return transferSession(item);
    }),
    getUploadSession: (actor: Actor, uploadId: string) => safe(async () => { checkActor(actor); return transferSession(reservation(await options.rpc.getUpload(actor, uploadId), actor, uploadId)); }),
    completeUpload: (actor: Actor, uploadId: string, input: CompleteUpload, context?: MutationContext) => safe(async () => {
      checkActor(actor); completeInput(input);
      const prepared = fields(await options.rpc.prepareCompletion(actor, uploadId, input, context), ['reservation', 'replay']);
      const item = reservation(prepared.reservation, actor, uploadId);
      if (prepared.replay !== null) { if (item.status !== 'completed') invalid(); return completion(prepared.replay, item, input); }
      const activeVerifier = requireVerifier();
      if (currentStatus(item) !== 'open') throw new DomainError('UPLOAD_EXPIRED', 'This document upload is no longer open. Start another upload.', 409);
      if (input.actual_size_bytes !== item.expected_size_bytes) inputError('Completion size does not match the reserved document.');
      const bytes = await bytesFor(item);
      if (bytes.length !== item.expected_size_bytes) inputError('Stored bytes do not match the reserved document size.');
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (input.sha256 && input.sha256 !== digest || item.expected_sha256 && item.expected_sha256 !== digest) inputError('The stored document checksum does not match the upload.');
      let verified: SpecsVerifiedDocument;
      try { verified = await activeVerifier.verifyDocument(bytes, item.expected_mime_type, { sourceAssetId: item.asset.id }); }
      catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
        if (code === 'DOCUMENT_VISION_REQUIRED') throw new DomainError('DOCUMENT_VISION_REQUIRED', 'This PDF has no readable text. Paste the brief or use a text-rich PDF.', 422);
        throw new DomainError('SOURCE_UNREADABLE', 'This document could not be verified. Use a valid text-rich PDF, DOCX or UTF-8 text file.', 422);
      }
      const format = FORMATS[MIME_TYPES.indexOf(item.expected_mime_type)];
      if (!verified || verified.mimeType !== item.expected_mime_type || verified.format !== format) inputError('The verified document format does not match its reserved MIME type.');
      const proof = await activeVerifier.signReceipt({ verification_id: item.verification_id, upload_id: item.upload_id, asset_id: item.asset.id, principal_id: actor.principal_id,
        workspace_id: item.workspace_id, reservation_revision: item.reservation_revision, bucket: item.bucket, object_key: item.object_key,
        size_bytes: bytes.length, sha256: digest, mime_type: verified.mimeType, verified_format: verified.format });
      const result = completion(await options.rpc.finalizeCompletion(actor, uploadId, input, proof, context), item, input);
      if (result.asset.sha256 !== digest) invalid();
      return result;
    }),
    cancelUpload: (actor: Actor, uploadId: string, context?: MutationContext) => safe(async () => { checkActor(actor); const result = fields(await options.rpc.cancelUpload(actor, uploadId, context), ['success', 'affected_ids']); if (result.success !== true || !Array.isArray(result.affected_ids) || !result.affected_ids.every(id)) invalid(); return structuredClone(result) as unknown as { success: true; affected_ids: string[] }; }),
    getMedia: (actor: Actor, assetId: string) => safe(async () => { checkActor(actor); return (await readableMedia(actor, assetId)).asset; }),
    getMediaContent: (actor: Actor, assetId: string) => safe(async () => {
      checkActor(actor); const item = await readableMedia(actor, assetId);
      if (item.asset.status !== 'ready') throw new DomainError('RESOURCE_NOT_FOUND', 'The verified document is unavailable.', 404);
      const bytes = await bytesFor(item);
      if (bytes.length !== item.asset.size_bytes || createHash('sha256').update(bytes).digest('hex') !== item.asset.sha256) throw new DomainError('SOURCE_UNREADABLE', 'The stored document failed its integrity check.', 422);
      return { bytes, mimeType: item.asset.mime_type };
    }),
  };
}
export type SpecsStorageAdapter = Awaited<ReturnType<typeof createSpecsStorageAdapter>>;
