import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Synthetic browser acceptance for the everyone. frame: top bar, white navigation pill and recent workspaces.
const workspace = { href: '/projects/97700000-0000-4000-8000-000000000001/casting/97700000-0000-4000-8000-000000000002/project', projectId: '97700000-0000-4000-8000-000000000001', workspaceId: '97700000-0000-4000-8000-000000000002', name: 'Synthetic recent campaign' };

async function mock(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-frame', data } });
    if (url.pathname === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-frame-producer', name: 'Synthetic Producer', capabilities: ['projects.read', 'projects.write', 'workspaces.read', 'cast.read'], upload_purposes: [] }, actors: [] });
    if (url.pathname === '/api/v1/projects' || url.pathname === '/api/v1/clients') return route.fulfill({ json: { request_id: 'synthetic-frame', data: [], page: { next_cursor: null } } });
    if (url.pathname === '/api/v1/presentation-types') return ok([{ key: 'casting', label: 'Casting', status: 'available' }]);
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable.' } } });
  });
  return errors;
}

test('the navigation pill names every destination with a visible label and marks the current one', async ({ page }) => {
  const errors = await mock(page);
  await page.goto('/projects');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const name of ['Projects', 'Cast Library', 'Presentations', 'Processing', 'Settings']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Projects', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Settings', exact: true })).not.toHaveAttribute('aria-current', /.*/);
  // Labels are visible text on desktop; the current destination is the green pill.
  await expect(nav.getByRole('link', { name: 'Cast Library', exact: true }).locator('.rail-label')).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Projects', exact: true }).locator('.rail-current')).toHaveCSS('background-color', 'rgb(0, 205, 109)');
  await expect(page.getByRole('link', { name: 'Everyone Presentation Studio home', exact: true })).toHaveAttribute('href', '/projects');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('recent workspaces open from the top bar as a keyboard menu below it', async ({ page }) => {
  const errors = await mock(page);
  await page.addInitScript(entry => { window.localStorage.setItem('eps.recent-workspaces.v1', JSON.stringify([entry])); }, workspace);
  await page.goto('/projects');
  const trigger = page.getByRole('button', { name: 'Recent workspaces', exact: true });
  await trigger.click();
  const menu = page.getByRole('menu', { name: 'Recent workspaces' });
  const item = menu.getByRole('menuitem', { name: workspace.name, exact: true });
  await expect(item).toBeFocused();
  const [anchor, box] = await Promise.all([trigger.boundingBox(), menu.boundingBox()]);
  expect(box!.y).toBeGreaterThanOrEqual(anchor!.y + anchor!.height);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test('on a phone the navigation pill floats at the bottom without page overflow', async ({ page }) => {
  const errors = await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects');
  const box = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
  expect(Math.round(box!.y + box!.height)).toBe(844 - 12);
  expect(Math.round(box!.width)).toBe(390 - 24);
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
