import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStudio, FIXTURE_ACTORS, FIXTURE_PROJECTS } from '@eps/domain';
import { validateContract } from '../../apps/web/lib/validation';
import schemas from '../../apps/web/lib/generated-contracts.json';

test('runtime schemas are sealed to the current authoritative OpenAPI source', async () => {
  const source = await readFile('contracts/openapi.yaml');
  assert.equal(schemas['x-source-sha256'], createHash('sha256').update(source).digest('hex'),
    'Regenerate runtime schemas with tools/generate_runtime_contracts.py after a contract change.');
});

test('foundation projections conform to authoritative OpenAPI schemas', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'eps-contracts-'));
  try {
    const studio = createStudio({ dataDir: dir, environment: 'test', adapterMode: 'local_fixture' });
    const actor = studio.resolveFixtureActor(FIXTURE_ACTORS.producer);
    validateContract('Capabilities', await studio.getCapabilities(actor));
    const projects = await studio.listProjects(actor); projects.data.forEach(project => validateContract('Project', project));
    validateContract('Page', projects.page);
    validateContract('Workspace', await studio.createWorkspace(actor, { project_id: FIXTURE_PROJECTS.first, initial_output: 'selection' }, { idempotencyKey: 'contract-workspace' }));
    (await studio.listAudiencePresets(actor)).data.forEach(preset => validateContract('AudiencePreset', preset));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('strict input contract rejects forged authority and missing revision', () => {
  assert.throws(() => validateContract('ProjectPatch', { name: 'x' }));
  assert.throws(() => validateContract('ProjectPatch', { row_version: 1, principal_id: 'forged' }));
  assert.throws(() => validateContract('WorkspaceCreate', { project_id: FIXTURE_PROJECTS.first, initial_output: 'selection', role: 'admin' }));
});
