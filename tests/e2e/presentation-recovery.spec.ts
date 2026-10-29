import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';
import { presentationFixture, presentationId, presentationVersionFixture } from '../fixtures/presentation';

const session = { mode: 'supabase', actor: { id: presentationId(80), name: 'Synthetic Producer',
  capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read', 'presentations.generate'], upload_purposes: [] }, actors: [] };

test('a retained image retries a temporary failure without reading the live library', async ({ page }) => {
  const snapshot = presentationFixture({ frames: 1 });
  const version = presentationVersionFixture(snapshot);
  Object.assign(version, { status: 'ready', ready_at: '2026-10-29T21:02:00Z', pdf_asset_id: presentationId(70), manifest_asset_id: presentationId(71) });
  const frame = snapshot.slides[1].frame_asset_ids[0];
  const imagePath = `/api/v1/versions/${version.id}/media/${frame}/content`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC', 'base64');
  let imageReads = 0, allowImage = false;
  const unexpected: string[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-image-recovery', data } });
    if (path === '/api/session') return ok(session);
    if (path === `/api/v1/versions/${version.id}`) return ok(version);
    if (path === imagePath) {
      imageReads++;
      if (!allowImage) return route.fulfill({ status: 503, json: { error: { code: 'ASSET_UNAVAILABLE', message: 'Synthetic temporary read failure' } } });
      return route.fulfill({ contentType: 'image/png', body: png });
    }
    unexpected.push(path);
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto(`/presentations/versions/${version.id}`);
  await page.getByRole('button', { name: 'Slide 2: Synthetic Role / Synthetic Slot1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saved image', exact: true })).toBeVisible();
  const readsBeforeRetry = imageReads;
  expect(readsBeforeRetry).toBeGreaterThanOrEqual(1);
  allowImage = true;
  await page.getByRole('button', { name: 'Retry saved image', exact: true }).click();
  const image = page.getByRole('img', { name: 'Saved frame 1 of 1', exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(node => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('button', { name: 'Retry saved image', exact: true })).toHaveCount(0);
  expect(imageReads).toBeGreaterThan(readsBeforeRetry);
  expect(unexpected).toEqual([]);
});

test('a repeated series cursor reports the problem and reload starts from the first page', async ({ page }) => {
  const snapshot = presentationFixture({ frames: 0 });
  const series = { id: snapshot.series_id, workspace_id: snapshot.workspace_id, output_type: 'selection', audience_preset_id: snapshot.audience_snapshot.id,
    audience_snapshot: snapshot.audience_snapshot, title: snapshot.cover.title, latest_ready_version_id: null, latest_ready_version_no: null,
    row_version: 1, archived: false, template_key: snapshot.template.key, template_version: snapshot.template.version,
    template_content_sha256: snapshot.template.content_sha256, font_key: snapshot.template.font_key };
  const cursors: (string | null)[] = [];
  let reloadAllowed = false;
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-page-recovery', data } });
    if (path === '/api/session') return ok(session);
    if (path === '/api/v1/presentation-series') {
      cursors.push(url.searchParams.get('cursor'));
      return route.fulfill({ json: { request_id: 'synthetic-page-recovery', data: [{ ...series, title: reloadAllowed ? 'Reloaded synthetic series' : series.title }],
        page: { next_cursor: reloadAllowed ? null : 'repeated-synthetic-cursor' } } });
    }
    if (path === `/api/v1/workspaces/${snapshot.workspace_id}`) return ok({ id: snapshot.workspace_id, project_id: snapshot.project_id,
      title: 'Synthetic Project', module: 'casting', active_output: 'selection', row_version: 1, draft_revision: 0, has_unpublished_changes: false });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  await page.goto('/presentations');
  await expect(page.getByRole('heading', { name: series.title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load more series', exact: true }).click();
  await expect(page.locator('.notice[role="alert"]')).toContainText('The series page repeated. Reload the list to continue.');
  await expect(page.getByRole('button', { name: 'Load more series', exact: true })).toHaveCount(0);
  const repeatedPage = cursors.indexOf('repeated-synthetic-cursor');
  expect(repeatedPage).toBeGreaterThanOrEqual(1);
  expect(cursors.slice(0, repeatedPage).every(cursor => cursor === null)).toBe(true);
  reloadAllowed = true;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reloaded synthetic series', exact: true })).toBeVisible();
  await expect(page.locator('.notice[role="alert"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Load more series', exact: true })).toHaveCount(0);
  expect(cursors.at(-1)).toBeNull();
});
