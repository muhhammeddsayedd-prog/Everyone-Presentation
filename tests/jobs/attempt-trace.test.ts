import assert from 'node:assert/strict';
import test from 'node:test';
import { parseJobStageAttemptTrace } from '../../packages/jobs/src/attempt-trace.ts';
import { JobError } from '../../packages/jobs/src/types.ts';

const trace = () => ({ schema_version: '1.0', job_id: 'a0740000-0000-4000-8000-000000000001',
  attempt_id: 'a0740000-0000-4000-8000-000000000002', kind: 'candidate_scan', stage: 'transcribe_candidate',
  attempt: 2, stage_attempt: 1, dispatch_generation: 2, correlation_id: 'synthetic-trace-074', input_hash: 'a'.repeat(64),
  workflow_execution_id: 'synthetic-31686', workflow_execution_ref_state: 'recorded',
  claimed_at: '2026-11-01T01:00:00.123456+00:00', job_row_version: 5 });
const invalid = (error: unknown) => error instanceof JobError && error.code === 'ATTEMPT_TRACE_INVALID'
  && error.status === 503 && error.message === 'Processing correlation metadata is unavailable.';

test('bounded operator trace retains distinct stage/retry execution bindings without payloads', () => {
  const first = trace(); const retry = { ...first, attempt_id: 'a0740000-0000-4000-8000-000000000003',
    attempt: 3, stage_attempt: 2, dispatch_generation: 3, workflow_execution_id: 'synthetic-31687', job_row_version: 8 };
  const next = { ...first, attempt_id: 'a0740000-0000-4000-8000-000000000004', stage: 'extract_candidate',
    attempt: 4, dispatch_generation: 4, workflow_execution_id: 'synthetic-31688', job_row_version: 11 };
  const parsed = [first, retry, next].map(parseJobStageAttemptTrace);
  assert.deepEqual(parsed.map(row => [row.stage, row.attempt, row.stage_attempt, row.workflow_execution_id]), [
    ['transcribe_candidate', 2, 1, 'synthetic-31686'], ['transcribe_candidate', 3, 2, 'synthetic-31687'],
    ['extract_candidate', 4, 1, 'synthetic-31688'],
  ]);
  first.workflow_execution_id = 'later-jobs-latest-overwrite';
  assert.equal(parsed[0]!.workflow_execution_id, 'synthetic-31686');
});

test('all existing job kinds accept only their own stage namespace', () => {
  const cases = [['specs_extract', 'apply_specs'], ['candidate_scan', 'select_frames'], ['frame_extract', 'apply_frames'],
    ['ai_suggestion', 'validate_suggestion'], ['review_fit', 'measure_review_fit'],
    ['presentation_render', 'publish_presentation'], ['presentation_export', 'render_export']];
  for (const [kind, stage] of cases) {
    assert.equal(parseJobStageAttemptTrace({ ...trace(), kind, stage }).stage, stage);
    assert.throws(() => parseJobStageAttemptTrace({ ...trace(), kind, stage: 'arbitrary_stage' }), invalid);
  }
});

test('explicit presentation retry may reset the stage budget while total attempt stays distinct', () => {
  const first = { ...trace(), kind: 'presentation_render', stage: 'render_presentation', attempt: 1, stage_attempt: 1 };
  const afterReset = { ...first, attempt: 2, attempt_id: 'a0740000-0000-4000-8000-000000000003',
    dispatch_generation: 3, job_row_version: 9, workflow_execution_id: 'synthetic-after-manual-retry' };
  const rows = [first, afterReset].map(parseJobStageAttemptTrace);
  assert.deepEqual(rows.map(row => row.stage_attempt), [1, 1]);
  assert.deepEqual(rows.map(row => row.attempt), [1, 2]);
  assert.notEqual(rows[0]!.attempt_id, rows[1]!.attempt_id);
  assert.notEqual(rows[0]!.workflow_execution_id, rows[1]!.workflow_execution_id);
});

test('unknown payload, secret, actor/session and free-form error fields fail closed', () => {
  for (const key of ['input', 'result', 'receipt', 'error', 'source_text', 'transcript', 'lease_token', 'lease_token_digest',
    'authorization', 'session_id', 'requested_by', 'principal_id', 'workflow_node_data']) {
    assert.throws(() => parseJobStageAttemptTrace({ ...trace(), [key]: 'sensitive-sentinel' }), invalid);
  }
  const malformed = { ...trace(), workflow_execution_id: 'sensitive-sentinel?token=must-not-log' };
  try { parseJobStageAttemptTrace(malformed); assert.fail('must reject'); }
  catch (error) { assert.ok(invalid(error)); assert.equal(String(error).includes('sensitive-sentinel'), false); }
});

test('missing or omitted unsafe execution references remain explicit unknowns', () => {
  for (const state of ['not_provided', 'invalid_omitted']) {
    const row = { ...trace(), workflow_execution_id: null, workflow_execution_ref_state: state };
    assert.equal(parseJobStageAttemptTrace(row).workflow_execution_id, null);
    assert.throws(() => parseJobStageAttemptTrace({ ...row, workflow_execution_id: 'invented-reference' }), invalid);
  }
  for (const patch of [{ workflow_execution_id: null }, { workflow_execution_id: '' },
    { workflow_execution_ref_state: 'inferred' }, { workflow_execution_id: 'x'.repeat(201) },
    { workflow_execution_id: 'unsafe\nreference' }, { workflow_execution_id: 'https://private.example/path' }]) {
    assert.throws(() => parseJobStageAttemptTrace({ ...trace(), ...patch }), invalid);
  }
});

test('malformed identities, counters, correlation and timestamps cannot cross the metadata boundary', () => {
  for (const patch of [{ job_id: 'other' }, { attempt_id: 'other' }, { attempt: 0 }, { attempt: 2147483648 },
    { stage_attempt: 3 }, { stage_attempt: 1.1 }, { dispatch_generation: Number.MAX_SAFE_INTEGER + 1 },
    { job_row_version: -1 }, { correlation_id: 'a'.repeat(129) }, { correlation_id: 'unsafe\ntext' },
    { input_hash: 'A'.repeat(64) }, { claimed_at: 'tomorrow' }, { claimed_at: '2026-11-01T01:00:00' },
    { claimed_at: '2026-13-01T01:00:00Z' }, { schema_version: '2.0' }]) {
    assert.throws(() => parseJobStageAttemptTrace({ ...trace(), ...patch }), invalid);
  }
  assert.throws(() => parseJobStageAttemptTrace(Object.assign(Object.create({ inherited: true }), trace())), invalid);
  assert.throws(() => parseJobStageAttemptTrace({ ...trace(), [Symbol('hidden')]: 'sensitive-sentinel' }), invalid);
  const getter = trace();
  Object.defineProperty(getter, 'workflow_execution_id', { get() { throw new Error('sensitive-sentinel'); } });
  assert.throws(() => parseJobStageAttemptTrace(getter), invalid);
});

test('execution reference state is a literal string and never coerces untrusted hooks', () => {
  let coerced = false;
  const hook = { toString() { coerced = true; throw new Error('sensitive-coercion-sentinel'); } };
  for (const state of [{ toString: () => 'not_provided' }, [], null, Symbol('not_provided'), hook]) {
    assert.throws(() => parseJobStageAttemptTrace({ ...trace(), workflow_execution_id: null,
      workflow_execution_ref_state: state }), invalid);
  }
  assert.equal(coerced, false);
});
