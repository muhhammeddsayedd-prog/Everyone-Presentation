import { expect, test, type Page } from '@playwright/test';

// Cycle 8 live search: every search box searches as the user types (no Enter or Search button), clearing it
// returns the unfiltered list at once, stale requests are aborted and the previous results stay visible while
// the next ones load. Synthetic HTTP/DOM fixture only; search semantics stay with the existing list endpoints.
const stamp = '2026-11-19T09:00:00Z';
const projectNames = ['Synthetic Spring Campaign', 'Synthetic Autumn Film', 'Synthetic Winter Promo', 'Synthetic Summer Drama'];
const clientNames = ['Synthetic North Client', 'Synthetic South Client', 'Synthetic West Client'];
const castNames = ['Synthetic Lina Haddad', 'Synthetic Omar Saleh', 'Synthetic Karim Nour'];
const project = (name: string, index: number) => ({ id: `c8000000-0000-4000-8000-00000000000${index}`, name, presentation_type: 'casting', client_id: null, client_name: 'Synthetic Client',
  client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: null, can_edit: true });
const person = (name: string, index: number) => ({ id: `c8000000-0000-4000-8000-0000000000a${index}`, review_status: 'unreviewed', archived: false, possible_duplicate: false,
  merged_into_candidate_id: null, row_version: 1, search_match: null, created_at: stamp, updated_at: stamp,
  facts: { name, casting_id: null, age_or_range: null, city: index === 1 ? 'Cairo' : null, languages: [] } });

type Seen = { path: string; q: string | null; params: URLSearchParams };
async function fixture(page: Page, options: { slowTerm?: string; delayMs?: number } = {}) {
  const seen: Seen[] = []; const aborted: string[] = []; const errors: string[] = []; const mutations: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => { if (request.failure()?.errorText.includes('ABORTED')) aborted.push(new URL(request.url()).searchParams.get('q') ?? ''); });
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (request.method() !== 'GET') mutations.push(path);
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-live-search', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-live-search', data, page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-live-search', name: 'Synthetic Producer',
      capabilities: ['projects.read', 'projects.write', 'workspaces.read', 'workspaces.write', 'cast.read'], upload_purposes: [] }, actors: [] });
    const q = url.searchParams.get('q');
    const matches = (names: string[]) => names.filter(name => !q || name.toLowerCase().includes(q.toLowerCase()));
    if (['/api/v1/projects', '/api/v1/clients', '/api/v1/candidates'].includes(path) && request.method() === 'GET') {
      seen.push({ path, q, params: url.searchParams });
      const wait = q && q === options.slowTerm ? 1500 : options.delayMs ?? 0;
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      try {
        if (path === '/api/v1/projects') return await list(matches(projectNames).map(name => project(name, projectNames.indexOf(name))));
        if (path === '/api/v1/clients') return await list(matches(clientNames).map(name => ({ id: `c8000000-0000-4000-8000-0000000000c${clientNames.indexOf(name)}`, name, row_version: 1 })));
        return await list(castNames.map(person).filter(row => !q || row.facts.name.toLowerCase().includes(q.toLowerCase())).filter(row => !url.searchParams.get('city') || row.facts.city === url.searchParams.get('city')));
      } catch { return; } // The page aborted this request (a newer search replaced it).
    }
    if (path === '/api/v1/presentation-types') return ok([{ key: 'casting', label: 'Casting', status: 'available' }]);
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable.' } } });
  });
  return { seen, aborted, errors, mutations, of: (path: string) => seen.filter(entry => entry.path === path) };
}

test('projects search as you type, ignore Enter, and return to every project the moment the box is cleared', async ({ page }) => {
  const state = await fixture(page, { delayMs: 400 });
  await page.goto('/projects');
  const cards = page.locator('.project-grid').getByRole('heading', { level: 2 });
  await expect(cards).toHaveCount(4);
  const box = page.getByRole('searchbox', { name: 'Search projects or clients' });
  const before = state.of('/api/v1/projects').length;
  await box.pressSequentially('winter', { delay: 40 });
  // One request for the finished word after the pause, not one per keystroke; the old list stays while it loads.
  await expect(cards).toHaveCount(4);
  await expect(cards).toHaveText(['Synthetic Winter Promo']);
  const typed = state.of('/api/v1/projects').slice(before).map(entry => entry.q);
  expect(typed).toEqual(['winter']);
  await box.press('Enter');
  await expect(page).toHaveURL(/\/projects$/u);
  await box.fill('');
  await expect(cards).toHaveCount(4);
  expect(state.of('/api/v1/projects').at(-1)?.q).toBe('');
  expect(state.mutations).toEqual([]); expect(state.errors).toEqual([]);
});

test('a slower earlier search is aborted and can never replace newer results', async ({ page }) => {
  const state = await fixture(page, { slowTerm: 'synthetic s' });
  await page.goto('/projects');
  const cards = page.locator('.project-grid').getByRole('heading', { level: 2 });
  await expect(cards).toHaveCount(4);
  const box = page.getByRole('searchbox', { name: 'Search projects or clients' });
  await box.fill('synthetic s');
  await expect.poll(() => state.of('/api/v1/projects').at(-1)?.q).toBe('synthetic s');
  await box.fill('autumn');
  await expect(cards).toHaveText(['Synthetic Autumn Film']);
  await expect.poll(() => state.aborted).toContain('synthetic s');
  await page.waitForTimeout(1700);
  await expect(cards).toHaveText(['Synthetic Autumn Film']);
  // Escape clears the box, and with it the filter.
  await box.press('Escape');
  await expect(box).toHaveValue('');
  await expect(cards).toHaveCount(4);
  expect(state.errors).toEqual([]);
});

test('Cast Library search and typed filters follow typing; clearing restores the full list at once', async ({ page }) => {
  const state = await fixture(page, { delayMs: 300 });
  await page.goto('/library/cast');
  const results = page.getByRole('list', { name: 'Cast Library results' }).getByRole('heading', { level: 3 });
  await expect(results).toHaveCount(3);
  const box = page.getByRole('searchbox', { name: 'Search cast' });
  await box.pressSequentially('omar', { delay: 40 });
  await expect(page.getByText('Searching…', { exact: true })).toBeVisible();
  await expect(results).toHaveCount(3); // previous results stay while the search loads
  await expect(results).toHaveText(['Synthetic Omar Saleh']);
  expect(state.of('/api/v1/candidates').filter(entry => entry.q !== null).map(entry => entry.q)).toEqual(['omar']);
  await box.fill('');
  await expect(results).toHaveCount(3);
  expect(state.of('/api/v1/candidates').at(-1)?.params.has('q')).toBe(false);

  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const city = page.getByLabel('City', { exact: true });
  await city.pressSequentially('Cairo', { delay: 40 });
  await expect(results).toHaveText(['Synthetic Omar Saleh']); // the only person whose supplied city is Cairo
  expect(state.of('/api/v1/candidates').filter(entry => entry.params.has('city')).map(entry => entry.params.get('city'))).toEqual(['Cairo']);
  await city.fill('');
  await expect(results).toHaveCount(3);
  expect(state.of('/api/v1/candidates').at(-1)?.params.has('city')).toBe(false);
  expect(state.errors).toEqual([]);
});

test('the new-project client search filters as you type, never submits the form, and clears back to every client', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New project', exact: true });
  const options = dialog.getByLabel('Shared client', { exact: true }).locator('option');
  await expect(options).toHaveCount(4);
  await dialog.getByLabel('Project name', { exact: true }).fill('Synthetic live search project');
  const box = dialog.getByRole('searchbox', { name: 'Find an existing client' });
  await box.pressSequentially('south', { delay: 40 });
  await expect(options).toHaveText(['No client', 'Synthetic South Client']);
  await box.press('Enter');
  expect(state.mutations).toEqual([]);
  await dialog.getByLabel('Shared client', { exact: true }).selectOption({ label: 'Synthetic South Client' });
  await box.fill('west');
  // The chosen client stays selectable while the search shows another name.
  await expect(options).toHaveText(['No client', 'Synthetic South Client', 'Synthetic West Client']);
  await box.press('Escape');
  await expect(box).toHaveValue('');
  await expect(dialog).toBeVisible();
  await expect(options).toHaveCount(4);
  expect(state.of('/api/v1/clients').at(-1)?.q).toBe('');
  expect(state.mutations).toEqual([]); expect(state.errors).toEqual([]);
});
