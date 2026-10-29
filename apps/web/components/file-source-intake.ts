import type { MediaAsset, Spec, UploadSession } from '@eps/domain';
import { ApiError } from './api';
import { readSourceAccepted, type SourceAccepted } from './source-intake';

const MAXIMUM_BYTES = 20 * 1024 * 1024;
const TYPES = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain' } as const;
type DocumentMime = typeof TYPES[keyof typeof TYPES];
type SourceScope = Pick<Spec, 'id' | 'workspace_id' | 'row_version'>;
type Phase = 'reserving' | 'uploading' | 'verifying' | 'submitting' | 'accepted';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export class FileSourceError extends Error {
  constructor(readonly code: 'FILE_INVALID' | 'UPLOAD_UNCONFIRMED' | 'UPLOAD_RESPONSE_INVALID' | 'UPLOAD_CLOSED') {
    super(code === 'FILE_INVALID' ? 'Choose a non-empty PDF, DOCX or UTF-8 text file up to 20 MiB. Save legacy Word files as DOCX first.'
      : code === 'UPLOAD_CLOSED' ? 'This upload is closed. Choose another file; any saved original remains private.'
        : 'The file request could not be confirmed. Retry this same request to check its saved outcome.');
  }
}
const invalid = (): never => { throw new FileSourceError('UPLOAD_RESPONSE_INVALID'); };
export function documentFileMetadata(file: Pick<File, 'name' | 'size' | 'type'>): { mimeType: DocumentMime } {
  const extension = file.name?.split('.').at(-1)?.toLowerCase();
  if (typeof file.name !== 'string' || !file.name.trim() || file.name.length > 255 || /[/\\\p{C}]/u.test(file.name)
    || !positive(file.size) || file.size > MAXIMUM_BYTES || !extension || !Object.hasOwn(TYPES, extension)) throw new FileSourceError('FILE_INVALID');
  const mimeType = TYPES[extension as keyof typeof TYPES];
  if (Object.values(TYPES).includes(file.type as DocumentMime) && file.type !== mimeType) throw new FileSourceError('FILE_INVALID');
  return { mimeType };
}
export interface FileSourceRequest {
  readonly file: File; readonly specId: string; readonly workspaceId: string; readonly mimeType: DocumentMime; readonly sha256: string;
  specVersion: number; readonly reserveBody: string; readonly completeBody: string;
  readonly reserveKey: string; readonly completeKey: string; submitKey: string;
  session: UploadSession | null; transferAttempted: boolean; ready: MediaAsset | null; accepted: SourceAccepted | null;
  lastOperation: Phase; sourceConflict: boolean;
}
export interface FileSourcePorts {
  storageOrigin: string;
  json(path: string, init?: RequestInit): Promise<{ data: unknown }>;
  put(url: string, init: RequestInit): Promise<Response>;
}
export async function captureFileSource(spec: SourceScope, file: File, createKey: () => string): Promise<FileSourceRequest> {
  const { mimeType } = documentFileMetadata(file);
  if (!positive(spec.row_version) || !spec.id || !spec.workspace_id) invalid();
  const bytes = await file.arrayBuffer(); if (bytes.byteLength !== file.size) throw new FileSourceError('FILE_INVALID');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return { file, specId: spec.id, workspaceId: spec.workspace_id, specVersion: spec.row_version, mimeType, sha256,
    reserveBody: JSON.stringify({ purpose: 'specs', workspace_id: spec.workspace_id, filename: file.name, mime_type: mimeType, size_bytes: file.size, sha256 }),
    completeBody: JSON.stringify({ actual_size_bytes: file.size, start_processing: false, sha256 }),
    reserveKey: createKey(), completeKey: createKey(), submitKey: createKey(), session: null, transferAttempted: false,
    ready: null, accepted: null, lastOperation: 'reserving', sourceConflict: false };
}
export function specsTransferDestination(session: Pick<UploadSession, 'asset_id' | 'upload_url' | 'upload_headers'>, storageOrigin: string, mime: DocumentMime) {
  try {
    const origin = new URL(storageOrigin); const target = new URL(session.upload_url ?? '');
    const extension = (Object.entries(TYPES).find(([, value]) => value === mime) ?? [])[0];
    const headers = new Headers(session.upload_headers);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/'
      || !UUID.test(session.asset_id) || !extension || target.origin !== origin.origin || target.username || target.password || target.hash
      || target.pathname !== `/storage/v1/object/upload/sign/eps-specs-assets/assets/${session.asset_id}/original.${extension}`
      || target.searchParams.getAll('token').length !== 1 || !target.searchParams.get('token')
      || Array.from(target.searchParams.keys()).some(key => key !== 'token')
      || Array.from(headers.keys()).some(key => !['content-type', 'x-upsert'].includes(key))
      || headers.get('content-type') !== mime || headers.get('x-upsert') !== 'false') invalid();
    return { url: target.href, credentials: 'omit' as const, headers: { 'Content-Type': mime, 'x-upsert': 'false' } };
  } catch { return invalid(); }
}
function readSession(value: unknown, request: FileSourceRequest): UploadSession {
  if (!exact(value, ['id', 'asset_id', 'protocol', 'upload_url', 'upload_headers', 'expires_at', 'status', 'maximum_bytes'])
    || typeof value.id !== 'string' || !UUID.test(value.id) || typeof value.asset_id !== 'string' || !UUID.test(value.asset_id)
    || value.protocol !== 'signed_put' || !positive(value.maximum_bytes) || value.maximum_bytes > MAXIMUM_BYTES || value.maximum_bytes < request.file.size
    || !object(value.upload_headers) || Object.values(value.upload_headers).some(header => typeof header !== 'string')
    || !['open', 'completed', 'cancelled', 'expired'].includes(String(value.status))
    || typeof value.expires_at !== 'string' || !Number.isFinite(Date.parse(value.expires_at))
    || (value.status === 'open' ? typeof value.upload_url !== 'string' : value.upload_url !== null || Object.keys(value.upload_headers).length !== 0)
    || request.session && (value.id !== request.session.id || value.asset_id !== request.session.asset_id)) invalid();
  return structuredClone(value) as unknown as UploadSession;
}
function readReady(value: unknown, request: FileSourceRequest): MediaAsset {
  if (!exact(value, ['asset', 'processing_job_id', 'status'])) return invalid();
  if (value.status !== 'ready' || value.processing_job_id !== null
    || !exact(value.asset, ['id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256', 'status', 'duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms', 'created_at'])) return invalid();
  const asset = value.asset;
  if (asset.id !== request.session?.asset_id || asset.purpose !== 'specs' || asset.status !== 'ready' || asset.filename !== request.file.name
    || asset.mime_type !== request.mimeType || asset.size_bytes !== request.file.size || asset.sha256 !== request.sha256
    || ['duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms'].some(key => asset[key] !== null)
    || typeof asset.created_at !== 'string' || !Number.isFinite(Date.parse(asset.created_at))) invalid();
  return structuredClone(asset) as unknown as MediaAsset;
}
export function rebaseFileSource(request: FileSourceRequest, spec: SourceScope, createKey: () => string) {
  if (!request.ready || request.accepted || !request.sourceConflict || spec.id !== request.specId || spec.workspace_id !== request.workspaceId || !positive(spec.row_version)) invalid();
  request.specVersion = spec.row_version; request.submitKey = createKey(); request.sourceConflict = false;
}
/** Checkpoint confirmed steps only. Unknown writes retain their exact body/key;
 * an uncertain immutable PUT is checked by completion before any byte retry. */
export async function runFileSource(request: FileSourceRequest, ports: FileSourcePorts, suppliedSignal?: AbortSignal, phase?: (value: Phase) => void): Promise<SourceAccepted> {
  const signal = suppliedSignal ?? AbortSignal.timeout(120_000);
  const move = (value: Phase) => { request.lastOperation = value; phase?.(value); };
  const post = async (path: string, body: string, key: string) => (await ports.json(path, { method: 'POST', body, headers: { 'Idempotency-Key': key }, signal })).data;
  if (request.sourceConflict) invalid();
  if (!request.session) { move('reserving'); request.session = readSession(await post('/api/v1/uploads', request.reserveBody, request.reserveKey), request); }
  const complete = async () => { move('verifying'); request.ready = readReady(await post(`/api/v1/uploads/${encodeURIComponent(request.session!.id)}/complete`, request.completeBody, request.completeKey), request); };
  if (!request.ready) {
    if (request.session.status === 'cancelled' || request.session.status === 'expired') throw new FileSourceError('UPLOAD_CLOSED');
    if (request.transferAttempted || request.session.status === 'completed') {
      try { await complete(); }
      catch (error) {
        if (!(error instanceof ApiError && error.status === 409 && error.code === 'UPLOAD_INCOMPLETE' && request.session.status === 'open')) throw error;
        request.transferAttempted = false;
        request.session = readSession((await ports.json(`/api/v1/uploads/${encodeURIComponent(request.session.id)}`, { signal })).data, request);
      }
    }
    if (!request.ready) {
      if (request.session.status !== 'open') throw new FileSourceError('UPLOAD_CLOSED');
      const destination = specsTransferDestination(request.session, ports.storageOrigin, request.mimeType);
      move('uploading'); request.transferAttempted = true;
      const response = await ports.put(destination.url, { method: 'PUT', body: request.file, headers: destination.headers,
        credentials: destination.credentials, redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store', signal });
      void response.body?.cancel().catch(() => undefined);
      if (!response.ok) throw new FileSourceError('UPLOAD_UNCONFIRMED');
      await complete();
    }
  }
  if (!request.accepted) {
    move('submitting');
    try { request.accepted = readSourceAccepted(await post(`/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/specs`,
      JSON.stringify({ source_asset_id: request.ready!.id, row_version: request.specVersion }), request.submitKey), request.specId); }
    catch (error) { if (error instanceof ApiError && error.status === 409) request.sourceConflict = true; throw error; }
  }
  move('accepted'); return request.accepted;
}
