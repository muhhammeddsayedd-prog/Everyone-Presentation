import assert from 'node:assert/strict';
import test from 'node:test';
import type { CentralJob } from '@eps/central';
import { readSpecsProcessingJob, SpecsProcessingScopeError, specsProcessingMessage } from '../../apps/web/components/specs-processing.ts';

const scope = { workspaceId: 'workspace-current', specId: 'spec-current', jobId: 'job-current' };
const job: CentralJob = { id: scope.jobId, workspace_id: scope.workspaceId, resource_id: scope.specId, kind: 'specs_extract',
  status: 'running', stage: 'extract_specs', attempt: 1, progress_completed: 1, progress_total: 3,
  batch_id: null, input_asset_id: null, error: null, row_version: 3,
  created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' };

test('source status requires the saved current job, workspace and Spec identity before displaying a result', () => {
  assert.deepEqual(readSpecsProcessingJob(job, scope), job);
  for (const change of [{ id: 'old-job' }, { workspace_id: 'other-workspace' }, { resource_id: 'other-spec' },
    { resource_id: null }, { kind: 'presentation_render' }, { row_version: 0 }]) {
    assert.throws(() => readSpecsProcessingJob({ ...job, ...change }, scope), SpecsProcessingScopeError);
  }
});

test('source processing messages describe persisted outcomes without displaying provider diagnostics', () => {
  assert.match(specsProcessingMessage(job), /Processing is in progress/u);
  assert.match(specsProcessingMessage({ ...job, status: 'succeeded' }), /Load the saved requirements/u);
  const error = { code: 'INPUT_CHANGED', message: 'private-provider-detail', details: {}, retryable: false };
  assert.match(specsProcessingMessage({ ...job, status: 'waiting_for_input', error }), /Existing edits have been retained/u);
  for (const status of ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'] as const) {
    assert.doesNotMatch(specsProcessingMessage({ ...job, status, error }), /private-provider-detail/u);
  }
});
