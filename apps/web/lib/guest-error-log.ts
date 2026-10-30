import { DomainError } from '@eps/domain';

const CLASSES = [
  'guest_unknown', 'guest_exchange', 'guest_identity', 'guest_session', 'guest_presentation', 'guest_feedback',
  'guest_export_prepare', 'guest_export_status', 'guest_export_download', 'guest_export_content',
  'guest_media_playback', 'guest_media_content', 'grant_media_playback', 'grant_media_content',
] as const;
export type GuestOperationClass = typeof CLASSES[number];
const codes = new Set([
  'ACCESS_DENIED', 'ASSET_UNAVAILABLE', 'AUTH_REQUIRED', 'CAPABILITY_REQUIRED', 'CENTRAL_CONFIGURATION_REQUIRED',
  'DEPENDENCY_UNAVAILABLE', 'DOWNLOAD_DISABLED', 'EXTERNAL_SERIES_REQUIRED', 'EXPORT_NOT_READY', 'EXPORT_STALE',
  'FEATURE_NOT_IMPLEMENTED', 'GUEST_IDENTITY_REQUIRED', 'IDEMPOTENCY_KEY_REQUIRED', 'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_WINDOW_EXPIRED', 'INVALID_REQUEST', 'INVALID_TRANSITION', 'JOB_ALREADY_RUNNING', 'JOB_CANCELLED',
  'LINK_REVOKED', 'PRESENTATION_PROCESSING_UNAVAILABLE', 'RANGE_NOT_SATISFIABLE', 'RATE_LIMITED', 'RESOURCE_CONFLICT',
  'RESOURCE_NOT_FOUND', 'REVIEW_ACCESS_DENIED', 'REVIEW_CONFIGURATION_REQUIRED', 'REVIEW_GATEWAY_UNAVAILABLE',
  'REVIEW_LINK_EXPIRED', 'REVIEW_LINK_REVOKED', 'REVIEW_LINK_ROTATED', 'REVIEW_UNAVAILABLE', 'SOURCE_UNREADABLE',
  'STALE_RESOURCE_VERSION', 'TOKEN_REPLAY_EXPIRED', 'VALIDATION_ERROR', 'VALIDATION_FAILED', 'VERSION_NOT_READY',
]);

/** Static operation names only; dynamic route segments are never copied. */
export function guestOperationClass(s: readonly string[]): GuestOperationClass {
  if (s[0] === 'review-media' && s.length === 6 && s[1] === 'versions' && s[3] === 'media') {
    if (s[5] === 'content') return 'grant_media_content';
    if (s[5] === 'playback') return 'grant_media_playback';
  }
  if (s[0] !== 'review') return 'guest_unknown';
  if (s.length === 2) {
    if (s[1] === 'open') return 'guest_exchange';
    if (s[1] === 'identity') return 'guest_identity';
    if (s[1] === 'session') return 'guest_session';
    if (s[1] === 'presentation') return 'guest_presentation';
  }
  if (s[1] === 'versions') {
    if (s.length === 3) return 'guest_presentation';
    if (s.length === 4 && ['feedback', 'comments', 'preferences'].includes(s[3])) return 'guest_feedback';
    if (s.length === 4 && s[3] === 'pdf-exports') return 'guest_export_prepare';
    if (s[3] === 'media' && s.length === 5) return 'guest_media_playback';
    if (s[3] === 'media' && s.length === 6 && s[5] === 'content') return 'guest_media_content';
  }
  if (s[1] === 'comments' && s.length === 3) return 'guest_feedback';
  if (s[1] === 'pdf-exports') {
    if (s.length === 3) return 'guest_export_status';
    if (s.length === 4 && s[3] === 'download') return 'guest_export_download';
    if (s.length === 4 && s[3] === 'content') return 'guest_export_content';
  }
  return 'guest_unknown';
}

/** Closed diagnostics: never serialize the exception or request object. */
export function logGuestRequestFailure(operation: GuestOperationClass, error: unknown, requestId: string,
  write: (value: string) => void = value => console.error(value)): void {
  const domain = error instanceof DomainError ? error : null;
  const status = domain && Number.isInteger(domain.status) && domain.status >= 400 && domain.status <= 599 ? domain.status : 503;
  const code = domain && codes.has(domain.code) ? domain.code : 'DEPENDENCY_UNAVAILABLE';
  const correlation = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(requestId) ? requestId : 'unavailable';
  try {
    write(JSON.stringify({ event: 'guest_request_failed', operation_class: CLASSES.includes(operation) ? operation : 'guest_unknown', status, code, request_id: correlation }));
  } catch { /* Diagnostic sink failure must not replace the original response. */ }
}
