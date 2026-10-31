import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseVideoProbe, validateVideoInput } from './video-native.ts';
import { VIDEO_LIMITS, VideoPreparationError, type PreparedVideo, type VideoInput } from './video-types.ts';
import { nativeImageIdentity, nativeSandboxConfiguration, runConfiguredNative } from './native-sandbox.ts';
const host = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
// Observed signed Docker Inc CLI on this Windows workstation. Do not inherit
// broad PATH, user Docker contexts/configuration or provider credentials.
const executable = process.platform === 'win32' ? 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe' : '/usr/bin/docker';
const configDirectory = fileURLToPath(new URL('../../../.local/native-docker-cli/', import.meta.url));
export function nativeDockerEnvironment(environment: Readonly<Record<string, string | undefined>>): NodeJS.ProcessEnv {
  // This Windows runtime inherits its parent's PATH when the key is absent. An empty
  // value is deliberate: every executable in this adapter uses an absolute path.
  const result: NodeJS.ProcessEnv = { NODE_ENV: 'production', PATH: '' };
  for (const name of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'LANG']) if (environment[name]) result[name] = environment[name]; return result;
}
const ownerLabel = 'com.everyone.presentation.owner'; const runLabel = 'com.everyone.presentation.run';
let active = 0;
function fail(code: string): never { throw new VideoPreparationError(code); }
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function docker(args: string[], input?: string, timeout = 15_000, maximum = 1024 * 1024, signal?: AbortSignal): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['--config', configDirectory, '--host', host, ...args], { shell: false, windowsHide: true, env: nativeDockerEnvironment(process.env), stdio: ['pipe', 'pipe', 'pipe'] });
    let length = 0; let diagnostics = 0; const chunks: Buffer[] = []; let problem: string | undefined;
    const stop = (code: string) => { problem ??= code; child.kill('SIGKILL'); };
    const cancel = () => stop('VIDEO_PREPARATION_CANCELLED'); signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => stop('VIDEO_PROCESS_TIMEOUT'), timeout);
    child.on('error', () => { problem ??= 'VIDEO_CONTAINER_UNAVAILABLE'; }); child.stdin.on('error', () => {});
    child.stdout.on('data', (chunk: Buffer) => { length += chunk.length; if (length > maximum) stop('VIDEO_OUTPUT_LIMIT'); else chunks.push(chunk); });
    child.stderr.on('data', (chunk: Buffer) => { diagnostics += chunk.length; if (diagnostics > 1024 * 1024) stop('VIDEO_OUTPUT_LIMIT'); });
    child.on('close', code => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); if (problem) reject(new VideoPreparationError(problem)); else resolve({ code, stdout: Buffer.concat(chunks).toString('utf8') }); });
    if (signal?.aborted) cancel(); child.stdin.end(input);
  });
}
async function inspect(kind: 'image' | 'container', identifier: string): Promise<Record<string, unknown>> {
  const raw = await docker([kind, 'inspect', identifier]); if (raw.code !== 0) fail('VIDEO_CONTAINER_INSPECTION_FAILED');
  let value: unknown; try { value = JSON.parse(raw.stdout); } catch { fail('VIDEO_CONTAINER_INSPECTION_FAILED'); }
  if (!Array.isArray(value) || value.length !== 1 || !object(value[0])) fail('VIDEO_CONTAINER_INSPECTION_FAILED'); return value[0];
}
function resultFromJSON(text: string, input: VideoInput, requestedTimestamps?: number[]): PreparedVideo {
  let envelope: unknown; try { envelope = JSON.parse(text); } catch { fail('VIDEO_PROCESS_FAILED'); }
  if (!object(envelope)) fail('VIDEO_PROCESS_FAILED');
  if (envelope.ok === false && typeof envelope.code === 'string' && /^VIDEO_[A-Z_]{1,80}$/u.test(envelope.code)) fail(envelope.code);
  if (envelope.ok !== true || !object(envelope.result)) fail('VIDEO_PROCESS_FAILED'); const value = envelope.result;
  if (value.source_asset_id !== input.source_asset_id || value.source_sha256 !== hash(input.bytes) || value.implementation_version !== 'video-preparation.v1'
    || !object(value.probe) || !Array.isArray(value.audio_chunks) || value.audio_chunks.length > VIDEO_LIMITS.maximumChunks || !Array.isArray(value.sampled_frames) || value.sampled_frames.length > VIDEO_LIMITS.maximumSamples
    || !Array.isArray(value.warnings) || value.warnings.length > 32 || value.warnings.some(warning => typeof warning !== 'string' || !/^[A-Z_]{1,100}$/u.test(warning))
    || typeof value.ffmpeg_version !== 'string' || !/^ffmpeg version [\w.+:~-]{1,100} /u.test(value.ffmpeg_version)) fail('VIDEO_PROCESS_FAILED');
  const probe = value.probe;
  if (value.display_geometry !== undefined) {
    const geometry = value.display_geometry;
    if (!object(geometry) || Object.keys(geometry).sort().join(',') !== 'display_aspect_ratio,height,sample_aspect_ratio,width'
      || !['width', 'height'].every(key => Number.isSafeInteger(geometry[key]) && Number(geometry[key]) >= 1 && Number(geometry[key]) <= 1280)
      || !['sample_aspect_ratio', 'display_aspect_ratio'].every(key => object(geometry[key]) && Object.keys(geometry[key]).sort().join(',') === 'denominator,numerator'
        && Number.isSafeInteger(geometry[key].numerator) && Number(geometry[key].numerator) > 0 && Number.isSafeInteger(geometry[key].denominator) && Number(geometry[key].denominator) > 0)) fail('VIDEO_PROCESS_FAILED');
  }
  // Revalidate returned metadata through the same bounded probe contract.
  parseVideoProbe({ format: { format_name: probe.container, duration: typeof probe.duration_ms === 'number' ? probe.duration_ms / 1000 : null, start_time: 0 }, streams: [{ codec_type: 'video', codec_name: probe.video_codec, width: probe.width, height: probe.height, avg_frame_rate: `${probe.frame_rate}/1` }] });
  function bytes(raw: unknown, maximum: number, expectedHash: unknown): Uint8Array {
    if (typeof raw !== 'string' || raw.length > Math.ceil(maximum * 4 / 3) + 4) fail('VIDEO_PROCESS_FAILED'); const decoded = Buffer.from(raw, 'base64');
    if (!decoded.length || decoded.length > maximum || decoded.toString('base64') !== raw || hash(decoded) !== expectedHash) fail('VIDEO_PROCESS_FAILED'); return decoded;
  }
  const audio = value.audio_chunks.map((raw, index) => {
    if (!object(raw) || raw.index !== index || raw.mime_type !== 'audio/mpeg' || typeof raw.start_ms !== 'number' || !Number.isSafeInteger(raw.start_ms) || raw.start_ms < 0
      || typeof raw.end_ms !== 'number' || !Number.isSafeInteger(raw.end_ms) || raw.end_ms <= raw.start_ms || raw.end_ms > Number(probe.duration_ms) || typeof raw.sha256 !== 'string') fail('VIDEO_PROCESS_FAILED');
    return { index, start_ms: raw.start_ms, end_ms: raw.end_ms, mime_type: 'audio/mpeg' as const, sha256: raw.sha256, bytes: bytes(raw.bytes, VIDEO_LIMITS.maximumAudioChunkBytes, raw.sha256) };
  });
  const frames = value.sampled_frames.map(raw => {
    if (!object(raw) || raw.source_asset_id !== input.source_asset_id || typeof raw.sha256 !== 'string' || raw.frame_asset_id !== `frame-${raw.sha256}`
      || typeof raw.timestamp_ms !== 'number' || !Number.isSafeInteger(raw.timestamp_ms) || raw.timestamp_ms < 0 || raw.timestamp_ms >= Number(probe.duration_ms)
      || requestedTimestamps && (typeof raw.requested_timestamp_ms !== 'number' || !requestedTimestamps.includes(raw.requested_timestamp_ms) || raw.timestamp_ms < raw.requested_timestamp_ms)
      || !requestedTimestamps && raw.requested_timestamp_ms !== undefined
      || typeof raw.width !== 'number' || !Number.isSafeInteger(raw.width) || raw.width < 1 || raw.width > 1280 || typeof raw.height !== 'number' || !Number.isSafeInteger(raw.height) || raw.height < 1 || raw.height > 1280
      || !object(raw.quality) || !['luminance', 'contrast', 'sharpness'].every(key => typeof raw.quality === 'object' && raw.quality !== null && Number.isFinite((raw.quality as Record<string, unknown>)[key]))
      || typeof raw.quality.difference_hash !== 'string' || !/^[a-f0-9]{16}$/u.test(raw.quality.difference_hash) || !Array.isArray(raw.quality_flags)
      || raw.quality_flags.some(flag => !['EXPOSURE_LIMIT', 'LOW_DETAIL'].includes(String(flag)))) fail('VIDEO_PROCESS_FAILED');
    return { ...raw, bytes: bytes(raw.bytes, VIDEO_LIMITS.maximumFrameBytes, raw.sha256) };
  });
  return { ...value, audio_chunks: audio, sampled_frames: frames } as unknown as PreparedVideo;
}
/** Fixed local Docker endpoint, immutable locally built image ID, no host mounts,
 * secrets, sockets, network or logged bytes. This is local execution, not hosting. */
export async function prepareVideoIsolated(input: VideoInput, options: { imageId: string; signal?: AbortSignal; probeOnly?: boolean; timestampsMs?: number[] }): Promise<PreparedVideo> {
  validateVideoInput(input);
  input = { source_asset_id: input.source_asset_id, mime_type: input.mime_type, bytes: Uint8Array.from(input.bytes) };
  options = { ...options, timestampsMs: options?.timestampsMs ? [...options.timestampsMs] : undefined };
  if (options.timestampsMs && (!Array.isArray(options.timestampsMs) || !options.timestampsMs.length || options.timestampsMs.length > VIDEO_LIMITS.maximumSamples || new Set(options.timestampsMs).size !== options.timestampsMs.length || options.timestampsMs.some(timestamp => !Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp >= VIDEO_LIMITS.maximumDurationMs))) fail('VIDEO_TIMESTAMP_INVALID');
  const payload = { source_asset_id: input.source_asset_id, mime_type: input.mime_type, bytes: Buffer.from(input.bytes).toString('base64'), probe_only: options.probeOnly ?? false, timestamps_ms: options.timestampsMs ?? null };
  return resultFromJSON(await runOwnedNativeMedia(JSON.stringify(payload), options), input, options.timestampsMs);
}
/** Internal fixed-protocol seam shared by native video and PDF raster images.
 * Only locally built, immutable EPS-owned image IDs are accepted. */
export async function runOwnedNativeMedia(payload: string, options: { imageId: string; signal?: AbortSignal; operation?: 'video' | 'pdf_raster' }): Promise<string> {
  if (typeof payload !== 'string' || Buffer.byteLength(payload) > Math.ceil(VIDEO_LIMITS.maximumBytes * 4 / 3) + 4096) fail('VIDEO_LIMIT_EXCEEDED');
  const sandbox = nativeSandboxConfiguration();
  if (sandbox) {
    if (options.imageId !== nativeImageIdentity(sandbox)) fail('VIDEO_CONTAINER_CONFIGURATION_INVALID');
    return runConfiguredNative(options.operation ?? 'video', payload, { signal: options.signal });
  }
  if (!options || !/^sha256:[a-f0-9]{64}$/u.test(options.imageId) || !['linux', 'win32'].includes(process.platform)
    || process.env.DOCKER_HOST && process.env.DOCKER_HOST !== host || process.env.DOCKER_CONTEXT && process.env.DOCKER_CONTEXT !== (process.platform === 'win32' ? 'desktop-linux' : 'default')
    || ['DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'].some(name => process.env[name])) fail('VIDEO_CONTAINER_CONFIGURATION_INVALID');
  if (options.signal?.aborted) fail('VIDEO_PREPARATION_CANCELLED'); if (active >= VIDEO_LIMITS.maximumConcurrent) throw new VideoPreparationError('VIDEO_PREPARATION_BUSY', 'Both native media slots are busy.', true);
  active++; let containerId: string | undefined;
  const run = randomUUID();
  async function owned(): Promise<void> {
    if (!containerId) return; const container = await inspect('container', containerId); const config = container.Config; const runtime = container.HostConfig;
    if (!object(config) || !object(config.Labels) || config.Labels[ownerLabel] !== 'eps-media' || config.Labels[runLabel] !== run || container.Image !== options.imageId
      || !object(runtime) || runtime.NetworkMode !== 'none' || runtime.ReadonlyRootfs !== true || runtime.Memory !== 2 * 1024 ** 3 || runtime.MemorySwap !== runtime.Memory || runtime.NanoCpus !== 2_000_000_000
      || runtime.PidsLimit !== 64 || !object(runtime.LogConfig) || runtime.LogConfig.Type !== 'none' || !Array.isArray(runtime.CapDrop) || runtime.CapDrop.length !== 1 || runtime.CapDrop[0] !== 'ALL'
      || !Array.isArray(runtime.SecurityOpt) || !runtime.SecurityOpt.some(value => value === 'no-new-privileges' || value === 'no-new-privileges:true')
      || !object(runtime.Tmpfs) || Object.keys(runtime.Tmpfs).length !== 1 || typeof runtime.Tmpfs['/tmp'] !== 'string' || !['noexec', 'nosuid', 'nodev', 'size=402653184'].every(value => (runtime.Tmpfs as Record<string, string>)['/tmp'].split(',').includes(value))
      || !Array.isArray(container.Mounts) || container.Mounts.some(mount => !object(mount) || mount.Type !== 'tmpfs' || mount.Destination !== '/tmp')) fail('VIDEO_CONTAINER_OWNERSHIP_INVALID');
  }
  try {
    const image = await inspect('image', options.imageId); const config = image.Config;
    if (image.Id !== options.imageId || !object(config) || config.User !== '1000:1000' || !object(config.Labels) || config.Labels[ownerLabel] !== 'eps-media') fail('VIDEO_CONTAINER_IMAGE_INVALID');
    const created = await docker(['create', '-i', '--name', `eps-media-${run}`, '--label', `${ownerLabel}=eps-media`, '--label', `${runLabel}=${run}`,
      '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '2g', '--memory-swap', '2g', '--cpus', '2', '--pids-limit', '64', '--log-driver', 'none',
      '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=402653184,uid=1000,gid=1000,mode=700', options.imageId]);
    if (created.code !== 0 || !/^[a-f0-9]{64}$/u.test(created.stdout.trim())) fail('VIDEO_CONTAINER_UNAVAILABLE'); containerId = created.stdout.trim(); await owned();
    const result = await docker(['start', '--attach', '--interactive', containerId], payload, 190_000, 64 * 1024 * 1024, options.signal);
    return result.stdout;
  } finally {
    try { if (containerId) { await owned(); const removed = await docker(['container', 'rm', '--force', containerId]); if (removed.code !== 0) fail('VIDEO_CONTAINER_CLEANUP_FAILED'); } }
    finally { active--; }
  }
}
