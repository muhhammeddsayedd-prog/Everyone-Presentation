import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { prepareVideoIsolated } from '../apps/worker/src/video-container.ts';
import { selectRealFrames } from '../apps/worker/src/video-quality.ts';
const image = process.env.EPS_MEDIA_IMAGE_ID;
if (!/^sha256:[a-f0-9]{64}$/u.test(image ?? '') || process.argv.length !== 2) throw new Error('Provide the built immutable EPS_MEDIA_IMAGE_ID only.');
const host = process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
async function fixture(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', host, 'run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '512m', '--memory-swap', '512m', '--cpus', '1', '--pids-limit', '64', '--log-driver', 'none', '--entrypoint', '/usr/bin/ffmpeg', image,
      '-nostdin', '-v', 'error', '-threads', '1', '-filter_threads', '1', ...args, '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1'], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let length = 0; const output = []; let problem = false; const timer = setTimeout(() => { problem = true; child.kill(); }, 30_000);
    child.on('error', () => { problem = true; }); child.stdout.on('data', chunk => { length += chunk.length; if (length > 4 * 1024 * 1024) { problem = true; child.kill(); } else output.push(chunk); }); child.stderr.on('data', () => {});
    child.on('close', code => { clearTimeout(timer); if (problem || code !== 0) reject(new Error('Synthetic fixture generation failed.')); else resolve(Buffer.concat(output)); });
  });
}
const receipts = []; const run = new Date().toISOString().replace(/[:.]/gu, '-');
async function check(name, test) { const started = Date.now(); try { const details = await test(); receipts.push({ name, result: 'passed', elapsed_ms: Date.now() - started, ...details }); } catch (error) { receipts.push({ name, result: 'failed', code: error.code ?? 'ASSERTION_FAILED', elapsed_ms: Date.now() - started }); } }
const options = { imageId: image };
const audible = await fixture(['-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=16000', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac']);
await check('actual-decode-timestamped-frames-audio', async () => { const value = await prepareVideoIsolated({ source_asset_id: 'synthetic-audible', bytes: audible, mime_type: 'video/mp4' }, options);
  assert(value.probe.has_audio); assert.equal(value.audio_chunks.length, 1); assert(value.audio_chunks[0].bytes.length > 0); assert(value.sampled_frames.length > 0);
  for (const frame of value.sampled_frames) { assert(frame.timestamp_ms >= 0 && frame.timestamp_ms < value.probe.duration_ms); assert.equal(frame.bytes[0], 0xff); assert.equal(frame.width / frame.height, 160 / 90); }
  return { ffmpeg_version: value.ffmpeg_version, audio_chunks: value.audio_chunks.length, frames: value.sampled_frames.length, timestamps_ms: value.sampled_frames.map(frame => frame.timestamp_ms) }; });
await check('probe-only-produces-no-derivatives', async () => { const value = await prepareVideoIsolated({ source_asset_id: 'synthetic-probe', bytes: audible, mime_type: 'video/mp4' }, { ...options, probeOnly: true }); assert(value.probe.has_audio); assert.equal(value.audio_chunks.length, 0); assert.equal(value.sampled_frames.length, 0); return {}; });
await check('manual-extraction-uses-only-requested-real-source-times', async () => { const value = await prepareVideoIsolated({ source_asset_id: 'synthetic-manual', bytes: audible, mime_type: 'video/mp4' }, { ...options, timestampsMs: [0, 1250] }); assert.equal(value.audio_chunks.length, 0); assert.equal(value.sampled_frames.length, 2); assert(value.sampled_frames[0].timestamp_ms >= 0 && value.sampled_frames[0].timestamp_ms <= 100); assert(value.sampled_frames[1].timestamp_ms >= 1250 && value.sampled_frames[1].timestamp_ms <= 1290); return { timestamps_ms: value.sampled_frames.map(frame => frame.timestamp_ms), actual_video_lead_ms: value.sampled_frames[0].timestamp_ms }; });
await check('manual-timestamp-out-of-duration-is-rejected', async () => { await assert.rejects(prepareVideoIsolated({ source_asset_id: 'synthetic-manual-invalid', bytes: audible, mime_type: 'video/mp4' }, { ...options, timestampsMs: [9999] }), { code: 'VIDEO_TIMESTAMP_INVALID' }); return {}; });
const silent = await fixture(['-f', 'lavfi', '-i', 'color=black:size=160x90:rate=25', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '0.3', '-c:v', 'libx264', '-c:a', 'aac']);
await check('silent-short-video-keeps-real-frame-with-zero-selection', async () => { const value = await prepareVideoIsolated({ source_asset_id: 'synthetic-silent', bytes: silent, mime_type: 'video/mp4' }, options); assert(value.probe.duration_ms < 1000); assert.equal(value.audio_chunks.length, 0); assert(value.sampled_frames.length > 0); assert(value.warnings.includes('SILENT_AUDIO_CHUNK')); assert.equal(selectRealFrames(value.source_asset_id, value.sampled_frames).selected_frames.length, 0); return { frames: value.sampled_frames.length, warnings: value.warnings }; });
const noAudio = await fixture(['-f', 'lavfi', '-i', 'testsrc2=size=90x160:rate=25', '-t', '1', '-c:v', 'libx264', '-an']);
await check('portrait-no-audio-preserves-aspect-partial', async () => { const value = await prepareVideoIsolated({ source_asset_id: 'synthetic-no-audio', bytes: noAudio, mime_type: 'video/mp4' }, options); assert.equal(value.probe.has_audio, false); assert(value.warnings.includes('NO_AUDIO_STREAM')); assert(value.sampled_frames.length > 0); assert.equal(value.sampled_frames[0].width / value.sampled_frames[0].height, 90 / 160); return { width: value.sampled_frames[0].width, height: value.sampled_frames[0].height }; });
await check('corrupt-source-terminal-and-owned-cleanup', async () => { await assert.rejects(prepareVideoIsolated({ source_asset_id: 'synthetic-corrupt', bytes: audible.subarray(0, 16), mime_type: 'video/mp4' }, options), { code: 'VIDEO_DECODE_FAILED' }); return {}; });
const summary = { schema_version: '1.0', observed_at: new Date().toISOString(), image_id: image, environment: 'local Docker Linux, network-disabled media decoding', source: 'synthetic FFmpeg lavfi only; no real transcription or factual accuracy claim', provider_called: false, hosted: false, passed: receipts.every(receipt => receipt.result === 'passed'), tests: receipts };
const directory = path.resolve('tracking/evidence/m03/media-container'); await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, `${run}.json`), JSON.stringify(summary, null, 2) + '\n'); process.stdout.write(JSON.stringify(summary) + '\n'); if (!summary.passed) process.exitCode = 1;
