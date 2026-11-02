import assert from 'node:assert/strict';
import test from 'node:test';
import { api, ApiError, errorMessage } from '../../apps/web/components/api.ts';

const stale = 'This record changed since you opened it. Reload the saved details, then reapply your changes.';

test('actual upload completion409 preserves its safe missing-byte message, code and request correlation', async t => {
  const message = 'The uploaded logo bytes are not available yet.';
  const requestId = '99000000-0000-4000-8000-000000000001';
  t.mock.method(globalThis, 'fetch', async () => Response.json({ request_id: requestId,
    error: { code: 'UPLOAD_INCOMPLETE', message, details: {}, retryable: false } }, { status: 409 }));
  await assert.rejects(api('/api/v1/uploads/synthetic/complete'), error => {
    assert(error instanceof ApiError); assert.equal(error.status, 409); assert.equal(error.code, 'UPLOAD_INCOMPLETE');
    assert.equal(error.requestId, requestId); assert.equal(errorMessage(error), message);
    assert.notEqual(errorMessage(error), stale); return true;
  });
});

test('only canonical stale-resource conflicts receive reload/reapply guidance', () => {
  assert.equal(errorMessage(new ApiError(409, 'STALE_RESOURCE_VERSION', 'Workspace changed.')), stale);
  for (const [code, message] of [
    ['IDEMPOTENCY_KEY_REUSED', 'This key was already used for a different request.'],
    ['IDEMPOTENCY_WINDOW_EXPIRED', 'This request replay window expired.'],
    ['INPUT_CHANGED', 'Presentation source information is changing. Refresh review before generating.'],
    ['UPLOAD_EXPIRED', 'This logo upload is no longer open. Start another upload.'],
    ['RESOURCE_CONFLICT', 'Another operation is already in progress.'],
    ['STALE_REVISION', 'This operation reported a different revision conflict.'],
  ]) assert.equal(errorMessage(new ApiError(409, code, message)), message, code);
  assert.equal(errorMessage(new ApiError(503, 'STALE_RESOURCE_VERSION', 'The service is temporarily unavailable.')),
    'The service is temporarily unavailable.');
});

test('existing session and interrupted-request messages remain unchanged', () => {
  assert.equal(errorMessage(new ApiError(401, 'AUTH_REQUIRED', 'Sign in.')), 'Your session expired. Sign in again.');
  assert.match(errorMessage(new DOMException('Private transport data', 'AbortError')), /confirm whether it was saved/u);
  assert.doesNotMatch(errorMessage(new DOMException('Private transport data', 'TimeoutError')), /Private transport data/u);
});
