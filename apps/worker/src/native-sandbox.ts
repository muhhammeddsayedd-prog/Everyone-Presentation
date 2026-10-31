import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Readable } from 'node:stream';
import path from 'node:path';
import { verifyNativeSourceSeal } from './native-source-seal.ts';

export const NATIVE_PROTOCOL = 'eps-native-files-v1';
export const NATIVE_TASKS = Object.freeze({
  document: { input: 28 * 1024 ** 2, output: 24 * 1024 ** 2, timeout: 30_000 },
  video: { input: Math.ceil(256 * 1024 ** 2 * 4 / 3) + 4096, output: 64 * 1024 ** 2, timeout: 190_000 },
  pdf_raster: { input: 28 * 1024 ** 2, output: 64 * 1024 ** 2, timeout: 190_000 },
  review_fit: { input: 8 * 1024 ** 2, output: 4 * 1024 ** 2, timeout: 90_000 },
  presentation_render: { input: 192 * 1024 ** 2, output: 96 * 1024 ** 2, timeout: 120_000 },
  presentation_validate: { input: 280 * 1024 ** 2, output: 4 * 1024 ** 2, timeout: 190_000 },
  presentation_export_render: { input: 192 * 1024 ** 2, output: 96 * 1024 ** 2, timeout: 120_000 },
  presentation_export_validate: { input: 280 * 1024 ** 2, output: 4 * 1024 ** 2, timeout: 190_000 },
});
export type NativeTask = keyof typeof NATIVE_TASKS;
export interface NativeManifest { schema_version: '1.0'; transport: 'vercel_sandbox'; protocol: typeof NATIVE_PROTOCOL; image: string; region: 'dub1'; source_sha256: string }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
export class NativeSandboxError extends Error { readonly code: string; constructor(code: string) { super(code); this.name = 'NativeSandboxError'; this.code = code; } }
function fail(code: string): never { throw new NativeSandboxError(code); }
export function parseNativeManifest(value: unknown): NativeManifest {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'image,protocol,region,schema_version,source_sha256,transport'
    || value.schema_version !== '1.0' || value.transport !== 'vercel_sandbox' || value.protocol !== NATIVE_PROTOCOL || value.region !== 'dub1'
    || !digest(value.source_sha256) || typeof value.image !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,99}\/[a-z0-9][a-z0-9_-]{0,99}\/[a-z0-9][a-z0-9._-]{0,99}@sha256:[a-f0-9]{64}$/u.test(value.image)) fail('NATIVE_CONFIGURATION_INVALID');
  return Object.freeze({ ...value }) as unknown as NativeManifest;
}
let configured: NativeManifest | undefined;
/** Fixed image-baked manifest, never a job-supplied path/image/command. */
export function nativeSandboxConfiguration(environment: Readonly<Record<string, string | undefined>> = process.env): NativeManifest | undefined {
  const mode = environment.EPS_NATIVE_TRANSPORT;
  if (mode === undefined || mode === 'local_docker') { if (environment.VERCEL === '1') fail('NATIVE_CONFIGURATION_INVALID'); return undefined; }
  if (mode !== 'vercel_sandbox' || environment.VERCEL !== '1' || environment.VERCEL_ENV !== 'production'
    || environment.EPS_RELEASE_MODE !== 'controlled_pilot' || environment.NODE_ENV !== 'production'
    || environment.VERCEL_OIDC_TOKEN_FILE !== '/var/run/secrets/vercel.com/token'
    || ['VERCEL_TOKEN', 'VERCEL_ACCESS_TOKEN', 'N8N_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].some(key => environment[key])) fail('NATIVE_CONFIGURATION_INVALID');
  if (configured) return configured;
  const file = fileURLToPath(new URL('../native-sandbox-manifest.json', import.meta.url));
  const seal = fileURLToPath(new URL('../native-source.json', import.meta.url));
  try {
    for (const target of [file, seal]) { const info = lstatSync(target); if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024) fail('NATIVE_CONFIGURATION_INVALID'); }
    const bytes = readFileSync(file); if (!digest(environment.EPS_NATIVE_MANIFEST_SHA256) || hash(bytes) !== environment.EPS_NATIVE_MANIFEST_SHA256) fail('NATIVE_CONFIGURATION_INVALID');
    const manifest = parseNativeManifest(JSON.parse(bytes.toString('utf8')));
    // source seal is produced from the reviewed sparse context, independently
    // pinned in both images. Runtime never selects an arbitrary local image ID.
    const source: unknown = JSON.parse(readFileSync(seal, 'utf8'));
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    verifyNativeSourceSeal(source, manifest.source_sha256, relative => { const target = path.join(root, relative); const info = lstatSync(target); if (!info.isFile() || info.isSymbolicLink()) fail('NATIVE_CONFIGURATION_INVALID'); return readFileSync(target); });
    configured = manifest; return configured;
  } catch { return fail('NATIVE_CONFIGURATION_INVALID'); }
}
export function nativeImageConfigured(image: string | undefined, environment: Readonly<Record<string, string | undefined>>): boolean {
  const config = nativeSandboxConfiguration(environment); return config ? image === nativeImageIdentity(config) : /^sha256:[a-f0-9]{64}$/u.test(image ?? '');
}
export function nativeImageIdentity(config: NativeManifest): string { return parseNativeManifest(config).image.split('@')[1]; }
export interface NativeSandboxHandle {
  name: string; tags?: Record<string, string>; image?: string; persistent: boolean; region: string; vcpus?: number; memory?: number;
  networkPolicy?: unknown; mounts?: unknown; routes: unknown[]; failoverRegions: string[]; currentSnapshotId?: string; sourceSnapshotId?: string;
  writeFiles(files: { path: string; content: Uint8Array; mode: number }[], options: { signal: AbortSignal }): Promise<void>;
  runCommand(options: { cmd: string; args: string[]; cwd: string; env: Record<string, string>; sudo: boolean; signal: AbortSignal; timeoutMs: number }): Promise<{ exitCode: number }>;
  readFile(file: { path: string }, options: { signal: AbortSignal }): Promise<Readable | NodeJS.ReadableStream | null>;
  stop(options?: { signal: AbortSignal }): Promise<{ snapshot?: unknown }>;
  delete(options?: { signal: AbortSignal; deleteOrphanSnapshots: boolean }): Promise<void>;
  currentSession(): { sessionId: string };
}
interface CreateOptions { name: string; tags: Record<string, string>; image: string; region: 'dub1'; resources: { vcpus: 1 }; timeout: number; networkPolicy: 'deny-all'; persistent: false; ports: []; mounts: Record<string, never>; env: Record<string, never>; signal: AbortSignal }
export interface NativeSandboxObservation { handle: NativeSandboxHandle; status: string; session_id: string }
export interface NativeSandboxClient { create(options: CreateOptions): Promise<NativeSandboxHandle>; find(name: string, signal: AbortSignal): Promise<NativeSandboxObservation | null> }
async function sdkClient(): Promise<NativeSandboxClient> {
  const { Sandbox, APIError } = await import('@vercel/sandbox');
  return { create: options => Sandbox.create({ ...options }), find: async (name, signal) => {
    // Exact prefix+name lookup does not auto-resume or adopt another object.
    const result = await Sandbox.list({ namePrefix: name, sortBy: 'name', limit: 2, signal }); let found: { status: string; currentSessionId: string } | undefined;
    for await (const row of result) { if (row.name !== name || found) fail('NATIVE_CLEANUP_UNCONFIRMED'); found = row; }
    if (found) return { handle: await Sandbox.get({ name, resume: false, signal }), status: found.status, session_id: found.currentSessionId };
    // A successful empty list AND exact-name readback404 are required. Unknown
    // provider/auth/network errors never become an absence observation.
    try { await Sandbox.get({ name, resume: false, signal }); }
    catch (error) { if (error instanceof APIError && error.response.status === 404) return null; throw error; }
    return fail('NATIVE_CLEANUP_UNCONFIRMED');
  } };
}
export interface NativeCleanupIdentity { sandbox_name: string; run: string; session_id: string | null; source_sha256: string; task: NativeTask }
let active = 0; let poisoned = false; const fatalListeners = new Set<(identity: NativeCleanupIdentity) => void>();
export function nativeSandboxCleanupUnconfirmed(): boolean { return poisoned; }
export function onNativeSandboxUnconfirmed(callback: (identity: NativeCleanupIdentity) => void): () => void { fatalListeners.add(callback); return () => { fatalListeners.delete(callback); }; }
export async function assertNativeSandboxIdle(observe: () => Promise<boolean> = async () => {
  const { Sandbox } = await import('@vercel/sandbox');
  const found = await Sandbox.list({ namePrefix: 'eps-native-', sortBy: 'name', tags: { owner: 'eps-native' }, limit: 1, signal: AbortSignal.timeout(15_000) });
  for await (const row of found) { if (row) return true; } return false;
}): Promise<void> { if (await observe()) fail('NATIVE_OUTSTANDING_SANDBOX'); }
async function boundedRead(stream: NodeJS.ReadableStream | null, maximum: number): Promise<Buffer> {
  if (!stream) fail('NATIVE_OUTPUT_INVALID'); const chunks: Buffer[] = []; let count = 0;
  for await (const raw of stream) { const chunk = Buffer.from(raw); count += chunk.length; if (count > maximum) { if ('destroy' in stream && typeof stream.destroy === 'function') stream.destroy(); fail('NATIVE_OUTPUT_INVALID'); } chunks.push(chunk); }
  return Buffer.concat(chunks);
}
/** One fresh deny-all credential-free VM. No stdout/stderr is consumed as data,
 * no snapshots/drives/ports, no supplied script, no retries after unknown work.
 * Cleanup has an independent deadline; unconfirmed ownership/absence stops the
 * hosted polling process. Injected client is an offline test seam only. */
export async function executeNativeSandbox(task: NativeTask, input: Uint8Array, manifest: NativeManifest, options: { client?: NativeSandboxClient; signal?: AbortSignal; timeoutMs?: number } = {}): Promise<string> {
  manifest = parseNativeManifest(manifest); const limits = Object.hasOwn(NATIVE_TASKS, task) ? NATIVE_TASKS[task] : undefined;
  if (!limits || !(input instanceof Uint8Array) || !input.length || input.length > limits.input) fail('NATIVE_INPUT_INVALID');
  if (options.signal?.aborted) fail('NATIVE_ABORTED'); if (poisoned && !options.client) fail('NATIVE_CLEANUP_UNCONFIRMED');
  const deadline = options.timeoutMs ?? limits.timeout;
  if (!Number.isSafeInteger(deadline) || deadline < 1 || deadline > limits.timeout) fail('NATIVE_CONFIGURATION_INVALID');
  if (active >= 2) fail('NATIVE_BUSY'); active++;
  const run = randomUUID(); const name = `eps-native-${run}`; const tags = { owner: 'eps-native', run, source: manifest.source_sha256 };
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(deadline + 60_000)]) : AbortSignal.timeout(deadline + 60_000);
  let client: NativeSandboxClient | undefined; let attempted = false; let handle: NativeSandboxHandle | undefined; let sessionId: string | undefined;
  const owned = (value: NativeSandboxHandle, activeSession = false) => {
    if (value.name !== name || value.tags?.owner !== tags.owner || value.tags?.run !== run || value.tags?.source !== tags.source
      || Object.keys(value.tags).length !== 3 || value.image !== manifest.image || value.region !== manifest.region || value.persistent !== false
      || value.networkPolicy !== 'deny-all' || value.vcpus !== 1 || value.memory !== 2048 || value.failoverRegions.length !== 0
      || value.currentSnapshotId !== undefined || value.mounts && (!record(value.mounts) || Object.keys(value.mounts).length !== 0)) fail('NATIVE_OWNERSHIP_INVALID');
    if (activeSession && (value.routes.length !== 0 || value.sourceSnapshotId !== undefined || value.currentSession().sessionId !== sessionId)) fail('NATIVE_OWNERSHIP_INVALID');
  };
  try {
    client = options.client ?? await sdkClient(); attempted = true;
    handle = await client.create({ name, tags, image: manifest.image, region: manifest.region, resources: { vcpus: 1 }, timeout: deadline + 60_000,
      networkPolicy: 'deny-all', persistent: false, ports: [], mounts: {}, env: {}, signal }); sessionId = handle.currentSession().sessionId;
    if (!/^[A-Za-z0-9_-]{1,200}$/u.test(sessionId)) fail('NATIVE_OWNERSHIP_INVALID'); owned(handle, true);
    // Bootstrap is fixed and emits no data. No shell or uploaded path appears
    // in a command. It creates a mode0700 bounded tmpfs, then returns.
    const bootstrap = await handle.runCommand({ cmd: '/usr/local/bin/node', args: ['/opt/eps/apps/worker/src/native-sandbox-launch.mjs', 'init'], cwd: '/opt/eps', env: {}, sudo: true, signal, timeoutMs: 30_000 });
    if (bootstrap.exitCode !== 0) fail('NATIVE_ISOLATION_UNAVAILABLE');
    await handle.writeFiles([{ path: '/eps-work/input.json', content: Uint8Array.from(input), mode: 0o600 }], { signal });
    const command = await handle.runCommand({ cmd: '/usr/local/bin/node', args: ['/opt/eps/apps/worker/src/native-sandbox-launch.mjs', task], cwd: '/opt/eps', env: {}, sudo: true, signal, timeoutMs: deadline });
    if (command.exitCode !== 0) fail('NATIVE_EXECUTION_UNCONFIRMED');
    const receiptBytes = await boundedRead(await handle.readFile({ path: '/eps-work/receipt.json' }, { signal }), 4096);
    let receipt: unknown; try { receipt = JSON.parse(receiptBytes.toString('utf8')); } catch { fail('NATIVE_OUTPUT_INVALID'); }
    if (!record(receipt) || Object.keys(receipt).sort().join(',') !== 'bytes,protocol,sha256' || receipt.protocol !== NATIVE_PROTOCOL || !digest(receipt.sha256)
      || !Number.isSafeInteger(receipt.bytes) || Number(receipt.bytes) < 1 || Number(receipt.bytes) > limits.output) fail('NATIVE_OUTPUT_INVALID');
    const output = await boundedRead(await handle.readFile({ path: '/eps-work/output.json' }, { signal }), Number(receipt.bytes));
    if (output.length !== receipt.bytes || hash(output) !== receipt.sha256) fail('NATIVE_OUTPUT_INVALID'); return output.toString('utf8');
  } catch (error) { if (error instanceof NativeSandboxError) throw error; return fail(options.signal?.aborted ? 'NATIVE_ABORTED' : 'NATIVE_EXECUTION_UNCONFIRMED'); }
  finally {
    try {
      if (attempted && client) {
        const cleanupSignal = AbortSignal.timeout(30_000); const actual = await client.find(name, cleanupSignal);
        if (!actual && !handle) fail('NATIVE_CLEANUP_UNCONFIRMED');
        if (actual) {
          if (!/^[A-Za-z0-9_-]{1,200}$/u.test(actual.session_id) || sessionId && actual.session_id !== sessionId) fail('NATIVE_CLEANUP_UNCONFIRMED');
          const terminal = ['stopped', 'failed', 'aborted'].includes(actual.status);
          if (!terminal && !['running', 'pending', 'stopping'].includes(actual.status)) fail('NATIVE_CLEANUP_UNCONFIRMED');
          owned(actual.handle);
          if (!terminal) {
            sessionId ??= actual.session_id; owned(actual.handle, true);
            let stopped: { snapshot?: unknown } | undefined;
            try { stopped = await actual.handle.stop({ signal: cleanupSignal }); }
            catch {
              // An ACK can be lost after the VM stopped. Observe, never replay
              // stop or resume, before deciding whether deletion is safe.
              const afterStop = await client.find(name, cleanupSignal);
              if (!afterStop || !['stopped', 'failed', 'aborted'].includes(afterStop.status) || afterStop.session_id !== sessionId) fail('NATIVE_CLEANUP_UNCONFIRMED');
              owned(afterStop.handle);
            }
            if (stopped?.snapshot !== undefined) fail('NATIVE_CLEANUP_UNCONFIRMED');
          }
          try { await actual.handle.delete({ signal: cleanupSignal, deleteOrphanSnapshots: false }); }
          catch { if (await client.find(name, cleanupSignal)) fail('NATIVE_CLEANUP_UNCONFIRMED'); }
        }
        if (await client.find(name, cleanupSignal)) fail('NATIVE_CLEANUP_UNCONFIRMED');
      }
    } catch { if (!options.client) {
      poisoned = true; const identity = { sandbox_name: name, run, task, source_sha256: manifest.source_sha256, session_id: sessionId && /^[A-Za-z0-9_-]{1,200}$/u.test(sessionId) ? sessionId : null };
      for (const listener of fatalListeners) listener(identity);
    } fail('NATIVE_CLEANUP_UNCONFIRMED'); }
    finally { active--; }
  }
}
export async function runConfiguredNative(task: NativeTask, payload: string, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<string> {
  const manifest = nativeSandboxConfiguration(); if (!manifest) fail('NATIVE_CONFIGURATION_INVALID');
  return executeNativeSandbox(task, Buffer.from(payload), manifest, options);
}
