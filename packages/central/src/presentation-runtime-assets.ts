import type { MediaAsset } from '../../domain/src/types.ts';
import type { SpecsAssetCall, SpecsAssetScope, SpecsRuntimeAssetConfig } from './specs-runtime-assets.ts';
import { SpecsRuntimeGatewayError } from './specs-runtime-gateway.ts';
export interface PresentationOutputInput extends SpecsAssetScope { output_key: 'presentation_manifest' | 'presentation_pdf'; asset_kind: 'presentation_manifest' | 'presentation_pdf'; filename: string; mime_type: string; expected_size_bytes: number; parent_asset_id: null; time_offset_ms: null }
export interface PresentationCompleteInput extends SpecsAssetScope { asset_id: string; sha256: string; actual_size_bytes: number; width: null; height: null; duration_ms: null }
const ORIGIN = 'https://pyibofyctwnqpvktepse.supabase.co'; const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u; const HASH = /^[a-f0-9]{64}$/u;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const id = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const size = (value: unknown, maximum = 268435456): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= maximum;
function fail(code = 'INVALID_REQUEST'): never { throw new SpecsRuntimeGatewayError(code, code === 'INVALID_REQUEST' ? 400 : 503, 'known'); }
function scope(value: SpecsAssetScope) { if (!object(value) || !id(value.job_id) || !id(value.attempt_id) || !HASH.test(value.lease_token)) fail(); }
const extension = (mime: unknown) => new Map<unknown, string>([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['video/mp4', 'mp4'], ['video/quicktime', 'mov'], ['video/webm', 'webm'], ['video/x-matroska', 'mkv'], ['application/json', 'json'], ['application/pdf', 'pdf']]).get(mime);
function destination(bucket: unknown, key: unknown, assetId: string, mime: unknown, input: SpecsAssetScope, write: boolean) {
  const ext = extension(mime); if (!ext || typeof key !== 'string') fail('RUNTIME_RESPONSE_INVALID');
  if (bucket === 'eps-presentation-outputs') {
    if (!['json', 'pdf'].includes(ext!) || !(write ? key === `jobs/${input.job_id}/attempts/${input.attempt_id}/${assetId}.${ext}` : new RegExp(`^jobs/${input.job_id}/attempts/[a-f0-9-]{36}/${assetId}\\.${ext}$`, 'u').test(key as string))) fail('RUNTIME_RESPONSE_INVALID');
  } else {
    if (write) fail('RUNTIME_RESPONSE_INVALID');
    if (bucket === 'eps-brand-assets') { if (!['jpg', 'png', 'webp'].includes(ext!) || key !== `assets/${assetId}/original.${ext}`) fail('RUNTIME_RESPONSE_INVALID'); }
    else if (bucket === 'eps-candidate-assets') { if (!['mp4', 'mov', 'webm', 'mkv'].includes(ext!) || key !== `assets/${assetId}/original.${ext}`) fail('RUNTIME_RESPONSE_INVALID'); }
    else if (bucket !== 'eps-candidate-outputs' || ext !== 'jpg' || !new RegExp(`^jobs/[a-f0-9-]{36}/attempts/[a-f0-9-]{36}/${assetId}\\.jpg$`, 'u').test(key as string)) fail('RUNTIME_RESPONSE_INVALID');
  }
  return key as string;
}
function asset(value: unknown): MediaAsset {
  if (!exact(value, ['id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256', 'status', 'duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms', 'created_at'])
    || !id(value.id) || !['presentation_manifest', 'presentation_pdf'].includes(String(value.purpose)) || value.mime_type !== (value.purpose === 'presentation_pdf' ? 'application/pdf' : 'application/json')
    || value.filename !== (value.purpose === 'presentation_pdf' ? 'presentation.pdf' : 'presentation-manifest.json') || !size(value.size_bytes, value.purpose === 'presentation_pdf' ? 67108864 : 8388608)
    || !['uploading', 'ready'].includes(String(value.status)) || value.status === 'uploading' && value.sha256 !== null || value.status === 'ready' && (typeof value.sha256 !== 'string' || !HASH.test(value.sha256))
    || ['duration_ms', 'width', 'height', 'source_asset_id', 'source_timestamp_ms'].some(key => value[key] !== null) || typeof value.created_at !== 'string' || !Number.isFinite(Date.parse(value.created_at))) fail('RUNTIME_RESPONSE_INVALID');
  return structuredClone(value) as unknown as MediaAsset;
}
export function createPresentationRuntimeAssets(config: SpecsRuntimeAssetConfig, call: SpecsAssetCall) {
  if (!exact(config, ['storageOrigin', 'publishableKey']) || config.storageOrigin !== ORIGIN || !/^sb_publishable_[A-Za-z0-9_-]{8,4096}$/u.test(config.publishableKey)) fail('RUNTIME_CONFIG_INVALID');
  async function getAssetAccess(input: SpecsAssetScope & { asset_id: string; access: 'read' | 'write' }, signal: AbortSignal) {
    scope(input); if (!exact(input, ['job_id', 'attempt_id', 'lease_token', 'asset_id', 'access']) || !id(input.asset_id) || !['read', 'write'].includes(input.access)) fail();
    const value = await call('access', { ...input }, signal); const write = input.access === 'write';
    if (!exact(value, ['asset_id', 'bucket', 'object_key', 'permission', 'grant_token', 'expires_at', 'mime_type', 'size_bytes', 'sha256']) || value.asset_id !== input.asset_id || value.permission !== input.access
      || typeof value.grant_token !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(value.grant_token) || typeof value.expires_at !== 'string' || !Number.isFinite(Date.parse(value.expires_at)) || Date.parse(value.expires_at) <= Date.now() || Date.parse(value.expires_at) > Date.now() + 90000
      || !size(value.size_bytes, value.mime_type === 'application/pdf' ? 67108864 : value.mime_type === 'application/json' ? 8388608 : value.bucket === 'eps-candidate-assets' ? 268435456 : 20971520)
      || !(value.sha256 === null || typeof value.sha256 === 'string' && HASH.test(value.sha256)) || !write && value.bucket !== 'eps-presentation-outputs' && value.sha256 === null || write && (value.bucket !== 'eps-presentation-outputs' || value.sha256 !== null)) fail('RUNTIME_RESPONSE_INVALID');
    const key = destination(value.bucket, value.object_key, input.asset_id, value.mime_type, input, write);
    return { asset_id: input.asset_id, url: `${ORIGIN}/storage/v1/object/${write ? '' : 'authenticated/'}${value.bucket}/${key}`, method: write ? 'POST' as const : 'GET' as const,
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-eps-asset-grant': value.grant_token, ...(write ? { 'Content-Type': value.mime_type as string, 'x-upsert': 'false' } : {}) },
      expires_at: value.expires_at, mime_type: value.mime_type as string, size_bytes: value.size_bytes, sha256: value.sha256 as string | null };
  }
  return { getAssetAccess,
    async reserveOutput(input: PresentationOutputInput, signal: AbortSignal) {
      scope(input); if (!exact(input, ['job_id', 'attempt_id', 'lease_token', 'output_key', 'asset_kind', 'filename', 'mime_type', 'expected_size_bytes', 'parent_asset_id', 'time_offset_ms'])
        || !['presentation_manifest', 'presentation_pdf'].includes(input.asset_kind) || input.output_key !== input.asset_kind || input.parent_asset_id !== null || input.time_offset_ms !== null
        || input.filename !== (input.asset_kind === 'presentation_pdf' ? 'presentation.pdf' : 'presentation-manifest.json') || input.mime_type !== (input.asset_kind === 'presentation_pdf' ? 'application/pdf' : 'application/json') || !size(input.expected_size_bytes, input.asset_kind === 'presentation_pdf' ? 67108864 : 8388608)) fail();
      const value = await call('reserve', { ...input }, signal); if (!exact(value, ['asset', 'bucket', 'object_key'])) fail('RUNTIME_RESPONSE_INVALID');
      const saved = asset(value.asset); if (saved.purpose !== input.asset_kind || saved.size_bytes !== input.expected_size_bytes) fail('RUNTIME_RESPONSE_INVALID');
      destination(value.bucket, value.object_key, saved.id, input.mime_type, input, saved.status !== 'ready');
      return { asset: saved, access: await getAssetAccess({ job_id: input.job_id, attempt_id: input.attempt_id, lease_token: input.lease_token, asset_id: saved.id, access: saved.status === 'ready' ? 'read' : 'write' }, signal) };
    },
    async completeOutput(input: PresentationCompleteInput, signal: AbortSignal) {
      scope(input); if (!exact(input, ['job_id', 'attempt_id', 'lease_token', 'asset_id', 'sha256', 'actual_size_bytes', 'width', 'height', 'duration_ms']) || !id(input.asset_id) || !HASH.test(input.sha256) || !size(input.actual_size_bytes, 67108864) || input.width !== null || input.height !== null || input.duration_ms !== null) fail();
      const saved = asset(await call('complete', { ...input }, signal)); if (saved.id !== input.asset_id || saved.status !== 'ready' || saved.sha256 !== input.sha256 || saved.size_bytes !== input.actual_size_bytes) fail('RUNTIME_RESPONSE_INVALID'); return saved;
    },
  };
}
