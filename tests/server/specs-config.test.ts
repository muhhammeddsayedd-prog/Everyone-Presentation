import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { verifySpecsReceipt } from '@eps/central';
import { readCentralSpecsOptions } from '../../apps/web/lib/specs-config.ts';

const key = Buffer.alloc(32, 49); const encoded = key.toString('base64url');
const base = { CENTRAL_SPECS_UPLOADS_ENABLED: 'true', SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic-test-key',
  SPECS_VERIFICATION_KEY_ID: 'synthetic-specs-key', SPECS_VERIFICATION_KEY_BASE64URL: encoded };
const facts = { verification_id: '70000000-0000-4000-8000-000000000001', upload_id: '50000000-0000-4000-8000-000000000001',
  asset_id: '60000000-0000-4000-8000-000000000001', principal_id: '10000000-0000-4000-8000-000000000001', workspace_id: '30000000-0000-4000-8000-000000000001',
  reservation_revision: 1, bucket: 'eps-specs-assets', object_key: 'assets/60000000-0000-4000-8000-000000000001/original.txt',
  size_bytes: 3, sha256: 'a'.repeat(64), mime_type: 'text/plain' as const, verified_format: 'utf8_text' as const };

test('document readiness defaults off and rejects invalid flags, partial/reused keys and unexpected bucket config safely', () => {
  assert.equal(readCentralSpecsOptions({}), undefined); assert.equal(readCentralSpecsOptions({ ...base, CENTRAL_SPECS_UPLOADS_ENABLED: 'false' }), undefined);
  for (const changed of [{ CENTRAL_SPECS_UPLOADS_ENABLED: 'enabled' }, { SPECS_VERIFICATION_KEY_ID: '' }, { SPECS_VERIFICATION_KEY_BASE64URL: '' },
    { SPECS_VERIFICATION_KEY_BASE64URL: Buffer.alloc(31).toString('base64url') }, { SPECS_ASSET_BUCKET: 'foreign' },
    { LOGO_VERIFICATION_KEY_BASE64URL: encoded }, { LOGO_VERIFICATION_KEY_ID: base.SPECS_VERIFICATION_KEY_ID }]) {
    assert.throws(() => readCentralSpecsOptions({ ...base, ...changed }), error => error instanceof DomainError
      && error.code === 'SPECS_STORAGE_CONFIGURATION_REQUIRED' && error.status === 503 && !String(error).includes(encoded));
  }
});

test('configured readiness supplies the real structural verifier and only signs the dedicated original-document audience', async () => {
  const options = readCentralSpecsOptions(base)!;
  assert.equal(options.storageOrigin, base.SUPABASE_URL);
  assert.deepEqual(await options.verifyDocument!(Buffer.from('abc'), 'text/plain', { sourceAssetId: facts.asset_id }), { mimeType: 'text/plain', format: 'utf8_text' });
  const receipt = await options.signReceipt!(facts);
  const claims = verifySpecsReceipt(receipt, key, { ...facts, key_id: base.SPECS_VERIFICATION_KEY_ID });
  assert.equal(claims.purpose, 'specs'); assert.equal(claims.audience, 'eps.specs-original-verification'); assert.equal(claims.expires_at - claims.issued_at, 90);
  assert.doesNotMatch(JSON.stringify(options), /SPECS_VERIFICATION_KEY|synthetic-specs-key/);
});
