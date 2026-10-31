import { expect, test, type Page } from '@playwright/test';
import { presentationFixture } from '../fixtures/presentation';

// Synthetic HTTP/DOM checks for the guest preference radio group and the
// unsent-comment guard. Guest token handling is covered by guest-review-ui.
const snapshot = presentationFixture({ frames: 0 });
const sessionId = '00000000-0000-4000-8000-000000000951';
const slideId = snapshot.slides[1].id;

async function guest(page: Page, options: { failFirstSave?: boolean } = {}) {
  let failNext = options.failFirstSave ?? false; let rowVersion = 0;
  const saves: { value: string | null; row_version?: number }[] = []; const errors: string[] = [];
  let current: { value: string; row_version: number } | null = null;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { data, request_id: 'synthetic-guest-preference' } });
    const access = { expires_at: '2026-11-29T00:00:00Z', series_id: snapshot.series_id, version_id: snapshot.version_id, download_enabled: true, display_name: 'Synthetic Reviewer', guest_session_id: sessionId };
    if (path === '/api/v1/review/open' || path === '/api/v1/review/session') return ok(access);
    if (path === '/api/v1/review/presentation') return ok({ id: snapshot.version_id, series_id: snapshot.series_id, version_no: 1, title: snapshot.cover.title, cover: snapshot.cover,
      output_type: 'selection', template_version: '1.1.0', template_content_hash: snapshot.template.content_sha256, status: 'ready', slides: snapshot.slides, created_at: snapshot.created_at, download_enabled: true });
    if (path.endsWith('/feedback')) return ok({ version_id: snapshot.version_id, comments: [], page: { next_cursor: null },
      preferences: current ? [{ id: '00000000-0000-4000-8000-000000000952', version_slide_id: slideId, guest_session_id: sessionId, author_display_name: 'Synthetic Reviewer', value: current.value, row_version: current.row_version, updated_at: snapshot.created_at }] : [] });
    if (path.endsWith('/preferences')) {
      const body = request.postDataJSON(); saves.push(body);
      if (failNext) { failNext = false; return route.fulfill({ status: 409, json: { request_id: 'synthetic-guest-preference', error: { code: 'STALE_RESOURCE_VERSION', message: 'Synthetic conflict', details: {}, retryable: false } } }); }
      current = body.value ? { value: body.value, row_version: ++rowVersion } : null;
      return ok({ preference: current ? { id: '00000000-0000-4000-8000-000000000952', version_slide_id: slideId, guest_session_id: sessionId, author_display_name: 'Synthetic Reviewer', value: current.value, row_version: current.row_version, updated_at: snapshot.created_at } : null, cleared: !current });
    }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto(`/r/${'p'.repeat(43)}`);
  await page.getByRole('button', { name: /^Slide 2:/ }).click();
  return { saves, errors };
}

test('preference radio group saves by keyboard, shows the saved choice and can be cleared', async ({ page }) => {
  const model = await guest(page);
  const group = page.getByRole('group', { name: 'Your preference for this candidate' });
  await expect(group.getByRole('status')).toHaveText('No preference saved for this candidate.');
  await group.getByRole('radio', { name: 'Maybe', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(group.getByRole('radio', { name: 'Maybe', exact: true })).toBeChecked();
  await expect(group.getByRole('status')).toHaveText('Preference saved: Maybe.');
  await page.keyboard.press('ArrowRight');
  await expect(group.getByRole('radio', { name: 'Not preferred', exact: true })).toBeChecked();
  await expect(group.getByRole('radio', { name: 'Maybe', exact: true })).not.toBeChecked();
  expect(model.saves.map(save => save.value)).toEqual(['maybe', 'not_preferred']);
  expect(model.saves[1].row_version).toBe(1);
  await group.getByRole('button', { name: 'Clear preference', exact: true }).click();
  await expect(group.getByRole('status')).toHaveText('Preference cleared.');
  await expect(group.getByRole('radio', { checked: true })).toHaveCount(0);
  expect(model.errors).toEqual([]);
});

test('a refused preference save leaves the saved state unchanged and can be chosen again', async ({ page }) => {
  const model = await guest(page, { failFirstSave: true });
  const group = page.getByRole('group', { name: 'Your preference for this candidate' });
  await group.getByRole('radio', { name: 'Preferred', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /changed|Reload|conflict/i })).toBeVisible();
  await expect(group.getByRole('radio', { name: 'Preferred', exact: true })).not.toBeChecked();
  await group.getByRole('radio', { name: 'Preferred', exact: true }).click();
  await expect(group.getByRole('radio', { name: 'Preferred', exact: true })).toBeChecked();
  expect(model.saves.map(save => save.value)).toEqual(['preferred', 'preferred']);
  expect(model.errors).toEqual([]);
});

test('changing slide with an unsent comment asks first and keeps the comment when cancelled', async ({ page }) => {
  const model = await guest(page);
  await page.getByRole('button', { name: 'Add feedback', exact: true }).click();
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill('Unsent synthetic note.');
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Discard your unsent comment?' });
  await dialog.getByRole('button', { name: 'Keep writing', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Comment', exact: true })).toHaveValue('Unsent synthetic note.');
  await expect(page.getByRole('textbox', { name: 'Comment', exact: true })).toBeFocused({ timeout: 1000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Discard your unsent comment?' }).getByRole('button', { name: 'Discard comment', exact: true }).click();
  await expect(page.getByText(/Slide 3 of/)).toBeVisible();
  expect(model.errors).toEqual([]);
});
