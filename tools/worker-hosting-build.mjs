import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { pathToFileURL } from 'node:url';
import { isBuiltin } from 'node:module';
import ts from 'typescript';
import { NATIVE_SOURCE_ENTRYPOINTS, nativeBuildInputs, parseNativeSourceSeal, verifyNativeCompatibility, verifyNativeSourceSeal } from '../apps/worker/src/native-source-seal.ts';
const ROOT = path.resolve(import.meta.dirname, '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const error = () => { throw new Error('WORKER_BUILD_CONTRACT_INVALID'); };
const image = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,99}\/[a-z0-9][a-z0-9_-]{0,99}\/[a-z0-9][a-z0-9._-]{0,99}@sha256:[a-f0-9]{64}$/u.test(value);
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const sourceReader = root => relative => {
  const target = path.join(root, relative); const info = lstatSync(target);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16 * 1024 ** 2 || !samePath(realpathSync(target), target)) error();
  return readFileSync(target);
};
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
/** Static analysis only: ordinary TypeScript erasure, literal module edges and
 * package-lock resolution. No module loader, application import or execution. */
function workerGraph(files, sourceRead, entrypoints) {
  const entries = new Map(files.map(item => [item.path, item]));
  const read = relative => { const item = entries.get(relative); if (!item) error(); const bytes = sourceRead(relative); if (bytes.length !== item.bytes || sha(bytes) !== item.sha256) error(); return bytes; };
  const names = new Set(files.map(item => item.path)); const lock = JSON.parse(read('package-lock.json').toString());
  const rootPackage = JSON.parse(read('package.json').toString());
  if (rootPackage.devDependencies?.typescript !== ts.version || !lock.packages) error();
  const workspace = new Map(['domain', 'jobs', 'integrations', 'central'].map(name => {
    const relative = `packages/${name}/package.json`; const pkg = JSON.parse(read(relative).toString());
    return [pkg.name, { directory: `packages/${name}`, exports: pkg.exports }];
  }));
  const modules = new Map(); const external = new Map();
  const resolve = (specifier, importer) => {
    if (isBuiltin(specifier)) return { specifier, kind: 'builtin', resolved: specifier };
    if (specifier.startsWith('.')) {
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
      if (!names.has(relative) || !/\.(?:ts|mjs|json)$/u.test(relative)) error();
      return { specifier, kind: 'local', resolved: relative };
    }
    const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(name)) error();
    const local = workspace.get(name);
    if (local) {
      const subpath = specifier === name ? '.' : '.' + specifier.slice(name.length);
      const target = typeof local.exports === 'string' && subpath === '.' ? local.exports : local.exports[subpath];
      if (typeof target !== 'string' || !target.startsWith('./')) error();
      const relative = path.posix.normalize(local.directory + '/' + target);
      if (!names.has(relative)) error(); return { specifier, kind: 'local', resolved: relative };
    }
    // Node's node_modules ancestor search, using the checked-in exact lock.
    let directory = path.posix.dirname(importer); let key;
    while (true) {
      const candidate = (directory === '.' ? '' : directory + '/') + 'node_modules/' + name;
      if (lock.packages[candidate]) { key = candidate; break; }
      if (directory === '.') break; directory = path.posix.dirname(directory);
    }
    const pkg = lock.packages[key];
    if (!key || !pkg || typeof pkg.version !== 'string' || typeof pkg.integrity !== 'string' || pkg.link) error();
    external.set(key, { name, lock_path: key, version: pkg.version, integrity: pkg.integrity });
    return { specifier, kind: 'external', resolved: key };
  };
  const pending = [...entrypoints];
  while (pending.length) {
    const relative = pending.pop(); if (modules.has(relative)) continue; if (!names.has(relative)) error();
    const bytes = read(relative); const emitted = relative.endsWith('.json') ? bytes.toString() : ts.transpileModule(bytes.toString(), {
      fileName: relative, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: false }, reportDiagnostics: true,
    });
    if (typeof emitted !== 'string' && emitted.diagnostics?.some(item => item.category === ts.DiagnosticCategory.Error)) error();
    const text = typeof emitted === 'string' ? emitted : emitted.outputText; const imports = new Set();
    if (!relative.endsWith('.json')) {
      const source = ts.createSourceFile(relative + '.js', text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
      const visit = node => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
          if (!ts.isStringLiteral(node.moduleSpecifier)) error(); imports.add(node.moduleSpecifier.text);
        }
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
          if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) error(); imports.add(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
      }; visit(source);
    }
    const edges = [...imports].sort().map(specifier => resolve(specifier, relative));
    modules.set(relative, { path: relative, emitted_sha256: sha(text), imports: edges });
    for (const edge of edges) if (edge.kind === 'local') pending.push(edge.resolved);
  }
  return { entrypoints: [...entrypoints], modules: [...modules.values()].sort((a, b) => a.path < b.path ? -1 : 1),
    build_inputs: nativeBuildInputs(files), external: [...external.values()].sort((a, b) => a.lock_path < b.lock_path ? -1 : 1),
    compiler: { name: 'typescript', version: ts.version, target: 'ES2022', module: 'ESNext', generator_sha256: sha(readFileSync(import.meta.filename)) } };
}
export function workerNativeGraph(files, read) { return workerGraph(files, read, NATIVE_SOURCE_ENTRYPOINTS); }
export function workerDaemonGraph(files, read) {
  const sourceSha = sha(JSON.stringify(files)); parseNativeSourceSeal({ source_sha256: sourceSha, files }, sourceSha);
  const inputs = files.filter(item => !/\.(?:ts|mjs)$/u.test(item.path) && item.path !== 'apps/worker/Dockerfile.native-sandbox');
  for (const item of inputs) { const bytes = read(item.path); if (bytes.length !== item.bytes || sha(bytes) !== item.sha256) error(); }
  return { ...workerGraph(files, read, ['apps/worker/src/runtime-hosted.ts']), build_inputs: inputs.map(item => item.path), build_input_files: inputs };
}
export function workerNativeCompatibility(daemon, native, manifestSha, graph, read) {
  if (JSON.stringify(graph) !== JSON.stringify(workerNativeGraph(daemon.files, read))) error();
  const descriptor = { schema_version: '1.0', daemon_source_sha256: daemon.source_sha256, native_source_sha256: native.source_sha256,
    native_manifest_sha256: manifestSha, native_graph_sha256: sha(JSON.stringify(graph)), native_graph: graph };
  verifyNativeCompatibility(descriptor, daemon, native, descriptor, read); return descriptor;
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
  const graph = workerNativeGraph(files, sourceReader(ROOT));
  const daemonGraph = workerDaemonGraph(files, sourceReader(ROOT));
  const run = randomUUID(); const directory = path.join(ROOT, '.local', 'worker-hosting', run); await mkdir(directory, { recursive: true });
  if (!samePath(await realpath(directory), directory)) error();
  const context = path.join(directory, 'context'); await mkdir(context);
  for (const item of files) {
    const target = path.join(context, item.path); const bytes = await readFile(path.join(ROOT, item.path)); if (sha(bytes) !== item.sha256) error();
    await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes, { flag: 'wx' });
  }
  const source = JSON.stringify({ source_sha256: sourceSha, files }, null, 2) + '\n';
  for (const kind of ['native', 'daemon']) await writeFile(path.join(context, `apps/worker/${kind}-source.json`), source, { flag: 'wx' });
  await writeFile(path.join(directory, 'source-provenance.json'), JSON.stringify({ schema_version: '1.0', run, source_sha256: sourceSha, native_graph: graph, daemon_graph: daemonGraph }, null, 2) + '\n', { flag: 'wx' });
  for (const kind of ['daemon', 'native-sandbox']) await writeFile(path.join(context, `Dockerfile.${kind}`), await readFile(path.join(ROOT, `apps/worker/Dockerfile.${kind}`)), { flag: 'wx' });
  await writeFile(path.join(context, '.dockerignore'), '.git\n.env*\n.local\nnode_modules\n**/node_modules\n', { flag: 'wx' });
  await writeFile(path.join(directory, 'owner.json'), JSON.stringify({ owner: 'eps-worker-hosting-build', run, source_sha256: sourceSha }), { flag: 'wx' });
  return { directory: path.relative(ROOT, directory).replaceAll('\\', '/'), context: path.relative(ROOT, context).replaceAll('\\', '/'), source_sha256: sourceSha, file_count: files.length,
    native_graph_sha256: sha(JSON.stringify(graph)), daemon_graph_sha256: sha(JSON.stringify(daemonGraph)) };
}
async function ownedBuild(run) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(run)) error();
  const directory = path.join(ROOT, '.local/worker-hosting', run); if (!samePath(await realpath(directory), directory)) error();
  const readJson = async name => {
    const target = path.join(directory, name); const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024 || !samePath(await realpath(target), target)) error();
    return JSON.parse(await readFile(target, 'utf8'));
  };
  const owner = await readJson('owner.json'); validateWorkerBuildOwner(owner, run);
  const read = sourceReader(path.join(directory, 'context'));
  const source = await readJson('context/apps/worker/daemon-source.json'); verifyNativeSourceSeal(source, owner.source_sha256, read);
  const graph = workerNativeGraph(source.files, read); const daemonGraph = workerDaemonGraph(source.files, read); const provenance = await readJson('source-provenance.json');
  if (Object.keys(provenance).sort().join(',') !== 'daemon_graph,native_graph,run,schema_version,source_sha256' || provenance.schema_version !== '1.0'
    || provenance.run !== run || provenance.source_sha256 !== owner.source_sha256 || JSON.stringify(provenance.native_graph) !== JSON.stringify(graph) || JSON.stringify(provenance.daemon_graph) !== JSON.stringify(daemonGraph)) error();
  return { directory, owner, readJson, read, source, graph, daemonGraph };
}
async function writeCompatibility(build, native, manifest, graph) {
  const manifestBytes = JSON.stringify(manifest, null, 2) + '\n'; const manifestSha = sha(manifestBytes);
  const descriptor = workerNativeCompatibility(build.source, native, manifestSha, graph, build.read); const bytes = JSON.stringify(descriptor, null, 2) + '\n';
  await writeFile(path.join(build.directory, 'context/apps/worker/native-sandbox-manifest.json'), manifestBytes, { flag: 'wx' });
  await writeFile(path.join(build.directory, 'context/apps/worker/native-compatibility.json'), bytes, { flag: 'wx' });
  return { daemon_source_sha256: build.source.source_sha256, native_source_sha256: native.source_sha256, native_manifest_sha256: manifestSha,
    native_compatibility_sha256: sha(bytes), native_graph_sha256: descriptor.native_graph_sha256 };
}
async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (action === 'stage' && args.length === 0) { console.log(JSON.stringify(await stageWorkerContext())); return; }
  // Emitter writes only a fresh owned build directory; no upload or deployment.
  if (['manifest', 'emit', 'reuse-native'].includes(action) && args.length === 2) {
    const [run, imageReference] = args;
    const build = await ownedBuild(run); const { directory, owner } = build;
    if (action === 'manifest') {
      const native = await build.readJson('context/apps/worker/native-source.json'); parseNativeSourceSeal(native, owner.source_sha256);
      const manifest = workerNativeManifest(imageReference, owner.source_sha256); const identity = await writeCompatibility(build, native, manifest, build.graph);
      await writeFile(path.join(directory, 'native-artifact.json'), JSON.stringify({ schema_version: '1.0', run, ...identity }), { flag: 'wx' });
      console.log(JSON.stringify({ manifest_sha256: identity.native_manifest_sha256, source_sha256: owner.source_sha256, ...identity })); return;
    }
    if (action === 'reuse-native') {
      // Both inputs are exclusively owned UUID directories, never arbitrary
      // filesystem/image selectors. Legacy images without this provenance refuse.
      if (run === imageReference) error(); const previous = await ownedBuild(imageReference);
      const artifact = await previous.readJson('native-artifact.json'); const manifest = await previous.readJson('context/apps/worker/native-sandbox-manifest.json');
      const native = await previous.readJson('context/apps/worker/native-source.json'); parseNativeSourceSeal(native, previous.owner.source_sha256);
      const original = workerNativeManifest(manifest.image, previous.owner.source_sha256);
      const manifestSha = sha(JSON.stringify(original, null, 2) + '\n');
      const originalIdentity = { daemon_source_sha256: previous.owner.source_sha256, native_source_sha256: previous.owner.source_sha256,
        native_manifest_sha256: manifestSha, native_compatibility_sha256: sha(await readFile(path.join(previous.directory, 'context/apps/worker/native-compatibility.json'))), native_graph_sha256: sha(JSON.stringify(previous.graph)) };
      if (JSON.stringify(manifest) !== JSON.stringify(original) || JSON.stringify(artifact) !== JSON.stringify({ schema_version: '1.0', run: imageReference, ...originalIdentity })
        || JSON.stringify(build.graph) !== JSON.stringify(previous.graph)) error();
      const previousDescriptor = await previous.readJson('context/apps/worker/native-compatibility.json');
      verifyNativeCompatibility(previousDescriptor, previous.source, native, originalIdentity, previous.read);
      const initial = await build.readJson('context/apps/worker/native-source.json'); parseNativeSourceSeal(initial, owner.source_sha256);
      // The copied generated artifact seal is outside the sparse source hash;
      // every actual native dependency must still equal both immutable source lists.
      workerNativeCompatibility(build.source, native, manifestSha, previous.graph, build.read);
      await writeFile(path.join(directory, 'context/apps/worker/native-source.json'), JSON.stringify(native, null, 2) + '\n');
      console.log(JSON.stringify(await writeCompatibility(build, native, original, previous.graph))); return;
    }
    const native = await build.readJson('context/apps/worker/native-source.json');
    const descriptor = await build.readJson('context/apps/worker/native-compatibility.json'); const manifest = await build.readJson('context/apps/worker/native-sandbox-manifest.json');
    if (JSON.stringify(manifest) !== JSON.stringify(workerNativeManifest(manifest.image, native.source_sha256))) error();
    if (JSON.stringify(descriptor.native_graph) !== JSON.stringify(build.graph)) error();
    const manifestSha = sha(await readFile(path.join(directory, 'context/apps/worker/native-sandbox-manifest.json')));
    verifyNativeCompatibility(descriptor, build.source, native, { daemon_source_sha256: owner.source_sha256, native_source_sha256: native.source_sha256, native_manifest_sha256: manifestSha }, build.read);
    const output = workerDaemonOutput(imageReference);
    const target = path.join(directory, 'deployment/.vercel/output'); await mkdir(path.join(target, 'daemons/worker'), { recursive: true });
    await writeFile(path.join(target, 'config.json'), JSON.stringify(output.config, null, 2) + '\n', { flag: 'wx' });
    await writeFile(path.join(target, 'daemons/worker/.vc-config.json'), JSON.stringify(output.daemon, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ source_sha256: owner.source_sha256, daemon_source_sha256: owner.source_sha256, native_source_sha256: native.source_sha256,
      native_graph_sha256: descriptor.native_graph_sha256, daemon_graph_sha256: sha(JSON.stringify(build.daemonGraph)), native_manifest_sha256: manifestSha,
      native_compatibility_sha256: sha(await readFile(path.join(directory, 'context/apps/worker/native-compatibility.json'))), output: path.relative(ROOT, target).replaceAll('\\', '/') })); return;
  }
  error();
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => { console.error('WORKER_BUILD_CONTRACT_INVALID'); process.exitCode = 1; });
