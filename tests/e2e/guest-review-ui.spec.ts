import { expect, test } from '@playwright/test';
import { presentationFixture } from '../fixtures/presentation';

test('guest opens without internal sign-in and feedback stays on the viewed version', async ({ page }) => {
  const snapshot = presentationFixture({ frames: 0 });
  const sessionId = '00000000-0000-4000-8000-000000000901';
  const nextId = '00000000-0000-4000-8000-000000000902';
  let named = false, newer = false;
  const writes: unknown[] = [];
  const preferences: unknown[] = [];
  const external = () => ({ id: newer ? nextId : snapshot.version_id, series_id: snapshot.series_id, version_no: newer ? 2 : 1,
    title: snapshot.cover.title, cover: snapshot.cover, output_type: 'selection', template_version: '1.1.0',
    template_content_hash: snapshot.template.content_sha256, status: 'ready', slides: snapshot.slides.map(s => ({ ...s, version_id: newer ? nextId : snapshot.version_id })),
    created_at: snapshot.created_at, download_enabled: true });
  const access = () => ({ expires_at: '2026-11-29T00:00:00Z', series_id: snapshot.series_id, version_id: snapshot.version_id,
    download_enabled: true, display_name: named ? 'Synthetic Reviewer' : null, guest_session_id: sessionId });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { data, request_id: 'synthetic-guest' } });
    if (path === '/api/v1/review/open' || path === '/api/v1/review/session') return ok(access());
    if (path === '/api/v1/review/presentation') return ok(external());
    if (path === '/api/v1/review/identity') { expect(request.method()).toBe('PUT'); named = true; return ok(access()); }
    if (path.endsWith('/feedback')) return ok({ version_id: snapshot.version_id, comments: [], preferences, page: { next_cursor: null } });
    if (path.endsWith('/preferences')) {
      expect(request.method()).toBe('PUT');
      expect(request.postDataJSON()).toEqual({ version_slide_id: snapshot.slides[1].id, value: 'preferred' });
      const preference = { id: '00000000-0000-4000-8000-000000000904', version_slide_id: snapshot.slides[1].id,
        guest_session_id: sessionId, author_display_name: 'Synthetic Reviewer', value: 'preferred', row_version: 1, updated_at: snapshot.created_at };
      preferences.push(preference); return ok({ preference, cleared: false });
    }
    if (path.endsWith('/comments') && request.method() === 'POST') {
      writes.push({ path, body: request.postDataJSON(), context: request.headers()['x-review-context'] });
      return ok({ id: '00000000-0000-4000-8000-000000000903', version_id: snapshot.version_id, version_slide_id: snapshot.slides[1].id,
        guest_session_id: sessionId, author_display_name: 'Synthetic Reviewer', company: null, visibility: 'external', body: request.postDataJSON().body,
        parent_comment_id: null, resolved: false, row_version: 1, created_at: snapshot.created_at, updated_at: snapshot.created_at });
    }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto(`/r/${'a'.repeat(43)}`);
  await expect(page.getByRole('heading', { name: 'Review presentation', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/r/review\\?session=${sessionId}`));
  await page.getByRole('button', { name: /Slide 2:/ }).click();
  await page.getByRole('button', { name: 'Add feedback', exact: true }).click();
  await expect(page.getByLabel('Your name', { exact: true })).toBeVisible();
  await page.getByLabel('Your name', { exact: true }).fill('Synthetic Reviewer');
  await page.getByRole('button', { name: 'Continue to feedback', exact: true }).click();
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill('Synthetic version-one feedback.');
  await page.getByRole('button', { name: 'Preferred', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Preferred', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Comment', exact: true })).toHaveValue('Synthetic version-one feedback.');
  newer = true;
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(page.getByText('A new version is available.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ path: `/api/v1/review/versions/${snapshot.version_id}/comments`,
    body: { version_slide_id: snapshot.slides[1].id, body: 'Synthetic version-one feedback.' }, context: sessionId });
  await expect(page.getByText('Viewing version 1', { exact: true })).toBeVisible();
});

test('invalid guest link is neutral and mobile Preparing requires no identity', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let ready = false;
  await page.route('**/api/v1/review/**', route => {
    if (!ready) return route.fulfill({ status: 404, json: { error: { code: 'REVIEW_UNAVAILABLE', message: 'Unavailable' } } });
    const data = new URL(route.request().url()).pathname.endsWith('/presentation') ? null : {
      expires_at: '2026-11-29T00:00:00Z', series_id: '00000000-0000-4000-8000-000000000910', version_id: null,
      download_enabled: true, display_name: null, guest_session_id: '00000000-0000-4000-8000-000000000911' };
    return route.fulfill({ json: { data, request_id: 'synthetic-preparing' } });
  });
  await page.goto(`/r/${'b'.repeat(43)}`);
  await expect(page.getByRole('heading', { name: 'This review link is no longer available.', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Synthetic Project/ })).toHaveCount(0);
  ready = true;
  await page.goto(`/r/${'c'.repeat(43)}`);
  await expect(page.getByRole('heading', { name: 'Your presentation is being prepared', exact: true })).toBeVisible();
  await expect(page.getByLabel('Your name', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
