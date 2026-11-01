import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Synthetic browser/HTTP acceptance. Real canonical/API/MCP acceptance is separate.
const projectId = '96600000-0000-4000-8000-000000000001';
const clientId = '96600000-0000-4000-8000-000000000002';
const workspaceId = '96600000-0000-4000-8000-000000000003';
const stamp = '2026-11-02T00:00:00Z';
type Created = { name: string; presentation_type: string; client_id?: string };
async function fixture(page: Page, options: { capabilities?: string[]; uncertain?: boolean; catalogFails?: boolean } = {}) {
  const writes: { path: string; key: string; body: Created }[] = [], errors: string[] = [], mutations: string[] = [];
  let saved: Created = { name: 'Synthetic folder project', presentation_type: 'casting' };
  const project = () => ({ id: projectId, name: saved.name, presentation_type: saved.presentation_type, client_id: saved.client_id ?? null, client_name: saved.client_id ? 'Synthetic permitted client' : null,
    client_logo_asset_id: null, row_version: 1, client_row_version: saved.client_id ? 1 : null, casting_workspace_id: null, can_edit: true });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), routePath = url.pathname;
    if (request.method() !== 'GET') mutations.push(routePath);
    const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'synthetic-project-create', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-project-create', data, page: { next_cursor: null } } });
    if (routePath === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-project-creator', name: 'Synthetic Producer', capabilities: options.capabilities ?? ['projects.read', 'projects.write', 'workspaces.read', 'workspaces.write', 'cast.read', 'cast.upload'], upload_purposes: ['candidate_video'], upload_maximum_bytes: 268435456 }, storage_origin: 'https://synthetic.example.invalid', actors: [] });
    if (routePath === '/api/v1/presentation-types') return options.catalogFails ? route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Presentation catalogue unavailable.' } } }) : ok([{ key: 'casting', label: 'Casting', status: 'available' }, { key: 'wardrobe', label: 'Wardrobe', status: 'planned' }]);
    if (routePath === '/api/v1/clients') return list([{ id: clientId, name: 'Synthetic permitted client', row_version: 1 }]);
    if (routePath === '/api/v1/projects' && request.method() === 'POST') {
      saved = request.postDataJSON(); writes.push({ path: routePath, key: request.headers()['idempotency-key'], body: saved });
      if (options.uncertain && writes.length === 1) return route.abort('failed');
      return ok(project(), 201);
    }
    if (routePath === '/api/v1/projects') return list([]);
    if (routePath === `/api/v1/projects/${projectId}`) return ok(project());
    if (routePath === `/api/v1/workspaces/${workspaceId}`) return ok({ id: workspaceId, project_id: projectId, title: saved.name, module: 'casting', active_output: 'selection', logo_asset_id: null, logo_placement: 'cover', row_version: 1, draft_revision: 0, has_unpublished_changes: false, created_at: stamp, updated_at: stamp });
    if (routePath === `/api/v1/workspaces/${workspaceId}/candidates`) return list([]);
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable.' } } });
  });
  return { writes, errors, mutations };
}

test('create a shared Casting project before starting any workspace', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/projects'); await page.getByRole('button', { name: 'New project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New project', exact: true });
  await expect(dialog.getByRole('button', { name: 'Create project', exact: true })).toBeDisabled();
  await dialog.getByLabel('Project name', { exact: true }).fill('Synthetic new campaign');
  const formAccessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(formAccessibility.violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
  await expect(page.getByRole('heading', { name: 'Synthetic new campaign', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start casting', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Synthetic new campaign', exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1); expect(state.writes[0].body).toEqual({ name: 'Synthetic new campaign', presentation_type: 'casting' });
  expect(state.writes[0].key).toHaveLength(36); expect(state.mutations).toEqual(['/api/v1/projects']); expect(state.errors).toEqual([]);
});

test('planned project with permitted client saves an overview without a workspace or generation controls', async ({ page }, testInfo) => {
  const state = await fixture(page);
  await page.goto('/projects'); await page.getByRole('button', { name: 'New project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New project', exact: true });
  await dialog.getByLabel('Project name', { exact: true }).fill('Synthetic wardrobe campaign');
  await dialog.getByLabel('Presentation type', { exact: true }).selectOption('wardrobe');
  await dialog.getByLabel('Shared client', { exact: true }).selectOption(clientId);
  await expect(dialog.getByText('The project can be created now. Wardrobe preparation and generation are Planned.', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('new-project-form.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic wardrobe campaign', exact: true })).toBeVisible();
  await expect(page.getByText('Wardrobe · Planned', { exact: true })).toBeVisible();
  const overviewAccessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(overviewAccessibility.violations).toEqual([]);
  await expect(page.getByRole('button', { name: /Start casting|Generate/ })).toHaveCount(0);
  expect(state.writes).toHaveLength(1); expect(state.writes[0].body).toEqual({ name: 'Synthetic wardrobe campaign', presentation_type: 'wardrobe', client_id: clientId });
  expect(state.mutations).toEqual(['/api/v1/projects']); expect(state.errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('planned-project-overview.png'), fullPage: true });
});

test('uncertain creation keeps the exact input and idempotency key until confirmed', async ({ page }) => {
  const state = await fixture(page, { uncertain: true });
  await page.goto('/projects'); await page.getByRole('button', { name: 'New project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New project', exact: true });
  await dialog.getByLabel('Project name', { exact: true }).fill('Synthetic recoverable project');
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Confirm create request', exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Project name', { exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Confirm create request', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic recoverable project', exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(2); expect(state.writes[0]).toEqual(state.writes[1]); expect(state.errors).toEqual([]);
});

test('project creation requires current project capabilities and a loaded catalogue', async ({ page }) => {
  await fixture(page, { capabilities: ['projects.read', 'workspaces.write'] }); await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toHaveCount(0);
  await page.unroute('**/api/**'); await fixture(page, { catalogFails: true }); await page.reload();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New project', exact: true });
  await dialog.getByLabel('Project name', { exact: true }).fill('Synthetic pending catalogue');
  await expect(dialog.getByText('Presentation catalogue unavailable.', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Create project', exact: true })).toBeDisabled();
});

test('folder selection feeds the resumable queue without claiming upload success', async ({ page }, testInfo) => {
  const state = await fixture(page);
  await page.goto(`/projects/${projectId}/casting/${workspaceId}/cast`);
  await page.getByRole('tab', { name: 'Uploads', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Choose files', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose folder', exact: true })).toBeVisible();
  const directory = testInfo.outputPath('synthetic-introductions'); await mkdir(path.join(directory, 'nested'), { recursive: true });
  const files = [path.join(directory, 'introduction.mp4'), path.join(directory, 'nested', 'introduction.mp4')];
  for (const file of files) { await writeFile(file, 'synthetic bytes, not live media'); await utimes(file, 1793577600, 1793577600); }
  await page.locator('input[webkitdirectory]').setInputFiles(directory);
  const queue = page.locator('.upload-queue'); await expect(queue.getByRole('listitem')).toHaveCount(2);
  await expect(queue.getByText(/0 \/ .* bytes confirmed · Ready to resume/)).toHaveCount(2);
  await expect(queue.getByText(/Processing requested|Supporting file saved/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Upload / resume pending files', exact: true })).toBeEnabled();
  await writeFile(path.join(directory, 'unsupported.txt'), 'synthetic unsupported introduction');
  await page.locator('input[webkitdirectory]').setInputFiles(directory);
  await expect(page.getByText('Choose a supported file with a matching extension and MIME type.', { exact: true })).toBeVisible();
  await expect(queue.getByRole('listitem')).toHaveCount(2);
  expect(state.writes).toEqual([]); expect(state.mutations).toEqual([]); expect(state.errors).toEqual([]);
});
