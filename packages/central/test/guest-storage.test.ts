import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGuestAssetProxy, guestAssetRead, guestByteRange } from '../src/guest-storage.ts';
import { newReviewToken } from '../src/review-credentials.ts';
const now = Date.parse('2026-10-30T00:00:00Z');
const bytes = Buffer.from('%PDF-synthetic-test-artifact');
function source() { return { asset: { id: 'asset-1', purpose: 'presentation_pdf', filename: 'export.pdf', mime_type: 'application/pdf', size_bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'), status: 'ready', duration_ms: null, width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: new Date(now).toISOString() },
  bucket: 'private-outputs', object_key: 'workspace/export/pdf.bin', grant_token: newReviewToken(), expires_at: new Date(now + 60000).toISOString() }; }
const config = { url: 'https://canonical.example', publishableKey: 'sb_publishable_synthetic_test_12345' };
test('guest asset capability accepts only bounded exact private destinations and short expiry', () => {
  const item = source(); assert.equal(guestAssetRead(item, now).asset.id, 'asset-1');
  for (const extra of [{ object_key: '../secret' }, { bucket: 'https://evil.example' }, { expires_at: new Date(now - 1).toISOString() }, { expires_at: new Date(now + 120000).toISOString() }, { grant_token: 'raw-invalid' }, { secret: 'other' }]) assert.throws(() => guestAssetRead({ ...item, ...extra }, now));
});
test('retained archived originals stay readable while archived export outputs remain denied', () => {
  const item = source(); const original = { ...item, asset: { ...item.asset, purpose: 'candidate_video', filename: 'intro.mp4', mime_type: 'video/mp4', status: 'archived' } };
  assert.equal(guestAssetRead(original, now).asset.status, 'archived');
  assert.throws(() => guestAssetRead({ ...item, asset: { ...item.asset, status: 'archived' } }, now));
});
test('single byte ranges reject multiple, invalid, unsafe and unsatisfiable ranges', () => {
  assert.deepEqual(guestByteRange('bytes=2-5', 10), { start: 2, end: 5, length: 4 });
  assert.deepEqual(guestByteRange('bytes=-3', 10), { start: 7, end: 9, length: 3 });
  assert.deepEqual(guestByteRange('bytes=7-', 10), { start: 7, end: 9, length: 3 });
  assert.deepEqual(guestByteRange('bytes=0-100', 10), { start: 0, end: 9, length: 10 });
  for (const range of ['bytes=0-1,3-4', 'bytes=10-', 'bytes=4-2', 'bytes=-0', 'bytes=-', 'bytes=9007199254740992-', 'items=0-1']) assert.throws(() => guestByteRange(range, 10));
});
test('guest proxy keeps capability private, validates whole bytes and returns no Storage URL', async () => {
  const item = source(); let calls = 0;
  const service = createGuestAssetProxy(config, { now: () => now, fetch: async (url, options) => {
    calls++; assert.equal(String(url), 'https://canonical.example/storage/v1/object/private-outputs/workspace/export/pdf.bin');
    assert.equal(options?.redirect, 'error'); assert.equal(options?.cache, 'no-store');
    assert.equal(new Headers(options?.headers).get('x-eps-review-asset-grant'), item.grant_token);
    return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(bytes.length) } });
  } });
  const result = await service.read(item); assert.deepEqual(Buffer.from(await new Response(result.body).arrayBuffer()), bytes); assert.equal(calls, 1);
  assert.deepEqual(Object.keys(result).sort(), ['body', 'mimeType', 'size', 'status']);
});
test('guest range stream validates response status and exact Content-Range before delivery', async () => {
  const item = source();
  const service = createGuestAssetProxy(config, { now: () => now, fetch: async (_url, options) => {
    assert.equal(new Headers(options?.headers).get('range'), 'bytes=2-5');
    return new Response(bytes.subarray(2, 6), { status: 206, headers: { 'Content-Type': 'application/pdf', 'Content-Length': '4', 'Content-Range': `bytes 2-5/${bytes.length}` } });
  } });
  const result = await service.read(item, 'bytes=2-5'); assert.equal(result.status, 206); assert.deepEqual(Buffer.from(await new Response(result.body).arrayBuffer()), bytes.subarray(2, 6));
  const wrong = createGuestAssetProxy(config, { now: () => now, fetch: async () => new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(bytes.length) } }) });
  await assert.rejects(() => wrong.read(item, 'bytes=2-5'));
});
test('guest proxy stream fails on altered bytes or provider access denial', async () => {
  const item = source(); const bad = Buffer.from(bytes); bad[bad.length - 1] ^= 1;
  const altered = createGuestAssetProxy(config, { now: () => now, fetch: async () => new Response(bad, { headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(bytes.length) } }) });
  const result = await altered.read(item); await assert.rejects(() => new Response(result.body).arrayBuffer());
  const denied = createGuestAssetProxy(config, { now: () => now, fetch: async () => new Response(null, { status: 403 }) });
  await assert.rejects(() => denied.read(item), error => error instanceof Error && 'code' in error && error.code === 'REVIEW_ACCESS_DENIED');
});
