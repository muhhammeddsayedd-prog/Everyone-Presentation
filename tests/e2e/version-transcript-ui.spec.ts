import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { presentationFixture, presentationId, presentationVersionFixture } from '../fixtures/presentation';

const snapshot = presentationFixture({ frames: 0 });
const asset = snapshot.slides[1].video_asset_id!;
const session = presentationId(960);
const original = 'نص تجريبي فقط. Synthetic source <img src=x onerror=alert(1)> & original speech.';
const english = 'Synthetic English transcript <img src=x onerror=alert(1)> & translated speech.';
const companion = () => ({ version_id: snapshot.version_id, asset_id: asset, status: 'available', original_text: original,
  languages: ['ar', 'en'], source_kind: 'source_transcript', source_sha256: createHash('sha256').update(original).digest('hex'),
  english_status: 'available', english_text: english, english_sha256: createHash('sha256').update(english).digest('hex') });

async function wire(page: Page, mode: 'guest' | 'grant' | 'internal', transcript: unknown = companion()) {
  let denied = false, liveSourceReads = 0;
  const requests: string[] = [];
  const waitingMedia: (() => void)[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { data, request_id: 'synthetic-version-transcript' } });
    if (path.includes('/candidates/')) liveSourceReads++;
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: presentationId(961), name: 'Synthetic Producer', capabilities: ['workspaces.read', 'cast.read'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/versions/${snapshot.version_id}`) return ok({ ...presentationVersionFixture(snapshot), status: 'ready' });
    if (path === '/api/v1/review/open' || path === '/api/v1/review/session') return ok({ expires_at: '2026-11-29T00:00:00Z', series_id: snapshot.series_id,
      version_id: snapshot.version_id, download_enabled: true, display_name: null, guest_session_id: session });
    if (path === '/api/v1/review/presentation') return ok({ id: snapshot.version_id, series_id: snapshot.series_id, version_no: 1, title: snapshot.cover.title,
      cover: snapshot.cover, output_type: 'selection', status: 'ready', slides: snapshot.slides, created_at: snapshot.created_at,
      download_enabled: true, template_version: snapshot.template.version, template_content_hash: snapshot.template.content_sha256 });
    if (path.endsWith('/feedback')) return ok({ version_id: snapshot.version_id, comments: [], preferences: [], page: { next_cursor: null } });
    if (path.endsWith('/content')) {
      // Hold native media metadata: this suite checks companion presentation,
      // not media decoding. Live playback has separate actual-byte evidence.
      await new Promise<void>(resolve => waitingMedia.push(resolve));
      return route.fulfill({ status: 404, body: '' }).catch(() => undefined);
    }
    if (path.includes(`/versions/${snapshot.version_id}/media/${asset}`)) {
      requests.push(path);
      if (denied) return route.fulfill({ status: 404, json: { error: { code: 'REVIEW_UNAVAILABLE', message: 'Synthetic access revoked' } } });
      const prefix = mode === 'internal' ? '/api/v1/versions' : mode === 'grant' ? '/api/v1/review-media/versions' : '/api/v1/review/versions';
      return ok({ source_version_id: snapshot.version_id, asset_id: asset, mime_type: 'video/mp4', expires_at: '2026-11-29T00:00:00Z',
        url: `${prefix}/${snapshot.version_id}/media/${asset}/content${mode === 'guest' ? `?review_context=${session}` : ''}`,
        ...(transcript === undefined ? {} : { transcript }) });
    }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
  const open = async () => {
    if (mode === 'guest') {
      await page.goto(`/r/${'t'.repeat(43)}`);
      await page.getByRole('button', { name: 'Slide 2: Synthetic Role / Synthetic Slot1', exact: true }).click();
    } else {
      await page.goto(mode === 'grant' ? `/m/playback?version=${snapshot.version_id}&asset=${asset}` : `/presentations/versions/${snapshot.version_id}/media/${asset}`);
      if (mode === 'internal') await page.getByRole('button', { name: 'Open saved video', exact: true }).click();
    }
  };
  return { open, requests, deny: () => { denied = true; }, liveReads: () => liveSourceReads, releaseMedia: () => waitingMedia.splice(0).forEach(resolve => resolve()) };
}

test('guest source transcript is on demand, English only, and outside the ten-field slide', async ({ page }) => {
  const app = await wire(page, 'guest');
  await app.open();
  await expect(page.getByText(english, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Watch original introduction', exact: true }).click();
  const source = page.getByRole('group', { name: 'Source transcript', exact: true });
  await expect(source).toBeVisible();
  await expect(page.getByText(english, { exact: true })).toBeHidden();
  await page.getByText('Read English transcript', { exact: true }).press('Enter');
  await expect(page.getByText(english, { exact: true })).toBeVisible();
  await expect(page.getByText(original, { exact: true })).toHaveCount(0);
  await expect(page.getByText('Arabic · English', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'English transcript', exact: true })).toHaveAttribute('lang', 'en');
  expect(await page.locator('.saved-casting-slide dt').count()).toBe(10);
  expect(await page.locator('.saved-casting-slide').getByText(english, { exact: true }).count()).toBe(0);
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  expect(app.requests).toEqual([`/api/v1/review/versions/${snapshot.version_id}/media/${asset}`]);
  expect(app.liveReads()).toBe(0);
  await page.screenshot({ path: '.local/m03-english-ui/guest.png', fullPage: true });
  app.releaseMedia();
});

for (const mode of ['grant', 'internal'] as const) {
  test(`${mode} fixed-version original video exposes the same captured companion`, async ({ page }) => {
    const app = await wire(page, mode);
    await app.open();
    await page.getByText('Read English transcript', { exact: true }).press('Enter');
    await expect(page.getByText(english, { exact: true })).toBeVisible();
    await expect(page.getByText(original, { exact: true })).toHaveCount(0);
    expect(app.liveReads()).toBe(0);
    if (mode === 'internal') expect(app.requests).toHaveLength(1);
    else {
      expect(app.requests.length).toBeGreaterThanOrEqual(1);
      expect(new Set(app.requests)).toEqual(new Set([`/api/v1/review-media/versions/${snapshot.version_id}/media/${asset}/playback`]));
    }
    app.releaseMedia();
  });
}

test('old saved version states that its transcript was not captured without reading live sources', async ({ page }) => {
  const legacy: Record<string, unknown> = companion(); delete legacy.english_status; delete legacy.english_text; delete legacy.english_sha256;
  const app = await wire(page, 'grant', legacy);
  await app.open();
  await expect(page.getByText('English transcript was not captured for this saved version.', { exact: true })).toBeVisible();
  await expect(page.getByText('Read English transcript', { exact: true })).toHaveCount(0);
  await expect(page.getByText(original, { exact: true })).toHaveCount(0);
  expect(app.liveReads()).toBe(0);
  app.releaseMedia();
});

test('refresh denial removes the previously delivered transcript from the guest player', async ({ page }) => {
  const app = await wire(page, 'guest');
  await app.open();
  await page.getByRole('button', { name: 'Watch original introduction', exact: true }).click();
  await page.getByText('Read English transcript', { exact: true }).press('Enter');
  await expect(page.getByText(english, { exact: true })).toBeVisible();
  app.deny();
  await page.getByRole('button', { name: 'Refresh video access', exact: true }).click();
  await expect(page.getByText(english, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Shared slide', exact: true }).getByRole('alert')).toBeVisible();
  expect(app.liveReads()).toBe(0);
  app.releaseMedia();
});

test('companion for another video is never rendered', async ({ page }) => {
  const app = await wire(page, 'grant', { ...companion(), asset_id: presentationId(999) });
  await app.open();
  await expect(page.getByText('The source transcript could not be confirmed for this video.', { exact: true })).toBeVisible();
  await expect(page.getByText(english, { exact: true })).toHaveCount(0);
  expect(app.liveReads()).toBe(0);
  app.releaseMedia();
});

test('a provided spoken language is listed while the displayed transcript stays English', async ({ page }) => {
  const app = await wire(page, 'grant', { ...companion(), languages: ['Arabic'] });
  await app.open();
  await page.getByText('Read English transcript', { exact: true }).press('Enter');
  await expect(page.getByRole('region', { name: 'English transcript', exact: true })).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Arabic', { exact: true })).toBeVisible();
  expect(app.liveReads()).toBe(0);
  app.releaseMedia();
});

test('spoken-language metadata is displayed as English labels without a raw fallback', async ({ page }) => {
  const app = await wire(page, 'grant', { ...companion(), languages: ['العربية', 'fr', 'English', 'unrecognized language'] });
  await app.open();
  await page.getByText('Read English transcript', { exact: true }).press('Enter');
  await expect(page.getByText('Other spoken language · French · English · Other spoken language', { exact: true })).toBeVisible();
  await expect(page.getByText('العربية', { exact: true })).toHaveCount(0);
  await expect(page.getByText(original, { exact: true })).toHaveCount(0);
  await expect(page.getByText(english, { exact: true })).toBeVisible();
  expect(app.liveReads()).toBe(0);
  app.releaseMedia();
});

for (const [status, message] of [
  ['not_provided', 'English transcript not provided.'],
  ['unavailable', 'English transcript unavailable. The source speech could not be converted to English.'],
  ['not_captured', 'English transcript was not captured for this saved version.'],
] as const) {
  test(`saved playback reports English ${status} without falling back to raw source`, async ({ page }) => {
    const app = await wire(page, 'grant', { ...companion(), english_status: status, english_text: null, english_sha256: null });
    await app.open();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page.getByText(original, { exact: true })).toHaveCount(0);
    await expect(page.getByText(english, { exact: true })).toHaveCount(0);
    expect(app.liveReads()).toBe(0);
    app.releaseMedia();
  });
}

test('a same-video companion from another version is never rendered', async ({ page }) => {
  const app = await wire(page, 'grant', { ...companion(), version_id: presentationId(998) });
  await app.open();
  await expect(page.getByText('The source transcript could not be confirmed for this video.', { exact: true })).toBeVisible();
  await expect(page.getByText(english, { exact: true })).toHaveCount(0);
  await expect(page.getByText(original, { exact: true })).toHaveCount(0);
  expect(app.liveReads()).toBe(0);
  app.releaseMedia();
});

test('a partial English group is rejected without displaying either text', async ({ page }) => {
  const partial: Record<string, unknown> = companion(); delete partial.english_sha256;
  const app = await wire(page, 'grant', partial);
  await app.open();
  await expect(page.getByText('The English transcript could not be confirmed for this video.', { exact: true })).toBeVisible();
  await expect(page.getByText(english, { exact: true })).toHaveCount(0);
  await expect(page.getByText(original, { exact: true })).toHaveCount(0);
  expect(app.liveReads()).toBe(0);
  app.releaseMedia();
});

test('the existing original-companion shape guard remains in force with English available', async ({ page }) => {
  const app = await wire(page, 'grant', { ...companion(), original_text: null });
  await app.open();
  await expect(page.getByText('The source transcript could not be confirmed for this video.', { exact: true })).toBeVisible();
  await expect(page.getByText(english, { exact: true })).toHaveCount(0);
  expect(app.liveReads()).toBe(0);
  app.releaseMedia();
});
