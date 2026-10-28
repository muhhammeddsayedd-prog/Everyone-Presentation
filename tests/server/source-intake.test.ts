import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../../apps/web/components/api.ts';
import { retainSourceIntent, readSourceAccepted, sourceFailure } from '../../apps/web/components/source-intake.ts';

const spec = { id: 'spec-original', workspace_id: 'workspace-original', row_version: 7 };
test('pasted source captures the Spec version and original multilingual bytes without normalization', () => {
  const original = '\ufeff  Brief\r\n\r\nثلاثة ممثلين 😀  ';
  const request = retainSourceIntent(null, spec, original, () => 'stable-source-key');
  assert.deepEqual(JSON.parse(request.serialized), { source_text: original, row_version: 7 });
  assert.equal(request.body.source_text, original);
  for (const invalid of ['', ' \r\n\ufeff ', '\ud800', 'brief\u0000', 'ع'.repeat(40_000)]) {
    assert.throws(() => retainSourceIntent(null, spec, invalid, () => 'key'));
  }
});
test('unknown retries preserve the same source, version and key despite newer local values', () => {
  const request = retainSourceIntent(null, spec, 'Original brief', () => 'one-key');
  const retry = retainSourceIntent(request, { ...spec, row_version: 8 }, 'Replacement brief', () => { throw new Error('must not allocate another key'); });
  assert.equal(retry, request);
  assert.equal(retry.serialized, '{"source_text":"Original brief","row_version":7}');
  assert.throws(() => retainSourceIntent(request, { ...spec, workspace_id: 'other' }, 'brief', () => 'key'));
});
test('only scoped durable acknowledgements produce an internal processing destination', () => {
  for (const status of ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled']) {
    assert.equal(readSourceAccepted({ job_id: 'job1', resource_id: spec.id, poll_url: '/api/v1/jobs/job1', status }, spec.id).status, status);
  }
  const accepted = { job_id: 'job1', resource_id: spec.id, poll_url: '/api/v1/jobs/job1', status: 'queued' };
  for (const invalid of [{ ...accepted, resource_id: 'other' }, { ...accepted, poll_url: 'https://example.invalid/job1' },
    { ...accepted, status: 'generated' }, { ...accepted, token: 'not-allowed' }]) assert.throws(() => readSourceAccepted(invalid, spec.id));
});
test('readiness is distinct from an unknown write outcome and stale edits require reload', () => {
  assert.equal(sourceFailure(new ApiError(503, 'FEATURE_NOT_IMPLEMENTED', 'private server wording')).kind, 'unavailable');
  assert.equal(sourceFailure(new ApiError(409, 'STALE_RESOURCE_VERSION', 'private server wording')).kind, 'stale');
  for (const error of [new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'private transport'), new ApiError(500, 'failure', 'private transport'),
    Object.assign(new Error('private transport'), { name: 'TimeoutError' })]) {
    const failure = sourceFailure(error); assert.equal(failure.kind, 'unknown'); assert.doesNotMatch(failure.message, /private/);
  }
});
