import { chromium, request as playwrightRequest, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = 'http://127.0.0.1:3000';
const output = path.resolve('tracking/evidence/cloud-foundation');
async function main() {
await mkdir(output, { recursive: true });
const api = await playwrightRequest.newContext({ baseURL });
const browser = await chromium.launch();
try {
  const session = await api.get('/api/session');
  expect(session.status()).toBe(200);
  const data = (await session.json()).data;
  expect(data).toMatchObject({ mode: 'supabase', actor: null, actors: [] });
  expect((await api.get('/api/v1/projects')).status()).toBe(401);
  expect((await api.get('/api/dev/session')).status()).toBe(403);
  expect((await api.delete('/api/dev/session', { headers: { Origin: baseURL } })).status()).toBe(403);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const diagnostics: string[] = [];
  page.on('pageerror', error => diagnostics.push(error.message));
  page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
  await page.goto(`${baseURL}/projects`);
  await expect(page.getByRole('heading', { name: 'Sign in to Everyone', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('Development identity')).toHaveCount(0);
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByText('Synthetic data', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-nextjs-dialog-overlay]')).toHaveCount(0);
  expect(diagnostics).toEqual([]);
  await page.screenshot({ path: path.join(output, 'central-sign-in-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: path.join(output, 'central-sign-in-mobile.png'), fullPage: true });
  await writeFile(path.join(output, 'anonymous-smoke.json'), JSON.stringify({ observed_at: new Date().toISOString(),
    url: baseURL, result: 'PASS', mode: 'supabase', actor: null,
    checked: ['central sign-in UI', 'anonymous API401', 'all checked fixture endpoints403', 'no browser errors/overlay', 'desktop/320px reflow'],
    email_sent: false, authenticated_journey: 'not_run' }, null, 2) + '\n');
  console.log('PASS: actual central-mode anonymous browser/API; no email or user created');
} finally { await browser.close(); await api.dispose(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
