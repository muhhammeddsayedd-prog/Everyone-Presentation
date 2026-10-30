import { expect, test } from '@playwright/test';
import { presentationFixture, presentationId, presentationVersionFixture } from '../fixtures/presentation';

test('sharing keeps the same create request through lost acknowledgement and denial', async ({ page }) => {
  const snapshot = presentationFixture({ frames: 0 }); snapshot.audience_snapshot.scope = 'external';
  const version = presentationVersionFixture(snapshot), attempts: { key: string | undefined; body: unknown }[] = [];
  let allocations = 0;
  const link = { id: presentationId(801), series_id: snapshot.series_id, label: '', expires_at: '2026-11-29T00:00:00Z',
    download_enabled: true, revoked_at: null, latest_ready_version_id: version.id, row_version: 1, created_at: snapshot.created_at };
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { data, request_id: 'synthetic-sharing', page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: presentationId(800), name: 'Synthetic Producer', capabilities: ['review_links.manage', 'workspaces.read', 'workspaces.write'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/presentation-series/${snapshot.series_id}`) return ok({ id: snapshot.series_id, workspace_id: snapshot.workspace_id, output_type: 'selection', audience_snapshot: snapshot.audience_snapshot, title: snapshot.cover.title, latest_ready_version_id: version.id });
    if (path.endsWith('/versions')) return ok([version]);
    if (path.endsWith('/feedback')) return ok({ version_id: version.id, comments: [], preferences: [], page: { next_cursor: null } });
    if (path === '/api/v1/review-links' && request.method() === 'GET') return ok(allocations ? [link] : []);
    if (path === '/api/v1/review-links' && request.method() === 'POST') {
      attempts.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() });
      if (attempts.length === 1) { allocations++; return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Synthetic lost acknowledgement' } } }); }
      if (attempts.length === 2) return route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN', message: 'Synthetic temporary denial' } } });
      return ok({ link, url: `${new URL(request.url()).origin}/r/${'d'.repeat(43)}`, token: 'd'.repeat(43) });
    }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic unavailable route' } } });
  });
  await page.goto(`/presentations/series/${snapshot.series_id}/sharing`);
  await expect(page.getByRole('heading', { name: 'Share and review', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create review link', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm link request', exact: true })).toBeVisible();
  await expect(page.getByLabel('Link label', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Confirm link request', exact: true }).click();
  await expect(page.getByText(/Synthetic temporary denial/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create review link', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Confirm link request', exact: true }).click();
  await expect(page.getByLabel('New review URL', { exact: true })).toHaveValue(new RegExp(`/r/${'d'.repeat(43)}$`));
  expect(allocations).toBe(1); expect(attempts).toHaveLength(3);
  expect(attempts[0]).toEqual(attempts[1]); expect(attempts[0]).toEqual(attempts[2]);
  expect(attempts[0].body).toEqual({ series_id: snapshot.series_id, label: '', download_enabled: true });
});

test('guest frame retry and PDF acknowledgement retain context and download disable keeps viewing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const snapshot = presentationFixture({ frames: 1 }), sessionId = presentationId(820), exportId = presentationId(821);
  let imageAvailable = false, downloadEnabled = true, prepareCalls = 0, polls = 0;
  const attempts: { key: string | undefined; path: string }[] = [];
  const status = () => ({ id: exportId, version_id: snapshot.version_id, review_link_id: presentationId(822), template_version: '1.1.0', export_revision: 1,
    status: polls > 1 ? 'ready' : 'queued', pdf_asset_id: polls > 1 ? presentationId(823) : null, job_id: presentationId(824), created_at: snapshot.created_at, ready_at: null, failure_code: null });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { data, request_id: 'synthetic-export' } });
    if (path === '/api/v1/review/open' || path === '/api/v1/review/session') return ok({ expires_at: '2026-11-29T00:00:00Z', series_id: snapshot.series_id, version_id: snapshot.version_id, download_enabled: downloadEnabled, display_name: null, guest_session_id: sessionId });
    if (path === '/api/v1/review/presentation') return ok({ id: snapshot.version_id, series_id: snapshot.series_id, version_no: 1, title: snapshot.cover.title, output_type: 'selection',
      status: 'ready', slides: snapshot.slides, cover: snapshot.cover, template_version: '1.1.0', template_content_hash: snapshot.template.content_sha256, created_at: snapshot.created_at, download_enabled: downloadEnabled });
    if (path.endsWith('/feedback')) return ok({ version_id: snapshot.version_id, comments: [], preferences: [], page: { next_cursor: null } });
    if (path.endsWith('/content')) {
      expect(request.headers()['x-review-context']).toBe(sessionId);
      if (!imageAvailable) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=', 'base64') });
    }
    if (path.endsWith('/pdf-exports') && request.method() === 'POST') {
      prepareCalls++; attempts.push({ key: request.headers()['idempotency-key'], path });
      if (prepareCalls === 1) return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Synthetic lost PDF acknowledgement' } } });
      if (prepareCalls === 2) return route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN', message: 'Synthetic temporary denial' } } });
      return ok({ export: status(), job_id: presentationId(824), cached: true });
    }
    if (path === `/api/v1/review/pdf-exports/${exportId}`) { polls++; return ok(status()); }
    if (path.endsWith('/download')) { expect(request.method()).toBe('POST'); return ok({ version_id: snapshot.version_id, download_url: `/api/v1/review/pdf-exports/${exportId}/content?review_context=${sessionId}`, expires_at: '2026-11-29T00:00:00Z', filename: 'synthetic.pdf', size_bytes: 12 }); }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic unavailable route' } } });
  });
  await page.goto(`/r/${'e'.repeat(43)}`);
  await page.getByRole('button', { name: /Slide 2:/ }).click();
  await expect(page.getByRole('button', { name: 'Retry image', exact: true })).toBeVisible();
  imageAvailable = true;
  await page.getByRole('button', { name: 'Retry image', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Candidate frame 1 of 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare PDF', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm PDF request', exact: true }).click();
  await expect(page.getByText(/Synthetic temporary denial/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm PDF request', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download guest PDF', exact: true })).toBeVisible();
  expect(attempts).toHaveLength(3); expect(attempts[0]).toEqual(attempts[1]); expect(attempts[0]).toEqual(attempts[2]);
  downloadEnabled = false;
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(page.getByText('PDF downloads are disabled for this link.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download guest PDF', exact: true })).toHaveCount(0);
  await expect(page.getByText('Viewing version 1', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
