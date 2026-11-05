import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Synthetic browser acceptance for the presentation-first frame: icon rail, top bar and recent workspaces.
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

test('the icon rail names every destination, marks the current one and shows its label on focus', async ({ page }) => {
  const errors = await mock(page);
  await page.goto('/projects');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const name of ['Projects', 'Cast Library', 'Presentations', 'Processing', 'Settings']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Projects', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Settings', exact: true })).not.toHaveAttribute('aria-current', /.*/);
  // Labels are tooltips: hidden at rest, shown for keyboard focus.
  const label = nav.getByRole('link', { name: 'Cast Library', exact: true }).locator('.rail-label');
  await expect(label).toHaveCSS('opacity', '0');
  await nav.getByRole('link', { name: 'Cast Library', exact: true }).focus();
  await expect(label).toHaveCSS('opacity', '1');
  await expect(page.getByRole('link', { name: 'Everyone Presentation Studio home', exact: true })).toHaveAttribute('href', '/projects');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('recent workspaces open from the rail as a keyboard menu beside it', async ({ page }) => {
  const errors = await mock(page);
  await page.addInitScript(entry => { window.localStorage.setItem('eps.recent-workspaces.v1', JSON.stringify([entry])); }, workspace);
  await page.goto('/projects');
  const trigger = page.getByRole('button', { name: 'Recent workspaces', exact: true });
  await trigger.click();
  const menu = page.getByRole('menu', { name: 'Recent workspaces' });
  const item = menu.getByRole('menuitem', { name: workspace.name, exact: true });
  await expect(item).toBeFocused();
  const [rail, box] = await Promise.all([page.locator('.rail').boundingBox(), menu.boundingBox()]);
  expect(box!.x).toBeGreaterThanOrEqual(rail!.x + rail!.width);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test('on a phone the rail becomes a bottom bar without page overflow', async ({ page }) => {
  const errors = await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects');
  const rail = page.locator('.rail');
  const box = await rail.boundingBox();
  expect(Math.round(box!.y + box!.height)).toBe(844);
  expect(box!.width).toBe(390);
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
