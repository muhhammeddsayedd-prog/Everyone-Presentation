import { expect, test } from '@playwright/test';
import { presentationFixture, presentationId } from '../fixtures/presentation';

const snapshot = presentationFixture({ frames: 0 });
const sessionId = presentationId(980), commentId = presentationId(981);
const access = { expires_at: '2026-11-29T00:00:00Z', series_id: snapshot.series_id, version_id: snapshot.version_id,
  download_enabled: true, display_name: 'Synthetic Rate Reviewer', guest_session_id: sessionId };
const version = { id: snapshot.version_id, series_id: snapshot.series_id, version_no: 1, title: snapshot.cover.title, cover: snapshot.cover,
  output_type: 'selection', template_version: '1.1.0', template_content_hash: snapshot.template.content_sha256, status: 'ready',
  slides: snapshot.slides, created_at: snapshot.created_at, download_enabled: true };
const rateMessage = 'Too many requests. Please wait a moment, then retry the same request.';

test('a throttled guest entry explains how to retry without presenting an expired-link or sign-in state', async ({ page }) => {
  let throttled = true;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/review/open' && throttled) return route.fulfill({ status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' }, json: { error: { code: 'RATE_LIMITED', message: 'Synthetic provider rate limit', retryable: true } } });
    const data = path === '/api/v1/review/presentation' ? version : path.endsWith('/feedback')
      ? { version_id: snapshot.version_id, comments: [], preferences: [], page: { next_cursor: null } } : access;
    return route.fulfill({ json: { data, request_id: 'synthetic-rate-entry' } });
  });
  await page.goto(`/r/${Buffer.alloc(32, 64).toString('base64url')}`);
  await expect(page.getByRole('alert').filter({ hasText: rateMessage }).locator('p')).toHaveText(rateMessage);
  await expect(page.getByRole('heading', { name: 'This review link is no longer available.', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
  throttled = false; await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Viewing version 1', { exact: true })).toBeVisible();
  await expect(page.getByText(rateMessage, { exact: true })).toHaveCount(0);
});

test('a 429 comment preserves the draft and freezes navigation until the same idempotent request is acknowledged', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const attempts: { path: string; method: string; key: string | undefined; context: string | undefined; body: unknown }[] = [];
  const comments: unknown[] = [];
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { data, request_id: 'synthetic-rate-comment' } });
    if (path.endsWith('/review/open') || path.endsWith('/review/session')) return ok(access);
    if (path.endsWith('/review/presentation')) return ok(version);
    if (path.endsWith('/feedback')) return ok({ version_id: snapshot.version_id, comments, preferences: [], page: { next_cursor: null } });
    if (path.endsWith('/comments') && request.method() === 'POST') {
      attempts.push({ path, method: request.method(), key: request.headers()['idempotency-key'], context: request.headers()['x-review-context'], body: request.postDataJSON() });
      if (attempts.length === 1) return route.fulfill({ status: 429, headers: { 'Retry-After': '60' }, json: { error: { code: 'RATE_LIMITED', message: 'Synthetic temporary rate limit', retryable: true } } });
      const comment = { id: commentId, version_id: snapshot.version_id, version_slide_id: snapshot.slides[1].id, guest_session_id: sessionId,
        author_display_name: access.display_name, company: null, visibility: 'external', body: request.postDataJSON().body,
        parent_comment_id: null, resolved: false, row_version: 1, created_at: snapshot.created_at, updated_at: snapshot.created_at };
      comments.push(comment); return ok(comment);
    }
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto(`/r/${Buffer.alloc(32, 65).toString('base64url')}`);
  await expect(page.getByText('Viewing version 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Slide 2:/u }).click(); await page.getByRole('button', { name: 'Add feedback', exact: true }).click();
  const draft = 'Synthetic rate-limited feedback remains on this exact assignment.';
  const composer = page.getByRole('textbox', { name: 'Comment', exact: true });
  await composer.fill(draft); await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Feedback on version 1', exact: true }).getByRole('alert').locator('p')).toHaveText('The change may have been saved. Confirm the same request. ' + rateMessage);
  await expect(composer).toHaveValue(draft); await expect(composer).toBeDisabled();
  await expect(page.getByRole('button', { name: /Slide 3:/u })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Post comment', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Confirm feedback request', exact: true }).click();
  await expect(page.getByText(draft, { exact: true })).toBeVisible(); await expect(composer).toHaveValue(''); await expect(composer).toBeEnabled();
  await expect(page.getByRole('button', { name: /Slide 3:/u })).toBeEnabled();
  expect(attempts).toHaveLength(2); expect(attempts[0]).toEqual(attempts[1]); expect(attempts[0].key).toBeTruthy();
  expect(attempts[0].context).toBe(sessionId); expect(comments).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
