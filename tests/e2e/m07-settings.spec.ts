import { test, expect, type Page } from '@playwright/test';

test.setTimeout(30000);

const initial = { template_version: '1.1.0', default_timezone: 'Africa/Cairo', default_review_expiry_days: 30,
  models: { specs: 'synthetic-model-v1' }, row_version: 1 };
async function settingsPage(page: Page, mode: 'normal' | 'unknown' | 'malformed' | 'reader' = 'normal') {
  let saved = { ...initial }; const attempts: { key: string | undefined; body: Record<string, unknown> }[] = []; let reads = 0;
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-settings', data, page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-producer', name: 'Synthetic operator', capabilities: mode === 'reader' ? ['workspaces.read'] : ['settings.manage', 'workspaces.read'] }, actors: [] });
    if (path === '/api/v1/audience-presets') return ok([]);
    if (path === '/api/v1/settings' && request.method() === 'GET') { reads++; return ok(saved); }
    if (path === '/api/v1/settings' && request.method() === 'PATCH') {
      const body = request.postDataJSON(); attempts.push({ key: request.headers()['idempotency-key'], body });
      if (attempts.length === 1) saved = { ...saved, ...body, row_version: 2 };
      if (mode === 'unknown' && attempts.length <= 2) return route.fulfill({ status: attempts.length === 1 ? 503 : 403,
        json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Synthetic interrupted acknowledgement' } } });
      if (mode === 'malformed' && attempts.length === 1) return ok({ ...saved, unexpected_private_configuration: 'synthetic-untrusted-marker' });
      return ok(saved);
    }
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Unexpected synthetic operation.' } } });
  });
  await page.goto('/settings');
  return { attempts, reads: () => reads };
}

test('settings defaults save through the typed operation and reload as central state', async ({ page }) => {
  const h = await settingsPage(page);
  await expect(page.getByLabel('Default timezone')).toHaveValue('Africa/Cairo');
  await page.getByLabel('Default timezone').fill('UTC');
  await page.getByRole('button', { name: 'Save defaults', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Studio defaults saved.');
  expect(h.attempts).toHaveLength(1); expect(h.attempts[0].key!.length).toBeGreaterThanOrEqual(16);
  expect(h.attempts[0].body).toMatchObject({ row_version: 1, default_timezone: 'UTC' });
  await page.reload(); await expect(page.getByLabel('Default timezone')).toHaveValue('UTC');
  await expect(page.getByText('30 days', { exact: true })).toBeVisible();
});
test('unknown settings writes keep the original body/key and block edits through later denial', async ({ page }) => {
  const h = await settingsPage(page, 'unknown');
  await page.getByLabel('Default timezone').fill('UTC'); await page.getByRole('button', { name: 'Save defaults', exact: true }).click();
  await expect(page.getByLabel('Default timezone')).toBeDisabled();
  await page.getByRole('button', { name: 'Confirm same save', exact: true }).click();
  await expect(page.getByLabel('Default timezone')).toBeDisabled();
  await page.getByRole('button', { name: 'Confirm same save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Studio defaults saved.');
  expect(h.attempts).toHaveLength(3); expect(h.attempts[1]).toEqual(h.attempts[0]); expect(h.attempts[2]).toEqual(h.attempts[0]);
});
test('untrusted successful settings acknowledgements retain the same save intent', async ({ page }) => {
  const h = await settingsPage(page, 'malformed');
  await page.getByLabel('Default timezone').fill('UTC'); await page.getByRole('button', { name: 'Save defaults', exact: true }).click();
  await expect(page.getByLabel('Default timezone')).toBeDisabled();
  await expect(page.getByText('synthetic-untrusted-marker')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirm same save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Studio defaults saved.');
  expect(h.attempts).toHaveLength(2); expect(h.attempts[1]).toEqual(h.attempts[0]);
});
test('read-only users do not request or edit privileged Studio defaults', async ({ page }) => {
  const h = await settingsPage(page, 'reader');
  await expect(page.getByRole('heading', { name: 'Audience presets', exact: true })).toBeVisible();
  await expect(page.getByLabel('Default timezone')).toHaveCount(0); expect(h.reads()).toBe(0);
});
