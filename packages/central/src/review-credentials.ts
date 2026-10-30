import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { DomainError } from '@eps/domain';
import { presentationCanonicalJson } from '../../domain/src/presentation.ts';

function configuration(): never { throw new DomainError('REVIEW_CONFIGURATION_REQUIRED', 'Configure the private review service keys.', 503); }
export function reviewKey(value: unknown): Buffer {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) configuration(); return Buffer.from(value as string, 'hex');
}
export function reviewToken(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(value) || Buffer.from(value, 'base64url').length !== 32 || Buffer.from(value, 'base64url').toString('base64url') !== value)
    throw new DomainError('REVIEW_ACCESS_DENIED', 'This review credential is invalid or unavailable.', 401);
  return value;
}
export function newReviewToken(): string { return randomBytes(32).toString('base64url'); }
export function reviewTokenDigest(value: string): string { return createHash('sha256').update(reviewToken(value), 'utf8').digest('hex'); }
export function encryptReviewReplay(token: string, key: Uint8Array, context: unknown): string {
  if (key.byteLength !== 32) configuration();
  const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(presentationCanonicalJson(context), 'utf8'));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ token: reviewToken(token) }), 'utf8'), cipher.final()]);
  return `v1.${nonce.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
}
export function decryptReviewReplay(value: unknown, key: Uint8Array, context: unknown): string {
  if (key.byteLength !== 32) configuration();
  try {
    if (typeof value !== 'string' || value.length > 16384 || !/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/u.test(value)) throw new Error();
    const [, nonce, encrypted, tag] = value.split('.');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'base64url'), { authTagLength: 16 });
    decipher.setAAD(Buffer.from(presentationCanonicalJson(context), 'utf8')); decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const result = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8'));
    if (!result || Object.keys(result).length !== 1 || !Object.hasOwn(result, 'token')) throw new Error(); return reviewToken(result.token);
  } catch { throw new DomainError('REVIEW_REPLAY_UNAVAILABLE', 'This creation response can no longer be recovered. Refresh link management before creating or rotating another link.', 409); }
}
/** The digest is never accepted as a bearer: every guest RPC also requires a
 * single-use backend proof whose key stays outside browser/API/MCP payloads. */
export function signReviewGateway(operation: string, input: Record<string, unknown>, key: Uint8Array, now = Date.now(), nonce = randomBytes(16).toString('hex')) {
  if (key.byteLength !== 32 || !Number.isSafeInteger(now) || now < 0 || !/^[a-f0-9]{32}$/u.test(nonce)) configuration();
  const payload = { operation, input, issued_at: now, nonce };
  return { issued_at: now, nonce, signature: createHmac('sha256', key).update(presentationCanonicalJson(payload), 'utf8').digest('hex') };
}
