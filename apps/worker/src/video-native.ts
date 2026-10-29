import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { frameQuality } from './video-quality.ts';
import { VIDEO_LIMITS, VideoPreparationError, type PreparedVideo, type RealFrame, type VideoInput, type VideoProbe } from './video-types.ts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function bad(code: string): never { throw new VideoPreparationError(code); }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export function validateVideoInput(input: VideoInput): void {
  if (!input || typeof input !== 'object' || typeof input.source_asset_id !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/u.test(input.source_asset_id)
    || !(input.bytes instanceof Uint8Array) || !input.bytes.length) bad('VIDEO_SOURCE_INVALID');
  if (input.bytes.length > VIDEO_LIMITS.maximumBytes) bad('VIDEO_LIMIT_EXCEEDED');
  if (!['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'].includes(input.mime_type)) bad('VIDEO_TYPE_UNSUPPORTED');
  const bytes = Buffer.from(input.bytes);
  const mp4 = bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp';
  const webm = bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (['video/mp4', 'video/quicktime'].includes(input.mime_type) ? !mp4 : !webm) bad('VIDEO_TYPE_UNSUPPORTED');
}
/** Pure ffprobe envelope validation is also exercised without decoding a file. */
export function parseVideoProbe(value: unknown): VideoProbe {
  if (!object(value) || !Array.isArray(value.streams) || value.streams.length > 32 || !object(value.format)) bad('VIDEO_UNREADABLE');
  const videos = value.streams.filter(stream => object(stream) && stream.codec_type === 'video');
  const video = videos[0]; const audio = value.streams.find(stream => object(stream) && stream.codec_type === 'audio');
  if (videos.length !== 1 || !object(video) || !['mov,mp4,m4a,3gp,3g2,mj2', 'matroska,webm'].includes(String(value.format.format_name))) bad('VIDEO_UNREADABLE');
  const duration = Number(value.format.duration); const width = Number(video.width); const height = Number(video.height);
  const rate = String(video.avg_frame_rate).split('/').map(Number); const frameRate = rate.length === 2 && rate[1] > 0 ? rate[0] / rate[1] : 0;
  if (!Number.isFinite(duration) || duration <= 0 || duration * 1000 > VIDEO_LIMITS.maximumDurationMs || !Number.isSafeInteger(width) || width < 1 || width > VIDEO_LIMITS.maximumDimension
    || !Number.isSafeInteger(height) || height < 1 || height > VIDEO_LIMITS.maximumDimension || !Number.isFinite(frameRate) || frameRate <= 0 || frameRate > VIDEO_LIMITS.maximumFrameRate) bad('VIDEO_LIMIT_EXCEEDED');
  const side = Array.isArray(video.side_data_list) ? video.side_data_list.find(item => object(item) && typeof item.rotation === 'number') : undefined;
  const rotation = object(side) ? Number(side.rotation) : object(video.tags) ? Number(video.tags.rotate ?? 0) : 0;
  if (!Number.isFinite(rotation) || rotation % 90 !== 0 || typeof video.codec_name !== 'string' || !/^[a-z0-9_]{1,40}$/u.test(video.codec_name)) bad('VIDEO_UNREADABLE');
  const start = Number(value.format.start_time ?? 0); if (!Number.isFinite(start) || Math.abs(start) > 86400) bad('VIDEO_UNREADABLE');
  return { duration_ms: Math.ceil(duration * 1000), width, height, rotation_degrees: ((rotation % 360) + 360) % 360, frame_rate: frameRate,
    video_codec: video.codec_name, audio_codec: object(audio) && typeof audio.codec_name === 'string' ? audio.codec_name : null,
    has_audio: Boolean(audio), container: String(value.format.format_name), source_start_ms: Math.round(start * 1000) };
}
function native(command: 'ffmpeg' | 'ffprobe', args: string[], signal: AbortSignal, limit = 1024 * 1024): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(`/usr/bin/${command}`, args, { shell: false, windowsHide: true, env: { NODE_ENV: 'production', LANG: 'C', LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const output: Buffer[] = []; const diagnostics: Buffer[] = []; let count = 0; let diagnosticCount = 0; let problem: string | undefined;
    const stop = (code: string) => { problem ??= code; child.kill('SIGKILL'); };
    const cancel = () => stop('VIDEO_PREPARATION_CANCELLED'); signal.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => stop('VIDEO_PROCESS_TIMEOUT'), 90_000);
    child.on('error', () => { problem ??= 'VIDEO_TOOL_UNAVAILABLE'; });
    child.stdout.on('data', (chunk: Buffer) => { count += chunk.length; if (count > limit) stop('VIDEO_OUTPUT_LIMIT'); else output.push(chunk); });
    child.stderr.on('data', (chunk: Buffer) => { diagnosticCount += chunk.length; if (diagnosticCount > 512 * 1024) stop('VIDEO_OUTPUT_LIMIT'); else diagnostics.push(chunk); });
    child.on('close', code => { clearTimeout(timer); signal.removeEventListener('abort', cancel);
      if (problem || code !== 0) reject(new VideoPreparationError(problem ?? 'VIDEO_DECODE_FAILED')); else resolve({ stdout: Buffer.concat(output), stderr: Buffer.concat(diagnostics).toString('utf8') }); });
    if (signal.aborted) cancel();
  });
}
const inputArgs = ['-nostdin', '-hide_banner', '-threads', '1', '-filter_threads', '1', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm'];
async function fileBytes(file: string, limit: number): Promise<Uint8Array> { const info = await stat(file); if (!info.isFile() || info.size > limit || !info.size) bad('VIDEO_OUTPUT_LIMIT'); return readFile(file); }
function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  const data = Buffer.from(bytes); if (data[0] !== 0xff || data[1] !== 0xd8) bad('VIDEO_FRAME_INVALID');
  let at = 2;
  while (at + 9 < data.length) { if (data[at] !== 0xff) bad('VIDEO_FRAME_INVALID'); const marker = data[at + 1]; const length = data.readUInt16BE(at + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { height: data.readUInt16BE(at + 5), width: data.readUInt16BE(at + 7) };
    if (length < 2) bad('VIDEO_FRAME_INVALID'); at += 2 + length; }
  return bad('VIDEO_FRAME_INVALID');
}
/** Execute only inside the resource-bounded, network-disabled media container.
 * No client path, URL, command, filter or temporary root is accepted. */
export async function prepareVideoNative(input: VideoInput, signal?: AbortSignal, options: { probeOnly?: boolean; timestampsMs?: number[] } = {}): Promise<PreparedVideo> {
  validateVideoInput(input);
  if (process.platform !== 'linux') bad('VIDEO_CONTAINER_REQUIRED');
  const deadline = AbortSignal.timeout(VIDEO_LIMITS.maximumProcessMs); const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const root = await realpath(tmpdir()); const directory = await mkdtemp(path.join(root, 'eps-video-'));
  const original = path.join(directory, 'original.bin');
  try {
    await writeFile(original, input.bytes, { flag: 'wx', mode: 0o600 });
    const rawProbe = await native('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm', '-show_format', '-show_streams', '-of', 'json', original], combined);
    let envelope: unknown; try { envelope = JSON.parse(rawProbe.stdout.toString('utf8')); } catch { bad('VIDEO_UNREADABLE'); }
    const probe = parseVideoProbe(envelope); const warnings: string[] = []; const frames: RealFrame[] = []; const audio: PreparedVideo['audio_chunks'] = [];
    if (options.timestampsMs && (options.probeOnly || !Array.isArray(options.timestampsMs) || !options.timestampsMs.length || options.timestampsMs.length > VIDEO_LIMITS.maximumSamples
      || new Set(options.timestampsMs).size !== options.timestampsMs.length || options.timestampsMs.some(timestamp => !Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp >= probe.duration_ms))) bad('VIDEO_TIMESTAMP_INVALID');
    if (options.probeOnly) return { source_asset_id: input.source_asset_id, source_sha256: hash(input.bytes), probe, audio_chunks: [], sampled_frames: [], warnings: [], implementation_version: 'video-preparation.v1', ffmpeg_version: (await native('ffmpeg', ['-version'], combined)).stdout.toString('utf8').split('\n')[0] };
    const requestedSamples = options.timestampsMs?.length ?? Math.min(VIDEO_LIMITS.maximumSamples, Math.max(1, Math.ceil(probe.duration_ms / 1000)));
    const spacing = probe.duration_ms / 1000 / (requestedSamples + 1);
    const selection = options.timestampsMs ? [...options.timestampsMs].sort((a, b) => a - b).map(timestamp => `gte(t\\,${timestamp / 1000})*(isnan(prev_selected_t)+lt(prev_selected_t\\,${timestamp / 1000}))`).join('+')
      : `gte(t\\,${spacing})*(isnan(prev_selected_t)+gte(t-prev_selected_t\\,${spacing}))`;
    try {
      const decoded = await native('ffmpeg', [...inputArgs, '-i', original, '-an', '-vf', `select=${selection},showinfo,scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease,setsar=1`, '-fps_mode', 'vfr', '-frames:v', String(requestedSamples), '-q:v', '3', '-fs', String(24 * 1024 * 1024), path.join(directory, 'frame-%02d.jpg')], combined);
      const stamps = [...decoded.stderr.matchAll(/\bn:\s*\d+\s+pts:\s*[-\d]+\s+pts_time:([\d.e+-]+)/gu)].map(match => Math.round(Number(match[1]) * 1000));
      for (let index = 0; index < Math.min(stamps.length, requestedSamples); index++) {
        const file = path.join(directory, `frame-${String(index + 1).padStart(2, '0')}.jpg`); const bytes = await fileBytes(file, VIDEO_LIMITS.maximumFrameBytes);
        const timestamp_ms = stamps[index]; if (!Number.isSafeInteger(timestamp_ms) || timestamp_ms < 0 || timestamp_ms >= probe.duration_ms) bad('VIDEO_FRAME_INVALID');
        const gray = await native('ffmpeg', ['-nostdin', '-v', 'error', '-threads', '1', '-filter_threads', '1', '-i', file, '-vf', 'scale=32:32', '-pix_fmt', 'gray', '-frames:v', '1', '-f', 'rawvideo', 'pipe:1'], combined, 1024);
        const quality = frameQuality(gray.stdout); const quality_flags: string[] = [];
        if (quality.luminance < 12 || quality.luminance > 243) quality_flags.push('EXPOSURE_LIMIT'); if (quality.contrast < 8) quality_flags.push('LOW_DETAIL');
        const checksum = hash(bytes);
        if (frames.some(frame => frame.sha256 === checksum)) { warnings.push('DUPLICATE_FRAME_SAMPLES'); continue; }
        frames.push({ frame_asset_id: `frame-${checksum}`, source_asset_id: input.source_asset_id, timestamp_ms, ...jpegSize(bytes), sha256: checksum, bytes, quality_flags, quality });
      }
    } catch (error) { if (combined.aborted) throw error; warnings.push('FRAME_PREPARATION_FAILED'); }
    if (!frames.length) warnings.push('NO_USABLE_FRAMES');
    if (options.timestampsMs) { if (frames.length < requestedSamples) warnings.push('FRAME_TIMESTAMP_UNAVAILABLE'); }
    else if (probe.has_audio) {
      try {
        for (let start = 0, index = 0; start < probe.duration_ms; start += VIDEO_LIMITS.audioChunkMs - VIDEO_LIMITS.audioOverlapMs, index++) {
          if (index >= VIDEO_LIMITS.maximumChunks) bad('VIDEO_LIMIT_EXCEEDED');
          const end = Math.min(probe.duration_ms, start + VIDEO_LIMITS.audioChunkMs); const file = path.join(directory, `audio-${index}.mp3`);
          await native('ffmpeg', [...inputArgs, '-v', 'error', '-ss', String(start / 1000), '-i', original, '-t', String((end - start) / 1000), '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '32k', '-fs', String(VIDEO_LIMITS.maximumAudioChunkBytes), file], combined);
          const bytes = await fileBytes(file, VIDEO_LIMITS.maximumAudioChunkBytes);
          // Skip an entirely silent stream without billing a transcription call.
          const level = await native('ffmpeg', ['-nostdin', '-hide_banner', '-threads', '1', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], combined);
          const match = /max_volume:\s*(-?[\d.]+|inf|-inf) dB/u.exec(level.stderr);
          if (!match || !Number.isFinite(Number(match[1])) || Number(match[1]) < -60) { warnings.push('SILENT_AUDIO_CHUNK'); } else audio.push({ index: audio.length, start_ms: start, end_ms: end, mime_type: 'audio/mpeg', sha256: hash(bytes), bytes });
          if (end === probe.duration_ms) break;
        }
      } catch (error) { if (combined.aborted) throw error; warnings.push('AUDIO_PREPARATION_FAILED'); }
    } else warnings.push('NO_AUDIO_STREAM');
    const version = (await native('ffmpeg', ['-version'], combined)).stdout.toString('utf8').split('\n')[0];
    return { source_asset_id: input.source_asset_id, source_sha256: hash(input.bytes), probe, audio_chunks: audio, sampled_frames: frames, warnings: [...new Set(warnings)], implementation_version: 'video-preparation.v1', ffmpeg_version: version };
  } finally {
    // This exact directory was created above; no uploaded value names a target.
    const owned = await realpath(directory);
    if (path.dirname(owned) !== root || !path.basename(owned).startsWith('eps-video-')) bad('VIDEO_TEMP_OWNERSHIP_INVALID');
    await rm(owned, { recursive: true, force: true });
  }
}
