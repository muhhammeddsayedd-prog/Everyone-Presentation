import assert from 'node:assert/strict';
import { test } from 'node:test';
import { optionalPrivateGuestEnvironment, parsePrivateGuestEnvironment, PrivateGuestConfigError } from '../../tools/private-guest-env.mjs';

test('guest configuration keeps separate verifier and replay keys and rejects ambiguous input', () => {
  const first = 'a'.repeat(64), second = 'b'.repeat(64);
  const document = `EPS_REVIEW_GATEWAY_KEY=${first}\nEPS_REVIEW_REPLAY_KEY=${second}\n`;
  assert.deepEqual(parsePrivateGuestEnvironment(document), { EPS_REVIEW_GATEWAY_KEY: first, EPS_REVIEW_REPLAY_KEY: second });
  for (const bad of [document.replace(second, first), document + 'EXTRA=true\n', document.replace(/\n/gu, '\r\n'), document.slice(0, -1), document.replace(first, 'x'.repeat(64)), document.replace('EPS_REVIEW_GATEWAY_KEY', 'NEXT_PUBLIC_REVIEW_GATEWAY_KEY')]) assert.throws(() => parsePrivateGuestEnvironment(bad), PrivateGuestConfigError);
});
test('optional guest configuration fails closed without stopping existing central reads', async () => {
  assert.deepEqual(await optionalPrivateGuestEnvironment(async () => { throw new PrivateGuestConfigError(); }), { environment: {}, unavailable: true });
  await assert.rejects(optionalPrivateGuestEnvironment(async () => { throw new Error('unexpected'); }));
});
