import { expect, test } from '@playwright/test';

const authorizationId = '10000000-0000-4000-8000-000000000001';
const clientId = '30000000-0000-4000-8000-000000000001';
const consent = { state: 'consent', authorization_id: authorizationId, client: { id: clientId, name: 'Synthetic Claude Code', website: 'https://client.example.invalid' },
  account_email: 'synthetic-owner@example.invalid', scopes: ['openid'] };
test.use({ viewport: { width: 1280, height: 900 } });

test('desktop consent shows verified client/permissions and keyboard approval returns through the provider-supplied URL', async ({ page }, testInfo) => {
  const calls: string[] = []; const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/oauth/authorization', route => {
    const body = route.request().postDataJSON(); calls.push(body.action);
    expect(Object.keys(body).sort()).toEqual(['action', 'authorization_id', 'request_id']);
    return route.fulfill({ json: { request_id: body.request_id, data: body.action === 'details' ? consent
      : { state: 'redirect', authorization_id: authorizationId, redirect_url: 'http://127.0.0.1:3100/oauth-client-callback?code=synthetic-only-code' } } });
  });
  await page.route('**/oauth-client-callback?*', route => route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic client received the redirect</h1>' }));
  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`);
  await expect(page.getByText('Synthetic Claude Code', { exact: true })).toBeVisible();
  await expect(page.getByText('synthetic-owner@example.invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('openid', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What this connection can do' })).toBeVisible();
  const approve = page.getByRole('button', { name: 'Approve connection', exact: true });
  await approve.focus(); await expect(approve).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('desktop-consent.png'), fullPage: true });
  await approve.press('Enter');
  await expect(page.getByRole('heading', { name: 'Synthetic client received the redirect' })).toBeVisible();
  expect(calls).toEqual(['details', 'approve']); expect(errors).toEqual([]);
});

test('desktop uncertain consent checks provider state without sending another approval', async ({ page }) => {
  const actions: string[] = [];
  await page.route('**/api/oauth/authorization', route => {
    const body = route.request().postDataJSON(); actions.push(body.action);
    return route.fulfill({ status: body.action === 'approve' ? 202 : 200,
      json: { request_id: body.request_id, data: body.action === 'approve' ? { state: 'uncertain', authorization_id: authorizationId } : consent } });
  });
  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`);
  await page.getByRole('button', { name: 'Approve connection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Approve connection', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Check authorization status', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check authorization status', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve connection', exact: true })).toHaveCount(0);
  expect(actions).toEqual(['details', 'approve', 'details']);
});

test('desktop signed-out consent requests an existing-account link and preserves its authorization selector', async ({ page }) => {
  const emails: unknown[] = [];
  await page.route('**/api/oauth/authorization', route => route.fulfill({ status: 401, json: { error: { code: 'AUTH_REQUIRED' } } }));
  await page.route('**/api/oauth/sign-in', route => { const body = route.request().postDataJSON(); emails.push(body);
    return route.fulfill({ json: { request_id: body.request_id, data: { state: 'sign_in_sent', authorization_id: body.authorization_id } } }); });
  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`);
  await page.getByRole('textbox', { name: 'Email address', exact: true }).fill('synthetic-owner@example.invalid');
  await page.getByRole('button', { name: 'Email me a sign-in link', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Only existing accounts can sign in.' })).toBeVisible();
  expect(emails).toHaveLength(1); expect(emails[0]).toMatchObject({ authorization_id: authorizationId, email: 'synthetic-owner@example.invalid' });
});

test('caller-supplied client names and redirects cannot become consent metadata', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/oauth/**', route => { calls++; return route.fulfill({ status: 500, body: '' }); });
  await page.goto(`/oauth/consent?authorization_id=${authorizationId}&client_name=Forged%20client&redirect=https://evil.invalid`);
  await expect(page.getByRole('alert')).toContainText('This authorization request is unavailable.');
  await expect(page.getByText('Forged client')).toHaveCount(0); expect(calls).toBe(0);
});

test('a refused metadata-free reconnect offers no approval or automatic redirect', async ({ page }) => {
  await page.route('**/api/oauth/authorization', route => route.fulfill({ status: 503,
    json: { error: { code: 'OAUTH_PROVIDER_RESPONSE_INVALID' } } }));
  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`);
  await expect(page.getByRole('region', { name: 'Connect to Everyone' }).getByRole('alert')).toContainText('This connection request could not be verified.');
  await expect(page.getByRole('button', { name: 'Approve connection', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/oauth/consent\\?authorization_id=${authorizationId}$`));
});
