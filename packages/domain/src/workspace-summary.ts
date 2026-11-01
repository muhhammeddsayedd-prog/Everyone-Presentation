import { DomainError, type Actor } from './types.ts';

/** Finite response budget; overflow fails rather than silently dropping series. */
export const WORKSPACE_SUMMARY_SERIES_LIMIT = 1000;
export interface WorkspaceSummary {
  workspace_id: string;
  row_version: number;
  draft_revision: number;
  roles_needing_clarification: number;
  project_candidate_count: number;
  /** Unknown without cast.read; zero means an authorized count found none. */
  unreviewed_candidate_count: number | null;
  open_slot_count: number;
  assignment_count: { selection: number; shortlist: number };
  latest_ready_versions: { series_id: string; output_type: 'selection' | 'shortlist'; version_no: number }[];
  /** Review issues require a specific series/output/audience; unavailable here. */
  review_issue_count: null;
}
export interface WorkspaceSummaryOperations {
  getWorkspaceSummary(actor: Actor, workspaceId: string): Promise<WorkspaceSummary>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export function workspaceSummaryId(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new DomainError('VALIDATION_FAILED', 'Provide a canonical workspace UUID.', 400);
  return value;
}
function invalid(): never { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'The workspace summary did not match its scoped contract.', 503); }
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.hasOwn(row, key))) invalid();
  return row;
}
function integer(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) invalid();
  return value;
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) invalid();
  return value;
}
/** Shared validation for the database/SDK boundary; no personal data is exposed. */
export function parseWorkspaceSummary(value: unknown, expectedWorkspaceId?: string): WorkspaceSummary {
  const row = object(value, ['workspace_id', 'row_version', 'draft_revision', 'roles_needing_clarification',
    'project_candidate_count', 'unreviewed_candidate_count', 'open_slot_count', 'assignment_count', 'latest_ready_versions', 'review_issue_count']);
  const workspaceId = identifier(row.workspace_id);
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId || row.review_issue_count !== null) invalid();
  const assignments = object(row.assignment_count, ['selection', 'shortlist']);
  const selection = integer(assignments.selection), shortlist = integer(assignments.shortlist);
  const candidateCount = integer(row.project_candidate_count);
  const unreviewed = row.unreviewed_candidate_count === null ? null : integer(row.unreviewed_candidate_count);
  if (shortlist > selection || unreviewed !== null && unreviewed > candidateCount) invalid();
  if (!Array.isArray(row.latest_ready_versions) || row.latest_ready_versions.length > WORKSPACE_SUMMARY_SERIES_LIMIT) invalid();
  let previous = '';
  const latest = row.latest_ready_versions.map((value): WorkspaceSummary['latest_ready_versions'][number] => {
    const ready = object(value, ['series_id', 'output_type', 'version_no']);
    const id = identifier(ready.series_id);
    if (id <= previous || ready.output_type !== 'selection' && ready.output_type !== 'shortlist') invalid();
    previous = id;
    return { series_id: id, output_type: ready.output_type, version_no: integer(ready.version_no, 1) };
  });
  return { workspace_id: workspaceId, row_version: integer(row.row_version, 1), draft_revision: integer(row.draft_revision),
    roles_needing_clarification: integer(row.roles_needing_clarification), project_candidate_count: candidateCount,
    unreviewed_candidate_count: unreviewed, open_slot_count: integer(row.open_slot_count),
    assignment_count: { selection, shortlist }, latest_ready_versions: latest, review_issue_count: null };
}
