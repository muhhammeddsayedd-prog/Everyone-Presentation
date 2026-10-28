import { test, expect } from '@playwright/test';
import sharp from 'sharp';

const browserDiagnostics = new Map<object, string[]>();
test.beforeEach(({ page }) => {
  const diagnostics: string[] = [];
  browserDiagnostics.set(page, diagnostics);
  page.on('pageerror', error => diagnostics.push(error.message));
  page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
});
test.afterEach(async ({ page }) => {
  expect(browserDiagnostics.get(page)).toEqual([]);
  await expect(page.locator('[data-nextjs-dialog-overlay]')).toHaveCount(0);
  browserDiagnostics.delete(page);
});

const producer = '10000000-0000-4000-8000-000000000001';
const contributor = '10000000-0000-4000-8000-000000000002';
const libraryViewer = '10000000-0000-4000-8000-000000000003';
const projectId = '20000000-0000-4000-8000-000000000001';

test('persistent M01 development journey: shared edits, real logo bytes and accessible steps', async ({ page }, testInfo) => {
  await page.goto('/projects');
  await page.getByLabel('Development identity').selectOption(producer);
  await page.getByRole('button', { name: 'Enter development workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic Restricted Project', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Open casting|Resume casting/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Shared project details' })).toBeVisible();
  const currentProject = /\/projects\/([^/]+)\//.exec(page.url())![1];
  const workspaceId = /\/casting\/([^/]+)\//.exec(page.url())![1];
  const project = (await (await page.request.get(`/api/v1/projects/${currentProject}`)).json()).data;
  const changedName = `${project.name} · browser check`;
  const saveRequest = page.waitForRequest(request => request.method() === 'PATCH' && request.url().endsWith(`/api/v1/projects/${currentProject}`));
  await page.getByLabel('Project name', { exact: true }).fill(changedName);
  expect((await saveRequest).postDataJSON()).not.toHaveProperty('client_name');
  await expect(page.getByRole('status').filter({ hasText: 'Saved to the shared project' })).toBeVisible();
  expect((await (await page.request.get(`/api/v1/projects/${currentProject}`)).json()).data.name).toBe(changedName);
  await page.reload();
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue(changedName);
  await page.getByLabel('Project name', { exact: true }).fill(project.name);
  await expect(page.getByRole('status').filter({ hasText: 'Saved to the shared project' })).toBeVisible();

  const transparentLogo = await sharp({ create: { width: 96, height: 48, channels: 4, background: { r: 255, g: 255, b: 255, alpha: .7 } } }).png().toBuffer();
  await page.locator('#client-logo').setInputFiles({ name: 'synthetic-logo.png', mimeType: 'image/png', buffer: transparentLogo });
  await expect(page.getByRole('status').filter({ hasText: 'Logo saved' })).toBeVisible();
  await expect(page.getByAltText('Selected client logo')).toBeVisible();
  await expect.poll(() => page.getByAltText('Selected client logo').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(96);
  if (await page.getByLabel('Every slide', { exact: true }).isChecked()) {
    await page.getByLabel('Cover only', { exact: true }).check();
    await expect(page.getByRole('status').filter({ hasText: 'Branding saved' })).toBeVisible();
  }
  await page.getByLabel('Every slide', { exact: true }).check();
  await expect(page.getByRole('status').filter({ hasText: 'Branding saved' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Every slide', { exact: true })).toBeChecked();
  await expect(page.getByAltText('Selected client logo')).toBeVisible();
  const oldAsset = (await (await page.request.get(`/api/v1/workspaces/${workspaceId}`)).json()).data.logo_asset_id;

  const replacement = await sharp({ create: { width: 144, height: 32, channels: 4, background: { r: 0, g: 205, b: 109, alpha: 1 } } }).png().toBuffer();
  await page.locator('#client-logo').setInputFiles({ name: 'synthetic-replacement.png', mimeType: 'image/png', buffer: replacement });
  await expect(page.getByRole('status').filter({ hasText: 'Logo saved' })).toBeVisible();
  await expect.poll(() => page.getByAltText('Selected client logo').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(144);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText('No client logo selected', { exact: true })).toBeVisible();
  expect((await page.request.get(`/api/v1/media/${oldAsset}/content`)).status()).toBe(200);
  await page.getByLabel('Cover only', { exact: true }).check();
  await expect(page.getByRole('status').filter({ hasText: 'Branding saved' })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('project-desktop.png'), fullPage: true });
  const stepNav = page.getByRole('navigation', { name: 'Casting workspace steps' });
  for (const step of ['Specs', 'Candidates', 'Casting', 'Review', 'Presentation']) {
    await stepNav.getByRole('link', { name: new RegExp(`${step}$`) }).click();
    await expect(page.getByText('Implementation pending', { exact: true })).toBeVisible();
  }
  await stepNav.getByRole('link', { name: /Project$/ }).click();
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue(project.name);
  await page.setViewportSize({ width: 320, height: 760 });
  await expect(page.getByRole('heading', { name: 'Shared project details' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('project-mobile.png'), fullPage: true });
});

test('acting-user scope is enforced in UI and direct requests', async ({ page }) => {
  await page.goto('/projects');
  await page.getByLabel('Development identity').selectOption(contributor);
  await page.getByRole('button', { name: 'Enter development workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  expect((await page.request.patch(`/api/v1/projects/${projectId}`, { data: { row_version: 1, name: 'Unauthorized edit' }, headers: { 'Idempotency-Key': crypto.randomUUID() } })).status()).toBe(403);
  expect((await page.request.get('/api/v1/projects/20000000-0000-4000-8000-000000000003')).status()).toBe(404);
  await page.getByRole('button', { name: /Open casting|Resume casting/ }).first().click();
  await expect(page.getByLabel('Project name', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Sign out of development session' }).click();
  await page.getByLabel('Development identity').selectOption(libraryViewer);
  await page.getByRole('button', { name: 'Enter development workspace' }).click();
  await expect(page.getByRole('heading', { name: 'No accessible projects.' })).toBeVisible();
});
