import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error reviewed Node ESM builder has no generated TS declaration
import { workerContextFiles, workerDaemonOutput, workerNativeManifest, validateWorkerBuildOwner } from '../../tools/worker-hosting-build.mjs';
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
