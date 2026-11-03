import { expect, test, type Page } from '@playwright/test';

// Controlled browser/HTTP regressions only. No actual Storage, user or provider.
const projectId = '91200000-0000-4000-8000-000000000001';
const workspaceId = '91200000-0000-4000-8000-000000000002';
const uploadId = '91200000-0000-4000-8000-000000000003';
const assetId = '91200000-0000-4000-8000-000000000004';
const view = `/projects/${projectId}/casting/${workspaceId}/project`;
type Mode = 'complete-error' | 'lost-completion' | 'patch-error' | 'lost-patch' | 'unknown-put';
async function model(page: Page, mode: Mode) {
  const calls: { method: string; path: string; key?: string; body?: unknown }[] = [];
  let completed = false, chosen: string | null = null, version = 11, failed = false, closed = 'open';
  const workspace = () => ({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic Logo Project',
    logo_asset_id: chosen, logo_placement: 'cover', active_output: 'selection', row_version: version, draft_revision: 1,
    has_unpublished_changes: true, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
  const session = () => ({ id: uploadId, asset_id: assetId, protocol: 'signed_put', status: completed ? 'completed' : closed,
    upload_url: completed ? null : `/api/dev/uploads/${uploadId}/bytes`, upload_headers: completed ? {} : { 'Content-Type': 'image/png', 'x-upsert': 'false' },
    expires_at: '2099-10-28T00:00:00Z', maximum_bytes: 5 * 1024 * 1024 });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    calls.push({ method, path, key: request.headers()['idempotency-key'], ...(request.postData() && method !== 'PUT' ? { body: request.postDataJSON() } : {}) });
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-logo-recovery', data } });
    const fail = () => route.fulfill({ status: 503, json: { request_id: 'synthetic-logo-recovery', error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Synthetic interrupted response.', retryable: true } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-producer', name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write'], upload_purposes: ['client_logo'] }, actors: [] });
    if (path === `/api/v1/projects/${projectId}`) return ok({ id: projectId, name: 'Synthetic Logo Project', client_id: null, client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: false });
    if (path === `/api/v1/workspaces/${workspaceId}`) {
      if (method === 'PATCH') {
        if (!failed && mode === 'patch-error') { failed = true; return fail(); }
        chosen = request.postDataJSON().logo_asset_id; version++;
        if (!failed && mode === 'lost-patch') { failed = true; return fail(); }
      }
      return ok(workspace());
    }
    if (path === '/api/v1/uploads' || path === `/api/v1/uploads/${uploadId}`) return ok(session());
    if (path.endsWith('/bytes')) { if (mode === 'unknown-put') return route.abort('failed'); return route.fulfill({ status: 200, body: '' }); }
    if (path.endsWith('/complete')) {
      if (!failed && mode === 'complete-error') { failed = true; return fail(); }
      completed = true;
      if (!failed && mode === 'lost-completion') { failed = true; return fail(); }
      return ok({ asset: { id: assetId, status: 'ready', purpose: 'client_logo' }, processing_job_id: null, status: 'ready' });
    }
    if (path.endsWith('/cancel')) return ok({ success: true, affected_ids: [uploadId, assetId] });
    return ok({});
  });
  return { calls, chosen: () => chosen, close: (status: 'expired' | 'cancelled') => { closed = status; }, concurrentLogo: () => { chosen = '91200000-0000-4000-8000-000000000009'; version++; } };
}
async function choose(page: Page) {
  await page.goto(view);
  await page.getByLabel('Client logo', { exact: true }).setInputFiles({ name: 'synthetic-logo.png', mimeType: 'image/png', buffer: Buffer.from([1, 2, 3]) });
}
for (const mode of ['complete-error', 'lost-completion', 'patch-error', 'lost-patch', 'unknown-put'] as const) test(`logo ${mode} retains one upload and reconciles without cancelling or retransferring`, async ({ page }) => {
  const state = await model(page, mode); await choose(page);
  await expect(page.getByRole('region', { name: 'Client branding', exact: true }).getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload saved branding', exact: true })).toBeEnabled();
  expect(state.calls.filter(row => row.path.endsWith('/cancel'))).toHaveLength(0);
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Check and resume logo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Check and resume logo', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Logo saved' })).toBeVisible();
  expect(state.chosen()).toBe(assetId);
  expect(state.calls.filter(row => row.path === '/api/v1/uploads')).toHaveLength(1);
  expect(state.calls.filter(row => row.method === 'PUT')).toHaveLength(1);
  expect(state.calls.filter(row => row.path.endsWith('/cancel'))).toHaveLength(0);
  const completions = state.calls.filter(row => row.path.endsWith('/complete'));
  expect(completions).toHaveLength(mode === 'complete-error' || mode === 'lost-completion' ? 2 : 1);
  if (completions.length === 2) expect(completions[1]).toEqual(completions[0]);
  const patches = state.calls.filter(row => row.method === 'PATCH');
  expect(patches).toHaveLength(mode === 'patch-error' ? 2 : 1);
  if (patches.length === 2) expect(patches[1]).toEqual(patches[0]);
  if (mode === 'unknown-put' || mode === 'lost-completion') expect(state.calls.some(row => row.method === 'GET' && row.path === `/api/v1/uploads/${uploadId}`)).toBe(true);
});

test('a concurrent branding change survives until the user reviews and explicitly applies the verified logo', async ({ page }) => {
  const state = await model(page, 'complete-error'); await choose(page); await expect(page.getByRole('region', { name: 'Client branding', exact: true }).getByRole('alert')).toBeVisible();
  state.concurrentLogo(); page.on('dialog', dialog => dialog.accept()); await page.reload();
  await page.getByRole('button', { name: 'Check and resume logo', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Client branding', exact: true }).getByRole('alert')).toContainText('Saved branding changed');
  expect(state.calls.filter(row => row.method === 'PATCH')).toHaveLength(0);
  await page.getByRole('button', { name: 'Reload saved branding', exact: true }).click();
  state.concurrentLogo();
  await page.getByRole('button', { name: 'Use verified logo with current branding', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Client branding', exact: true }).getByRole('alert')).toContainText('Saved branding changed');
  expect(state.calls.filter(row => row.method === 'PATCH')).toHaveLength(0);
  await page.getByRole('button', { name: 'Reload saved branding', exact: true }).click();
  await page.getByRole('button', { name: 'Use verified logo with current branding', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Logo saved' })).toBeVisible();
  expect(state.calls.filter(row => row.method === 'PATCH')).toHaveLength(1);
  expect(state.calls.filter(row => row.method === 'PUT')).toHaveLength(1);
  expect(state.calls.filter(row => row.path.endsWith('/cancel'))).toHaveLength(0);
});

for (const status of ['expired', 'cancelled'] as const) test(`a ${status} stored logo cannot be revived after reload`, async ({ page }) => {
  const state = await model(page, 'complete-error'); await choose(page);
  await expect(page.getByRole('region', { name: 'Client branding', exact: true }).getByRole('alert')).toBeVisible();
  state.close(status); page.on('dialog', dialog => dialog.accept()); await page.reload();
  await page.getByRole('button', { name: 'Check and resume logo', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Client branding', exact: true }).getByRole('alert')).toContainText('cancelled or expired');
  await expect(page.getByRole('button', { name: 'Check and resume logo', exact: true })).toHaveCount(0);
  expect(state.calls.filter(row => row.path.endsWith('/complete'))).toHaveLength(1);
  expect(state.calls.filter(row => row.method === 'PATCH')).toHaveLength(0);
  expect(state.calls.filter(row => row.method === 'PUT')).toHaveLength(1);
  expect(state.calls.filter(row => row.path.endsWith('/cancel'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Choose another logo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Upload logo', exact: true })).toBeEnabled();
});
