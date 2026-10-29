import assert from 'node:assert/strict';
import test from 'node:test';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralPresentations } from '../src/presentation.ts';
import { DomainError } from '../../domain/src/types.ts';
import { presentationId, presentationVersionFixture } from '../../../tests/fixtures/presentation.ts';

const actor = { principal_id: presentationId(51) };
const trace = { idempotencyKey: 'synthetic-presentation-intent', requestId: 'presentation-request', clientType: 'mcp' as const };
async function fixture() {
  let response: unknown = presentationVersionFixture(); let error: unknown;
  const calls: { name: string; args: unknown; headers: Headers }[] = [];
  const client = createBearerUserClient({ url: 'https://synthetic-presentations.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-user-token' }, { fetch: async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    calls.push({ name: url.pathname.split('/').at(-1)!, args: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return Response.json(error ?? response, { status: error ? 400 : 200 });
  } });
  return { api: await createCentralPresentations(client, { storageOrigin: 'https://synthetic-presentations.invalid' }), calls,
    set: (value: unknown) => { response = value; }, error: (value: unknown) => { error = value; } };
}
const code = (name: string) => (error: unknown) => error instanceof DomainError && error.code === name;

test('version facade preserves exact three generation guards, actor identity and correlation', async () => {
  const h = await fixture(); const version = presentationVersionFixture();
  assert.deepEqual(await h.api.getVersion(actor, version.id), version);
  assert.deepEqual(h.calls[0].args, { p_version_id: version.id });
  const input = { expected_workspace_row_version: 3, expected_draft_revision: 2, expected_input_fingerprint: 'a'.repeat(64) };
  const accepted = { job_id: presentationId(50), resource_id: version.id, poll_url: `/api/v1/jobs/${presentationId(50)}`, status: 'queued' };
  h.set(accepted); assert.deepEqual(await h.api.generateVersion(actor, version.series_id, input, trace), accepted);
  assert.deepEqual(h.calls.at(-1)?.args, { p_series_id: version.series_id, p_input: input, p_idempotency_key: trace.idempotencyKey });
  assert.equal(h.calls.at(-1)?.headers.get('X-EPS-Request-ID'), trace.requestId); assert.equal(h.calls.at(-1)?.headers.get('X-EPS-Client-Type'), 'mcp');
  const before = h.calls.length;
  await assert.rejects(h.api.getVersion({ principal_id: 'forged' }, version.id), code('ACCESS_DENIED'));
  await assert.rejects(h.api.generateVersion(actor, version.series_id, input, { idempotencyKey: 'short' }), code('IDEMPOTENCY_KEY_REQUIRED'));
  assert.equal(h.calls.length, before);
});

test('version response and cursor scope fail closed without leaking raw database errors', async () => {
  const h = await fixture(); const version = presentationVersionFixture();
  h.set({ data: [version], page: { next_cursor: 'opaque' } });
  assert.equal((await h.api.listVersions(actor, version.series_id, { limit: 1 })).page.next_cursor, 'opaque');
  assert.deepEqual(h.calls.at(-1)?.args, { p_series_id: version.series_id, p_options: { limit: 1 } });
  h.set({ ...version, bucket: 'private' }); await assert.rejects(h.api.getVersion(actor, version.id), code('CENTRAL_RESPONSE_INVALID'));
  h.error({ code: 'P0001', message: 'INPUT_CHANGED', details: 'private source text' });
  await assert.rejects(h.api.generateVersion(actor, version.series_id, { expected_workspace_row_version: 3, expected_draft_revision: 2, expected_input_fingerprint: 'a'.repeat(64) }, trace),
    error => code('INPUT_CHANGED')(error) && !(error as Error).message.includes('private source'));
});
test('invalid server Storage configuration fails before any user or data request', async () => {
  let calls = 0;
  const client = createBearerUserClient({ url: 'https://synthetic-presentations.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-user-token' },
    { fetch: async () => { calls++; return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false }); } });
  await assert.rejects(createCentralPresentations(client, { storageOrigin: 'file:///untrusted' }), code('CENTRAL_CONFIGURATION_REQUIRED'));
  assert.equal(calls, 0);
});
