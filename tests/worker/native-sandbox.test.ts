import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { assertNativeSandboxIdle, executeNativeSandbox, nativeSandboxConfiguration, parseNativeManifest, type NativeSandboxClient, type NativeSandboxHandle } from '../../apps/worker/src/native-sandbox.ts';

const manifest = { schema_version: '1.0', transport: 'vercel_sandbox', protocol: 'eps-native-files-v1', image: 'muhammed-abdelrahman/eps-worker/native@sha256:' + 'a'.repeat(64), region: 'dub1', source_sha256: 'b'.repeat(64) };
function fixture() {
  const calls: { type: string; value?: unknown }[] = []; let exists = false; let content: Buffer = Buffer.from('{"ok":true,"result":"SYNTHETIC_PRIVATE"}');
  const handle = { name: '', tags: {}, image: manifest.image, persistent: false, networkPolicy: 'deny-all', region: 'dub1', vcpus: 1, memory: 2048, mounts: {}, routes: [], failoverRegions: [], currentSnapshotId: undefined, sourceSnapshotId: undefined,
    currentSession: () => ({ sessionId: 'synthetic_session' }),
    writeFiles: async (value: unknown) => { calls.push({ type: 'write', value }); },
    runCommand: async (value: unknown) => { calls.push({ type: 'command', value }); return { exitCode: 0 }; },
    readFile: async ({ path }: { path: string }) => Readable.from([path.endsWith('receipt.json') ? Buffer.from(JSON.stringify({ protocol: 'eps-native-files-v1', bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') })) : content]),
    stop: async () => { calls.push({ type: 'stop' }); return {}; }, delete: async () => { calls.push({ type: 'delete' }); exists = false; },
  } as unknown as NativeSandboxHandle;
  const client: NativeSandboxClient = { create: async options => { calls.push({ type: 'create', value: options }); handle.name = options.name; handle.tags = options.tags; exists = true; return handle; }, find: async () => exists ? { handle, status: 'running', session_id: 'synthetic_session' } : null };
  return { calls, client, handle, setContent: (value: Buffer) => { content = value; } };
}
test('closed manifest rejects floating images, wrong region, extra secret and missing source seal', () => {
  assert.deepEqual(parseNativeManifest(manifest), manifest);
  for (const mutation of [{ image: 'native:latest' }, { region: 'iad1' }, { token: 'PRIVATE_SENTINEL' }, { source_sha256: undefined }]) assert.throws(() => parseNativeManifest({ ...manifest, ...mutation }), /NATIVE_CONFIGURATION_INVALID/);
});
test('Vercel cannot reach local native children and restart refuses outstanding VM without adopting it', async () => {
  assert.equal(nativeSandboxConfiguration({}), undefined);
  assert.throws(() => nativeSandboxConfiguration({ VERCEL: '1' }), /NATIVE_CONFIGURATION_INVALID/);
  assert.throws(() => nativeSandboxConfiguration({ VERCEL: '1', EPS_NATIVE_TRANSPORT: 'local_docker' }), /NATIVE_CONFIGURATION_INVALID/);
  await assertNativeSandboxIdle(async () => false);
  await assert.rejects(assertNativeSandboxIdle(async () => true), /NATIVE_OUTSTANDING_SANDBOX/);
});
test('fresh VM explicitly denies network/persistence and uses private file output without payload commands', async () => {
  const f = fixture(); const payload = Buffer.from('SYNTHETIC_PRIVATE');
  assert.match(await executeNativeSandbox('document', payload, parseNativeManifest(manifest), { client: f.client }), /SYNTHETIC_PRIVATE/);
  const create = f.calls.find(call => call.type === 'create')!.value as Record<string, unknown>;
  assert.equal(create.networkPolicy, 'deny-all'); assert.equal(create.persistent, false); assert.deepEqual(create.env, {}); assert.deepEqual(create.ports, []); assert.deepEqual(create.mounts, {});
  assert(!JSON.stringify(f.calls.filter(call => call.type === 'command')).includes('SYNTHETIC_PRIVATE'));
  const write = f.calls.find(call => call.type === 'write')!.value as { path: string; mode: number }[]; assert.equal(write[0].mode, 0o600);
  assert.deepEqual(f.calls.slice(-2).map(call => call.type), ['stop', 'delete']);
});
test('unknown create is reconciled by exact generated name and tags before removal', async () => {
  const f = fixture(); const create = f.client.create; f.client.create = async options => { await create(options); throw new Error('private-provider-diagnostic'); };
  await assert.rejects(executeNativeSandbox('document', Buffer.from('{}'), parseNativeManifest(manifest), { client: f.client }), /NATIVE_EXECUTION_UNCONFIRMED/);
  assert.deepEqual(f.calls.slice(-2).map(call => call.type), ['stop', 'delete']);
});
test('ownership mismatch never executes or deletes an unrelated VM and latches failure', async () => {
  const f = fixture(); const create = f.client.create; f.client.create = async options => { const h = await create(options); h.tags = { owner: 'unrelated' }; return h; };
  await assert.rejects(executeNativeSandbox('document', Buffer.from('{}'), parseNativeManifest(manifest), { client: f.client }), /NATIVE_CLEANUP_UNCONFIRMED/);
  assert(!f.calls.some(call => ['command', 'write', 'delete'].includes(call.type)));
});
test('corrupt or oversized file result is rejected while exact-owned VM is removed', async () => {
  const f = fixture(); f.setContent(Buffer.alloc(24 * 1024 * 1024 + 1));
  await assert.rejects(executeNativeSandbox('document', Buffer.from('{}'), parseNativeManifest(manifest), { client: f.client }), /NATIVE_OUTPUT_INVALID/);
  assert(f.calls.some(call => call.type === 'delete'));
});
test('unknown delete cannot produce a successful result or cleanup claim', async () => {
  const f = fixture(); f.handle.delete = async () => { throw new Error('PRIVATE_DIAGNOSTIC'); };
  await assert.rejects(executeNativeSandbox('document', Buffer.from('{}'), parseNativeManifest(manifest), { client: f.client }), /NATIVE_CLEANUP_UNCONFIRMED/);
});
test('lost stop response is reconciled as stopped before exact deletion without replaying stop', async () => {
  const f = fixture(); const find = f.client.find; let stopped = false; let stops = 0;
  f.handle.stop = async () => { stops++; stopped = true; throw new Error('PRIVATE_LOST_ACK'); };
  f.client.find = async (...args) => { const value = await find(...args); if (value && stopped) value.status = 'stopped'; return value; };
  await executeNativeSandbox('document', Buffer.from('{}'), parseNativeManifest(manifest), { client: f.client });
  assert.equal(stops, 1); assert(f.calls.some(call => call.type === 'delete'));
});
test('already stopped VM with unavailable active-session getters is removed without resuming or stopping', async () => {
  const f = fixture(); const original = f.client.find;
  f.handle.runCommand = async () => { throw new Error('synthetic timeout'); };
  f.client.find = async (...args) => {
    const found = await original(...args);
    if (found) { found.status = 'stopped'; Object.defineProperty(found.handle, 'routes', { get: () => { throw new Error('No active session'); } }); Object.defineProperty(found.handle, 'sourceSnapshotId', { get: () => { throw new Error('No active session'); } }); found.handle.currentSession = () => { throw new Error('No active session'); }; }
    return found;
  };
  await assert.rejects(executeNativeSandbox('document', Buffer.from('{}'), parseNativeManifest(manifest), { client: f.client }), /NATIVE_EXECUTION_UNCONFIRMED/);
  assert(f.calls.some(call => call.type === 'delete')); assert(!f.calls.some(call => call.type === 'stop'));
});
test('input bounds and pre-aborted operation reject before VM creation', async () => {
  const f = fixture(); const controller = new AbortController(); controller.abort();
  await assert.rejects(executeNativeSandbox('document', Buffer.from('{}'), parseNativeManifest(manifest), { client: f.client, signal: controller.signal }), /NATIVE_ABORTED/);
  assert.equal(f.calls.length, 0);
});
