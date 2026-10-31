import { expect, test } from '@playwright/test';

// Synthetic HTTP/DOM checks for the Cast Library facets. Search semantics are
// owned by the candidate service; this verifies the UI sends exactly the
// supported filter parameters and represents them honestly.
const candidates = [1, 2, 3].map(n => ({ id: `cast-${n}`, review_status: n === 1 ? 'reviewed' : 'unreviewed', archived: false, possible_duplicate: n === 3,
  merged_into_candidate_id: null, row_version: 1, search_match: n === 2 ? { unknown_filter_fields: ['city'] } : null,
  facts: { name: `Synthetic person ${n}`, casting_id: `EPS-SYN-${n}`, age_or_range: '30–40', city: n === 2 ? null : 'Cairo', languages: ['Arabic'] } }));

test('library facets send supported filters, show removable chips and keep unknown values visible', async ({ page }) => {
  const queries: URLSearchParams[] = []; const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const ok = (data: unknown, extra: Record<string, unknown> = {}) => route.fulfill({ json: { request_id: 'synthetic-library', data, ...extra } });
    if (url.pathname === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-producer', name: 'Synthetic Producer', capabilities: ['cast.read', 'cast.write'], upload_purposes: [] }, actors: [] });
    if (url.pathname === '/api/v1/candidates' && route.request().method() === 'GET') { queries.push(url.searchParams); return ok(candidates, { page: { next_cursor: null } }); }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto('/library/cast');
  await expect(page.getByRole('heading', { name: 'Cast Library', exact: true })).toBeVisible();
  const results = page.getByRole('list', { name: 'Cast Library results' });
  await expect(results.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText('Possible duplicate', { exact: true })).toBeVisible();
  await expect(page.getByText('Unknown: city', { exact: true })).toBeVisible();

  await page.getByLabel('City', { exact: true }).fill('Cairo');
  await expect.poll(() => queries.at(-1)?.get('city')).toBe('Cairo');
  expect(queries.at(-1)?.get('include_unknown')).toBe('true');
  await page.getByRole('radio', { name: 'Reviewed', exact: true }).check();
  await expect.poll(() => queries.at(-1)?.get('review_status')).toBe('reviewed');
  const applied = page.getByLabel('Applied filters');
  await expect(applied.getByText('City: Cairo')).toBeVisible();
  await applied.getByRole('button', { name: 'Remove City filter', exact: true }).click();
  await expect(page.getByLabel('City', { exact: true })).toHaveValue('');
  await expect.poll(() => queries.at(-1)?.has('city')).toBe(false);

  await page.getByLabel('Include candidates with missing filter values').uncheck();
  await expect.poll(() => queries.at(-1)?.get('include_unknown')).toBe('false');
  await page.getByRole('button', { name: 'Clear 1', exact: true }).click();
  await expect.poll(() => queries.at(-1)?.has('review_status')).toBe(false);
  expect(queries.at(-1)?.get('include_unknown')).toBe('false');

  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 320, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
