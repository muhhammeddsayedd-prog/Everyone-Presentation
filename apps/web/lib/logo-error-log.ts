import { DomainError } from '@eps/domain';

const phases = new Set(['reserve', 'sign_upload', 'sign_upload_response', 'prepare_completion', 'download', 'stream',
  'decode', 'sign_verification', 'finalize_completion', 'unclassified']);
const codes = new Set(['ACCESS_DENIED', 'AUTH_REQUIRED', 'CAPABILITY_REQUIRED', 'CENTRAL_RESPONSE_INVALID',
  'DEPENDENCY_UNAVAILABLE', 'IDEMPOTENCY_KEY_REQUIRED', 'IDEMPOTENCY_KEY_REUSED', 'INVALID_REQUEST', 'INVALID_TRANSITION',
  'RESOURCE_NOT_FOUND', 'SOURCE_UNREADABLE', 'STALE_RESOURCE_VERSION', 'STORAGE_RATE_LIMITED', 'UPLOAD_EXPIRED',
  'UPLOAD_INCOMPLETE', 'VALIDATION_FAILED']);
// Same closed official Storage vocabulary accepted by the logo adapter; never log free-form provider codes.
const storageCodes = new Set(['NoSuchBucket', 'NoSuchKey', 'NoSuchUpload', 'InvalidJWT', 'InvalidRequest', 'TenantNotFound',
  'EntityTooLarge', 'InternalError', 'ResourceAlreadyExists', 'DatabaseTimeout', 'InvalidSignature', 'SignatureDoesNotMatch',
  'AccessDenied', 'ResourceLocked', 'DatabaseError']);
const httpStatus = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;

export interface LogoErrorDetails {
  logo_phase: string; storage_http_status: number | null; storage_body_status: number | null; storage_code: string | null;
}
/** The same closed projection serves HTTP logging and text-only MCP clients. */
export function safeLogoErrorDetails(value: unknown): LogoErrorDetails | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const details = value as Record<string, unknown>, phase = details.logo_phase;
    if (typeof phase !== 'string' || !phases.has(phase)) return null;
    const storageCode = details.storage_code;
    return { logo_phase: phase, storage_http_status: httpStatus(details.storage_http_status),
      storage_body_status: httpStatus(details.storage_body_status),
      storage_code: typeof storageCode === 'string' && storageCodes.has(storageCode) ? storageCode : null };
  } catch { return null; }
}

/** Emit only logo-marked failures at the existing HTTP catch. No request, error, message or arbitrary detail is serialized. */
export function logLogoRequestFailure(error: unknown, requestId: string,
  write: (value: string) => void | Promise<void> = value => console.error(value)): void {
  try {
    if (!(error instanceof DomainError)) return;
    const details = safeLogoErrorDetails(error.details);
    if (!details) return;
    const rawCode = error.code;
    const correlation = typeof requestId === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(requestId) ? requestId : 'unavailable';
    const emitted = write(JSON.stringify({ event: 'logo_request_failed', request_id: correlation,
      code: codes.has(rawCode) ? rawCode : 'DEPENDENCY_UNAVAILABLE', ...details }));
    if (emitted) void emitted.catch(() => {});
  } catch { /* Diagnostic getters or sink failures must not replace the original HTTP response. */ }
}
