import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const PARENT_RUN = '77e14c2e-5ae9-4aa6-aec0-636f789c4625';
const SOURCE_FILE = 'apps/worker/native-source.json';
const BAKED_FILE = 'apps/worker/native-sandbox-manifest.json';
const EXTRA_PATHS = Object.freeze(['.dockerignore', 'Dockerfile.daemon', 'Dockerfile.native-sandbox', SOURCE_FILE]);
const MAX_BYTES = 16 * 1024 ** 2;
const sha = value => createHash('sha256').update(value).digest('hex');
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const fail = () => { throw new Error('FILE_LIMITS_CONTEXT_INVALID'); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, fields) => object(value) && Object.keys(value).sort().join(',') === [...fields].sort().join(',');
const hashValue = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const relativePath = value => typeof value === 'string' && value.length <= 240 && !value.includes('..') && !value.includes('\\') && !value.includes(':')
  && /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/u.test(value);
const sourcePath = value => relativePath(value) && /^(?:package(?:-lock)?\.json|apps\/(?:web|worker)\/package\.json|apps\/worker\/Dockerfile\.(?:daemon|native-sandbox)|packages\/(?:domain|jobs|integrations|central)\/package\.json|(?:apps\/worker\/src|packages\/(?:domain|jobs|integrations|central)\/src|packages\/templates\/(?:src|versions))\/[A-Za-z0-9_./-]+\.(?:ts|mjs|json)|contracts\/json-schema\/(?:specs-extraction|candidate-extraction|frame-selection|slide-wording)\.schema\.json|packages\/templates\/registry\.json|apps\/web\/public\/fonts\/IBMPlexSans(?:Arabic)?-(?:Regular\.woff2|Medium\.woff2|SemiBold\.woff2|LICENSE\.txt)|apps\/web\/public\/brand\/everyone-logotype(?:-white)?\.svg)$/u.test(value);

export const FILE_LIMITS_OVERLAY_PATHS = Object.freeze([
  'apps/worker/src/native-sandbox-launch.mjs',
  'apps/worker/src/native-task-limits.mjs'
]);

// Fixed public parent graph and reviewed browser file-size capacity overlay. Root stages only after
// the independent file-size runtime and operator reviews cover these exact hashes.
const FILE_LIMITS_PLAN = Object.freeze({
  parentRun: PARENT_RUN,
  parentSourceSha256: '3790b2b327da7eca18b1aad3a0dfaae02892b0130647e4527a25dd24aa3d54a3',
  parentManifestSha256: '043974f382e60f21596adc34d607dd9ad5703f77de84225aead9b68913040466',
  parentCount: 156,
  parentBakedManifestSha256: 'ea963472650fa839076ab0c68c951f839f4820e4e04f55ae5c9c476e3c457ac0',
  dockerignoreSha256: 'b8c84842204301ca2148da041e3a57a081759839ec6790518b10bb11d1810ec0',
  overlayPins: Object.freeze({
    'apps/worker/src/native-sandbox-launch.mjs': '3efb0a965fb23dc5d8a07dae7b8a590238a7172ca7606aadf3b8c40f2baaac23',
    'apps/worker/src/native-task-limits.mjs': 'f648ae3a0c82c7d8cdc5d8c553d34014f8b20319ce7ff569eea8ae04185a9df0'
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

export function validateFileLimitsInventory(observed, expected, allowBaked = false) {
  if (typeof allowBaked !== 'boolean') fail();
  if (allowBaked && Array.isArray(observed)) {
    if (observed.filter(name => name === BAKED_FILE).length > 1) fail();
    observed = observed.filter(name => name !== BAKED_FILE);
  }
  if (!Array.isArray(observed) || !Array.isArray(expected) || observed.length !== expected.length
    || !expected.every(relativePath) || !observed.every(relativePath)) fail();
  const allowed = new Set(expected);
  if (allowed.size !== expected.length || new Set(observed).size !== observed.length || observed.some(name => !allowed.has(name))) fail();
}

/** Pure admission and complete graph construction. Runtime callers always use
 * the fixed plan above; tests use explicitly synthetic memory-only graphs. */
export function prepareFileLimitsContext(parentOwner, parentFiles, overlayFiles, plan = FILE_LIMITS_PLAN) {
  if (!exact(plan, ['parentRun', 'parentSourceSha256', 'parentManifestSha256', 'parentCount', 'parentBakedManifestSha256', 'dockerignoreSha256', 'overlayPins'])
    || plan.parentCount !== 156 || !hashValue(plan.parentSourceSha256) || !hashValue(plan.parentBakedManifestSha256) || !hashValue(plan.parentManifestSha256) || !hashValue(plan.dockerignoreSha256)
    || !exact(plan.overlayPins, FILE_LIMITS_OVERLAY_PATHS) || !Object.values(plan.overlayPins).every(hashValue)
    || !exact(parentOwner, ['owner', 'run', 'source_sha256']) || parentOwner.owner !== 'eps-worker-hosting-build'
    || parentOwner.run !== plan.parentRun || parentOwner.source_sha256 !== plan.parentSourceSha256) fail();
  if (!(parentFiles instanceof Map)) fail();
  const admittedParent = new Map(parentFiles);
  if (admittedParent.has(BAKED_FILE)) {
    if (sha(bytes(admittedParent.get(BAKED_FILE))) !== plan.parentBakedManifestSha256) fail();
    admittedParent.delete(BAKED_FILE);
  }
  const parentSource = parseSource(admittedParent, plan.parentSourceSha256, plan.parentCount, plan.parentManifestSha256);
  if (sha(bytes(admittedParent.get('.dockerignore'))) !== plan.dockerignoreSha256 || !(overlayFiles instanceof Map)
    || overlayFiles.size !== FILE_LIMITS_OVERLAY_PATHS.length || [...overlayFiles.keys()].some(name => !FILE_LIMITS_OVERLAY_PATHS.includes(name))) fail();
  const parentPaths = new Set(parentSource.files.map(item => item.path));
  for (const name of FILE_LIMITS_OVERLAY_PATHS) {
    if (sha(bytes(overlayFiles.get(name))) !== plan.overlayPins[name] || !parentPaths.has(name)) fail();
  }
  // Neither Dockerfile nor any dependency manifest is an overlay. Copying every
  // other sealed parent record byte-for-byte preserves the complete heavy
  // dependency/APT/Chromium cache prefix, not merely selected RUN instructions.
  const files = new Map(parentSource.files.map(item => [item.path, Buffer.from(parentFiles.get(item.path))]));
  for (const name of FILE_LIMITS_OVERLAY_PATHS) files.set(name, Buffer.from(overlayFiles.get(name)));
  const records = [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, value]) => ({ path: name, sha256: sha(value), bytes: value.length }));
  const source = { source_sha256: sha(JSON.stringify(records)), files: records };
  files.set('.dockerignore', Buffer.from(parentFiles.get('.dockerignore')));
  files.set('Dockerfile.daemon', Buffer.from(files.get('apps/worker/Dockerfile.daemon')));
  files.set('Dockerfile.native-sandbox', Buffer.from(files.get('apps/worker/Dockerfile.native-sandbox')));
  files.set(SOURCE_FILE, jsonBytes(source));
  verifyPreparedFileLimitsContext(source.source_sha256, files, plan.dockerignoreSha256);
  return { files, source, overlay: FILE_LIMITS_OVERLAY_PATHS.map(name => ({ path: name,
    previous_sha256: parentPaths.has(name) ? sha(parentFiles.get(name)) : null, sha256: sha(files.get(name)), bytes: files.get(name).length })) };
}

export function verifyPreparedFileLimitsContext(expectedSource, files, dockerignoreSha256 = FILE_LIMITS_PLAN.dockerignoreSha256) {
  const source = parseSource(files, expectedSource, 156);
  if (sha(bytes(files.get('.dockerignore'))) !== dockerignoreSha256 || !source.files.some(item => item.path === 'apps/worker/src/native-task-limits.mjs')) fail();
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

async function inventory(base, allowedPaths, allowBaked = false) {
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
  await walk(''); validateFileLimitsInventory(names, allowedPaths, allowBaked);
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
  const parentManifest = sourceManifest(await safeRead(parentContext, SOURCE_FILE), FILE_LIMITS_PLAN.parentSourceSha256, FILE_LIMITS_PLAN.parentCount, FILE_LIMITS_PLAN.parentManifestSha256);
  const parentFiles = await inventory(parentContext, [...parentManifest.files.map(item => item.path), ...EXTRA_PATHS], true);
  const overlayFiles = new Map();
  for (const name of FILE_LIMITS_OVERLAY_PATHS) overlayFiles.set(name, await safeRead(ROOT, name));
  const prepared = prepareFileLimitsContext(parentOwner, parentFiles, overlayFiles);
  const run = randomUUID(); validateNewRun(run); const destination = path.join(buildRoot, run);
  await mkdir(destination); await directory(destination);
  const claim = { schema_version: '1.0', owner: 'eps-native-file-limits-fix-stage', run, parent_run: PARENT_RUN,
    parent_source_sha256: FILE_LIMITS_PLAN.parentSourceSha256, source_sha256: prepared.source.source_sha256,
    helper_sha256: sha(await safeRead(ROOT, 'tools/stage-native-file-limits-fix.mjs')), overlay: prepared.overlay };
  await writeExclusive(path.join(destination, 'file-limits-stage-claim.json'), jsonBytes(claim));
  const context = path.join(destination, 'context'); await mkdir(context);
  await writeContext(context, prepared.files);
  const actual = await inventory(context, [...prepared.files.keys()]);
  verifyPreparedFileLimitsContext(prepared.source.source_sha256, actual);
  for (const [name, expected] of prepared.files) if (!expected.equals(actual.get(name))) fail();
  // Publish the existing builder's exact three-key owner format only after all
  // actual staged records and all four extras have passed their readback.
  await writeExclusive(path.join(destination, 'owner.json'), jsonBytes({ owner: 'eps-worker-hosting-build', run, source_sha256: prepared.source.source_sha256 }));
  const metadata = { ...claim, result: 'prepared', parent_manifest_sha256: FILE_LIMITS_PLAN.parentManifestSha256,
    source_records: 156, controlled_extras: EXTRA_PATHS, non_overlay_parent_bytes_preserved: true,
    dockerfiles_preserved_from_parent: true, dependencies_preserved_from_parent: ['package.json', 'package-lock.json', 'apps/web/package.json', 'apps/worker/package.json'],
    native_image_built: false, daemon_image_built: false, provider_actions: false };
  await writeExclusive(path.join(destination, 'file-limits-overlay.json'), jsonBytes(metadata));
  process.stdout.write(JSON.stringify({ run, directory: `.local/worker-hosting/${run}`, context: `.local/worker-hosting/${run}/context`,
    source_sha256: prepared.source.source_sha256, source_records: 156, result: 'prepared' }) + '\n');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write('FILE_LIMITS_CONTEXT_INVALID\n'); process.exitCode = 1;
});
