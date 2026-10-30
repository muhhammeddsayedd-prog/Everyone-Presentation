import { test, expect, type Page } from '@playwright/test';
import type { CentralJob } from '@eps/central';

// Controlled HTTP/DOM coverage only. No real account, SQL, provider, storage or
// worker is contacted, and these in-memory jobs are not pipeline evidence.
const jobId = '92900000-0000-4000-8000-000000000001';
const nextJobId = '92900000-0000-4000-8000-000000000002';
const workspaceId = '93900000-0000-4000-8000-000000000001';
const projectId = '94900000-0000-4000-8000-000000000001';
const privateText = 'PRIVATE_PROVIDER_PAYLOAD_MUST_NOT_APPEAR';
function initialJob(id: string, status: CentralJob['status']): CentralJob {
  return { id, workspace_id: workspaceId, kind: 'specs_extract', status, stage: 'extract_specs', attempt: 1,
    progress_completed: 1, progress_total: 3, batch_id: null, input_asset_id: null, resource_id: null,
    error: status === 'failed' ? { code: 'DEPENDENCY_UNAVAILABLE', message: privateText, details: {}, retryable: true } : null,
    row_version: 1, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' };
}
async function controlledJobs(page: Page, options: { readOnly?: boolean; empty?: boolean; fixture?: boolean; loseRetry?: boolean; denyConfirmation?: boolean; staleCancel?: boolean } = {}) {
  const jobs = new Map([[jobId, initialJob(jobId, 'failed')], [nextJobId, { ...initialJob(nextJobId, 'running'), stage: privateText }]]);
  const reads: string[] = []; const mutations: { path: string; key: string; body: unknown }[] = []; const unexpected: string[] = [];
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const saved = new Map<string, CentralJob>(); let lost = false;
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    const envelope = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'controlled-processing-ui', data } });
    const mutationEnvelope = (job: CentralJob, action: string) => action === 'retry'
      ? envelope({ job_id: job.id, resource_id: job.resource_id, poll_url: `/api/v1/jobs/${encodeURIComponent(job.id)}`, status: job.status }, 202) : envelope(job);
    const failure = (code: string, status: number) => route.fulfill({ status, json: { request_id: 'controlled-processing-ui', error: { code, message: privateText, details: {}, retryable: true } } });
    if (path === '/api/session') return envelope({ mode: options.fixture ? 'local_fixture' : 'supabase', actor: {
      id: '91900000-0000-4000-8000-000000000001', name: 'Synthetic Processing Producer', capabilities: ['workspaces.read', ...(options.readOnly ? [] : ['operations.retry'])], upload_purposes: [] }, actors: [] });
    if (path === '/api/v1/jobs' && request.method() === 'GET') {
      reads.push(url.pathname + url.search);
      const filter = url.searchParams.get('status'); const cursor = url.searchParams.get('cursor');
      const visible = options.empty ? [] : [...jobs.values()].filter(job => !filter || job.status === filter);
      const data = cursor ? visible.filter(job => job.id > cursor) : visible.slice(0, 1);
      return route.fulfill({ json: { request_id: 'controlled-processing-ui', data, page: { next_cursor: !cursor && visible.length > 1 ? visible[0].id : null } } });
    }
    const match = /^\/api\/v1\/jobs\/([^/]+)(?:\/(retry|cancel))?$/u.exec(path);
    if (match) {
      const job = jobs.get(match[1]); if (!job) return failure('RESOURCE_NOT_FOUND', 404);
      if (request.method() === 'GET') { reads.push(path); return envelope(job); }
      if (request.method() === 'POST' && match[2]) {
        const key = request.headers()['idempotency-key']; mutations.push({ path, key, body: request.postDataJSON() });
        if (saved.has(key)) { if (options.denyConfirmation && mutations.length === 2) return failure('CAPABILITY_REQUIRED', 403); return mutationEnvelope(saved.get(key)!, match[2]); }
        if (match[2] === 'cancel' && options.staleCancel) {
          jobs.set(job.id, { ...job, status: 'succeeded', row_version: 2, progress_completed: 3 }); return failure('STALE_RESOURCE_VERSION', 409);
        }
        const next: CentralJob = { ...job, status: match[2] === 'retry' ? 'queued' : 'cancelled', error: null, row_version: job.row_version + 1 };
        jobs.set(job.id, next); saved.set(key, next);
        if (match[2] === 'retry' && options.loseRetry && !lost) { lost = true; return failure('DEPENDENCY_UNAVAILABLE', 503); }
        return mutationEnvelope(next, match[2]);
      }
    }
    if (path === `/api/v1/workspaces/${workspaceId}`) return envelope({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic workspace',
      logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 1, draft_revision: 0, has_unpublished_changes: false, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
    if (path === `/api/v1/projects/${projectId}`) return envelope({ id: projectId, name: 'Synthetic canonical project', client_id: null, client_name: null,
      client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: false });
    unexpected.push(path); return failure('CONTROLLED_ROUTE_NOT_IMPLEMENTED', 503);
  });
  return { jobs, reads, mutations, errors, unexpected };
}

test('controlled processing pages paginate/filter and show safe detail with an actual scoped workspace link', async ({ page }, testInfo) => {
  const model = await controlledJobs(page, { readOnly: true }); await page.goto('/processing');
  await expect(page.getByRole('heading', { name: 'Processing', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Next jobs', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`cursor=${jobId}`));
  await expect(page.getByText('Processing step', { exact: true })).toBeVisible();
  await page.getByLabel('Status', { exact: true }).selectOption('failed');
  await expect(page).toHaveURL(/status=failed$/u);
  await page.getByRole('link', { name: 'Specs extraction', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Processing status', exact: true })).toBeVisible();
  await expect(page.getByText('A processing dependency is temporarily unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open requirements' })).toHaveAttribute('href', `/projects/${projectId}/casting/${workspaceId}/specs`);
  await expect(page.getByRole('button', { name: 'Retry failed processing' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel processing' })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(privateText);
  for (const width of [1440, 768, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width !== 768) await page.screenshot({ path: testInfo.outputPath(`controlled-processing-${width}.png`), fullPage: true });
  }
  expect(model.mutations).toEqual([]); expect(model.unexpected).toEqual([]); expect(model.errors).toEqual([]);
});

test('controlled unknown retry keeps its frozen body/key and never creates another job', async ({ page }) => {
  const model = await controlledJobs(page, { loseRetry: true }); await page.goto(`/processing?job=${jobId}`);
  await page.getByRole('button', { name: 'Retry failed processing', exact: true }).click();
  await expect(page.locator('.notice[role="alert"]')).toContainText('could not be confirmed');
  await page.getByRole('button', { name: 'Retry this retry request', exact: true }).click();
  await expect(page.locator('.processing-detail .badge')).toHaveText('Queued');
  expect(model.mutations).toHaveLength(2); expect(model.mutations[0]).toEqual(model.mutations[1]);
  expect(model.mutations[0].body).toEqual({ row_version: 1 }); expect(model.jobs.size).toBe(2);
  await expect(page.locator('body')).not.toContainText(privateText); expect(model.errors).toEqual([]);
});

test('controlled acknowledged retry recovers a failed GET without resubmitting its confirmed intent', async ({ page }) => {
  const model = await controlledJobs(page, { loseRetry: true }); let denyReads = false; let deniedReads = 0;
  await page.route(`**/api/v1/jobs/${jobId}`, async route => {
    if (!denyReads) return route.fallback();
    deniedReads++;
    return route.fulfill({ status: 503, json: { request_id: 'controlled-read-unavailable', error: { code: 'DEPENDENCY_UNAVAILABLE', message: privateText } } });
  });
  await page.goto(`/processing?job=${jobId}`);
  await page.getByRole('button', { name: 'Retry failed processing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry this retry request', exact: true })).toBeVisible();
  denyReads = true;
  await page.getByRole('button', { name: 'Retry this retry request', exact: true }).click();
  await expect(page.getByText('Processing could not be refreshed. Try again to read the saved state.', { exact: true })).toBeVisible();
  expect(deniedReads).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Retry this retry request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry failed processing', exact: true })).toHaveCount(0);
  expect(model.mutations).toHaveLength(2); expect(model.mutations[1]).toEqual(model.mutations[0]);
  denyReads = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.processing-detail .badge')).toHaveText('Queued');
  expect(model.mutations).toHaveLength(2); expect(model.mutations[0].body).toEqual({ row_version: 1 });
  expect(model.jobs.size).toBe(2); expect(model.errors).toEqual([]); expect(model.unexpected).toEqual([]);
  await expect(page.locator('body')).not.toContainText(privateText);
});

test('controlled cancellation conflict requires explicit reload and retains completed work', async ({ page }) => {
  const model = await controlledJobs(page, { staleCancel: true }); await page.goto(`/processing?job=${nextJobId}`);
  await page.getByRole('button', { name: 'Cancel processing', exact: true }).click();
  await expect(page.getByText('Stop remaining work? Any completed work will be retained.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect(page.locator('.notice[role="alert"]')).toContainText('Reload its saved details');
  expect(model.mutations).toHaveLength(1);
  await page.getByRole('button', { name: 'Reload saved job', exact: true }).click();
  await expect(page.locator('.processing-detail .badge')).toHaveText('Completed');
  await expect(page.getByRole('button', { name: 'Cancel processing', exact: true })).toHaveCount(0);
  expect(model.jobs.get(nextJobId)?.progress_completed).toBe(3); expect(model.mutations).toHaveLength(1); expect(model.errors).toEqual([]);
});

test('controlled active detail polls durable state and stops after a confirmed completion', async ({ page }) => {
  await page.clock.install(); const model = await controlledJobs(page, { readOnly: true }); await page.goto(`/processing?job=${nextJobId}`);
  await expect(page.locator('.processing-detail .badge')).toHaveText('In progress');
  model.jobs.set(nextJobId, { ...model.jobs.get(nextJobId)!, status: 'succeeded', progress_completed: 3, row_version: 2 });
  await page.clock.fastForward(5001);
  await expect(page.locator('.processing-detail .badge')).toHaveText('Completed');
  const readCount = model.reads.length; await page.clock.fastForward(30_000);
  expect(model.reads).toHaveLength(readCount); expect(model.errors).toEqual([]);
});

test('controlled empty central state is quiet while fixture processing is explicitly unavailable', async ({ page }) => {
  const empty = await controlledJobs(page, { empty: true }); await page.goto('/processing');
  await expect(page.getByRole('heading', { name: 'No processing jobs', exact: true })).toBeVisible();
  await expect(page.locator('.notice[role="alert"]')).toHaveCount(0); expect(empty.mutations).toEqual([]);
  await page.unroute('**/api/**'); const fixture = await controlledJobs(page, { fixture: true }); await page.reload();
  await expect(page.getByRole('heading', { name: 'Processing is unavailable in this development fixture' })).toBeVisible();
  expect(fixture.reads).toEqual([]); expect(fixture.mutations).toEqual([]); expect(fixture.errors).toEqual([]);
});

test('controlled project label timeout preserves the already verified workspace destination', async ({ page }) => {
  await page.clock.install(); const model = await controlledJobs(page, { readOnly: true });
  let release: (() => void) | undefined; const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/v1/projects/${projectId}`, async route => { await wait; await route.fulfill({ status: 503, json: {} }).catch(() => undefined); });
  try {
    const requested = page.waitForRequest(request => new URL(request.url()).pathname === `/api/v1/projects/${projectId}`);
    await page.goto(`/processing?job=${jobId}`); await requested;
    await page.clock.fastForward(20_001);
    await expect(page.getByRole('link', { name: 'Open requirements' })).toHaveAttribute('href', `/projects/${projectId}/casting/${workspaceId}/specs`);
    await expect(page.getByText('Synthetic workspace', { exact: true })).toBeVisible();
    await expect(page.getByText('Finding the shared project…', { exact: true })).toHaveCount(0);
    expect(model.errors).toEqual([]);
  } finally { release?.(); }
});

test('controlled access error is distinct from an empty list and does not keep polling denied reads', async ({ page }) => {
  await page.clock.install(); const model = await controlledJobs(page, { readOnly: true, empty: true }); let denied = true; let requests = 0;
  await page.route(/\/api\/v1\/jobs\?/u, async route => {
    requests++;
    if (denied) return route.fulfill({ status: 403, json: { request_id: 'controlled-denial', error: { code: 'CAPABILITY_REQUIRED', message: privateText } } });
    return route.fallback();
  });
  await page.goto('/processing');
  await expect(page.locator('.notice[role="alert"]')).toContainText('cannot access');
  await expect(page.getByRole('heading', { name: 'No processing jobs', exact: true })).toHaveCount(0);
  const deniedReads = requests; // Development StrictMode may restart the initial read.
  await page.clock.fastForward(30_000); expect(requests).toBe(deniedReads);
  denied = false; await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No processing jobs', exact: true })).toBeVisible();
  expect(model.errors).toEqual([]); await expect(page.locator('body')).not.toContainText(privateText);
});

test('controlled stale page response cannot replace a newer status filter after unmount', async ({ page }) => {
  const model = await controlledJobs(page, { readOnly: true });
  let release: (() => void) | undefined; const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/api\/v1\/jobs\?/u, async route => {
    if (new URL(route.request().url()).searchParams.has('status')) return route.fallback();
    await wait;
    await route.fulfill({ json: { request_id: 'controlled-delayed-page', data: [model.jobs.get(nextJobId)], page: { next_cursor: null } } }).catch(() => undefined);
  });
  try {
    const requested = page.waitForRequest(request => new URL(request.url()).pathname === '/api/v1/jobs');
    await page.goto('/processing'); await requested;
    await page.getByLabel('Status', { exact: true }).selectOption('failed');
    await expect(page.locator('.processing-job-state .badge')).toHaveText('Failed');
    release?.();
    await expect(page.getByLabel('Status', { exact: true })).toHaveValue('failed');
    await expect(page.locator('.processing-job-state .badge')).toHaveText('Failed');
    await expect(page.getByText('Processing step', { exact: true })).toHaveCount(0);
    expect(model.errors).toEqual([]);
  } finally { release?.(); }
});


test('controlled unknown retry survives a later access denial with the original key and body', async ({ page }) => {
  const model = await controlledJobs(page, { loseRetry: true, denyConfirmation: true });
  await page.goto(`/processing?job=${jobId}`);
  await page.getByRole('button', { name: 'Retry failed processing', exact: true }).click();
  await page.getByRole('button', { name: 'Retry this retry request', exact: true }).click();
  await expect(page.getByText(/earlier request is still unconfirmed/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload job details', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry this retry request', exact: true }).click();
  await expect(page.locator('.processing-detail .badge')).toHaveText('Queued');
  expect(model.mutations).toHaveLength(3);
  expect(model.mutations[1]).toEqual(model.mutations[0]); expect(model.mutations[2]).toEqual(model.mutations[0]);
  expect(model.jobs.size).toBe(2); expect(model.errors).toEqual([]);
});
