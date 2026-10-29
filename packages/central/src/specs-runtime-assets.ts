import type { MediaAsset } from '@eps/domain';
import { SpecsRuntimeGatewayError } from './specs-runtime-gateway.ts';

export type SpecsAssetOperation = 'access' | 'reserve' | 'complete' | 'prepare';
export interface SpecsRuntimeAssetConfig { storageOrigin: string; publishableKey: string }
export interface SpecsAssetScope { job_id: string; attempt_id: string; lease_token: string }
export interface SpecsOutputInput extends SpecsAssetScope {
  output_key: 'document_text'; asset_kind: 'document_text'; filename: string; mime_type: 'application/json';
  expected_size_bytes: number; parent_asset_id: string | null; time_offset_ms: null;
}
/** Internal adapter seam only. The real factory maps this closed enum to four
 * fixed parameterized operations on the already verified SCRAM connection. */
export type SpecsAssetCall = (operation: SpecsAssetOperation, input: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
const ORIGIN = 'https://pyibofyctwnqpvktepse.supabase.co';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const MAXIMUM = 20 * 1024 * 1024;
const MIME = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, fields: string[]): value is Record<string, unknown> => object(value)
  && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
function fail(code = 'INVALID_REQUEST', outcome: 'known' | 'unknown' = 'known'): never { throw new SpecsRuntimeGatewayError(code, code === 'INVALID_REQUEST' ? 400 : 503, outcome); }
const id = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const size = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAXIMUM;
function scope(input: SpecsAssetScope): void {
  if (!object(input) || !id(input.job_id) || !id(input.attempt_id) || typeof input.lease_token !== 'string' || !/^[a-f0-9]{64}$/u.test(input.lease_token)) fail();
}
function destination(bucket: unknown, key: unknown, assetId: string, input: SpecsAssetScope, mime: unknown): string {
  if (typeof key !== 'string') fail('RUNTIME_RESPONSE_INVALID', 'unknown');
  if (bucket === 'eps-specs-assets') {
    const extension = ['pdf', 'docx', 'txt'][MIME.indexOf(String(mime))];
    if (!extension || key !== `assets/${assetId}/original.${extension}`) fail('RUNTIME_RESPONSE_INVALID', 'unknown');
  } else if (bucket !== 'eps-specs-outputs' || mime !== 'application/json'
    || key !== `jobs/${input.job_id}/attempts/${input.attempt_id}/${assetId}.json`) fail('RUNTIME_RESPONSE_INVALID', 'unknown');
  return key;
}
function asset(value: unknown, input: SpecsOutputInput | (SpecsAssetScope & { asset_id: string; sha256: string; actual_size_bytes: number })): MediaAsset {
  if (!exact(value, ['id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256', 'status', 'duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms', 'created_at'])
    || !id(value.id) || value.purpose !== 'document_text' || value.filename !== 'prepared-document.json' || value.mime_type !== 'application/json'
    || !size(value.size_bytes) || !['uploading', 'ready'].includes(String(value.status)) || !id(value.source_asset_id)
    || value.duration_ms !== null || value.width !== null || value.height !== null || value.source_timestamp_ms !== null
    || typeof value.created_at !== 'string' || !Number.isFinite(Date.parse(value.created_at))
    || value.status === 'uploading' && value.sha256 !== null || value.status === 'ready' && (typeof value.sha256 !== 'string' || !HASH.test(value.sha256))) fail('RUNTIME_RESPONSE_INVALID', 'unknown');
  if ('output_key' in input ? value.size_bytes !== input.expected_size_bytes || value.source_asset_id !== input.parent_asset_id
    : value.id !== input.asset_id || value.status !== 'ready' || value.size_bytes !== input.actual_size_bytes || value.sha256 !== input.sha256) fail('RUNTIME_RESPONSE_INVALID', 'unknown');
  return structuredClone(value) as unknown as MediaAsset;
}

/** Public configuration is explicit and fixed-target; no ambient user JWT,
 * service key, URL signing authority or provider environment is consulted. */
export function createSpecsRuntimeAssets(supplied: SpecsRuntimeAssetConfig, call: SpecsAssetCall) {
  if (typeof window !== 'undefined' || !exact(supplied, ['storageOrigin', 'publishableKey']) || supplied.storageOrigin !== ORIGIN
    || typeof supplied.publishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]{8,}$/u.test(supplied.publishableKey)
    || supplied.publishableKey.length > 4096 || typeof call !== 'function') fail('RUNTIME_CONFIG_INVALID');
  const config = { ...supplied };
  async function getAssetAccess(input: SpecsAssetScope & { asset_id: string; access?: 'read' | 'write' }, signal: AbortSignal) {
    scope(input);
    if (!object(input) || Object.keys(input).some(key => !['job_id', 'attempt_id', 'lease_token', 'asset_id', 'access'].includes(key))
      || !id(input.asset_id) || input.access !== undefined && !['read', 'write'].includes(input.access)) fail();
    const permission = input.access ?? 'read';
    const value = await call('access', { ...input }, signal);
    if (!exact(value, ['asset_id', 'bucket', 'object_key', 'permission', 'grant_token', 'expires_at', 'mime_type', 'size_bytes', 'sha256'])
      || value.asset_id !== input.asset_id || value.permission !== permission || !size(value.size_bytes)
      || typeof value.grant_token !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(value.grant_token)
      || typeof value.expires_at !== 'string' || !Number.isFinite(Date.parse(value.expires_at))
      || Date.parse(value.expires_at) <= Date.now() || Date.parse(value.expires_at) > Date.now() + 90_000
      || !(value.sha256 === null || typeof value.sha256 === 'string' && HASH.test(value.sha256))
      || value.bucket === 'eps-specs-assets' && (permission !== 'read' || value.sha256 === null)
      || permission === 'write' && (value.bucket !== 'eps-specs-outputs' || value.sha256 !== null)) fail('RUNTIME_RESPONSE_INVALID', 'unknown');
    const key = destination(value.bucket, value.object_key, input.asset_id, input, value.mime_type);
    const method = permission === 'write' ? 'POST' as const : 'GET' as const;
    return { asset_id: input.asset_id, url: `${config.storageOrigin}/storage/v1/object/${method === 'GET' ? 'authenticated/' : ''}${value.bucket}/${key}`, method,
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-eps-asset-grant': value.grant_token,
        ...(method === 'POST' ? { 'Content-Type': 'application/json', 'x-upsert': 'false' } : {}) },
      expires_at: value.expires_at, mime_type: value.mime_type as string, size_bytes: value.size_bytes, sha256: value.sha256 as string | null };
  }
  return {
    getAssetAccess,
    async reserveOutput(input: SpecsOutputInput, signal: AbortSignal) {
      scope(input);
      if (!exact(input, ['job_id', 'attempt_id', 'lease_token', 'output_key', 'asset_kind', 'filename', 'mime_type', 'expected_size_bytes', 'parent_asset_id', 'time_offset_ms'])
        || input.output_key !== 'document_text' || input.asset_kind !== 'document_text' || input.filename !== 'prepared-document.json'
        || input.mime_type !== 'application/json' || !size(input.expected_size_bytes) || !id(input.parent_asset_id) || input.time_offset_ms !== null) fail();
      const result = await call('reserve', { ...input }, signal);
      if (!exact(result, ['asset', 'bucket', 'object_key'])) fail('RUNTIME_RESPONSE_INVALID', 'unknown');
      const item = asset(result.asset, input); destination(result.bucket, result.object_key, item.id, input, item.mime_type);
      return { asset: item, access: await getAssetAccess({ job_id: input.job_id, attempt_id: input.attempt_id, lease_token: input.lease_token,
        asset_id: item.id, access: item.status === 'ready' ? 'read' : 'write' }, signal) };
    },
    async completeOutput(input: SpecsAssetScope & { asset_id: string; sha256: string; actual_size_bytes: number; width: null; height: null; duration_ms: null }, signal: AbortSignal) {
      scope(input);
      if (!exact(input, ['job_id', 'attempt_id', 'lease_token', 'asset_id', 'sha256', 'actual_size_bytes', 'width', 'height', 'duration_ms'])
        || !id(input.asset_id) || typeof input.sha256 !== 'string' || !HASH.test(input.sha256) || !size(input.actual_size_bytes) || input.width !== null || input.height !== null || input.duration_ms !== null) fail();
      return asset(await call('complete', { ...input }, signal), input);
    },
    async storePreparation(input: SpecsAssetScope & { asset_id: string; payload_utf8: string }, signal: AbortSignal) {
      scope(input);
      if (!exact(input, ['job_id', 'attempt_id', 'lease_token', 'asset_id', 'payload_utf8']) || !id(input.asset_id) || typeof input.payload_utf8 !== 'string'
        || Buffer.byteLength(input.payload_utf8, 'utf8') < 1 || Buffer.byteLength(input.payload_utf8, 'utf8') > MAXIMUM) fail();
      for (const character of input.payload_utf8) {
        const point = character.codePointAt(0)!; if (point === 0 || point >= 0xd800 && point <= 0xdfff) fail();
      }
      const result = await call('prepare', { ...input }, signal);
      if (!exact(result, ['stored']) || result.stored !== true) fail('RUNTIME_RESPONSE_INVALID', 'unknown'); return { stored: true };
    },
  };
}
export type SpecsRuntimeAssets = ReturnType<typeof createSpecsRuntimeAssets>;
