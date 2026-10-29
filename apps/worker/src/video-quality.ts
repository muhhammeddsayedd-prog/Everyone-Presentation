import type { FrameSelection, RealFrame } from './video-types.ts';
/** These technical metrics do not identify a person or classify appearance. */
export function frameQuality(gray: Uint8Array): RealFrame['quality'] {
  if (gray.length !== 32 * 32) throw new Error('A fixed 32x32 luminance sample is required.');
  const luminance = gray.reduce((sum, value) => sum + value, 0) / gray.length;
  const contrast = Math.sqrt(gray.reduce((sum, value) => sum + (value - luminance) ** 2, 0) / gray.length);
  let sharpness = 0;
  for (let y = 1; y < 31; y++) for (let x = 1; x < 31; x++) { const at = y * 32 + x; sharpness += Math.abs(4 * gray[at] - gray[at - 1] - gray[at + 1] - gray[at - 32] - gray[at + 32]); }
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = bits << 1n | BigInt(gray[y * 4 * 32 + x * 4] > gray[y * 4 * 32 + x * 4 + 3] ? 1 : 0);
  return { luminance, contrast, sharpness: sharpness / 900, difference_hash: bits.toString(16).padStart(16, '0') };
}
export function hashDistance(first: string, second: string): number {
  let bits = BigInt(`0x${first}`) ^ BigInt(`0x${second}`); let distance = 0;
  while (bits) { distance += Number(bits & 1n); bits >>= 1n; } return distance;
}
export function selectRealFrames(sourceAssetId: string, pool: Omit<RealFrame, 'bytes'>[]): FrameSelection {
  const chosen: Omit<RealFrame, 'bytes'>[] = [];
  const eligible = pool.filter(frame => frame.source_asset_id === sourceAssetId && frame.quality.luminance >= 12 && frame.quality.luminance <= 243 && frame.quality.contrast >= 8)
    .sort((a, b) => b.quality.sharpness - a.quality.sharpness || a.timestamp_ms - b.timestamp_ms);
  for (const frame of eligible) {
    if (chosen.every(other => frame.sha256 !== other.sha256 && hashDistance(frame.quality.difference_hash, other.quality.difference_hash) > 6)) chosen.push(frame);
    if (chosen.length === 3) break;
  }
  chosen.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  return { schema_version: '1.0', source_asset_id: sourceAssetId,
    selected_frames: chosen.map(frame => ({ frame_asset_id: frame.frame_asset_id, reason: 'Real source frame selected for technical exposure, detail and distinctness.' })),
    insufficient_frames_reason: chosen.length < 3 ? `Only ${chosen.length} technically usable, distinct source frame${chosen.length === 1 ? '' : 's'} available from the bounded sample. Manual replacement remains available.` : null };
}
