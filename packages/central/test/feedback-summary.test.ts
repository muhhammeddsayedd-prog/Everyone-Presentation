import assert from 'node:assert/strict';
import test from 'node:test';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralGuestReviews, createCentralReviewLinks } from '../src/guest-reviews.ts';
import { DomainError } from '../../domain/src/types.ts';

const version = '10000000-0000-4000-8000-000000000001';
const slide = '20000000-0000-4000-8000-000000000001';
const actor = { principal_id: 'producer' };
const central = { url: 'https://synthetic-sharing.invalid', publishableKey: 'sb_publishable_synthetic_sharing' };
const counts = { preferred: 1, maybe: 2, not_preferred: 0, comment_count: 151, unresolved_count: 101 };
const summary = { version_id: version, per_slide: [{ version_slide_id: slide, ...counts }], totals: counts };
const options = { central, applicationOrigin: 'http://127.0.0.1:3000', gatewayKey: Buffer.alloc(32, 3), replayKey: Buffer.alloc(32, 4), now: () => Date.parse('2026-11-01T00:00:00Z') };
const code = (value: string) => (e: unknown) => e instanceof DomainError && e.code === value;

test('internal summary uses only verified acting-user RPC and rejects cross-actor reads', async () => {
  let calls = 0;
  const client = createBearerUserClient({ ...central, accessToken: 'synthetic-user-token' }, { fetch: async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    calls++; assert.equal(url.pathname, '/rest/v1/rpc/eps_get_feedback_summary');
    assert.deepEqual(JSON.parse(String(init?.body)), { p_version_id: version });
    return Response.json(summary);
  } });
  const service = await createCentralReviewLinks(client, options);
  assert.deepEqual(await service.getFeedbackSummary(actor, version), summary);
  await assert.rejects(service.getFeedbackSummary({ principal_id: 'other' }, version), code('ACCESS_DENIED'));
  assert.equal(calls, 1);
});

test('guest summary retains fixed signed operation/session digest and requested version', async () => {
  const session = Buffer.alloc(32, 9).toString('base64url');
  const service = createCentralGuestReviews({ ...options, fetch: async (input, init) => {
    assert.equal(new URL(String(input)).pathname, '/rest/v1/rpc/eps_guest_operation');
    const args = JSON.parse(String(init?.body));
    assert.equal(args.p_operation, 'get_feedback_summary');
    assert.equal(args.p_input.version_id, version);
    assert.match(args.p_input.session_digest, /^[a-f0-9]{64}$/u);
    assert(!JSON.stringify(args).includes(session)); assert(args.p_proof);
    return Response.json(summary);
  } });
  assert.deepEqual(await service.getFeedbackSummary(session, version), summary);
});

test('summary response mismatch and body-bearing provider data fail safely', async () => {
  for (const response of [{ ...summary, version_id: slide }, { ...summary, body: 'synthetic private body' }]) {
    const service = createCentralGuestReviews({ ...options, fetch: async () => Response.json(response) });
    await assert.rejects(service.getFeedbackSummary(Buffer.alloc(32, 9).toString('base64url'), version), code('DEPENDENCY_UNAVAILABLE'));
  }
});
