import { DomainError } from '@eps/domain';

const KNOWN: Record<string, { status: number; message: string }> = {
  AUTH_REQUIRED: { status: 401, message: 'Sign in with an authorized business account.' },
  CAPABILITY_REQUIRED: { status: 403, message: 'Your business account does not have permission for this operation.' },
  ACCESS_DENIED: { status: 403, message: 'Your business account cannot access this resource.' },
  RESOURCE_NOT_FOUND: { status: 404, message: 'The resource is unavailable in your accessible scope.' },
  STALE_RESOURCE_VERSION: { status: 409, message: 'This record changed. Reload it before saving again.' },
  IDEMPOTENCY_KEY_REUSED: { status: 409, message: 'This idempotency key was used with different input.' },
  IDEMPOTENCY_KEY_REQUIRED: { status: 400, message: 'A valid Idempotency-Key is required for this operation.' },
  VALIDATION_ERROR: { status: 400, message: 'The request contains an invalid value.' },
  VALIDATION_FAILED: { status: 400, message: 'The request does not match the operation contract.' },
  AUDIENCE_PRESET_EXISTS: { status: 409, message: 'This audience preset key already exists.' },
  INVALID_TRANSITION: { status: 409, message: 'The requested operation is not valid in the current state.' },
  INVALID_REQUEST: { status: 400, message: 'The request contains an invalid or unsupported value.' },
  FEATURE_NOT_IMPLEMENTED: { status: 503, message: 'This operation is not available yet. Your saved data remains available.' },
  UPLOAD_EXPIRED: { status: 409, message: 'This upload is closed or expired. Start another upload.' },
  SPECS_STATE_INVALID: { status: 409, message: 'The requirements changed unexpectedly. Reload before trying again.' },
  IDEMPOTENCY_WINDOW_EXPIRED: { status: 409, message: 'This idempotency replay window expired. Refresh the saved state before creating another request.' },
};
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }

export function centralRpcError(value: unknown): DomainError {
  const error = record(value);
  const known = error?.code === 'P0001' && typeof error.message === 'string' && Object.hasOwn(KNOWN, error.message) ? KNOWN[error.message] : undefined;
  if (known) {
    let detail: Record<string, unknown> | null = null;
    try { detail = typeof error!.details === 'string' ? record(JSON.parse(error!.details)) : record(error!.details); } catch { /* Never serialize raw SQL details. */ }
    const version = detail?.current_row_version;
    return new DomainError(error!.message as string, known.message, known.status,
      typeof version === 'number' && Number.isSafeInteger(version) && version > 0 ? { current_row_version: version } : {});
  }
  if (error?.code === '42501') return new DomainError('CAPABILITY_REQUIRED', 'Your business account does not have permission for this operation.', 403);
  if (error?.code === 'PGRST301' || error?.code === 'PGRST303') return new DomainError('AUTH_REQUIRED', 'Your business session is invalid or expired. Sign in again.', 401);
  if (error?.code === '23505' || error?.code === '23503') return new DomainError('RESOURCE_CONFLICT', 'This change conflicts with an existing or referenced record.', 409);
  if (error?.code === '22P02' || error?.code === '22023') return new DomainError('VALIDATION_ERROR', 'The request contains an invalid value.', 400);
  return new DomainError('DEPENDENCY_UNAVAILABLE', 'The central data operation is unavailable. Check service access and the migration state.', 503, {}, true);
}
