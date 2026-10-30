import { expect, test } from '@playwright/test';

// Controlled desktop session/HTTP fixture. Browser timezone deliberately differs
// from both configured Studio zones; no account, settings RPC or provider runs.
test.use({ locale: 'en-GB', timezoneId: 'America/Los_Angeles' });
test('Studio timestamps use session UTC/Cairo across midnight independently of the browser timezone', async ({ page }) => {
  const instant = '2026-07-01T22:30:00.000Z';
  let timezone: string | undefined = 'UTC';
  const unexpected: string[] = []; const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/session') return route.fulfill({ json: { request_id: 'synthetic-timezone', data: { mode: 'supabase', timezone,
      actor: { id: 'synthetic-timezone-reader', name: 'Synthetic reader', capabilities: ['workspaces.read', 'operations.read'], upload_purposes: [] }, actors: [] } } });
    if (path === '/api/v1/jobs') return route.fulfill({ json: { request_id: 'synthetic-timezone', data: [{
      id: '97000000-0000-4000-8000-000000000001', workspace_id: null, kind: 'specs_extract', status: 'succeeded', stage: 'apply_specs', attempt: 1,
      progress_completed: 1, progress_total: 1, batch_id: null, input_asset_id: null, resource_id: null, error: null, row_version: 1,
      created_at: instant, updated_at: instant,
    }], page: { next_cursor: null } } });
    unexpected.push(path); return route.fulfill({ status: 404, json: { error: { code: 'SYNTHETIC_ROUTE_UNAVAILABLE', message: 'Unexpected request.' } } });
  });
  for (const configured of ['UTC', 'Africa/Cairo', undefined]) {
    timezone = configured;
    await page.goto('/processing');
    const label = page.locator('.processing-job-state time');
    const zone = configured ?? 'Africa/Cairo';
    const expected = configured === 'UTC' ? '1 Jul 2026, 22:30' : '2 Jul 2026, 01:30';
    await expect(label).toHaveText(`Submitted ${expected}`);
    await expect(label).toHaveAttribute('title', zone);
    await expect(label).toHaveAttribute('datetime', instant);
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('America/Los_Angeles');
    const browserLocal = await page.evaluate(value => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)), instant);
    expect(browserLocal).not.toBe(expected);
  }
  expect(unexpected).toEqual([]); expect(errors).toEqual([]);
});
