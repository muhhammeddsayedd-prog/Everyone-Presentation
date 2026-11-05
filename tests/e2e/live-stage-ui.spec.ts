import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Synthetic browser acceptance for the presentation-first workspace (P2): the live draft stage. Every record is invented.
test.use({ actionTimeout: 10000 });
const id = (n: number) => `99200000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const P = id(1), W = id(2), R1 = id(3), R2 = id(4), S1 = id(5), S2 = id(6), PL1 = id(7), PL2 = id(8), C1 = id(9), C2 = id(10), M1 = id(11), F1 = id(12), F2 = id(13), V1 = id(14), A1 = id(15), A2 = id(16), SER11 = id(17), SER12 = id(18);
const stamp = '2026-11-05T00:00:00Z';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const requirements = (age: string | null) => ({ age_range: age, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null });
const facts = (name: string, casting: string) => ({ name, casting_id: casting, age_or_range: '41', stated_gender: null, height_measurements: '182 cm', languages: ['Arabic'], accents: [], skills_experience: 'Commercials', city: 'Cairo', previous_projects_roles: null, classification: null });

interface Options { failRoles?: number; failProfile?: number }
async function workspace(page: Page, options: Options = {}) {
  let revision = 3; let rowVersion = 4; let failRoles = options.failRoles ?? 0; let failProfile = options.failProfile ?? 0;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const assignments = [
    { id: A1, workspace_id: W, slot_id: S1, workspace_candidate_id: PL1, position: 'main', shortlist_included: true, presentation_notes: 'Saved note', internal_notes: null, slide_wording: {}, sort_order: 0, row_version: 1, archived: false },
    { id: A2, workspace_id: W, slot_id: S1, workspace_candidate_id: PL2, position: 'option', shortlist_included: false, presentation_notes: null, internal_notes: null, slide_wording: {}, sort_order: 1, row_version: 1, archived: false }];
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const series = (sid: string, title: string, version: string) => ({ id: sid, workspace_id: W, title, output_type: 'selection', audience_preset_id: id(30), audience_snapshot: { id: id(30), key: 'client', label: 'Client', scope: 'external', archived: false, settings: {}, row_version: 1 },
    template_key: 'everyone-casting', template_version: version, template_content_sha256: 'x', font_key: 'x', latest_ready_version_id: null, latest_ready_version_no: null, archived: false, row_version: 1 });
  const current = () => ({ id: W, project_id: P, module: 'casting', title: 'Synthetic Spring Campaign', active_output: 'selection', row_version: rowVersion, draft_revision: revision, has_unpublished_changes: true, logo_asset_id: null, logo_placement: 'cover', created_at: stamp, updated_at: stamp });
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-stage', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-stage', data, page: { next_cursor: null } } });
    const fail = (status: number) => route.fulfill({ status, json: { request_id: 'synthetic-stage', error: { code: status === 404 ? 'NOT_FOUND' : 'DEPENDENCY_UNAVAILABLE', message: 'Synthetic failure.', details: {}, retryable: status >= 500 } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-stage-producer', name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read'], upload_purposes: [] }, actors: [] });
    if (method === 'GET' && path === `/api/v1/projects/${P}`) return ok({ id: P, name: 'Synthetic Spring Campaign', client_id: null, client_name: 'Synthetic Client', client_logo_asset_id: null, row_version: 1, client_row_version: 1, casting_workspace_id: W, can_edit: false, presentation_type: 'casting' });
    if (method === 'GET' && path === `/api/v1/workspaces/${W}`) return ok(current());
    if (method === 'GET' && path === `/api/v1/workspaces/${W}/summary`) return fail(404);
    if (method === 'GET' && path === `/api/v1/workspaces/${W}/roles`) { if (failRoles > 0) { failRoles--; return fail(503); }
      return list([{ id: R1, workspace_id: W, name: 'Father', headcount: 1, category: 'Lead', requirements: requirements('38-45'), clarifications: [], sort_order: 0, row_version: 1, archived: false },
        { id: R2, workspace_id: W, name: 'Kids', headcount: 1, category: null, requirements: requirements('8-11'), clarifications: [], sort_order: 1, row_version: 1, archived: false }]); }
    if (method === 'GET' && path === `/api/v1/roles/${R1}/slots`) return list([{ id: S1, role_id: R1, label: 'Father', sort_order: 0, row_version: 1, archived: false }]);
    if (method === 'GET' && path === `/api/v1/roles/${R2}/slots`) return list([{ id: S2, role_id: R2, label: 'Kid 1', sort_order: 0, row_version: 1, archived: false }]);
    if (method === 'GET' && path === `/api/v1/workspaces/${W}/candidates`) return list([
      { id: PL1, workspace_id: W, candidate_id: C1, selected_candidate_media_id: M1, selected_frame_asset_ids: [F1, F2], availability: 'Available 12–14 Dec', fresh_material_required: false, media_confirmed: true, internal_notes: null, row_version: 1 },
      { id: PL2, workspace_id: W, candidate_id: C2, selected_candidate_media_id: null, selected_frame_asset_ids: [], availability: null, fresh_material_required: false, media_confirmed: false, internal_notes: null, row_version: 1 }]);
    if (method === 'GET' && path === `/api/v1/workspaces/${W}/assignments`) return list(assignments);
    if (method === 'GET' && path === '/api/v1/presentation-series') return list([series(SER12, 'Editorial selection', '1.2.0'), series(SER11, 'Client selection', '1.1.0')]);
    if (method === 'GET' && path === '/api/v1/settings') return ok({ template_version: '1.1.0', default_timezone: 'Africa/Cairo', row_version: 1 });
    if (method === 'GET' && path === `/api/v1/candidates/${C1}/media`) return list([{ id: M1, candidate_id: C1, source_asset_id: V1, preview_asset_id: null, transcript_asset_id: null, original_transcript: null, languages: ['ar'],
      available_frames: [F1, F2].map((asset_id, n) => ({ asset_id, source_asset_id: V1, timestamp_ms: 1000 * (n + 1), width: 1080, height: 1350, quality_flags: [] })), selected_frame_asset_ids: [F1, F2], processing_issues: [], row_version: 1 }]);
    if (method === 'GET' && path.startsWith('/api/v1/candidates/') && path.endsWith('/media')) return list([]);
    if (method === 'GET' && path.startsWith('/api/v1/candidates/')) {
      const cid = path.split('/').at(-1)!;
      if (cid === C2 && failProfile > 0) { failProfile--; return fail(503); }
      const name = cid === C1 ? 'Synthetic Actor One' : 'Synthetic Actor Two';
      return ok({ id: cid, facts: facts(name, cid === C1 ? 'EPS-1' : 'EPS-2'), review_status: 'reviewed', reviewed_at: stamp, reviewed_by: null, search_match: null, possible_duplicate: false, merged_into_candidate_id: null, archived: false, row_version: 1, created_at: stamp, updated_at: stamp });
    }
    if (method === 'GET' && /^\/api\/v1\/media\/[^/]+\/content$/u.test(path)) return route.fulfill({ status: 200, contentType: 'image/png', body: png });
    if (method === 'PATCH' && path.startsWith('/api/v1/assignments/')) {
      const body = request.postDataJSON(); writes.push({ path, body });
      const row = assignments.find(item => path.endsWith(item.id))!; Object.assign(row, body, { row_version: row.row_version + 1 }); revision++; rowVersion++;
      return ok(row);
    }
    return fail(404);
  });
  return { errors, writes, assignments, bump: (notes: string) => { assignments[0].presentation_notes = notes; assignments[0].row_version++; revision++; rowVersion++; } };
}
const base = `/projects/${P}/casting/${W}`;
const stage = (page: Page) => page.getByRole('region', { name: 'Slide preview' });
const slide = (page: Page) => page.locator('.stage-frame .stage-slide');
const strip = (page: Page) => page.getByRole('navigation', { name: 'Slides' });

test('typing presentation notes updates the slide before saving; the saved value stays after the refresh', async ({ page }) => {
  const model = await workspace(page); await page.goto(`${base}/organize`);
  await expect(strip(page).getByRole('button')).toHaveCount(7);
  await expect(stage(page).getByText('Live preview · updates as you edit')).toBeVisible();
  // Selecting the assignment in the panel brings its slide onto the stage.
  await page.locator(`[data-draft-focus="assignment:${A1}"]`).getByRole('heading', { name: 'Synthetic Actor One' }).click();
  await expect(slide(page)).toHaveAttribute('aria-label', /^Slide 4 of 7: Synthetic Actor One$/u);
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Saved note');
  await page.getByRole('button', { name: /^Assignment actions for Synthetic Actor One/ }).click();
  await page.getByRole('menuitem', { name: 'Edit assignment notes' }).click();
  await page.getByLabel('Presentation notes').fill('Typed live note');
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Typed live note');
  await expect(stage(page).getByText('Live preview · includes unsaved edits')).toBeVisible();
  expect(model.writes).toEqual([]);
  await page.getByRole('button', { name: 'Save assignment notes' }).click();
  await expect.poll(() => model.writes.length).toBe(1);
  expect(model.writes[0].body).toMatchObject({ presentation_notes: 'Typed live note' });
  await expect(stage(page).getByText('Live preview · updates as you edit')).toBeVisible();
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Typed live note');
  await page.reload();
  await page.locator(`[data-draft-focus="assignment:${A1}"]`).getByRole('heading', { name: 'Synthetic Actor One' }).click();
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Typed live note');
  expect(model.errors).toEqual([]);
});

test('discarding an unsaved edit restores the saved slide immediately', async ({ page }) => {
  const model = await workspace(page); await page.goto(`${base}/organize`);
  await page.getByRole('button', { name: /^Assignment actions for Synthetic Actor One/ }).click();
  await page.getByRole('menuitem', { name: 'Edit assignment notes' }).click();
  await page.getByLabel('Presentation notes').fill('Not kept');
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Not kept');
  await page.getByRole('button', { name: 'Discard note edits' }).click();
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Saved note');
  expect(model.writes).toEqual([]); expect(model.errors).toEqual([]);
});

test('a change made elsewhere (another user or Claude) appears once the draft revision moves', async ({ page }) => {
  const model = await workspace(page); await page.goto(`${base}/organize`);
  await page.locator(`[data-draft-focus="assignment:${A1}"]`).getByRole('heading', { name: 'Synthetic Actor One' }).click();
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Saved note');
  model.bump('Changed by Claude');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Changed by Claude');
  expect(model.errors).toEqual([]);
});

test('a failed preview read reports the problem and recovers on retry; an unreadable profile pauses instead of inventing facts', async ({ page }) => {
  const model = await workspace(page, { failRoles: 1 }); await page.goto(`${base}/project`);
  await expect(stage(page).getByRole('alert')).toContainText('The live preview could not be opened.');
  await stage(page).getByRole('button', { name: 'Try again' }).click();
  await expect(strip(page).getByRole('button')).toHaveCount(7);
  expect(model.errors).toEqual([]);

  const paused = await workspace(page, { failProfile: 1 }); await page.goto(`${base}/project`);
  await expect(stage(page).getByRole('alert')).toContainText('Preview paused. A profile on this draft could not be read.');
  await stage(page).getByRole('button', { name: 'Try again' }).click();
  await expect(strip(page).getByRole('button')).toHaveCount(7);
  await expect(strip(page).getByRole('button', { name: 'Slide 5 of 7: Synthetic Actor Two' })).toBeVisible();
  expect(paused.errors).toEqual([]);
});

test('stage and panel select each other: a thumbnail marks its row, a row brings its slide', async ({ page }) => {
  const model = await workspace(page); await page.goto(`${base}/organize`);
  await strip(page).getByRole('button', { name: 'Slide 5 of 7: Synthetic Actor Two' }).click();
  await expect(page.locator(`[data-draft-focus="assignment:${A2}"]`)).toHaveAttribute('data-draft-selected', '');
  await expect(strip(page).getByRole('button', { name: 'Slide 5 of 7: Synthetic Actor Two' })).toHaveAttribute('aria-current', 'true');
  await page.locator(`[data-draft-focus="slot:${S2}"]`).getByRole('heading', { name: 'Kid 1' }).click();
  await expect(slide(page)).toHaveAttribute('aria-label', 'Slide 6 of 7: Kid 1 · Pending');
  // Keyboard: the stage moves with the arrow keys.
  await page.getByRole('region', { name: /Use the arrow keys to change slides/ }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(slide(page)).toHaveAttribute('aria-label', 'Slide 5 of 7: Synthetic Actor Two');
  await page.keyboard.press('Home');
  await expect(slide(page)).toHaveAttribute('aria-label', 'Slide 1 of 7: Cover');
  expect(model.errors).toEqual([]);
});

test('switching the previewed series switches the registered template (1.2.0 ↔ 1.1.0)', async ({ page }) => {
  const model = await workspace(page); await page.goto(`${base}/organize`);
  await expect(page.getByLabel('Preview as')).toHaveValue(SER12);
  await expect(slide(page).locator('.ef-slide')).toHaveCount(1);
  await expect(stage(page).getByText(/Draft preview in Everyone Film Editorial 1\.2\.0/)).toBeVisible();
  await page.getByLabel('Preview as').selectOption(SER11);
  await expect(strip(page).getByRole('button')).toHaveCount(4);
  await expect(slide(page).locator('.eps-page')).toHaveCount(1);
  await expect(slide(page).locator('.ef-slide')).toHaveCount(0);
  await expect(stage(page).getByText(/Draft preview in Everyone Casting 1\.1\.0/)).toBeVisible();
  await page.getByRole('button', { name: 'All pages' }).click();
  await expect(page.getByRole('list', { name: 'All pages in print order' }).getByRole('button')).toHaveCount(4);
  expect(model.errors).toEqual([]);
});

test('the workspace editor passes axe and fits a phone without sideways scrolling', async ({ page }) => {
  const model = await workspace(page); await page.goto(`${base}/organize`);
  await expect(strip(page).getByRole('button')).toHaveCount(7);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(stage(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(model.errors).toEqual([]);
});
