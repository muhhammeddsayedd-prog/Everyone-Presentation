import type { Role, Workspace, ReorderWorkspace } from '@eps/domain';

export interface RoleOrderReader {
  getWorkspace(): Promise<Workspace>;
  listRoles(cursor: string | null): Promise<{ data: Role[]; page?: { next_cursor: string | null } }>;
}
function changed(): never { throw new Error('Reload saved requirements before reordering. The saved role list changed or could not be confirmed.'); }
/** Read a stable, complete snapshot; a page is never treated as a permutation. */
export async function readRoleOrder(reader: RoleOrderReader, workspaceId: string) {
  const before = await reader.getWorkspace();
  if (before.id !== workspaceId || !Number.isSafeInteger(before.row_version) || before.row_version < 1) changed();
  const roles: Role[] = []; const seen = new Set<string>(); let cursor: string | null = null;
  for (let page = 0; ; page++) {
    if (page >= 100) throw new Error('This role list is too large to confirm in one request. Your saved order has been kept.');
    const response = await reader.listRoles(cursor);
    for (const role of response.data) {
      if (role.workspace_id !== workspaceId || role.archived || roles.some(item => item.id === role.id)
        || roles.length && roles.at(-1)!.sort_order > role.sort_order) changed();
      roles.push(role);
    }
    if (!response.page || !(response.page.next_cursor === null || typeof response.page.next_cursor === 'string')) changed();
    cursor = response.page.next_cursor;
    if (cursor === null) break;
    if (!cursor || seen.has(cursor) || !response.data.length) changed();
    seen.add(cursor);
  }
  const after = await reader.getWorkspace();
  if (after.id !== workspaceId || after.row_version !== before.row_version) changed();
  return { workspace: after, roles };
}
export async function prepareRoleMove(reader: RoleOrderReader, workspaceId: string, displayed: readonly Role[],
  roleId: string, direction: -1 | 1): Promise<{ roles: Role[]; input: ReorderWorkspace }> {
  const snapshot = await readRoleOrder(reader, workspaceId);
  if (snapshot.roles.length !== displayed.length || snapshot.roles.some((role, index) => {
    const old = displayed[index]; return role.id !== old.id || role.row_version !== old.row_version || role.sort_order !== old.sort_order;
  })) changed();
  const role_ids = snapshot.roles.map(role => role.id); const index = role_ids.indexOf(roleId); const target = index + direction;
  if (index < 0 || target < 0 || target >= role_ids.length) changed();
  [role_ids[index], role_ids[target]] = [role_ids[target], role_ids[index]];
  return { roles: snapshot.roles, input: { row_version: snapshot.workspace.row_version, role_ids } };
}
