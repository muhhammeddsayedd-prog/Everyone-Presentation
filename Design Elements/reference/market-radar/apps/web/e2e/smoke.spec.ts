import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('shows the internal placeholder without runtime or accessibility errors', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) => failedRequests.push(request.url()));

  const response = await page.goto('/');

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle('everyone. Market Radar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.getByRole('heading', { name: 'Market Radar', level: 1 })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toHaveText('Internal · everyone.');

  const wordmark = page.getByRole('img', { name: 'everyone.' });
  await expect(wordmark).toBeVisible();
  await expect(wordmark).toHaveJSProperty('naturalWidth', 519);
  await expect(wordmark).toHaveCSS('filter', 'brightness(0) invert(1)');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(failedRequests).toEqual([]);
  expect(errors).toEqual([]);

  await page.screenshot({ path: testInfo.outputPath('placeholder.png'), fullPage: true });
});
