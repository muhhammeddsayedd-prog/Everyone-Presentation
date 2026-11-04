import { expect, test } from '@playwright/test';
import { presentationId, presentationVersionFixture } from '../fixtures/presentation';
import { editorialPresentation } from '../fixtures/editorial-snapshot';

test('saved Everyone Film 1.2.0 version previews the exact template pages and offers editable PowerPoint', async ({ page }) => {
  const { snapshot, images } = editorialPresentation(); const version = { ...presentationVersionFixture(snapshot), status: 'ready' as const, ready_at: '2026-10-29T21:02:00Z', pdf_asset_id: presentationId(71), manifest_asset_id: presentationId(72) };
  const mimes = new Map(snapshot.asset_inventory.map(asset => [asset.asset_id, asset.mime_type])); const imageReads: string[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname; const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-editorial', data } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: presentationId(80), name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'presentations.generate'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/versions/${version.id}`) return ok(version);
    const media = path.match(/^\/api\/v1\/versions\/[^/]+\/media\/([^/]+)\/content$/u);
    if (media && images.has(media[1])) { imageReads.push(media[1]); return route.fulfill({ body: Buffer.from(images.get(media[1])!), contentType: mimes.get(media[1]) }); }
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Synthetic route not mocked.' } } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/presentations/versions/${version.id}`);
  await expect(page.getByRole('heading', { name: 'Saved version 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download editable PowerPoint' })).toHaveAttribute('href', `/api/v1/versions/${version.id}/pptx/content`);

  // App view: the cover page of the composed deck, rendered from the template's own markup.
  const cover = page.locator('.ef-preview-frame').first();
  await expect(cover.locator('.ef-slide[data-layout="cover_floward"]')).toBeVisible();
  await expect(cover.getByText('Synthetic casting | Cast Selection.')).toBeVisible();
  const box = await cover.boundingBox(); expect(box && Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.01);

  // A candidate slide: its ten-field detail page, frames and fixed-version link.
  await page.getByRole('button', { name: /^Slide 2:/u }).click();
  const detail = page.locator('.ef-preview-frame').first();
  await expect(detail.locator('.ef-slide[data-layout="cast_detail"]')).toBeVisible();
  await expect(detail.getByText('Main', { exact: true })).toBeVisible();
  await expect(detail.locator('[data-fit-field="skills_experience"]')).toHaveText('Theatre and movement; comfortable with dialogue.');
  await expect(detail.locator('.ef-media[data-asset-id] img')).toHaveCount(2);
  await expect.poll(async () => detail.locator('.ef-media[data-asset-id] img').evaluateAll(items => items.every(item => (item as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(detail.getByRole('link', { name: 'Watch original introduction' })).toHaveAttribute('href', new RegExp(`/presentations/versions/${version.id}/media/`, 'u'));
  await page.locator('.ef-preview-frame').first().screenshot({ path: 'test-results/editorial-preview-detail.png' });

  // PDF preview: every composed page in print order, ending with THANK YOU!.
  await page.getByRole('button', { name: 'PDF preview' }).click();
  await expect(page.locator('.ef-preview-frame')).toHaveCount(10);
  await expect(page.locator('.ef-slide[data-layout="cast_main_backup"]')).toHaveCount(1);
  await expect(page.locator('.ef-preview-frame').last().getByText('THANK YOU!')).toBeVisible();
  expect(new Set(imageReads).size).toBeGreaterThan(0);
});
