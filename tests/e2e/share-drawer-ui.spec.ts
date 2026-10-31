import { expect, test, type Page } from '@playwright/test';
import { presentationFixture, presentationId, presentationVersionFixture } from '../fixtures/presentation';

// Synthetic HTTP/DOM checks: the saved-version Share drawer reuses the sharing page's link controls.
async function wire(page: Page, scope: 'external' | 'internal') {
  const snapshot = presentationFixture({ frames: 0 }); snapshot.audience_snapshot.scope = scope;
  const version = { ...presentationVersionFixture(snapshot), status: 'ready' };
  const created: unknown[] = []; const errors: string[] = []; let links: unknown[] = [];
  const link = { id: presentationId(821), series_id: snapshot.series_id, label: 'Agency', expires_at: '2026-11-29T00:00:00Z', download_enabled: true, revoked_at: null, latest_ready_version_id: version.id, row_version: 1, created_at: snapshot.created_at };
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { data, request_id: 'synthetic-share-drawer', page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: presentationId(820), name: 'Synthetic Producer', capabilities: ['review_links.manage', 'workspaces.read', 'workspaces.write'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/versions/${version.id}`) return ok(version);
    if (path === `/api/v1/presentation-series/${snapshot.series_id}`) return ok({ id: snapshot.series_id, workspace_id: snapshot.workspace_id, output_type: 'selection', audience_snapshot: snapshot.audience_snapshot, title: snapshot.cover.title, latest_ready_version_id: version.id, archived: false, row_version: 1 });
    if (path === '/api/v1/review-links' && request.method() === 'GET') return ok(links);
    if (path === '/api/v1/review-links' && request.method() === 'POST') { created.push(request.postDataJSON()); links = [link]; return ok({ link, url: `${new URL(request.url()).origin}/r/${'s'.repeat(43)}`, token: 's'.repeat(43) }); }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic unavailable route' } } });
  });
  await page.goto(`/presentations/versions/${version.id}`);
  await expect(page.getByRole('heading', { name: 'Saved version 1', exact: true })).toBeVisible();
  return { snapshot, created, errors };
}

test('share drawer creates a link with the shared controls and returns focus on close', async ({ page }) => {
  const model = await wire(page, 'external');
  const trigger = page.getByRole('button', { name: 'Share for review', exact: true });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'Share for review' });
  await expect(drawer).toBeVisible();
  await drawer.getByLabel('Link label', { exact: true }).fill('Agency');
  await drawer.getByRole('button', { name: 'Create review link', exact: true }).click();
  await expect(drawer.getByLabel('New review URL', { exact: true })).toHaveValue(new RegExp(`/r/${'s'.repeat(43)}$`));
  expect(model.created).toEqual([{ series_id: model.snapshot.series_id, label: 'Agency', download_enabled: true }]);
  await expect(drawer.getByRole('link', { name: /Open sharing and feedback page/ })).toHaveAttribute('href', `/presentations/series/${model.snapshot.series_id}/sharing`);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(model.errors).toEqual([]);
});

test('an internal-audience series explains that it cannot be shared with guests', async ({ page }) => {
  const model = await wire(page, 'internal');
  await page.getByRole('button', { name: 'Share for review', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Share for review' });
  await expect(drawer.getByText(/uses an internal audience, so it cannot be shared with guests/)).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Create review link', exact: true })).toHaveCount(0);
  expect(model.created).toEqual([]); expect(model.errors).toEqual([]);
});
