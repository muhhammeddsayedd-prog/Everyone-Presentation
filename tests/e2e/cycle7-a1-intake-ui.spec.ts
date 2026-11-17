import { expect, test, type Page, type Route } from '@playwright/test';

// Cycle 7 A1 intake: controlled HTTP/DOM proof with an in-memory central fixture (no real identity, SQL,
// storage, worker or provider). Server ordering, idempotency and apply semantics are proven by the
// replica SQL tests in tests/db/cycle7; here the browser must not re-sort, must converge on one
// membership per person and must resolve finished uploads into the project list.
const project = 'a1e00000-0000-4000-8000-000000000001';
const workspace = 'a1e00000-0000-4000-8000-000000000002';
const people = ['a1e00000-0000-4000-8000-0000000000a1', 'a1e00000-0000-4000-8000-0000000000a2', 'a1e00000-0000-4000-8000-0000000000a3'];
const names: Record<string, string> = { [people[0]]: 'Synthetic Older Person', [people[1]]: 'Synthetic Middle Person', [people[2]]: 'Synthetic Newest Person' };
const facts = (id: string) => ({ name: names[id] ?? 'Synthetic Uploaded Person', casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null,
  languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null });
const profile = (id: string) => ({ id, facts: facts(id), review_status: 'unreviewed', reviewed_at: null, reviewed_by: null, search_match: null, possible_duplicate: false,
  merged_into_candidate_id: null, archived: false, row_version: 1, created_at: '2026-11-16T09:00:00Z', updated_at: '2026-11-16T09:00:00Z' });
const poolRow = (id: string, candidate: string, patch: Record<string, unknown> = {}) => ({ id, workspace_id: workspace, candidate_id: candidate, selected_candidate_media_id: null,
  selected_frame_asset_ids: [], availability: null, fresh_material_required: false, media_confirmed: false, internal_notes: null, portrait_asset_id: null, portrait_source: null,
  portrait_crop: null, media_selection_state: 'unset', row_version: 1, ...patch });

type Upload = { upload_id: string; state: string; job: { id: string; status: string; retryable?: boolean; error_code?: string } | null; candidate_id: string | null; workspace_candidate_id: string | null;
  candidate_outcome?: string | null; membership_outcome?: string | null };
interface State {
  pool: ReturnType<typeof poolRow>[]; adds: { key: string; candidate: string }[]; patches: Record<string, unknown>[]; failPatch: boolean;
  uploads: Upload[]; jobPolls: Record<string, string[]>; retries: number; searches: URLSearchParams[]; repairsApplied: unknown[];
}

async function fixture(page: Page, setup: Partial<State> = {}) {
  const state: State = { pool: [], adds: [], patches: [], failPatch: false, uploads: [], jobPolls: {}, retries: 0, searches: [], repairsApplied: [], ...setup };
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'synthetic-a1', data } });
    const list = (data: unknown[], next_cursor: string | null = null) => route.fulfill({ json: { request_id: 'synthetic-a1', data, page: { next_cursor } } });
    if (path === '/api/session') return ok({ mode: 'supabase', storage_origin: 'http://127.0.0.1:54321', actor: { id: 'synthetic-producer', name: 'Synthetic Producer',
      capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read', 'cast.write', 'cast.upload', 'operations.retry'], upload_purposes: ['candidate_video'], upload_maximum_bytes: 268435456 }, actors: [] });
    if (path === `/api/v1/projects/${project}`) return ok({ id: project, name: 'Synthetic intake project', client_id: null, client_name: null, client_logo_asset_id: null,
      row_version: 1, client_row_version: null, casting_workspace_id: workspace, can_edit: true });
    if (path === `/api/v1/workspaces/${workspace}`) return ok({ id: workspace, project_id: project, title: 'Synthetic intake project', module: 'casting', active_output: 'selection',
      logo_asset_id: null, logo_placement: 'cover', row_version: 1, draft_revision: 1, has_unpublished_changes: false });
    if (path === `/api/v1/workspaces/${workspace}/candidates` && method === 'GET') return list(state.pool);
    if (path === `/api/v1/workspaces/${workspace}/candidates` && method === 'POST') {
      const body = request.postDataJSON(); const key = request.headers()['idempotency-key']; state.adds.push({ key, candidate: body.candidate_id });
      await new Promise(resolve => setTimeout(resolve, 150));
      const existing = state.pool.find(row => row.candidate_id === body.candidate_id);
      if (existing) return ok({ ...existing, already_member: true }, 200);
      const row = poolRow(`pool-${state.pool.length + 1}`, body.candidate_id, { media_selection_state: 'pinned' }); state.pool.unshift(row);
      return ok({ ...row, already_member: false }, 201);
    }
    if (path === '/api/v1/candidates' && method === 'GET') {
      state.searches.push(url.searchParams);
      const ordered = [people[2], people[1], people[0]].map(id => ({ ...profile(id), name_ar: id === people[2] ? 'شخص جديد' : null, talent_type: 'talent', tape_count: id === people[2] ? 2 : 0,
        portrait_photo: null, portrait_frame_asset_id: null, processing: false,
        membership: state.pool.some(row => row.candidate_id === id) ? { workspace_candidate_id: state.pool.find(row => row.candidate_id === id)!.id, state: 'in_project' } : null }));
      return url.searchParams.get('cursor') === 'page-2' ? list(ordered.slice(2)) : list(ordered.slice(0, 2), 'page-2');
    }
    const person = path.match(/^\/api\/v1\/candidates\/([^/]+)(\/.*)?$/u);
    if (person && method === 'GET') {
      if (!person[2]) return ok(profile(person[1]));
      if (['/media', '/supporting-files', '/duplicates', '/photos'].includes(person[2])) return list([]);
    }
    if (path === `/api/v1/workspaces/${workspace}/candidate-uploads`) return list(state.uploads.map(row => ({ workspace_id: workspace, asset_id: `asset-${row.upload_id}`, filename: `${row.upload_id}.mp4`,
      size_bytes: 1000, mime_type: 'video/mp4', target_candidate_id: null, created_at: '2026-11-16T09:00:00Z', upload_status: 'completed', candidate_outcome: null, membership_outcome: null, ...row,
      job: row.job ? { stage: 'prepare_candidate', error_code: row.state === 'failed' ? 'PROCESSING_FAILED' : null, retryable: false, row_version: 2, updated_at: '2026-11-16T09:00:00Z', ...row.job } : null })));
    const job = path.match(/^\/api\/v1\/jobs\/([^/]+)(\/retry)?$/u);
    if (job && job[2] && method === 'POST') {
      state.retries += 1; const upload = state.uploads.find(row => row.job?.id === job[1])!; upload.state = 'processing'; upload.job!.status = 'queued';
      return ok({ job_id: job[1], resource_id: upload.upload_id, poll_url: `/api/v1/jobs/${job[1]}`, status: 'queued' }, 202);
    }
    if (job && method === 'GET') {
      const queue = state.jobPolls[job[1]] ?? []; const status = queue.length > 1 ? queue.shift()! : queue[0] ?? 'running';
      const upload = state.uploads.find(row => row.job?.id === job[1])!;
      if (status === 'succeeded' && !state.pool.some(row => row.candidate_id === 'uploaded-person')) { state.pool.unshift(poolRow('pool-uploaded', 'uploaded-person', { media_selection_state: 'pinned' })); }
      if (status === 'succeeded') Object.assign(upload, { state: 'ready', job: { id: job[1], status }, candidate_id: 'uploaded-person', workspace_candidate_id: 'pool-uploaded', candidate_outcome: 'created', membership_outcome: 'added' });
      return ok({ id: job[1], workspace_id: workspace, kind: 'candidate_scan', status, stage: status === 'succeeded' ? 'apply_candidate' : 'transcribe_candidate', attempt: 1, progress_completed: 0,
        progress_total: null, batch_id: null, input_asset_id: 'asset', resource_id: upload.upload_id, error: null, created_at: '2026-11-16T09:00:00Z', updated_at: '2026-11-16T09:00:00Z', row_version: 3,
        ...(status === 'succeeded' ? { candidate_result: { candidate_id: 'uploaded-person', candidate_media_id: 'media', workspace_candidate_id: 'pool-uploaded', candidate_outcome: 'created', membership_outcome: 'added' } } : {}) });
    }
    if (path === `/api/v1/workspaces/${workspace}/media-repairs` && method === 'GET') return route.fulfill({ json: { request_id: 'synthetic-a1', has_more: false,
      data: state.pool.filter(row => row.media_selection_state === 'unset').map(row => ({ workspace_candidate_id: row.id, candidate_id: row.candidate_id, row_version: row.row_version,
        reason: 'default_available', suggestion: { selected_candidate_media_id: 'media', selected_frame_asset_ids: [], portrait_asset_id: 'frame', portrait_source: 'frame' } })) } });
    if (path === `/api/v1/workspaces/${workspace}/media-repairs` && method === 'POST') {
      const body = request.postDataJSON(); state.repairsApplied.push(body);
      const applied = body.items.map((item: { workspace_candidate_id: string }) => { const row = state.pool.find(entry => entry.id === item.workspace_candidate_id)!;
        Object.assign(row, { media_selection_state: 'pinned', portrait_asset_id: 'frame', portrait_source: 'frame', row_version: row.row_version + 1 }); return row; });
      return ok({ applied, skipped: [] });
    }
    const patch = path.match(/^\/api\/v1\/workspace-candidates\/([^/]+)$/u);
    if (patch && method === 'PATCH') {
      const body = request.postDataJSON(); state.patches.push(body);
      if (state.failPatch) return route.fulfill({ status: 503, json: { request_id: 'synthetic-a1', error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Synthetic save outage.' } } });
      const row = state.pool.find(entry => entry.id === patch[1])!; Object.assign(row, { availability: body.availability, row_version: row.row_version + 1 }); return ok(row);
    }
    if (method === 'GET' && /\/(roles|assignments|presentation-series|slots|scenes)$/u.test(path)) return list([]);
    return route.fulfill({ status: 404, json: { error: { code: 'CONTROLLED_ROUTE_UNAVAILABLE', message: 'Synthetic route unavailable.' } } });
  });
  return state;
}
const cast = `/projects/${project}/casting/${workspace}/cast`;
const projectList = (page: Page) => page.locator('.project-candidate-list');

test('a finished upload appears in the project without searching, and is still there after reload', async ({ page }) => {
  const state = await fixture(page, { uploads: [{ upload_id: 'upload-1', state: 'processing', job: { id: 'job-1', status: 'running' }, candidate_id: null, workspace_candidate_id: null }],
    jobPolls: { 'job-1': ['running', 'succeeded'] } });
  await page.goto(cast);
  const status = page.getByRole('region', { name: 'Your uploads in this project' });
  await expect(status.getByText('upload-1.mp4')).toBeVisible();
  await expect(status.getByText('New person saved in Library · Added to this project')).toBeVisible({ timeout: 20_000 });
  await expect(projectList(page).getByRole('heading', { name: 'Synthetic Uploaded Person' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your uploads in this project' }).getByText('New person saved in Library · Added to this project')).toBeVisible();
  await expect(projectList(page).getByRole('heading', { name: 'Synthetic Uploaded Person' })).toHaveCount(1);
  expect(state.pool).toHaveLength(1);
});

test('after a reload an older finished upload without a recorded outcome claims only what is verified now', async ({ page }) => {
  // Two jobs finished before outcomes were recorded: one person is in the project now, the other is not.
  const state = await fixture(page, { pool: [poolRow('pool-old', people[0], { media_selection_state: 'pinned' })], uploads: [
    { upload_id: 'old-in', state: 'ready', job: { id: 'job-old-in', status: 'succeeded' }, candidate_id: people[0], workspace_candidate_id: 'pool-old', candidate_outcome: null, membership_outcome: null },
    { upload_id: 'old-out', state: 'ready', job: { id: 'job-old-out', status: 'succeeded' }, candidate_id: people[1], workspace_candidate_id: 'pool-removed', candidate_outcome: null, membership_outcome: null },
  ] });
  await page.goto(cast);
  await page.reload();
  const status = page.getByRole('region', { name: 'Your uploads in this project' });
  const inProject = status.locator('li').filter({ hasText: 'old-in.mp4' }); const notInProject = status.locator('li').filter({ hasText: 'old-out.mp4' });
  await expect(inProject.getByRole('status')).toHaveText('Tape ready · In this project');
  await expect(notInProject.getByRole('status')).toHaveText('Tape ready');
  for (const claim of ['New person', 'New tape', 'Added to this project', 'Already in this project', 'Saved in Library']) await expect(status).not.toContainText(claim);
  expect(state.pool).toHaveLength(1);
});

test('a pending upload row is restored after reload and resolves after completion', async ({ page }) => {
  const state = await fixture(page, { uploads: [{ upload_id: 'upload-2', state: 'processing', job: { id: 'job-2', status: 'running' }, candidate_id: null, workspace_candidate_id: null }],
    jobPolls: { 'job-2': ['running'] } });
  await page.goto(cast);
  const status = page.getByRole('region', { name: 'Your uploads in this project' });
  await expect(status.getByText('Processing', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your uploads in this project' }).getByText('Processing', { exact: true })).toBeVisible();
  state.jobPolls['job-2'] = ['succeeded'];
  await expect(page.getByRole('region', { name: 'Your uploads in this project' }).getByText('New person saved in Library · Added to this project')).toBeVisible({ timeout: 20_000 });
  await expect(projectList(page).getByRole('heading', { name: 'Synthetic Uploaded Person' })).toHaveCount(1);
});

test('retrying a failed upload job adds the person once', async ({ page }) => {
  const state = await fixture(page, { uploads: [{ upload_id: 'upload-3', state: 'failed', job: { id: 'job-3', status: 'failed', retryable: true }, candidate_id: null, workspace_candidate_id: null }],
    jobPolls: { 'job-3': ['running', 'succeeded'] } });
  await page.goto(cast);
  const status = page.getByRole('region', { name: 'Your uploads in this project' });
  await expect(status.getByText('Failed', { exact: true })).toBeVisible();
  await status.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(status.getByText('New person saved in Library · Added to this project')).toBeVisible({ timeout: 20_000 });
  expect(state.retries).toBe(1);
  await expect(projectList(page).getByRole('heading', { name: 'Synthetic Uploaded Person' })).toHaveCount(1);
});

test('a failed upload whose retry budget is spent offers no Retry', async ({ page }) => {
  const state = await fixture(page, { uploads: [{ upload_id: 'upload-4', state: 'failed', job: { id: 'job-4', status: 'failed', retryable: false, error_code: 'DEPENDENCY_UNAVAILABLE' }, candidate_id: null, workspace_candidate_id: null }] });
  await page.goto(cast);
  const status = page.getByRole('region', { name: 'Your uploads in this project' });
  await expect(status.getByText('Failed', { exact: true })).toBeVisible();
  await expect(status.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
  expect(state.retries).toBe(0);
});

test('repeat and concurrent Add converge on one membership; state survives navigation and removal', async ({ page }) => {
  const state = await fixture(page);
  await page.goto(cast);
  await page.getByRole('button', { name: 'Choose from Library', exact: true }).first().click();
  const add = page.getByRole('button', { name: `Add ${names[people[2]]} to project`, exact: true });
  await add.dblclick();
  await expect(page.getByText('Added to project', { exact: true })).toBeVisible();
  expect(new Set(state.adds.map(entry => entry.key)).size).toBe(1);
  expect(state.pool.filter(row => row.candidate_id === people[2])).toHaveLength(1);
  // Library stays open for more; the person is already in the project list.
  await expect(page.getByRole('button', { name: `Add ${names[people[1]]} to project`, exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Done · Back to project', exact: true }).click();
  await expect(projectList(page).getByRole('heading', { name: names[people[2]] })).toBeVisible();
  await page.goto('/projects'); await page.goto(cast);
  await page.getByRole('button', { name: 'Choose from Library', exact: true }).first().click();
  await expect(page.getByText('In this project', { exact: true })).toBeVisible();
  state.pool.splice(0, state.pool.length); // removed on the server (e.g. by another producer)
  await page.reload();
  await page.getByRole('button', { name: 'Choose from Library', exact: true }).first().click();
  await expect(page.getByRole('button', { name: `Add ${names[people[2]]} to project`, exact: true })).toBeVisible();
});

test('library keeps the server newest-first order across Load more and sends filters with the project', async ({ page }) => {
  const state = await fixture(page);
  await page.goto(cast);
  await page.getByRole('button', { name: 'Choose from Library', exact: true }).first().click();
  const cards = page.getByRole('list', { name: 'Cast Library results' }).getByRole('heading', { level: 3 });
  await expect(cards).toHaveText([names[people[2]], names[people[1]]]);
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(cards).toHaveText([names[people[2]], names[people[1]], names[people[0]]]);
  await expect(page.locator('[lang="ar"][dir="rtl"]')).toHaveText('شخص جديد');
  await page.locator('#cast-search').fill('Synthetic');
  await expect.poll(() => state.searches.at(-1)?.get('q')).toBe('Synthetic');
  expect(state.searches.at(-1)?.get('workspace_id')).toBe(workspace); expect(state.searches.at(-1)?.has('cursor')).toBe(false);
});

test('suggested picture fixes list rows and apply only the selected ones', async ({ page }) => {
  const state = await fixture(page, { pool: [poolRow('pool-a', people[0]), poolRow('pool-b', people[1])] });
  await page.goto(cast);
  const panel = page.getByRole('region', { name: 'Suggested picture fixes' });
  await panel.getByText('Review 2 suggestions').click();
  await panel.getByRole('checkbox', { name: new RegExp(names[people[0]]) }).uncheck();
  await panel.getByRole('button', { name: 'Apply to 1 selected', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('1 person now has');
  expect(state.repairsApplied).toEqual([{ items: [{ workspace_candidate_id: 'pool-b', row_version: 1 }] }]);
});

test.describe('Save your changes?', () => {
  async function openEditor(page: Page, state?: Partial<State>) {
    const fixtureState = await fixture(page, { pool: [poolRow('pool-a', people[0], { media_selection_state: 'pinned' })], ...state });
    await page.goto(cast);
    await page.getByRole('button', { name: `Edit project material for ${names[people[0]]}` }).click();
    await page.getByRole('textbox', { name: 'Project availability', exact: true }).fill('Friday only');
    return fixtureState;
  }
  const dialog = (page: Page) => page.getByRole('alertdialog', { name: 'Save your changes?' });

  test('drawer close: Keep editing keeps the input, Discard resets it', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: `Close ${names[people[0]]}`, exact: true }).click();
    await dialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Project availability', exact: true })).toHaveValue('Friday only');
    await page.keyboard.press('Escape');
    await dialog(page).getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByRole('dialog', { name: names[people[0]] })).toHaveCount(0);
    await page.getByRole('button', { name: `Edit project material for ${names[people[0]]}` }).click();
    await expect(page.getByRole('textbox', { name: 'Project availability', exact: true })).toHaveValue('');
  });

  test('Save and continue waits for the save, then closes', async ({ page }) => {
    const state = await openEditor(page);
    // Backdrop click (dispatched: the development-only Next.js badge can overlap parts of the page).
    await page.locator('.scrim').dispatchEvent('click');
    await dialog(page).getByRole('button', { name: 'Save and continue', exact: true }).click();
    await expect(page.getByRole('dialog', { name: names[people[0]] })).toHaveCount(0);
    expect(state.patches).toHaveLength(1); expect(state.patches[0].availability).toBe('Friday only');
    await expect(projectList(page).getByText('Friday only')).toBeVisible();
  });

  test('a failed save keeps the editor and the input', async ({ page }) => {
    const state = await openEditor(page, { failPatch: true });
    await page.getByRole('button', { name: `Close ${names[people[0]]}`, exact: true }).click();
    await dialog(page).getByRole('button', { name: 'Save and continue', exact: true }).click();
    await expect(dialog(page).getByRole('alert')).toContainText('Your input is kept');
    await dialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Project availability', exact: true })).toHaveValue('Friday only');
    expect(state.patches).toHaveLength(1);
  });

  test('in-app navigation asks first; Discard continues', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('link', { name: 'Open shared profile' }).focus(); await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${cast}$`));
    await page.getByRole('link', { name: 'Open shared profile' }).focus(); await page.keyboard.press('Enter');
    await dialog(page).getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/library/cast/${people[0]}$`));
  });

  test('tab change from an unsaved manual Library entry asks first', async ({ page }) => {
    await fixture(page);
    await page.goto(cast);
    await page.getByRole('tab', { name: 'Cast Library' }).click();
    await page.getByRole('button', { name: 'Add manually', exact: true }).click();
    await page.getByRole('textbox', { name: /Name/ }).first().fill('Synthetic manual entry');
    await page.getByRole('tab', { name: /In this project/ }).click();
    await dialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(page.getByRole('textbox', { name: /Name/ }).first()).toHaveValue('Synthetic manual entry');
    await page.getByRole('tab', { name: /In this project/ }).click();
    await dialog(page).getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByRole('tab', { name: /In this project/ })).toHaveAttribute('aria-selected', 'true');
  });
});
