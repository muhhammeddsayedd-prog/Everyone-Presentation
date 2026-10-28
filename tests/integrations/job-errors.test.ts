import assert from 'node:assert/strict';
import test from 'node:test';
import { IntegrationError, integrationErrorToJobFailure } from '../../packages/integrations/src/index.ts';
import type { JobErrorDto } from '../../packages/jobs/src/index.ts';

test('known transient provider and dispatch failures map to the generic job retry vocabulary', () => {
  for (const providerCode of ['OPENAI_TIMEOUT', 'OPENAI_UNAVAILABLE', 'N8N_DISPATCH_TIMEOUT', 'N8N_DISPATCH_UNAVAILABLE', 'N8N_DISPATCH_RETRYABLE']) {
    const mapped: JobErrorDto = integrationErrorToJobFailure(new IntegrationError(providerCode, 'private provider text', true));
    assert.equal(mapped.code, 'DEPENDENCY_UNAVAILABLE'); assert.equal(mapped.retryable, true);
  }
  const rateLimit = integrationErrorToJobFailure(new IntegrationError('OPENAI_RATE_LIMITED', 'private provider text', true));
  assert.equal(rateLimit.code, 'PROVIDER_RATE_LIMITED'); assert.equal(rateLimit.retryable, true);
  assert.equal(integrationErrorToJobFailure(new IntegrationError('OPENAI_UNAVAILABLE', 'private text', false)).retryable, false);
});

test('only finite nonnegative retry hints cross the seam, rounded up to bounded seconds', () => {
  const failure = (hint: number | string) => integrationErrorToJobFailure(new IntegrationError('OPENAI_RATE_LIMITED', 'private', true, { retry_after_ms: hint, request_id: 'private-request', http_status: 429 }));
  assert.deepEqual(failure(1201).details, { retry_after_seconds: 2 });
  assert.deepEqual(failure(0).details, { retry_after_seconds: 0 });
  assert.deepEqual(failure(900_000).details, { retry_after_seconds: 300 });
  for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, '1201']) assert.deepEqual(failure(invalid).details, {});
});

test('invalid source, schema/evidence failure and refusal are terminal and discard provider text/details', () => {
  const mapping = {
    SPECS_SOURCE_INVALID: 'SOURCE_UNREADABLE', SPECS_SOURCE_UNREADABLE: 'SOURCE_UNREADABLE',
    AI_REFUSAL: 'EXTRACTION_REFUSED', AI_RESULT_INVALID: 'RESULT_INVALID', AI_EVIDENCE_INVALID: 'RESULT_INVALID',
    AI_EVIDENCE_MISSING: 'RESULT_INVALID', AI_SOURCE_MISMATCH: 'RESULT_INVALID', AI_ROLE_KEYS_INVALID: 'RESULT_INVALID',
    AI_RESPONSE_INVALID: 'RESULT_INVALID', AI_RESPONSE_INCOMPLETE: 'RESULT_INVALID', AI_RESPONSE_NOT_COMPLETE: 'RESULT_INVALID', AI_OUTPUT_UNEXPECTED: 'RESULT_INVALID',
  };
  for (const [providerCode, expected] of Object.entries(mapping)) {
    const mapped = integrationErrorToJobFailure(new IntegrationError(providerCode, 'private source text', true, { retry_after_ms: 20, body: 'private provider body' }));
    assert.equal(mapped.code, expected); assert.equal(mapped.retryable, false); assert.deepEqual(mapped.details, {});
    assert.equal(JSON.stringify(mapped).includes('private'), false);
  }
});

test('unknown errors, access/quota/configuration issues and cancellation never become automatic retries', () => {
  const failures: unknown[] = [new Error('private exception'), { code: 'OPENAI_RATE_LIMITED', retryable: true, message: 'private object' },
    ...['UNKNOWN_PROVIDER_ERROR', 'OPENAI_ACCESS_DENIED', 'OPENAI_QUOTA_EXCEEDED', 'OPENAI_REQUEST_REJECTED', 'OPENAI_KEY_REQUIRED', 'OPENAI_EXTRACTION_MODEL_REQUIRED', 'OPENAI_CONFIGURATION_INVALID', 'N8N_DISPATCH_ACCESS_DENIED', 'N8N_DISPATCH_REJECTED', 'N8N_CONFIGURATION_INVALID', 'PROCESSING_CANCELLED', 'toString', '__proto__']
      .map(code => new IntegrationError(code, 'private exception', true, { raw: 'private raw data' })),
  ];
  for (const failure of failures) {
    const mapped = integrationErrorToJobFailure(failure);
    assert.equal(mapped.code, 'PROCESSING_FAILED'); assert.equal(mapped.retryable, false); assert.deepEqual(mapped.details, {});
    assert.equal(JSON.stringify(mapped).includes('private'), false);
  }
});
