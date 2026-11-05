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

interface Options { failRoles?: number; failProfile?: number; strict?: boolean; noEditorialSeries?: boolean }
async function workspace(page: Page, options: Options = {}) {
  let revision = 3; let rowVersion = 4; let failRoles = options.failRoles ?? 0; let failProfile = options.failProfile ?? 0;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); const reads = { roles: 0 };
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
    if (method === 'GET' && path === `/api/v1/workspaces/${W}/roles`) { reads.roles++; if (failRoles > 0) { failRoles--; return fail(503); }
      return list([{ id: R1, workspace_id: W, name: 'Father', headcount: 1, category: 'Lead', requirements: requirements('38-45'), clarifications: [], sort_order: 0, row_version: 1, archived: false },
        { id: R2, workspace_id: W, name: 'Kids', headcount: 1, category: null, requirements: requirements('8-11'), clarifications: [], sort_order: 1, row_version: 1, archived: false }]); }
    if (method === 'GET' && path === `/api/v1/roles/${R1}/slots`) return list([{ id: S1, role_id: R1, label: 'Father', sort_order: 0, row_version: 1, archived: false }]);
    if (method === 'GET' && path === `/api/v1/roles/${R2}/slots`) return list([{ id: S2, role_id: R2, label: 'Kid 1', sort_order: 0, row_version: 1, archived: false }]);
    if (method === 'GET' && path === `/api/v1/workspaces/${W}/candidates`) return list([
      { id: PL1, workspace_id: W, candidate_id: C1, selected_candidate_media_id: M1, selected_frame_asset_ids: [F1, F2], availability: 'Available 12–14 Dec', fresh_material_required: false, media_confirmed: true, internal_notes: null, row_version: 1 },
      { id: PL2, workspace_id: W, candidate_id: C2, selected_candidate_media_id: null, selected_frame_asset_ids: [], availability: null, fresh_material_required: false, media_confirmed: false, internal_notes: null, row_version: 1 }]);
    if (method === 'GET' && path === `/api/v1/workspaces/${W}/assignments`) return list(assignments);
    if (method === 'GET' && path === '/api/v1/presentation-series') return list(options.noEditorialSeries ? [series(SER11, 'Client selection', '1.1.0')] : [series(SER12, 'Editorial selection', '1.2.0'), series(SER11, 'Client selection', '1.1.0')]);
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
      const body = request.postDataJSON(); const row = assignments.find(item => path.endsWith(item.id))!;
      // The server's optimistic check: a write based on an older row version is refused, never merged.
      if (options.strict && body.row_version !== row.row_version) return route.fulfill({ status: 409, json: { request_id: 'synthetic-stage', error: { code: 'STALE_REVISION', message: 'This record changed since you opened it.', details: {}, retryable: false } } });
      writes.push({ path, body }); Object.assign(row, body, { row_version: row.row_version + 1 }); revision++; rowVersion++;
      return ok(row);
    }
    return fail(404);
  });
  const remote = (index: number, notes: string) => { assignments[index].presentation_notes = notes; assignments[index].row_version++; revision++; rowVersion++; };
  return { errors, writes, assignments, reads, bump: (notes: string) => remote(0, notes), bumpOther: (notes: string) => remote(1, notes) };
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

// P2 follow-up: unsaved edits and remote updates. A refresh brought by someone else's change never silently replaces
// what is being typed — not in the field and not on the slide; saving it is then checked against the server's row version.
async function openNotes(page: Page, text: string) {
  await page.getByRole('button', { name: /^Assignment actions for Synthetic Actor One/ }).click();
  await page.getByRole('menuitem', { name: 'Edit assignment notes' }).click();
  await page.getByLabel('Presentation notes').fill(text);
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText(text);
}
async function remoteRefresh(page: Page, model: Awaited<ReturnType<typeof workspace>>) {
  const before = model.reads.roles;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => model.reads.roles).toBeGreaterThan(before);
  await expect(stage(page).getByText('Updating from saved changes…')).toHaveCount(0);
}

test('a remote change to the record being edited never overwrites the unsaved text; saving it meets the stale-version check', async ({ page }) => {
  const model = await workspace(page, { strict: true }); await page.goto(`${base}/organize`);
  await openNotes(page, 'My unsaved note');
  model.bump('Changed by Claude');
  await remoteRefresh(page, model);
  // The field and the slide keep what was typed, and the stage says it includes unsaved edits.
  await expect(page.getByLabel('Presentation notes')).toHaveValue('My unsaved note');
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('My unsaved note');
  await expect(stage(page).getByText('Live preview · includes unsaved edits')).toBeVisible();
  // Saving is based on the version that was opened, so the server refuses it instead of overwriting Claude's change.
  await page.getByRole('button', { name: 'Save assignment notes' }).click();
  await expect(page.getByText(/This record changed since you opened it\./u).first()).toBeVisible();
  expect(model.writes).toEqual([]); expect(model.assignments[0].presentation_notes).toBe('Changed by Claude');
  await expect(page.getByLabel('Presentation notes')).toHaveValue('My unsaved note');
  // Discarding shows the other person's saved change on the slide.
  await page.getByRole('button', { name: 'Discard note edits' }).click();
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Changed by Claude');
  expect(model.errors).toEqual([]);
});

test('a remote change to another record appears on its slide while an unsaved edit elsewhere is kept', async ({ page }) => {
  const model = await workspace(page); await page.goto(`${base}/organize`);
  await openNotes(page, 'Still typing');
  model.bumpOther('Note added by a colleague');
  await remoteRefresh(page, model);
  await expect(page.getByLabel('Presentation notes')).toHaveValue('Still typing');
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Still typing');
  await strip(page).getByRole('button', { name: /: Synthetic Actor Two$/u }).click();
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Note added by a colleague');
  await strip(page).getByRole('button', { name: /: Synthetic Actor One$/u }).click();
  await expect(slide(page).locator('[data-fit-field="presentation_notes"]')).toHaveText('Still typing');
  expect(model.writes).toEqual([]); expect(model.errors).toEqual([]);
});

test('without a 1.2.0 series the editorial design can still be previewed, labelled as preview only', async ({ page }) => {
  const model = await workspace(page, { noEditorialSeries: true }); await page.goto(`${base}/organize`);
  await expect(strip(page).getByRole('button')).toHaveCount(4);
  await page.getByRole('combobox', { name: 'Preview as' }).selectOption({ label: 'Everyone Film Editorial 1.2.0 · preview only' });
  await expect(strip(page).getByRole('button')).toHaveCount(7);
  await expect(page.locator('.stage-frame .ef-slide[data-layout="cover_floward"]')).toHaveCount(1);
  await expect(stage(page).getByText('Preview only. This workspace still generates with Client selection', { exact: false })).toHaveCount(0);
  await expect(stage(page).getByText(/^Preview only\. This workspace still generates with Everyone Casting 1\.1\.0/u)).toBeVisible();
  expect(model.errors).toEqual([]);
});

test('the config panel can be resized by keyboard and pointer; the stage and slides follow and the width is remembered', async ({ page }) => {
  const model = await workspace(page); await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(`${base}/organize`);
  const panel = page.getByRole('complementary', { name: 'Casting panel' });
  const handle = page.getByRole('separator', { name: 'Resize Casting panel' });
  const width = async (locator: ReturnType<Page['locator']>) => Math.round((await locator.boundingBox())!.width);
  await expect(strip(page).getByRole('button')).toHaveCount(7);
  const start = await width(panel); const slideStart = await width(slide(page));
  expect(start).toBe(400);
  await handle.focus(); for (let n = 0; n < 5; n++) await page.keyboard.press('ArrowRight');
  await expect.poll(() => width(panel)).toBe(480);
  await expect(handle).toHaveAttribute('aria-valuenow', '480');
  await expect.poll(() => width(slide(page))).toBeLessThan(slideStart);
  await page.reload(); await expect(strip(page).getByRole('button')).toHaveCount(7);
  await expect.poll(() => width(panel)).toBe(480);
  // Pointer: drag the edge; the page never scrolls sideways and the stage keeps its minimum room.
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 200); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 160, box.y + 200, { steps: 6 }); await page.mouse.up();
  await expect.poll(() => width(panel)).toBe(320);
  await expect.poll(() => width(slide(page))).toBeGreaterThan(slideStart);
  await handle.focus(); await page.keyboard.press('End');
  await expect.poll(() => width(panel)).toBe(1440 - 64 - 480);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await handle.dblclick();
  await expect.poll(() => width(panel)).toBe(400);
  expect(model.errors).toEqual([]);
});
