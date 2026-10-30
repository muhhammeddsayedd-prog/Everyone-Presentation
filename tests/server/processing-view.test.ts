import assert from 'node:assert/strict';
import test from 'node:test';
import type { CentralJob } from '@eps/central';
import { jobStageLabel, jobFailureMessage, processingActions, readProcessingJob, readJobRetryAcknowledgement, processingDelay, readJobPage, retainJobIntent, workspaceResultHref } from '../../apps/web/components/processing-view.ts';

const job: CentralJob = { id: 'job-1', workspace_id: 'workspace-1', kind: 'specs_extract', status: 'failed', stage: 'extract_specs',
  attempt: 1, progress_completed: 1, progress_total: 3, batch_id: null, input_asset_id: null, resource_id: null,
  error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'private provider diagnostic', details: {}, retryable: true },
  row_version: 7, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' };

test('ordinary processing labels never echo untrusted stages or provider messages', () => {
  assert.equal(jobStageLabel('extract_specs'), 'Requirements extraction');
  assert.equal(jobStageLabel('private/storage/key?token=secret'), 'Processing step');
  assert.match(jobFailureMessage(job.error), /temporarily unavailable/u);
  assert.equal(jobFailureMessage({ ...job.error!, code: 'SECRET_CODE', message: 'secret' }), 'Processing could not complete. Existing work has been retained.');
});

test('actual candidate and frame stages have understandable public labels', () => {
  assert.equal(jobStageLabel('prepare_candidate'), 'Video preparation');
  assert.equal(jobStageLabel('transcribe_candidate'), 'Original-language transcription');
  assert.equal(jobStageLabel('extract_candidate'), 'Supplied fact extraction');
  assert.equal(jobStageLabel('select_frames'), 'Source frame selection');
  assert.equal(jobStageLabel('apply_candidate'), 'Saving candidate profile');
  assert.equal(jobStageLabel('apply_frames'), 'Saving extracted frames');
});

test('job pages reject duplicate rows, changing filters and nonadvancing cursors', () => {
  const page = { data: [job], page: { next_cursor: 'job-1' } };
  assert.deepEqual(readJobPage(page, 'failed', null).jobs, [job]);
  for (const invalid of [ { ...page, data: [job, job] }, { ...page, data: [] }, { data: [job] },
    { ...page, data: [{ ...job, row_version: 0 }] }, { ...page, data: [{ ...job, progress_total: 0 }] } ]) {
    assert.throws(() => readJobPage(invalid, 'failed', null));
  }
  assert.throws(() => readJobPage(page, 'queued', null));
  assert.throws(() => readJobPage(page, 'failed', 'job-1'));
});

test('unknown retry preserves the exact original operation, revision and idempotency key', () => {
  let keys = 0; const createKey = () => `intent-${++keys}`;
  const first = retainJobIntent(null, job, 'retry', createKey);
  const same = retainJobIntent(first, { ...job, row_version: 9 }, 'retry', createKey);
  assert.equal(same, first); assert.deepEqual(same.body, { row_version: 7 }); assert.equal(keys, 1);
  assert.throws(() => retainJobIntent(first, job, 'cancel', createKey), /Resolve/u);
  assert.equal(retainJobIntent(null, { ...job, row_version: 9 }, 'retry', createKey).body.row_version, 9);
});

test('retry acknowledgements bind the existing job and safe poll path without inventing a new revision', () => {
  const acknowledgement = { job_id: job.id, resource_id: null, poll_url: '/api/v1/jobs/job-1', status: 'queued' };
  for (const status of ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled']) {
    assert.deepEqual(readJobRetryAcknowledgement({ ...acknowledgement, status }, job.id), { ...acknowledgement, status });
  }
  const intent = retainJobIntent(null, job, 'retry', () => 'original-intent');
  for (const invalid of [job, { ...acknowledgement, job_id: 'another-job' }, { ...acknowledgement, poll_url: '/api/v1/jobs/another-job' },
    { ...acknowledgement, poll_url: 'https://arbitrary.invalid/job-1' }, { ...acknowledgement, poll_url: '/api/v1/jobs/job-1?token=private' },
    { ...acknowledgement, resource_id: {} }, { ...acknowledgement, status: 'unknown' }, { ...acknowledgement, row_version: 9 }]) {
    assert.throws(() => readJobRetryAcknowledgement(invalid, job.id));
    assert.equal(retainJobIntent(intent, { ...job, row_version: 9 }, 'retry', () => 'must-not-be-used'), intent);
  }
  assert.deepEqual(intent, { jobId: job.id, action: 'retry', body: { row_version: 7 }, key: 'original-intent' });
});

test('polling backs off within bounds and stops on a confirmed terminal detail', () => {
  assert.equal(processingDelay('running', 0, false), 5000);
  assert.equal(processingDelay('succeeded', 0, false), null);
  assert.equal(processingDelay('cancelled', 0, true), 10000);
  assert.equal(processingDelay('running', 1, false), 5000);
  assert.equal(processingDelay('running', 4, false), 40000);
  assert.equal(processingDelay('running', 100, false), 60000);
});

test('workspace results use the returned project scope and reject cross-workspace resolutions', () => {
  assert.equal(workspaceResultHref(job, { id: 'workspace-1', project_id: 'actual-project' }), '/projects/actual-project/casting/workspace-1/specs');
  assert.throws(() => workspaceResultHref(job, { id: 'other-workspace', project_id: 'actual-project' }));
  assert.throws(() => workspaceResultHref(job, { id: 'workspace-1', project_id: '' }));
  for (const kind of ['candidate_scan', 'frame_extract'] as const) {
    assert.equal(workspaceResultHref({ ...job, kind }, { id: 'workspace-1', project_id: 'actual-project' }), '/projects/actual-project/casting/workspace-1/cast');
  }
});

test('wording and measured-layout jobs return to their exact workspace review', () => {
  for (const kind of ['ai_suggestion', 'review_fit'] as const) {
    assert.equal(workspaceResultHref({ ...job, kind }, { id: 'workspace-1', project_id: 'actual-project' }), '/projects/actual-project/casting/workspace-1/review');
  }
  assert.equal(jobStageLabel('measure_review_fit'), 'Measuring template layout');
});


test('presentation recovery uses explicit current server actions instead of generic retry hints', () => {
  for (const kind of ['presentation_render', 'presentation_export'] as const) {
    const failed = { ...job, kind, stage: kind === 'presentation_render' ? 'render_presentation' : 'render_export', can_retry: false, can_cancel: false };
    assert.deepEqual(readProcessingJob(failed), failed);
    assert.deepEqual(processingActions(failed), { retry: false, cancel: false });
    assert.deepEqual(processingActions({ ...failed, error: { ...job.error!, retryable: false }, can_retry: true }), { retry: true, cancel: false });
    assert.deepEqual(processingActions({ ...failed, status: 'running', error: null }), { retry: false, cancel: false });
    assert.deepEqual(processingActions({ ...failed, status: 'running', error: null, can_cancel: true }), { retry: false, cancel: true });
    for (const status of ['succeeded', 'cancelled'] as const) {
      const terminal = { ...failed, status, error: null };
      assert.deepEqual(readProcessingJob(terminal), terminal);
      assert.deepEqual(processingActions(terminal), { retry: false, cancel: false });
    }
    assert.throws(() => readProcessingJob({ ...failed, can_retry: undefined }));
    assert.throws(() => readProcessingJob({ ...failed, can_cancel: 'false' }));
    assert.throws(() => readProcessingJob({ ...failed, status: 'succeeded', can_retry: true }));
    assert.throws(() => readProcessingJob({ ...failed, status: 'cancelled', can_cancel: true }));
  }
  assert.equal(jobStageLabel('prepare_presentation'), 'Preparing captured version');
  assert.equal(jobStageLabel('render_presentation'), 'Rendering PDF');
  assert.equal(jobStageLabel('validate_presentation'), 'Checking PDF and media');
  assert.equal(jobStageLabel('publish_presentation'), 'Saving ready version');
  assert.equal(workspaceResultHref({ ...job, kind: 'presentation_render' }, { id: 'workspace-1', project_id: 'actual-project' }), '/projects/actual-project/casting/workspace-1/presentations');
});
