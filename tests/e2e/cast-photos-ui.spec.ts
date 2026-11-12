import { expect, test } from '@playwright/test';

// Synthetic checks for Cast Library cards: archive photos (m14) as portraits, a video frame otherwise, then the
// initial; and card text that shows the provided facts a casting team scans for, without generated archive IDs.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const facts = (name: string, extra: Record<string, unknown>) => ({ name, casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null, languages: [],
  accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null, ...extra });
const candidates = [
  { id: uuid(1), facts: facts('Archive Person', { casting_id: 'EPS-4526C61344E7C190FECF7E97486EBE55', age_or_range: 'Age 18-24, Age 25-34', stated_gender: 'Female', city: 'Cairo' }) },
  { id: uuid(2), facts: facts('Scanned Person', { casting_id: 'EPS-1042', age_or_range: '41', stated_gender: 'Male', city: 'Giza', classification: 'Actor', height_measurements: '182 cm', languages: ['Arabic', 'English'] }) },
  { id: uuid(3), facts: facts('Plain Person', {}) },
].map(item => ({ ...item, review_status: 'unreviewed', reviewed_at: null, reviewed_by: null, archived: false, possible_duplicate: false, merged_into_candidate_id: null,
  row_version: 1, search_match: null, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' }));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const photo = (n: number, cover: boolean) => ({ id: uuid(100 + n), position: n, cover, width: 400, height: 500, asset_id: uuid(200 + n), thumb_asset_id: uuid(300 + n) });

test('cards show the archive cover photo, else a video frame, else the initial; and only provided, useful facts', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()); const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-photos', data, page: { next_cursor: null } } });
    if (url.pathname === '/api/session') return route.fulfill({ json: { request_id: 's', data: { mode: 'supabase', actor: { id: 'synthetic-producer', name: 'Synthetic Producer', capabilities: ['cast.read'], upload_purposes: [] }, actors: [] } } });
    if (url.pathname === '/api/v1/candidates') return ok(candidates);
    if (url.pathname === `/api/v1/candidates/${uuid(1)}/photos`) return ok([photo(2, true), photo(1, false)]);
    if (url.pathname.endsWith('/photos')) return ok([]);
    if (url.pathname === `/api/v1/candidates/${uuid(2)}/media`) return ok([{ id: uuid(400), selected_frame_asset_ids: [uuid(500)], available_frames: [] }]);
    if (url.pathname.endsWith('/media')) return ok([]);
    if (url.pathname.endsWith('/content')) return route.fulfill({ status: 200, contentType: 'image/png', body: png });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto('/library/cast');
  const cards = page.getByRole('list', { name: 'Cast Library results' }).getByRole('listitem');
  await expect(cards).toHaveCount(3);
  // The cover (second in archive order) is used, at thumbnail size.
  await expect(cards.nth(0).locator('img')).toHaveAttribute('src', `/api/v1/candidate-photos/${uuid(302)}/content`);
  await expect(cards.nth(1).locator('img')).toHaveAttribute('src', `/api/v1/media/${uuid(500)}/content`);
  await expect(cards.nth(2).locator('img')).toHaveCount(0);
  await expect(cards.nth(0).locator('.library-portrait')).toHaveAttribute('data-loaded', '');
  // Facts: age, gender and city first; type, height and languages only when provided; generated IDs stay on the profile.
  await expect(cards.nth(0)).toContainText('Age 18–24, 25–34 · Female · Cairo');
  await expect(cards.nth(0)).not.toContainText('EPS-4526');
  await expect(cards.nth(1)).toContainText('41 · Male · Giza · EPS-1042');
  await expect(cards.nth(1)).toContainText('Actor · 182 cm · Arabic, English');
  for (const card of [cards.nth(0), cards.nth(2)]) await expect(card).not.toContainText(/not provided/u);
  expect(errors).toEqual([]);
});
