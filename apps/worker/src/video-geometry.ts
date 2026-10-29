import { VideoPreparationError, type VideoDisplayGeometry, type VideoProbe } from './video-types.ts';

type Ratio = { numerator: number; denominator: number };
function ratio(value: unknown): Ratio | null {
  if (value === undefined || value === null || value === 'N/A' || value === '0:1' || value === '0:0') return null;
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,6}:[1-9][0-9]{0,6}$/u.test(value)) throw new VideoPreparationError('VIDEO_UNREADABLE');
  const [numerator, denominator] = value.split(':').map(Number); return { numerator, denominator };
}
/** Square-pixel JPEG dimensions preserve displayed geometry, including the
 * decoder's autorotation. Scaling coded width/height then setsar=1 distorts
 * anamorphic sources. Round only the final bounded pixel dimensions. */
export function videoDisplayGeometry(envelope: unknown, probe: VideoProbe): VideoDisplayGeometry {
  if (!envelope || typeof envelope !== 'object' || !('streams' in envelope) || !Array.isArray(envelope.streams)) throw new VideoPreparationError('VIDEO_UNREADABLE');
  const stream = envelope.streams.find((entry: unknown) => entry && typeof entry === 'object' && 'codec_type' in entry && entry.codec_type === 'video');
  if (!stream || typeof stream !== 'object') throw new VideoPreparationError('VIDEO_UNREADABLE');
  const suppliedSAR = ratio(stream.sample_aspect_ratio); const suppliedDAR = ratio(stream.display_aspect_ratio);
  const sar = suppliedSAR ?? (suppliedDAR ? { numerator: suppliedDAR.numerator * probe.height, denominator: suppliedDAR.denominator * probe.width } : { numerator: 1, denominator: 1 });
  const sampleRatio = sar.numerator / sar.denominator; const displayRatio = probe.width * sampleRatio / probe.height;
  if (!Number.isFinite(sampleRatio) || sampleRatio < 0.01 || sampleRatio > 100 || !Number.isFinite(displayRatio) || displayRatio < 0.01 || displayRatio > 100
    || suppliedSAR && suppliedDAR && Math.abs(displayRatio / (suppliedDAR.numerator / suppliedDAR.denominator) - 1) > 1 / 1024) throw new VideoPreparationError('VIDEO_UNREADABLE');
  const rotated = probe.rotation_degrees === 90 || probe.rotation_degrees === 270;
  const displayWidth = rotated ? probe.height : probe.width * sampleRatio;
  const displayHeight = rotated ? probe.width * sampleRatio : probe.height;
  const scale = Math.min(1, 1280 / displayWidth, 1280 / displayHeight);
  return { sample_aspect_ratio: sar, display_aspect_ratio: { numerator: rotated ? probe.height * sar.denominator : probe.width * sar.numerator, denominator: rotated ? probe.width * sar.numerator : probe.height * sar.denominator },
    width: Math.max(1, Math.round(displayWidth * scale)), height: Math.max(1, Math.round(displayHeight * scale)) };
}
