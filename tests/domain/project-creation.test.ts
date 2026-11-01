import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStudio, FIXTURE_ACTORS } from '@eps/domain';

test('project creation persists canonical identity and type with replay and separate Casting start', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'eps-project-create-'));
  try {
    const options = { dataDir: dir, environment: 'test' as const, adapterMode: 'local_fixture' as const };
    const studio = createStudio(options), actor = studio.resolveFixtureActor(FIXTURE_ACTORS.producer);
    const input = { name: '  New production  ', presentation_type: 'wardrobe' as const };
    const context = { idempotencyKey: 'project-creation-test-intent' };
    const [first, replay] = await Promise.all([studio.createProject(actor, input, context), studio.createProject(actor, input, context)]);
    assert.equal(first.id, replay.id); assert.equal(first.name, 'New production');
    assert.equal(first.presentation_type, 'wardrobe'); assert.equal(first.casting_workspace_id, null);
    assert.equal((await studio.listWorkspaces(actor, { project_id: first.id })).data.length, 0);
    assert.equal((await createStudio(options).getProject(actor, first.id)).presentation_type, 'wardrobe');
    await studio.updateProject(actor, first.id, { name: 'Renamed after creation', row_version: first.row_version });
    assert.deepEqual(await studio.createProject(actor, input, context), first);
    assert.equal((await studio.getProject(actor, first.id)).name, 'Renamed after creation');
    await assert.rejects(studio.createProject(actor, { ...input, name: 'Another' }, context), { code: 'IDEMPOTENCY_KEY_REUSED' });
    await assert.rejects(studio.getProject({ principal_id: FIXTURE_ACTORS.outsider }, first.id), { code: 'RESOURCE_NOT_FOUND' });
    const casting = await studio.createProject(actor, { name: 'Casting project', presentation_type: 'casting' }, { idempotencyKey: 'casting-project-intent' });
    assert.equal(casting.casting_workspace_id, null);
    const workspace = await studio.createWorkspace(actor, { project_id: casting.id, initial_output: 'selection' }, { idempotencyKey: 'start-casting-project' });
    assert.equal(workspace.project_id, casting.id);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('project create denies contributors, forged authority, unsupported types and foreign clients', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'eps-project-denial-'));
  try {
    const studio = createStudio({ dataDir: dir, environment: 'test', adapterMode: 'local_fixture' });
    const actor = studio.resolveFixtureActor(FIXTURE_ACTORS.producer), context = { idempotencyKey: 'create-denied-intent' };
    const input = { name: 'Test', presentation_type: 'casting' as const };
    await assert.rejects(studio.createProject({ principal_id: FIXTURE_ACTORS.contributor }, input, context), { code: 'CAPABILITY_REQUIRED' });
    for (const value of [{ ...input, principal_id: actor.principal_id }, { ...input, presentation_type: 'unknown' }, { ...input, name: ' ' }]) {
      await assert.rejects(studio.createProject(actor, value as typeof input, context), { code: 'VALIDATION_FAILED' });
    }
    await assert.rejects(studio.createProject(actor, { ...input, client_id: '30000000-0000-4000-8000-000000000099' }, context), { code: 'RESOURCE_NOT_FOUND' });
    const clients = await studio.listClients(actor); assert.equal(clients.data.length, 1);
    const created = await studio.createProject(actor, { ...input, client_id: clients.data[0].id }, context);
    assert.equal(created.client_id, clients.data[0].id);
    const types = await studio.listPresentationTypes(actor);
    assert.equal(types.find(row => row.key === 'casting')?.status, 'available');
    assert.ok(types.filter(row => row.key !== 'casting').every(row => row.status === 'planned'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
