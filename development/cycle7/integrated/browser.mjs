// Real-backend browser capture: Chromium on the integrated app (no route mocks), signed in with a locally issued
// session cookie the server verifies against the gateway. Screens go to .local/cycle7/integrated/screens.
import { chromium } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const APP = process.env.EPS_INT_APP ?? 'http://127.0.0.1:3110';
const secret = process.env.EPS_INT_JWT_SECRET; if (!secret) throw new Error('EPS_INT_JWT_SECRET required');
const P = 'c7000000-0000-4000-8000-00000000c001'; const WS = 'c7000000-0000-4000-8000-00000000d001';
const sub = 'c7000000-0000-4000-8000-0000000000a1'; const email = 'producer-a@example.invalid';
const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const sign = claims => { const h = b64({ alg: 'HS256', typ: 'JWT' }), b = b64(claims); return `${h}.${b}.${createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url')}`; };
const exp = Math.floor(Date.now() / 1000) + 3600;
const user = { id: sub, aud: 'authenticated', role: 'authenticated', email, is_anonymous: false, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-11-16T00:00:00Z' };
const session = { access_token: sign({ sub, email, role: 'authenticated', aud: 'authenticated', is_anonymous: false, exp }), token_type: 'bearer', expires_in: 3600, expires_at: exp,
  refresh_token: sign({ sub, email, role: 'authenticated', kind: 'refresh', exp: exp + 86400 }), user };
const out = '.local/cycle7/integrated/screens'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
const shots = [];
async function shot(name, path, waitFor) {
  await page.goto(APP + path, { waitUntil: 'domcontentloaded', timeout: 180000 });
  if (waitFor) await page.getByText(waitFor, { exact: false }).first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false }); shots.push({ name, path, url: page.url() });
}
await shot('01-project-candidates', `/projects/${P}/casting/${WS}/cast`, 'Upload new candidates');
const library = page.getByRole('button', { name: /Choose from Library/i }).first();
if (await library.count()) { await library.click(); await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/02-library-membership.png` }); shots.push({ name: '02-library-membership' }); }
await shot('03-casting-standard', `/projects/${P}/casting/${WS}/organize`, 'Standard view');
const scenes = page.getByRole('button', { name: 'Scene breakdown' });
if (await scenes.count()) { await scenes.click(); await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/04-scene-breakdown.png` }); shots.push({ name: '04-scene-breakdown' }); }
await shot('05-review', `/projects/${P}/casting/${WS}/review`, 'Review');
writeFileSync(`${out}/shots.json`, JSON.stringify({ shots, page_errors: errors }, null, 1));
await browser.close();
console.log(JSON.stringify({ shots: shots.length, page_errors: errors.length }));
