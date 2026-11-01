import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { DomainError } from '../../packages/domain/src/types.ts';
import type { GuestReviewOperations, ReviewLinkOperations } from '../../packages/domain/src/guest-types.ts';
import { handleGuestReviewRequest, handleReviewLinkRequest } from '../../apps/web/lib/guest-http.ts';
import { createStudioMcpServer, type McpServices } from '../../apps/web/lib/mcp.ts';
import { validateContract } from '../../apps/web/lib/validation.ts';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';
import { withSyntheticApiRoute } from '../fixtures/next-api-route.ts';

const version = '10000000-0000-4000-8000-000000000001';
const slide = '20000000-0000-4000-8000-000000000001';
const actor = { principal_id: 'producer' };
const counts = { preferred: 2, maybe: 1, not_preferred: 0, comment_count: 151, unresolved_count: 101 };
const summary = { version_id: version, per_slide: [{ version_slide_id: slide, ...counts }], totals: counts };
const origin = 'http://127.0.0.1:3000';
const segments = ['versions', version, 'feedback', 'summary'];
const path = `/api/v1/versions/${version}/feedback/summary`;

test('signed-in HTTP and official MCP client share closed body-free summary without pagination', async () => {
  let calls = 0;
  const sharing = { async getFeedbackSummary(a: unknown, id: string) { calls++; assert.deepEqual(a, actor); assert.equal(id, version); return summary; } } as ReviewLinkOperations;
  const response = await handleReviewLinkRequest(new Request(origin + path), segments, actor, sharing, { requestId: 'summary-http' });
  assert.deepEqual((await response.json()).data, summary);
  validateContract('FeedbackSummary', summary);
  assert.match(response.headers.get('cache-control')!, /no-store/u);
  const server = createStudioMcpServer(actor, { studio: syntheticMcpStudio(actor.principal_id), sharing } as McpServices);
  const client = new Client({ name: 'feedback-summary', version: '1.0.0' }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const tool = (await client.listTools()).tools.find(t => t.name === 'get_feedback_summary'); assert(tool);
    assert.equal(tool.annotations?.readOnlyHint, true);
    const result = await client.callTool({ name: 'get_feedback_summary', arguments: { version_id: version } });
    assert.equal(result.isError, undefined); assert.deepEqual((result.structuredContent as { data: unknown }).data, summary);
    const validator = new AjvJsonSchemaValidator(); type Schema = Parameters<typeof validator.getValidator>[0];
    assert.equal(validator.getValidator(tool.outputSchema as Schema)(result.structuredContent).valid, true);
    const before = calls;
    assert.equal((await client.callTool({ name: 'get_feedback_summary', arguments: { version_id: version, limit: 1 } })).isError, true);
    assert.equal(calls, before);
  } finally { await client.close(); await server.close(); }
  assert.equal(calls, 2);
});

test('guest summary retains session/origin/rate/no-store boundary and refuses list query input', async () => {
  const credential = Buffer.alloc(32, 8).toString('base64url'); let calls = 0, rates = 0;
  const service = { async getFeedbackSummary(session: string, id: string) { calls++; assert.equal(session, credential); assert.equal(id, version); return summary; } } as GuestReviewOperations;
  const guestPath = origin + `/api/v1/review/versions/${version}/feedback/summary`;
  const request = (suffix = '', session = true) => new Request(guestPath + suffix, { headers: { host: '127.0.0.1:3000', ...(session ? { 'x-review-session': credential } : {}) } });
  const options = { origin, rateLimit: () => { rates++; } };
  const response = await handleGuestReviewRequest(request(), ['review', ...segments], service, { requestId: 'guest-summary' }, options);
  assert.deepEqual((await response.json()).data, summary); assert.equal(calls, 1); assert.equal(rates, 1);
  assert.match(response.headers.get('cache-control')!, /no-store/u); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  await assert.rejects(handleGuestReviewRequest(request('?limit=1'), ['review', ...segments], service, { requestId: 'bad-query' }, options));
  await assert.rejects(handleGuestReviewRequest(request('', false), ['review', ...segments], service, { requestId: 'no-session' }, options));
  assert.equal(calls, 1);
});

test('actual exported Next route awaits denied/error feedback summary into safe envelopes', async t => {
  let errorCode = 'RESOURCE_NOT_FOUND', calls = 0;
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init), pathname = new URL(request.url).pathname;
    assert.equal(request.headers.get('authorization'), 'Bearer synthetic-summary-user');
    if (pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    calls++; assert.equal(pathname, '/rest/v1/rpc/eps_get_feedback_summary');
    return Response.json({ code: 'P0001', message: errorCode, details: 'PRIVATE_SQL_DIAGNOSTIC' }, { status: 400 });
  });
  await withSyntheticApiRoute({ NODE_ENV: 'test', APP_ENV: 'test', APP_BASE_URL: origin, CENTRAL_ADAPTER_MODE: 'supabase',
    SUPABASE_URL: 'https://summary.synthetic.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_summary',
    EPS_REVIEW_GATEWAY_KEY: Buffer.alloc(32, 3).toString('hex'), EPS_REVIEW_REPLAY_KEY: Buffer.alloc(32, 4).toString('hex') }, async call => {
    for (const [code, status] of [['RESOURCE_NOT_FOUND', 404], ['CAPABILITY_REQUIRED', 403], ['DEPENDENCY_UNAVAILABLE', 503]] as const) {
      errorCode = code;
      const response = await call(new Request(origin + path, { headers: { authorization: 'Bearer synthetic-summary-user' } }), segments);
      const body = await response.json(); assert.equal(response.status, status); assert.equal(body.error.code, code); assert(!JSON.stringify(body).includes('PRIVATE_SQL'));
    }
    const response = await call(new Request(origin + path + '?cursor=forged', { headers: { authorization: 'Bearer synthetic-summary-user' } }), segments);
    assert.equal(response.status, 400); assert.equal(calls, 3);
  });
});

test('signed-in summary refuses cursor/limit before its service and preserves typed denial', async () => {
  let calls = 0;
  const sharing = { async getFeedbackSummary() { calls++; throw new DomainError('CAPABILITY_REQUIRED', 'Denied', 403); } } as unknown as ReviewLinkOperations;
  await assert.rejects(handleReviewLinkRequest(new Request(origin + path + '?limit=1'), segments, actor, sharing, { requestId: 'bad-query' }));
  assert.equal(calls, 0);
  await assert.rejects(handleReviewLinkRequest(new Request(origin + path), segments, actor, sharing, { requestId: 'denied' }), (e: unknown) => e instanceof DomainError && e.code === 'CAPABILITY_REQUIRED');
});

test('both summary GET paths refuse advertised and streamed bodies before calling the service', async () => {
  let calls = 0;
  const sharing = { async getFeedbackSummary() { calls++; return summary; } } as unknown as ReviewLinkOperations;
  const guest = { async getFeedbackSummary() { calls++; return summary; } } as unknown as GuestReviewOperations;
  function request(url: string, headers: Record<string, string>, streamed: boolean) {
    if (!streamed) return new Request(url, { headers: { ...headers, 'Content-Length': '1' } });
    // Fetch forbids constructing GET with a body; model an incoming server
    // stream by overriding only the method of an otherwise real Request.
    const value = new Request(url, { method: 'POST', headers, body: 'synthetic-body' });
    Object.defineProperty(value, 'method', { value: 'GET' }); return value;
  }
  for (const streamed of [false, true]) {
    await assert.rejects(handleReviewLinkRequest(request(origin + path, {}, streamed), segments, actor, sharing, { requestId: 'body-internal' }));
    await assert.rejects(handleGuestReviewRequest(request(origin + '/api/v1/review' + path.slice('/api/v1'.length), {
      host: '127.0.0.1:3000', 'x-review-session': Buffer.alloc(32, 8).toString('base64url'),
    }, streamed), ['review', ...segments], guest, { requestId: 'body-guest' }, { origin, rateLimit: () => {} }));
  }
  assert.equal(calls, 0);
});
