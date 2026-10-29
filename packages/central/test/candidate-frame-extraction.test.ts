import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralFrameExtraction } from '../src/candidate-frame-extraction.ts';
const actorId = '10000000-0000-4000-8000-000000000001'; const actor = { principal_id: actorId }; const media = '20000000-0000-4000-8000-000000000001'; const source = '30000000-0000-4000-8000-000000000001'; const job = '40000000-0000-4000-8000-000000000001';
const accepted = { job_id: job, resource_id: media, poll_url: `/api/v1/jobs/${job}`, status: 'queued' };
function fixture(response: unknown = accepted, error?: string) {
  const requests: { path: string; body: unknown; headers: Headers }[] = [];
  const client = createBearerUserClient({ url: 'https://synthetic-frames.example.invalid', publishableKey: 'sb_publishable_synthetic_frames', accessToken: 'synthetic-user-token' }, { fetch: async (value, init) => {
    const path = new URL(value instanceof Request ? value.url : String(value)).pathname; const headers = new Headers(init?.headers); assert.equal(headers.get('Authorization'), 'Bearer synthetic-user-token');
    if (path === '/auth/v1/user') return Response.json({ id: actorId, role: 'authenticated', is_anonymous: false });
    requests.push({ path, body: JSON.parse(String(init?.body)), headers });
    return error ? Response.json({ code: 'P0001', message: error, details: 'private SQL/source text', hint: 'private access token' }, { status: 400 }) : Response.json(response);
  } }); return { client, requests };
}
test('frame extraction sends only bounded source/timestamp references under the verified actor and stable intent', async () => {
  const state = fixture(); const service = await createCentralFrameExtraction(state.client);
  assert.deepEqual(await service.extractCandidateFrames(actor, media, { source_asset_id: source, timestamps_ms: [1250, 0] }, { idempotencyKey: 'synthetic-frame-intent', requestId: 'frame-request', clientType: 'mcp' }), accepted);
  assert.equal(state.requests.length, 1); assert.equal(state.requests[0].path, '/rest/v1/rpc/eps_extract_candidate_frames');
  assert.deepEqual(state.requests[0].body, { p_candidate_media_id: media, p_input: { source_asset_id: source, timestamps_ms: [0, 1250] }, p_idempotency_key: 'synthetic-frame-intent' });
  assert.equal(state.requests[0].headers.get('x-eps-client-type'), 'mcp'); assert.equal(state.requests[0].headers.get('x-eps-request-id'), 'frame-request');
  await assert.rejects(service.extractCandidateFrames({ principal_id: 'forged' }, media, { source_asset_id: source, timestamps_ms: [0] }, { idempotencyKey: 'synthetic-frame-intent' }), { code: 'ACCESS_DENIED' });
  await assert.rejects(service.extractCandidateFrames(actor, media, { source_asset_id: source, timestamps_ms: [0, 0] }, { idempotencyKey: 'synthetic-frame-intent' }));
  await assert.rejects(service.extractCandidateFrames(actor, media, { source_asset_id: source, timestamps_ms: [0] }, { idempotencyKey: 'short' })); assert.equal(state.requests.length, 1);
});
test('frame acknowledgement rejects foreign polling destinations, wrong resource or hidden fields', async () => {
  for (const value of [{ ...accepted, poll_url: 'https://untrusted.example/jobs' }, { ...accepted, resource_id: source }, { ...accepted, private_payload: 'private frames' }, { ...accepted, status: 'ready' }]) {
    const service = await createCentralFrameExtraction(fixture(value).client); await assert.rejects(service.extractCandidateFrames(actor, media, { source_asset_id: source, timestamps_ms: [0] }, { idempotencyKey: 'synthetic-frame-intent' }), { code: 'CENTRAL_RESPONSE_INVALID' });
  }
});
test('current permission/source errors remain classified without forwarding raw SQL details', async () => {
  for (const [error, status] of [['CAPABILITY_REQUIRED', 403], ['MEDIA_REFERENCE_INVALID', 422], ['INPUT_CHANGED', 409]] as const) {
    const service = await createCentralFrameExtraction(fixture(undefined, error).client);
    await assert.rejects(service.extractCandidateFrames(actor, media, { source_asset_id: source, timestamps_ms: [0] }, { idempotencyKey: 'synthetic-frame-intent' }), value => {
      assert(value instanceof DomainError); assert.equal(value.code, error); assert.equal(value.status, status); assert.doesNotMatch(JSON.stringify(value), /private SQL|private access/u); return true;
    });
  }
});
