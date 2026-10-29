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

test('private file transfer contracts require explicit header access and stable output identity', () => {
  const scope = { job_id: '70000000-0000-4000-8000-000000000001', attempt_id: '70000000-0000-4000-8000-000000000002', lease_token: 'synthetic-private-lease' };
  const access = { asset_id: '70000000-0000-4000-8000-000000000003', url: 'https://synthetic.invalid/storage/v1/object/authenticated/eps-specs-assets/original.pdf',
    method: 'GET', headers: { 'x-eps-asset-grant': 'synthetic-private-grant' }, expires_at: '2026-10-29T00:00:00Z', mime_type: 'application/pdf', size_bytes: 17, sha256: 'a'.repeat(64) };
  validateContract('ServiceAssetAccess', access);
  assert.throws(() => validateContract('ServiceAssetAccess', { ...access, method: 'PUT' }));
  const { headers: _headers, ...legacyPlayback } = access; void _headers;
  assert.throws(() => validateContract('ServiceAssetAccess', legacyPlayback));
  assert.throws(() => validateContract('ServiceAssetAccess', { ...access, token: 'unannounced-authority' }));
  const output = { ...scope, output_key: 'document_text', asset_kind: 'document_text', filename: 'prepared-document.json', mime_type: 'application/json', expected_size_bytes: 100,
    parent_asset_id: access.asset_id, time_offset_ms: null };
  validateContract('JobOutputReservation', output);
  const { output_key: _key, ...withoutStableKey } = output; void _key;
  assert.throws(() => validateContract('JobOutputReservation', withoutStableKey));
  validateContract('JobAssetAccess', { ...scope, asset_id: access.asset_id, access: 'read' });
  assert.throws(() => validateContract('JobAssetAccess', { ...scope, asset_id: access.asset_id, access: 'delete' }));
});

test('foundation projections conform to authoritative OpenAPI schemas', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'eps-contracts-'));
  try {
    const studio = createStudio({ dataDir: dir, environment: 'test', adapterMode: 'local_fixture' });
    const actor = studio.resolveFixtureActor(FIXTURE_ACTORS.producer);
    validateContract('Capabilities', await studio.getCapabilities(actor));
    const projects = await studio.listProjects(actor); projects.data.forEach(project => validateContract('Project', project));
    validateContract('Page', projects.page);
    const workspace = await studio.createWorkspace(actor, { project_id: FIXTURE_PROJECTS.first, initial_output: 'selection' }, { idempotencyKey: 'contract-workspace' });
    validateContract('Workspace', workspace);
    const upload = await studio.createUploadSession(actor, { workspace_id: workspace.id, purpose: 'client_logo', filename: 'logo.png', mime_type: 'image/png', size_bytes: 100 }, { idempotencyKey: 'contract-upload' });
    validateContract('UploadSession', upload);
    await studio.cancelUpload(actor, upload.id, { idempotencyKey: 'contract-cancel' });
    const cancelled = await studio.getUploadSession(actor, upload.id);
    assert.equal(cancelled.upload_url, null);
    validateContract('UploadSession', cancelled);
    assert.throws(() => validateContract('UploadSession', { ...cancelled, status: 'open' }));
    assert.throws(() => validateContract('UploadSession', { ...cancelled, upload_url: upload.upload_url }));
    (await studio.listAudiencePresets(actor)).data.forEach(preset => validateContract('AudiencePreset', preset));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('strict input contract rejects forged authority and missing revision', () => {
  assert.throws(() => validateContract('ProjectPatch', { name: 'x' }));
  assert.throws(() => validateContract('ProjectPatch', { row_version: 1, principal_id: 'forged' }));
  assert.throws(() => validateContract('WorkspaceCreate', { project_id: FIXTURE_PROJECTS.first, initial_output: 'selection', role: 'admin' }));
});
