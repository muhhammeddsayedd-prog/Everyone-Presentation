import { expect, test } from '@playwright/test';
import { presentationFixture, presentationId } from '../fixtures/presentation';

test.use({ timezoneId: 'Africa/Cairo' });
test('Cairo DST expiry shows the correct hour and download-only edits preserve exact seconds', async ({ page }) => {
  const snapshot = presentationFixture({ frames: 0 }); snapshot.audience_snapshot.scope = 'external';
  const original = '2026-10-29T18:00:56.789Z', linkId = presentationId(985);
  let link = { id: linkId, label: 'Synthetic DST link', series_id: snapshot.series_id, expires_at: original,
    download_enabled: true, revoked_at: null, latest_ready_version_id: null, row_version: 4, created_at: snapshot.created_at };
  const patches: unknown[] = [];
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { data, request_id: 'synthetic-expiry-dst', page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: presentationId(986), name: 'Synthetic Producer', capabilities: ['review_links.manage', 'workspaces.read', 'workspaces.write'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/presentation-series/${snapshot.series_id}`) return ok({ id: snapshot.series_id, workspace_id: snapshot.workspace_id, output_type: 'selection', audience_snapshot: snapshot.audience_snapshot, title: snapshot.cover.title, latest_ready_version_id: null });
    if (path.endsWith('/versions')) return ok([]);
    if (path === '/api/v1/review-links') return ok([link]);
    if (path === `/api/v1/review-links/${linkId}` && request.method() === 'PATCH') {
      const body = request.postDataJSON(); patches.push(body); link = { ...link, ...body, row_version: link.row_version + 1 }; return ok(link);
    }
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto(`/presentations/series/${snapshot.series_id}/sharing`);
  await page.getByRole('button', { name: 'Edit access', exact: true }).click();
  const expiry = page.getByLabel(/Access expires \(your local time\)/u);
  await expect(expiry).toHaveValue('2026-10-29T21:00');
  await page.getByLabel('Allow PDF downloads', { exact: true }).uncheck(); await page.getByRole('button', { name: 'Save review link', exact: true }).click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]).toEqual({ row_version: 4, label: 'Synthetic DST link', download_enabled: false }); expect(link.expires_at).toBe(original);
  await page.getByRole('button', { name: 'Edit access', exact: true }).click(); await expiry.fill('2026-10-29T21:15');
  await page.getByRole('button', { name: 'Save review link', exact: true }).click(); await expect.poll(() => patches.length).toBe(2);
  expect(patches[1]).toEqual({ row_version: 5, label: 'Synthetic DST link', download_enabled: false, expires_at: '2026-10-29T18:15:00.000Z' });
});
