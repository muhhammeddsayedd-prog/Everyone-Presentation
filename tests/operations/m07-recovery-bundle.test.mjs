import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRecoveryBundle, restoreRecoveryBundle, verifyRecoveryBundle } from '../../tools/m07-recovery-bundle.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const runId = randomUUID(); const root = path.resolve('.local/m07-recovery-tests', runId);
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'owner.json'), JSON.stringify({ run_id: runId, purpose: 'm07-synthetic-local-recovery', workspace: path.resolve('.') }), { flag: 'wx' });
  const bytes = Buffer.from('synthetic byte content');
  const objects = [{ asset_id: '07000000-0000-4000-8000-000000000001', bucket: 'eps-candidate-assets', object_key: 'assets/synthetic/original.mp4', size_bytes: bytes.length, sha256: sha(bytes) }];
  const sourceFiles = new Map([['packages/templates/versions/1.1.0/registry.json', Buffer.from('{"synthetic":true}')]]);
  const input = { root, runId, metadata: Buffer.from('-- synthetic local metadata\n'), objects, objectBytes: new Map([[objects[0].asset_id, bytes]]), sourceFiles };
  return { root, runId, bytes, objects, input };
}
test('restores metadata and every exact referenced object plus source bytes into a new destination', async () => {
  const f = await fixture(); const bundle = await createRecoveryBundle(f.input);
  assert.equal((await verifyRecoveryBundle(f.root, f.runId, 'backup')).objects, 1);
  await restoreRecoveryBundle(f.root, f.runId);
  assert.equal((await verifyRecoveryBundle(f.root, f.runId, 'restored')).objects, 1);
  assert.deepEqual(await readFile(path.join(f.root, 'restored/objects', f.objects[0].asset_id)), f.bytes);
  assert.equal(bundle.scope, 'synthetic-local-filesystem');
  await assert.rejects(restoreRecoveryBundle(f.root, f.runId), /RECOVERY_DESTINATION_EXISTS/);
});
test('refuses a missing referenced object before creating a backup', async () => {
  const f = await fixture(); f.input.objectBytes.clear();
  await assert.rejects(createRecoveryBundle(f.input), /RECOVERY_OBJECT_COVERAGE/);
});
test('refuses corrupt object bytes before creating a backup', async () => {
  const f = await fixture(); f.input.objectBytes.set(f.objects[0].asset_id, Buffer.from('wrong'));
  await assert.rejects(createRecoveryBundle(f.input), /RECOVERY_CHECKSUM_MISMATCH/);
});
test('refuses tampering in a saved backup before creating a restored destination', async () => {
  const f = await fixture(); await createRecoveryBundle(f.input);
  await writeFile(path.join(f.root, 'backup/objects', f.objects[0].asset_id), Buffer.from('tampered'));
  await assert.rejects(restoreRecoveryBundle(f.root, f.runId), /RECOVERY_CHECKSUM_MISMATCH/);
});
test('rejects malicious storage paths and duplicate assets rather than writing arbitrary files', async () => {
  for (const invalid of ['../escape', '/absolute', 'a\\escape', 'a//b', 'a/%2e%2e/escape']) {
    const f = await fixture(); f.objects[0].object_key = invalid;
    await assert.rejects(createRecoveryBundle(f.input), /RECOVERY_MANIFEST_INVALID/);
  }
  const f = await fixture(); f.objects.push({ ...f.objects[0] });
  await assert.rejects(createRecoveryBundle(f.input), /RECOVERY_MANIFEST_INVALID/);
});
test('requires exact existing ownership and refuses an unrelated root', async () => {
  const f = await fixture();
  await writeFile(path.join(f.root, 'owner.json'), JSON.stringify({ run_id: randomUUID(), purpose: 'm07-synthetic-local-recovery', workspace: path.resolve('.') }));
  await assert.rejects(createRecoveryBundle(f.input), /RECOVERY_OWNERSHIP_REQUIRED/);
  await assert.rejects(createRecoveryBundle({ ...f.input, root: path.resolve('.') }), /RECOVERY_ROOT_INVALID/);
});
test('rejects a modified manifest whose object identity no longer matches the sealed file name', async () => {
  const f = await fixture(); await createRecoveryBundle(f.input);
  const file = path.join(f.root, 'backup/manifest.json'); const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.objects[0].file = '../owner.json'; await writeFile(file, JSON.stringify(manifest));
  await assert.rejects(verifyRecoveryBundle(f.root, f.runId, 'backup'), /RECOVERY_MANIFEST_INVALID/);
});
