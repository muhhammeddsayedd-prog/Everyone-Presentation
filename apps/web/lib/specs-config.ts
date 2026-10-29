import { DomainError } from '@eps/domain';
import { readCentralConfig, signSpecsReceipt, type CentralStudioOptions } from '@eps/central';
import { verifySpecsOriginal } from './specs-original';

function unavailable(): never { throw new DomainError('SPECS_STORAGE_CONFIGURATION_REQUIRED', 'Private document verification is not configured.', 503); }
/** Server-only, opt-in admission verification. This does not enable DB purposes
 * or prove hosted Storage readiness; capabilities intersect all those gates. */
export function readCentralSpecsOptions(env: Readonly<Record<string, string | undefined>> = process.env): CentralStudioOptions['specs'] {
  if (typeof window !== 'undefined') unavailable();
  if (!env.CENTRAL_SPECS_UPLOADS_ENABLED || env.CENTRAL_SPECS_UPLOADS_ENABLED === 'false') return undefined;
  if (env.CENTRAL_SPECS_UPLOADS_ENABLED !== 'true') unavailable();
  const keyId = env.SPECS_VERIFICATION_KEY_ID; const encoded = env.SPECS_VERIFICATION_KEY_BASE64URL;
  if (!keyId || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(keyId) || !encoded || !/^[A-Za-z0-9_-]{43}$/u.test(encoded)
    || keyId === env.LOGO_VERIFICATION_KEY_ID || encoded === env.LOGO_VERIFICATION_KEY_BASE64URL
    || env.SPECS_ASSET_BUCKET && env.SPECS_ASSET_BUCKET !== 'eps-specs-assets') unavailable();
  const key = Buffer.from(encoded, 'base64url'); if (key.length !== 32 || key.toString('base64url') !== encoded) unavailable();
  const config = readCentralConfig(env);
  return { storageOrigin: config.url, verifyDocument: verifySpecsOriginal,
    signReceipt(facts) { const now = Math.floor(Date.now() / 1000); return signSpecsReceipt({ ...facts,
      schema_version: 'specs-original-verification.v1', audience: 'eps.specs-original-verification', purpose: 'specs', key_id: keyId,
      issued_at: now, expires_at: now + 90 }, key); } };
}
