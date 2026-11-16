import { expect, test, type Page } from '@playwright/test';

// Cycle 7 audience flow: ordinary review series use the Studio's default audience (no everyday Audience select),
// a missing default gives an actionable recovery path, Share's advanced review context resolves or creates a
// separate series without publishing, and Settings saves the default. Every record is synthetic.
const workspace = '9a000000-0000-4000-8000-000000000001', project = '9a000000-0000-4000-8000-000000000002';
const client = { id: '9a000000-0000-4000-8000-000000000011', key: 'client', label: 'Client', scope: 'external', settings: {}, archived: false, row_version: 1 };
const agency = { id: '9a000000-0000-4000-8000-000000000012', key: 'agency', label: 'Agency', scope: 'internal', settings: {}, archived: false, row_version: 1 };
const template = { key: 'everyone-casting', version: '1.4.0', content_sha256: 'c'.repeat(64), font_key: 'everyone-film-fonts-v1' };
const seriesDto = (id: string, audience: typeof client, title = 'Cast Shortlist') => ({ id, workspace_id: workspace, output_type: 'shortlist', audience_preset_id: audience.id, audience_snapshot: audience, title,
  latest_ready_version_id: null, latest_ready_version_no: null, row_version: 1, archived: false, template_key: template.key, template_version: template.version, template_content_sha256: template.content_sha256, font_key: template.font_key, cover_note: null });

interface Options { defaultAudience: string | null; createError?: boolean; series?: ReturnType<typeof seriesDto>[] }
async function mock(page: Page, options: Options) {
  const posts: Record<string, unknown>[] = []; const linkWrites: string[] = []; let series = options.series ?? [];
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-audience', data, page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-producer', name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read', 'presentations.generate', 'review_links.manage', 'settings.manage'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/projects/${project}`) return ok({ id: project, name: 'Synthetic launch', client_name: null, client_id: null, row_version: 1, can_edit: false });
    if (path === `/api/v1/workspaces/${workspace}`) return ok({ id: workspace, project_id: project, module: 'casting', title: 'Synthetic launch', active_output: 'shortlist', row_version: 1, draft_revision: 1, has_unpublished_changes: false });
    if (path === '/api/v1/audience-presets') return ok([client, agency]);
    if (path === '/api/v1/settings') return ok({ template_version: '1.4.0', default_timezone: 'Africa/Cairo', default_review_expiry_days: 30, models: {}, row_version: 1, default_audience_preset_id: options.defaultAudience });
    if (path === '/api/v1/presentation-series' && request.method() === 'GET') return ok(series);
    if (path === '/api/v1/presentation-series' && request.method() === 'POST') {
      const body = request.postDataJSON(); posts.push(body);
      if (options.createError) return route.fulfill({ status: 409, json: { request_id: 'synthetic-audience', error: { code: 'AUDIENCE_DEFAULT_REQUIRED', message: 'Choose the default review audience in Settings, or choose a review context in Share.' } } });
      const audience = body.audience_preset_id === agency.id ? agency : client;
      const created = seriesDto(`9a000000-0000-4000-8000-00000000010${series.length}`, audience, `Cast Shortlist · ${audience.label}`); series = [...series, created]; return ok(created);
    }
    const one = series.find(row => path === `/api/v1/presentation-series/${row.id}`); if (one) return ok(one);
    if (series.some(row => path === `/api/v1/presentation-series/${row.id}/versions`)) return ok([]);
    if (path.includes('review-links')) { if (request.method() !== 'GET') linkWrites.push(path); return ok([]); }
    return route.fulfill({ status: 404, json: { request_id: 'synthetic-audience', error: { code: 'RESOURCE_NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  return { posts, linkWrites };
}

test('Review has no audience select; a missing default shows a recovery path, never a bare error', async ({ page }) => {
  const h = await mock(page, { defaultAudience: null, createError: true });
  await page.goto(`/projects/${project}/casting/${workspace}/review`);
  await expect(page.getByRole('button', { name: 'Create / reuse review series' })).toBeVisible();
  await expect(page.getByLabel('Audience for a new series')).toHaveCount(0);
  const recovery = page.getByTestId('audience-default-recovery');
  await expect(recovery).toContainText('No default review audience is set yet.');
  await expect(recovery.getByRole('link', { name: 'Choose default audience in Settings' })).toHaveAttribute('href', '/settings#studio-defaults');
  await page.getByRole('button', { name: 'Create / reuse review series' }).click();
  await expect(recovery).toBeVisible();
  // The ordinary series is requested without an audience: the server applies the default.
  expect(h.posts).toEqual([{ workspace_id: workspace, output_type: 'shortlist' }]);
  await expect(page.getByText('AUDIENCE_DEFAULT_REQUIRED')).toHaveCount(0);
});

test('Review creates an ordinary series with the configured default audience', async ({ page }) => {
  const h = await mock(page, { defaultAudience: client.id });
  await page.goto(`/projects/${project}/casting/${workspace}/review`);
  await expect(page.getByText('New series use the Studio’s default review audience (Client)').or(page.getByText("New series use the Studio's default review audience (Client)"))).toBeVisible();
  await expect(page.getByTestId('audience-default-recovery')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create / reuse review series' }).click();
  await expect.poll(() => h.posts.length).toBe(1);
  expect(h.posts[0]).toEqual({ workspace_id: workspace, output_type: 'shortlist' });
});

test('Share review context creates a separate series for another audience without publishing or sending a link', async ({ page }) => {
  const clientSeries = seriesDto('9a000000-0000-4000-8000-000000000100', client);
  const h = await mock(page, { defaultAudience: client.id, series: [clientSeries] });
  await page.goto(`/projects/${project}/casting/${workspace}/share`);
  await expect(page.getByRole('combobox', { name: 'Presentation series' })).toHaveValue(clientSeries.id);
  await page.getByText('Review context (advanced)').click();
  await page.getByLabel('Review context').selectOption(agency.id);
  await page.getByRole('button', { name: 'Use this review context' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Nothing was published and no link was sent' })).toBeVisible();
  expect(h.posts).toEqual([{ workspace_id: workspace, output_type: 'shortlist', audience_preset_id: agency.id }]);
  expect(h.linkWrites).toEqual([]);
  // The internal (Agency) series is its own history and cannot get guest links; the Client series is unchanged.
  await expect(page.getByText('This series has an internal audience.')).toBeVisible();
  await page.getByLabel('Review context').selectOption(client.id);
  await page.getByRole('button', { name: 'Use this review context' }).click();
  await expect(page.getByRole('combobox', { name: 'Presentation series' })).toHaveValue(clientSeries.id);
  expect(h.posts).toHaveLength(1);
});

test('Settings saves the default review audience and offers template 1.4.0', async ({ page }) => {
  const patches: Record<string, unknown>[] = []; let saved: Record<string, unknown> = { template_version: '1.3.0', default_timezone: 'Africa/Cairo', default_review_expiry_days: 30, models: {}, row_version: 1, default_audience_preset_id: null };
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-settings', data, page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-producer', name: 'Synthetic operator', capabilities: ['settings.manage', 'workspaces.read'] }, actors: [] });
    if (path === '/api/v1/audience-presets') return ok([client, agency]);
    if (path === '/api/v1/settings' && request.method() === 'GET') return ok(saved);
    if (path === '/api/v1/settings' && request.method() === 'PATCH') { const body = request.postDataJSON(); patches.push(body); saved = { ...saved, ...body, row_version: 2 }; return ok(saved); }
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Unexpected synthetic operation.' } } });
  });
  await page.goto('/settings');
  await expect(page.getByLabel('Default review audience')).toHaveValue('');
  await expect(page.getByText('The saved default is an earlier template. Choose Everyone Film Editorial 1.4.0 and save.')).toBeVisible();
  await page.getByLabel('Default presentation template').selectOption('1.4.0');
  await page.getByLabel('Default review audience').selectOption(client.id);
  await page.getByRole('button', { name: 'Save defaults', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Studio defaults saved.' })).toBeVisible();
  expect(patches).toEqual([{ row_version: 1, default_timezone: 'Africa/Cairo', template_version: '1.4.0', default_audience_preset_id: client.id }]);
  await expect(page.getByLabel('Default review audience')).toHaveValue(client.id);
});
