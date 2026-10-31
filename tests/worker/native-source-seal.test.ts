import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyNativeSourceSeal } from '../../apps/worker/src/native-source-seal.ts';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const files = [{ path: 'apps/worker/src/native-sandbox.ts', sha256: hash('SYNTHETIC_SOURCE'), bytes: 16 }];
const source = { source_sha256: hash(JSON.stringify(files)), files };
test('native source seal verifies exact source list/hash/bytes before admitting an image manifest', () => {
  assert.doesNotThrow(() => verifyNativeSourceSeal(source, source.source_sha256, () => Buffer.from('SYNTHETIC_SOURCE')));
  assert.throws(() => verifyNativeSourceSeal(source, source.source_sha256, () => Buffer.from('CHANGED_SOURCE')));
});
test('source seals reject malformed/traversing/sensitive paths before any filesystem read', () => {
  for (const path of ['../.env', 'C:/secret', '/outside', 'apps/worker/src/../../secret', 'apps/web/.env.local']) {
    const files = [{ path, sha256: hash('PRIVATE'), bytes: 7 }]; let reads = 0;
    assert.throws(() => verifyNativeSourceSeal({ source_sha256: hash(JSON.stringify(files)), files }, hash(JSON.stringify(files)), () => { reads++; return Buffer.from('PRIVATE'); }));
    assert.equal(reads, 0);
  }
});
