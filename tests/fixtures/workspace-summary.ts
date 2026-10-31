export const summaryId = (n: number) => `66000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const workspaceSummaryFixture = () => ({ workspace_id: summaryId(1), row_version: 3, draft_revision: 9,
  roles_needing_clarification: 102, project_candidate_count: 130, unreviewed_candidate_count: null,
  open_slot_count: 7, assignment_count: { selection: 240, shortlist: 125 },
  latest_ready_versions: [{ series_id: summaryId(2), output_type: 'selection' as const, version_no: 4 },
    { series_id: summaryId(3), output_type: 'selection' as const, version_no: 2 }], review_issue_count: null });
