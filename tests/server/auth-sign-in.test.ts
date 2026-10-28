import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { mapSignInError, requestBusinessSignIn, type SignInLinkRequest } from '../../apps/web/lib/auth-sign-in.ts';
import { failure } from '../../apps/web/lib/http.ts';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { BusinessSignIn } from '../../apps/web/components/BusinessSignIn.tsx';

test('callback failure URL cannot change the deterministic server-rendered sign-in markup', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    Reflect.deleteProperty(globalThis, 'window');
    const serverMarkup = renderToString(createElement(BusinessSignIn));
    Object.defineProperty(globalThis, 'window', { configurable: true,
      value: { location: { href: 'http://127.0.0.1:3000/?auth=failed' } } });
    const browserAvailableMarkup = renderToString(createElement(BusinessSignIn));
    assert.equal(browserAvailableMarkup, serverMarkup);
    assert.doesNotMatch(serverMarkup, /This sign-in link could not be used/);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('email sending limits and request throttling have distinct safe retry states', () => {
  const email = mapSignInError({ code: 'over_email_send_rate_limit', status: 429 });
  const request = mapSignInError({ code: 'over_request_rate_limit', status: 429 });
  assert.equal(email.code, 'AUTH_EMAIL_RATE_LIMITED');
  assert.equal(request.code, 'AUTH_REQUEST_RATE_LIMITED');
  for (const error of [email, request]) {
    assert.equal(error.status, 429);
    assert.equal(error.retryable, true);
    assert.doesNotMatch(error.message, /\b\d+\b|reset|seconds|minutes|hours/i);
  }
  assert.match(email.message, /inbox/i);
  assert.match(email.message, /sending limits/i);
  assert.doesNotMatch(request.message, /email.*quota|inbox/i);
});

test('documented email configuration codes do not become generic 429 retry advice', () => {
  for (const code of ['email_address_not_authorized', 'email_provider_disabled', 'otp_disabled', 'signup_disabled']) {
    const error = mapSignInError({ code, status: 429 });
    assert.equal(error.code, 'AUTH_EMAIL_CONFIGURATION_REQUIRED');
    assert.equal(error.status, 503);
    assert.equal(error.retryable, false);
    assert.match(error.message, /workspace administrator/i);
  }
  const invalid = mapSignInError({ code: 'email_address_invalid', status: 400 });
  assert.equal(invalid.code, 'VALIDATION_FAILED');
  assert.equal(invalid.status, 400);
});

test('unknown throttling stays generic and delivery failures do not claim a definite SMTP cause', () => {
  const unknown = mapSignInError({ code: 'future_private_error', status: 429 });
  assert.equal(unknown.code, 'RATE_LIMITED');
  assert.doesNotMatch(unknown.message, /quota|smtp|future_private_error/i);
  for (const code of ['unexpected_failure', 'request_timeout', 'hook_timeout', 'hook_timeout_after_retry']) {
    const error = mapSignInError({ code, status: 500 });
    assert.equal(error.code, 'DEPENDENCY_UNAVAILABLE');
    assert.equal(error.status, 503);
    assert.match(error.message, /email service/i);
    assert.doesNotMatch(error.message, /SMTP|password|invalid configuration/i);
  }
});

test('provider messages, bodies, addresses and unknown codes never enter the HTTP error response', async () => {
  const provider = { code: 'private_provider_code', status: 500,
    body: 'secret-body', email: 'synthetic@example.invalid' };
  Object.defineProperty(provider, 'message', { get() { throw new Error('Provider message must not be inspected.'); } });
  const response = failure(mapSignInError(provider));
  assert.equal(response.status, 503);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  const body = await response.text();
  assert.doesNotMatch(body, /secret-body|private_provider_code|synthetic@example.invalid/);
  assert.deepEqual(JSON.parse(body).error.details, {});
});

test('invalid sign-in inputs never invoke the email provider', async () => {
  let calls = 0;
  for (const input of [null, [], 'synthetic@example.invalid', { email: 12 }, { email: '' },
    { email: 'invalid' }, { email: 'a b@example.invalid' }, { email: 'a'.repeat(255) + '@example.invalid' },
    { email: 'synthetic@example.invalid', shouldCreateUser: false }]) {
    await assert.rejects(requestBusinessSignIn(input, 'http://127.0.0.1:3000', async () => {
      calls++; return { error: null };
    }), (error: unknown) => error instanceof DomainError && error.code === 'VALIDATION_FAILED');
  }
  assert.equal(calls, 0);
});

test('a valid request uses one provider call and the configured callback without accepting client options', async () => {
  const calls: SignInLinkRequest[] = [];
  const result = await requestBusinessSignIn({ email: ' synthetic@example.invalid ' }, 'http://127.0.0.1:3000', async input => {
    calls.push(input); return { error: null };
  });
  assert.deepEqual(result, { requested: true });
  assert.deepEqual(calls, [{ email: 'synthetic@example.invalid', options: {
    emailRedirectTo: 'http://127.0.0.1:3000/api/auth/callback', shouldCreateUser: true
  } }]);
});

test('returned and thrown provider failures are mapped without automatic mail retries', async () => {
  for (const throws of [false, true]) {
    let calls = 0;
    await assert.rejects(requestBusinessSignIn({ email: 'synthetic@example.invalid' }, 'http://127.0.0.1:3000', async () => {
      calls++;
      const error = { code: 'over_email_send_rate_limit', status: 429, message: 'private provider text' };
      if (throws) throw error;
      return { error };
    }), (error: unknown) => error instanceof DomainError && error.code === 'AUTH_EMAIL_RATE_LIMITED');
    assert.equal(calls, 1);
  }
});
