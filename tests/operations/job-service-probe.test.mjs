import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decryptProbeState, encryptProbeState, validateProbeIntent } from '../../tools/probe-job-service-http.mjs';

const now = Date.parse('2026-10-29T09:00:00.000Z');
const intent = { schema_version: '1.0', job_id: '733a0000-0000-4000-8000-000000000001', workspace_id: '733b0000-0000-4000-8000-000000000001', stage: 'prepare_document', input_hash: 'c'.repeat(64), approved_at: new Date(now).toISOString() };
test('HTTP probe requires a fresh isolated exact reviewed job and rejects protected draft identifiers', () => {
  assert.deepEqual(validateProbeIntent(intent, now), intent);
  for (const changed of [{ job_id: 'b3f90268-147d-41d4-8875-2a6435df1496' }, { workspace_id: '098d5b48-42a3-475b-b562-735c9eafce80' }, { stage: 'apply_specs' }, { bearer: 'unrequested' }, { approved_at: new Date(now - 3600001).toISOString() }]) assert.throws(() => validateProbeIntent({ ...intent, ...changed }, now));
});
test('ignored state contains authenticated encrypted lease data only and rejects tampering/wrong key', () => {
  const value = { intent, lease: { lease_token: 'synthetic-private-lease', attempt_id: 'synthetic-attempt' } };
  const key = 'a'.repeat(64); const encrypted = encryptProbeState(value, key);
  assert.ok(!JSON.stringify(encrypted).includes('synthetic-private-lease'));
  assert.deepEqual(decryptProbeState(encrypted, key), value);
  assert.throws(() => decryptProbeState(encrypted, 'b'.repeat(64)));
  assert.throws(() => decryptProbeState({ ...encrypted, tag: '0'.repeat(22) }, key));
});
