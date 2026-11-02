import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { hostedWorkerEnvironment } from '../../apps/worker/src/runtime-hosted-config.ts';
// @ts-expect-error reviewed Node ESM builder has no generated TS declaration
import { workerContextFiles, workerNativeCompatibility, workerNativeGraph } from '../../tools/worker-hosting-build.mjs';

const flags = ['EPS_SPECS_FILES_ENABLED', 'EPS_CANDIDATE_MEDIA_ENABLED', 'EPS_FRAME_EXTRACTION_ENABLED', 'EPS_PDF_VISION_ENABLED', 'EPS_REVIEW_ENABLED', 'EPS_PRESENTATION_ENABLED', 'EPS_GUEST_EXPORTS_ENABLED'];
const environment = { EPS_RELEASE_MODE: 'production', APP_ENV: 'production', NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production',
  VERCEL_OIDC_TOKEN_FILE: '/var/run/secrets/vercel.com/token', EPS_NATIVE_TRANSPORT: 'vercel_sandbox', EPS_NATIVE_MANIFEST_SHA256: 'a'.repeat(64), EPS_DAEMON_SOURCE_SHA256: 'b'.repeat(64), EPS_NATIVE_COMPATIBILITY_SHA256: 'c'.repeat(64),
  SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_guard_only',
  ...Object.fromEntries(flags.map(flag => [flag, 'true'])) };
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

test('production daemon preserves scoped OIDC/native settings without a pilot expiry', () => {
  const admitted = hostedWorkerEnvironment({ ...environment, RANDOM_PRIVATE_SENTINEL: 'secret' });
  assert.equal(admitted.APP_ENV, 'production'); assert.equal(admitted.EPS_RELEASE_MODE, 'production');
  assert.equal(admitted.EPS_PILOT_EXPIRES_AT, undefined); assert.equal(admitted.RANDOM_PRIVATE_SENTINEL, undefined);
  for (const change of [{ APP_ENV: undefined }, { APP_ENV: 'staging' }, { VERCEL_ENV: 'preview' }, { VERCEL_TOKEN: 'secret' },
    { SUPABASE_SERVICE_ROLE_KEY: 'secret' }, { DATABASE_URL: 'secret' }, { EPS_NATIVE_TRANSPORT: 'local_docker' },
    { EPS_FRAME_EXTRACTION_ENABLED: 'false' }, { EPS_PILOT_EXPIRES_AT: '2030-01-01T00:00:00Z' },
    { EPS_DAEMON_SOURCE_SHA256: undefined }, { EPS_NATIVE_COMPATIBILITY_SHA256: undefined },
    { SUPABASE_URL: 'https://foreign.supabase.co' }, { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private_sentinel' }]) {
    assert.throws(() => hostedWorkerEnvironment({ ...environment, ...change }), /HOSTED_WORKER_CONFIGURATION_INVALID/u);
  }
});

test('production native sandbox admits an exact baked manifest and source seal with unchanged environment restrictions', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'eps-production-native-'));
  try {
    await mkdir(path.join(root, 'apps/worker/src'), { recursive: true });
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }));
    const files: { path: string; sha256: string; bytes: number }[] = await workerContextFiles(); const content = new Map<string, Buffer>();
    for (const item of files) {
      const bytes = await readFile(item.path); content.set(item.path, bytes);
      await mkdir(path.dirname(path.join(root, item.path)), { recursive: true }); await writeFile(path.join(root, item.path), bytes);
    }
    const source = { files, source_sha256: hash(JSON.stringify(files)) }; const graph = workerNativeGraph(files, (relative: string) => content.get(relative)!);
    // A daemon-only source change is allowed with the genuinely older native artifact seal.
    const relative = 'apps/worker/src/runtime-hosted.ts'; const changed = Buffer.concat([content.get(relative)!, Buffer.from('\n// synthetic daemon-only change\n')]);
    content.set(relative, changed); await writeFile(path.join(root, relative), changed);
    const daemonFiles = files.map(item => item.path === relative ? { ...item, bytes: changed.length, sha256: hash(changed) } : item);
    const daemon = { files: daemonFiles, source_sha256: hash(JSON.stringify(daemonFiles)) };
    const manifest = { schema_version: '1.0', transport: 'vercel_sandbox', protocol: 'eps-native-files-v1',
      image: `synthetic/worker/native@sha256:${'b'.repeat(64)}`, region: 'dub1', source_sha256: source.source_sha256 };
    const bytes = JSON.stringify(manifest);
    const descriptor = JSON.stringify(workerNativeCompatibility(daemon, source, hash(bytes), graph, (relative: string) => content.get(relative)!));
    await writeFile(path.join(root, 'apps/worker/native-source.json'), JSON.stringify(source));
    await writeFile(path.join(root, 'apps/worker/daemon-source.json'), JSON.stringify(daemon));
    await writeFile(path.join(root, 'apps/worker/native-compatibility.json'), descriptor);
    await writeFile(path.join(root, 'apps/worker/native-sandbox-manifest.json'), bytes);
    const loaded = await import(pathToFileURL(path.join(root, 'apps/worker/src/native-sandbox.ts')).href);
    const env = { ...environment, EPS_NATIVE_MANIFEST_SHA256: hash(bytes), EPS_DAEMON_SOURCE_SHA256: daemon.source_sha256, EPS_NATIVE_COMPATIBILITY_SHA256: hash(descriptor) };
    assert.deepEqual(loaded.nativeSandboxConfiguration(env), manifest);
    assert.deepEqual(loaded.nativeSandboxSourceIdentity(), { daemon_source_sha256: daemon.source_sha256, native_source_sha256: source.source_sha256,
      native_graph_sha256: hash(JSON.stringify(graph)), native_manifest_sha256: hash(bytes), native_compatibility_sha256: hash(descriptor) });
    for (const change of [{ APP_ENV: 'staging' }, { VERCEL_ENV: 'preview' }, { SUPABASE_SERVICE_ROLE_KEY: 'secret' }, { VERCEL_TOKEN: 'secret' },
      { EPS_DAEMON_SOURCE_SHA256: 'd'.repeat(64) }, { EPS_NATIVE_COMPATIBILITY_SHA256: 'd'.repeat(64) }, { EPS_NATIVE_MANIFEST_SHA256: 'd'.repeat(64) }]) {
      assert.throws(() => loaded.nativeSandboxConfiguration({ ...env, ...change }), /NATIVE_CONFIGURATION_INVALID/u);
    }
  } finally {
    assert.equal(await realpath(root), root); assert.equal(path.dirname(root), tmpdir());
    assert(path.basename(root).startsWith('eps-production-native-')); await rm(root, { recursive: true });
  }
});
