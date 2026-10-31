import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const PARENT_RUN = '2e551bb2-4ee8-45a2-8b39-eea59c9644d5';
const SOURCE_FILE = 'apps/worker/native-source.json';
const EXTRA_PATHS = Object.freeze(['.dockerignore', 'Dockerfile.daemon', 'Dockerfile.native-sandbox', SOURCE_FILE]);
const MAX_BYTES = 16 * 1024 ** 2;
const sha = value => createHash('sha256').update(value).digest('hex');
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const fail = () => { throw new Error('UID_CONTEXT_INVALID'); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, fields) => object(value) && Object.keys(value).sort().join(',') === [...fields].sort().join(',');
const hashValue = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const relativePath = value => typeof value === 'string' && value.length <= 240 && !value.includes('..') && !value.includes('\\') && !value.includes(':')
  && /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/u.test(value);
const sourcePath = value => relativePath(value) && /^(?:package(?:-lock)?\.json|apps\/(?:web|worker)\/package\.json|apps\/worker\/Dockerfile\.(?:daemon|native-sandbox)|packages\/(?:domain|jobs|integrations|central)\/package\.json|(?:apps\/worker\/src|packages\/(?:domain|jobs|integrations|central)\/src|packages\/templates\/(?:src|versions))\/[A-Za-z0-9_./-]+\.(?:ts|mjs|json)|packages\/templates\/registry\.json|apps\/web\/public\/fonts\/IBMPlexSans(?:Arabic)?-(?:Regular\.woff2|Medium\.woff2|SemiBold\.woff2|LICENSE\.txt)|apps\/web\/public\/brand\/everyone-logotype(?:-white)?\.svg)$/u.test(value);

export const UID_OVERLAY_PATHS = Object.freeze([
  'apps/worker/Dockerfile.native-sandbox',
  'apps/worker/src/native-identity.mjs',
  'apps/worker/src/native-sandbox-boundary.mjs',
  'apps/worker/src/native-sandbox-launch.mjs',
  'apps/worker/src/native-sandbox-task.mjs'
]);

// Fixed public parent graph and candidate UID overlay. Root stages only after
// the independent UID runtime and operator reviews cover these exact hashes.
const UID_PLAN = Object.freeze({
  parentRun: PARENT_RUN,
  parentSourceSha256: '0ddf519a91a23a11904dbd9880f48d24a2d543a8249f9ab267dbab323d6fb297',
  parentManifestSha256: '26f00318ac0b25787d05cd6c36475b69b14d615d63932b2e5e18d8d3d7213b4c',
  parentCount: 150,
  dockerignoreSha256: 'b8c84842204301ca2148da041e3a57a081759839ec6790518b10bb11d1810ec0',
  overlayPins: Object.freeze({
    'apps/worker/Dockerfile.native-sandbox': '3879ea74fdf70eeee6a974376caae7cdf68f17cd24d5d5eb1b6e32f74266055a',
    'apps/worker/src/native-identity.mjs': 'f3b55692bdc48ab05b108915692509d124f50ea4d32153ebf39d87f0ff5d3aa0',
    'apps/worker/src/native-sandbox-boundary.mjs': 'f1387f30742c3978f98264eddbbf8423e3f4137af73d87201d50fc862c21ab8d',
    'apps/worker/src/native-sandbox-launch.mjs': '11689381c482bc2a4725cdbc2709d72f5b2b6bc4a4d681cd99dba89518f1ee34',
    'apps/worker/src/native-sandbox-task.mjs': 'b9f6e1abb0d310faa4fa167723c796ae5ff3b01ee78443e26acf9b4ec5cc7542'
  })
});

export function validateNewRun(run, parentRun = PARENT_RUN) {
  if (typeof run !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(run) || run === parentRun) fail();
}

function bytes(value) {
  if (!(value instanceof Uint8Array) || value.length < 1 || value.length > MAX_BYTES) fail();
  return value;
}

function sourceManifest(manifest, expectedSource, expectedCount, expectedManifest) {
  bytes(manifest);
  if (expectedManifest !== undefined && sha(manifest) !== expectedManifest) fail();
  let source; try { source = JSON.parse(Buffer.from(manifest).toString('utf8')); } catch { fail(); }
  if (!exact(source, ['source_sha256', 'files']) || !hashValue(expectedSource) || source.source_sha256 !== expectedSource
    || !Array.isArray(source.files) || source.files.length !== expectedCount || sha(JSON.stringify(source.files)) !== expectedSource) fail();
  let previous = '';
  for (const item of source.files) {
    if (!exact(item, ['path', 'sha256', 'bytes']) || !sourcePath(item.path) || item.path <= previous || !hashValue(item.sha256)
      || !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.bytes > MAX_BYTES) fail();
    previous = item.path;
  }
  return source;
}

function parseSource(files, expectedSource, expectedCount, expectedManifest) {
  if (!(files instanceof Map)) fail();
  const source = sourceManifest(files.get(SOURCE_FILE), expectedSource, expectedCount, expectedManifest);
  for (const item of source.files) {
    const actual = bytes(files.get(item.path));
    if (actual.length !== item.bytes || sha(actual) !== item.sha256) fail();
  }
  const expectedPaths = new Set([...source.files.map(item => item.path), ...EXTRA_PATHS]);
  if (files.size !== expectedPaths.size || [...files.keys()].some(name => !expectedPaths.has(name))) fail();
  for (const kind of ['daemon', 'native-sandbox']) {
    if (!Buffer.from(bytes(files.get(`Dockerfile.${kind}`))).equals(Buffer.from(bytes(files.get(`apps/worker/Dockerfile.${kind}`))))) fail();
  }
  return source;
}

export function validateUidInventory(observed, expected) {
  if (!Array.isArray(observed) || !Array.isArray(expected) || observed.length !== expected.length
    || !expected.every(relativePath) || !observed.every(relativePath)) fail();
  const allowed = new Set(expected);
  if (allowed.size !== expected.length || new Set(observed).size !== observed.length || observed.some(name => !allowed.has(name))) fail();
}

/** Pure admission and complete graph construction. Runtime callers always use
 * the fixed plan above; tests use explicitly synthetic memory-only graphs. */
export function prepareUidContext(parentOwner, parentFiles, overlayFiles, plan = UID_PLAN) {
  if (!exact(plan, ['parentRun', 'parentSourceSha256', 'parentManifestSha256', 'parentCount', 'dockerignoreSha256', 'overlayPins'])
    || plan.parentCount !== 150 || !hashValue(plan.parentSourceSha256) || !hashValue(plan.parentManifestSha256) || !hashValue(plan.dockerignoreSha256)
    || !exact(plan.overlayPins, UID_OVERLAY_PATHS) || !Object.values(plan.overlayPins).every(hashValue)
    || !exact(parentOwner, ['owner', 'run', 'source_sha256']) || parentOwner.owner !== 'eps-worker-hosting-build'
    || parentOwner.run !== plan.parentRun || parentOwner.source_sha256 !== plan.parentSourceSha256) fail();
  const parentSource = parseSource(parentFiles, plan.parentSourceSha256, plan.parentCount, plan.parentManifestSha256);
  if (sha(bytes(parentFiles.get('.dockerignore'))) !== plan.dockerignoreSha256 || !(overlayFiles instanceof Map)
    || overlayFiles.size !== UID_OVERLAY_PATHS.length || [...overlayFiles.keys()].some(name => !UID_OVERLAY_PATHS.includes(name))) fail();
  const parentPaths = new Set(parentSource.files.map(item => item.path));
  for (const name of UID_OVERLAY_PATHS) {
    if (sha(bytes(overlayFiles.get(name))) !== plan.overlayPins[name] || (name.endsWith('/native-identity.mjs') ? parentPaths.has(name) : !parentPaths.has(name))) fail();
  }
  const nativeDocker = 'apps/worker/Dockerfile.native-sandbox';
  const previousDocker = Buffer.from(parentFiles.get(nativeDocker)); const nextDocker = Buffer.from(overlayFiles.get(nativeDocker));
  const copyInstruction = Buffer.from('COPY apps/worker ./apps/worker');
  const previousCopy = previousDocker.indexOf(copyInstruction); const nextCopy = nextDocker.indexOf(copyInstruction);
  if (previousCopy < 0 || nextCopy !== previousCopy
    || !previousDocker.subarray(0, previousCopy + copyInstruction.length).equals(nextDocker.subarray(0, nextCopy + copyInstruction.length))) fail();
  const files = new Map(parentSource.files.map(item => [item.path, Buffer.from(parentFiles.get(item.path))]));
  for (const name of UID_OVERLAY_PATHS) files.set(name, Buffer.from(overlayFiles.get(name)));
  const records = [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, value]) => ({ path: name, sha256: sha(value), bytes: value.length }));
  const source = { source_sha256: sha(JSON.stringify(records)), files: records };
  files.set('.dockerignore', Buffer.from(parentFiles.get('.dockerignore')));
  files.set('Dockerfile.daemon', Buffer.from(files.get('apps/worker/Dockerfile.daemon')));
  files.set('Dockerfile.native-sandbox', Buffer.from(files.get('apps/worker/Dockerfile.native-sandbox')));
  files.set(SOURCE_FILE, jsonBytes(source));
  verifyPreparedUidContext(source.source_sha256, files, plan.dockerignoreSha256);
  return { files, source, overlay: UID_OVERLAY_PATHS.map(name => ({ path: name,
    previous_sha256: parentPaths.has(name) ? sha(parentFiles.get(name)) : null, sha256: sha(files.get(name)), bytes: files.get(name).length })) };
}

export function verifyPreparedUidContext(expectedSource, files, dockerignoreSha256 = UID_PLAN.dockerignoreSha256) {
  const source = parseSource(files, expectedSource, 151);
  if (sha(bytes(files.get('.dockerignore'))) !== dockerignoreSha256 || !source.files.some(item => item.path === 'apps/worker/src/native-identity.mjs')) fail();
  return source;
}

async function directory(target) {
  const info = await lstat(target);
  if (!info.isDirectory() || info.isSymbolicLink() || !samePath(await realpath(target), path.resolve(target))) fail();
}

async function safeRead(base, relative, maximum = MAX_BYTES) {
  if (!relativePath(relative)) fail(); await directory(base);
  const parts = relative.split('/'); let parent = base;
  for (const part of parts.slice(0, -1)) { parent = path.join(parent, part); await directory(parent); }
  const target = path.join(base, ...parts); const before = await lstat(target);
  if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > maximum || !samePath(await realpath(target), target)) fail();
  const data = await readFile(target); const after = await lstat(target);
  if (!after.isFile() || after.isSymbolicLink() || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
    || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || data.length !== before.size) fail();
  return data;
}

async function inventory(base, allowedPaths) {
  const names = []; let entries = 0;
  const allowedDirectories = new Set(['']);
  for (const name of allowedPaths) {
    let relative = '';
    for (const part of name.split('/').slice(0, -1)) { relative = relative ? `${relative}/${part}` : part; allowedDirectories.add(relative); }
  }
  async function walk(relative) {
    if (!allowedDirectories.has(relative)) fail();
    const target = path.join(base, relative); await directory(target);
    for (const item of await readdir(target, { withFileTypes: true })) {
      if (++entries > 1200 || item.isSymbolicLink()) fail();
      const name = relative ? `${relative}/${item.name}` : item.name;
      if (!relativePath(name)) fail();
      if (item.isDirectory()) await walk(name);
      else if (item.isFile()) names.push(name);
      else fail();
    }
  }
  await walk(''); validateUidInventory(names, allowedPaths);
  // Admit the COMPLETE public name set before reading one source file. A
  // forbidden extra credential/media file is rejected without opening it.
  const files = new Map();
  for (const name of names) files.set(name, await safeRead(base, name));
  return files;
}

async function writeExclusive(target, data) {
  const handle = await open(target, 'wx', 0o644);
  try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
}

async function writeContext(base, files) {
  const created = new Set(['']);
  for (const [name, data] of files) {
    let relative = '';
    for (const part of name.split('/').slice(0, -1)) {
      relative = relative ? `${relative}/${part}` : part;
      if (!created.has(relative)) { await mkdir(path.join(base, relative)); created.add(relative); }
    }
    await writeExclusive(path.join(base, name), data);
  }
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== 'stage' || !/^v24\./u.test(process.version)) fail();
  await directory(ROOT); await directory(path.join(ROOT, '.local'));
  const buildRoot = path.join(ROOT, '.local/worker-hosting'); await directory(buildRoot);
  const parent = path.join(buildRoot, PARENT_RUN); await directory(parent);
  const parentOwner = JSON.parse((await safeRead(parent, 'owner.json', 4096)).toString('utf8'));
  const parentContext = path.join(parent, 'context');
  const parentManifest = sourceManifest(await safeRead(parentContext, SOURCE_FILE), UID_PLAN.parentSourceSha256, UID_PLAN.parentCount, UID_PLAN.parentManifestSha256);
  const parentFiles = await inventory(parentContext, [...parentManifest.files.map(item => item.path), ...EXTRA_PATHS]);
  const overlayFiles = new Map();
  for (const name of UID_OVERLAY_PATHS) overlayFiles.set(name, await safeRead(ROOT, name));
  const prepared = prepareUidContext(parentOwner, parentFiles, overlayFiles);
  const run = randomUUID(); validateNewRun(run); const destination = path.join(buildRoot, run);
  await mkdir(destination); await directory(destination);
  const claim = { schema_version: '1.0', owner: 'eps-native-uid-fix-stage', run, parent_run: PARENT_RUN,
    parent_source_sha256: UID_PLAN.parentSourceSha256, source_sha256: prepared.source.source_sha256,
    helper_sha256: sha(await safeRead(ROOT, 'tools/stage-native-uid-fix.mjs')), overlay: prepared.overlay };
  await writeExclusive(path.join(destination, 'uid-stage-claim.json'), jsonBytes(claim));
  const context = path.join(destination, 'context'); await mkdir(context);
  await writeContext(context, prepared.files);
  const actual = await inventory(context, [...prepared.files.keys()]);
  verifyPreparedUidContext(prepared.source.source_sha256, actual);
  for (const [name, expected] of prepared.files) if (!expected.equals(actual.get(name))) fail();
  // Publish the existing builder's exact three-key owner format only after all
  // actual staged records and all four extras have passed their readback.
  await writeExclusive(path.join(destination, 'owner.json'), jsonBytes({ owner: 'eps-worker-hosting-build', run, source_sha256: prepared.source.source_sha256 }));
  const metadata = { ...claim, result: 'prepared', parent_manifest_sha256: UID_PLAN.parentManifestSha256,
    source_records: 151, controlled_extras: EXTRA_PATHS, non_overlay_parent_bytes_preserved: true,
    dependencies_preserved_from_parent: ['package.json', 'package-lock.json', 'apps/web/package.json', 'apps/worker/package.json'],
    native_image_built: false, daemon_image_built: false, provider_actions: false };
  await writeExclusive(path.join(destination, 'uid-overlay.json'), jsonBytes(metadata));
  process.stdout.write(JSON.stringify({ run, directory: `.local/worker-hosting/${run}`, context: `.local/worker-hosting/${run}/context`,
    source_sha256: prepared.source.source_sha256, source_records: 151, result: 'prepared' }) + '\n');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write('UID_CONTEXT_INVALID\n'); process.exitCode = 1;
});
