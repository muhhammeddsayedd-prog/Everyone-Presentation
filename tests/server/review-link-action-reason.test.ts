import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { ReviewLinkAction } from '../../packages/domain/src/guest-types.ts';
import { DomainError } from '../../packages/domain/src/types.ts';
import { parseReviewLinkAction } from '../../packages/domain/src/review-link-action.ts';
import { parseGuestRowVersion } from '../../packages/domain/src/guest.ts';
import { createBearerUserClient } from '../../packages/central/src/client.ts';
import { createCentralReviewLinks } from '../../packages/central/src/guest-reviews.ts';
import { signReviewGateway } from '../../packages/central/src/review-credentials.ts';
import { presentationCanonicalJson } from '../../packages/domain/src/presentation.ts';
import { handleReviewLinkRequest } from '../../apps/web/lib/guest-http.ts';
import { createStudioMcpServer, type McpServices } from '../../apps/web/lib/mcp.ts';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';

const actor = { principal_id: '10000000-0000-4000-8000-000000000001' };
const id = '20000000-0000-4000-8000-000000000001';
const origin = 'http://127.0.0.1:3000';
const context = { idempotencyKey: 'synthetic-review-action-key', requestId: 'synthetic-action-request', clientType: 'api' as const };
const link = { id, series_id: '30000000-0000-4000-8000-000000000001', label: 'Synthetic',
  expires_at: '2026-12-01T00:00:00Z', download_enabled: false, revoked_at: null,
  latest_ready_version_id: null, row_version: 2, created_at: '2026-11-01T00:00:00Z' };
type Call = { name: string; body: Record<string, unknown>; headers: Headers };

// Only the network boundary is a fixture. Real user verification, central RPC
// parsing, credential MAC, HTTP parser and official MCP client/server execute.
async function fixture() {
  const calls: Call[] = [];
  const gatewayKey = Buffer.alloc(32, 8);
  const client = createBearerUserClient({ url: 'https://synthetic-action.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-user-token' }, { fetch: async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', is_anonymous: false });
    const name = url.pathname.split('/').at(-1)!;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ name, body, headers: new Headers(init?.headers) });
    if (name === 'eps_revoke_review_link') return Response.json(link);
    if (name === 'eps_rotate_review_link') return Response.json({ link, response_encrypted: (body.p_credential as Record<string, unknown>).response_encrypted });
    throw new Error('Unexpected synthetic RPC');
  } });
  const sharing = await createCentralReviewLinks(client, { central: { url: 'https://synthetic-action.invalid', publishableKey: 'sb_publishable_synthetic' },
    applicationOrigin: origin, replayKey: Buffer.alloc(32, 7), gatewayKey, now: () => 1793577600000 });
  return { sharing, calls, gatewayKey };
}

function request(operation: string, body: unknown) {
  return new Request(`${origin}/api/v1/review-links/${id}/${operation}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
const inputs = [
  { row_version: 1 }, { row_version: 1, reason: null }, { row_version: 1, reason: '' },
  { row_version: 1, reason: '  Supplied reason\n\t\u0001\u007f\u0085 مرحبا 🙂  ' },
  { row_version: 1, reason: 'x'.repeat(12000) },
  { row_version: 1, reason: 'x'.repeat(65536 - JSON.stringify({ row_version: 1, reason: '' }).length) },
];

test('the action parser preserves omitted/null/exact text while the unrelated row-version parser stays strict', () => {
  for (const input of inputs) assert.deepEqual(parseReviewLinkAction(input), input);
  assert.equal(Buffer.byteLength(JSON.stringify(inputs.at(-1)), 'utf8'), 65536);
  assert.throws(() => parseGuestRowVersion({ row_version: 1, reason: 'Supplied' }));
  assert.deepEqual(parseGuestRowVersion({ row_version: 1 }), { row_version: 1 });
  assert.throws(() => parseReviewLinkAction(Object.assign(Object.create({ inherited: true }), { row_version: 1 })));
});

test('HTTP revoke and rotate preserve optional reason exactly through the verified central RPC and rotation MAC', async () => {
  const state = await fixture();
  for (const operation of ['revoke', 'rotate']) for (const input of inputs) {
    const response = await handleReviewLinkRequest(request(operation, input), ['review-links', id, operation], actor, state.sharing, context);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(Object.hasOwn(operation === 'rotate' ? result.data.link : result.data, 'reason'), false);
    const call = state.calls.at(-1)!;
    assert.equal(call.name, `eps_${operation}_review_link`);
    assert.deepEqual(call.body.p_input, input);
    assert.equal(Object.hasOwn(call.body.p_input as object, 'reason'), Object.hasOwn(input, 'reason'));
    assert.equal(call.body.p_idempotency_key, context.idempotencyKey);
    assert.equal(call.headers.get('x-eps-request-id'), context.requestId);
    assert.equal(call.headers.get('x-eps-client-type'), 'api');
    if (operation === 'rotate') {
      const credential = call.body.p_credential as { token_digest: string; response_encrypted: string; proof: { issued_at: number; nonce: string; signature: string } };
      const signed = { actor_id: actor.principal_id, subject_id: id, input, idempotency_key: context.idempotencyKey,
        token_digest: credential.token_digest, response_encrypted: credential.response_encrypted };
      assert.deepEqual(credential.proof, signReviewGateway('rotate_review_link', signed, state.gatewayKey, credential.proof.issued_at, credential.proof.nonce));
      const altered = { ...signed, input: { ...input, reason: 'Changed intent' } };
      assert.notEqual(credential.proof.signature, signReviewGateway('rotate_review_link', altered, state.gatewayKey, credential.proof.issued_at, credential.proof.nonce).signature);
    }
  }
});

test('official MCP revoke and rotate use the same optional reason body and correlated verified-user RPC', async () => {
  const state = await fixture();
  const server = createStudioMcpServer(actor, { sharing: state.sharing, studio: syntheticMcpStudio(actor.principal_id) } as McpServices);
  const client = new Client({ name: 'synthetic-review-action', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    for (const operation of ['revoke', 'rotate']) for (const body of inputs) {
      const result = await client.callTool({ name: `${operation}_review_link`, arguments: { review_link_id: id, body, idempotency_key: context.idempotencyKey } });
      assert.equal(result.isError, undefined);
      assert.equal(Object.hasOwn(result.structuredContent as object, 'reason'), false);
      const call = state.calls.at(-1)!;
      assert.deepEqual(call.body.p_input, body);
      assert.equal(call.body.p_idempotency_key, context.idempotencyKey);
      assert.equal(call.headers.get('x-eps-client-type'), 'mcp');
      assert.match(call.headers.get('x-eps-request-id')!, /^[A-Za-z0-9._:-]{1,128}$/u);
    }
  } finally { await client.close(); await server.close(); }
});

test('invalid action fields, unrepresentable text and oversized HTTP bodies fail before a mutation RPC', async () => {
  const state = await fixture();
  const invalid = [{ row_version: 0 }, { row_version: 1, reason: 3 }, { row_version: 1, reason: {} },
    { row_version: 1, reason: '\u0000' }, { row_version: 1, reason: '\ud800' }, { row_version: 1, principal_id: 'forged' }];
  for (const operation of ['revoke', 'rotate']) {
    for (const body of invalid) await assert.rejects(handleReviewLinkRequest(request(operation, body), ['review-links', id, operation], actor, state.sharing, context));
    await assert.rejects(handleReviewLinkRequest(request(operation, { row_version: 1, reason: 'x'.repeat(65536) }), ['review-links', id, operation], actor, state.sharing, context));
    await assert.rejects(state.sharing[operation === 'rotate' ? 'rotateReviewLink' : 'revokeReviewLink'](actor, id, { row_version: 1, reason: undefined } as ReviewLinkAction, context));
    await assert.rejects(state.sharing[operation === 'rotate' ? 'rotateReviewLink' : 'revokeReviewLink']({ principal_id: 'forged' }, id, { row_version: 1, reason: 'Supplied' }, context),
      error => error instanceof DomainError && error.code === 'ACCESS_DENIED');
  }
  assert.equal(state.calls.length, 0);
});

test('rotation credential MAC keeps legacy bytes and admits JSONB controls only in the exact optional reason', () => {
  const key = Buffer.alloc(32, 9); const now = 1793577600000; const nonce = '0'.repeat(32);
  const credentialInput = { actor_id: actor.principal_id, subject_id: id, input: { row_version: 1 } as Record<string, unknown>,
    idempotency_key: context.idempotencyKey, token_digest: 'a'.repeat(64), response_encrypted: 'synthetic-ciphertext' };
  for (const action of [{ row_version: 1 }, { row_version: 1, reason: null }, { row_version: 1, reason: '' },
    { row_version: 1, reason: ' Supplied\n\tمرحبا 🙂 ' }, { row_version: 1, reason: 'x'.repeat(12000) }]) {
    const input = { ...credentialInput, input: action };
    const payload = { operation: 'rotate_review_link', input, issued_at: now, nonce };
    const expected = createHmac('sha256', key).update(presentationCanonicalJson(payload), 'utf8').digest('hex');
    assert.equal(signReviewGateway('rotate_review_link', input, key, now, nonce).signature, expected);
  }
  const reason = Array.from({ length: 31 }, (_, index) => String.fromCodePoint(index + 1)).join('') + '\u007f🙂';
  const input = { ...credentialInput, input: { row_version: 1, reason } };
  // Independent JSON reference; unlike the presentation text parser, JSONB
  // represents every supplied character here without trimming or replacement.
  function canonical(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  const expected = createHmac('sha256', key).update(canonical({ operation: 'rotate_review_link', input, issued_at: now, nonce }), 'utf8').digest('hex');
  assert.equal(signReviewGateway('rotate_review_link', input, key, now, nonce).signature, expected);
  assert.throws(() => signReviewGateway('create_review_link', input, key, now, nonce));
  assert.throws(() => signReviewGateway('rotate_review_link', { ...input, actor_id: '\u0001' }, key, now, nonce));
  assert.throws(() => signReviewGateway('rotate_review_link', { ...input, input: { ...input.input, extra: '\u0001' } }, key, now, nonce));
  assert.throws(() => signReviewGateway('rotate_review_link', { ...input, input: { row_version: 1, reason: '\u0000' } }, key, now, nonce));
  assert.throws(() => signReviewGateway('rotate_review_link', { ...input, input: { row_version: 1, reason: '\udfff' } }, key, now, nonce));
});
