import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRuntimeConfig } from '../../apps/web/lib/config';
import { signSession, verifySession } from '../../apps/web/lib/session';
import { decodeLogo } from '../../apps/web/lib/studio';
import { readBoundedBody, requireSameOrigin } from '../../apps/web/lib/http';
import sharp from 'sharp';

test('fixture runtime denies production, staging, non-loopback and unmapped central mode', () => {
  for (const env of [ { NODE_ENV: 'production' }, { APP_ENV: 'production' }, { APP_ENV: 'staging' },
    { APP_BASE_URL: 'https://example.com' }, { CENTRAL_ADAPTER_MODE: 'supabase' } ]) {
    assert.throws(() => readRuntimeConfig(env));
  }
  assert.equal(readRuntimeConfig({ APP_ENV: 'test' }).environment, 'test');
  assert.equal(readRuntimeConfig({ NODE_ENV: 'production', APP_ENV: 'staging', CENTRAL_ADAPTER_MODE: 'supabase',
    APP_BASE_URL: 'https://studio.example', SUPABASE_URL: 'https://synthetic.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_only' }).adapterMode, 'supabase');
});
test('signed development sessions reject tampering, wrong signing key, and expiry', () => {
  const key = Buffer.alloc(32, 7); const token = signSession('synthetic-user', key, 1000);
  assert.equal(verifySession(token, key, 1001), 'synthetic-user');
  assert.equal(verifySession(`${token}x`, key, 1001), null);
  assert.equal(verifySession(`${token}!`, key, 1001), null);
  assert.equal(verifySession(token, Buffer.alloc(32, 8), 1001), null);
  assert.equal(verifySession(token, key, 1000 + 8 * 60 * 60 * 1000), null);
});
test('mutation origin checks use Host and Origin despite Next internal URL normalization', () => {
  const accepted = new Request('http://localhost:3000/api/dev/session', { method: 'POST',
    headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' } });
  assert.doesNotThrow(() => requireSameOrigin(accepted));
  const invalidHeaders: Record<string, string>[] = [{ host: 'attacker.test', origin: 'http://127.0.0.1:3000' },
    { host: '127.0.0.1:3000', origin: 'https://attacker.test' }, { host: '127.0.0.1:3000' }];
  for (const headers of invalidHeaders) {
    assert.throws(() => requireSameOrigin(new Request('http://localhost:3000/api/dev/session', { method: 'POST', headers })));
  }
  assert.throws(() => requireSameOrigin(new Request('http://localhost:3000/api/v1/workspaces', { method: 'POST',
    headers: { host: '127.0.0.1:3000', authorization: 'Bearer synthetic' } }), true));
});
test('logo verifier decodes actual transparent images and rejects mislabeled or truncated content', async () => {
  const bytes = await sharp({ create: { width: 40, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  assert.deepEqual(await decodeLogo(bytes), { mimeType: 'image/png', width: 40, height: 20 });
  await assert.rejects(decodeLogo(Buffer.from('<svg><script>alert(1)</script></svg>')));
  await assert.rejects(decodeLogo(bytes.subarray(0, 30)));
});
test('body limits reject streaming overflow without trusting Content-Length', async () => {
  const request = new Request('http://localhost', { method: 'POST', body: new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(4)); controller.enqueue(new Uint8Array(4)); controller.close();
  } }), duplex: 'half' } as RequestInit);
  await assert.rejects(readBoundedBody(request, 6));
});
