import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@eps/domain';
import { createCentralStudio, createBearerUserClient } from '../src/index.ts';
import { summaryId as id, workspaceSummaryFixture as summary } from '../../../tests/fixtures/workspace-summary.ts';

async function fixture() {
  let result: unknown = summary(), status = 200;
  const requests: { operation: string; input: unknown; headers: Headers }[] = [];
  const actor = { principal_id: id(9) };
  const client = createBearerUserClient({ url: 'https://summary.synthetic.invalid', publishableKey: 'sb_publishable_synthetic_summary', accessToken: 'synthetic-summary-user' }, {
    fetch: async (input, init) => {
      const request = new Request(input, init), path = new URL(request.url).pathname;
      assert.equal(request.headers.get('authorization'), 'Bearer synthetic-summary-user');
      if (path === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
      assert.equal(path, '/rest/v1/rpc/eps_get_workspace_summary');
      requests.push({ operation: 'eps_get_workspace_summary', input: await request.json(), headers: request.headers });
      return Response.json(result, { status });
    },
  });
  return { actor, studio: await createCentralStudio(client), requests, response(value: unknown, code = 200) { result = value; status = code; } };
}

test('summary SDK makes one actor-scoped aggregate call and preserves one revision/count snapshot', async () => {
  const h = await fixture(), result = await h.studio.getWorkspaceSummary(h.actor, id(1));
  assert.deepEqual(result, summary());
  assert.equal(h.requests.length, 1); assert.deepEqual(h.requests[0].input, { p_workspace_id: id(1) });
  assert.equal(h.requests[0].headers.has('Idempotency-Key'), false);
  h.response({ ...summary(), unreviewed_candidate_count: 0, row_version: 4, draft_revision: 10 });
  assert.deepEqual(await h.studio.getWorkspaceSummary(h.actor, id(1)), { ...summary(), unreviewed_candidate_count: 0, row_version: 4, draft_revision: 10 });
});

test('summary rejects actor substitution and malformed request before RPC', async () => {
  const h = await fixture();
  await assert.rejects(() => h.studio.getWorkspaceSummary({ principal_id: id(8) }, id(1)), (error: unknown) => error instanceof DomainError && error.status === 403);
  await assert.rejects(() => h.studio.getWorkspaceSummary(h.actor, 'forged'), (error: unknown) => error instanceof DomainError && error.status === 400);
  assert.equal(h.requests.length, 0);
});

test('summary rejects cross-workspace, inconsistent and private extra response data', async () => {
  const h = await fixture();
  for (const value of [{ ...summary(), workspace_id: id(7) }, { ...summary(), facts: { name: 'forbidden' } },
    { ...summary(), assignment_count: { selection: 0, shortlist: 1 } }, { ...summary(), latest_ready_versions: summary().latest_ready_versions.toReversed() }]) {
    h.response(value);
    await assert.rejects(() => h.studio.getWorkspaceSummary(h.actor, id(1)), (error: unknown) => error instanceof DomainError && error.code === 'CENTRAL_RESPONSE_INVALID');
  }
});

test('summary preserves scoped authorization errors and never exposes SQL diagnostics', async () => {
  const h = await fixture();
  for (const [code, status] of [['RESOURCE_NOT_FOUND', 404], ['CAPABILITY_REQUIRED', 403], ['AUTH_REQUIRED', 401],
    ['WORKSPACE_SUMMARY_INVALID', 503], ['WORKSPACE_SUMMARY_LIMIT_EXCEEDED', 503]] as const) {
    h.response({ code: 'P0001', message: code, details: 'private provider diagnostic' }, 400);
    await assert.rejects(() => h.studio.getWorkspaceSummary(h.actor, id(1)), (error: unknown) => error instanceof DomainError && error.code === code && error.status === status && !JSON.stringify(error).includes('private provider'));
  }
});
