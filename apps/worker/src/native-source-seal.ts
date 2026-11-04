import { createHash } from 'node:crypto';
import { isBuiltin } from 'node:module';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
function fail(): never { throw new Error('NATIVE_CONFIGURATION_INVALID'); }
function sourcePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 240 || value.includes('..') || value.includes('\\') || value.includes(':')) return false;
  return /^(?:package(?:-lock)?\.json|apps\/(?:web|worker)\/package\.json|apps\/worker\/Dockerfile\.(?:daemon|native-sandbox)|packages\/(?:domain|jobs|integrations|central)\/package\.json|(?:apps\/worker\/src|packages\/(?:domain|jobs|integrations|central)\/src|packages\/templates\/(?:src|versions))\/[A-Za-z0-9_./-]+\.(?:ts|mjs|json)|contracts\/json-schema\/(?:specs-extraction|candidate-extraction|frame-selection|slide-wording)\.schema\.json|packages\/templates\/registry\.json|apps\/web\/public\/fonts\/IBMPlexSans(?:Arabic)?-(?:Regular\.woff2|Medium\.woff2|SemiBold\.woff2|LICENSE\.txt)|apps\/web\/public\/brand\/everyone-logotype(?:-white)?\.svg|apps\/web\/public\/fonts\/GeneralSans-(?:(?:Extralight|Light|Regular|Medium|Semibold|Bold)\.ttf|LICENSE\.txt)|apps\/web\/public\/templates\/everyone-film\/(?:casting-placeholder|everyone-wordmark)\.png)$/u.test(value);
}
/** Validate the COMPLETE list before reading one path. Image admission proves
 * this deployed source graph matches the independently pinned build manifest. */
export interface NativeSourceFile { path: string; sha256: string; bytes: number }
export interface NativeSourceSeal { source_sha256: string; files: NativeSourceFile[] }
export const NATIVE_SOURCE_ENTRYPOINTS = Object.freeze(['apps/worker/src/native-identity.mjs', 'apps/worker/src/native-sandbox-boundary.mjs', 'apps/worker/src/native-sandbox-launch.mjs', 'apps/worker/src/native-sandbox-task.mjs']);
export function parseNativeSourceSeal(source: unknown, expected: string): NativeSourceSeal {
  if (!object(source) || Object.keys(source).sort().join(',') !== 'files,source_sha256' || source.source_sha256 !== expected || !/^[a-f0-9]{64}$/u.test(expected)
    || !Array.isArray(source.files) || !source.files.length || source.files.length > 1000 || hash(JSON.stringify(source.files)) !== expected) fail();
  let previous = '';
  for (const item of source.files) {
    if (!object(item) || Object.keys(item).sort().join(',') !== 'bytes,path,sha256' || !sourcePath(item.path) || item.path <= previous || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(item.sha256)
      || !Number.isSafeInteger(item.bytes) || Number(item.bytes) < 1 || Number(item.bytes) > 16 * 1024 ** 2) fail(); previous = item.path;
  }
  return source as unknown as NativeSourceSeal;
}
export function verifyNativeSourceSeal(source: unknown, expected: string, read: (relative: string) => Uint8Array): void {
  for (const item of parseNativeSourceSeal(source, expected).files) { const bytes = read(item.path); if (bytes.length !== item.bytes || hash(bytes) !== item.sha256) fail(); }
}
/** Conservative non-code inputs include all schemas, templates, fonts, package
 * manifests, the complete lock, and the native Docker/tool contract. */
export function nativeBuildInputs(files: NativeSourceFile[]): string[] {
  return files.map(item => item.path).filter(relative => !/\.(?:ts|mjs)$/u.test(relative) && relative !== 'apps/worker/Dockerfile.daemon');
}
export function nativeDependencyContract(bytes: Uint8Array): string {
  const text = Buffer.from(bytes).toString('utf8').replaceAll('\r\n', '\n'); const starts = [...text.matchAll(/^FROM .+$/gmu)];
  if (starts.length !== 2 || starts[0][0] !== starts[1][0] + ' AS dependencies') fail();
  return text.slice(starts[0].index, starts[1].index).trim() + '\n' + starts[1][0];
}
/** The descriptor is independently pinned by raw SHA at hosted admission.
 * Native VM startup still checks its own COMPLETE artifact seal, independently.
 * This verifier never loads modules or accepts a job-selected path or image. */
export function verifyNativeCompatibility(descriptor: unknown, daemonValue: unknown, nativeValue: unknown,
  expected: { daemon_source_sha256: string; native_source_sha256: string; native_manifest_sha256: string }, read: (relative: string) => Uint8Array): void {
  const daemon = parseNativeSourceSeal(daemonValue, expected.daemon_source_sha256); const native = parseNativeSourceSeal(nativeValue, expected.native_source_sha256);
  if (!object(descriptor) || Object.keys(descriptor).sort().join(',') !== 'daemon_source_sha256,native_graph,native_graph_sha256,native_manifest_sha256,native_source_sha256,schema_version'
    || descriptor.schema_version !== '1.0' || descriptor.daemon_source_sha256 !== daemon.source_sha256 || descriptor.native_source_sha256 !== native.source_sha256
    || descriptor.native_manifest_sha256 !== expected.native_manifest_sha256 || !/^[a-f0-9]{64}$/u.test(expected.native_manifest_sha256)
    || descriptor.native_graph_sha256 !== hash(JSON.stringify(descriptor.native_graph))) fail();
  const graph = descriptor.native_graph;
  if (!object(graph) || Object.keys(graph).sort().join(',') !== 'build_inputs,compiler,entrypoints,external,modules'
    || JSON.stringify(graph.entrypoints) !== JSON.stringify(NATIVE_SOURCE_ENTRYPOINTS) || !Array.isArray(graph.modules) || !graph.modules.length || graph.modules.length > 1000
    || !Array.isArray(graph.external) || graph.external.length > 200 || JSON.stringify(graph.build_inputs) !== JSON.stringify(nativeBuildInputs(native.files))
    || JSON.stringify(nativeBuildInputs(daemon.files)) !== JSON.stringify(nativeBuildInputs(native.files))) fail();
  const nativeFiles = new Map(native.files.map(item => [item.path, item])); const daemonFiles = new Map(daemon.files.map(item => [item.path, item]));
  const same = (relative: string) => { const before = nativeFiles.get(relative); const now = daemonFiles.get(relative); if (!before || !now || JSON.stringify(before) !== JSON.stringify(now)) fail(); };
  for (const relative of graph.build_inputs as string[]) same(relative);
  const lock: unknown = JSON.parse(Buffer.from(read('package-lock.json')).toString('utf8')); const pkg: unknown = JSON.parse(Buffer.from(read('package.json')).toString('utf8'));
  if (!object(pkg) || !object(pkg.devDependencies) || !object(graph.compiler) || Object.keys(graph.compiler).sort().join(',') !== 'generator_sha256,module,name,target,version'
    || graph.compiler.name !== 'typescript' || graph.compiler.version !== pkg.devDependencies.typescript || graph.compiler.target !== 'ES2022' || graph.compiler.module !== 'ESNext'
    || typeof graph.compiler.generator_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(graph.compiler.generator_sha256)
    || !object(lock) || !object(lock.packages)) fail();
  const externals = new Set<string>(); let previous = '';
  for (const item of graph.external) {
    if (!object(item) || Object.keys(item).sort().join(',') !== 'integrity,lock_path,name,version' || typeof item.name !== 'string' || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(item.name)
      || typeof item.lock_path !== 'string' || item.lock_path <= previous || !/^(?:(?:apps\/worker|packages\/(?:domain|jobs|integrations|central))\/)?node_modules\/(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(item.lock_path)
      || typeof item.version !== 'string' || typeof item.integrity !== 'string') fail();
    const entry = lock.packages[item.lock_path]; if (!object(entry) || entry.version !== item.version || entry.integrity !== item.integrity || item.lock_path.split('node_modules/')[1] !== item.name) fail();
    previous = item.lock_path; externals.add(item.lock_path);
  }
  const modules = new Map<string, Record<string, unknown>>(); previous = '';
  for (const item of graph.modules) {
    if (!object(item) || Object.keys(item).sort().join(',') !== 'emitted_sha256,imports,path' || !sourcePath(item.path) || !/\.(?:ts|mjs|json)$/u.test(item.path)
      || item.path <= previous || typeof item.emitted_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(item.emitted_sha256) || !Array.isArray(item.imports) || item.imports.length > 200) fail();
    same(item.path); modules.set(item.path, item); previous = item.path;
  }
  const reached = new Set<string>(); const pending: string[] = [...NATIVE_SOURCE_ENTRYPOINTS]; const usedExternal = new Set<string>();
  while (pending.length) {
    const relative = pending.pop()!; if (reached.has(relative)) continue; reached.add(relative); const item = modules.get(relative); if (!item) fail();
    let last = '';
    for (const edge of item.imports as unknown[]) {
      if (!object(edge) || Object.keys(edge).sort().join(',') !== 'kind,resolved,specifier' || typeof edge.specifier !== 'string' || !edge.specifier || edge.specifier.length > 200
        || edge.specifier <= last || typeof edge.resolved !== 'string') fail(); last = edge.specifier;
      if (edge.kind === 'local') { if (!modules.has(edge.resolved)) fail(); pending.push(edge.resolved); }
      else if (edge.kind === 'builtin') { if (!isBuiltin(edge.specifier) || edge.resolved !== edge.specifier) fail(); }
      else if (edge.kind === 'external') { if (!externals.has(edge.resolved)) fail(); usedExternal.add(edge.resolved); }
      else fail();
    }
  }
  if (reached.size !== modules.size || usedExternal.size !== externals.size
    || nativeDependencyContract(read('apps/worker/Dockerfile.daemon')) !== nativeDependencyContract(read('apps/worker/Dockerfile.native-sandbox'))) fail();
}
