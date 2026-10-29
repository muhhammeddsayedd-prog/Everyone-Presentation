import { createHash } from 'node:crypto';
import type { FrozenAsset } from '../../../packages/domain/src/presentation-types.ts';
import type { PresentationOutputInput, PresentationCompleteInput } from '../../../packages/central/src/presentation-runtime-assets.ts';
import type { CandidateStageScope } from './candidate-stage-executor.ts';
export interface PresentationArtifact { asset_id: string; sha256: string; size_bytes: number; mime_type: string }
export interface PresentationStageAssets {
  read(scope: CandidateStageScope, asset: FrozenAsset | PresentationArtifact, signal: AbortSignal): Promise<Uint8Array>;
  write(scope: CandidateStageScope, output: { purpose: 'presentation_manifest' | 'presentation_pdf'; bytes: Uint8Array; sha256: string }, signal: AbortSignal): Promise<PresentationArtifact>;
}
export interface PresentationFilesPort {
  getAssetAccess(input: CandidateStageScope & { asset_id: string; access: 'read' | 'write' }, signal: AbortSignal): Promise<unknown>;
  reserveOutput(input: PresentationOutputInput, signal: AbortSignal): Promise<unknown>;
  completeOutput(input: PresentationCompleteInput, signal: AbortSignal): Promise<unknown>;
}
export class PresentationAssetError extends Error { constructor(readonly code: 'PDF_ASSET_CAPABILITY_INVALID' | 'PDF_ASSET_TRANSFER_FAILED', readonly retryable = false) { super('The fixed presentation asset transfer could not be verified. Existing files remain unchanged.'); this.name = 'PresentationAssetError'; } }
const ORIGIN = 'https://pyibofyctwnqpvktepse.supabase.co'; const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u; const HASH = /^[a-f0-9]{64}$/u;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function invalid(): never { throw new PresentationAssetError('PDF_ASSET_CAPABILITY_INVALID'); }
function transfer(): never { throw new PresentationAssetError('PDF_ASSET_TRANSFER_FAILED', true); }
const maximum = (mime: string) => mime === 'application/pdf' ? 67108864 : mime === 'application/json' ? 8388608 : ['image/jpeg', 'image/png', 'image/webp'].includes(mime) ? 20971520 : 0;
interface Reference extends PresentationArtifact { bucket?: string; object_key?: string }
interface Access { url: string; method: 'GET' | 'POST'; headers: Record<string, string>; expires_at: string }
export interface PresentationAssetsConfiguration { publishableKey: string; fetch?: typeof fetch; timeoutMs?: number; now?: () => number }
function scope(value: CandidateStageScope) { if (!exact(value, ['job_id', 'attempt_id', 'lease_token']) || !UUID.test(value.job_id) || !UUID.test(value.attempt_id) || !HASH.test(value.lease_token)) invalid(); }
function reference(value: FrozenAsset | PresentationArtifact): Reference {
  const frozen = 'asset_kind' in value; const result = frozen ? { asset_id: value.asset_id, sha256: value.sha256, size_bytes: value.byte_size, mime_type: value.mime_type, bucket: value.bucket, object_key: value.object_key } : value;
  if (!UUID.test(result.asset_id) || !HASH.test(result.sha256) || !Number.isSafeInteger(result.size_bytes) || result.size_bytes < 1 || result.size_bytes > maximum(result.mime_type)) invalid();
  if (frozen && (value.asset_kind === 'candidate_video' || !['eps-brand-assets', 'eps-candidate-outputs'].includes(value.bucket) || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,1023}$/u.test(value.object_key) || value.object_key.split('/').some(part => !part || ['.', '..'].includes(part)))) invalid();
  return result;
}
export function parsePresentationAssetAccess(value: unknown, expected: Reference, context: { scope: CandidateStageScope; method: 'GET' | 'POST'; pending?: boolean }, configuration: PresentationAssetsConfiguration): Access {
  scope(context.scope);
  if (!UUID.test(expected.asset_id) || !HASH.test(expected.sha256) || !Number.isSafeInteger(expected.size_bytes) || expected.size_bytes < 1 || expected.size_bytes > maximum(expected.mime_type)
    || expected.bucket !== undefined && (!['eps-brand-assets', 'eps-candidate-outputs'].includes(expected.bucket) || typeof expected.object_key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,1023}$/u.test(expected.object_key) || expected.object_key.split('/').some(part => !part || ['.', '..'].includes(part)))) invalid();
  if (!exact(value, ['asset_id', 'url', 'method', 'headers', 'expires_at', 'mime_type', 'size_bytes', 'sha256']) || value.asset_id !== expected.asset_id || value.method !== context.method || value.mime_type !== expected.mime_type || value.size_bytes !== expected.size_bytes
    || typeof value.url !== 'string' || typeof value.expires_at !== 'string' || !Number.isFinite(Date.parse(value.expires_at)) || Date.parse(value.expires_at) <= (configuration.now ?? Date.now)() || Date.parse(value.expires_at) > (configuration.now ?? Date.now)() + 90000
    || value.sha256 !== expected.sha256 && !(context.pending && value.sha256 === null) || !object(value.headers) || !/^sb_publishable_[A-Za-z0-9_-]{8,4096}$/u.test(configuration.publishableKey)) invalid();
  if (expected.bucket) {
    if (context.method !== 'GET' || value.url !== `${ORIGIN}/storage/v1/object/authenticated/${expected.bucket}/${expected.object_key}`) invalid();
  } else {
    const extension = expected.mime_type === 'application/pdf' ? 'pdf' : expected.mime_type === 'application/json' ? 'json' : ''; if (!extension) invalid();
    const path = context.method === 'POST' ? `jobs/${context.scope.job_id}/attempts/${context.scope.attempt_id}/${expected.asset_id}.${extension}` : null;
    const prefix = `${ORIGIN}/storage/v1/object/${context.method === 'GET' ? 'authenticated/' : ''}eps-presentation-outputs/`;
    if (path ? value.url !== prefix + path : !new RegExp(`^${prefix.replaceAll('.', '\\.')}jobs/${context.scope.job_id}/attempts/[a-f0-9-]{36}/${expected.asset_id}\\.${extension}$`, 'u').test(value.url)) invalid();
  }
  const headers: Record<string, string> = {}; for (const [key, entry] of Object.entries(value.headers)) { const name = key.toLowerCase(); if (Object.hasOwn(headers, name) || typeof entry !== 'string' || !entry || entry.length > 8192 || /[\r\n\0]/u.test(entry)) invalid(); headers[name] = entry; }
  if (!exact(headers, context.method === 'GET' ? ['apikey', 'authorization', 'x-eps-asset-grant'] : ['apikey', 'authorization', 'x-eps-asset-grant', 'content-type', 'x-upsert']) || headers.apikey !== configuration.publishableKey || headers.authorization !== `Bearer ${configuration.publishableKey}` || !/^[A-Za-z0-9_-]{43}$/u.test(headers['x-eps-asset-grant']) || context.method === 'POST' && (headers['content-type'] !== expected.mime_type || headers['x-upsert'] !== 'false')) invalid();
  return { url: value.url, method: context.method, headers, expires_at: value.expires_at };
}
export function createPresentationStageAssets(port: PresentationFilesPort, configuration: PresentationAssetsConfiguration): PresentationStageAssets {
  async function bounded<T>(signal: AbortSignal, operation: (signal: AbortSignal) => Promise<T>, expires?: string): Promise<T> {
    const configured = configuration.timeoutMs ?? 30000; if (!Number.isSafeInteger(configured) || configured < 1 || configured > 60000) invalid(); const timeout = expires ? Math.min(configured, Date.parse(expires) - (configuration.now ?? Date.now)()) : configured; if (signal.aborted || timeout <= 0) transfer();
    const request = AbortSignal.any([signal, AbortSignal.timeout(timeout)]); let abort!: () => void; const stopped = new Promise<never>((_resolve, reject) => { abort = () => reject(new PresentationAssetError('PDF_ASSET_TRANSFER_FAILED', true)); request.addEventListener('abort', abort, { once: true }); if (request.aborted) abort(); });
    try { return await Promise.race([stopped, Promise.resolve().then(() => request.aborted ? stopped : operation(request))]); } catch (error) { if (error instanceof PresentationAssetError) throw error; return transfer(); } finally { request.removeEventListener('abort', abort); }
  }
  async function body(access: Access, expected: Reference, signal: AbortSignal): Promise<Uint8Array> {
    return bounded(signal, async request => {
      let response: Response | undefined;
      try {
        response = await (configuration.fetch ?? fetch)(access.url, { method: 'GET', headers: { ...access.headers, 'Accept-Encoding': 'identity' }, redirect: 'error', signal: request });
        const length = response.headers.get('content-length'); if (request.aborted || response.status !== 200 || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== expected.mime_type || length !== null && (!/^[0-9]+$/u.test(length) || Number(length) !== expected.size_bytes)) transfer();
        const reader = response.body?.getReader(); if (!reader) return transfer(); let size = 0; const parts: Uint8Array[] = []; const cancel = () => { void reader.cancel().catch(() => undefined); }; request.addEventListener('abort', cancel, { once: true });
        try { for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (request.aborted || size > expected.size_bytes) transfer(); parts.push(chunk.value); } } finally { request.removeEventListener('abort', cancel); reader.releaseLock(); }
        const bytes = Buffer.concat(parts); if (request.aborted || size !== expected.size_bytes) transfer(); if (hash(bytes) !== expected.sha256) invalid(); return bytes;
      } finally { void response?.body?.cancel().catch(() => undefined); }
    }, access.expires_at);
  }
  function output(value: unknown, purpose: 'presentation_manifest' | 'presentation_pdf', expected: Omit<Reference, 'asset_id'>): { id: string; ready: boolean } {
    if (!exact(value, ['id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256', 'status', 'duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms', 'created_at']) || !UUID.test(String(value.id)) || value.purpose !== purpose || value.filename !== (purpose === 'presentation_pdf' ? 'presentation.pdf' : 'presentation-manifest.json') || value.mime_type !== expected.mime_type || value.size_bytes !== expected.size_bytes || !['uploading', 'ready'].includes(String(value.status)) || value.status === 'uploading' && value.sha256 !== null || value.status === 'ready' && value.sha256 !== expected.sha256 || ['duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms'].some(key => value[key] !== null) || typeof value.created_at !== 'string' || !Number.isFinite(Date.parse(value.created_at))) invalid();
    return { id: value.id as string, ready: value.status === 'ready' };
  }
  return {
    async read(context, supplied, signal) { scope(context); const expected = reference(supplied); const value = await bounded(signal, request => port.getAssetAccess({ ...context, asset_id: expected.asset_id, access: 'read' }, request)); return body(parsePresentationAssetAccess(value, expected, { scope: context, method: 'GET' }, configuration), expected, signal); },
    async write(context, input, signal) {
      scope(context); const mime_type = input.purpose === 'presentation_pdf' ? 'application/pdf' : 'application/json'; if (!['presentation_manifest', 'presentation_pdf'].includes(input.purpose) || !(input.bytes instanceof Uint8Array) || !input.bytes.length || input.bytes.length > maximum(mime_type) || hash(input.bytes) !== input.sha256) invalid();
      const initial = { mime_type, sha256: input.sha256, size_bytes: input.bytes.length };
      const reserved = await bounded(signal, request => port.reserveOutput({ ...context, output_key: input.purpose, asset_kind: input.purpose, filename: input.purpose === 'presentation_pdf' ? 'presentation.pdf' : 'presentation-manifest.json', mime_type, expected_size_bytes: input.bytes.length, parent_asset_id: null, time_offset_ms: null }, request));
      if (!exact(reserved, ['asset', 'access'])) return invalid(); const saved = output(reserved.asset, input.purpose, initial); const expected = { ...initial, asset_id: saved.id };
      const access = parsePresentationAssetAccess(reserved.access, expected, { scope: context, method: saved.ready ? 'GET' : 'POST', pending: !saved.ready }, configuration);
      if (!saved.ready) await bounded(signal, async request => { let response: Response | undefined; try { response = await (configuration.fetch ?? fetch)(access.url, { method: 'POST', headers: access.headers, redirect: 'error', body: Buffer.from(input.bytes), signal: request }); if (request.aborted || ![200, 201].includes(response.status)) transfer(); } finally { void response?.body?.cancel().catch(() => undefined); } }, access.expires_at);
      const read = saved.ready ? access : parsePresentationAssetAccess(await bounded(signal, request => port.getAssetAccess({ ...context, asset_id: expected.asset_id, access: 'read' }, request)), expected, { scope: context, method: 'GET', pending: true }, configuration);
      const downloaded = await body(read, expected, signal); if (!Buffer.from(downloaded).equals(Buffer.from(input.bytes))) invalid();
      const completed = output(await bounded(signal, request => port.completeOutput({ ...context, asset_id: expected.asset_id, sha256: expected.sha256, actual_size_bytes: expected.size_bytes, width: null, height: null, duration_ms: null }, request)), input.purpose, expected);
      if (!completed.ready || completed.id !== expected.asset_id) invalid(); return expected;
    },
  };
}
