import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { decryptReviewReplay, encryptReviewReplay, newReviewToken, reviewKey, reviewToken, reviewTokenDigest, signReviewGateway } from '../src/review-credentials.ts';
import { presentationCanonicalJson } from '../../domain/src/presentation.ts';

test('review credentials contain 256 random bits in one canonical URL-safe encoding', () => {
  const a = newReviewToken(); const b = newReviewToken(); assert.notEqual(a, b); assert.equal(Buffer.from(a, 'base64url').length, 32);
  assert.equal(reviewToken(a), a); assert.match(reviewTokenDigest(a), /^[a-f0-9]{64}$/u);
  for (const value of ['', a + '=', a.slice(1), ' '.repeat(43), 'a'.repeat(44)]) assert.throws(() => reviewToken(value));
});
test('encrypted creation replay is randomized, authenticated and bound to user/operation/request', () => {
  const token = newReviewToken(); const key = Buffer.alloc(32, 9); const context = { actor: 'producer', operation: 'create', idempotency_key: 'same-request-1234' };
  const first = encryptReviewReplay(token, key, context); const second = encryptReviewReplay(token, key, context);
  assert.notEqual(first, second); assert.ok(!first.includes(token)); assert.equal(decryptReviewReplay(first, key, context), token);
  for (const wrong of [{ ...context, actor: 'other' }, { ...context, operation: 'rotate' }, { ...context, idempotency_key: 'other-request-123' }]) assert.throws(() => decryptReviewReplay(first, key, wrong));
  assert.throws(() => decryptReviewReplay(first, Buffer.alloc(32, 8), context));
  const parts = first.split('.'); parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1); assert.throws(() => decryptReviewReplay(parts.join('.'), key, context));
});
test('gateway MAC binds every input and includes a single-use nonce/time fence', () => {
  const key = Buffer.alloc(32, 7); const input = { session_digest: 'a'.repeat(64), version_id: 'version', text: 'مرحبا' }; const issuedAt = 1793319000000; const nonce = 'b'.repeat(32);
  const proof = signReviewGateway('get_version', input, key, issuedAt, nonce);
  assert.deepEqual(proof, { issued_at: issuedAt, nonce, signature: createHmac('sha256', key).update(presentationCanonicalJson({ operation: 'get_version', input, issued_at: issuedAt, nonce }), 'utf8').digest('hex') });
  assert.notEqual(proof.signature, signReviewGateway('get_version', { ...input, version_id: 'other' }, key, issuedAt, nonce).signature);
  assert.notEqual(proof.signature, signReviewGateway('get_asset', input, key, issuedAt, nonce).signature);
});
test('review key parsing fails closed without including supplied configuration', () => {
  for (const value of [undefined, '', 'invalid-private-value', 'a'.repeat(63), 'A'.repeat(64)]) assert.throws(() => reviewKey(value), error => error instanceof Error && (!value || !error.message.includes(value)));
  assert.equal(reviewKey('ab'.repeat(32)).byteLength, 32);
});
