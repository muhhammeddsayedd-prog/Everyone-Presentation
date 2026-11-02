import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error reviewed Node ESM builder has no generated TS declaration
import { workerContextFiles, workerDaemonGraph, workerDaemonOutput, workerNativeCompatibility, workerNativeGraph, workerNativeManifest, validateWorkerBuildOwner } from '../../tools/worker-hosting-build.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
test('daemon-only output keeps one bounded dub1 worker and no HTTP/static/functions', () => {
  const value = workerDaemonOutput('team/project/daemon.worker@sha256:' + 'a'.repeat(64));
  assert.deepEqual(value.config, { version: 3, daemons: { worker: {} } });
  assert.deepEqual(value.daemon.instances, { dub1: 1 }); assert.deepEqual(value.daemon.resources, { requests: { memory: '2Gi' } });
  assert.equal(value.daemon.terminationGracePeriodSeconds, 300);
});
test('build inputs reject mutable tags, registry URLs, extra path components and malformed source seals', () => {
  for (const image of ['team/project/native:latest', 'vcr.vercel.com/team/project/native@sha256:' + 'a'.repeat(64), '../project/native@sha256:' + 'a'.repeat(64), 'https://registry/native']) assert.throws(() => workerNativeManifest(image, 'b'.repeat(64)));
  assert.throws(() => workerNativeManifest('team/project/native@sha256:' + 'a'.repeat(64), 'PRIVATE'));
});
test('sparse build context includes registered fonts/layouts and worker graph, with no credentials/media/evidence', async () => {
  const files = await workerContextFiles(); const names = files.map((file: { path: string }) => file.path);
  assert(names.includes('apps/worker/src/runtime-hosted.ts')); assert(names.includes('packages/templates/versions/1.1.0/registry.json')); assert(names.includes('apps/web/public/fonts/IBMPlexSansArabic-Regular.woff2'));
  assert(!names.some((name: string) => /(?:^|\/)(?:\.env|\.local|\.git|tracking|development|test|tests|uploads)(?:[/.]|$)/u.test(name)));
  assert(!names.some((name: string) => /\.(?:mp4|pdf|docx|pem|key)$/u.test(name)));
});
test('generated build ownership is closed and never accepts an unrelated path marker', () => {
  const run = '11111111-2222-4333-8444-555555555555'; const owner = { owner: 'eps-worker-hosting-build', run, source_sha256: 'a'.repeat(64) };
  assert.doesNotThrow(() => validateWorkerBuildOwner(owner, run));
  for (const mutation of [{ owner: 'other' }, { run: '../escape' }, { source_sha256: 'PRIVATE' }, { credential: 'PRIVATE' }]) assert.throws(() => validateWorkerBuildOwner({ ...owner, ...mutation }, run));
});

test('native closure includes literal dynamic tasks and rejects missing or computed module edges', async () => {
  const files = await workerContextFiles(); const graph = workerNativeGraph(files, readFileSync);
  const names = graph.modules.map((item: { path: string }) => item.path);
  for (const relative of ['prepare-process.mjs', 'video-process.mjs', 'pdf-raster-process.mjs', 'review-fit.ts', 'presentation-pdf.ts', 'native-source-seal.ts']) assert(names.includes('apps/worker/src/' + relative));
  assert(!names.includes('packages/integrations/src/openai-specs.ts'));
  for (const code of ["await import(process.argv[2]);", "await import('./unregistered.mjs');"]) {
    const relative = 'apps/worker/src/native-sandbox-task.mjs'; const bytes = Buffer.from(code);
    const changed = files.map((item: { path: string }) => item.path === relative ? { path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') } : item);
    assert.throws(() => workerNativeGraph(changed, (name: string) => name === relative ? bytes : readFileSync(name)));
  }
});

test('daemon closure uses its own fixed entry and includes provider code without native task roots', async () => {
  const files = await workerContextFiles(); const graph = workerDaemonGraph(files, readFileSync); const names = graph.modules.map((item: { path: string }) => item.path);
  assert.deepEqual(graph.entrypoints, ['apps/worker/src/runtime-hosted.ts']);
  for (const relative of ['apps/worker/src/runtime-main.ts', 'apps/worker/src/native-source-seal.ts', 'packages/integrations/src/openai-specs.ts']) assert(names.includes(relative));
  assert(!names.includes('apps/worker/src/native-sandbox-task.mjs')); assert(!names.includes('apps/worker/src/native-sandbox-boundary.mjs'));
});

test('emitter compatibility permits a daemon-only patch and refuses graph, lock, schema, asset or Docker drift', async () => {
  const files: { path: string; bytes: number; sha256: string }[] = await workerContextFiles();
  const bytes = new Map<string, Buffer>(files.map(item => [item.path, readFileSync(item.path)]));
  const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
  const source = { files, source_sha256: hash(JSON.stringify(files)) }; const graph = workerNativeGraph(files, (name: string) => bytes.get(name)!);
  const changed = (relative: string, value: Buffer) => {
    const current = new Map(bytes); current.set(relative, value);
    const rows = files.map(item => item.path === relative ? { path: relative, sha256: hash(value), bytes: value.length } : item);
    return { source: { files: rows, source_sha256: hash(JSON.stringify(rows)) }, read: (name: string) => current.get(name)! };
  };
  const daemon = changed('packages/integrations/src/openai-specs.ts', Buffer.concat([bytes.get('packages/integrations/src/openai-specs.ts')!, Buffer.from('\n// daemon-only synthetic patch\n')]));
  assert.deepEqual(workerNativeGraph(daemon.source.files, daemon.read), graph);
  assert.doesNotThrow(() => workerNativeCompatibility(daemon.source, source, 'a'.repeat(64), graph, daemon.read));
  for (const relative of ['apps/worker/src/native-source-seal.ts', 'package-lock.json', 'contracts/json-schema/specs-extraction.schema.json', 'apps/web/public/fonts/IBMPlexSans-Regular.woff2', 'apps/worker/Dockerfile.native-sandbox']) {
    const candidate = changed(relative, Buffer.concat([bytes.get(relative)!, Buffer.from('\n')]));
    assert.throws(() => workerNativeCompatibility(candidate.source, source, 'a'.repeat(64), graph, candidate.read));
  }
  const docker = changed('apps/worker/Dockerfile.daemon', Buffer.from(bytes.get('apps/worker/Dockerfile.daemon')!.toString().replace('RUN npm ci', 'RUN npm ci --force')));
  assert.throws(() => workerNativeCompatibility(docker.source, source, 'a'.repeat(64), graph, docker.read));
  for (const bad of [{ ...graph, modules: graph.modules.slice(1) }, { ...graph, build_inputs: graph.build_inputs.slice(1) },
    { ...graph, modules: graph.modules.map((item: { emitted_sha256: string }, i: number) => i === 0 ? { ...item, emitted_sha256: 'f'.repeat(64) } : item) }]) {
    assert.throws(() => workerNativeCompatibility(source, source, 'a'.repeat(64), bad, (name: string) => bytes.get(name)!));
  }
});
