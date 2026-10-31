import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { pathToFileURL } from 'node:url';
const ROOT = path.resolve(import.meta.dirname, '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const error = () => { throw new Error('WORKER_BUILD_CONTRACT_INVALID'); };
const image = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,99}\/[a-z0-9][a-z0-9_-]{0,99}\/[a-z0-9][a-z0-9._-]{0,99}@sha256:[a-f0-9]{64}$/u.test(value);
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
export function validateWorkerBuildOwner(owner, run) {
  if (!owner || typeof owner !== 'object' || Array.isArray(owner) || Object.keys(owner).sort().join(',') !== 'owner,run,source_sha256'
    || owner.owner !== 'eps-worker-hosting-build' || owner.run !== run || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(run)
    || !/^[a-f0-9]{64}$/u.test(owner.source_sha256)) error();
}
export function workerDaemonOutput(imageReference) {
  if (!image(imageReference)) error();
  return { config: { version: 3, daemons: { worker: {} } }, daemon: { runtime: 'container', image: `vcr.vercel.com/${imageReference}`, instances: { dub1: 1 }, resources: { requests: { memory: '2Gi' } }, terminationGracePeriodSeconds: 300 } };
}
export function workerNativeManifest(imageReference, sourceSha) {
  if (!image(imageReference) || !/^[a-f0-9]{64}$/u.test(sourceSha)) error();
  return { schema_version: '1.0', transport: 'vercel_sandbox', protocol: 'eps-native-files-v1', image: imageReference, region: 'dub1', source_sha256: sourceSha };
}
/** Explicit allowlist; no source repository COPY, dotenv, upload, evidence,
 * credential cache, symlink, local filesystem media or package lifecycle hook. */
export async function workerContextFiles() {
  const files = ['package.json', 'package-lock.json', 'apps/web/package.json', 'apps/worker/package.json', 'apps/worker/Dockerfile.daemon', 'apps/worker/Dockerfile.native-sandbox'];
  for (const name of ['specs-extraction', 'candidate-extraction', 'frame-selection', 'slide-wording']) files.push(`contracts/json-schema/${name}.schema.json`);
  for (const pkg of ['domain', 'jobs', 'integrations', 'central']) files.push(`packages/${pkg}/package.json`);
  async function walk(relative) {
    const target = path.join(ROOT, relative); if (!samePath(path.resolve(await realpath(target)), target)) error();
    for (const item of await readdir(target, { withFileTypes: true })) {
      if (item.isSymbolicLink()) error(); const entry = `${relative}/${item.name}`;
      if (item.isDirectory()) await walk(entry);
      else if (item.isFile() && /\.(?:ts|mjs|json)$/u.test(item.name) && !/(?:\.test|\.spec)\./u.test(item.name)) files.push(entry);
    }
  }
  await walk('apps/worker/src');
  for (const pkg of ['domain', 'jobs', 'integrations', 'central']) await walk(`packages/${pkg}/src`);
  await walk('packages/templates/src'); await walk('packages/templates/versions'); files.push('packages/templates/registry.json');
  for (const family of ['IBMPlexSans', 'IBMPlexSansArabic']) { for (const weight of ['Regular', 'Medium', 'SemiBold']) files.push(`apps/web/public/fonts/${family}-${weight}.woff2`); files.push(`apps/web/public/fonts/${family}-LICENSE.txt`); }
  for (const name of ['everyone-logotype.svg', 'everyone-logotype-white.svg']) files.push(`apps/web/public/brand/${name}`);
  const results = [];
  for (const relative of [...new Set(files)].sort()) {
    const target = path.join(ROOT, relative); const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 16 * 1024 ** 2 || !samePath(path.resolve(await realpath(target)), target)) error();
    const bytes = await readFile(target); results.push({ path: relative, sha256: sha(bytes), bytes: bytes.length });
  }
  return results;
}
export async function stageWorkerContext() {
  const files = await workerContextFiles(); const sourceSha = sha(JSON.stringify(files));
  const run = randomUUID(); const directory = path.join(ROOT, '.local', 'worker-hosting', run); await mkdir(directory, { recursive: true });
  if (!samePath(await realpath(directory), directory)) error();
  const context = path.join(directory, 'context'); await mkdir(context);
  for (const item of files) {
    const target = path.join(context, item.path); const bytes = await readFile(path.join(ROOT, item.path)); if (sha(bytes) !== item.sha256) error();
    await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes, { flag: 'wx' });
  }
  await writeFile(path.join(context, 'apps/worker/native-source.json'), JSON.stringify({ source_sha256: sourceSha, files }, null, 2) + '\n', { flag: 'wx' });
  for (const kind of ['daemon', 'native-sandbox']) await writeFile(path.join(context, `Dockerfile.${kind}`), await readFile(path.join(ROOT, `apps/worker/Dockerfile.${kind}`)), { flag: 'wx' });
  await writeFile(path.join(context, '.dockerignore'), '.git\n.env*\n.local\nnode_modules\n**/node_modules\n', { flag: 'wx' });
  await writeFile(path.join(directory, 'owner.json'), JSON.stringify({ owner: 'eps-worker-hosting-build', run, source_sha256: sourceSha }), { flag: 'wx' });
  return { directory: path.relative(ROOT, directory).replaceAll('\\', '/'), context: path.relative(ROOT, context).replaceAll('\\', '/'), source_sha256: sourceSha, file_count: files.length };
}
async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (action === 'stage' && args.length === 0) { console.log(JSON.stringify(await stageWorkerContext())); return; }
  // Emitter writes only a fresh owned build directory; no upload or deployment.
  if (['manifest', 'emit'].includes(action) && args.length === 2) {
    const [run, imageReference] = args;
    if (!/^[a-f0-9-]{36}$/u.test(run)) error(); const directory = path.join(ROOT, '.local/worker-hosting', run);
    if (!samePath(await realpath(directory), directory)) error();
    const ownerFile = path.join(directory, 'owner.json'); const ownerInfo = await lstat(ownerFile); if (!ownerInfo.isFile() || ownerInfo.isSymbolicLink() || ownerInfo.size > 4096) error();
    const owner = JSON.parse(await readFile(ownerFile, 'utf8')); validateWorkerBuildOwner(owner, run);
    if (action === 'manifest') {
      const manifest = workerNativeManifest(imageReference, owner.source_sha256); const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
      await writeFile(path.join(directory, 'context/apps/worker/native-sandbox-manifest.json'), manifestBytes, { flag: 'wx' });
      console.log(JSON.stringify({ manifest_sha256: sha(manifestBytes), source_sha256: owner.source_sha256 })); return;
    }
    const output = workerDaemonOutput(imageReference);
    const target = path.join(directory, 'deployment/.vercel/output'); await mkdir(path.join(target, 'daemons/worker'), { recursive: true });
    await writeFile(path.join(target, 'config.json'), JSON.stringify(output.config, null, 2) + '\n', { flag: 'wx' });
    await writeFile(path.join(target, 'daemons/worker/.vc-config.json'), JSON.stringify(output.daemon, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ source_sha256: owner.source_sha256, output: path.relative(ROOT, target).replaceAll('\\', '/') })); return;
  }
  error();
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { console.error('WORKER_BUILD_CONTRACT_INVALID'); process.exitCode = 1; });
