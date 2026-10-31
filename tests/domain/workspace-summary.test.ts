import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkspaceSummary, workspaceSummaryId, WORKSPACE_SUMMARY_SERIES_LIMIT } from '../../packages/domain/src/workspace-summary.ts';
import { summaryId as id, workspaceSummaryFixture as summary } from '../fixtures/workspace-summary.ts';

test('summary retains uncapped counts, separate audience series, zero and unknown review state', () => {
  const input = summary(); const parsed = parseWorkspaceSummary(input, id(1));
  assert.deepEqual(parsed, input); assert.notEqual(parsed, input);
  assert.equal(parseWorkspaceSummary({ ...input, unreviewed_candidate_count: 0 }).unreviewed_candidate_count, 0);
  assert.equal(parseWorkspaceSummary(input).unreviewed_candidate_count, null);
});

test('summary is closed, safe-integer bounded and resource bound', () => {
  const valid = summary();
  for (const patch of [{ extra: true }, { workspace_id: 'bad' }, { row_version: 0 }, { draft_revision: -1 },
    { project_candidate_count: Number.MAX_SAFE_INTEGER + 1 }, { roles_needing_clarification: 1.5 },
    { assignment_count: { selection: 1, shortlist: 2 } }, { unreviewed_candidate_count: 131 },
    { review_issue_count: 0 }, { latest_ready_versions: [{ ...valid.latest_ready_versions[0], version_no: 0 }] },
    { latest_ready_versions: [{ ...valid.latest_ready_versions[0], candidate_id: id(4) }] }]) {
    assert.throws(() => parseWorkspaceSummary({ ...valid, ...patch }));
  }
  assert.throws(() => parseWorkspaceSummary(valid, id(9)));
  assert.throws(() => parseWorkspaceSummary({ ...valid, latest_ready_versions: [valid.latest_ready_versions[0], valid.latest_ready_versions[0]] }));
  assert.throws(() => parseWorkspaceSummary({ ...valid, latest_ready_versions: valid.latest_ready_versions.toReversed() }));
  assert.throws(() => parseWorkspaceSummary({ ...valid, latest_ready_versions: Array.from({ length: WORKSPACE_SUMMARY_SERIES_LIMIT + 1 }, (_, n) => ({ series_id: id(n + 2), output_type: 'selection', version_no: 1 })) }));
});

test('summary request identifiers reject malformed/forged path values', () => {
  assert.equal(workspaceSummaryId(id(1)), id(1));
  for (const value of ['', '../projects', `${id(1)} `, null, {}]) assert.throws(() => workspaceSummaryId(value));
  assert.throws(() => workspaceSummaryId('AAAAAAAA-0000-4000-8000-000000000001'));
});
