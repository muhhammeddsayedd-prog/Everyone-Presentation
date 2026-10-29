import { createHash } from 'node:crypto';
import type { MediaAsset } from '@eps/domain';
import { prepareDocumentIsolated } from './process.ts';
import { DocumentPreparationError, type PreparedDocument } from './types.ts';
import type { DocumentPreparationResult, DocumentStoragePort } from './storage.ts';

const ORIGIN = 'https://pyibofyctwnqpvktepse.supabase.co';
const MAXIMUM = 20 * 1024 * 1024;
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const FORMATS = { 'application/pdf': 'pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'text/plain': 'txt' } as const;
export type SpecsSourceMime = keyof typeof FORMATS;
export interface SpecsAssetScope { job_id: string; attempt_id: string; lease_token: string }
export interface SpecsFileInput { source_asset_id: string; source_sha256: string; mime_type: SpecsSourceMime; size_bytes: number }
export interface ServiceAssetAccess {
  asset_id: string; url: string; method: 'GET' | 'POST'; headers: Record<string, string>; expires_at: string;
  mime_type: string; size_bytes: number; sha256: string | null;
}
export interface SpecsAssetPort {
  getAssetAccess(input: SpecsAssetScope & { asset_id: string; access?: 'read' | 'write' }, signal: AbortSignal): Promise<unknown>;
  reserveOutput(input: Parameters<DocumentStoragePort['reserveOutput']>[0], signal: AbortSignal): Promise<unknown>;
  completeOutput(input: Parameters<DocumentStoragePort['completeOutput']>[0], signal: AbortSignal): Promise<unknown>;
  storePreparation(input: SpecsAssetScope & { asset_id: string; payload_utf8: string }, signal: AbortSignal): Promise<unknown>;
}
export interface SpecsAssetOptions { publishableKey: string; fetch?: typeof fetch; signal?: AbortSignal; timeoutMs?: number; now?: () => number }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, fields: string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAXIMUM;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function invalid(): never { throw new DocumentPreparationError('INVALID_SOURCE_REFERENCE', 'The scoped private document capability could not be confirmed.'); }
function transferFailure(): never { throw new DocumentPreparationError('DOCUMENT_PROCESS_FAILED', 'The private document transfer could not be confirmed. The original was retained.', true); }
function scopeValue(scope: SpecsAssetScope): SpecsAssetScope {
  if (!exact(scope, ['job_id', 'attempt_id', 'lease_token']) || !ID.test(scope.job_id) || !ID.test(scope.attempt_id)
    || typeof scope.lease_token !== 'string' || !/^[^\s\p{C}]{1,1024}$/u.test(scope.lease_token)) invalid();
  return { ...scope };
}
interface AccessExpectation { scope: SpecsAssetScope; assetId: string; mode: 'original' | 'output'; method: 'GET' | 'POST'; mime: string; size: number; hash: string | null; pendingOutput?: boolean }
/** Parse a mapped capability, not an arbitrary fetch destination. Public API
 * headers must equal the configured publishable key; no user/anon/service JWT. */
export function parseServiceAssetAccess(value: unknown, expected: AccessExpectation, options: SpecsAssetOptions): ServiceAssetAccess {
  scopeValue(expected.scope);
  if (expected.pendingOutput && (expected.mode !== 'output' || expected.method !== 'GET')) invalid();
  if (!exact(value, ['asset_id', 'url', 'method', 'headers', 'expires_at', 'mime_type', 'size_bytes', 'sha256']) || !ID.test(expected.assetId)
    || value.asset_id !== expected.assetId || value.method !== expected.method || value.mime_type !== expected.mime || value.size_bytes !== expected.size
    || !positive(value.size_bytes) || typeof value.url !== 'string' || typeof value.expires_at !== 'string'
    || !Number.isFinite(Date.parse(value.expires_at)) || Date.parse(value.expires_at) <= (options.now ?? Date.now)()
    || !(value.sha256 === null || typeof value.sha256 === 'string' && HASH.test(value.sha256))
    || expected.method === 'GET' && value.sha256 !== expected.hash && !(expected.pendingOutput === true && value.sha256 === null)
    || expected.method === 'POST' && value.sha256 !== null && value.sha256 !== expected.hash
    || !/^sb_publishable_[A-Za-z0-9_-]+$/u.test(options.publishableKey) || options.publishableKey.length > 4096 || !object(value.headers)) invalid();
  const extension = FORMATS[expected.mime as SpecsSourceMime];
  if (expected.mode === 'original' && !extension || expected.mode === 'output' && expected.mime !== 'application/json') invalid();
  const bucket = expected.mode === 'original' ? 'eps-specs-assets' : 'eps-specs-outputs';
  const key = expected.mode === 'original' ? `assets/${expected.assetId}/original.${extension}`
    : `jobs/${expected.scope.job_id}/attempts/${expected.scope.attempt_id}/${expected.assetId}.json`;
  const url = `${ORIGIN}/storage/v1/object/${expected.method === 'GET' ? 'authenticated/' : ''}${bucket}/${key}`;
  if (value.url !== url) invalid();
  const headers: Record<string, string> = {};
  for (const [name, entry] of Object.entries(value.headers)) {
    const lowered = name.toLowerCase();
    if (Object.hasOwn(headers, lowered) || typeof entry !== 'string' || !entry || entry.length > 8192 || /[\r\n\0]/u.test(entry)) invalid();
    headers[lowered] = entry;
  }
  const fields = expected.method === 'GET' ? ['apikey', 'authorization', 'x-eps-asset-grant'] : ['apikey', 'authorization', 'x-eps-asset-grant', 'content-type', 'x-upsert'];
  if (!exact(headers, fields) || headers.apikey !== options.publishableKey || headers.authorization !== `Bearer ${options.publishableKey}`
    || !/^[^\s\p{C}]{1,2048}$/u.test(headers['x-eps-asset-grant'])
    || expected.method === 'POST' && (headers['content-type'] !== 'application/json' || headers['x-upsert'] !== 'false')) invalid();
  return { asset_id: value.asset_id as string, url, method: expected.method, headers, expires_at: value.expires_at,
    mime_type: value.mime_type as string, size_bytes: value.size_bytes, sha256: value.sha256 as string | null };
}

async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, options: SpecsAssetOptions, expires?: string): Promise<T> {
  const maximum = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 30_000) invalid();
  const milliseconds = expires ? Math.min(maximum, Date.parse(expires) - (options.now ?? Date.now)()) : maximum;
  if (milliseconds <= 0 || options.signal?.aborted) transferFailure();
  const controller = new AbortController(); let rejectWait: (() => void) | undefined;
  const stop = () => { controller.abort(); rejectWait?.(); };
  const interruption = new Promise<never>((_resolve, reject) => { rejectWait = () => reject(new DocumentPreparationError('DOCUMENT_PROCESS_FAILED', 'The private document transfer could not be confirmed. The original was retained.', true)); });
  const timer = setTimeout(stop, milliseconds); options.signal?.addEventListener('abort', stop, { once: true });
  try { return await Promise.race([operation(controller.signal), interruption]); }
  finally { clearTimeout(timer); options.signal?.removeEventListener('abort', stop); }
}
async function readAccess(access: ServiceAssetAccess, expectedHash: string, options: SpecsAssetOptions): Promise<Uint8Array> {
  if (!HASH.test(expectedHash)) invalid();
  return await bounded(async signal => {
    let response: Response | undefined;
    try {
      response = await (options.fetch ?? fetch)(access.url, { method: 'GET', headers: { ...access.headers, 'Accept-Encoding': 'identity' }, redirect: 'error', signal });
      if (signal.aborted || response.status !== 200 || (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== access.mime_type) transferFailure();
      const length = response.headers.get('content-length');
      if (length !== null && (!/^[0-9]+$/u.test(length) || Number(length) !== access.size_bytes)) transferFailure();
      const reader = response.body?.getReader(); if (!reader) transferFailure();
      const cancel = () => { void reader.cancel().catch(() => undefined); }; signal.addEventListener('abort', cancel, { once: true });
      const parts: Uint8Array[] = []; let total = 0;
      try { for (;;) { const part = await reader.read(); if (part.done) break; total += part.value.byteLength;
        if (signal.aborted || total > MAXIMUM || total > access.size_bytes) transferFailure(); parts.push(part.value);
      } } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
      if (signal.aborted || total !== access.size_bytes) transferFailure();
      const bytes = new Uint8Array(total); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; }
      if (sha(bytes) !== expectedHash) invalid(); return bytes;
    } catch (error) { if (error instanceof DocumentPreparationError) throw error; transferFailure(); }
    finally { void response?.body?.cancel().catch(() => undefined); }
  }, options, access.expires_at);
}
async function writeAccess(access: ServiceAssetAccess, bytes: Uint8Array, options: SpecsAssetOptions): Promise<void> {
  await bounded(async signal => {
    let response: Response | undefined;
    try { response = await (options.fetch ?? fetch)(access.url, { method: 'POST', headers: access.headers, redirect: 'error',
      body: Buffer.from(bytes), signal });
      if (signal.aborted || ![200, 201].includes(response.status)) transferFailure();
    } catch (error) { if (error instanceof DocumentPreparationError) throw error; transferFailure(); }
    finally { void response?.body?.cancel().catch(() => undefined); }
  }, options, access.expires_at);
}
function outputAsset(value: unknown, input: SpecsFileInput, size: number, digest: string): MediaAsset {
  if (!exact(value, ['id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256', 'status', 'duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms', 'created_at'])
    || !ID.test(value.id as string) || value.purpose !== 'document_text' || value.filename !== 'prepared-document.json' || value.mime_type !== 'application/json'
    || value.size_bytes !== size || !['uploading', 'ready'].includes(String(value.status)) || value.source_asset_id !== input.source_asset_id
    || value.duration_ms !== null || value.width !== null || value.height !== null || value.source_timestamp_ms !== null
    || typeof value.created_at !== 'string' || !Number.isFinite(Date.parse(value.created_at))
    || value.status === 'ready' && value.sha256 !== digest || value.status === 'uploading' && value.sha256 !== null) invalid();
  return structuredClone(value) as unknown as MediaAsset;
}
/** PostgreSQL JSONB rejects NUL/lone surrogates. Reject those before a private
 * serialized JSON payload can become an SQL JSON-error CONTEXT fragment. */
export function serializeSpecsPreparation(prepared: PreparedDocument): string {
  for (const value of [prepared.text, ...prepared.paragraphs.map(paragraph => paragraph.text), ...prepared.warnings]) {
    for (const character of value) {
      const point = character.codePointAt(0)!;
      if (point === 0 || point >= 0xd800 && point <= 0xdfff) throw new DocumentPreparationError('SOURCE_UNREADABLE', 'The extracted document contains invalid Unicode. Replace the source or paste valid text.');
    }
  }
  return JSON.stringify({ schema_version: 'document-text-v1', ...prepared });
}

/** Standalone file preparation only. Existing text execution is untouched.
 * Original/output bytes are verified before parser/complete respectively; only
 * exact refs leave this helper. Raw prepared JSON uses the private scoped port. */
export async function prepareSpecsFileStage(supplied: SpecsFileInput, suppliedScope: SpecsAssetScope, port: SpecsAssetPort,
  options: SpecsAssetOptions): Promise<DocumentPreparationResult> {
  const scope = scopeValue(suppliedScope);
  if (!exact(supplied, ['source_asset_id', 'source_sha256', 'mime_type', 'size_bytes']) || !ID.test(supplied.source_asset_id)
    || !HASH.test(supplied.source_sha256) || !Object.hasOwn(FORMATS, supplied.mime_type) || !positive(supplied.size_bytes)) invalid();
  const input = { ...supplied };
  try {
    const original = parseServiceAssetAccess(await bounded(signal => port.getAssetAccess({ ...scope, asset_id: input.source_asset_id, access: 'read' }, signal), options),
      { scope, assetId: input.source_asset_id, mode: 'original', method: 'GET', mime: input.mime_type, size: input.size_bytes, hash: input.source_sha256 }, options);
    const source = await readAccess(original, input.source_sha256, options);
    const prepared = await prepareDocumentIsolated({ sourceKind: 'asset', sourceAssetId: input.source_asset_id, mimeType: input.mime_type, bytes: source }, { signal: options.signal });
    const payload = serializeSpecsPreparation(prepared); const bytes = Buffer.from(payload, 'utf8');
    if (!positive(bytes.length)) invalid(); const digest = sha(bytes);
    const reservation = await bounded(signal => port.reserveOutput({ ...scope, output_key: 'document_text', asset_kind: 'document_text', filename: 'prepared-document.json',
      mime_type: 'application/json', expected_size_bytes: bytes.length, parent_asset_id: input.source_asset_id, time_offset_ms: null }, signal), options);
    if (!exact(reservation, ['asset', 'access'])) invalid();
    const asset = outputAsset(reservation.asset, input, bytes.length, digest);
    const ready = asset.status === 'ready';
    const access = parseServiceAssetAccess(reservation.access, { scope, assetId: asset.id, mode: 'output', method: ready ? 'GET' : 'POST',
      mime: 'application/json', size: bytes.length, hash: digest }, options);
    if (!ready) await writeAccess(access, bytes, options);
    const read = ready ? access : parseServiceAssetAccess(await bounded(signal => port.getAssetAccess({ ...scope, asset_id: asset.id, access: 'read' }, signal), options),
      { scope, assetId: asset.id, mode: 'output', method: 'GET', mime: 'application/json', size: bytes.length, hash: digest, pendingOutput: true }, options);
    const stored = await readAccess(read, digest, options);
    if (!Buffer.from(stored).equals(bytes)) invalid();
    const complete = outputAsset(await bounded(signal => port.completeOutput({ ...scope, asset_id: asset.id, sha256: digest,
      actual_size_bytes: bytes.length, width: null, height: null, duration_ms: null }, signal), options), input, bytes.length, digest);
    if (complete.id !== asset.id || complete.status !== 'ready') invalid();
    const saved = await bounded(signal => port.storePreparation({ ...scope, asset_id: asset.id, payload_utf8: payload }, signal), options);
    if (!exact(saved, ['stored']) || saved.stored !== true) invalid();
    return { source_asset_id: input.source_asset_id, text_asset_id: asset.id, page_assets: [], paragraph_count: prepared.paragraphs.length,
      extraction_method: prepared.extractionMethod, warnings: prepared.warnings };
  } catch (error) { if (error instanceof DocumentPreparationError) throw error; transferFailure(); }
}
