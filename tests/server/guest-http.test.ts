import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGuestReviewRequest, createGuestRateLimiter, guestSessionCookieName, handleReviewLinkRequest } from '../../apps/web/lib/guest-http.ts';
import type { GuestAccess, GuestReviewOperations, ReviewLinkOperations } from '../../packages/domain/src/guest-types.ts';

const origin = 'http://127.0.0.1:3000';
const context = { requestId: 'request-1', idempotencyKey: 'stable-request-key-1234', clientType: 'browser' as const };
const sessionId = '11111111-1111-4111-8111-111111111111';
const otherSessionId = '22222222-2222-4222-8222-222222222222';
const versionId = '33333333-3333-4333-8333-333333333333';
const assetId = '44444444-4444-4444-8444-444444444444';
const credential = Buffer.alloc(32, 9).toString('base64url');
const access: GuestAccess = { access_token: credential, guest_session_id: sessionId, series_id: 'series-1', version_id: 'version-1', download_enabled: true, display_name: null, expires_at: '2026-11-01T00:00:00Z' };
function request(path: string, method = 'GET', headers: Record<string, string> = {}, body?: unknown) {
  return new Request(origin + '/api/v1/' + path, { method, headers: { host: '127.0.0.1:3000', ...(method !== 'GET' ? { Origin: origin } : {}), ...headers,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function service(methods: Partial<GuestReviewOperations>) { return new Proxy(methods, { get(target, name) { if (name in target) return target[name as keyof typeof target]; return () => { throw new Error('Unexpected guest operation'); }; } }) as GuestReviewOperations; }
const options = { origin, rateLimit: () => {} };
const cookieHeader = { Cookie: `${guestSessionCookieName(sessionId)}=${credential}`, 'X-Review-Context': sessionId };
test('browser token exchange sets scoped HttpOnly cookie and omits raw credentials from JSON', async () => {
  let calls = 0; const result = await handleGuestReviewRequest(request('review/open', 'POST', { 'X-Review-Token': credential, 'X-EPS-Review-Browser': '1' }), ['review', 'open'], service({ async openReview(token) { calls++; assert.equal(token, credential); return access; } }), context, options);
  assert.equal(calls, 1); const data = await result.json(); assert.ok(!JSON.stringify(data).includes(credential)); assert.ok(!Object.hasOwn(data.data, 'access_token'));
  const cookie = result.headers.get('set-cookie')!; assert.ok(cookie.startsWith(`${guestSessionCookieName(sessionId)}=${credential};`)); assert.ok(cookie.includes('HttpOnly')); assert.ok(cookie.includes('SameSite=Strict')); assert.ok(cookie.includes('Path=/api/v1/review;'));
  assert.match(result.headers.get('cache-control')!, /no-store/u); assert.equal(result.headers.get('referrer-policy'), 'no-referrer');
});
test('API token exchange retains published GuestAccess without creating browser cookie', async () => {
  const result = await handleGuestReviewRequest(request('review/open', 'POST', { 'X-Review-Token': credential }), ['review', 'open'], service({ async openReview() { return access; } }), context, options);
  assert.equal((await result.json()).data.access_token, credential); assert.equal(result.headers.get('set-cookie'), null);
});
test('cross-origin browser exchange is denied before token resolution', async () => {
  let called = false;
  await assert.rejects(() => handleGuestReviewRequest(request('review/open', 'POST', { Origin: 'https://other.example', 'X-Review-Token': credential, 'X-EPS-Review-Browser': '1' }), ['review', 'open'], service({ async openReview() { called = true; return access; } }), context, options));
  assert.equal(called, false);
});
test('different-tab context selects only its own cookie and never silently changes identity', async () => {
  let calls = 0;
  const guest = service({ async getSession(raw) { calls++; assert.equal(raw, credential); return access; } });
  const good = await handleGuestReviewRequest(request('review/session', 'GET', cookieHeader), ['review', 'session'], guest, context, options);
  assert.equal((await good.json()).data.guest_session_id, sessionId); assert.equal(calls, 1);
  await assert.rejects(() => handleGuestReviewRequest(request('review/session', 'GET', { ...cookieHeader, 'X-Review-Context': otherSessionId }), ['review', 'session'], guest, context, options)); assert.equal(calls, 1);
});
test('identity uses PUT and remembered label cannot inject visibility or principal', async () => {
  let calls = 0; const guest = service({ async identify(raw, input, metadata) { calls++; assert.equal(raw, credential); assert.deepEqual(input, { display_name: 'Reviewer', company: null }); assert.equal(metadata?.idempotencyKey, context.idempotencyKey); return { ...access, display_name: input.display_name }; } });
  const result = await handleGuestReviewRequest(request('review/identity', 'PUT', cookieHeader, { display_name: 'Reviewer', company: null }), ['review', 'identity'], guest, context, options);
  const body = await result.json(); assert.equal(body.data.display_name, 'Reviewer'); assert.ok(!Object.hasOwn(body.data, 'access_token')); assert.equal(calls, 1);
  await assert.rejects(() => handleGuestReviewRequest(request('review/identity', 'PUT', cookieHeader, { display_name: 'Reviewer', principal_id: 'other' }), ['review', 'identity'], guest, context, options)); assert.equal(calls, 1);
});
test('cookie feedback mutations require exact origin even when credentials are present', async () => {
  let called = false;
  await assert.rejects(() => handleGuestReviewRequest(request('review/versions/version/comments', 'POST', { ...cookieHeader, Origin: 'https://other.example' }, { version_slide_id: 'slide-1', body: 'Comment' }), ['review', 'versions', 'version', 'comments'], service({ async createComment() { called = true; throw new Error(); } }), context, options)); assert.equal(called, false);
});
test('binary public context query selects cookie; secret token query is refused', async () => {
  let calls = 0;
  const guest = service({ async getMediaContent(raw, version, asset, range) { calls++; assert.equal(raw, credential); assert.equal(version, versionId); assert.equal(asset, assetId); assert.equal(range, 'bytes=1-2'); return { body: new Response('ok').body!, mimeType: 'video/mp4', size: 2, status: 206, contentRange: 'bytes 1-2/4' }; } });
  const path = `review/versions/${versionId}/media/${assetId}/content`;
  const result = await handleGuestReviewRequest(request(path + '?review_context=' + sessionId, 'GET', { Cookie: cookieHeader.Cookie, Range: 'bytes=1-2' }), path.split('/'), guest, context, options);
  assert.equal(result.status, 206); assert.equal(result.headers.get('content-range'), 'bytes 1-2/4'); assert.equal(await result.text(), 'ok');
  await assert.rejects(() => handleGuestReviewRequest(request(path + '?review_context=' + sessionId + '&token=raw', 'GET', { Cookie: cookieHeader.Cookie }), path.split('/'), guest, context, options)); assert.equal(calls, 1);
});
test('grant exchange stores exact version/asset-scoped cookie with no secret URL response', async () => {
  const path = `review-media/versions/${versionId}/media/${assetId}/playback`; const local = origin + `/api/v1/review-media/versions/${versionId}/media/${assetId}/content`;
  const guest = service({ async playGrantMedia(raw, version, asset) { assert.equal(raw, credential); assert.equal(version, versionId); assert.equal(asset, assetId); return { asset_id: asset, source_version_id: version, mime_type: 'video/mp4', url: local, expires_at: access.expires_at }; } });
  const result = await handleGuestReviewRequest(request(path, 'POST', { 'X-Media-Grant': credential, 'X-EPS-Review-Browser': '1' }), path.split('/'), guest, context, options);
  assert.ok(!JSON.stringify(await result.json()).includes(credential)); const cookie = result.headers.get('set-cookie')!; assert.ok(cookie.includes(`Path=/api/v1/review-media/versions/${versionId}/media/${assetId};`));
  const resumed = await handleGuestReviewRequest(request(path, 'POST', { Cookie: cookie.split(';')[0], 'X-EPS-Review-Browser': '1' }), path.split('/'), guest, context, options); assert.equal(resumed.status, 200);
});
test('guest throttling is credential-bound, bounded, and expires its window', () => {
  let now = 0; const limit = createGuestRateLimiter(() => now); for (let i = 0; i < 20; i++) limit(credential, true); assert.throws(() => limit(credential, true));
  limit('other-credential', true); now = 60001; assert.doesNotThrow(() => limit(credential, true));
});
test('internal link updates carry acting user and optional exact replay context', async () => {
  const actor = { principal_id: 'producer' }; let called = false; const sharing = { async updateReviewLink(received: unknown, id: string, body: unknown, metadata: unknown) {
    called = true; assert.deepEqual(received, actor); assert.equal(id, 'link-1'); assert.deepEqual(body, { row_version: 1, download_enabled: false }); assert.deepEqual(metadata, context); return { id }; } } as unknown as ReviewLinkOperations;
  const result = await handleReviewLinkRequest(request('review-links/link-1', 'PATCH', {}, { row_version: 1, download_enabled: false }), ['review-links', 'link-1'], actor, sharing, context); assert.equal(result.status, 200); assert.equal(called, true);
});
