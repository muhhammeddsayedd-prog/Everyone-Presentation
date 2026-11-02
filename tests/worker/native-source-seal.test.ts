import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NATIVE_SOURCE_ENTRYPOINTS, nativeBuildInputs, verifyNativeCompatibility, verifyNativeSourceSeal } from '../../apps/worker/src/native-source-seal.ts';
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

test('different daemon source requires exact native closure, lock, build inputs and descriptor bindings', () => {
  const docker = 'FROM node@sha256:fixed AS dependencies\nRUN npm ci\n\nFROM node@sha256:fixed\n';
  const nativeBytes = new Map([
    ...NATIVE_SOURCE_ENTRYPOINTS.map(relative => [relative, Buffer.from('export {};')] as const),
    ['apps/worker/src/runtime-hosted.ts', Buffer.from('OLD_DAEMON')],
    ['package-lock.json', Buffer.from('{"packages":{}}')],
    ['package.json', Buffer.from('{"devDependencies":{"typescript":"6.0.3"}}')],
    ['apps/worker/Dockerfile.daemon', Buffer.from(docker)],
    ['apps/worker/Dockerfile.native-sandbox', Buffer.from(docker)],
  ]);
  const seal = (values: Map<string, Buffer>) => {
    const files = [...values].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, bytes]) => ({ path, sha256: hash(bytes.toString()), bytes: bytes.length }));
    return { files, source_sha256: hash(JSON.stringify(files)) };
  };
  const native = seal(nativeBytes); const daemonBytes = new Map(nativeBytes); daemonBytes.set('apps/worker/src/runtime-hosted.ts', Buffer.from('NEW_DAEMON'));
  const daemon = seal(daemonBytes);
  const graph = { entrypoints: [...NATIVE_SOURCE_ENTRYPOINTS], modules: NATIVE_SOURCE_ENTRYPOINTS.map(path => ({ path, emitted_sha256: hash('export {};'), imports: [] })),
    build_inputs: nativeBuildInputs(native.files), external: [], compiler: { name: 'typescript', version: '6.0.3', target: 'ES2022', module: 'ESNext', generator_sha256: 'd'.repeat(64) } };
  const descriptor = { schema_version: '1.0', daemon_source_sha256: daemon.source_sha256, native_source_sha256: native.source_sha256,
    native_manifest_sha256: 'a'.repeat(64), native_graph_sha256: hash(JSON.stringify(graph)), native_graph: graph };
  const expected = { daemon_source_sha256: daemon.source_sha256, native_source_sha256: native.source_sha256, native_manifest_sha256: 'a'.repeat(64) };
  const read = (relative: string) => daemonBytes.get(relative)!;
  assert.throws(() => verifyNativeSourceSeal(native, native.source_sha256, read));
  assert.doesNotThrow(() => verifyNativeCompatibility(descriptor, daemon, native, expected, read));
  for (const relative of ['apps/worker/src/native-sandbox-task.mjs', 'package-lock.json']) {
    const changed = new Map(daemonBytes); changed.set(relative, Buffer.from('CHANGED'));
    const current = seal(changed);
    assert.throws(() => verifyNativeCompatibility({ ...descriptor, daemon_source_sha256: current.source_sha256 }, current, native,
      { ...expected, daemon_source_sha256: current.source_sha256 }, r => changed.get(r)!));
  }
  for (const patch of [{ native_source_sha256: daemon.source_sha256 }, { native_graph_sha256: 'b'.repeat(64) }, { credential: 'PRIVATE' }]) {
    assert.throws(() => verifyNativeCompatibility({ ...descriptor, ...patch }, daemon, native, expected, read));
  }
  const incomplete = { ...graph, modules: [{ ...graph.modules[0], imports: [{ specifier: './missing.mjs', kind: 'local', resolved: 'apps/worker/src/missing.mjs' }] }] };
  assert.throws(() => verifyNativeCompatibility({ ...descriptor, native_graph: incomplete, native_graph_sha256: hash(JSON.stringify(incomplete)) }, daemon, native, expected, read));
});
