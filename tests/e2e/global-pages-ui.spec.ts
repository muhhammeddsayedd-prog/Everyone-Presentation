import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Synthetic browser acceptance for the presentation-first global pages (P1). Every record is invented.
const ids = { p1: '98800000-0000-4000-8000-000000000001', p2: '98800000-0000-4000-8000-000000000002', w1: '98800000-0000-4000-8000-000000000003',
  c1: '98800000-0000-4000-8000-000000000004', c2: '98800000-0000-4000-8000-000000000005', s1: '98800000-0000-4000-8000-000000000006', s2: '98800000-0000-4000-8000-000000000007',
  frame: '98800000-0000-4000-8000-000000000008', media: '98800000-0000-4000-8000-000000000009' };
const stamp = '2026-11-05T00:00:00Z';
const project = (id: string, name: string, workspace: string | null) => ({ id, name, client_id: 'synthetic-client', client_name: 'Synthetic Client', client_logo_asset_id: null, row_version: 1, client_row_version: 1, casting_workspace_id: workspace, presentation_type: 'casting', can_edit: true });
const facts = (name: string) => ({ name, casting_id: `EPS-${name.length}`, age_or_range: '30', stated_gender: null, height_measurements: null, languages: ['Arabic'], accents: [], skills: [], city: 'Cairo', previous_projects_roles: [], classification: null });
const candidate = (id: string, name: string, reviewed: boolean) => ({ id, facts: facts(name), review_status: reviewed ? 'reviewed' : 'unreviewed', reviewed_at: null, reviewed_by: null, search_match: null, possible_duplicate: false, merged_into_candidate_id: null, archived: false, row_version: 1, created_at: stamp, updated_at: stamp });
const series = (id: string, title: string, output: 'selection' | 'shortlist') => ({ id, workspace_id: ids.w1, title, output_type: output, audience_snapshot: { label: 'Client review', scope: 'external' }, template_version: '1.1.0', latest_ready_version_no: 1, latest_ready_version_id: null, archived: false, row_version: 1 });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function mock(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-global', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-global', data, page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-global-producer', name: 'Synthetic Producer', capabilities: ['projects.read', 'projects.write', 'workspaces.read', 'workspaces.write', 'cast.read', 'presentations.generate'], upload_purposes: [] }, actors: [] });
    if (path === '/api/v1/projects') return list([project(ids.p1, 'Synthetic Spring Campaign', ids.w1), project(ids.p2, 'Synthetic Autumn Film', null)]);
    if (path === '/api/v1/clients') return list([]);
    if (path === '/api/v1/presentation-types') return ok([{ key: 'casting', label: 'Casting', status: 'available' }]);
    if (path === `/api/v1/workspaces/${ids.w1}`) return ok({ id: ids.w1, project_id: ids.p1, title: 'Synthetic Spring Campaign', module: 'casting', active_output: 'selection', logo_asset_id: null, logo_placement: 'cover', row_version: 1, draft_revision: 1, has_unpublished_changes: false, created_at: stamp, updated_at: stamp });
    if (path === '/api/v1/presentation-series') return list([series(ids.s1, 'Synthetic client selection', 'selection'), series(ids.s2, 'Synthetic agency shortlist', 'shortlist')]);
    if (path === '/api/v1/candidates') return list([candidate(ids.c1, 'Synthetic Actor One', true), candidate(ids.c2, 'Synthetic Actor Two', false)]);
    if (path === `/api/v1/candidates/${ids.c1}/media`) return list([{ id: ids.media, candidate_id: ids.c1, source_asset_id: ids.media, preview_asset_id: null, transcript_asset_id: null, original_transcript: null, languages: [], available_frames: [{ asset_id: ids.frame, source_asset_id: ids.media, timestamp_ms: 1250, width: 1, height: 1, quality_flags: [] }], selected_frame_asset_ids: [ids.frame], processing_issues: [], row_version: 1 }]);
    if (path === `/api/v1/candidates/${ids.c2}/media`) return list([]);
    if (path === `/api/v1/media/${ids.frame}/content`) return route.fulfill({ status: 200, contentType: 'image/png', body: png });
    if (path === '/api/v1/audience-presets') return ok([]);
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable.' } } });
  });
  return errors;
}
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations;

test('projects: filter panel with loaded counts, cover cards and a closable details panel', async ({ page }) => {
  const errors = await mock(page);
  await page.goto('/projects');
  const filters = page.getByRole('complementary', { name: 'Project filters' });
  await expect(filters.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(filters.getByRole('button', { name: 'All', exact: true })).toHaveAccessibleDescription('2 loaded');
  await expect(filters.getByRole('button', { name: 'Not started', exact: true })).toHaveAccessibleDescription('1 loaded');
  const list = page.getByRole('region', { name: 'Project list' });
  await expect(list.getByRole('heading', { name: 'Synthetic Spring Campaign', exact: true })).toBeVisible();
  await list.getByRole('button', { name: 'Show details for Synthetic Autumn Film', exact: true }).click();
  const details = page.getByRole('complementary', { name: 'Synthetic Autumn Film' });
  await expect(details.getByRole('button', { name: 'Open casting for Synthetic Autumn Film', exact: true })).toBeVisible();
  await details.getByRole('button', { name: 'Close project details', exact: true }).click();
  await expect(details).toHaveCount(0);
  await filters.getByRole('button', { name: 'Not started', exact: true }).click();
  await expect(list.getByRole('heading', { name: 'Synthetic Spring Campaign', exact: true })).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('the config panel collapses with its button or Ctrl+\\ and the choice is remembered', async ({ page }) => {
  const errors = await mock(page);
  await page.goto('/projects');
  const filters = page.getByRole('complementary', { name: 'Project filters' });
  await filters.getByRole('button', { name: 'Hide Project filters', exact: true }).click();
  await expect(filters).toBeHidden();
  const show = page.getByRole('button', { name: 'Show Project filters', exact: true });
  await expect(show).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show Project filters', exact: true })).toBeVisible();
  await page.keyboard.press('Control+Backslash');
  await expect(page.getByRole('complementary', { name: 'Project filters' })).toBeVisible();
  await page.keyboard.press('Control+Backslash');
  await expect(page.getByRole('complementary', { name: 'Project filters' })).toBeHidden();
  await page.getByRole('button', { name: 'Show Project filters', exact: true }).click();
  expect(errors).toEqual([]);
});

test('below 1280 px the panel opens over the page, traps focus and Escape returns to its toggle', async ({ page }) => {
  const errors = await mock(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/projects');
  await expect(page.getByRole('complementary', { name: 'Project filters' })).toBeHidden();
  const show = page.getByRole('button', { name: 'Show Project filters', exact: true });
  await show.click();
  const filters = page.getByRole('complementary', { name: 'Project filters' });
  await expect(filters).toBeVisible();
  await expect(filters).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(filters).toBeHidden();
  await expect(show).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await show.click();
  const box = await page.getByRole('complementary', { name: 'Project filters' }).boundingBox();
  expect(Math.round(box!.y + box!.height)).toBe(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('cast library: filters in the panel and real frames as portraits, initials otherwise', async ({ page }) => {
  const errors = await mock(page);
  await page.goto('/library/cast');
  await expect(page.getByRole('heading', { name: 'Cast Library', exact: true, level: 1 })).toBeVisible();
  const filters = page.getByRole('complementary', { name: 'Filters' });
  await expect(filters.getByLabel('City', { exact: true })).toBeVisible();
  const results = page.getByRole('list', { name: 'Cast Library results' });
  await expect(results.locator(`img[src="/api/v1/media/${ids.frame}/content"]`)).toHaveCount(1);
  await expect(results.getByRole('listitem').nth(1).locator('img')).toHaveCount(0);
  await filters.getByLabel('City', { exact: true }).fill('Cairo');
  await expect(page.getByRole('button', { name: 'Clear 1', exact: true })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('presentations: series cards filter by output and settings sections link to their anchors', async ({ page }) => {
  const errors = await mock(page);
  await page.goto('/presentations');
  await expect(page.getByRole('heading', { name: 'Synthetic client selection', exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Filter loaded series by output' }).getByRole('button', { name: 'Cast Shortlist', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic client selection', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Synthetic agency shortlist', exact: true })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Audience presets', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Connections', exact: true })).toHaveAttribute('href', '#connections');
  expect(await axe(page)).toEqual([]);
  expect(errors).toEqual([]);
});
