import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Synthetic only. Panel: controlled HTTP routes. Facets: the real local_fixture HTTP path (no provider, no database).
const candidate = 'a4e00000-0000-4000-8000-000000000001';
const facts = { name: 'Synthetic Reviewed Person', casting_id: 'SYN-E2E', age_or_range: '30', stated_gender: 'Female', height_measurements: null, languages: ['Arabic'], accents: [],
  skills_experience: null, city: 'Dubai', previous_projects_roles: null, classification: null };
const obs = (id: string, media: string, person: number, attribute: string, value: string, status = 'suggested', row_version = 1) => ({ id, media_id: media, person_index: person,
  position_note: person ? 'right' : null, attribute, suggested_value: value, confidence: 'medium', evidence: 'Visible in the synthetic image.', status, override_value: null,
  effective_value: status === 'confirmed' ? value : null, reviewed_by: status === 'suggested' ? null : 'a4e00000-0000-4000-8000-0000000000aa', reviewed_at: status === 'suggested' ? null : '2026-11-10T00:00:00Z', row_version });
const media = (id: string, kind: 'photo' | 'frame', people: number, observations: unknown[]) => ({ id, asset_id: `${id.slice(0, -2)}99`, source_kind: kind, thumb_asset_id: null,
  candidate_media_id: kind === 'frame' ? 'a4e00000-0000-4000-8000-000000000077' : null, frame_timestamp_ms: kind === 'frame' ? 75_000 : null, media_category: kind === 'frame' ? 'video_frame' : 'headshot',
  recording_context: kind === 'frame' ? 'introduction_video' : 'archive_photo', media_added_at: '2026-11-01T00:00:00Z', people_count: people, ambiguous: people !== 1, target_person_index: null,
  quality_note: null, model: 'synthetic', prompt_version: 'appearance-v1', analyzed_at: '2026-11-02T00:00:00Z', row_version: 1, observations });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function profile(page: Page, capabilities: string[]) {
  const reviews: { id: string; body: Record<string, unknown>; key: string | undefined }[] = [];
  let state = { candidate_id: candidate,
    supplied: { archive: { source: { kind: 'archive_import', source_project: 'synthetic-archive', source_id: 'R-17', imported_at: '2026-11-09T00:00:00Z' }, name_ar: null, talent_type: 'talent',
      look: null, skin_tone: null, playing_age: ['Age 25-34'], hair_length: ['Long'], hair_texture: [], hair_colour: ['Black'], hair_style: [], hair_colouring: [], tags: ['Dancer'] },
      facts: [{ key: 'stated_gender', value: 'Female', source: 'archive' }, { key: 'age_or_range', value: '30', source: 'archive' }, { key: 'city', value: 'Dubai', source: 'archive' }, { key: 'languages', value: ['Arabic'], source: 'archive' }] },
    media: [media('a4e00000-0000-4000-8000-000000000010', 'frame', 1, [obs('a4e00000-0000-4000-8000-000000000011', 'a4e00000-0000-4000-8000-000000000010', 0, 'hair_colour', 'black'),
      obs('a4e00000-0000-4000-8000-000000000012', 'a4e00000-0000-4000-8000-000000000010', 0, 'skin_tone', 'medium'), obs('a4e00000-0000-4000-8000-000000000013', 'a4e00000-0000-4000-8000-000000000010', 0, 'glasses', 'unknown')]),
      media('a4e00000-0000-4000-8000-000000000020', 'photo', 2, [obs('a4e00000-0000-4000-8000-000000000021', 'a4e00000-0000-4000-8000-000000000020', 0, 'hair_colour', 'blonde'),
        obs('a4e00000-0000-4000-8000-000000000022', 'a4e00000-0000-4000-8000-000000000020', 1, 'hair_colour', 'black')])] };
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-appearance', data } }); const list = (data: unknown[]) => route.fulfill({ json: { request_id: 's', data, page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-reviewer', name: 'Synthetic Reviewer', capabilities, upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/candidates/${candidate}`) return ok({ id: candidate, facts, row_version: 1, review_status: 'unreviewed', reviewed_at: null, reviewed_by: null, possible_duplicate: false, merged_into_candidate_id: null, archived: false, search_match: null, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' });
    if (path === `/api/v1/candidates/${candidate}/observations`) return ok(state);
    if (/\/api\/v1\/candidate-observations\/[^/]+\/review$/u.test(path) && request.method() === 'POST') {
      const id = path.split('/')[4]; const body = request.postDataJSON(); reviews.push({ id, body, key: request.headers()['idempotency-key'] });
      state = structuredClone(state);
      for (const item of state.media) for (const row of item.observations as ReturnType<typeof obs>[]) if (row.id === id) {
        const status = ({ confirm: 'confirmed', reject: 'rejected', override: 'overridden', reset: 'suggested' } as Record<string, string>)[body.action];
        Object.assign(row, { status, override_value: body.value ?? null, effective_value: status === 'confirmed' ? row.suggested_value : body.value ?? null, reviewed_by: status === 'suggested' ? null : 'synthetic-reviewer', reviewed_at: status === 'suggested' ? null : '2026-11-16T00:00:00Z', row_version: row.row_version + 1 });
        if (item.ambiguous && ['confirmed', 'overridden'].includes(status)) item.target_person_index = row.person_index as never;
        return ok(row);
      }
    }
    if (path.endsWith('/content')) return route.fulfill({ status: 200, contentType: 'image/png', body: png });
    if (path.endsWith('/supporting-files') || path.endsWith('/media') || path.endsWith('/duplicates') || path.endsWith('/photos')) return list([]);
    return route.fulfill({ status: 404, json: { error: { code: 'CONTROLLED_ROUTE_UNAVAILABLE', message: 'Synthetic route unavailable.' } } });
  });
  return reviews;
}

test('profile panel separates suggestions, confirmed and corrected values and keeps supplied provenance', async ({ page }) => {
  const reviews = await profile(page, ['cast.read', 'cast.review']);
  await page.goto(`/library/cast/${candidate}`);
  const panel = page.getByRole('region', { name: 'Visible appearance' });
  await expect(panel).toContainText('confirmed and corrected values only');
  await expect(panel).toContainText('Imported from the cast archive (synthetic-archive, record R-17)');
  await expect(panel).toContainText('Stated age (supplied, not verified by appearance)');
  await expect(panel).toContainText('4 awaiting review'); await expect(panel).toContainText('0 searchable');
  const frame = panel.getByRole('article', { name: /Video frame, Video frame at 1:15/u });
  await expect(frame).toContainText('lighting can change visible tone');
  await expect(frame.getByText('Not clearly visible')).toBeVisible();
  // Confirm a suggestion, then correct another with a closed-vocabulary value.
  await frame.getByRole('listitem').filter({ hasText: 'Hair colour' }).getByRole('button', { name: 'Confirm' }).click();
  await expect(panel.getByRole('status')).toContainText('Confirmed. It is now searchable.');
  await expect(panel).toContainText('1 searchable');
  const skin = frame.getByRole('listitem').filter({ hasText: 'Visible skin tone' });
  await skin.getByRole('button', { name: 'Correct' }).click();
  await skin.getByLabel('Correct visible skin tone').selectOption('tan');
  await skin.getByRole('button', { name: 'Save correction' }).click();
  await expect(skin).toContainText('Corrected by reviewer'); await expect(skin).toContainText('Tan');
  expect(reviews.map(entry => entry.body)).toEqual([{ row_version: 1, action: 'confirm' }, { row_version: 1, action: 'override', value: 'tan' }]);
  expect(reviews.every(entry => entry.key && entry.key.length === 36)).toBe(true);
  // Group photo: needs review; confirming person 2 selects them and locks out person 1.
  const group = panel.getByRole('article', { name: /Headshot, Archive photo/u });
  await expect(group).toContainText('Needs review'); await expect(group).toContainText('Nothing from this image is searchable');
  await group.getByRole('listitem').filter({ hasText: 'Black' }).getByRole('button', { name: 'Confirm' }).click();
  await expect(group).toContainText('Person 2 was confirmed as this candidate');
  await expect(group.getByRole('listitem').filter({ hasText: 'Blonde' }).getByRole('button')).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include('section[aria-labelledby]').analyze();
  expect(axe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('viewers without cast.review see suggestions but no review controls', async ({ page }) => {
  await profile(page, ['cast.read']);
  await page.goto(`/library/cast/${candidate}`);
  const panel = page.getByRole('region', { name: 'Visible appearance' });
  await expect(panel).toContainText('Suggestion awaiting review');
  await expect(panel.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
});

test('facet filters: counts of people, OR within and AND across facets, chips, unknown toggle and Reset (local fixture)', async ({ page }) => {
  // Sign in to the local development fixture (synthetic producer), then open the preview page.
  await page.goto('/projects');
  await page.getByLabel('Development identity').selectOption('10000000-0000-4000-8000-000000000001');
  await page.getByRole('button', { name: 'Enter development workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  const direct = await page.request.post('/api/v1/candidate-facets/query', { data: { facets: {} }, headers: { Origin: new URL(page.url()).origin } });
  expect(direct.status(), await direct.text()).toBe(200);
  await page.goto('/dev/library-filters');
  const filters = page.getByRole('region', { name: 'Cast Library filters' });
  await expect(filters).toContainText('3 people');
  await expect(filters).toContainText('suggestions awaiting review are not counted');
  const city = filters.locator('details').filter({ hasText: 'City (supplied)' });
  await city.getByLabel(/dubai/u).check();
  await expect(filters).toContainText('2 people');
  await expect(page).toHaveURL(/facet=city%3Adubai/u);
  const talent = filters.locator('details').filter({ hasText: 'Talent type' });
  await talent.getByLabel(/Real family/u).check();
  await expect(filters).toContainText('1 person');
  await talent.getByRole('checkbox', { name: /^Talent\s*\d+$/u }).check();
  await expect(filters).toContainText('2 people');
  await expect(filters.getByRole('list', { name: 'Active filters' }).getByRole('listitem')).toHaveCount(3);
  await filters.getByRole('button', { name: /Remove filter Talent type: Real family/u }).click();
  await expect(filters).toContainText('1 person');
  const glasses = filters.locator('details').filter({ hasText: 'Glasses' }); await glasses.locator('summary').click();
  await glasses.getByLabel('Unknown / not provided').check();
  await expect(filters).toContainText('1 person');
  await filters.getByLabel(/Include people with unknown value/u).check();
  await expect(page).toHaveURL(/include_unknown=true/u);
  await filters.getByRole('button', { name: 'Reset filters' }).click();
  await expect(filters).toContainText('3 people');
  const axe = await new AxeBuilder({ page }).include('section[aria-label="Cast Library filters"]').analyze();
  expect(axe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('Cast Library mounts the facet filters: selections reach search as facets and counts use the same filters', async ({ page }) => {
  const searches: URLSearchParams[] = []; const facetBodies: Record<string, unknown>[] = [];
  const person = (n: number) => ({ id: `a4e10000-0000-4000-8000-00000000000${n}`, facts: { ...facts, name: `Synthetic Library ${n}` }, review_status: 'unreviewed', reviewed_at: null, reviewed_by: null,
    archived: false, possible_duplicate: false, merged_into_candidate_id: null, row_version: 1, search_match: null, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' });
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (path === '/api/session') return route.fulfill({ json: { request_id: 's', data: { mode: 'supabase', actor: { id: 'synthetic-reader', name: 'Synthetic Reader', capabilities: ['cast.read'], upload_purposes: [] }, actors: [] } } });
    if (path === '/api/v1/candidates') { searches.push(url.searchParams); const filtered = url.searchParams.has('facets');
      return route.fulfill({ json: { request_id: 's', data: filtered ? [person(1)] : [person(1), person(2)], page: { next_cursor: null } } }); }
    if (path === '/api/v1/candidate-facets/query') { const body = request.postDataJSON(); facetBodies.push(body); const selected = Object.keys(body.facets ?? {}).length > 0;
      return route.fulfill({ json: { request_id: 's', data: { total: selected ? 1 : 2, filters: { facets: body.facets ?? {}, include_unknown: false, q: null }, facets: ['talent_type', 'city', 'stated_gender', 'playing_age', 'skin_tone', 'hair_length', 'hair_colour', 'hair_texture', 'facial_hair', 'glasses', 'build', 'languages', 'look', 'tags']
        .map(key => ({ key, matched: 2, unknown: 1, values: key === 'hair_colour' ? [{ value: 'black', count: 1 }] : [], selected: body.facets?.[key] ?? [] })) } } }); }
    if (path.endsWith('/photos') || path.endsWith('/media')) return route.fulfill({ json: { request_id: 's', data: [], page: { next_cursor: null } } });
    return route.fulfill({ status: 404, json: { error: { code: 'CONTROLLED_ROUTE_UNAVAILABLE', message: 'Synthetic route unavailable.' } } });
  });
  await page.goto('/library/cast');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const filters = page.getByRole('region', { name: 'Cast Library filters' });
  await expect(filters).toContainText('2 people');
  // A stray "look" facet from a server is never offered as a filter (look/nationality/country are forbidden facets).
  await expect(filters.getByText(/look/iu)).toHaveCount(0);
  await filters.locator('details').filter({ hasText: 'Hair colour' }).locator('summary').click();
  await filters.getByLabel(/Black/u).check();
  await expect(filters).toContainText('1 person');
  await expect.poll(() => searches.at(-1)?.get('facets')).toBe('{"hair_colour":["black"]}');
  expect(facetBodies.at(-1)).toMatchObject({ facets: { hair_colour: ['black'] }, search: { include_unknown: true } });
  await expect(page.getByText('Synthetic Library 2')).toHaveCount(0);
});
