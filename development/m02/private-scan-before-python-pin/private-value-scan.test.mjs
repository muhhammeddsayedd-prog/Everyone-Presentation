import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { zipSync } from 'fflate';
import { containsPrivateValue, inspectGitBatch, inspectPackZip, privatePatterns, requirePrivateSnapshot, PrivateScanError } from '../../tools/scan-private-values.mjs';

// Only synthetic values. Never call the fixed-files scanner in offline tests.
const openai = 'sk-synthetic-private-value-Aa1Bb2Cc3Dd4';
const n8n = 'synthetic-management-private-value-Ee5Ff6Gg7';
const password = 'synthetic-database-private-value-Hh8Ii9Jj0';
const dispatch = 'synthetic-webhook-private-value-Kk1Ll2Mm3';
const logo = Buffer.alloc(32, 81); const specs = Buffer.alloc(32, 97);
const material = { worker: Buffer.from(`OPENAI_API_KEY=${openai}\nN8N_API_KEY=${n8n}\n`),
  runtime: Buffer.from(`EPS_SPECS_PG_PASSWORD=${password}\nN8N_DISPATCH_SECRET=${dispatch}\n`),
  logo: Buffer.from(JSON.stringify({ LOGO_VERIFICATION_KEY_ID: 'eps-logo-dev-20261028-v1', LOGO_VERIFICATION_KEY_BASE64URL: logo.toString('base64url') }) + '\n'),
  specs: Buffer.from(JSON.stringify({ SPECS_VERIFICATION_KEY_ID: 'eps-specs-dev-20261029-v1', SPECS_VERIFICATION_KEY_BASE64URL: specs.toString('base64url') }) + '\n') };
const patterns = privatePatterns(material);
const sha = value => createHash('sha256').update(value).digest('hex');
function archive(content = Buffer.from('Public fixture'), manifestChange = value => value, extra = {}) {
  const expected = new Map([['README.md', { bytes: content.length, sha256: sha(content) }]]);
  const manifest = manifestChange({ project: 'Everyone Presentation Studio', kind: 'current development source', observed_at: '2026-10-29T00:00:00Z',
    status: 'Controlled fixture', supplied_manifest: 'Historical inventory retained', files: [{ path: 'README.md', bytes: content.length, sha256: sha(content) }] });
  return { expected, bytes: Buffer.from(zipSync({ 'Everyone-Presentation-Studio/README.md': content,
    'Everyone-Presentation-Studio/SOURCE_MANIFEST.json': Buffer.from(JSON.stringify(manifest)), ...extra })) };
}

test('actual parsed values and binary keys are found in raw, hex, base64, base64url and UTF16 encodings without printing them', () => {
  for (const value of [Buffer.from(openai), Buffer.from(n8n), Buffer.from(password), Buffer.from(dispatch), logo, specs]) {
    for (const encoding of [value, Buffer.from(value.toString('hex')), Buffer.from(value.toString('hex').toUpperCase()),
      Buffer.from(value.toString('base64')), Buffer.from(value.toString('base64url')), Buffer.from(value.toString('base64url'), 'utf16le')]) {
      assert.equal(containsPrivateValue(Buffer.concat([Buffer.from('prefix'), encoding, Buffer.from('suffix')]), patterns), true);
    }
  }
  assert.equal(containsPrivateValue(Buffer.from('Public key ID eps-specs-dev-20261029-v1; synthetic source'), patterns), false);
  assert.throws(() => containsPrivateValue(Buffer.from('text'), [null]), PrivateScanError);
  for (const prefix of ['', 'X', 'XY']) {
    for (const encoding of ['utf8', 'utf16le']) {
      const payload = Buffer.from(prefix + openai + '-suffix', encoding);
      assert.equal(containsPrivateValue(Buffer.from(payload.toString('base64')), patterns), true);
      assert.equal(containsPrivateValue(Buffer.from(payload.toString('base64url')), patterns), true);
    }
  }
});

test('a rotated private input after pattern capture blocks a clean result without exposing old/new values', () => {
  const before = [0, 1, 2, 3].map(index => ({ dev: 1n, ino: BigInt(index), size: 100n, mtimeNs: 2n, ctimeNs: 3n }));
  requirePrivateSnapshot(before, before.map(value => ({ ...value })));
  const after = before.map(value => ({ ...value })); after[2].mtimeNs++;
  assert.throws(() => requirePrivateSnapshot(before, after), error => error instanceof PrivateScanError && error.code === 'PRIVATE_SCAN_CONFIGURATION_CHANGED');
});

test('missing/duplicate/partial configuration fails closed instead of reporting an incomplete clean scan', () => {
  for (const changed of [{ worker: Buffer.from('OPENAI_API_KEY=\nN8N_API_KEY=\n') },
    { worker: Buffer.concat([material.worker, Buffer.from(`OPENAI_API_KEY=${openai}\n`)]) }, { runtime: Buffer.from('EPS_SPECS_PG_PASSWORD=only\n') },
    { specs: Buffer.from('{}\n') }, { logo: Buffer.from(material.logo.toString().replace('"}', '","extra":true}')) }]) {
    assert.throws(() => privatePatterns({ ...material, ...changed }), error => error instanceof PrivateScanError && !String(error).includes(openai));
  }
  assert.equal(containsPrivateValue(Buffer.from(openai), privatePatterns({ ...material,
    worker: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), material.worker]) })), true);
});

test('staged blob parsing checks exact object identities, sizes and binary boundaries with no path/value diagnostics', () => {
  const object = 'a'.repeat(40); const content = Buffer.from(openai);
  const batch = Buffer.concat([Buffer.from(`${object} blob ${content.length}\n`), content, Buffer.from('\n')]);
  assert.deepEqual(inspectGitBatch(batch, [object], patterns), { blobs: 1, bytes: content.length, hits: 1 });
  for (const bad of [batch.subarray(0, batch.length - 1), Buffer.concat([batch, Buffer.from('extra')]), Buffer.from(`${object} missing\n`)]) {
    assert.throws(() => inspectGitBatch(bad, [object], patterns), PrivateScanError);
  }
});

test('fixed package archive verifies genuine ZIP CRC and exact source/manifest bytes while exposing only counts', async () => {
  const value = archive(); const result = await inspectPackZip(value.bytes, value.expected, patterns);
  assert.equal(result.manifest_integrity_verified, true); assert.equal(result.entries, 2); assert.equal(result.hits, 0);
  assert.equal(Object.hasOwn(result, 'sha256'), false);
});

test('an otherwise valid archive containing an encoded private value reports a hit without values or their digests', async () => {
  const leaked = Buffer.from(specs.toString('base64')); const value = archive(leaked);
  const result = await inspectPackZip(value.bytes, value.expected, patterns);
  assert.equal(result.hits, 1); assert.equal(result.manifest_integrity_verified, true);
  assert.ok(!JSON.stringify(result).includes(leaked.toString())); assert.ok(!JSON.stringify(result).includes(sha(specs)));
});

test('stale manifest bytes, unexpected/traversal paths and corrupted checksums never produce clean archive evidence', async () => {
  const stale = archive(Buffer.from('Public fixture'), value => ({ ...value, files: [{ ...value.files[0], sha256: '0'.repeat(64) }] }));
  await assert.rejects(inspectPackZip(stale.bytes, stale.expected, patterns), PrivateScanError);
  const traversal = archive(Buffer.from('Public fixture'), value => value, { 'Everyone-Presentation-Studio/../unexpected': Buffer.from('hidden') });
  await assert.rejects(inspectPackZip(traversal.bytes, traversal.expected, patterns), PrivateScanError);
  const corrupt = archive();
  for (let index = 0; index <= corrupt.bytes.length - 20; index++) if (corrupt.bytes.readUInt32LE(index) === 0x02014b50) corrupt.bytes.writeUInt32LE(0, index + 16);
  await assert.rejects(inspectPackZip(corrupt.bytes, corrupt.expected, patterns), PrivateScanError);
});
