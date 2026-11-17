// Screens of the new release on the staging stack: Chromium, no route mocks, signed in with a REAL GoTrue session
// (password grant) stored in the app's Supabase SSR cookie. The guest page uses a freshly created review link.
// Output: .local/cycle7/stg/artifacts/screens/*.png (+ screens.json). Usage: node browser.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { signIn, ok, useApp, WS, S, seed } from './lib.mjs';

const APP = 'http://127.0.0.1:3000'; useApp(APP);
const state = JSON.parse(readFileSync(path.join(S, 'release-state.json'), 'utf8'));
const project = seed.ids.project;
const out = path.join(S, 'artifacts/screens'); mkdirSync(out, { recursive: true });
const session = await signIn('a');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
const shots = [];
async function shot(name, url, waitFor, extra) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
  if (waitFor) await page.getByText(waitFor, { exact: false }).first().waitFor({ timeout: 120000 }).catch(() => {});
  if (extra) await extra();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false }); shots.push({ name, url: page.url().replace(/\/r\/[^/?#]+/, '/r/<token>') });
}
await shot('01-project-candidates', `${APP}/projects/${project}/casting/${WS}/cast`, 'Upload new candidates');
await shot('02-review-1-4-preview', `${APP}/projects/${project}/casting/${WS}/review?series_id=${state.series14}`, 'Cast Shortlist');
await shot('02b-review-1-4-photo-slide', `${APP}/projects/${project}/casting/${WS}/review?series_id=${state.series14}`, 'Photo Only Test Card', async () => { await page.getByText('Photo Only Test Card').last().click().catch(() => {}); });
await shot('03-saved-version-1-4', `${APP}/presentations/versions/${state.version14}`, 'Cast Shortlist');
await shot('03b-saved-version-photo-slide', `${APP}/presentations/versions/${state.version14}`, 'Neighbour / Neighbour 1', async () => { await page.getByText('Neighbour / Neighbour 1').first().click().catch(() => {}); });
const link = (await ok('POST', '/review-links', { series_id: state.series14, label: 'Staging screenshot link' })).data;
const guest = await browser.newContext({ viewport: { width: 1600, height: 1000 } }); const guestPage = await guest.newPage();
guestPage.on('pageerror', e => errors.push('guest: ' + String(e).slice(0, 300)));
await guestPage.goto(link.url.replace(/^https?:\/\/[^/]+/, APP), { waitUntil: 'domcontentloaded', timeout: 180000 });
await guestPage.getByText('Cast Shortlist', { exact: false }).first().waitFor({ timeout: 120000 }).catch(() => {});
await guestPage.waitForTimeout(4000);
await guestPage.screenshot({ path: path.join(out, '04-guest-1-4.png') }); shots.push({ name: '04-guest-1-4', url: '/r/<token>' });
await guestPage.getByText('Neighbour / Neighbour 1').first().click().catch(() => {}); await guestPage.waitForTimeout(4000);
await guestPage.screenshot({ path: path.join(out, '04b-guest-photo-slide.png') }); shots.push({ name: '04b-guest-photo-slide', url: '/r/<token>' });
await ok('POST', `/review-links/${link.link.id}/revoke`, { row_version: link.link.row_version, reason: 'Screenshot link no longer needed' }).catch(e => errors.push('revoke: ' + String(e).slice(0, 200)));
writeFileSync(path.join(out, 'screens.json'), JSON.stringify({ shots, page_errors: errors }, null, 1));
await browser.close();
console.log(JSON.stringify({ shots: shots.length, page_errors: errors }));
