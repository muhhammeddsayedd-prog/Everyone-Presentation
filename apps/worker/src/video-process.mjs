import { Buffer } from 'node:buffer';
import process from 'node:process';
import { prepareVideoNative } from './video-native.ts';
import { VIDEO_LIMITS, VideoPreparationError } from './video-types.ts';
let length = 0; const chunks = [];
try {
  for await (const chunk of process.stdin) { length += chunk.length; if (length > Math.ceil(VIDEO_LIMITS.maximumBytes * 4 / 3) + 4096) throw new VideoPreparationError('VIDEO_LIMIT_EXCEEDED'); chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!input || Object.keys(input).sort().join(',') !== 'bytes,mime_type,probe_only,source_asset_id,timestamps_ms' || typeof input.bytes !== 'string' || typeof input.probe_only !== 'boolean'
    || !(input.timestamps_ms === null || Array.isArray(input.timestamps_ms) && input.timestamps_ms.length <= VIDEO_LIMITS.maximumSamples && input.timestamps_ms.every(timestamp => Number.isSafeInteger(timestamp) && timestamp >= 0))) throw new VideoPreparationError('VIDEO_SOURCE_INVALID');
  const bytes = Buffer.from(input.bytes, 'base64'); if (bytes.toString('base64') !== input.bytes) throw new VideoPreparationError('VIDEO_SOURCE_INVALID');
  const result = await prepareVideoNative({ ...input, bytes }, undefined, { probeOnly: input.probe_only, timestampsMs: input.timestamps_ms ?? undefined });
  process.stdout.write(JSON.stringify({ ok: true, result: { ...result, audio_chunks: result.audio_chunks.map(chunk => ({ ...chunk, bytes: Buffer.from(chunk.bytes).toString('base64') })), sampled_frames: result.sampled_frames.map(frame => ({ ...frame, bytes: Buffer.from(frame.bytes).toString('base64') })) } }));
} catch (error) { process.stdout.write(JSON.stringify({ ok: false, code: error instanceof VideoPreparationError ? error.code : 'VIDEO_PROCESS_FAILED' })); process.exitCode = 1; }
