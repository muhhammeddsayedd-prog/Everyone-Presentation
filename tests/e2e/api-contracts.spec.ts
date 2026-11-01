import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { validateContract } from '../../apps/web/lib/validation';
import type { AudiencePreset, Project, UploadSession, Workspace } from '@eps/domain';

// API contexts are ephemeral. Do not capture auth cookies in network traces.
test.use({ trace: 'off', screenshot: 'off' });
// Override only when the test server runs on another port (for example a second worktree).
const origin = process.env.EPS_E2E_ORIGIN ?? 'http://127.0.0.1:3100';
const producer = '10000000-0000-4000-8000-000000000001';
const contributor = '10000000-0000-4000-8000-000000000002';
const projectId = '20000000-0000-4000-8000-000000000001';
const headers = (key = randomUUID()) => ({ Origin: origin, 'Idempotency-Key': key });

async function success<T>(response: APIResponse, schema: string, status = 200): Promise<T> {
  expect(response.status()).toBe(status);
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(['data', 'request_id']);
  expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/i);
  validateContract(schema, body.data);
  expect(response.headers()['cache-control']).toMatch(/(?:^|,\s*)no-store(?:,|$)/);
  expect(response.headers()['pragma']).toBe('no-cache');
  return body.data as T;
}
async function error(response: APIResponse, status: number, code: string) {
  expect(response.status()).toBe(status);
  const body = await response.json();
  validateContract('ErrorResponse', body);
  expect(Object.keys(body).sort()).toEqual(['error', 'request_id']);
  expect(body.error.code).toBe(code);
  expect(response.headers()['cache-control']).toMatch(/(?:^|,\s*)no-store(?:,|$)/);
  expect(response.headers()['pragma']).toBe('no-cache');
}
async function login(request: APIRequestContext, actorId: string) {
  const response = await request.post('/api/dev/session', { headers: headers(), data: { actor_id: actorId } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data.actor.id).toBe(actorId);
  // The session cookie is intentionally never read, logged, or attached.
}

test('actual HTTP envelopes enforce auth, idempotency, revision and strict input boundaries', async ({ request }) => {
  await error(await request.get('/api/v1/projects'), 401, 'AUTH_REQUIRED');
  await login(request, producer);
  await success(await request.get('/api/v1/capabilities'), 'Capabilities');
  const key = randomUUID();
  const input = { project_id: projectId, initial_output: 'selection' };
  const responses = await Promise.all(Array.from({ length: 4 }, () => request.post('/api/v1/workspaces', { headers: headers(key), data: input })));
  const workspaces = await Promise.all(responses.map(response => success<Workspace>(response, 'Workspace', 201)));
  expect(new Set(workspaces.map(workspace => workspace.id)).size).toBe(1);
  await error(await request.post('/api/v1/workspaces', { headers: headers(key), data: { ...input, initial_output: 'shortlist' } }), 409, 'IDEMPOTENCY_KEY_REUSED');

  const original = await success<Project>(await request.get(`/api/v1/projects/${projectId}`), 'Project');
  const temporaryName = `${original.name} · HTTP revision check`;
  try {
    const edited = await success<Project>(await request.patch(`/api/v1/projects/${projectId}`, { headers: headers(), data: { row_version: original.row_version, name: temporaryName } }), 'Project');
    expect(edited.row_version).toBeGreaterThan(original.row_version);
    await error(await request.patch(`/api/v1/projects/${projectId}`, { headers: headers(), data: { row_version: original.row_version, name: 'Stale overwrite must not save' } }), 409, 'STALE_RESOURCE_VERSION');
    expect((await success<Project>(await request.get(`/api/v1/projects/${projectId}`), 'Project')).name).toBe(temporaryName);
    await error(await request.patch(`/api/v1/projects/${projectId}`, { headers: headers(), data: { row_version: edited.row_version, principal_id: producer, name: 'Forged authority must not save' } }), 400, 'VALIDATION_FAILED');
    expect((await success<Project>(await request.get(`/api/v1/projects/${projectId}`), 'Project')).name).toBe(temporaryName);
  } finally {
    const current = await success<Project>(await request.get(`/api/v1/projects/${projectId}`), 'Project');
    if (current.name !== original.name) await success(await request.patch(`/api/v1/projects/${projectId}`, { headers: headers(), data: { row_version: current.row_version, name: original.name } }), 'Project');
  }

  const invalidBytes = Buffer.from('not a decoded raster image');
  const upload = await success<UploadSession>(await request.post('/api/v1/uploads', { headers: headers(), data: { workspace_id: workspaces[0].id, purpose: 'client_logo', filename: 'synthetic-invalid.png', mime_type: 'image/png', size_bytes: invalidBytes.length } }), 'UploadSession', 201);
  try {
    if (upload.upload_url === null) throw new Error('An open upload session must return its transfer URL.');
    await error(await request.put(upload.upload_url, { headers: { ...headers(), 'Content-Type': 'image/png' }, data: invalidBytes }), 422, 'SOURCE_UNREADABLE');
    const open = await success<UploadSession>(await request.get(`/api/v1/uploads/${upload.id}`), 'UploadSession');
    expect(open.status).toBe('open');
    await error(await request.post(`/api/v1/uploads/${upload.id}/complete`, { headers: headers(), data: { actual_size_bytes: invalidBytes.length, start_processing: false } }), 409, 'UPLOAD_INCOMPLETE');
  } finally {
    await success(await request.post(`/api/v1/uploads/${upload.id}/cancel`, { headers: headers(), data: {} }), 'Success');
  }
});

test('audience preset HTTP lifecycle is strict and settings authority is independent of project preparation', async ({ request, playwright }) => {
  await login(request, producer);
  const label = `Synthetic HTTP audience ${randomUUID()}`;
  let preset: AudiencePreset | undefined;
  let archived = false;
  const contributorRequest = await playwright.request.newContext({ baseURL: origin });
  try {
    preset = await success<AudiencePreset>(await request.post('/api/v1/audience-presets', { headers: headers(), data: { label, scope: 'external', settings: {} } }), 'AudiencePreset', 201);
    const createdId = preset.id;
    preset = await success<AudiencePreset>(await request.patch(`/api/v1/audience-presets/${preset.id}`, { headers: headers(), data: { row_version: preset.row_version, label: `${label} edited` } }), 'AudiencePreset');
    expect(preset.id).toBe(createdId);
    expect(preset.row_version).toBe(2);
    await login(contributorRequest, contributor);
    await error(await contributorRequest.post('/api/v1/audience-presets', { headers: headers(), data: { label: 'Denied audience creation', scope: 'external', settings: {} } }), 403, 'CAPABILITY_REQUIRED');
    await error(await contributorRequest.patch(`/api/v1/audience-presets/${preset.id}`, { headers: headers(), data: { row_version: preset.row_version, label: 'Denied audience edit' } }), 403, 'CAPABILITY_REQUIRED');
    await error(await contributorRequest.post(`/api/v1/audience-presets/${preset.id}/archive`, { headers: headers(), data: { row_version: preset.row_version } }), 403, 'CAPABILITY_REQUIRED');
    const result = await success<{ success: boolean; affected_ids: string[] }>(await request.post(`/api/v1/audience-presets/${preset.id}/archive`, { headers: headers(), data: { row_version: preset.row_version } }), 'Success');
    expect(result.affected_ids).toContain(preset.id); archived = true;
    const listed = await request.get(`/api/v1/audience-presets?q=${encodeURIComponent(label)}`);
    expect(listed.status()).toBe(200);
    const body = await listed.json();
    expect(Object.keys(body).sort()).toEqual(['data', 'page', 'request_id']);
    validateContract('Page', body.page);
    (body.data as AudiencePreset[]).forEach(item => validateContract('AudiencePreset', item));
    expect((body.data as AudiencePreset[]).some(item => item.id === preset!.id)).toBeFalsy();
  } finally {
    if (preset && !archived) await request.post(`/api/v1/audience-presets/${preset.id}/archive`, { headers: headers(), data: { row_version: preset.row_version } });
    await contributorRequest.dispose();
  }
});
