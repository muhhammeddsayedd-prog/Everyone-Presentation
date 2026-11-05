import { expect, test } from '@playwright/test';
import { presentationFixture, presentationId, presentationVersionFixture } from '../fixtures/presentation';
import { reviewFromRenderSnapshot } from '../../packages/domain/src/presentation';

test('generation retains an unknown request and saved versions never follow later draft facts', async ({ page }) => {
  const snapshot = presentationFixture({ frames: 0 });
  const workspace = snapshot.workspace_id, project = snapshot.project_id, series = snapshot.series_id;
  let draft = structuredClone(snapshot), generationCalls = 0, allocations = 0;
  const attempts: { key: string | undefined; body: unknown }[] = [];
  const versions = new Map<string, ReturnType<typeof presentationVersionFixture>>();
  const liveReads: string[] = [];
  const seriesDto = () => ({ id: series, workspace_id: workspace, output_type: 'selection', audience_preset_id: snapshot.audience_snapshot.id,
    audience_snapshot: snapshot.audience_snapshot, title: snapshot.cover.title, latest_ready_version_id: versions.size ? [...versions.keys()].at(-1) : null,
    latest_ready_version_no: versions.size || null, row_version: 1, archived: false, template_key: snapshot.template.key,
    template_version: snapshot.template.version, template_content_sha256: snapshot.template.content_sha256, font_key: snapshot.template.font_key });
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-presentation', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-presentation', data, page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: presentationId(80), name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read', 'presentations.generate'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/projects/${project}`) return ok({ id: project, name: 'Synthetic Project', client_id: null, client_name: 'Synthetic Client', row_version: 1, can_edit: true });
    if (path === `/api/v1/workspaces/${workspace}`) return ok({ id: workspace, project_id: project, title: 'Synthetic Project', module: 'casting', active_output: 'selection', row_version: draft.input_workspace_row_version, draft_revision: draft.input_draft_revision, has_unpublished_changes: true });
    if (path === '/api/v1/presentation-series') return list([seriesDto()]);
    if (path === `/api/v1/presentation-series/${series}`) return ok(seriesDto());
    if (path === `/api/v1/workspaces/${workspace}/review`) return ok({ ...reviewFromRenderSnapshot(draft), can_generate: true, fit: { status: 'measured', input_fingerprint: draft.input_fingerprint, measured_at: '2026-10-29T21:00:00Z', overflows: [], error_code: null } });
    if (path === `/api/v1/presentation-series/${series}/versions` && req.method() === 'GET') return list([...versions.values()].reverse());
    if (path === `/api/v1/presentation-series/${series}/versions` && req.method() === 'POST') {
      generationCalls++; attempts.push({ key: req.headers()['idempotency-key'], body: req.postDataJSON() });
      expect(req.postDataJSON()).toEqual({ expected_workspace_row_version: draft.input_workspace_row_version, expected_draft_revision: draft.input_draft_revision, expected_input_fingerprint: draft.input_fingerprint });
      if (generationCalls === 1 || generationCalls === 4) {
        allocations++; const captured = structuredClone(draft); captured.version_id = allocations === 1 ? snapshot.version_id : presentationId(60);
        captured.version_no = allocations; captured.slides.forEach((slide, index) => { slide.version_id = captured.version_id; if (allocations > 1) slide.id = presentationId(100 + index); });
        const version = presentationVersionFixture(captured); version.status = 'ready'; version.ready_at = '2026-10-29T21:02:00Z';
        version.pdf_asset_id = presentationId(70 + allocations); version.manifest_asset_id = presentationId(74 + allocations); versions.set(version.id, version);
      }
      if (generationCalls === 1) return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Synthetic lost acknowledgement' } } });
      if (generationCalls === 2) return route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN', message: 'Synthetic temporary denial' } } });
      const id = allocations === 1 ? snapshot.version_id : presentationId(60);
      return ok({ job_id: presentationId(50), resource_id: id, poll_url: `/api/v1/jobs/${presentationId(50)}`, status: 'succeeded' });
    }
    if (path.startsWith('/api/v1/versions/')) { const id = path.split('/')[4]; return versions.has(id) ? ok(versions.get(id)) : route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Version not found' } } }); }
    if (path.startsWith('/api/v1/candidates/')) liveReads.push(path);
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto(`/projects/${project}/casting/${workspace}/presentations`);
  await expect(page.getByRole('heading', { name: 'Versions', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate saved version', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Generate saved version', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm generation request', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Presentation series', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Confirm generation request', exact: true }).click();
  await expect(page.getByText(/Synthetic temporary denial/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm generation request', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved version 1', exact: true })).toBeVisible();
  expect(allocations).toBe(1); expect(attempts.slice(0, 3).map(row => row.key)).toEqual([attempts[0].key, attempts[0].key, attempts[0].key]);
  expect(attempts[0].key).toBeTruthy(); expect(attempts[0].body).toEqual(attempts[2].body);
  await page.getByRole('button', { name: 'Slide 2: Synthetic Role / Synthetic Slot1', exact: true }).click();
  await expect(page.getByText('Synthetic Candidate', { exact: true })).toBeVisible();
  draft = structuredClone(draft); draft.input_workspace_row_version++; draft.input_draft_revision++; draft.input_fingerprint = 'e'.repeat(64);
  draft.slides[1].fields!.name_or_id = 'Changed working draft';
  await page.getByRole('button', { name: 'Refresh working draft', exact: true }).click();
  await expect(page.getByText('Synthetic Candidate', { exact: true })).toBeVisible();
  await expect(page.getByText('1 display field changed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Generate saved version', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved version 2', exact: true })).toBeVisible();
  expect(allocations).toBe(2); expect(attempts[3].key).not.toBe(attempts[0].key);
  await page.getByRole('list', { name: 'Saved versions' }).getByRole('button', { name: /^Version 1 / }).click();
  await expect(page.getByRole('heading', { name: 'Saved version 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Slide 2: Synthetic Role / Synthetic Slot1', exact: true }).click();
  await expect(page.getByText('Synthetic Candidate', { exact: true })).toBeVisible();
  await expect(page.getByText('Changed working draft', { exact: true })).toHaveCount(0);
  expect(liveReads).toEqual([]);
});


test('saved viewer has mobile frame controls, complete Pending fields and fixed-version media access', async ({ page }, testInfo) => {
  const snapshot = presentationFixture({ frames: 2, logo: true });
  snapshot.slides[1].fields!.name_or_id = 'اسم اصطناعي / Synthetic name';
  const version = presentationVersionFixture(snapshot); version.status = 'ready'; version.ready_at = '2026-10-29T21:02:00Z';
  version.pdf_asset_id = presentationId(70); version.manifest_asset_id = presentationId(74);
  const requests: string[] = []; let denyPlayback = true;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC', 'base64');
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname; requests.push(path);
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-retained', data } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: presentationId(80), name: 'Synthetic Reader', capabilities: ['workspaces.read'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/versions/${version.id}`) return ok(version);
    if (path === `/api/v1/versions/${version.id}/media/${presentationId(10)}/playback`) {
      if (denyPlayback) return route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN', message: 'Synthetic fixed-version denial' } } });
      return ok({ source_version_id: version.id, asset_id: presentationId(10), url: 'https://synthetic.invalid/retained-original.mp4' });
    }
    if (/\/media\/[^/]+\/content$/u.test(path)) {
      return route.fulfill({ contentType: 'image/png', body: png });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/presentations/versions/${version.id}`);
  await expect(page.getByRole('heading', { name: 'Saved version 1', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download PDF', exact: true })).toHaveAttribute('href', `/api/v1/versions/${version.id}/pdf/content`);
  await page.getByRole('button', { name: 'Slide 2: Synthetic Role / Synthetic Slot1', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Saved frame 1 of 2', exact: true })).toBeVisible();
  const carousel = page.getByRole('region', { name: 'Saved candidate frames' });
  await carousel.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('img', { name: 'Saved frame 2 of 2', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next frame', exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('saved-candidate-mobile-controlled.png'), fullPage: true });
  await page.getByRole('button', { name: 'Slide 3: Synthetic Role / Synthetic Slot2', exact: true }).click();
  await expect(page.locator('.saved-requirement-fields dt')).toHaveCount(12);
  await expect(page.locator('.saved-requirement-fields dd').filter({ hasText: /^Not provided$/ })).toHaveCount(11);
  await expect(page.locator('.saved-requirement-fields')).toContainText('Synthetic category');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('saved-pending-mobile-controlled.png'), fullPage: true });
  await page.goto(`/presentations/versions/${version.id}/media/${presentationId(10)}`);
  await page.getByRole('button', { name: 'Open saved video', exact: true }).click();
  await expect(page.getByText('Synthetic fixed-version denial', { exact: true })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  denyPlayback = false;
  await page.getByRole('button', { name: 'Open saved video', exact: true }).click();
  await expect(page.locator('video')).toHaveAttribute('src', 'https://synthetic.invalid/retained-original.mp4');
  expect(requests.filter(path => /\/candidates\/|^\/api\/v1\/media\//u.test(path))).toEqual([]);
});

test('review and generation navigation keeps the chosen series instead of the workspace default', async ({ page }) => {
  const selection = presentationFixture({ frames: 0 }), shortlist = structuredClone(selection);
  const reviewReads: (string | null)[] = []; let seriesReads = 0;
  shortlist.series_id = presentationId(90); shortlist.cover.output_type = 'shortlist'; shortlist.cover.title = 'Synthetic Shortlist';
  const seriesDto = (snapshot: typeof selection) => ({ id: snapshot.series_id, workspace_id: snapshot.workspace_id, output_type: snapshot.cover.output_type,
    audience_preset_id: snapshot.audience_snapshot.id, audience_snapshot: snapshot.audience_snapshot, title: snapshot.cover.title,
    latest_ready_version_id: null, latest_ready_version_no: null, row_version: 1, archived: false,
    template_key: snapshot.template.key, template_version: snapshot.template.version, template_content_sha256: snapshot.template.content_sha256, font_key: snapshot.template.font_key });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-context', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-context', data, page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: presentationId(80), name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read', 'presentations.generate'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/projects/${selection.project_id}`) return ok({ id: selection.project_id, name: selection.cover.project_name, client_id: null, client_name: null, row_version: 1, can_edit: true });
    if (path === `/api/v1/workspaces/${selection.workspace_id}`) return ok({ id: selection.workspace_id, project_id: selection.project_id, title: selection.cover.project_name, module: 'casting', active_output: 'selection', row_version: selection.input_workspace_row_version, draft_revision: selection.input_draft_revision, has_unpublished_changes: true });
    if (path === '/api/v1/audience-presets') return list([selection.audience_snapshot]);
    if (path === '/api/v1/presentation-series') { seriesReads++; return list([seriesDto(selection), seriesDto(shortlist)]); }
    if (path === `/api/v1/workspaces/${selection.workspace_id}/review`) {
      reviewReads.push(url.searchParams.get('series_id'));
      const snapshot = url.searchParams.get('series_id') === shortlist.series_id ? shortlist : selection;
      return ok({ ...reviewFromRenderSnapshot(snapshot), can_generate: true, fit: { status: 'measured', input_fingerprint: snapshot.input_fingerprint, measured_at: '2026-10-29T21:00:00Z', overflows: [], error_code: null } });
    }
    if (path.endsWith('/versions')) return list([]);
    if (path === `/api/v1/presentation-series/${selection.series_id}`) return ok(seriesDto(selection));
    if (path === `/api/v1/presentation-series/${shortlist.series_id}`) return ok(seriesDto(shortlist));
    return route.fulfill({ status: 404, json: {} });
  });
  const base = `/projects/${selection.project_id}/casting/${selection.workspace_id}`;
  await page.goto(`${base}/review`);
  await page.getByRole('combobox', { name: 'Saved review series', exact: true }).selectOption(shortlist.series_id);
  await expect(page.getByText(/^Server check · revision \d+ · Synthetic Shortlist$/u)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Presentation', exact: true })).toHaveAttribute('href', `${base}/presentations?series_id=${shortlist.series_id}`);
  await page.getByRole('link', { name: 'Open Presentation', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Presentation series', exact: true })).toHaveValue(shortlist.series_id);
  await expect(page.getByRole('button', { name: 'Generate saved version', exact: true })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Open Final Review', exact: true })).toHaveAttribute('href', `${base}/review?series_id=${shortlist.series_id}`);
  await page.getByRole('link', { name: 'Open Final Review', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Saved review series', exact: true })).toHaveValue(shortlist.series_id);
  await expect(page.getByRole('navigation', { name: 'Casting workspace steps' }).getByRole('link', { name: '6 Presentation', exact: true })).toHaveAttribute('href', `${base}/presentations?series_id=${shortlist.series_id}`);
  const foreign = presentationId(99);
  await page.goto(`${base}/presentations?series_id=${foreign}`);
  await expect(page.getByText('The linked presentation series is unavailable in this workspace. Return to Final Review to choose its context.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate saved version', exact: true })).toHaveCount(0);
  expect(reviewReads).not.toContain(foreign);
  const beforeInvalid = seriesReads;
  await page.goto(`${base}/presentations?series_id=${shortlist.series_id}&series_id=${selection.series_id}`);
  await expect(page.getByText('This presentation context link is invalid. Open the workspace again from Projects.', { exact: true })).toBeVisible();
  expect(seriesReads).toBe(beforeInvalid);
});
