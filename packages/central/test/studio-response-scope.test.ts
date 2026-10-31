import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralStudio, type CentralStudio } from '../src/studio.ts';

const principal = '10000000-0000-4000-8000-000000000001';
const projectId = '20000000-0000-4000-8000-000000000001';
const workspaceId = '30000000-0000-4000-8000-000000000001';
const presetId = '40000000-0000-4000-8000-000000000001';
const unrelatedId = '50000000-0000-4000-8000-000000000001';
const actor = { principal_id: principal };
const context = { idempotencyKey: 'synthetic-stable-scope-key', clientType: 'mcp' as const };
const privateMarker = 'synthetic-unrelated-record-marker';
const project = { id: projectId, name: 'Synthetic project', client_id: null, client_name: null,
  client_logo_asset_id: null, row_version: 2, client_row_version: null, casting_workspace_id: workspaceId, can_edit: true };
const workspace = { id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic workspace',
  logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 2, draft_revision: 0,
  has_unpublished_changes: false, created_at: '2026-10-31T00:00:00Z', updated_at: '2026-10-31T00:00:00Z' };
const preset = { id: presetId, key: 'synthetic-audience', label: 'Synthetic audience', scope: 'external',
  settings: {}, archived: false, row_version: 2 };
type Call = { name: string; input: Record<string, unknown>; authorization: string | null };
async function service(reply: unknown) {
  const calls: Call[] = [];
  const client = createBearerUserClient({ url: 'https://synthetic-scope.example.invalid',
    publishableKey: 'sb_publishable_synthetic_key', accessToken: 'synthetic-user-token' }, {
    fetch: async (input, init) => {
      const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
      if (path === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
      assert.ok(path.startsWith('/rest/v1/rpc/eps_'));
      calls.push({ name: path.split('/').at(-1)!, input: JSON.parse(String(init?.body)),
        authorization: new Headers(init?.headers).get('authorization') });
      return Response.json(reply);
    },
  });
  return { studio: await createCentralStudio(client), calls };
}
const invoke = {
  getProject: (studio: CentralStudio) => studio.getProject(actor, projectId),
  updateProject: (studio: CentralStudio) => studio.updateProject(actor, projectId, { row_version: 1, name: project.name }, context),
  getWorkspace: (studio: CentralStudio) => studio.getWorkspace(actor, workspaceId),
  updateWorkspace: (studio: CentralStudio) => studio.updateWorkspace(actor, workspaceId, { row_version: 1, active_output: 'selection' }, context),
  createWorkspace: (studio: CentralStudio) => studio.createWorkspace(actor, { project_id: projectId, initial_output: 'selection' }, context),
  updateAudiencePreset: (studio: CentralStudio) => studio.updateAudiencePreset(actor, presetId, { row_version: 1, label: preset.label }, context),
  archiveAudiencePreset: (studio: CentralStudio) => studio.archiveAudiencePreset(actor, presetId, { row_version: 1 }, context),
};
function rejectedScope(error: unknown) {
  assert.ok(error instanceof DomainError);
  assert.equal(error.code, 'CENTRAL_RESPONSE_INVALID'); assert.equal(error.status, 503);
  for (const value of [privateMarker, unrelatedId]) assert.ok(!JSON.stringify(error).includes(value));
  return true;
}

for (const [name, reply] of [
  ['getProject', { ...project, id: unrelatedId, name: privateMarker }],
  ['updateProject', { ...project, id: unrelatedId, name: privateMarker }],
  ['getWorkspace', { ...workspace, id: unrelatedId, title: privateMarker }],
  ['updateWorkspace', { ...workspace, id: unrelatedId, title: privateMarker }],
  ['createWorkspace', { ...workspace, project_id: unrelatedId, title: privateMarker }],
  ['updateAudiencePreset', { ...preset, id: unrelatedId, label: privateMarker }],
] as const) {
  test(`CentralStudio ${name} rejects a valid RPC row outside the requested resource scope`, async () => {
    const fixture = await service(reply);
    await assert.rejects(invoke[name](fixture.studio), rejectedScope);
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.calls[0].authorization, 'Bearer synthetic-user-token');
  });
}

test('CentralStudio archive acknowledges exactly the requested audience preset', async () => {
  for (const affected_ids of [[], [unrelatedId], [presetId, unrelatedId], [presetId, presetId]]) {
    const fixture = await service({ success: true, affected_ids });
    await assert.rejects(invoke.archiveAudiencePreset(fixture.studio), rejectedScope);
    assert.equal(fixture.calls.length, 1);
  }
});

test('matching resource responses and stable mutation replays remain usable with the original scope and key', async () => {
  const replies = { getProject: project, updateProject: project, getWorkspace: workspace, updateWorkspace: workspace,
    createWorkspace: workspace, updateAudiencePreset: preset, archiveAudiencePreset: { success: true, affected_ids: [presetId] } };
  for (const name of Object.keys(invoke) as (keyof typeof invoke)[]) {
    const fixture = await service(replies[name]);
    assert.deepEqual(await invoke[name](fixture.studio), replies[name]);
    assert.deepEqual(await invoke[name](fixture.studio), replies[name]);
    assert.deepEqual(fixture.calls[0], fixture.calls[1]);
    if (!name.startsWith('get')) assert.equal(fixture.calls[0].input.p_idempotency_key, context.idempotencyKey);
  }
});
