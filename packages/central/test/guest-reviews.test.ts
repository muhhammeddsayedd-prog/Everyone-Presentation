import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralGuestReviews, createCentralReviewLinks } from '../src/guest-reviews.ts';
import { newReviewToken, reviewTokenDigest } from '../src/review-credentials.ts';
import { presentationCanonicalJson } from '../../domain/src/presentation.ts';
import { presentationVersionFixture } from '../../../tests/fixtures/presentation.ts';
import { DomainError } from '../../domain/src/types.ts';

const central = { url: 'https://synthetic-sharing.invalid', publishableKey: 'sb_publishable_synthetic_sharing' };
const now = Date.parse('2026-10-30T00:00:00Z'); const actor = { principal_id: 'producer' }; const key = 'synthetic-sharing-idempotency';
const options = { central, applicationOrigin: 'http://127.0.0.1:3000', gatewayKey: Buffer.alloc(32, 3), replayKey: Buffer.alloc(32, 4), now: () => now };
const link = { id: 'link-1', series_id: 'series-1', label: 'Client', expires_at: '2026-11-29T00:00:00Z', download_enabled: true, revoked_at: null, latest_ready_version_id: null, row_version: 1, created_at: '2026-10-30T00:00:00Z' };
const access = { expires_at: '2026-10-30T01:00:00Z', series_id: 'series-1', version_id: null, download_enabled: true, display_name: null, guest_session_id: '11111111-1111-4111-8111-111111111111' };
const code = (name: string) => (error: unknown) => error instanceof DomainError && error.code === name;
test('create/rotate credentials are encrypted in RPC input and cached exact replay returns original token', async () => {
  let cache: unknown; let calls = 0; const captured: Record<string, unknown>[] = [];
  const client = createBearerUserClient({ ...central, accessToken: 'synthetic-user-token' }, { fetch: async (input, init) => {
    const url = new URL(String(input)); if (url.pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    calls++; const args = JSON.parse(String(init?.body)); captured.push(args);
    assert.equal(url.pathname, '/rest/v1/rpc/eps_create_review_link');
    assert.deepEqual(args.p_input, { label: 'Client' }); assert.equal(args.p_credential.token_digest.length, 64); assert.ok(!Object.hasOwn(args.p_credential, 'token'));
    cache ??= { link, response_encrypted: args.p_credential.response_encrypted }; return Response.json(cache);
  } });
  const api = await createCentralReviewLinks(client, options); const context = { idempotencyKey: key, requestId: 'request', clientType: 'mcp' as const };
  const first = await api.createReviewLink(actor, { series_id: 'series-1', label: 'Client' }, context); const second = await api.createReviewLink(actor, { series_id: 'series-1', label: 'Client' }, context);
  assert.deepEqual(second, first); assert.equal(first.url, 'http://127.0.0.1:3000/r/' + first.token); assert.equal(calls, 2);
  for (const args of captured) assert.ok(!JSON.stringify(args).includes(first.token));
  assert.notDeepEqual(captured[0].p_credential, captured[1].p_credential);
  await assert.rejects(api.createReviewLink({ principal_id: 'other' }, { series_id: 'series-1' }, context), code('ACCESS_DENIED')); assert.equal(calls, 2);
});
test('create and rotate credential payloads require fresh backend proof before cached replay', async () => {
  const calls: Record<string, unknown>[] = []; const cache = new Map<string, unknown>();
  const client = createBearerUserClient({ ...central, accessToken: 'synthetic-user-token' }, { fetch: async (input, init) => {
    const url = new URL(String(input)); if (url.pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    const args = JSON.parse(String(init?.body)); calls.push(args); const operation = url.pathname.endsWith('/eps_create_review_link') ? 'create_review_link' : 'rotate_review_link';
    const { token_digest, response_encrypted, proof } = args.p_credential;
    assert.ok(proof, 'The authenticated user credential mutation must also be backend-admitted.');
    const inputToSign = { actor_id: actor.principal_id, subject_id: args.p_series_id ?? args.p_review_link_id, input: args.p_input, idempotency_key: args.p_idempotency_key, token_digest, response_encrypted };
    const expected = createHmac('sha256', options.gatewayKey).update(presentationCanonicalJson({ operation, input: inputToSign, issued_at: proof.issued_at, nonce: proof.nonce }), 'utf8').digest('hex');
    assert.equal(proof.signature, expected); assert.equal(proof.issued_at, now); assert.match(proof.nonce, /^[a-f0-9]{32}$/u);
    for (const changed of [{ ...inputToSign, actor_id: 'other' }, { ...inputToSign, subject_id: 'other' }, { ...inputToSign, input: { label: 'changed' } }, { ...inputToSign, idempotency_key: 'different-request' }, { ...inputToSign, token_digest: 'f'.repeat(64) }, { ...inputToSign, response_encrypted: 'changed' }])
      assert.notEqual(proof.signature, createHmac('sha256', options.gatewayKey).update(presentationCanonicalJson({ operation, input: changed, issued_at: proof.issued_at, nonce: proof.nonce }), 'utf8').digest('hex'));
    if (!cache.has(operation)) cache.set(operation, { link, response_encrypted }); return Response.json(cache.get(operation));
  } });
  const api = await createCentralReviewLinks(client, options); const trace = { idempotencyKey: key };
  const first = await api.createReviewLink(actor, { series_id: 'series-1', label: 'Client' }, trace); const replayed = await api.createReviewLink(actor, { series_id: 'series-1', label: 'Client' }, trace); assert.deepEqual(replayed, first);
  const rotated = await api.rotateReviewLink(actor, link.id, { row_version: 1 }, trace); const rotatedReplay = await api.rotateReviewLink(actor, link.id, { row_version: 1 }, trace); assert.deepEqual(rotatedReplay, rotated);
  assert.equal(calls.length, 4); const nonces = calls.map(value => (value.p_credential as { proof: { nonce: string } }).proof.nonce); assert.equal(new Set(nonces).size, 4);
});
test('optional update replay is forwarded with actor/correlation and cannot smuggle a new series', async () => {
  const calls: Record<string, unknown>[] = [];
  const client = createBearerUserClient({ ...central, accessToken: 'synthetic-user-token' }, { fetch: async (input, init) => {
    const url = new URL(String(input)); if (url.pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    calls.push(JSON.parse(String(init?.body))); assert.equal(new Headers(init?.headers).get('x-eps-client-type'), 'browser'); return Response.json({ ...link, row_version: 2, download_enabled: false });
  } });
  const api = await createCentralReviewLinks(client, options); await api.updateReviewLink(actor, 'link-1', { row_version: 1, download_enabled: false }, { idempotencyKey: key, clientType: 'browser' });
  assert.deepEqual(calls[0], { p_review_link_id: 'link-1', p_input: { row_version: 1, download_enabled: false }, p_idempotency_key: key });
  await assert.rejects(api.updateReviewLink(actor, 'link-1', { row_version: 1, series_id: 'other' } as never)); assert.equal(calls.length, 1);
});
test('guest exchange sends only digests plus operation-bound backend MAC and keeps session raw only in return memory', async () => {
  const token = newReviewToken(); const calls: Record<string, unknown>[] = [];
  const api = createCentralGuestReviews({ ...options, fetch: async (input, init) => {
    const url = new URL(String(input)); assert.equal(url.pathname, '/rest/v1/rpc/eps_guest_operation'); const args = JSON.parse(String(init?.body)); calls.push(args);
    const { p_operation: operation, p_input: payload, p_proof: proof } = args;
    assert.equal(proof.signature, createHmac('sha256', options.gatewayKey).update(presentationCanonicalJson({ operation, input: payload, issued_at: proof.issued_at, nonce: proof.nonce }), 'utf8').digest('hex'));
    assert.ok(!JSON.stringify(args).includes(token)); return Response.json(access);
  } });
  const result = await api.openReview(token); assert.equal(result.guest_session_id, access.guest_session_id); assert.notEqual(result.access_token, token); assert.ok(!JSON.stringify(calls).includes(result.access_token));
  const open = calls[0].p_input as Record<string, unknown>; assert.equal(open.token_digest, reviewTokenDigest(token)); assert.equal(open.session_digest, reviewTokenDigest(result.access_token));
  await api.getSession(result.access_token); assert.equal(calls[1].p_operation, 'session'); assert.equal((calls[1].p_input as Record<string, unknown>).session_digest, reviewTokenDigest(result.access_token));
});
test('guest current Preparing is null, fixed historical reads remain exact and private internal fields are rejected', async () => {
  const token = newReviewToken(); const version = presentationVersionFixture();
  let result: unknown = null;
  const api = createCentralGuestReviews({ ...options, fetch: async () => Response.json(result) });
  assert.equal(await api.getCurrentVersion(token), null);
  const external = { id: version.id, series_id: version.series_id, version_no: version.version_no, title: version.render_context.cover.title, output_type: version.render_context.cover.output_type,
    status: 'ready', slides: version.slides, created_at: version.created_at, download_enabled: true, cover: version.render_context.cover, template_version: version.template_version, template_content_hash: version.render_context.template.content_sha256 };
  result = external; assert.deepEqual(await api.getVersion(token, version.id), external);
  result = { ...external, render_context: version.render_context }; await assert.rejects(api.getVersion(token, version.id), code('DEPENDENCY_UNAVAILABLE'));
  result = { ...external, id: 'different' }; await assert.rejects(api.getVersion(token, version.id));
});
test('guest errors are allowlisted without raw SQL details and malformed credentials never call RPC', async () => {
  let calls = 0; const api = createCentralGuestReviews({ ...options, fetch: async () => { calls++; return Response.json({ code: 'P0001', message: 'DOWNLOAD_DISABLED', details: 'private SQL text' }, { status: 400 }); } });
  await assert.rejects(api.openReview('bad'), code('REVIEW_ACCESS_DENIED')); assert.equal(calls, 0);
  await assert.rejects(api.getPdfExport(newReviewToken(), 'export-1'), error => code('DOWNLOAD_DISABLED')(error) && !(error as Error).message.includes('private SQL')); assert.equal(calls, 1);
});
