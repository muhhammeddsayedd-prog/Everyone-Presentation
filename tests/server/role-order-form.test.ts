import assert from 'node:assert/strict';
import test from 'node:test';
import type { Role, Workspace } from '@eps/domain';
import { prepareRoleMove, readRoleOrder } from '../../apps/web/components/role-order-form.ts';

const workspace = { id: 'workspace', row_version: 19 } as Workspace;
const roles = ['a', 'b', 'c'].map((id, sort_order) => ({ id, workspace_id: 'workspace', sort_order,
  row_version: 4, archived: false })) as Role[];
const port = () => ({ getWorkspace: async () => workspace,
  listRoles: async (cursor: string | null) => ({ data: cursor ? roles.slice(2) : roles.slice(0, 2), page: { next_cursor: cursor ? null : 'b' } }) });

test('UI move uses complete saved order and workspace version, preserving stable identity', async () => {
  const result = await prepareRoleMove(port(), 'workspace', roles, 'b', -1);
  assert.deepEqual(result.input, { row_version: 19, role_ids: ['b', 'a', 'c'] });
  assert.deepEqual(result.roles, roles);
  assert.deepEqual(roles.map(role => role.id), ['a', 'b', 'c']);
  await assert.rejects(prepareRoleMove(port(), 'workspace', roles, 'a', -1));
});

test('UI refuses unseen order/role edits and changing workspace snapshots before a write can be prepared', async () => {
  for (const fresh of [[roles[1], roles[0], roles[2]], roles.map(role => role.id === 'a' ? { ...role, row_version: 5 } : role)]) {
    await assert.rejects(prepareRoleMove({ ...port(), listRoles: async () => ({ data: fresh, page: { next_cursor: null } }) }, 'workspace', roles, 'b', -1), /Reload saved requirements/);
  }
  let reads = 0;
  await assert.rejects(prepareRoleMove({ ...port(), getWorkspace: async () => ({ ...workspace, row_version: reads++ ? 20 : 19 }) },
    'workspace', roles, 'b', -1), /Reload saved requirements/);
});

test('failed, duplicate-cursor and cross-scope role reads produce no proposed order', async () => {
  await assert.rejects(prepareRoleMove({ ...port(), listRoles: async () => { throw new Error('Synthetic unavailable read'); } },
    'workspace', roles, 'b', -1), /unavailable read/);
  await assert.rejects(readRoleOrder({ ...port(), listRoles: async () => ({ data: roles, page: { next_cursor: 'c' } }) }, 'workspace'), /Reload saved requirements/);
  await assert.rejects(readRoleOrder({ ...port(), getWorkspace: async () => ({ ...workspace, id: 'other' }) }, 'workspace'), /Reload saved requirements/);
});
