import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { signSpecsReceipt, verifySpecsReceipt, SpecsReceiptError, type SpecsReceiptClaims, type SpecsReceiptScope } from '../src/specs-receipt.ts';

const key = new Uint8Array(32).fill(31); const now = 1_793_145_600;
function claims(): SpecsReceiptClaims {
  return { schema_version: 'specs-original-verification.v1', audience: 'eps.specs-original-verification', purpose: 'specs', key_id: 'synthetic-specs-key',
    verification_id: '60000000-0000-4000-8000-000000000001', upload_id: '10000000-0000-4000-8000-000000000001',
    asset_id: '20000000-0000-4000-8000-000000000001', principal_id: '30000000-0000-4000-8000-000000000001',
    workspace_id: '40000000-0000-4000-8000-000000000001', reservation_revision: 1, bucket: 'eps-specs-assets',
    object_key: 'assets/20000000-0000-4000-8000-000000000001/original.pdf', size_bytes: 1234, sha256: 'a'.repeat(64),
    mime_type: 'application/pdf', verified_format: 'pdf', issued_at: now, expires_at: now + 120 };
}
function scope(value = claims()): SpecsReceiptScope {
  const { key_id, verification_id, upload_id, asset_id, principal_id, workspace_id, reservation_revision, bucket, object_key,
    size_bytes, mime_type, verified_format, sha256 } = value;
  return { key_id, verification_id, upload_id, asset_id, principal_id, workspace_id, reservation_revision, bucket, object_key, size_bytes, mime_type, verified_format, sha256 };
}
const code = (expected: string) => (error: unknown) => error instanceof SpecsReceiptError && error.code === expected;
test('document receipts authenticate the exact original bytes and immutable original-document scope', () => {
  const value = claims(); const receipt = signSpecsReceipt(value, key, { now });
  assert.equal(receipt.mac, createHmac('sha256', key).update(Buffer.from(receipt.payload, 'base64url')).digest('base64url'));
  assert.deepEqual(verifySpecsReceipt(receipt, key, scope(), { now }), value);
  for (const [mime_type, verified_format, extension] of [
    ['application/pdf', 'pdf', 'pdf'], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx', 'docx'], ['text/plain', 'utf8_text', 'txt'],
  ] as const) {
    const document = { ...claims(), mime_type, verified_format, size_bytes: 20 * 1024 * 1024, object_key: `assets/${claims().asset_id}/original.${extension}` };
    assert.deepEqual(verifySpecsReceipt(signSpecsReceipt(document, key, { now }), key, scope(document), { now }), document);
  }
  for (const change of [{ principal_id: '30000000-0000-4000-8000-000000000002' }, { reservation_revision: 2 }, { sha256: 'b'.repeat(64) },
    { key_id: 'other-key' }, { workspace_id: '40000000-0000-4000-8000-000000000002' }]) {
    assert.throws(() => verifySpecsReceipt(receipt, key, { ...scope(), ...change }, { now }), code('SPECS_RECEIPT_SCOPE_MISMATCH'));
  }
});
test('logo-purpose, mixed MIME/format, foreign keys, oversized and secret-bearing claims cannot be signed', () => {
  for (const change of [{ purpose: 'client_logo' }, { audience: 'eps.logo-verification.v1' }, { schema_version: '1.0' },
    { verified_format: 'docx' }, { object_key: 'assets/other/original.pdf' }, { bucket: 'eps-brand-assets' },
    { size_bytes: 20 * 1024 * 1024 + 1 }, { width: 1 }, { text: 'private-source' }, { issued_at: now + 1 }, { expires_at: now + 121 }]) {
    assert.throws(() => signSpecsReceipt({ ...claims(), ...change } as SpecsReceiptClaims, key, { now }), error => {
      assert.ok(error instanceof SpecsReceiptError); assert(!JSON.stringify(error).includes('private-source')); return true;
    });
  }
});
test('wrong keys, tampered MACs, expired proofs and noncanonical JSON cannot verify', () => {
  const receipt = signSpecsReceipt(claims(), key, { now });
  assert.throws(() => verifySpecsReceipt(receipt, new Uint8Array(32).fill(30), scope(), { now }), code('SPECS_RECEIPT_SIGNATURE_INVALID'));
  assert.throws(() => verifySpecsReceipt(receipt, key, scope(), { now: now + 120 }), code('SPECS_RECEIPT_TIME_INVALID'));
  const bytes = Buffer.from(JSON.stringify(claims(), null, 2));
  const alternate = { payload: bytes.toString('base64url'), mac: createHmac('sha256', key).update(bytes).digest('base64url') };
  assert.throws(() => verifySpecsReceipt(alternate, key, scope(), { now }), code('SPECS_RECEIPT_CLAIMS_INVALID'));
});
