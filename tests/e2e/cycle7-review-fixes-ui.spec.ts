import { expect, test, type Page, type Route } from '@playwright/test';

// Cycle 7 review fixes: controlled HTTP/DOM proof with route-mocked synthetic data (no real identity, SQL,
// storage, worker or provider). Covers the Library profile facts editor in "Save your changes?", project
// picture framing (template focal rule) and processing state, new-tape outcome wording, and a fresh
// Idempotency-Key for a re-add after a removal.
const project = 'c7f00000-0000-4000-8000-000000000001';
const workspace = 'c7f00000-0000-4000-8000-000000000002';
const person = { a: 'c7f00000-0000-4000-8000-0000000000a1', b: 'c7f00000-0000-4000-8000-0000000000b1', c: 'c7f00000-0000-4000-8000-0000000000c1' };
const names: Record<string, string> = { [person.a]: 'Synthetic Framed Person', [person.b]: 'Synthetic Processing Person', [person.c]: 'Synthetic Joining Person' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const facts = (id: string, patch: Record<string, unknown> = {}) => ({ name: names[id] ?? 'Synthetic Person', casting_id: null, age_or_range: null, stated_gender: null,
  height_measurements: null, languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null, ...patch });
const profile = (id: string, patch: Record<string, unknown> = {}, row_version = 1) => ({ id, facts: facts(id, patch), review_status: 'reviewed', reviewed_at: '2026-11-16T09:00:00Z',
  reviewed_by: null, search_match: null, possible_duplicate: false, merged_into_candidate_id: null, archived: false, row_version, created_at: '2026-11-16T09:00:00Z', updated_at: '2026-11-16T09:00:00Z' });
const poolRow = (id: string, candidate: string, patch: Record<string, unknown> = {}) => ({ id, workspace_id: workspace, candidate_id: candidate, selected_candidate_media_id: null,
  selected_frame_asset_ids: [], availability: null, fresh_material_required: false, media_confirmed: false, internal_notes: null, portrait_asset_id: null, portrait_source: null,
  portrait_crop: null, media_selection_state: 'unset', row_version: 1, ...patch });

type Upload = { upload_id: string; target_candidate_id: string | null; state: string; job: { id: string; status: string }; candidate_id: string | null; workspace_candidate_id: string | null;
  candidate_outcome?: string | null; membership_outcome?: string | null };
interface State {
  pool: ReturnType<typeof poolRow>[]; facts: Record<string, unknown>; factsVersion: number; factPatches: Record<string, unknown>[]; failFacts: boolean;
  uploads: Upload[]; jobStatus: Record<string, string>; jobPolls: number; pendingAssets: Set<string>; brokenAssets: Set<string>;
  adds: { key: string; candidate: string; status: number }[]; keys: Map<string, string>; removedKeys: Set<string>; dropFirstAdd: boolean; searches: number;
}

async function fixture(page: Page, setup: Partial<State> = {}) {
  const state: State = { pool: [], facts: {}, factsVersion: 1, factPatches: [], failFacts: false, uploads: [], jobStatus: {}, jobPolls: 0, pendingAssets: new Set(), brokenAssets: new Set(),
    adds: [], keys: new Map(), removedKeys: new Set(), dropFirstAdd: false, searches: 0, ...setup };
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'synthetic-c7-fixes', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-c7-fixes', data, page: { next_cursor: null } } });
    const fail = (status: number, code: string, message: string) => route.fulfill({ status, json: { request_id: 'synthetic-c7-fixes', error: { code, message } } });
    if (path === '/api/session') return ok({ mode: 'supabase', storage_origin: 'http://127.0.0.1:54321', actor: { id: 'synthetic-producer', name: 'Synthetic Producer',
      capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read', 'cast.write', 'cast.review', 'cast.upload'], upload_purposes: [], upload_maximum_bytes: 268435456 }, actors: [] });
    if (path === `/api/v1/projects/${project}`) return ok({ id: project, name: 'Synthetic review-fix project', client_id: null, client_name: null, client_logo_asset_id: null,
      row_version: 1, client_row_version: null, casting_workspace_id: workspace, can_edit: true });
    if (path === `/api/v1/workspaces/${workspace}`) return ok({ id: workspace, project_id: project, title: 'Synthetic review-fix project', module: 'casting', active_output: 'selection',
      logo_asset_id: null, logo_placement: 'cover', row_version: 1, draft_revision: 1, has_unpublished_changes: false });
    if (path === `/api/v1/workspaces/${workspace}/candidates` && method === 'GET') return list(state.pool);
    if (path === `/api/v1/workspaces/${workspace}/candidates` && method === 'POST') {
      const body = request.postDataJSON(); const key = request.headers()['idempotency-key'];
      // Server model: a key replayed after its membership was removed is refused, never re-adds silently.
      if (state.removedKeys.has(key)) { state.adds.push({ key, candidate: body.candidate_id, status: 409 }); return fail(409, 'MEMBERSHIP_REMOVED', 'This membership was removed after this add.'); }
      let row = state.pool.find(entry => entry.candidate_id === body.candidate_id); const already = Boolean(row);
      if (!row) { row = poolRow(`pool-${body.candidate_id.slice(-2)}`, body.candidate_id, { media_selection_state: 'pinned' }); state.pool.unshift(row); }
      state.keys.set(key, row.id);
      if (state.dropFirstAdd) { state.dropFirstAdd = false; state.adds.push({ key, candidate: body.candidate_id, status: 503 }); return fail(503, 'DEPENDENCY_UNAVAILABLE', 'Synthetic response lost after commit.'); }
      state.adds.push({ key, candidate: body.candidate_id, status: already ? 200 : 201 });
      return ok({ ...row, already_member: already }, already ? 200 : 201);
    }
    const removal = path.match(/^\/api\/v1\/workspace-candidates\/([^/]+)\/remove$/u);
    if (removal && method === 'POST') {
      state.pool = state.pool.filter(entry => entry.id !== removal[1]);
      for (const [key, id] of state.keys) if (id === removal[1]) state.removedKeys.add(key);
      return ok({ success: true, affected_ids: [removal[1]] });
    }
    if (path === '/api/v1/candidates' && method === 'GET') {
      state.searches += 1;
      return list([person.c].map(id => ({ ...profile(id), name_ar: null, talent_type: 'talent', tape_count: 1, portrait_photo: null, portrait_frame_asset_id: null, processing: false,
        membership: state.pool.some(row => row.candidate_id === id) ? { workspace_candidate_id: state.pool.find(row => row.candidate_id === id)!.id, state: 'in_project' } : null })));
    }
    const candidate = path.match(/^\/api\/v1\/candidates\/([^/]+)(\/.*)?$/u);
    if (candidate && method === 'GET') {
      if (!candidate[2]) return ok(profile(candidate[1], candidate[1] === person.a ? state.facts : {}, candidate[1] === person.a ? state.factsVersion : 1));
      if (['/media', '/supporting-files', '/duplicates', '/photos'].includes(candidate[2])) return list([]);
    }
    if (candidate && !candidate[2] && method === 'PATCH') {
      const body = request.postDataJSON(); state.factPatches.push(body);
      if (state.failFacts) return fail(503, 'DEPENDENCY_UNAVAILABLE', 'Synthetic save outage.');
      if (body.row_version !== state.factsVersion) return fail(409, 'STALE_RESOURCE_VERSION', 'Changed.');
      state.facts = { ...body.facts }; state.factsVersion += 1;
      return ok({ ...profile(candidate[1], state.facts, state.factsVersion), review_status: 'unreviewed', reviewed_at: null });
    }
    const media = path.match(/^\/api\/v1\/media\/([^/]+)\/content$/u);
    if (media && method === 'GET') {
      if (state.pendingAssets.has(media[1])) return fail(502, 'INVALID_RESPONSE', 'Synthetic asset not ready.');
      if (state.brokenAssets.has(media[1])) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from('not an image') });
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    if (path === `/api/v1/workspaces/${workspace}/candidate-uploads`) return list(state.uploads.map(row => ({ workspace_id: workspace, asset_id: `asset-${row.upload_id}`, filename: `${row.upload_id}.mp4`,
      size_bytes: 1000, mime_type: 'video/mp4', created_at: '2026-11-16T09:00:00Z', upload_status: 'completed', candidate_outcome: null, membership_outcome: null, ...row,
      job: { ...row.job, stage: 'prepare_candidate', error_code: null, retryable: false, row_version: 2, updated_at: '2026-11-16T09:00:00Z' } })));
    const job = path.match(/^\/api\/v1\/jobs\/([^/]+)$/u);
    if (job && method === 'GET') {
      state.jobPolls += 1;
      const upload = state.uploads.find(row => row.job.id === job[1])!; const status = state.jobStatus[job[1]] ?? 'running'; const target = upload.target_candidate_id!;
      let member = state.pool.find(row => row.candidate_id === target);
      // The server records what the save step did: another tape for an existing person, added to or already in the project.
      const membership = upload.membership_outcome ?? (member ? 'already_member' : 'added');
      if (status === 'succeeded') {
        if (!member) { member = poolRow(`pool-${target.slice(-2)}`, target, { media_selection_state: 'unset' }); state.pool.unshift(member); }
        Object.assign(upload, { state: 'ready', job: { id: job[1], status }, candidate_id: target, workspace_candidate_id: member.id, candidate_outcome: 'tape_added', membership_outcome: membership });
      }
      return ok({ id: job[1], workspace_id: workspace, kind: 'candidate_scan', status, stage: status === 'succeeded' ? 'apply_candidate' : 'transcribe_candidate', attempt: 1, progress_completed: 0,
        progress_total: null, batch_id: null, input_asset_id: 'asset', resource_id: upload.upload_id, error: null, created_at: '2026-11-16T09:00:00Z', updated_at: '2026-11-16T09:00:00Z', row_version: 3,
        ...(status === 'succeeded' ? { candidate_result: { candidate_id: target, candidate_media_id: 'media', workspace_candidate_id: member!.id, candidate_outcome: 'tape_added', membership_outcome: membership } } : {}) });
    }
    if (path === `/api/v1/workspaces/${workspace}/media-repairs` && method === 'GET') return route.fulfill({ json: { request_id: 'synthetic-c7-fixes', has_more: false, data: [] } });
    if (method === 'GET' && /\/(roles|assignments|presentation-series|slots|scenes)$/u.test(path)) return list([]);
    return fail(404, 'CONTROLLED_ROUTE_UNAVAILABLE', 'Synthetic route unavailable.');
  });
  return state;
}
const cast = `/projects/${project}/casting/${workspace}/cast`;
const row = (page: Page, id: string) => page.locator('.project-candidate-list > article').filter({ has: page.getByRole('heading', { name: names[id], exact: true }) });
const dialog = (page: Page) => page.getByRole('alertdialog', { name: 'Save your changes?' });

test.describe('Library profile facts in "Save your changes?"', () => {
  async function editCity(page: Page, setup: Partial<State> = {}) {
    const state = await fixture(page, setup);
    await page.goto(`/library/cast/${person.a}`);
    await page.getByRole('button', { name: 'Edit facts', exact: true }).click();
    await page.getByLabel('City', { exact: true }).fill('Synthetic City');
    await page.locator('.profile-breadcrumb').getByRole('link', { name: 'Cast Library' }).focus(); await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toContainText('Unsaved: shared facts.');
    return state;
  }

  test('Save and continue saves the facts, then leaves', async ({ page }) => {
    const state = await editCity(page);
    await expect(dialog(page).getByRole('button', { name: 'Save and continue', exact: true })).toBeEnabled();
    await dialog(page).getByRole('button', { name: 'Save and continue', exact: true }).click();
    await expect(page).toHaveURL(/\/library\/cast$/u);
    expect(state.factPatches).toHaveLength(1);
    expect(state.factPatches[0]).toMatchObject({ row_version: 1, facts: { city: 'Synthetic City', name: names[person.a] } });
  });

  test('a failed save keeps the dialog, the page and the input', async ({ page }) => {
    const state = await editCity(page, { failFacts: true });
    await dialog(page).getByRole('button', { name: 'Save and continue', exact: true }).click();
    await expect(dialog(page).getByRole('alert')).toContainText('Your input is kept');
    await dialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/library/cast/${person.a}$`, 'u'));
    await expect(page.getByLabel('City', { exact: true })).toHaveValue('Synthetic City');
    expect(state.factPatches).toHaveLength(1);
  });

  test('Discard resets the draft and leaves without saving', async ({ page }) => {
    const state = await editCity(page);
    await dialog(page).getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page).toHaveURL(/\/library\/cast$/u);
    await page.goto(`/library/cast/${person.a}`);
    await page.getByRole('button', { name: 'Edit facts', exact: true }).click();
    await expect(page.getByLabel('City', { exact: true })).toHaveValue('');
    expect(state.factPatches).toHaveLength(0);
  });

  test('opening the editor without changing anything does not ask', async ({ page }) => {
    const state = await fixture(page);
    await page.goto(`/library/cast/${person.a}`);
    await page.getByRole('button', { name: 'Edit facts', exact: true }).click();
    await page.locator('.profile-breadcrumb').getByRole('link', { name: 'Cast Library' }).focus(); await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/library\/cast$/u);
    expect(state.factPatches).toHaveLength(0);
  });
});

test('project pictures use the template focal rule; processing and load failures are named honestly', async ({ page }) => {
  const state = await fixture(page, {
    pool: [
      poolRow('pool-a1', person.a, { media_selection_state: 'pinned', portrait_asset_id: 'frame-a', portrait_source: 'frame',
        portrait_crop: { focal_x: 0.25, focal_y: 0.75, rect: { x: 0, y: 0, width: 0.1, height: 0.1 } } }),
      poolRow('pool-b1', person.b, { media_selection_state: 'pinned', portrait_asset_id: 'frame-b', portrait_source: 'frame', portrait_crop: null }),
    ],
    uploads: [
      { upload_id: 'tape-b', target_candidate_id: person.b, state: 'processing', job: { id: 'job-b', status: 'running' }, candidate_id: null, workspace_candidate_id: null },
      { upload_id: 'tape-c', target_candidate_id: person.c, state: 'processing', job: { id: 'job-c', status: 'running' }, candidate_id: null, workspace_candidate_id: null },
    ],
    pendingAssets: new Set(['frame-b']),
  });
  await page.goto(cast);
  // Focal point only (a crop rectangle is ignored), and the template's 0.5/0.4 default when none is stored.
  await expect(row(page, person.a).locator('.project-picture img')).toHaveCSS('object-position', '25% 75%');
  await expect(row(page, person.a).locator('.project-picture img')).toHaveCSS('object-fit', 'cover');
  // A pinned picture of a person whose new tape is still processing reads "Processing", not a failure.
  await expect(row(page, person.b).locator('.project-picture-state')).toHaveText('Processing');
  await expect(page.getByText('Picture can’t be loaded')).toHaveCount(0);
  // The outcome wording comes from the server-recorded result (B was already a member, C was added by the save step).
  const polls = state.jobPolls; await expect.poll(() => state.jobPolls, { timeout: 15_000 }).toBeGreaterThan(polls + 1);
  state.pendingAssets.delete('frame-b'); state.jobStatus['job-b'] = 'succeeded'; state.jobStatus['job-c'] = 'succeeded';
  const status = page.getByRole('region', { name: 'Your uploads in this project' });
  await expect(status.locator('li').filter({ hasText: 'tape-b.mp4' })).toContainText(`New tape ready for ${names[person.b]} · Already in this project`, { timeout: 20_000 });
  await expect(status.locator('li').filter({ hasText: 'tape-b.mp4' })).not.toContainText('Added to this project');
  await expect(status.locator('li').filter({ hasText: 'tape-c.mp4' })).toContainText(`New tape ready for ${names[person.c]} · Added to this project`, { timeout: 20_000 });
  await expect(row(page, person.c)).toHaveCount(1);
  // Processing ended: the picture is read again and shows, framed at the template default.
  await expect(row(page, person.b).locator('.project-picture-state')).toHaveCount(0);
  await expect(row(page, person.b).locator('.project-picture img')).toHaveCSS('object-position', '50% 40%');
  // After a reload the same recorded outcomes are shown (nothing depended on what the page saw before).
  await page.reload();
  const restored = page.getByRole('region', { name: 'Your uploads in this project' });
  await expect(restored.locator('li').filter({ hasText: 'tape-b.mp4' })).toContainText(`New tape ready for ${names[person.b]} · Already in this project`);
  await expect(restored.locator('li').filter({ hasText: 'tape-c.mp4' })).toContainText(`New tape ready for ${names[person.c]} · Added to this project`);
});

test('a picture that fails to decode with nothing processing says it cannot be loaded', async ({ page }) => {
  await fixture(page, { pool: [poolRow('pool-a1', person.a, { media_selection_state: 'pinned', portrait_asset_id: 'frame-bad', portrait_source: 'frame' })], brokenAssets: new Set(['frame-bad']) });
  await page.goto(cast);
  await expect(row(page, person.a).locator('.project-picture-state')).toHaveText('Picture can’t be loaded');
});

test.describe('Library re-add after a removal uses a new Idempotency-Key', () => {
  test('removed in this session: the stored key is dropped and the re-add succeeds', async ({ page }) => {
    const state = await fixture(page, { dropFirstAdd: true });
    await page.goto(cast);
    await page.getByRole('button', { name: 'Choose from Library', exact: true }).first().click();
    await page.getByRole('button', { name: `Add ${names[person.c]} to project`, exact: true }).click();
    await expect(page.getByText(/Not added:/u)).toBeVisible();
    await page.getByRole('button', { name: 'Done · Back to project', exact: true }).click();
    await page.getByRole('button', { name: 'Reload saved candidates', exact: true }).click();
    const card = row(page, person.c);
    await card.getByRole('button', { name: /^Edit project material for / }).click();
    await card.getByRole('button', { name: 'Remove from project', exact: true }).click();
    await card.getByRole('button', { name: 'Confirm remove from project', exact: true }).click();
    await expect(card).toHaveCount(0);
    await page.getByRole('button', { name: 'Choose from Library', exact: true }).first().click();
    await page.getByRole('button', { name: `Add ${names[person.c]} to project`, exact: true }).click();
    await expect(page.getByText('Added to project', { exact: true })).toBeVisible();
    expect(state.adds.map(entry => entry.status)).toEqual([503, 201]);
    expect(state.adds[1].key).not.toBe(state.adds[0].key);
  });

  test('removed elsewhere: MEMBERSHIP_REMOVED refreshes membership and the next add uses a fresh key', async ({ page }) => {
    const state = await fixture(page, { dropFirstAdd: true });
    await page.goto(cast);
    await page.getByRole('button', { name: 'Choose from Library', exact: true }).first().click();
    await page.getByRole('button', { name: `Add ${names[person.c]} to project`, exact: true }).click();
    await expect(page.getByText(/Not added:/u)).toBeVisible();
    // Another producer removes the person; the earlier key is now a removed membership on the server.
    const id = state.pool[0].id; state.pool = []; for (const [key, value] of state.keys) if (value === id) state.removedKeys.add(key);
    const searches = state.searches;
    await page.getByRole('button', { name: `Retry adding ${names[person.c]}`, exact: true }).click();
    await expect(page.getByText(/removed from the project after an earlier add/u)).toBeVisible();
    await expect.poll(() => state.searches).toBeGreaterThan(searches);
    await page.getByRole('button', { name: `Retry adding ${names[person.c]}`, exact: true }).click();
    await expect(page.getByText('Added to project', { exact: true })).toBeVisible();
    expect(state.adds.map(entry => entry.status)).toEqual([503, 409, 201]);
    expect(state.adds[1].key).toBe(state.adds[0].key);
    expect(state.adds[2].key).not.toBe(state.adds[0].key);
  });
});
