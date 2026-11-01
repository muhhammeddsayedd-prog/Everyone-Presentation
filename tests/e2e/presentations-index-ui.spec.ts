import { expect, test, type Page } from '@playwright/test';

// Synthetic HTTP/DOM checks for series rename and archive through PATCH /presentation-series/{id}.
const workspaceId = '70000000-0000-4000-8000-000000000001';
const projectId = '70000000-0000-4000-8000-000000000002';
const seriesId = '70000000-0000-4000-8000-000000000003';
const audience = { id: '70000000-0000-4000-8000-000000000004', key: 'external', label: 'Client review', scope: 'external', settings: {}, archived: false, row_version: 1 };

async function index(page: Page, options: { conflictFirst?: boolean; capabilities?: string[] } = {}) {
  let series = { id: seriesId, workspace_id: workspaceId, output_type: 'selection', audience_preset_id: audience.id, audience_snapshot: audience, title: 'Synthetic Selection',
    latest_ready_version_id: null as string | null, latest_ready_version_no: null as number | null, row_version: 3, archived: false, template_key: 'everyone-casting', template_version: '1.1.0', template_content_sha256: 'a'.repeat(64), font_key: 'plex' };
  let conflict = options.conflictFirst ?? false; const patches: Record<string, unknown>[] = []; const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const ok = (data: unknown, page?: unknown) => route.fulfill({ json: { request_id: 'synthetic-index', data, ...(page ? { page } : {}) } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-producer', name: 'Synthetic Producer', capabilities: options.capabilities ?? ['workspaces.read', 'presentations.generate'], upload_purposes: [] }, actors: [] });
    if (path === '/api/v1/presentation-series' && request.method() === 'GET') return ok([series], { next_cursor: null });
    if (path === `/api/v1/workspaces/${workspaceId}`) return ok({ id: workspaceId, project_id: projectId, title: 'Synthetic Project', module: 'casting', active_output: 'selection', row_version: 1, draft_revision: 0, has_unpublished_changes: false });
    if (path === `/api/v1/presentation-series/${seriesId}` && request.method() === 'PATCH') {
      const body = request.postDataJSON(); patches.push(body);
      if (conflict) { conflict = false; return route.fulfill({ status: 409, json: { request_id: 'synthetic-index', error: { code: 'STALE_RESOURCE_VERSION', message: 'Series changed', details: { current_row_version: 4 }, retryable: false } } }); }
      series = { ...series, ...body, row_version: series.row_version + 1 }; return ok(series);
    }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto('/presentations');
  await expect(page.getByRole('heading', { name: 'Synthetic Selection', exact: true })).toBeVisible();
  return { patches, errors };
}

test('series rename validates, saves the trimmed title with its row version and confirms', async ({ page }) => {
  const model = await index(page);
  await page.getByRole('button', { name: 'Series actions for Synthetic Selection', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rename series', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename series' });
  const field = dialog.getByLabel('Series title', { exact: true });
  await expect(field).toBeFocused();
  await field.fill('   ');
  await expect(dialog.getByText('Enter a series title.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save title', exact: true })).toBeDisabled();
  await field.fill('  Agency shortlist  ');
  await page.getByRole('button', { name: 'Save title', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Agency shortlist', exact: true })).toBeVisible();
  expect(model.patches).toEqual([{ row_version: 3, title: 'Agency shortlist' }]);
  await expect(page.getByText('Series renamed to Agency shortlist.', { exact: true })).toBeVisible();
  expect(model.errors).toEqual([]);
});

test('a stale rename keeps the dialog open with a reload instruction', async ({ page }) => {
  const model = await index(page, { conflictFirst: true });
  await page.getByRole('button', { name: 'Series actions for Synthetic Selection', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rename series', exact: true }).click();
  await page.getByLabel('Series title', { exact: true }).fill('Renamed');
  await page.getByRole('button', { name: 'Save title', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Rename series' }).getByRole('alert')).toContainText('This series changed since the list loaded.');
  await expect(page.getByRole('heading', { name: 'Synthetic Selection', exact: true })).toBeVisible();
  expect(model.patches).toHaveLength(1); expect(model.errors).toEqual([]);
});

test('archive asks first, hides the series, and restore brings it back', async ({ page }) => {
  const model = await index(page);
  await page.getByRole('button', { name: 'Series actions for Synthetic Selection', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Archive series', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Archive “Synthetic Selection”?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(model.patches).toEqual([]);
  await page.getByRole('button', { name: 'Series actions for Synthetic Selection', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Archive series', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Archive “Synthetic Selection”?' }).getByRole('button', { name: 'Archive series', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic Selection', exact: true })).toHaveCount(0);
  await page.getByLabel('Show archived (1 loaded)').check();
  await expect(page.getByRole('heading', { name: 'Synthetic Selection', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Series actions for Synthetic Selection', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Restore series', exact: true }).click();
  await expect(page.getByText('No ready version yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Archived', { exact: true })).toHaveCount(0);
  expect(model.patches).toEqual([{ row_version: 3, archived: true }, { row_version: 4, archived: false }]);
  expect(model.errors).toEqual([]);
});

test('without generation permission the series actions are not offered', async ({ page }) => {
  await index(page, { capabilities: ['workspaces.read'] });
  await expect(page.getByRole('button', { name: /^Series actions for/ })).toHaveCount(0);
  await expect(page.getByText('Renaming and archiving series requires presentation generation permission.')).toBeVisible();
});
