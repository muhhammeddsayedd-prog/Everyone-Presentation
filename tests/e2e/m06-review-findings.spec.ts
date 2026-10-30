import { expect, test, type Page, type Request } from '@playwright/test';
import { presentationFixture, presentationId } from '../fixtures/presentation';

const sessionId = presentationId(950), nextId = presentationId(951), exportId = presentationId(952);
const snapshot = presentationFixture({ frames: 0 });
function external(number = 1) {
  const versionId = number === 1 ? snapshot.version_id : nextId;
  return { id: versionId, series_id: snapshot.series_id, version_no: number, title: snapshot.cover.title, cover: snapshot.cover,
    output_type: 'selection', status: 'ready', template_version: '1.1.0', template_content_hash: snapshot.template.content_sha256,
    created_at: snapshot.created_at, download_enabled: true,
    slides: snapshot.slides.map(slide => ({ id: number === 1 ? slide.id : presentationId(960 + slide.order), version_id: versionId, order: slide.order,
      kind: slide.kind, assignment_id: slide.assignment_id, candidate_id: slide.candidate_id, role_label: slide.role_label,
      role_category: slide.role_category, slot_label: slide.slot_label, position: slide.position, fields: slide.fields, requirements: slide.requirements,
      frame_asset_ids: slide.frame_asset_ids, video_asset_id: slide.video_asset_id, logo_asset_id: slide.logo_asset_id })) };
}
function access(version = 1) { return { expires_at: '2026-11-29T00:00:00Z', series_id: snapshot.series_id, version_id: version === 1 ? snapshot.version_id : nextId,
  download_enabled: true, display_name: null, guest_session_id: sessionId }; }
function queued() { return { id: exportId, version_id: snapshot.version_id, review_link_id: presentationId(953), template_version: '1.1.0', export_revision: 1,
  status: 'queued', pdf_asset_id: null, job_id: presentationId(954), created_at: snapshot.created_at, ready_at: null, failure_code: null }; }
function deferred() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
async function beforeUnloadPrevented(page: Page) {
  return page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
}
async function allSlideButtonsDisabled(page: Page) { return page.getByRole('navigation', { name: 'Shared presentation slides', exact: true }).getByRole('button').evaluateAll(buttons => buttons.length > 0 && buttons.every(button => (button as HTMLButtonElement).disabled)); }
const entry = `/r/${Buffer.alloc(32, 23).toString('base64url')}`;

test('PDF busy and uncertain intent locks slide/version/unload navigation until the same request is acknowledged', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const first = deferred(); const attempts: { key: string | undefined; path: string; body: string | null }[] = []; let newer = false, allocations = 0;
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-pdf-navigation', data } });
    if (path.endsWith('/review/open') || path.endsWith('/review/session')) return ok(access(newer ? 2 : 1));
    if (path.endsWith('/review/presentation')) return ok(external(newer ? 2 : 1));
    if (path.endsWith('/feedback')) return ok({ version_id: path.includes(nextId) ? nextId : snapshot.version_id, comments: [], preferences: [], page: { next_cursor: null } });
    if (path.endsWith('/pdf-exports') && request.method() === 'POST') {
      attempts.push({ key: request.headers()['idempotency-key'], path, body: request.postData() });
      if (attempts.length === 1) { allocations++; await first.promise; return route.fulfill({ status: 503, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Synthetic lost PDF acknowledgement' } } }); }
      if (attempts.length === 2) return route.fulfill({ status: 403, json: { error: { code: 'ACCESS_DENIED', message: 'Synthetic temporary PDF denial' } } });
      return ok({ export: queued(), job_id: presentationId(954), cached: false });
    }
    if (path === `/api/v1/review/pdf-exports/${exportId}`) return ok(queued());
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Synthetic unavailable route' } } });
  });
  try {
    await page.goto(entry); await expect(page.getByText('Viewing version 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Prepare PDF', exact: true }).click(); await expect.poll(() => attempts.length).toBe(1);
    await expect.soft.poll(() => allSlideButtonsDisabled(page)).toBe(true);
    await expect.soft.poll(() => beforeUnloadPrevented(page)).toBe(true);
    first.release(); await expect(page.getByRole('button', { name: 'Confirm PDF request', exact: true })).toBeVisible();
    newer = true; await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open version 2', exact: true })).toBeVisible();
    await expect.soft.poll(() => allSlideButtonsDisabled(page)).toBe(true);
    await expect.soft(page.getByRole('button', { name: 'Open version 2', exact: true })).toBeDisabled();
    await expect.soft.poll(() => beforeUnloadPrevented(page)).toBe(true);
    await page.getByRole('button', { name: 'Confirm PDF request', exact: true }).click(); await expect(page.getByText(/Synthetic temporary PDF denial/u)).toBeVisible();
    await expect.soft.poll(() => allSlideButtonsDisabled(page)).toBe(true);
    await expect.soft(page.getByRole('button', { name: 'Open version 2', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Confirm PDF request', exact: true }).click();
    await expect(page.getByText('Preparing this version’s PDF. You can continue reviewing.', { exact: true })).toBeVisible();
    await expect.poll(() => allSlideButtonsDisabled(page)).toBe(false); await expect.poll(() => beforeUnloadPrevented(page)).toBe(false);
    await expect(page.getByRole('button', { name: 'Open version 2', exact: true })).toBeEnabled();
    expect(attempts).toHaveLength(3); expect(attempts[0]).toEqual(attempts[1]); expect(attempts[0]).toEqual(attempts[2]); expect(allocations).toBe(1);
    await page.getByRole('button', { name: /Slide 2:/u }).click(); await expect(page.getByRole('status').filter({ hasText: /^Slide 2 of /u })).toBeVisible();
    await page.getByRole('button', { name: 'Open version 2', exact: true }).click(); await expect(page.getByText('Viewing version 2', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { first.release(); }
});

test('a delayed older update response cannot offer a downgrade after a newer check and version switch', async ({ page }) => {
  const old = deferred(); let holdNext = false, newer = false; let delayedRequest: Request | null = null;
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-update-order', data } });
    if (path.endsWith('/review/open') || path.endsWith('/review/session')) return ok(access(newer ? 2 : 1));
    if (path.endsWith('/review/presentation')) {
      if (holdNext) { holdNext = false; delayedRequest = request; await old.promise; return ok(external(1)); }
      return ok(external(newer ? 2 : 1));
    }
    if (path.endsWith('/feedback')) return ok({ version_id: path.includes(nextId) ? nextId : snapshot.version_id, comments: [], preferences: [], page: { next_cursor: null } });
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Synthetic unavailable route' } } });
  });
  try {
    await page.goto(entry); await expect(page.getByText('Viewing version 1', { exact: true })).toBeVisible();
    holdNext = true; await page.getByRole('button', { name: 'Check for updates', exact: true }).click(); await expect.poll(() => delayedRequest !== null).toBe(true);
    newer = true;
    await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open version 2', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Open version 2', exact: true }).click();
    await expect(page.getByText('Viewing version 2', { exact: true })).toBeVisible();
    const response = page.waitForResponse(value => value.request() === delayedRequest); old.release(); await (await response).finished();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole('button', { name: 'Open version 1', exact: true })).toHaveCount(0); await expect(page.getByText('Viewing version 2', { exact: true })).toBeVisible();
  } finally { old.release(); }
});

test('a lower latest version number is ignored rather than offered as a new version', async ({ page }) => {
  let latest = 2;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-no-downgrade', data } });
    if (path.endsWith('/review/open') || path.endsWith('/review/session')) return ok(access(latest));
    if (path.endsWith('/review/presentation')) return ok(external(latest));
    if (path.endsWith('/feedback')) return ok({ version_id: nextId, comments: [], preferences: [], page: { next_cursor: null } });
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Synthetic unavailable route' } } });
  });
  await page.goto(entry); await expect(page.getByText('Viewing version 2', { exact: true })).toBeVisible();
  latest = 1; const refreshed = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/review/presentation'));
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click(); await (await refreshed).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole('button', { name: 'Open version 1', exact: true })).toHaveCount(0); await expect(page.getByText('Viewing version 2', { exact: true })).toBeVisible();
});

test('checking the same version identity never swaps already viewed frozen content', async ({ page }) => {
  let changed = false;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-fixed-content', data } });
    if (path.endsWith('/review/open') || path.endsWith('/review/session')) return ok(access());
    if (path.endsWith('/review/presentation')) {
      const value = structuredClone(external());
      if (changed) {
        value.cover.project_name = 'Unexpected mutable project'; value.title = value.cover.title = 'Unexpected mutable title';
        if (value.slides[1].fields) value.slides[1].fields.name_or_id = 'Unexpected mutable candidate';
      }
      return route.fulfill({ headers: { 'X-Synthetic-Frozen-Check': changed ? 'changed' : 'original' }, json: { request_id: 'synthetic-fixed-content', data: value } });
    }
    if (path.endsWith('/feedback')) return ok({ version_id: snapshot.version_id, comments: [], preferences: [], page: { next_cursor: null } });
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Synthetic unavailable route' } } });
  });
  await page.goto(entry); await expect(page.getByRole('heading', { name: snapshot.cover.project_name, exact: true })).toBeVisible();
  changed = true; const response = page.waitForResponse(value => value.headers()['x-synthetic-frozen-check'] === 'changed');
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click(); await (await response).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole('heading', { name: snapshot.cover.project_name, exact: true })).toBeVisible();
  await expect(page.getByText('Unexpected mutable title', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Open version /u })).toHaveCount(0);
  await page.getByRole('button', { name: /Slide 2:/u }).click(); await expect(page.getByText('Synthetic Candidate', { exact: true })).toBeVisible();
  await expect(page.getByText('Unexpected mutable candidate', { exact: true })).toHaveCount(0);
});

test('a cancelled export is terminal and offers no failed-job retry action', async ({ page }) => {
  let prepares = 0;
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-cancelled-export', data } });
    if (path.endsWith('/review/open') || path.endsWith('/review/session')) return ok(access());
    if (path.endsWith('/review/presentation')) return ok(external());
    if (path.endsWith('/feedback')) return ok({ version_id: snapshot.version_id, comments: [], preferences: [], page: { next_cursor: null } });
    if (path.endsWith('/pdf-exports') && request.method() === 'POST') { prepares++; return ok({ export: queued(), job_id: presentationId(954), cached: false }); }
    if (path === `/api/v1/review/pdf-exports/${exportId}`) return ok({ ...queued(), status: 'failed', failure_code: 'JOB_CANCELLED' });
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Synthetic unavailable route' } } });
  });
  await page.goto(entry); await expect(page.getByText('Viewing version 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare PDF', exact: true }).click();
  await expect(page.getByText(/PDF preparation (?:was )?cancelled/iu)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry PDF preparation', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Prepare PDF', exact: true })).toHaveCount(0);
  expect(prepares).toBe(1); await expect.poll(() => allSlideButtonsDisabled(page)).toBe(false); await expect.poll(() => beforeUnloadPrevented(page)).toBe(false);
});
