/** Synthetic local recovery rehearsal only. No Storage API, credentials, cloud
 * target, overwrite, deletion, shell command or database connection. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
const WORKSPACE = path.resolve(import.meta.dirname, '..');
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw new Error(code); };
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const safePath = value => typeof value === 'string' && value.length <= 512 && value.split('/').every(part => /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(part) && part !== '.' && part !== '..');
async function owned(root, runId) {
  if (!UUID.test(runId)) fail('RECOVERY_OWNERSHIP_REQUIRED');
  const resolved = path.resolve(root);
  if (![path.join(WORKSPACE, '.local', 'm07-recovery', runId), path.join(WORKSPACE, '.local', 'm07-recovery-tests', runId)].includes(resolved)) fail('RECOVERY_ROOT_INVALID');
  for (let current = resolved; current !== WORKSPACE; current = path.dirname(current)) {
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink() || path.resolve(await realpath(current)) !== current) fail('RECOVERY_ROOT_INVALID');
  }
  const marker = path.join(resolved, 'owner.json'); const info = await lstat(marker);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 4096) fail('RECOVERY_OWNERSHIP_REQUIRED');
  const owner = JSON.parse(await readFile(marker, 'utf8'));
  if (!exact(owner, ['run_id', 'purpose', 'workspace']) || owner.run_id !== runId || owner.workspace !== WORKSPACE || owner.purpose !== 'm07-synthetic-local-recovery') fail('RECOVERY_OWNERSHIP_REQUIRED');
  return resolved;
}
function validate(value, runId) {
  if (!exact(value, ['schema_version', 'scope', 'run_id', 'metadata', 'objects', 'sources']) || value.schema_version !== '1.0' || value.scope !== 'synthetic-local-filesystem' || value.run_id !== runId || !Array.isArray(value.objects) || !Array.isArray(value.sources) || value.objects.length > 1000 || value.sources.length > 2000) fail('RECOVERY_MANIFEST_INVALID');
  const file = entry => exact(entry, ['file', 'size_bytes', 'sha256']) && HASH.test(entry.sha256) && Number.isSafeInteger(entry.size_bytes) && entry.size_bytes > 0 && entry.size_bytes <= 128 * 1024 * 1024;
  if (!file(value.metadata) || value.metadata.file !== 'metadata.sql') fail('RECOVERY_MANIFEST_INVALID');
  const ids = new Set(); const physical = new Set(); const sourcePaths = new Set();
  for (const object of value.objects) {
    if (!exact(object, ['asset_id', 'bucket', 'object_key', 'size_bytes', 'sha256', 'file']) || !UUID.test(object.asset_id) || !/^[a-z0-9][a-z0-9-]{0,99}$/u.test(object.bucket) || !safePath(object.object_key) || object.file !== `objects/${object.asset_id}` || !file({ file: object.file, size_bytes: object.size_bytes, sha256: object.sha256 }) || ids.has(object.asset_id) || physical.has(`${object.bucket}/${object.object_key}`)) fail('RECOVERY_MANIFEST_INVALID');
    ids.add(object.asset_id); physical.add(`${object.bucket}/${object.object_key}`);
  }
  for (const [index, source] of value.sources.entries()) {
    if (!exact(source, ['path', 'size_bytes', 'sha256', 'file']) || !safePath(source.path) || source.file !== `sources/${index}` || !file({ file: source.file, size_bytes: source.size_bytes, sha256: source.sha256 }) || sourcePaths.has(source.path)) fail('RECOVERY_MANIFEST_INVALID');
    sourcePaths.add(source.path);
  }
  return value;
}
function checked(bytes, entry) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== entry.size_bytes || sha(bytes) !== entry.sha256) fail('RECOVERY_CHECKSUM_MISMATCH');
  return bytes;
}
async function newDestination(root, name) {
  const destination = path.join(root, name);
  try { await mkdir(destination, { mode: 0o700 }); } catch (error) { if (error.code === 'EEXIST') fail('RECOVERY_DESTINATION_EXISTS'); throw error; }
  await mkdir(path.join(destination, 'objects'), { mode: 0o700 }); await mkdir(path.join(destination, 'sources'), { mode: 0o700 });
  return destination;
}
async function checkedRead(root, entry) {
  const file = path.join(root, entry.file);
  for (const current of [path.dirname(file), file]) {
    const info = await lstat(current);
    if (info.isSymbolicLink() || path.resolve(await realpath(current)) !== current) fail('RECOVERY_ROOT_INVALID');
  }
  const info = await lstat(file);
  if (!info.isFile() || info.size !== entry.size_bytes) fail('RECOVERY_CHECKSUM_MISMATCH');
  return checked(await readFile(file), entry);
}
export async function createRecoveryBundle({ root, runId, metadata, objects, objectBytes, sourceFiles }) {
  root = await owned(root, runId);
  if (!(metadata instanceof Uint8Array) || !(objectBytes instanceof Map) || !(sourceFiles instanceof Map) || !Array.isArray(objects)) fail('RECOVERY_MANIFEST_INVALID');
  const manifest = validate({ schema_version: '1.0', scope: 'synthetic-local-filesystem', run_id: runId, metadata: { file: 'metadata.sql', size_bytes: metadata.length, sha256: sha(metadata) }, objects: objects.map(object => ({ ...object, file: `objects/${object.asset_id}` })), sources: [...sourceFiles].map(([source, bytes], index) => ({ path: source, file: `sources/${index}`, size_bytes: bytes.length, sha256: sha(bytes) })) }, runId);
  if (objectBytes.size !== manifest.objects.length || manifest.objects.some(object => !objectBytes.has(object.asset_id))) fail('RECOVERY_OBJECT_COVERAGE');
  for (const object of manifest.objects) checked(objectBytes.get(object.asset_id), object);
  const destination = await newDestination(root, 'backup');
  await writeFile(path.join(destination, 'metadata.sql'), metadata, { flag: 'wx', mode: 0o600 });
  for (const object of manifest.objects) await writeFile(path.join(destination, object.file), objectBytes.get(object.asset_id), { flag: 'wx', mode: 0o600 });
  for (const source of manifest.sources) await writeFile(path.join(destination, source.file), sourceFiles.get(source.path), { flag: 'wx', mode: 0o600 });
  await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return manifest;
}
export async function verifyRecoveryBundle(root, runId, name) {
  root = await owned(root, runId); if (!['backup', 'restored'].includes(name)) fail('RECOVERY_ROOT_INVALID');
  const destination = path.join(root, name); const info = await lstat(destination);
  if (!info.isDirectory() || info.isSymbolicLink() || path.resolve(await realpath(destination)) !== destination) fail('RECOVERY_ROOT_INVALID');
  const manifestFile = path.join(destination, 'manifest.json'); const manifestInfo = await lstat(manifestFile);
  if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink() || manifestInfo.size > 2 * 1024 * 1024) fail('RECOVERY_MANIFEST_INVALID');
  const manifest = validate(JSON.parse(await readFile(manifestFile, 'utf8')), runId);
  for (const entry of [manifest.metadata, ...manifest.objects, ...manifest.sources]) await checkedRead(destination, entry);
  return { objects: manifest.objects.length, sources: manifest.sources.length, manifest };
}
export async function restoreRecoveryBundle(root, runId) {
  const { manifest } = await verifyRecoveryBundle(root, runId, 'backup'); root = await owned(root, runId);
  const destination = await newDestination(root, 'restored');
  for (const entry of [manifest.metadata, ...manifest.objects, ...manifest.sources]) await writeFile(path.join(destination, entry.file), await checkedRead(path.join(root, 'backup'), entry), { flag: 'wx', mode: 0o600 });
  await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const restored = await verifyRecoveryBundle(root, runId, 'restored'); assert.equal(restored.objects, manifest.objects.length);
  return restored;
}
