import { expect, test, type Page, type Route } from '@playwright/test';
import type { CentralJob } from '@eps/central';
import { presentationFixture } from '../fixtures/presentation';

// Synthetic HTTP/DOM checks for the three backend summaries the redesign consumes:
// workspace summary (dependency 1), version feedback summary (2) and the job batch filter (3).
// Mocked responses follow the deployed contracts; they are not live-backend evidence.
const stamp = '2026-11-01T00:00:00Z';
const projectId = '96900000-0000-4000-8000-000000000001';
const workspaceId = '96900000-0000-4000-8000-000000000002';
const seriesId = '96900000-0000-4000-8000-000000000003';
const notFound = (route: Route) => route.fulfill({ status: 404, json: { request_id: 'synthetic-summary', error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable', details: {}, retryable: false } } });

async function workspace(page: Page, summary: unknown | 'fail') {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-summary', data } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-producer', name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/projects/${projectId}`) return ok({ id: projectId, name: 'Synthetic summary project', client_id: null, client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: true });
    if (path === `/api/v1/workspaces/${workspaceId}`) return ok({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic summary project', logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 4, draft_revision: 7, has_unpublished_changes: true, created_at: stamp, updated_at: stamp });
    if (path === `/api/v1/workspaces/${workspaceId}/summary`) return summary === 'fail'
      ? route.fulfill({ status: 503, json: { request_id: 'synthetic-summary', error: { code: 'FEATURE_NOT_IMPLEMENTED', message: 'Synthetic unavailable', details: {}, retryable: true } } }) : ok(summary);
    return notFound(route);
  });
  await page.goto(`/projects/${projectId}/casting/${workspaceId}/project`);
  await expect(page.getByRole('heading', { name: 'Synthetic summary project', level: 1 })).toBeVisible();
  return errors;
}
const summary = (overrides: Record<string, unknown> = {}) => ({ workspace_id: workspaceId, row_version: 4, draft_revision: 7, roles_needing_clarification: 2,
  project_candidate_count: 6, unreviewed_candidate_count: 3, open_slot_count: 1, assignment_count: { selection: 5, shortlist: 2 },
  latest_ready_versions: [{ series_id: seriesId, output_type: 'selection', version_no: 2 }], review_issue_count: null, ...overrides });

test('workspace summary drives step statuses, output counts and Next up wording', async ({ page }) => {
  const errors = await workspace(page, summary());
  const steps = page.getByRole('navigation', { name: 'Casting workspace steps' });
  await expect(steps.getByRole('link', { name: '2 Specs 2 to clarify', exact: true })).toBeVisible();
  await expect(steps.getByRole('link', { name: '3 Candidates 6 in project', exact: true })).toBeVisible();
  await expect(steps.getByRole('link', { name: '4 Casting 1 open slot', exact: true })).toBeVisible();
  await expect(steps.getByRole('link', { name: '6 Presentation v2 ready', exact: true })).toBeVisible();
  // review_issue_count is null in this contract: the Review step shows no number at all.
  await expect(steps.getByRole('link', { name: '5 Review', exact: true })).toBeVisible();
  const outputs = page.getByRole('group', { name: 'Working output' });
  await expect(outputs.getByRole('button', { name: /^Cast Selection\s*,\s*5 assignments$/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(outputs.getByRole('button', { name: /^Cast Shortlist\s*,\s*2 assignments$/ })).toBeVisible();
  const next = page.getByRole('region', { name: 'Next up' });
  await expect(next.getByText('2 roles need clarification or a confirmed headcount.', { exact: true })).toBeVisible();
  await expect(next.getByText('3 profiles are not yet Reviewed.', { exact: true })).toBeVisible();
  await expect(next.getByText('1 slot has no candidate yet. Open slots stay Pending in a presentation.', { exact: true })).toBeVisible();
  await expect(next.getByText('Cast Selection v2 is saved · later changes are not in a saved version yet.', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('an unknown unreviewed count is never shown as zero', async ({ page }) => {
  const errors = await workspace(page, summary({ unreviewed_candidate_count: null }));
  const next = page.getByRole('region', { name: 'Next up' });
  await expect(next.getByText('Add people from the Cast Library or upload new material.', { exact: true })).toBeVisible();
  await expect(next.getByText(/not yet Reviewed/)).toHaveCount(0);
  await expect(next.getByText(/^0 /)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('an unavailable workspace summary leaves counts out instead of showing zeros', async ({ page }) => {
  const errors = await workspace(page, 'fail');
  const steps = page.getByRole('navigation', { name: 'Casting workspace steps' });
  await expect(steps.getByRole('link', { name: '3 Candidates', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Working output' }).getByRole('button', { name: 'Cast Selection', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Next up' }).getByText('Add or correct roles, requirements and slots from the brief.', { exact: true })).toBeVisible();
  await expect(page.locator('.step-status, .segment-count')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a failed summary refresh drops counts from an older workspace revision', async ({ page }) => {
  const errors = await workspace(page, summary());
  await expect(page.locator('.segment-count')).toHaveCount(2);
  await page.route(`**/api/v1/workspaces/${workspaceId}/summary`, route => route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Synthetic summary unavailable.' } } }));
  await page.route(`**/api/v1/workspaces/${workspaceId}`, route => route.fulfill({ json: { request_id: 'synthetic-summary-revision', data: { id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic summary project', logo_asset_id: null, logo_placement: 'cover', active_output: 'shortlist', row_version: 5, draft_revision: 8, has_unpublished_changes: true, created_at: stamp, updated_at: stamp } } }));
  await page.getByRole('group', { name: 'Working output' }).getByRole('button', { name: /^Cast Shortlist/ }).click();
  await expect(page.locator('.step-status, .segment-count')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Working output' }).getByRole('button', { name: 'Cast Shortlist', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('guest feedback counts come from the version summary, not the loaded page', async ({ page }) => {
  const snapshot = presentationFixture({ frames: 0 });
  const slideId = snapshot.slides[1].id; const errors: string[] = []; const reads: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const zero = { preferred: 0, maybe: 0, not_preferred: 0, comment_count: 0, unresolved_count: 0 };
  const perSlide = snapshot.slides.map(slide => slide.id === slideId ? { version_slide_id: slide.id, preferred: 4, maybe: 1, not_preferred: 2, comment_count: 9, unresolved_count: 3 } : { version_slide_id: slide.id, ...zero });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname; reads.push(path);
    const ok = (data: unknown, extra: Record<string, unknown> = {}) => route.fulfill({ json: { data, request_id: 'synthetic-feedback-summary', ...extra } });
    const access = { expires_at: '2026-11-29T00:00:00Z', series_id: snapshot.series_id, version_id: snapshot.version_id, download_enabled: true, display_name: 'Synthetic Reviewer', guest_session_id: '00000000-0000-4000-8000-000000000961' };
    if (path === '/api/v1/review/open' || path === '/api/v1/review/session') return ok(access);
    if (path === '/api/v1/review/presentation') return ok({ id: snapshot.version_id, series_id: snapshot.series_id, version_no: 1, title: snapshot.cover.title, cover: snapshot.cover,
      output_type: 'selection', template_version: '1.1.0', template_content_hash: snapshot.template.content_sha256, status: 'ready', slides: snapshot.slides, created_at: snapshot.created_at, download_enabled: true });
    // One loaded page that is not the whole story (next_cursor present).
    if (path === `/api/v1/review/versions/${snapshot.version_id}/feedback`) return ok({ version_id: snapshot.version_id, comments: [], preferences: [], page: { next_cursor: '00000000-0000-4000-8000-000000000962' } });
    if (path === `/api/v1/review/versions/${snapshot.version_id}/feedback/summary`) return ok({ version_id: snapshot.version_id, per_slide: perSlide,
      totals: { preferred: 4, maybe: 1, not_preferred: 2, comment_count: 9, unresolved_count: 3 } });
    return notFound(route);
  });
  await page.goto(`/r/${'q'.repeat(43)}`);
  await page.getByRole('button', { name: /^Slide 2:/ }).click();
  const counts = page.locator('.review-preference-counts');
  await expect(counts.getByRole('definition').nth(0)).toHaveText('4');
  await expect(counts.getByRole('definition').nth(2)).toHaveText('2');
  await expect(counts.getByText('9 · 3 unresolved')).toBeVisible();
  await expect(page.getByLabel('Version 1 feedback totals')).toHaveText('Version 1 (shared feedback): 4 preferred · 1 maybe · 2 not preferred · 9 comments (3 unresolved)');
  await expect(page.getByText('Counts include loaded responses.', { exact: false })).toHaveCount(0);
  // The guest reads only its own review route; the signed-in summary is never requested.
  expect(reads.filter(path => path.endsWith('/feedback/summary')).every(path => path.startsWith('/api/v1/review/'))).toBe(true);
  expect(errors).toEqual([]);
});

const batchId = '97900000-0000-4000-8000-000000000001';
const otherBatch = '97900000-0000-4000-8000-000000000002';
const job = (n: number, batch: string, status: CentralJob['status']): CentralJob => ({ id: `98900000-0000-4000-8000-00000000000${n}`, workspace_id: workspaceId, kind: 'candidate_scan', status, stage: 'transcribe', attempt: 1,
  progress_completed: 0, progress_total: null, batch_id: batch, input_asset_id: null, resource_id: null,
  error: status === 'failed' ? { code: 'SOURCE_UNREADABLE', message: 'synthetic', details: {}, retryable: false } : null, row_version: 1, created_at: stamp, updated_at: stamp }) as CentralJob;

test('Open batch filters by batch_id, keeps the filter across pages and shows non-retryable guidance', async ({ page }) => {
  const errors: string[] = []; const queries: string[] = []; let foreign = false;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    const ok = (data: unknown, extra: Record<string, unknown> = {}) => route.fulfill({ json: { request_id: 'synthetic-batch', data, ...extra } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-operator', name: 'Synthetic Operator', capabilities: ['workspaces.read', 'operations.retry'], upload_purposes: [] }, actors: [] });
    if (path === '/api/v1/jobs') {
      queries.push(url.search);
      if (!url.searchParams.has('batch_id')) return ok([job(1, batchId, 'succeeded')], { page: { next_cursor: null } });
      expect(url.searchParams.get('batch_id')).toBe(batchId);
      if (foreign) return ok([job(5, otherBatch, 'running')], { page: { next_cursor: null } });
      if (!url.searchParams.has('cursor')) return ok([job(1, batchId, 'succeeded'), job(2, batchId, 'failed')], { page: { next_cursor: job(2, batchId, 'failed').id } });
      return ok([job(3, batchId, 'running')], { page: { next_cursor: null } });
    }
    const found = [1, 2, 3].map(n => job(n, batchId, n === 2 ? 'failed' : 'succeeded')).find(row => path === `/api/v1/jobs/${row.id}`); if (found) return ok(found);
    return notFound(route);
  });
  await page.goto('/processing');
  await page.getByRole('link', { name: 'Open batch', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Processing batch', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`batch=${batchId}`));
  await expect(page.getByText('2 loaded jobs', { exact: true })).toBeVisible();
  // A non-retryable source error shows the replacement guidance and no Retry.
  await page.getByRole('link', { name: 'Candidate scan', exact: true }).nth(1).click();
  const drawer = page.getByRole('dialog', { name: 'Processing details' });
  await expect(drawer.getByText('The supplied source could not be read. Replace it with a valid supported file, or enter the available information manually.', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Retry failed processing' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(new RegExp(`batch=${batchId}`));
  await page.getByRole('link', { name: 'Next jobs', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`batch=${batchId}.*cursor=`));
  await expect(page.getByText('1 loaded job', { exact: true })).toBeVisible();
  expect(queries.filter(query => query.includes('batch_id')).every(query => query.includes(`batch_id=${batchId}`))).toBe(true);
  // A row from another batch is refused rather than shown under this batch.
  foreign = true;
  await page.getByRole('button', { name: 'Refresh jobs', exact: true }).click();
  await expect(page.getByText('Processing could not be refreshed. Try again to read the saved state.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '← All processing jobs', exact: true }).click();
  await expect(page).not.toHaveURL(/batch=/);
  expect(errors).toEqual([]);
});
