import { expect, test } from '@playwright/test';

// Controlled desktop HTTP/DOM proof. These synthetic values make no AI-quality claim.
const candidate = '97000000-0000-4000-8000-000000000001';
const raw = 'Synthetic private original-language source text.';
const english = 'Synthetic English introduction <img src=x onerror=alert(1)>.';
const facts = { name: 'Synthetic reviewed person', casting_id: 'EPS-SYNTHETIC', age_or_range: '16', stated_gender: null,
  height_measurements: null, languages: ['Arabic'], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };

test('shared profile displays English states without changing Reviewed facts or exposing raw text', async ({ page }) => {
  const writes: string[] = [];
  const sources = [
    { english_transcript_status: 'available', english_transcript: english },
    { english_transcript_status: 'not_provided', english_transcript: null },
    { english_transcript_status: 'unavailable', english_transcript: null },
    {},
    { english_transcript_status: 'available', english_transcript: null },
  ].map((projection, index) => ({ id: `synthetic-source-${index}`, candidate_id: candidate, source_asset_id: `synthetic-asset-${index}`,
    preview_asset_id: null, transcript_asset_id: null, original_transcript: raw, languages: index ? ['Arabic'] : ['العربية', 'fr', 'Arabic'], available_frames: [],
    selected_frame_asset_ids: [], processing_issues: [], row_version: 1, ...projection }));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-english-profile', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-english-profile', data, page: { next_cursor: null } } });
    if (request.method() !== 'GET') writes.push(path);
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-reader', name: 'Synthetic reader', capabilities: ['cast.read'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/candidates/${candidate}`) return ok({ id: candidate, facts, row_version: 4, review_status: 'reviewed',
      reviewed_at: '2026-10-30T10:00:00Z', possible_duplicate: false, merged_into_candidate_id: null, archived: false });
    if (path === `/api/v1/candidates/${candidate}/media`) return list(sources);
    if (path.endsWith('/supporting-files') || path.endsWith('/duplicates')) return list([]);
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable.' } } });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/library/cast/${candidate}`);
  await expect(page.getByRole('heading', { name: facts.name, exact: true })).toBeVisible();
  const sourcesUi = page.locator('.candidate-source');
  await expect(sourcesUi).toHaveCount(sources.length);
  await expect(page.getByText('Other spoken language, French, Arabic', { exact: true })).toBeVisible();
  await expect(page.getByText('العربية, fr, Arabic', { exact: true })).toHaveCount(0);
  for (const source of await sourcesUi.all()) await source.getByText('English transcript', { exact: true }).press('Enter');
  await expect(page.getByText(english, { exact: true })).toBeVisible();
  await expect(page.getByText(english, { exact: true })).toHaveAttribute('lang', 'en');
  await expect(page.getByText('English transcript not provided.', { exact: true })).toBeVisible();
  await expect(page.getByText('English transcript unavailable. The source speech could not be converted to English.', { exact: true })).toBeVisible();
  await expect(page.getByText('English transcript was not captured for this material.', { exact: true })).toBeVisible();
  await expect(page.getByText('The English transcript could not be confirmed.', { exact: true })).toBeVisible();
  await expect(page.getByText(raw, { exact: true })).toHaveCount(0);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.getByText('Shared facts · Reviewed', { exact: true })).toBeVisible();
  await expect(page.getByText('16', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit facts', exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: '.local/m03-english-ui/profile.png', fullPage: true });
});
