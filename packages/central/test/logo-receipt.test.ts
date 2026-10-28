import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { signLogoReceipt, verifyLogoReceipt, LogoReceiptError, LOGO_RECEIPT_MAX_PAYLOAD_BYTES } from '../src/logo-receipt.ts';
import type { LogoReceiptClaims, LogoReceiptScope } from '../src/logo-receipt.ts';

// Public deterministic test values only. No real key is generated or configured.
const key = new Uint8Array(32).fill(7);
const now = 1_793_145_600;
function claims(): LogoReceiptClaims {
  return { schema_version: '1.0', audience: 'eps.logo-verification.v1', purpose: 'client_logo', key_id: 'synthetic-logo-key-v1',
    verification_id: '60000000-0000-4000-8000-000000000001', upload_id: '10000000-0000-4000-8000-000000000001',
    asset_id: '20000000-0000-4000-8000-000000000001', principal_id: '30000000-0000-4000-8000-000000000001',
    workspace_id: '40000000-0000-4000-8000-000000000001', reservation_revision: 1, bucket: 'synthetic-private-branding',
    object_key: 'assets/20000000-0000-4000-8000-000000000001/original.png', size_bytes: 1234,
    sha256: 'a'.repeat(64), mime_type: 'image/png', width: 128, height: 64, issued_at: now, expires_at: now + 120 };
}
function scope(value: LogoReceiptClaims = claims()): LogoReceiptScope {
  const { key_id, verification_id, upload_id, asset_id, principal_id, workspace_id, reservation_revision, bucket, object_key, size_bytes, mime_type, sha256 } = value;
  return { key_id, verification_id, upload_id, asset_id, principal_id, workspace_id, reservation_revision, bucket, object_key, size_bytes, mime_type, sha256 };
}
function signedBytes(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);
  return { payload: bytes.toString('base64url'), mac: createHmac('sha256', key).update(bytes).digest('base64url') };
}
const code = (expected: string) => (error: unknown) => error instanceof LogoReceiptError && error.code === expected;

test('receipt verifies original signed bytes and returns immutable exact scoped claims', () => {
  const input = claims(); const receipt = signLogoReceipt(input, key, { now });
  assert.deepEqual(Object.keys(receipt).sort(), ['mac', 'payload']);
  assert.equal(Buffer.from(receipt.mac, 'base64url').length, 32);
  assert.equal(receipt.mac, createHmac('sha256', key).update(Buffer.from(receipt.payload, 'base64url')).digest('base64url'));
  const verified = verifyLogoReceipt(receipt, key, scope(), { now });
  assert.deepEqual(verified, input); assert.equal(Object.isFrozen(verified), true);
  const noExpectedHash = scope(); delete noExpectedHash.sha256;
  assert.equal(verifyLogoReceipt(receipt, key, noExpectedHash, { now }).sha256, input.sha256);
});

test('a changed payload, another signing key or a tampered MAC cannot authorize completion', () => {
  const receipt = signLogoReceipt(claims(), key, { now });
  const tampered = Buffer.from(receipt.payload, 'base64url').toString('utf8').replace('1234', '1235');
  assert.throws(() => verifyLogoReceipt({ ...receipt, payload: Buffer.from(tampered).toString('base64url') }, key, scope(), { now }), code('LOGO_RECEIPT_SIGNATURE_INVALID'));
  assert.throws(() => verifyLogoReceipt(receipt, new Uint8Array(32).fill(8), scope(), { now }), code('LOGO_RECEIPT_SIGNATURE_INVALID'));
  const bytes = Buffer.from(receipt.mac, 'base64url'); bytes[0] ^= 1;
  assert.throws(() => verifyLogoReceipt({ ...receipt, mac: bytes.toString('base64url') }, key, scope(), { now }), code('LOGO_RECEIPT_SIGNATURE_INVALID'));
});

test('a valid server proof cannot move between actor, reservation, asset, workspace, attempt, key or content scopes', () => {
  const receipt = signLogoReceipt(claims(), key, { now });
  const changes: Partial<LogoReceiptScope>[] = [
    { principal_id: '30000000-0000-4000-8000-000000000002' }, { upload_id: '10000000-0000-4000-8000-000000000002' },
    { asset_id: '20000000-0000-4000-8000-000000000002' }, { workspace_id: '40000000-0000-4000-8000-000000000002' },
    { verification_id: '60000000-0000-4000-8000-000000000002' }, { key_id: 'synthetic-other-key' },
    { reservation_revision: 2 }, { bucket: 'other-private-bucket' }, { object_key: 'assets/other/original.png' },
    { size_bytes: 1235 }, { mime_type: 'image/webp' }, { sha256: 'b'.repeat(64) },
  ];
  for (const change of changes) assert.throws(() => verifyLogoReceipt(receipt, key, { ...scope(), ...change }, { now }), code('LOGO_RECEIPT_SCOPE_MISMATCH'));
});

test('expired, future-issued, inverted, fractional and overlong lifetimes are rejected', () => {
  const receipt = signLogoReceipt(claims(), key, { now });
  assert.throws(() => verifyLogoReceipt(receipt, key, scope(), { now: now + 120 }), code('LOGO_RECEIPT_TIME_INVALID'));
  assert.throws(() => verifyLogoReceipt(receipt, key, scope(), { now: now - 1 }), code('LOGO_RECEIPT_TIME_INVALID'));
  for (const change of [{ expires_at: now + 121 }, { expires_at: now }, { issued_at: now + 1 }, { issued_at: now + .5 }, { expires_at: Number.POSITIVE_INFINITY }]) {
    assert.throws(() => signLogoReceipt({ ...claims(), ...change }, key, { now }), code('LOGO_RECEIPT_TIME_INVALID'));
  }
});

test('strict claims reject unknown fields, wrong purpose/audience/schema and unsafe numeric/media/path values', () => {
  const changes: Record<string, unknown>[] = [
    { verified: true }, { purpose: 'candidate_frame' }, { audience: 'eps.job-output.v1' }, { schema_version: '2.0' },
    { principal_id: 'not-a-uuid' }, { reservation_revision: 0 }, { reservation_revision: Number.MAX_SAFE_INTEGER + 1 },
    { size_bytes: 0 }, { size_bytes: 5 * 1024 * 1024 + 1 }, { size_bytes: '1234' }, { mime_type: 'image/svg+xml' },
    { width: 0 }, { height: 1.2 }, { width: 40_000_000, height: 2 }, { sha256: 'not-a-checksum' },
    { object_key: '../original.png' }, { object_key: 'assets//original.png' }, { object_key: 'assets/secret?x=1' },
    { bucket: 'https://arbitrary.invalid/' }, { key_id: '' },
  ];
  for (const change of changes) {
    const value = { ...claims(), ...change };
    assert.throws(() => signLogoReceipt(value as LogoReceiptClaims, key, { now }), code('LOGO_RECEIPT_CLAIMS_INVALID'));
    assert.throws(() => verifyLogoReceipt(signedBytes(JSON.stringify(value)), key, scope(), { now }), code('LOGO_RECEIPT_CLAIMS_INVALID'));
  }
});

test('encoded/decoded limits and exact MAC size fail before decoding unbounded attacker data', () => {
  const receipt = signLogoReceipt(claims(), key, { now });
  for (const payload of ['A'.repeat(100_000), Buffer.alloc(LOGO_RECEIPT_MAX_PAYLOAD_BYTES + 1).toString('base64url'), 'A', '%%%bad', receipt.payload + '=']) {
    assert.throws(() => verifyLogoReceipt({ ...receipt, payload }, key, scope(), { now }), code('LOGO_RECEIPT_FORMAT_INVALID'));
  }
  for (const mac of ['', 'A'.repeat(42), 'A'.repeat(44), 'A'.repeat(100_000), receipt.mac + '=', '!'.repeat(43)]) {
    assert.throws(() => verifyLogoReceipt({ ...receipt, mac }, key, scope(), { now }), code('LOGO_RECEIPT_FORMAT_INVALID'));
  }
  assert.throws(() => verifyLogoReceipt({ ...receipt, extra: 'not permitted' } as never, key, scope(), { now }), code('LOGO_RECEIPT_FORMAT_INVALID'));
});

test('valid MACs do not bypass strict UTF8, JSON object, missing-field and duplicate-field checks', () => {
  for (const text of ['null', '[]', '{invalid', JSON.stringify({ ...claims(), sha256: undefined }), JSON.stringify(claims()).replace('"size_bytes":1234', '"size_bytes":99,"size_bytes":1234')]) {
    assert.throws(() => verifyLogoReceipt(signedBytes(text), key, scope(), { now }), error => error instanceof LogoReceiptError);
  }
  assert.throws(() => verifyLogoReceipt(signedBytes(new Uint8Array([0xff, 0xfe, 0x00])), key, scope(), { now }), code('LOGO_RECEIPT_FORMAT_INVALID'));
});

test('key and expected scope validation never expose secret bytes or accept permissive defaults', () => {
  for (const invalid of [new Uint8Array(), new Uint8Array(31), new Uint8Array(33), 'synthetic-private-key-value']) {
    assert.throws(() => signLogoReceipt(claims(), invalid as Uint8Array, { now }), code('LOGO_RECEIPT_KEY_INVALID'));
  }
  const receipt = signLogoReceipt(claims(), key, { now });
  assert.throws(() => verifyLogoReceipt(receipt, key, { ...scope(), principal_id: undefined } as never, { now }), code('LOGO_RECEIPT_SCOPE_INVALID'));
  assert.throws(() => verifyLogoReceipt(receipt, key, { ...scope(), allow_all: true } as never, { now }), code('LOGO_RECEIPT_SCOPE_INVALID'));
  try { verifyLogoReceipt({ ...receipt, mac: 'A'.repeat(43) }, key, scope(), { now }); }
  catch (error) { assert.ok(error instanceof LogoReceiptError); assert.doesNotMatch(String(error), /synthetic-private|payload|mac|\[7,7/); }
});
