import { test, expect, type Page } from '@playwright/test';
import type { Role, Slot, Spec } from '@eps/domain';
import type { CentralJob } from '@eps/central';

// Controlled browser/HTTP evidence only. No Auth, provider, Storage or database.
const projectId = '82800000-0000-4000-8000-000000000001';
const workspaceId = '83800000-0000-4000-8000-000000000001';
const specId = '84800000-0000-4000-8000-000000000001';
const base = `/projects/${projectId}/casting/${workspaceId}/specs`;
const endpoint = `/api/v1/workspaces/${workspaceId}/specs`;
async function sourceWorkspace(page: Page, mode: 'normal' | 'unknown' | 'unavailable' | 'stale' | 'refresh-failure' | 'readonly' | 'manual-pending' | 'pristine' | 'operator' = 'normal') {
  let spec: Spec = { id: specId, workspace_id: workspaceId, source_asset_id: null, source_text: '\ufeffOriginal brief\r\n\r\nثلاثة أشخاص',
    normalized_instructions: mode === 'pristine' ? null : 'Saved manual instructions', clarifications: [], row_version: 7, processing_job_id: null };
  let roles: Role[] = []; let slots: Slot[] = [];
  const jobs = new Map<string, CentralJob>(); const jobMutations: { action: string; key: string; body: { row_version: number } }[] = [];
  const posts: { body: { source_text: string; row_version: number }; serialized: string; key: string }[] = [];
  const keys = new Map<string, unknown>(); let created = 0; let failed = false; let shouldFailRefresh = false;
  let releasePost: (() => void) | null = null; let releaseManual: (() => void) | null = null;
  let heldPost: Promise<void> | null = null; const manualGate = new Promise<void>(resolve => { releaseManual = resolve; });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'controlled-source-request', data } });
    const failure = (code: string, status: number) => route.fulfill({ status, json: { request_id: 'controlled-source-request', error: { code, message: 'Controlled response', details: {}, retryable: true } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: '81800000-0000-4000-8000-000000000001', name: 'Synthetic Source Producer', capabilities: mode === 'readonly' ? ['projects.read', 'workspaces.read'] : ['projects.read', 'workspaces.read', 'workspaces.write', ...mode === 'operator' ? ['operations.retry'] : []], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/projects/${projectId}`) return ok({ id: projectId, name: 'Synthetic Source Project', client_id: null, client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: mode !== 'readonly' });
    if (path === `/api/v1/workspaces/${workspaceId}`) return ok({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic Source Project', logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 51, draft_revision: 12, has_unpublished_changes: true, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
    if (path === `/api/v1/workspaces/${workspaceId}/roles` && method === 'GET') return route.fulfill({ json: { request_id: 'controlled-source-request', data: roles, page: { next_cursor: null } } });
    if (path === '/api/v1/roles/86800000-0000-4000-8000-000000000001/slots' && method === 'GET') return route.fulfill({ json: { request_id: 'controlled-source-request', data: slots, page: { next_cursor: null } } });
    const jobRoute = /^\/api\/v1\/jobs\/([^/]+)(?:\/(retry|cancel))?$/u.exec(path);
    if (jobRoute) {
      const job = jobs.get(jobRoute[1]); if (!job) return failure('RESOURCE_NOT_FOUND', 404);
      if (method === 'GET') return ok(job);
      if (method === 'POST' && jobRoute[2]) {
        const body = request.postDataJSON(); const key = request.headers()['idempotency-key'];
        jobMutations.push({ action: jobRoute[2], body, key });
        if (keys.has(key)) return ok(keys.get(key));
        if (body.row_version !== job.row_version) return failure('STALE_RESOURCE_VERSION', 409);
        const next = { ...job, status: jobRoute[2] === 'retry' ? 'queued' as const : 'cancelled' as const, error: null, row_version: job.row_version + 1 };
        jobs.set(job.id, next); keys.set(key, next); return ok(next);
      }
    }
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
      jobs.set(job, { id: job, workspace_id: workspaceId, resource_id: specId, kind: 'specs_extract', status: 'queued', stage: 'prepare_document',
        attempt: 0, progress_completed: 0, progress_total: 3, batch_id: null, input_asset_id: null, error: null, row_version: 1,
        created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
      const accepted = { job_id: job, resource_id: specId, poll_url: `/api/v1/jobs/${job}`, status: 'queued' }; keys.set(key, accepted);
      if (mode === 'unknown' && !failed) { failed = true; return failure('DEPENDENCY_UNAVAILABLE', 503); }
      if (mode === 'refresh-failure' && !failed) { failed = true; shouldFailRefresh = true; }
      return ok(accepted, 202);
    }
    return failure('CONTROLLED_ROUTE_UNAVAILABLE', 503);
  });
  return { posts, spec: () => spec, created: () => created, errors, jobs, jobMutations,
    complete: () => {
      const job = jobs.get(spec.processing_job_id!)!; jobs.set(job.id, { ...job, status: 'succeeded', stage: 'apply_specs', progress_completed: 3, row_version: job.row_version + 1 });
      spec = { ...spec, normalized_instructions: 'Saved extracted requirements', row_version: spec.row_version + 1 };
      roles = [{ id: '86800000-0000-4000-8000-000000000001', workspace_id: workspaceId, name: 'Extracted Performer', headcount: 2, category: null,
        requirements: { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [],
          shoot_dates: [], location: null, availability_requirements: null, other_instructions: null }, clarifications: [], sort_order: 0, row_version: 1, archived: false }];
      slots = [1, 2].map(number => ({ id: `87800000-0000-4000-8000-${String(number).padStart(12, '0')}`, role_id: roles[0].id,
        label: `Performer ${number}`, sort_order: number - 1, row_version: 1, archived: false }));
    },
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
  await page.getByRole('link', { name: 'Projects', exact: true }).first().click();
  await page.getByRole('alertdialog', { name: 'Leave this page?' }).getByRole('button', { name: 'Stay on this page', exact: true }).click();
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
test('controlled completed source is loaded from persisted reads only after dirty local forms are resolved', async ({ page }, testInfo) => {
  await page.clock.install(); const model = await sourceWorkspace(page, 'pristine'); await page.goto(base);
  await page.getByLabel('Pasted source text').fill('Synthetic brief: two performers.');
  await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  const processing = page.getByRole('region', { name: 'Source processing', exact: true });
  await expect(processing.locator('.badge')).toHaveText('Queued'); model.complete();
  await page.clock.fastForward(5000); await expect(processing.locator('.badge')).toHaveText('Completed');
  await expect(page.getByRole('heading', { name: 'Extracted Performer', exact: true })).toHaveCount(0);
  await page.getByLabel('New role name', { exact: true }).fill('Unsaved role name');
  await expect(processing.getByRole('button', { name: 'Load saved requirements', exact: true })).toBeDisabled();
  await expect(page.getByLabel('New role name', { exact: true })).toHaveValue('Unsaved role name');
  await page.getByLabel('New role name', { exact: true }).fill('');
  await processing.getByRole('button', { name: 'Load saved requirements', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Extracted Performer', exact: true })).toBeVisible();
  await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Saved extracted requirements');
  await page.getByRole('article', { name: 'Extracted Performer requirements', exact: true }).getByText('Individual slots', { exact: true }).click();
  await expect(page.getByLabel('Label for Performer 1', { exact: true })).toHaveValue('Performer 1');
  await expect(page.getByLabel('Label for Performer 2', { exact: true })).toHaveValue('Performer 2');
  expect(model.posts).toHaveLength(1); expect(model.jobMutations).toEqual([]); expect(model.errors).toEqual([]);
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`source-result-${width}.png`), fullPage: true });
  }
});
test('controlled source status rejects a different Spec job and never displays provider diagnostics', async ({ page }) => {
  await page.clock.install(); const model = await sourceWorkspace(page); await page.goto(base);
  await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  const processing = page.getByRole('region', { name: 'Source processing', exact: true });
  await expect(processing.locator('.badge')).toHaveText('Queued');
  const job = model.jobs.get(model.spec().processing_job_id!)!;
  model.jobs.set(job.id, { ...job, resource_id: 'another-private-spec', status: 'succeeded', row_version: 2,
    error: { code: 'PROCESSING_FAILED', message: 'private-provider-diagnostic', details: {}, retryable: false } });
  await page.clock.fastForward(5000); await expect(processing.getByRole('alert')).toBeVisible();
  await expect(processing.getByRole('button', { name: 'Load saved requirements', exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('private-provider-diagnostic');
  model.jobs.set(job.id, { ...job, status: 'running', row_version: 3 }); await processing.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(processing.locator('.badge')).toHaveText('In progress');
  expect(model.posts).toHaveLength(1); expect(model.jobMutations).toEqual([]); expect(model.errors).toEqual([]);
});
test('controlled saved source navigates through actual Processing actions and returns to its cancelled job after reload', async ({ page }) => {
  const model = await sourceWorkspace(page, 'operator'); await page.goto(base);
  await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  const processing = page.getByRole('region', { name: 'Source processing', exact: true });
  await expect(processing.locator('.badge')).toHaveText('Queued'); const job = model.jobs.get(model.spec().processing_job_id!)!;
  model.jobs.set(job.id, { ...job, status: 'failed', row_version: 2,
    error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'private-provider-diagnostic', details: {}, retryable: true } });
  await processing.getByRole('link', { name: 'Processing details', exact: true }).click();
  await page.getByRole('button', { name: 'Retry failed processing', exact: true }).click();
  await expect(page.locator('.processing-detail .badge')).toHaveText('Queued');
  await page.reload(); await expect(page.locator('.processing-detail .badge')).toHaveText('Queued');
  await page.getByRole('button', { name: 'Cancel processing', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect(page.locator('.processing-detail .badge')).toHaveText('Cancelled');
  await page.getByRole('link', { name: 'Open requirements', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Source processing', exact: true }).locator('.badge')).toHaveText('Cancelled');
  await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Saved manual instructions');
  expect(model.jobMutations.map(value => ({ action: value.action, body: value.body }))).toEqual([
    { action: 'retry', body: { row_version: 2 } }, { action: 'cancel', body: { row_version: 3 } },
  ]);
  expect(model.posts).toHaveLength(1); expect(model.created()).toBe(1);
  await expect(page.locator('body')).not.toContainText('private-provider-diagnostic'); expect(model.errors).toEqual([]);
});
