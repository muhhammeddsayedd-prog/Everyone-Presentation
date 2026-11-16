import type { SpecsAssetCall, SpecsAssetScope, SpecsRuntimeAssetConfig } from './specs-runtime-assets.ts';
import { SpecsRuntimeGatewayError } from './specs-runtime-gateway.ts';

/** Read-only grant mapper for candidate_appearance stages: an archive photo or an extracted frame named in the frozen
 * job input. Only GET on the two candidate image buckets; no write path exists. */
export interface AppearanceAssetAccess { asset_id: string; url: string; method: 'GET'; headers: Record<string, string>; expires_at: string; mime_type: 'image/jpeg'; size_bytes: number; sha256: string }
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const ORIGIN = 'https://pyibofyctwnqpvktepse.supabase.co';
// Archive import keys are not pinned by m09; accept a bounded safe path. Frame outputs keep the fixed job layout.
const PHOTO_KEY = /^[A-Za-z0-9_-][A-Za-z0-9._/-]{0,1000}$/u;
const FRAME_KEY = /^jobs\/[a-f0-9-]{36}\/attempts\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/u;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
function fail(code = 'INVALID_REQUEST'): never { throw new SpecsRuntimeGatewayError(code, code === 'INVALID_REQUEST' ? 400 : 503, 'known'); }
export function appearanceAccessFromGrant(v: unknown, input: SpecsAssetScope & { asset_id: string }, publishableKey: string, now = Date.now()): AppearanceAssetAccess {
  if (!exact(v, ['asset_id', 'bucket', 'object_key', 'permission', 'grant_token', 'expires_at', 'mime_type', 'size_bytes', 'sha256']) || v.asset_id !== input.asset_id || v.permission !== 'read'
    || typeof v.grant_token !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(v.grant_token) || typeof v.expires_at !== 'string' || !Number.isFinite(Date.parse(v.expires_at))
    || Date.parse(v.expires_at) <= now || Date.parse(v.expires_at) > now + 90_000 || v.mime_type !== 'image/jpeg' || !Number.isSafeInteger(v.size_bytes) || Number(v.size_bytes) < 1
    || Number(v.size_bytes) > 20_971_520 || typeof v.sha256 !== 'string' || !HASH.test(v.sha256) || !['eps-candidate-photos', 'eps-candidate-outputs'].includes(String(v.bucket))
    || typeof v.object_key !== 'string' || !(v.bucket === 'eps-candidate-photos' ? PHOTO_KEY : FRAME_KEY).test(v.object_key) || v.object_key.includes('..') || v.object_key.includes('//')) fail('RUNTIME_RESPONSE_INVALID');
  return { asset_id: input.asset_id, url: `${ORIGIN}/storage/v1/object/authenticated/${v.bucket}/${v.object_key}`, method: 'GET',
    headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, 'x-eps-asset-grant': v.grant_token }, expires_at: v.expires_at, mime_type: 'image/jpeg',
    size_bytes: Number(v.size_bytes), sha256: v.sha256 };
}
export function createAppearanceRuntimeAssets(config: SpecsRuntimeAssetConfig, call: SpecsAssetCall) {
  if (!exact(config, ['storageOrigin', 'publishableKey']) || config.storageOrigin !== ORIGIN || !/^sb_publishable_[A-Za-z0-9_-]{8,}$/u.test(config.publishableKey)) fail('RUNTIME_CONFIG_INVALID');
  return {
    async getAssetAccess(input: SpecsAssetScope & { asset_id: string }, signal: AbortSignal): Promise<AppearanceAssetAccess> {
      if (!exact(input, ['job_id', 'attempt_id', 'lease_token', 'asset_id']) || !UUID.test(input.job_id) || !UUID.test(input.attempt_id) || typeof input.lease_token !== 'string'
        || !HASH.test(input.lease_token) || !UUID.test(input.asset_id)) fail();
      return appearanceAccessFromGrant(await call('access', { ...input, access: 'read' }, signal), input, config.publishableKey);
    },
  };
}
export type AppearanceRuntimeAssets = ReturnType<typeof createAppearanceRuntimeAssets>;
