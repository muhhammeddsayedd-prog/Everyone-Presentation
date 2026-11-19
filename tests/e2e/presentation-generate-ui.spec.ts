import { expect, test } from '@playwright/test';
import { presentationFixture, presentationId, presentationVersionFixture } from '../fixtures/presentation';
import { reviewFromRenderSnapshot } from '../../packages/domain/src/presentation';

// There is no Review step: when the server says this exact draft's layout has not been measured, Generate requests
// the measurement, follows the job, re-reads the checked draft and only then captures the version. A measured
// overflow stops before generation and says which field to shorten. Every record is synthetic.
type FitMode = 'measure-then-ok' | 'measure-then-overflow';
async function studio(page: import('@playwright/test').Page, mode: FitMode) {
  const snapshot = presentationFixture({ frames: 0 });
  const workspace = snapshot.workspace_id, project = snapshot.project_id, series = snapshot.series_id;
  const calls: string[] = []; let measured = false; let polls = 0; const versions = new Map<string, ReturnType<typeof presentationVersionFixture>>();
  const seriesDto = () => ({ id: series, workspace_id: workspace, output_type: 'selection', audience_preset_id: snapshot.audience_snapshot.id, audience_snapshot: snapshot.audience_snapshot,
    title: snapshot.cover.title, latest_ready_version_id: versions.size ? [...versions.keys()].at(-1) : null, latest_ready_version_no: versions.size || null, row_version: 1, archived: false,
    template_key: snapshot.template.key, template_version: '1.3.0', template_content_sha256: snapshot.template.content_sha256, font_key: snapshot.template.font_key });
  const review = () => {
    const base = reviewFromRenderSnapshot(snapshot);
    if (!measured) return { ...base, can_generate: false, issues: [{ code: 'FIT_MEASUREMENT_REQUIRED', severity: 'blocking', entity_id: series, field: null, message: 'This exact template snapshot has not been measured.', repair_action: 'Measure the current review layout.' }],
      fit: { status: 'unmeasured', input_fingerprint: null, measured_at: null, overflows: [], error_code: 'FIT_MEASUREMENT_REQUIRED' } };
    const overflows = mode === 'measure-then-overflow' ? [{ slide_index: 1, field: 'skills_experience', axis: 'vertical', overflow_px: 14.2 }] : [];
    return { ...base, can_generate: !overflows.length, issues: overflows.length ? [{ code: 'LAYOUT_OVERFLOW', severity: 'blocking', entity_id: base.slides[0].assignment_id, field: 'skills_experience', message: 'Text exceeds the selected slide layout.', repair_action: null }] : [],
      fit: { status: 'measured', input_fingerprint: snapshot.input_fingerprint, measured_at: '2026-11-19T10:00:00Z', overflows, error_code: null } };
  };
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'synthetic-generate', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-generate', data, page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: presentationId(80), name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read', 'presentations.generate'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/projects/${project}`) return ok({ id: project, name: 'Synthetic Project', client_id: null, client_name: 'Synthetic Client', row_version: 1, can_edit: true });
    if (path === `/api/v1/workspaces/${workspace}`) return ok({ id: workspace, project_id: project, title: 'Synthetic Project', module: 'casting', active_output: 'selection', row_version: snapshot.input_workspace_row_version, draft_revision: snapshot.input_draft_revision, has_unpublished_changes: true });
    if (path === '/api/v1/presentation-series') return list([seriesDto()]);
    if (path === `/api/v1/presentation-series/${series}`) return ok(seriesDto());
    if (path === `/api/v1/workspaces/${workspace}/review/fit` && req.method() === 'POST') {
      calls.push('fit'); expect(req.postDataJSON()).toEqual({ series_id: series, expected_input_fingerprint: snapshot.input_fingerprint });
      return ok({ job_id: presentationId(51), resource_id: series, poll_url: `/api/v1/jobs/${presentationId(51)}`, status: 'queued' }, 202);
    }
    if (path === `/api/v1/jobs/${presentationId(51)}`) { polls++; if (polls >= 2) measured = true; return ok({ id: presentationId(51), kind: 'review_fit', status: polls >= 2 ? 'succeeded' : 'running' }); }
    if (path === `/api/v1/workspaces/${workspace}/review`) return ok(review());
    if (path === `/api/v1/presentation-series/${series}/versions` && req.method() === 'GET') return list([...versions.values()].reverse());
    if (path === `/api/v1/presentation-series/${series}/versions` && req.method() === 'POST') {
      calls.push('generate'); const captured = structuredClone(snapshot); const version = presentationVersionFixture(captured); version.status = 'ready'; version.ready_at = '2026-11-19T10:01:00Z';
      version.pdf_asset_id = presentationId(71); versions.set(version.id, version);
      return ok({ job_id: presentationId(50), resource_id: version.id, poll_url: `/api/v1/jobs/${presentationId(50)}`, status: 'succeeded' }, 202);
    }
    if (path.startsWith('/api/v1/versions/')) { const id = path.split('/')[4]; return versions.has(id) ? ok(versions.get(id)) : route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Version not found' } } }); }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto(`/projects/${project}/casting/${workspace}/presentations`);
  return { calls };
}

test('an unmeasured draft: Generate measures the layout first, then captures the version', async ({ page }) => {
  const h = await studio(page, 'measure-then-ok');
  const readiness = page.getByRole('list', { name: 'Before generating' });
  await expect(readiness).toContainText('Checked when you generate');
  const generate = page.getByRole('button', { name: 'Generate saved version', exact: true });
  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(page.getByText('The captured version is saved. Its processing status and PDF are shown on the stage.')).toBeVisible({ timeout: 15000 });
  expect(h.calls).toEqual(['fit', 'generate']);
  await expect(page.getByRole('heading', { name: /Saved version 1/u })).toBeVisible();
});

test('a measured overflow stops before generation and names the field to shorten', async ({ page }) => {
  const h = await studio(page, 'measure-then-overflow');
  await page.getByRole('button', { name: 'Generate saved version', exact: true }).click();
  await expect(page.getByText(/The layout check found 1 field that does not fit/u)).toBeVisible({ timeout: 15000 });
  const fixes = page.getByRole('list', { name: 'Fix before generating' });
  await expect(fixes).toContainText('px too tall');
  await expect(page.getByRole('button', { name: 'Generate saved version', exact: true })).toBeDisabled();
  expect(h.calls).toEqual(['fit']);
});
