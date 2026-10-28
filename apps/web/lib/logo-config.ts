import { DomainError, type LogoDecoded } from '@eps/domain';
import { readCentralConfig, signLogoReceipt, type CentralStudioOptions } from '@eps/central';

function unavailable(): never {
  throw new DomainError('LOGO_STORAGE_CONFIGURATION_REQUIRED', 'Private logo verification is not configured.', 503);
}

/** Server-only configuration. Missing feature readiness leaves the capability unavailable. */
export function readCentralLogoOptions(decodeLogo: (bytes: Uint8Array) => Promise<LogoDecoded>,
  env: Readonly<Record<string, string | undefined>> = process.env): CentralStudioOptions['logo'] {
  if (typeof window !== 'undefined') unavailable();
  if (!env.CENTRAL_LOGO_UPLOADS_ENABLED || env.CENTRAL_LOGO_UPLOADS_ENABLED === 'false') return undefined;
  if (env.CENTRAL_LOGO_UPLOADS_ENABLED !== 'true') unavailable();
  const keyId = env.LOGO_VERIFICATION_KEY_ID;
  const encoded = env.LOGO_VERIFICATION_KEY_BASE64URL;
  if (!keyId || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(keyId)
    || !encoded || !/^[A-Za-z0-9_-]{43}$/u.test(encoded)) unavailable();
  const key = Buffer.from(encoded, 'base64url');
  if (key.length !== 32 || key.toString('base64url') !== encoded
    || env.BRAND_ASSET_BUCKET && env.BRAND_ASSET_BUCKET !== 'eps-brand-assets') unavailable();
  const config = readCentralConfig(env);
  return { storageOrigin: config.url, brandBucket: 'eps-brand-assets', decodeLogo,
    signReceipt(facts) {
      const now = Math.floor(Date.now() / 1000);
      return signLogoReceipt({ ...facts, schema_version: '1.0', audience: 'eps.logo-verification.v1',
        purpose: 'client_logo', key_id: keyId, issued_at: now, expires_at: now + 90 }, key);
    } };
}
