import { expect, test, type Page } from '@playwright/test';
import { presentationFixture, presentationId, presentationVersionFixture } from '../fixtures/presentation';

function deferred() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
async function sharing(page: Page, uncertain = false) {
  const snapshot = presentationFixture({ frames: 0 }); snapshot.audience_snapshot.scope = 'external';
  const version = presentationVersionFixture(snapshot), hold = deferred();
  const targetId = presentationId(870), otherId = presentationId(871), createdId = presentationId(872);
  const createdToken = Buffer.alloc(32, 31).toString('base64url'), rotatedToken = Buffer.alloc(32, 32).toString('base64url');
  let dialogs = 0, created = false, effects = 0;
  const attempts: { path: string; key: string | undefined; body: unknown }[] = [];
  const patches: { body: unknown; key: string | undefined }[] = [];
  page.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
  const link = (id: string, label: string, rowVersion: number) => ({ id, label, series_id: snapshot.series_id, expires_at: '2026-11-29T12:34:56.789Z', download_enabled: true, revoked_at: null as string | null, latest_ready_version_id: version.id, row_version: rowVersion, created_at: snapshot.created_at });
  let target = link(targetId, 'Synthetic target', 7); const other = link(otherId, 'Synthetic other', 11), fresh = link(createdId, 'Synthetic new', 1);
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const ok = (data: unknown) => route.fulfill({ json: { data, request_id: 'synthetic-inline-confirmation', page: { next_cursor: null } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: presentationId(873), name: 'Synthetic Producer', capabilities: ['review_links.manage', 'workspaces.read', 'workspaces.write'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/presentation-series/${snapshot.series_id}`) return ok({ id: snapshot.series_id, workspace_id: snapshot.workspace_id, output_type: 'selection', audience_snapshot: snapshot.audience_snapshot, title: snapshot.cover.title, latest_ready_version_id: version.id });
    if (path.endsWith('/versions')) return ok([version]);
    if (path.endsWith('/feedback')) return ok({ version_id: version.id, comments: [], preferences: [], page: { next_cursor: null } });
    if (path === '/api/v1/review-links' && request.method() === 'GET') return ok(created ? [fresh, target, other] : [target, other]);
    if (path === '/api/v1/review-links' && request.method() === 'POST') { created = true; return ok({ link: fresh, url: `${url.origin}/r/${createdToken}`, token: createdToken }); }
    if (path === `/api/v1/review-links/${targetId}` && request.method() === 'PATCH') {
      const body = request.postDataJSON(); patches.push({ body, key: request.headers()['idempotency-key'] });
      target = { ...target, ...body, row_version: target.row_version + 1 }; return ok(target);
    }
    if (path === `/api/v1/review-links/${targetId}/rotate` || path === `/api/v1/review-links/${targetId}/revoke`) {
      attempts.push({ path, key: request.headers()['idempotency-key'], body: request.postDataJSON() });
      if (attempts.length === 1) { effects++; target = { ...target, row_version: 8, revoked_at: path.endsWith('/revoke') ? snapshot.created_at : null }; }
      if (uncertain && attempts.length <= 2) return route.fulfill({ status: attempts.length === 1 ? 503 : 403, json: { error: { code: 'DEPENDENCY_UNAVAILABLE', message: attempts.length === 1 ? 'Synthetic lost lifecycle acknowledgement' : 'Synthetic temporary lifecycle denial' } } });
      if (!uncertain) await hold.promise;
      return path.endsWith('/rotate') ? ok({ link: target, url: `${url.origin}/r/${rotatedToken}`, token: rotatedToken }) : ok(target);
    }
    return route.fulfill({ status: 404, json: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Synthetic unavailable route' } } });
  });
  await page.goto(`/presentations/series/${snapshot.series_id}/sharing`);
  await expect(page.getByRole('heading', { name: 'Synthetic target', exact: true })).toBeVisible();
  const row = (name: string) => page.locator('.review-link-list > li').filter({ has: page.getByRole('heading', { name, exact: true }) });
  return { row, attempts, patches, hold, get expiry() { return target.expires_at; }, get dialogs() { return dialogs; }, get effects() { return effects; }, createdToken, rotatedToken, targetId };
}

for (const action of ['rotate', 'revoke'] as const) test(`inline ${action} confirmation can cancel without mutation and confirms one frozen intent`, async ({ page }) => {
  const state = await sharing(page), actionLabel = action === 'rotate' ? 'Rotate URL' : 'Revoke link';
  const groupLabel = action === 'rotate' ? 'Confirm URL rotation' : 'Confirm link revocation';
  const consequence = action === 'rotate' ? 'Replace this review URL? The old URL, sessions and PDF video links will stop working.' : 'Revoke this review link? Future viewing and PDF video requests will be denied.';
  try {
    await page.getByRole('button', { name: 'Create review link', exact: true }).click();
    await expect(page.getByLabel('New review URL', { exact: true })).toHaveValue(new RegExp(`/r/${state.createdToken}$`));
    await page.getByLabel('Link label', { exact: true }).fill('Unsent label remains');
    const trigger = state.row('Synthetic target').getByRole('button', { name: actionLabel, exact: true });
    await trigger.click(); expect.soft(state.dialogs).toBe(0);
    const group = page.getByRole('group', { name: groupLabel, exact: true }); await expect(group).toBeVisible();
    await expect(group).toContainText(consequence); await expect(group.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    expect(state.attempts).toHaveLength(0); await expect(page.getByLabel('Link label', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Create review link', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Refresh links', exact: true })).toBeDisabled();
    for (const name of ['Edit access', 'Rotate URL', 'Revoke link']) await expect(state.row('Synthetic other').getByRole('button', { name, exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Hide URL', exact: true })).toBeDisabled();
    await group.getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
    await expect(group).toHaveCount(0); await expect(trigger).toBeFocused(); expect(state.attempts).toHaveLength(0);
    await expect(page.getByLabel('Link label', { exact: true })).toHaveValue('Unsent label remains');
    await expect(page.getByLabel('New review URL', { exact: true })).toHaveValue(new RegExp(`/r/${state.createdToken}$`));
    await trigger.press('Enter'); await expect(group).toBeVisible();
    await group.getByRole('button', { name: `Confirm ${action}`, exact: true }).click();
    await expect.poll(() => state.attempts.length).toBe(1); await expect(page.getByRole('button', { name: 'Create review link', exact: true })).toBeDisabled();
    expect(state.attempts[0].path).toBe(`/api/v1/review-links/${state.targetId}/${action}`); expect(state.attempts[0].body).toEqual({ row_version: 7 }); expect(state.attempts[0].key!.length).toBeGreaterThanOrEqual(16);
    state.hold.release();
    if (action === 'rotate') await expect(page.getByLabel('New review URL', { exact: true })).toHaveValue(new RegExp(`/r/${state.rotatedToken}$`));
    else await expect(state.row('Synthetic target').getByText(/^Revoked/)).toBeVisible();
    expect(state.effects).toBe(1); expect(state.attempts).toHaveLength(1); expect(state.dialogs).toBe(0);
    await expect(state.row('Synthetic other').getByRole('button', { name: 'Rotate URL', exact: true })).toBeEnabled();
  } finally { state.hold.release(); }
});

test('confirmed inline rotation keeps its row version and idempotency key through lost ACK and denial', async ({ page }) => {
  const state = await sharing(page, true);
  await state.row('Synthetic target').getByRole('button', { name: 'Rotate URL', exact: true }).click(); expect.soft(state.dialogs).toBe(0);
  await page.getByRole('group', { name: 'Confirm URL rotation', exact: true }).getByRole('button', { name: 'Confirm rotate', exact: true }).click();
  const replay = page.getByRole('button', { name: 'Confirm link request', exact: true }); await expect(replay).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create review link', exact: true })).toBeDisabled();
  await expect(state.row('Synthetic other').getByRole('button', { name: 'Rotate URL', exact: true })).toBeDisabled();
  await replay.click(); await expect(page.getByText(/Synthetic temporary lifecycle denial/)).toBeVisible();
  await expect(page.getByLabel('Link label', { exact: true })).toBeDisabled(); await replay.click();
  await expect(page.getByLabel('New review URL', { exact: true })).toHaveValue(new RegExp(`/r/${state.rotatedToken}$`));
  expect(state.attempts).toHaveLength(3); expect(state.attempts[0]).toEqual(state.attempts[1]); expect(state.attempts[0]).toEqual(state.attempts[2]);
  expect(state.attempts[0].body).toEqual({ row_version: 7 }); expect(state.effects).toBe(1); expect(state.dialogs).toBe(0);
});

test('unchanged expiry is omitted from download-only edits while an explicit expiry edit is included', async ({ page }) => {
  const state = await sharing(page), original = state.expiry;
  await state.row('Synthetic target').getByRole('button', { name: 'Edit access', exact: true }).click();
  await page.getByLabel('Allow PDF downloads', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save review link', exact: true }).click();
  await expect.poll(() => state.patches.length).toBe(1);
  expect(state.patches[0].body).toEqual({ row_version: 7, label: 'Synthetic target', download_enabled: false });
  expect(state.expiry).toBe(original);
  await state.row('Synthetic target').getByRole('button', { name: 'Edit access', exact: true }).click();
  const changed = '2026-12-05T10:15';
  await page.getByLabel(/Access expires \(your local time\)/u).fill(changed);
  const expected = await page.evaluate(value => new Date(value).toISOString(), changed);
  await page.getByRole('button', { name: 'Save review link', exact: true }).click();
  await expect.poll(() => state.patches.length).toBe(2);
  expect(state.patches[1].body).toEqual({ row_version: 8, label: 'Synthetic target', download_enabled: false, expires_at: expected });
  expect(state.expiry).toBe(expected); expect(state.attempts).toHaveLength(0);
});
