import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { presentationFixture, presentationId } from '../fixtures/presentation';

const snapshot = presentationFixture({ frames: 0 }), sessionId = presentationId(990), exportId = presentationId(991);
const nextId = presentationId(992), credential = Buffer.alloc(32, 29).toString('base64url');
const contentPath = `/api/v1/review/pdf-exports/${exportId}/content?review_context=${sessionId}`;
const pdf = Buffer.from('%PDF-1.7\nSynthetic bounded PDF download\n%%EOF\n');
const errorText = 'The PDF download could not be completed. Try again or ask the producer for a current link.';
function deferred() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
async function fixture(page: Page, initialStatus: number, hold?: ReturnType<typeof deferred>) {
  let status = initialStatus, prepareCalls = 0, gets = 0, newer = false;
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    (window as Window & { syntheticPdfFetches?: unknown[] }).syntheticPdfFetches = [];
    window.fetch = (input, init) => {
      const path = String(input instanceof Request ? input.url : input);
      if (path.includes('/pdf-exports/') && path.includes('/content')) (window as Window & { syntheticPdfFetches?: unknown[] }).syntheticPdfFetches!.push({ cache: init?.cache, credentials: init?.credentials, redirect: init?.redirect, referrerPolicy: init?.referrerPolicy });
      return original(input, init);
    };
  });
  const saved = () => ({ id: newer ? nextId : snapshot.version_id, series_id: snapshot.series_id, version_no: newer ? 2 : 1,
    title: snapshot.cover.title, cover: snapshot.cover, output_type: 'selection', status: 'ready', template_version: '1.1.0',
    template_content_hash: snapshot.template.content_sha256, slides: snapshot.slides.map(slide => ({ ...slide, version_id: newer ? nextId : snapshot.version_id })), created_at: snapshot.created_at, download_enabled: true });
  const exported = { id: exportId, version_id: snapshot.version_id, review_link_id: presentationId(993), template_version: '1.1.0', export_revision: 1,
    status: 'ready', pdf_asset_id: presentationId(994), job_id: presentationId(995), created_at: snapshot.created_at, ready_at: snapshot.created_at, failure_code: null };
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const ok = (data: unknown, headers?: Record<string, string>) => route.fulfill({ json: { data, request_id: 'synthetic-pdf-download' }, headers });
    if (path.endsWith('/review/open') || path.endsWith('/review/session')) return ok({ expires_at: '2026-11-29T00:00:00Z', guest_session_id: sessionId, series_id: snapshot.series_id, version_id: snapshot.version_id, display_name: null, download_enabled: true }, { 'Set-Cookie': `eps_review_${sessionId.replaceAll('-', '')}=${credential}; Path=/api/v1/review; HttpOnly; SameSite=Strict` });
    if (path.endsWith('/review/presentation')) return ok(saved());
    if (path.endsWith('/feedback')) return ok({ version_id: snapshot.version_id, comments: [], preferences: [], page: { next_cursor: null } });
    if (path.endsWith('/pdf-exports') && request.method() === 'POST') { prepareCalls++; return ok({ export: exported, job_id: exported.job_id, cached: false }); }
    if (path === `/api/v1/review/pdf-exports/${exportId}`) return ok(exported);
    if (path.endsWith('/download')) return ok({ version_id: snapshot.version_id, download_url: contentPath, expires_at: '2026-11-29T00:00:00Z', filename: '../../provider.json', size_bytes: pdf.length });
    if (path === `/api/v1/review/pdf-exports/${exportId}/content`) {
      gets++; expect(url.search).toBe(`?review_context=${sessionId}`); expect(request.headers().cookie).toContain(`eps_review_${sessionId.replaceAll('-', '')}=${credential}`);
      if (hold) await hold.promise;
      if (status !== 200) return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { message: 'PRIVATE_PROVIDER_BODY_MUST_NOT_RENDER' } }) });
      return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(pdf.length) }, body: pdf });
    }
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Synthetic unavailable route' } } });
  });
  await page.goto(`/r/${credential}`); await page.getByRole('button', { name: 'Prepare PDF', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download guest PDF', exact: true })).toHaveAttribute('href', contentPath);
  return { get gets() { return gets; }, get prepareCalls() { return prepareCalls; }, valid() { status = 200; }, async offerNewer() { newer = true; await page.getByRole('button', { name: 'Check for updates', exact: true }).click(); await expect(page.getByRole('button', { name: 'Open version 2', exact: true })).toBeVisible(); } };
}

for (const status of [503, 403]) test(`guest PDF error ${status} saves no artifact and retries the same export safely`, async ({ page }) => {
  const downloads: unknown[] = []; page.on('download', item => downloads.push(item));
  const state = await fixture(page, status); await page.getByRole('link', { name: 'Download guest PDF', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: errorText })).toBeVisible(); expect(downloads).toHaveLength(0);
  await expect(page.locator('body')).not.toContainText('PRIVATE_PROVIDER_BODY_MUST_NOT_RENDER');
  await expect(page.getByRole('link', { name: 'Download guest PDF', exact: true })).toHaveAttribute('href', contentPath);
  state.valid(); const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Try again', exact: true }).click();
  const file = await downloaded; expect(file.suggestedFilename()).toBe(`everyone-review-${exportId}.pdf`);
  expect(await readFile((await file.path())!)).toEqual(pdf); expect(state.gets).toBe(2); expect(state.prepareCalls).toBe(1);
});

test('keyboard PDF download locks navigation while transferring and saves only validated bytes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const hold = deferred(), state = await fixture(page, 200, hold);
  try {
    await state.offerNewer(); const downloaded = page.waitForEvent('download');
    const link = page.getByRole('link', { name: 'Download guest PDF', exact: true }); await link.focus(); await link.press('Enter'); await expect.poll(() => state.gets).toBe(1);
    await expect.soft(page.getByRole('button', { name: 'Open version 2', exact: true })).toBeDisabled();
    await expect.soft.poll(() => page.getByRole('navigation', { name: 'Shared presentation slides', exact: true }).getByRole('button').evaluateAll(buttons => buttons.every(button => (button as HTMLButtonElement).disabled))).toBe(true);
    await expect.soft.poll(() => page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; })).toBe(true);
    hold.release(); const file = await downloaded; expect(await readFile((await file.path())!)).toEqual(pdf);
    expect(file.suggestedFilename()).toBe(`everyone-review-${exportId}.pdf`); await expect(page.getByRole('button', { name: 'Open version 2', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => (window as Window & { syntheticPdfFetches?: unknown[] }).syntheticPdfFetches)).toEqual([{ cache: 'no-store', credentials: 'same-origin', redirect: 'error', referrerPolicy: 'no-referrer' }]);
  } finally { hold.release(); }
});
