import { expect, test } from '@playwright/test';
import type { CentralJob } from '@eps/central';

// Controlled HTTP/DOM coverage of the per-file batch strip and the job-detail drawer.
const workspaceId = '93900000-0000-4000-8000-000000000011';
const projectId = '94900000-0000-4000-8000-000000000011';
const batchId = '95900000-0000-4000-8000-000000000011';
const ids = ['92900000-0000-4000-8000-000000000011', '92900000-0000-4000-8000-000000000012', '92900000-0000-4000-8000-000000000013'];
const statuses: CentralJob['status'][] = ['succeeded', 'failed', 'running'];
const jobs: CentralJob[] = ids.map((id, index) => ({ id, workspace_id: workspaceId, kind: 'candidate_scan', status: statuses[index], stage: 'transcribe', attempt: 1,
  progress_completed: index, progress_total: 3, batch_id: batchId, input_asset_id: null, resource_id: null,
  error: statuses[index] === 'failed' ? { code: 'DEPENDENCY_UNAVAILABLE', message: 'synthetic', details: {}, retryable: true } : null,
  row_version: 1, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' }) as CentralJob);

test('a batch shows one status mark per loaded file and the job drawer closes back to the list', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    const ok = (data: unknown, extra: Record<string, unknown> = {}) => route.fulfill({ json: { request_id: 'controlled-batch', data, ...extra } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: '91900000-0000-4000-8000-000000000011', name: 'Synthetic Operator', capabilities: ['workspaces.read', 'operations.retry'], upload_purposes: [] }, actors: [] });
    if (path === '/api/v1/jobs') return ok(jobs, { page: { next_cursor: null } });
    const job = jobs.find(row => path === `/api/v1/jobs/${row.id}`); if (job) return ok(job);
    if (path === `/api/v1/workspaces/${workspaceId}`) return ok({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic batch workspace', logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 1, draft_revision: 0, has_unpublished_changes: false, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
    if (path === `/api/v1/projects/${projectId}`) return ok({ id: projectId, name: 'Synthetic batch project', client_id: null, client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: false });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto('/processing');
  const strip = page.getByRole('list', { name: '3 loaded files in this batch' });
  await expect(strip.getByRole('listitem')).toHaveCount(3);
  await expect(strip.getByText('File 2: Failed', { exact: true })).toBeAttached();
  await expect(page.getByText('1 in progress · 1 completed · 1 failed', { exact: false })).toBeVisible();
  const opener = page.getByRole('link', { name: 'Candidate scan', exact: true }).nth(1);
  await opener.click();
  const drawer = page.getByRole('dialog', { name: 'Processing details' });
  await expect(drawer.getByRole('heading', { name: 'Processing status', exact: true })).toBeVisible();
  await expect(drawer.locator('.processing-detail .badge')).toHaveText('Failed');
  await expect(drawer.getByRole('button', { name: 'Retry failed processing', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page).not.toHaveURL(/job=/);
  await expect(strip).toBeVisible();
  expect(errors).toEqual([]);
});
