import { test, expect, type Page } from '@playwright/test';
import type { Spec } from '@eps/domain';

// Controlled browser/HTTP evidence only. No Auth, provider, Storage or database.
const projectId = '82800000-0000-4000-8000-000000000001';
const workspaceId = '83800000-0000-4000-8000-000000000001';
const specId = '84800000-0000-4000-8000-000000000001';
const base = `/projects/${projectId}/casting/${workspaceId}/specs`;
const endpoint = `/api/v1/workspaces/${workspaceId}/specs`;
async function sourceWorkspace(page: Page, mode: 'normal' | 'unknown' | 'unavailable' | 'stale' | 'refresh-failure' | 'readonly' | 'manual-pending' = 'normal') {
  let spec: Spec = { id: specId, workspace_id: workspaceId, source_asset_id: null, source_text: '\ufeffOriginal brief\r\n\r\nثلاثة أشخاص',
    normalized_instructions: 'Saved manual instructions', clarifications: [], row_version: 7, processing_job_id: null };
  const posts: { body: { source_text: string; row_version: number }; serialized: string; key: string }[] = [];
  const keys = new Map<string, unknown>(); let created = 0; let failed = false; let shouldFailRefresh = false;
  let releasePost: (() => void) | null = null; let releaseManual: (() => void) | null = null;
  let heldPost: Promise<void> | null = null; const manualGate = new Promise<void>(resolve => { releaseManual = resolve; });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'controlled-source-request', data } });
    const failure = (code: string, status: number) => route.fulfill({ status, json: { request_id: 'controlled-source-request', error: { code, message: 'Controlled response', details: {}, retryable: true } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: '81800000-0000-4000-8000-000000000001', name: 'Synthetic Source Producer', capabilities: mode === 'readonly' ? ['projects.read', 'workspaces.read'] : ['projects.read', 'workspaces.read', 'workspaces.write'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/projects/${projectId}`) return ok({ id: projectId, name: 'Synthetic Source Project', client_id: null, client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: mode !== 'readonly' });
    if (path === `/api/v1/workspaces/${workspaceId}`) return ok({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic Source Project', logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 51, draft_revision: 12, has_unpublished_changes: true, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
    if (path === `/api/v1/workspaces/${workspaceId}/roles` && method === 'GET') return route.fulfill({ json: { request_id: 'controlled-source-request', data: [], page: { next_cursor: null } } });
    if (path === endpoint && method === 'GET') {
      if (shouldFailRefresh) { shouldFailRefresh = false; return failure('DEPENDENCY_UNAVAILABLE', 503); }
      return ok(spec);
    }
    if (path === endpoint && method === 'PATCH') {
      if (mode === 'manual-pending') await manualGate;
      const input = request.postDataJSON(); spec = { ...spec, normalized_instructions: input.normalized_instructions, row_version: spec.row_version + 1 }; return ok(spec);
    }
    if (path === endpoint && method === 'POST') {
      const body = request.postDataJSON(); const key = request.headers()['idempotency-key']; posts.push({ body, serialized: request.postData()!, key });
      if (heldPost) await heldPost;
      if (keys.has(key)) return ok(keys.get(key), 202);
      if (mode === 'unavailable') return failure('FEATURE_NOT_IMPLEMENTED', 503);
      if (mode === 'stale' && !failed) { failed = true; spec = { ...spec, source_text: 'Another saved correction', row_version: 9 }; return failure('STALE_RESOURCE_VERSION', 409); }
      if (body.row_version !== spec.row_version) return failure('STALE_RESOURCE_VERSION', 409);
      const job = `85800000-0000-4000-8000-${String(++created).padStart(12, '0')}`;
      spec = { ...spec, source_text: body.source_text, row_version: spec.row_version + 1, processing_job_id: job };
      const accepted = { job_id: job, resource_id: specId, poll_url: `/api/v1/jobs/${job}`, status: 'queued' }; keys.set(key, accepted);
      if (mode === 'unknown' && !failed) { failed = true; return failure('DEPENDENCY_UNAVAILABLE', 503); }
      if (mode === 'refresh-failure' && !failed) { failed = true; shouldFailRefresh = true; }
      return ok(accepted, 202);
    }
    return failure('CONTROLLED_ROUTE_UNAVAILABLE', 503);
  });
  return { posts, spec: () => spec, created: () => created, errors,
    holdPost: () => { heldPost = new Promise<void>(resolve => { releasePost = resolve; }); }, releasePost: () => { releasePost?.(); heldPost = null; },
    releaseManual: () => releaseManual?.() };
}

test('controlled pasted intake preserves saved source until acceptance, then persists correction and job link', async ({ page }, testInfo) => {
  const model = await sourceWorkspace(page); model.holdPost();
  await page.goto(base); await expect(page.getByLabel('Pasted source text')).toBeVisible();
  const replacement = '\ufeff  Corrected brief\n\nثلاثة ممثلين 😀  ';
  await page.getByLabel('Pasted source text').fill(replacement);
  await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  await expect.poll(() => model.posts.length).toBe(1); await expect(page.getByLabel('Pasted source text')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
  expect(model.spec().source_text).toContain('Original brief');
  await page.getByText('Read the saved source', { exact: true }).click(); await expect(page.locator('.source-brief pre')).toContainText('Original brief');
  model.releasePost();
  await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  await expect(page.locator('.source-brief pre')).toHaveText(replacement);
  expect(model.posts[0].body).toEqual({ source_text: replacement, row_version: 7 });
  await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Saved manual instructions');
  await page.reload(); await expect(page.getByRole('link', { name: 'View source processing' })).toHaveAttribute('href', `/processing?job=${model.spec().processing_job_id}`);
  await expect(page.getByLabel('Pasted source text')).toHaveValue(replacement);
  await page.getByLabel('Pasted source text').fill('Second ordinary correction'); await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  await expect.poll(() => model.created()).toBe(2); expect(model.posts[1].body.row_version).toBe(8); expect(model.posts[1].key).not.toBe(model.posts[0].key);
  await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  for (const width of [1440, 320]) { await page.setViewportSize({ width, height: 900 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: testInfo.outputPath(`source-intake-${width}.png`), fullPage: true }); }
  expect(model.errors).toEqual([]);
});
test('controlled lost acceptance response retries identical key/body and creates no second job', async ({ page }) => {
  const model = await sourceWorkspace(page, 'unknown'); await page.goto(base);
  // Unchanged server text retains its original CRLF/BOM through the first request.
  await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry this source request' })).toBeVisible();
  expect(model.posts[0].body.source_text).toBe('\ufeffOriginal brief\r\n\r\nثلاثة أشخاص');
  await expect(page.getByLabel('Pasted source text')).toHaveAttribute('readonly', '');
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('link', { name: 'Projects', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Retry this source request' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry this source request' }).click();
  await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  expect(model.posts).toHaveLength(2); expect(model.posts[1]).toEqual(model.posts[0]); expect(model.created()).toBe(1);
});
test('controlled processing readiness failure retains pasted text and allows manual editing', async ({ page }) => {
  const model = await sourceWorkspace(page, 'unavailable'); await page.goto(base);
  await page.getByLabel('Pasted source text').fill('Retained unsaved source'); await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Source processing is not available yet' })).toBeVisible();
  await expect(page.getByLabel('Pasted source text')).toBeEditable(); await expect(page.getByLabel('Pasted source text')).toHaveValue('Retained unsaved source');
  await expect(page.getByRole('button', { name: 'Upload PDF or Word' })).toBeDisabled();
  await page.getByLabel('General instructions', { exact: true }).fill('Manual work continues'); await expect.poll(() => model.spec().normalized_instructions).toBe('Manual work continues');
  expect(model.created()).toBe(0); expect(model.spec().source_text).toContain('Original brief'); await expect(page.getByRole('link', { name: 'View accepted processing' })).toHaveCount(0);
});
test('controlled stale source reload retains correction and submits with freshly read Spec version', async ({ page }) => {
  const model = await sourceWorkspace(page, 'stale'); await page.goto(base); await page.getByLabel('Pasted source text').fill('My source correction');
  await page.getByRole('button', { name: 'Process pasted text', exact: true }).click(); await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reload saved source', exact: true }).click();
  await expect(page.getByLabel('Pasted source text')).toHaveValue('My source correction'); await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Process pasted text', exact: true }).click(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  expect(model.posts.map(post => post.body.row_version)).toEqual([7, 9]); expect(model.posts[1].key).not.toBe(model.posts[0].key);
});
test('controlled dirty manual saves block source replacement without discarding either text', async ({ page }) => {
  const model = await sourceWorkspace(page, 'manual-pending'); await page.goto(base); await page.getByLabel('Pasted source text').fill('Source after manual work');
  await page.getByLabel('General instructions', { exact: true }).fill('Manual text retained while saving');
  await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeDisabled();
  await expect(page.getByText('Save or resolve the other requirement edits before submitting or reloading a source.')).toBeVisible(); expect(model.posts).toHaveLength(0);
  model.releaseManual(); await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Process pasted text', exact: true }).click(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  expect(model.posts[0].body.row_version).toBe(8); await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Manual text retained while saving');
});
test('controlled accepted request refresh failure retries only persisted reads', async ({ page }) => {
  const model = await sourceWorkspace(page, 'refresh-failure'); await page.goto(base); await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reload accepted source', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible(); await page.getByRole('button', { name: 'Reload accepted source', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeVisible(); expect(model.posts).toHaveLength(1); expect(model.created()).toBe(1);
});
test('controlled read-only source has no submit action', async ({ page }) => {
  const model = await sourceWorkspace(page, 'readonly'); await page.goto(base); await expect(page.getByRole('heading', { name: 'Source brief', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toHaveCount(0); await expect(page.getByLabel('Pasted source text')).toHaveCount(0); expect(model.posts).toHaveLength(0);
});
