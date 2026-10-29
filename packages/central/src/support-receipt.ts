import { createHmac, timingSafeEqual } from 'node:crypto';
import { TextDecoder } from 'node:util';

export const SUPPORT_RECEIPT_VERSION = 'candidate-support-verification.v1' as const;
export const SUPPORT_RECEIPT_AUDIENCE = 'eps.candidate-support-verification' as const;
export const SUPPORT_RECEIPT_MAX_PAYLOAD_BYTES = 4096;
export const SUPPORT_RECEIPT_MAX_TTL_SECONDS = 120;
const MAX_ENCODED_BYTES = Math.ceil(SUPPORT_RECEIPT_MAX_PAYLOAD_BYTES * 4 / 3);
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const MIME_TYPES = ['image/png','image/jpeg','image/webp','application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'] as const;
const FORMATS = ['png','jpeg','webp','pdf', 'docx', 'utf8_text'] as const;
const EXTENSIONS = ['png','jpg','webp','pdf', 'docx', 'txt'] as const;

export interface SupportReceiptClaims {
  schema_version: typeof SUPPORT_RECEIPT_VERSION;
  audience: typeof SUPPORT_RECEIPT_AUDIENCE;
  purpose: 'candidate_support';
  key_id: string;
  verification_id: string;
  upload_id: string;
  asset_id: string;
  principal_id: string;
  workspace_id: string;
  candidate_id: string;
  width: number|null;
  height: number|null;
  reservation_revision: number;
  bucket: string;
  object_key: string;
  size_bytes: number;
  sha256: string;
  mime_type: typeof MIME_TYPES[number];
  verified_format: typeof FORMATS[number];
  /** Integer UTC Unix seconds. No implicit future-issue clock allowance. */
  issued_at: number;
  expires_at: number;
}
export interface SupportReceipt { payload: string; mac: string }
export type SupportReceiptScope = Pick<SupportReceiptClaims, 'key_id' | 'verification_id' | 'upload_id' | 'asset_id' |
  'principal_id' | 'workspace_id' | 'candidate_id' | 'width' | 'height' | 'reservation_revision' | 'bucket' | 'object_key' | 'size_bytes' | 'mime_type' | 'verified_format'> & { sha256?: string };
export interface SupportReceiptClock { now?: number }

const CLAIM_FIELDS = ['schema_version', 'audience', 'purpose', 'key_id', 'verification_id', 'upload_id', 'asset_id',
  'principal_id', 'workspace_id', 'candidate_id', 'width', 'height', 'reservation_revision', 'bucket', 'object_key', 'size_bytes', 'sha256', 'mime_type',
  'verified_format', 'issued_at', 'expires_at'] as const;
const SCOPE_FIELDS = ['key_id', 'verification_id', 'upload_id', 'asset_id', 'principal_id', 'workspace_id','candidate_id','width','height',
  'reservation_revision', 'bucket', 'object_key', 'size_bytes', 'mime_type', 'verified_format'] as const;
const UUID_FIELDS = ['verification_id', 'upload_id', 'asset_id', 'principal_id', 'workspace_id','candidate_id'] as const;

export class SupportReceiptError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'SupportReceiptError'; this.code = code; }
}
function reject(code: string): never {
  const message = code === 'SUPPORT_RECEIPT_KEY_INVALID' ? 'A 32-byte server verification key is required.'
    : code === 'SUPPORT_RECEIPT_SIGNATURE_INVALID' ? 'The verification signature is invalid.'
      : code === 'SUPPORT_RECEIPT_SCOPE_MISMATCH' ? 'The verification receipt does not match this reservation.'
        : code === 'SUPPORT_RECEIPT_TIME_INVALID' ? 'The verification receipt lifetime is invalid or expired.'
          : 'The verification receipt is invalid.';
  throw new SupportReceiptError(code, message);
}
function serverKey(key: Uint8Array) {
  if (typeof window !== 'undefined') reject('SUPPORT_RECEIPT_SERVER_CONTEXT_REQUIRED');
  if (!(key instanceof Uint8Array) || key.byteLength !== 32) reject('SUPPORT_RECEIPT_KEY_INVALID');
  return key;
}
function shape(value: unknown, fields: readonly string[], code: string, optional: readonly string[] = []): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject(code);
  if (fields.some(field => !Object.hasOwn(value, field))
    || Object.keys(value).some(field => !fields.includes(field) && !optional.includes(field))) reject(code);
}
function safeInteger(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}
function common(value: Record<string, unknown>, code: string) {
  if (UUID_FIELDS.some(field => typeof value[field] !== 'string' || !UUID.test(value[field]))) reject(code);
  if (typeof value.key_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(value.key_id)) reject(code);
  if (!safeInteger(value.reservation_revision, 1) || !safeInteger(value.size_bytes, 1, MAX_FILE_BYTES)) reject(code);
  if (typeof value.mime_type !== 'string' || !MIME_TYPES.some(mime => mime === value.mime_type)) reject(code);
  const formatIndex = MIME_TYPES.indexOf(value.mime_type as typeof MIME_TYPES[number]);
  if(formatIndex<3 ? !safeInteger(value.size_bytes,1,5*1024*1024)||!safeInteger(value.width,1,40000000)||!safeInteger(value.height,1,40000000)||Number(value.width)*Number(value.height)>40000000 : value.width!==null||value.height!==null) reject(code);
  if (value.verified_format !== FORMATS[formatIndex] || value.bucket !== 'eps-candidate-support'
    || value.object_key !== `assets/${value.asset_id}/original.${EXTENSIONS[formatIndex]}`) reject(code);
  if (Object.hasOwn(value, 'sha256') && (typeof value.sha256 !== 'string' || !HASH.test(value.sha256))) reject(code);
}
function currentSecond(options: SupportReceiptClock) {
  shape(options, [], 'SUPPORT_RECEIPT_TIME_INVALID', ['now']);
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (!safeInteger(now, 0, 253_402_300_799)) reject('SUPPORT_RECEIPT_TIME_INVALID');
  return now;
}
function validatedClaims(value: unknown, now: number): SupportReceiptClaims {
  shape(value, CLAIM_FIELDS, 'SUPPORT_RECEIPT_CLAIMS_INVALID'); common(value, 'SUPPORT_RECEIPT_CLAIMS_INVALID');
  if (value.schema_version !== SUPPORT_RECEIPT_VERSION || value.audience !== SUPPORT_RECEIPT_AUDIENCE || value.purpose !== 'candidate_support') reject('SUPPORT_RECEIPT_CLAIMS_INVALID');
  if (!safeInteger(value.issued_at, 0, 253_402_300_799) || !safeInteger(value.expires_at, 0, 253_402_300_799)
    || Number(value.issued_at) > now || Number(value.expires_at) <= now
    || Number(value.expires_at) <= Number(value.issued_at)
    || Number(value.expires_at) - Number(value.issued_at) > SUPPORT_RECEIPT_MAX_TTL_SECONDS) reject('SUPPORT_RECEIPT_TIME_INVALID');
  // Fixed compact v1 representation prevents duplicate/alternate-field ambiguity.
  return Object.fromEntries(CLAIM_FIELDS.map(field => [field, value[field]])) as unknown as SupportReceiptClaims;
}
function base64Bytes(value: unknown, maximumEncoded: number, exactDecoded?: number): Buffer {
  if (typeof value !== 'string' || !value.length || value.length > maximumEncoded || value.length % 4 === 1) reject('SUPPORT_RECEIPT_FORMAT_INVALID');
  const decodedLength = Math.floor(value.length * 3 / 4);
  if (decodedLength > SUPPORT_RECEIPT_MAX_PAYLOAD_BYTES || exactDecoded !== undefined && decodedLength !== exactDecoded
    || !BASE64URL.test(value)) reject('SUPPORT_RECEIPT_FORMAT_INVALID');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.byteLength !== decodedLength || bytes.toString('base64url') !== value) reject('SUPPORT_RECEIPT_FORMAT_INVALID');
  return bytes;
}

/** Internal server operation only. This does not itself verify a document: the
 * caller must perform actual Storage verification before invoking the signer.
 * SQL interoperability: HMAC-SHA256 over exact decoded payload bytes, with raw
 * 32-byte key. Do not re-serialize JSONB to recreate the signed message. */
export function signSupportReceipt(claims: SupportReceiptClaims, key: Uint8Array, options: SupportReceiptClock = {}): SupportReceipt {
  const trustedKey = serverKey(key);
  const normalized = validatedClaims(claims, currentSecond(options));
  const bytes = Buffer.from(JSON.stringify(normalized), 'utf8');
  if (bytes.byteLength > SUPPORT_RECEIPT_MAX_PAYLOAD_BYTES) reject('SUPPORT_RECEIPT_FORMAT_INVALID');
  return Object.freeze({ payload: bytes.toString('base64url'), mac: createHmac('sha256', trustedKey).update(bytes).digest('base64url') });
}

/** Verify original encoded bytes before parsing; no key/config defaults, remote
 * calls or identity inference exist. Current DB permission/lease checks remain
 * mandatory at final commit; this pure cryptographic check cannot replace them. */
export function verifySupportReceipt(receipt: SupportReceipt, key: Uint8Array, expected: SupportReceiptScope, options: SupportReceiptClock = {}): Readonly<SupportReceiptClaims> {
  const trustedKey = serverKey(key);
  shape(receipt, ['payload', 'mac'], 'SUPPORT_RECEIPT_FORMAT_INVALID');
  const bytes = base64Bytes(receipt.payload, MAX_ENCODED_BYTES);
  const supplied = base64Bytes(receipt.mac, 43, 32);
  const computed = createHmac('sha256', trustedKey).update(bytes).digest();
  if (!timingSafeEqual(supplied, computed)) reject('SUPPORT_RECEIPT_SIGNATURE_INVALID');
  let text: string; let decoded: unknown;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); decoded = JSON.parse(text); }
  catch { return reject('SUPPORT_RECEIPT_FORMAT_INVALID'); }
  const claims = validatedClaims(decoded, currentSecond(options));
  if (JSON.stringify(claims) !== text) reject('SUPPORT_RECEIPT_CLAIMS_INVALID');
  shape(expected, SCOPE_FIELDS, 'SUPPORT_RECEIPT_SCOPE_INVALID', ['sha256']); common(expected, 'SUPPORT_RECEIPT_SCOPE_INVALID');
  if (SCOPE_FIELDS.some(field => expected[field] !== claims[field])
    || expected.sha256 !== undefined && expected.sha256 !== claims.sha256) reject('SUPPORT_RECEIPT_SCOPE_MISMATCH');
  return Object.freeze(claims);
}
