import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { probeSpecsStorageDenials } from '../../tools/probe-specs-storage-denials.mjs';
const { Response, ReadableStream } = globalThis;

const assets = [{ asset_id: '71990000-0000-4000-8000-000000000001', mime_type: 'application/pdf' }];
const publicConfiguration = { EPS_SPECS_FILES_ENABLED: 'true', SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_public_key' };
test('unfilled or malformed original targets fail before configuration or HTTP access', async () => {
  for (const value of [null, [], [{ ...assets[0], asset_id: '../foreign' }], [{ ...assets[0], mime_type: 'text/html' }]]) {
    let reads = 0; const result = await probeSpecsStorageDenials(value, { loadFiles: async () => { reads++; return publicConfiguration; }, fetch: async () => { throw new Error('unexpected HTTP'); } });
    assert.equal(result.result, 'unconfirmed'); assert.equal(reads, 0); assert.equal(result.http_requests, 0);
  }
});
test('only two exact GETs use the public key, no user/session credentials, and cancel bodies unread', async () => {
  const calls = []; let cancelled = 0;
  const result = await probeSpecsStorageDenials(assets, { loadFiles: async () => publicConfiguration, fetch: async (url, options) => {
    calls.push({ url, options }); return { status: calls.length === 1 ? 404 : 403, body: { cancel: async () => { cancelled++; } },
      text: () => { throw new Error('response body must not be read'); } };
  } });
  assert.equal(result.result, 'passed'); assert.equal(cancelled, 2); assert.equal(calls.length, 2);
  for (const { url, options } of calls) {
    assert.equal(url, `https://pyibofyctwnqpvktepse.supabase.co/storage/v1/object/authenticated/eps-specs-assets/assets/${assets[0].asset_id}/original.pdf`);
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.apikey, publicConfiguration.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(options.headers.authorization, `Bearer ${publicConfiguration.SUPABASE_PUBLISHABLE_KEY}`);
    assert.equal(options.body, undefined);
  }
  assert.equal(calls[0].options.headers['x-eps-asset-grant'], undefined);
  assert.match(calls[1].options.headers['x-eps-asset-grant'], /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(result.source_bodies_read, false); assert.equal(result.error_bodies_inspected, false); assert.equal(result.object_mutations_requested, false);
  assert.doesNotMatch(JSON.stringify(result), /sb_publishable_|Bearer/u);
});
test('accepted reads fail unsafe without reading bytes or continuing; other errors are unconfirmed', async () => {
  for (const status of [200, 400, 429, 500]) {
    let calls = 0; let cancelled = 0;
    const result = await probeSpecsStorageDenials(assets, { loadFiles: async () => publicConfiguration, fetch: async () => {
      calls++; return { status, body: { cancel: async () => { cancelled++; } } };
    } });
    assert.equal(result.result, status === 200 ? 'unsafe' : 'unconfirmed'); assert.equal(calls, 1); assert.equal(cancelled, 1);
    assert.equal(result.source_bodies_read, false);
  }
});

test('only canonical legacy400 NoSuchKey404 and AccessDenied403 count as denial with error inspection labelled', async () => {
  let calls = 0;
  const result = await probeSpecsStorageDenials(assets, { loadFiles: async () => publicConfiguration, fetch: async () => {
    calls++; return Response.json({ code: calls === 1 ? 'NoSuchKey' : 'AccessDenied', statusCode: calls === 1 ? '404' : '403',
      message: 'synthetic-private-error-detail' }, { status: 400 });
  } });
  assert.equal(result.result, 'passed'); assert.equal(calls, 2);
  assert.equal(result.error_bodies_inspected, true); assert.equal(result.source_bodies_read, false);
  assert.ok(result.checks.every(check => check.http_status === 400 && check.denied && check.legacy_error_matched));
  assert.doesNotMatch(JSON.stringify(result), /synthetic-private-error-detail|NoSuchKey|AccessDenied|statusCode/u);
});

test('generic400, contradictory legacy codes, malformed or oversized JSON and5xx spoofing never count as denial', async () => {
  const json = (value, status = 400) => Response.json(value, { status });
  for (const response of [
    json({ code: 'UnknownError', statusCode: '404' }), json({ code: 'NoSuchKey', statusCode: '403' }),
    json({ code: 'AccessDenied', statusCode: '404' }), json({ code: 'NoSuchKey', statusCode: 404 }),
    new Response('{"code":"NoSuchKey","statusCode":"404"', { status: 400, headers: { 'Content-Type': 'application/json' } }),
    new Response(JSON.stringify({ code: 'NoSuchKey', statusCode: '404' }), { status: 400, headers: { 'Content-Type': 'text/plain' } }),
    json({ code: 'NoSuchKey', statusCode: '404', message: 'x'.repeat(8192) }),
    json({ code: 'NoSuchKey', statusCode: '404' }, 500), json({ code: 'AccessDenied', statusCode: '403' }, 503),
  ]) {
    let reads = 0; const reader = response.body.getReader.bind(response.body); response.body.getReader = (...args) => { reads++; return reader(...args); };
    const result = await probeSpecsStorageDenials(assets, { loadFiles: async () => publicConfiguration, fetch: async () => response });
    assert.equal(result.result, 'unconfirmed'); assert.equal(result.http_requests, 1); assert.equal(result.source_bodies_read, false);
    assert.ok(result.checks.every(check => !check.denied));
    if (response.status >= 500) { assert.equal(reads, 0); assert.equal(result.error_bodies_inspected, false); }
  }
});

test('the same deadline bounds an error stream even when its reader and cancellation do not settle', async () => {
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(Buffer.from('{"code":"NoSuchKey",')); },
    cancel() { return new Promise(() => {}); } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  const started = Date.now();
  const result = await probeSpecsStorageDenials(assets, { loadFiles: async () => publicConfiguration, fetch: async () => response, timeoutMs: 5 });
  assert.equal(result.result, 'unconfirmed'); assert.equal(result.source_bodies_read, false); assert.equal(result.error_bodies_inspected, true);
  assert.ok(Date.now() - started < 1000);
});
test('private failures and ignored abort signals cannot leak diagnostics or hang this read probe', async () => {
  for (const request of [async () => { throw new Error('private-token-or-response'); }, async () => await new Promise(() => {})]) {
    const result = await probeSpecsStorageDenials(assets, { loadFiles: async () => publicConfiguration, fetch: request, timeoutMs: 5 });
    assert.equal(result.result, 'unconfirmed'); assert.doesNotMatch(JSON.stringify(result), /private-token/u);
  }
});
