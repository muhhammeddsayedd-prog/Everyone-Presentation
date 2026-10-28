import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { createStudio, FIXTURE_ACTORS, FIXTURE_PROJECTS, DomainError } from '../../packages/domain/src/index.ts';

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const dataDir = await mkdtemp(join(tmpdir(), 'eps-domain-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const options = { dataDir, environment: 'test' as const, adapterMode: 'local_fixture' as const };
  const studio = createStudio(options);
  const producer = studio.resolveFixtureActor(FIXTURE_ACTORS.producer);
  const contributor = studio.resolveFixtureActor(FIXTURE_ACTORS.contributor);
  return { studio, producer, contributor, options };
}

function code(expected: string) {
  return (error: unknown) => error instanceof DomainError && error.code === expected;
}

test('fixture adapter is denied by both production environment signals', () => {
  assert.throws(() => createStudio({ dataDir: '.', environment: 'production', adapterMode: 'local_fixture' }), code('FIXTURE_MODE_FORBIDDEN'));
  const previous = process.env.NODE_ENV;
  Reflect.set(process.env, 'NODE_ENV', 'production');
  try {
    assert.throws(() => createStudio({ dataDir: '.', environment: 'test', adapterMode: 'local_fixture' }), code('FIXTURE_MODE_FORBIDDEN'));
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
    else Reflect.set(process.env, 'NODE_ENV', previous);
  }
});

test('project access and central edits use current capabilities and canonical client versions', async t => {
  const { studio, producer, contributor } = await fixture(t);
  assert.equal((await studio.listProjects(producer)).data.length, 2);
  assert.equal((await studio.listProjects(contributor)).data.length, 1);
  await assert.rejects(studio.getProject(contributor, FIXTURE_PROJECTS.second), code('RESOURCE_NOT_FOUND'));
  const first = await studio.getProject(producer, FIXTURE_PROJECTS.first);
  await assert.rejects(studio.updateProject(contributor, first.id, { row_version: first.row_version, name: 'Forbidden' }), code('CAPABILITY_REQUIRED'));
  const edited = await studio.updateProject(producer, first.id, { row_version: first.row_version, name: 'Corrected title', client_name: 'Corrected client', expected_client_row_version: first.client_row_version });
  assert.equal(edited.name, 'Corrected title');
  assert.equal((await studio.getProject(producer, FIXTURE_PROJECTS.second)).client_name, 'Corrected client');
  await assert.rejects(studio.updateProject(producer, first.id, { row_version: first.row_version, name: 'Stale' }), code('STALE_RESOURCE_VERSION'));
});

test('workspace concurrent create and retry persist one resource across service instances', async t => {
  const { studio, producer, options } = await fixture(t);
  const second = createStudio(options);
  const input = { project_id: FIXTURE_PROJECTS.first, initial_output: 'selection' as const };
  const results = await Promise.all([
    studio.createWorkspace(producer, input, { idempotencyKey: 'create-one' }),
    second.createWorkspace(second.resolveFixtureActor(FIXTURE_ACTORS.producer), input, { idempotencyKey: 'create-one' }),
    studio.createWorkspace(producer, input, { idempotencyKey: 'create-two' }),
  ]);
  assert.equal(new Set(results.map(x => x.id)).size, 1);
  assert.equal((await second.listWorkspaces(producer)).data.length, 1);
  await assert.rejects(studio.createWorkspace(producer, { ...input, project_id: FIXTURE_PROJECTS.second }, { idempotencyKey: 'create-one' }), code('IDEMPOTENCY_KEY_REUSED'));
});

test('separate Node processes serialize the same workspace creation without lost writes', async t => {
  const { studio, producer, options } = await fixture(t);
  const moduleUrl = new URL('../../packages/domain/src/index.ts', import.meta.url).href;
  const source = `import {createStudio,FIXTURE_ACTORS,FIXTURE_PROJECTS} from ${JSON.stringify(moduleUrl)};
const studio=createStudio(${JSON.stringify(options)});
const result=await studio.createWorkspace(studio.resolveFixtureActor(FIXTURE_ACTORS.producer),{project_id:FIXTURE_PROJECTS.first,initial_output:'selection'},{idempotencyKey:'cross-process'});
process.stdout.write(result.id);`;
  const run = () => new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], { env: process.env, shell: false });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', status => status === 0 ? resolve(stdout) : reject(new Error(stderr)));
  });
  const ids = await Promise.all([run(), run()]);
  assert.equal(ids[0], ids[1]);
  assert.equal((await studio.listWorkspaces(producer)).data.length, 1);
});

test('workspace edits race safely and output preference is per user without changing draft', async t => {
  const { studio, producer, contributor } = await fixture(t);
  const workspace = await studio.createWorkspace(producer, { project_id: FIXTURE_PROJECTS.first, initial_output: 'selection' }, { idempotencyKey: 'workspace' });
  const outcomes = await Promise.allSettled([
    studio.updateWorkspace(producer, workspace.id, { row_version: workspace.row_version, logo_placement: 'every_slide' }),
    studio.updateWorkspace(producer, workspace.id, { row_version: workspace.row_version, logo_placement: 'cover' }),
  ]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(x => x.status === 'rejected' && code('STALE_RESOURCE_VERSION')(x.reason)).length, 1);
  const latest = await studio.getWorkspace(producer, workspace.id);
  await studio.updateWorkspace(producer, latest.id, { row_version: latest.row_version, active_output: 'shortlist' });
  assert.equal((await studio.getWorkspace(producer, latest.id)).active_output, 'shortlist');
  assert.equal((await studio.getWorkspace(contributor, latest.id)).active_output, 'selection');
  assert.equal((await studio.getWorkspace(producer, latest.id)).draft_revision, latest.draft_revision);
});

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');

test('logo completion verifies stored bytes, scope, persistence and non-destructive removal', async t => {
  const { options } = await fixture(t);
  // Controlled deterministic decoder; the HTTP integration tests exercise sharp on actual bytes.
  const studio = createStudio({ ...options, decodeLogo: async bytes => {
    if (!Buffer.from(bytes).equals(tinyPng)) throw new Error('invalid test image');
    return { mimeType: 'image/png', width: 1, height: 1 };
  } });
  const producer = studio.resolveFixtureActor(FIXTURE_ACTORS.producer);
  const other = studio.resolveFixtureActor(FIXTURE_ACTORS.outsider);
  const workspace = await studio.createWorkspace(producer, { project_id: FIXTURE_PROJECTS.first, initial_output: 'selection' }, { idempotencyKey: 'workspace' });
  const upload = await studio.createUploadSession(producer, { workspace_id: workspace.id, purpose: 'client_logo', filename: 'transparent.png', mime_type: 'image/png', size_bytes: tinyPng.byteLength }, { idempotencyKey: 'upload' });
  await assert.rejects(studio.completeUpload(producer, upload.id, { actual_size_bytes: tinyPng.byteLength, start_processing: false }, { idempotencyKey: 'early-complete' }), code('UPLOAD_INCOMPLETE'));
  await assert.rejects(studio.storeUploadedLogo(other, upload.id, tinyPng), code('RESOURCE_NOT_FOUND'));
  await studio.storeUploadedLogo(producer, upload.id, tinyPng);
  await assert.rejects(studio.completeUpload(producer, upload.id, { actual_size_bytes: tinyPng.byteLength + 1, start_processing: false }, { idempotencyKey: 'wrong-size' }), code('VALIDATION_FAILED'));
  const completed = await studio.completeUpload(producer, upload.id, { actual_size_bytes: tinyPng.byteLength, start_processing: false }, { idempotencyKey: 'complete' });
  await assert.rejects(studio.completeUpload(producer, upload.id, { actual_size_bytes: tinyPng.byteLength + 1, start_processing: false }, { idempotencyKey: 'completed-wrong-size' }), code('VALIDATION_FAILED'));
  assert.equal(completed.status, 'ready');
  assert.equal(completed.processing_job_id, null);
  const closedSession = await studio.getUploadSession(producer, upload.id);
  assert.equal(closedSession.status, 'completed');
  assert.equal(closedSession.upload_url, null);
  assert.deepEqual(closedSession.upload_headers, {});
  const replayedCreate = await studio.createUploadSession(producer, { workspace_id: workspace.id, purpose: 'client_logo', filename: 'transparent.png', mime_type: 'image/png', size_bytes: tinyPng.byteLength }, { idempotencyKey: 'upload' });
  assert.equal(replayedCreate.status, 'completed');
  assert.equal(replayedCreate.upload_url, null);
  const selected = await studio.updateWorkspace(producer, workspace.id, { row_version: workspace.row_version, logo_asset_id: completed.asset.id, logo_placement: 'every_slide' });
  const restarted = createStudio(options);
  assert.equal((await restarted.getWorkspace(producer, selected.id)).logo_asset_id, completed.asset.id);
  assert.ok((await restarted.getMediaContent(producer, completed.asset.id)).bytes.equals(tinyPng));
  await assert.rejects(restarted.getMediaContent(other, completed.asset.id), code('RESOURCE_NOT_FOUND'));
  const removed = await studio.updateWorkspace(producer, selected.id, { row_version: selected.row_version, logo_asset_id: null });
  assert.equal(removed.logo_asset_id, null);
  assert.equal((await studio.getMedia(producer, completed.asset.id)).status, 'ready');
  assert.ok((await studio.getMediaContent(producer, completed.asset.id)).bytes.equals(tinyPng));
});

test('upload ownership, cancellation and image verification fail without creating ready media', async t => {
  const { studio, producer, contributor } = await fixture(t);
  const workspace = await studio.createWorkspace(producer, { project_id: FIXTURE_PROJECTS.first, initial_output: 'selection' }, { idempotencyKey: 'workspace' });
  await assert.rejects(studio.createUploadSession(producer, { workspace_id: workspace.id, purpose: 'client_logo', filename: 'script.svg', mime_type: 'image/svg+xml', size_bytes: 20 }, { idempotencyKey: 'svg' }), code('VALIDATION_FAILED'));
  const upload = await studio.createUploadSession(producer, { workspace_id: workspace.id, purpose: 'client_logo', filename: 'logo.png', mime_type: 'image/png', size_bytes: 20 }, { idempotencyKey: 'upload' });
  await assert.rejects(studio.cancelUpload(contributor, upload.id, { idempotencyKey: 'not-owner' }), code('RESOURCE_NOT_FOUND'));
  await assert.rejects(studio.storeUploadedLogo(producer, upload.id, new Uint8Array(20)), code('DEPENDENCY_UNAVAILABLE'));
  await studio.cancelUpload(producer, upload.id, { idempotencyKey: 'cancel' });
  assert.equal((await studio.getUploadSession(producer, upload.id)).upload_url, null);
  await assert.rejects(studio.completeUpload(producer, upload.id, { actual_size_bytes: 20, start_processing: false }, { idempotencyKey: 'late-complete' }), code('INVALID_TRANSITION'));
  assert.equal((await studio.getMedia(producer, upload.asset_id)).status, 'failed');
});

test('audience policies require settings authority, keep row versions and archive explicitly', async t => {
  const { studio, producer, contributor } = await fixture(t);
  assert.deepEqual((await studio.listAudiencePresets(producer)).data.map(x => x.key), ['internal_production', 'agency', 'client']);
  const input = { label: 'Agency pilot', scope: 'external' as const, settings: {} };
  await assert.rejects(studio.createAudiencePreset(contributor, input, { idempotencyKey: 'denied' }), code('CAPABILITY_REQUIRED'));
  const created = await studio.createAudiencePreset(producer, input, { idempotencyKey: 'audience' });
  const edited = await studio.updateAudiencePreset(producer, created.id, { row_version: created.row_version, label: 'Agency final' });
  await assert.rejects(studio.updateAudiencePreset(producer, created.id, { row_version: created.row_version, label: 'Stale' }), code('STALE_RESOURCE_VERSION'));
  await studio.archiveAudiencePreset(producer, created.id, { row_version: edited.row_version }, { idempotencyKey: 'archive' });
  assert.equal((await studio.listAudiencePresets(producer)).data.some(x => x.id === created.id), false);
});

test('search pagination excludes inaccessible and archived projects and rejects foreign cursors', async t => {
  const { studio, producer, contributor } = await fixture(t);
  const first = await studio.listProjects(producer, { q: 'synthetic', limit: 1 });
  assert.equal(first.data.length, 1);
  assert.ok(first.page.next_cursor);
  const second = await studio.listProjects(producer, { q: 'synthetic', cursor: first.page.next_cursor!, limit: 1 });
  assert.equal(second.data.length, 1);
  assert.notEqual(first.data[0]!.id, second.data[0]!.id);
  assert.equal(second.page.next_cursor, null);
  await assert.rejects(studio.listProjects(producer, { q: 'changed query', cursor: first.page.next_cursor! }), code('VALIDATION_FAILED'));
  await assert.rejects(studio.getProject(producer, FIXTURE_PROJECTS.archived), code('RESOURCE_NOT_FOUND'));
  await assert.rejects(studio.createWorkspace(contributor, { project_id: FIXTURE_PROJECTS.second, initial_output: 'selection' }, { idempotencyKey: 'denied' }), code('RESOURCE_NOT_FOUND'));
});
