import type { CastingRetirement, CastingRetirementUndoResult } from '../../../packages/domain/src/review-types';

function invalid(): never { throw new Error('The restoration response could not be confirmed. Reload the saved restoration choice.'); }
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value && !/[\p{C}]/u.test(value);
const count = (value: unknown, minimum = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
export function readRetirementChoice(value: unknown, workspaceId: string, resourceId: string): CastingRetirement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(); const row = value as Record<string, unknown>;
  const keys = ['workspace_id', 'resource_id', 'operation', 'undo_event_id', 'expected_workspace_row_version', 'assignment_ids', 'slot_ids', 'main_count', 'shortlist_count', 'can_undo', 'unavailable_reason'];
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.hasOwn(row, key)) || row.workspace_id !== workspaceId || row.resource_id !== resourceId || !id(row.undo_event_id) || !count(row.expected_workspace_row_version, 1) || !['retire_slots', 'archive_role', 'remove_workspace_candidate'].includes(row.operation as string) || !count(row.main_count) || !count(row.shortlist_count) || typeof row.can_undo !== 'boolean' || !(row.unavailable_reason === null || id(row.unavailable_reason))) invalid();
  for (const key of ['assignment_ids', 'slot_ids']) if (!Array.isArray(row[key]) || (row[key] as unknown[]).length > 1000 || !(row[key] as unknown[]).every(id) || new Set(row[key] as string[]).size !== (row[key] as string[]).length) invalid();
  if ((row.main_count as number) > (row.assignment_ids as string[]).length || (row.shortlist_count as number) > (row.assignment_ids as string[]).length || row.can_undo && row.unavailable_reason !== null) invalid();
  return structuredClone(row) as unknown as CastingRetirement;
}
export function readRetirementUndo(value: unknown, expectedVersion: number): CastingRetirementUndoResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(); const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== 3 || row.success !== true || !count(row.workspace_row_version, expectedVersion + 1) || !Array.isArray(row.affected_ids) || !row.affected_ids.every(id) || row.affected_ids.length > 10000 || new Set(row.affected_ids).size !== row.affected_ids.length) invalid();
  return structuredClone(row) as unknown as CastingRetirementUndoResult;
}
export function retirementUnavailable(reason: string | null): string {
  switch (reason) {
    case 'ALREADY_UNDONE': return 'This removal has already been undone.';
    case 'RETIREMENT_TOO_LARGE': return 'This removal exceeds the restoration operation’s size limit. Archived choices remain saved.';
    case 'RETIREMENT_CHANGED': return 'A newer casting edit prevents this restoration.';
    case 'MAIN_CHANGED': return 'A slot’s Main changed after removal. Current casting choices are preserved.';
    default: return 'Restoration is unavailable for the current saved state.';
  }
}
