type ErrorRecord = Record<string, unknown>;
function record(value: unknown): ErrorRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ErrorRecord : {};
}

/** MCP clients may display only content, without structuredContent. Mirror the
 * already public error fields there, never the failed result or arbitrary details. */
export function mcpErrorText(value: unknown, mutation = false): string {
  const envelope = record(value); const error = record(envelope.error); const source = record(error.details);
  const details: ErrorRecord = {};
  for (const field of ['current_row_version', 'current_workspace_row_version', 'current_draft_revision']) {
    const version = source[field];
    if (typeof version === 'number' && Number.isSafeInteger(version) && version >= (field === 'current_draft_revision' ? 0 : 1)) details[field] = version;
  }
  const code = typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,99}$/u.test(error.code) ? error.code : 'DEPENDENCY_UNAVAILABLE';
  let message = typeof error.message === 'string' && error.message.length <= 2000 ? error.message : 'The operation could not be completed. Contact the workspace administrator.';
  if (mutation && ['OPERATION_RESPONSE_INVALID', 'CENTRAL_RESPONSE_INVALID', 'DEPENDENCY_UNAVAILABLE'].includes(code)) {
    message += ' A mutation may already have been applied: read the saved state before retrying and keep the same idempotency key for the same intent.';
  }
  return JSON.stringify({
    request_id: typeof envelope.request_id === 'string' && envelope.request_id.length <= 200 ? envelope.request_id : 'unavailable',
    error: {
      code, message,
      details, retryable: error.retryable === true,
    },
  });
}
