import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { parsePrivateSpecsFiles, explicitSpecsEnvironment, optionalPrivateSpecsEnvironment, PrivateSpecsConfigError } from '../../tools/private-specs-env.mjs';

const keyId = 'eps-specs-dev-20261029-v1';
const secret = { SPECS_VERIFICATION_KEY_ID: keyId, SPECS_VERIFICATION_KEY_BASE64URL: Buffer.alloc(32, 72).toString('base64url') };
const phase = { version: 1, target: 'pyibofyctwnqpvktepse', key_id: keyId, phase: 'completed', claim_id: '70000000-0000-4000-8000-000000000001',
  secret_file: '.local/specs-assets-verifier/verifier.json', created_at: '2026-10-29T00:00:00Z', completed_at: '2026-10-29T00:01:00Z', contains_secret: false };
const phaseBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const secretBytes = value => Buffer.from(JSON.stringify(value) + '\n');
const denied = error => error instanceof PrivateSpecsConfigError && !String(error).includes(secret.SPECS_VERIFICATION_KEY_BASE64URL);

test('only a completed fixed-target canonical phase/key pair supplies the exact two private fields', () => {
  assert.deepEqual(parsePrivateSpecsFiles(phaseBytes(phase), secretBytes(secret)), secret);
  for (const changed of [{ phase: 'pending' }, { target: 'different' }, { key_id: 'different' }, { secret_file: '../foreign' },
    { contains_secret: true }, { completed_at: '2025-01-01T00:00:00Z' }, { claim_id: 'invalid' }, { extra: 'private-sentinel' }]) {
    assert.throws(() => parsePrivateSpecsFiles(phaseBytes({ ...phase, ...changed }), secretBytes(secret)), denied);
  }
  for (const bytes of [Buffer.from('{"SPECS_VERIFICATION_KEY_ID":"wrong",' + JSON.stringify(secret).slice(1) + '\n'),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), secretBytes(secret)]),
    secretBytes({ ...secret, CENTRAL_SPECS_UPLOADS_ENABLED: 'true' }), secretBytes({ ...secret, SPECS_VERIFICATION_KEY_BASE64URL: 'invalid' }), Buffer.alloc(513)]) {
    assert.throws(() => parsePrivateSpecsFiles(phaseBytes(phase), bytes), denied);
  }
});

test('nonempty process key pair wins over file configuration without returning or modifying either pair', () => {
  assert.equal(explicitSpecsEnvironment({}, {}), null);
  assert.deepEqual(explicitSpecsEnvironment(secret, { ...secret, SPECS_VERIFICATION_KEY_ID: 'file-key' }), {});
  assert.deepEqual(explicitSpecsEnvironment({ SPECS_VERIFICATION_KEY_ID: '' }, secret), secret);
  assert.deepEqual(explicitSpecsEnvironment({ SPECS_VERIFICATION_KEY_ID: secret.SPECS_VERIFICATION_KEY_ID }, secret), {
    SPECS_VERIFICATION_KEY_BASE64URL: secret.SPECS_VERIFICATION_KEY_BASE64URL });
  assert.throws(() => explicitSpecsEnvironment({ SPECS_VERIFICATION_KEY_ID: 'partial' }, {}), denied);
  assert.throws(() => explicitSpecsEnvironment({ ...secret, SPECS_VERIFICATION_KEY_BASE64URL: 'invalid' }, secret), denied);
});

test('known optional key loading errors degrade to read-only while unexpected failures remain fatal', async () => {
  assert.deepEqual(await optionalPrivateSpecsEnvironment(async () => secret), { environment: secret, unavailable: false });
  assert.deepEqual(await optionalPrivateSpecsEnvironment(async () => { throw new PrivateSpecsConfigError(); }), { environment: {}, unavailable: true });
  await assert.rejects(optionalPrivateSpecsEnvironment(async () => { throw new Error('synthetic-core-failure'); }), /synthetic-core-failure/u);
});
