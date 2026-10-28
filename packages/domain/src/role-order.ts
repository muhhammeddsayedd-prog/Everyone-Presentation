import { DomainError, type Workspace } from './types.ts';
import type { Role } from './specs-types.ts';

/** Existing ReorderWorkspace contract; this slice implements role ordering only. */
export interface ReorderWorkspace {
  row_version: number;
  role_ids?: string[];
  slot_ids_by_role?: Record<string, string[]>;
  assignment_ids_by_slot?: Record<string, string[]>;
}
const invalid = (): never => { throw new DomainError('INVALID_REQUEST', 'Provide a row version and bounded role identifiers.', 400); };
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(isId)) invalid();
  return [...value as string[]];
}
export function parseReorderWorkspace(value: unknown): ReorderWorkspace {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['row_version', 'role_ids', 'slot_ids_by_role', 'assignment_ids_by_slot'].includes(key))
    || !Number.isSafeInteger(input.row_version) || Number(input.row_version) < 1) invalid();
  const result: ReorderWorkspace = { row_version: input.row_version as number };
  if (Object.hasOwn(input, 'role_ids')) result.role_ids = ids(input.role_ids);
  for (const name of ['slot_ids_by_role', 'assignment_ids_by_slot']) if (Object.hasOwn(input, name)) {
    const map = input[name];
    if (!map || typeof map !== 'object' || Array.isArray(map)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(map))) invalid();
    for (const [key, values] of Object.entries(map as Record<string, unknown>)) { if (!isId(key)) invalid(); ids(values); }
  }
  if (Object.hasOwn(input, 'slot_ids_by_role') || Object.hasOwn(input, 'assignment_ids_by_slot')) {
    throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Slot and assignment ordering are not available yet. Reorder roles separately.', 503);
  }
  return result;
}

/** Persistence must lock workspace and all current roles, then recheck scope/versions. */
export function planRoleOrder(workspace: Pick<Workspace, 'id' | 'row_version' | 'draft_revision'>,
  roles: readonly Role[], value: unknown) {
  const input = parseReorderWorkspace(value);
  if (input.row_version !== workspace.row_version) {
    throw new DomainError('STALE_RESOURCE_VERSION', 'The workspace changed. Reload its saved requirements.', 409);
  }
  const active = roles.filter(role => !role.archived).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  if (roles.some(role => role.workspace_id !== workspace.id) || new Set(roles.map(role => role.id)).size !== roles.length) {
    throw new DomainError('SPECS_STATE_INVALID', 'Role scope is inconsistent. Reload the saved requirements.', 409);
  }
  const ordered = input.role_ids ?? active.map(role => role.id);
  if (ordered.length !== active.length || new Set(ordered).size !== ordered.length
    || ordered.some(id => !active.some(role => role.id === id))) {
    throw new DomainError('ROLE_ORDER_INVALID', 'Use every active role exactly once.', 409);
  }
  const changed = ordered.some((id, index) => id !== active[index].id);
  const changes = changed ? ordered.flatMap((id, index) => {
    const role = active.find(role => role.id === id)!;
    return role.sort_order === index ? [] : [{ id, expected_row_version: role.row_version, sort_order: index }];
  }) : [];
  return { workspace_id: workspace.id, expected_row_version: workspace.row_version, changed, role_ids: [...ordered], changes,
    next_row_version: workspace.row_version + Number(changed), next_draft_revision: workspace.draft_revision + Number(changed) };
}
