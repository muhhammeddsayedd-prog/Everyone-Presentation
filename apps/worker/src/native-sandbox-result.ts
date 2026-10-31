import { createHash } from 'node:crypto';
import type { NativeTask } from './native-sandbox.ts';
import { runConfiguredNative } from './native-sandbox.ts';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function invalid(): never { throw Object.assign(new Error('NATIVE_OUTPUT_INVALID'), { code: 'NATIVE_OUTPUT_INVALID' }); }
export function decodeNativeResult(text: string): unknown {
  let value: unknown; try { value = JSON.parse(text); } catch { return invalid(); }
  if (!object(value)) invalid();
  if (Object.keys(value).sort().join(',') === 'code,ok' && value.ok === false && typeof value.code === 'string' && /^(?:FIT|PDF|NATIVE)_[A-Z_]{1,80}$/u.test(value.code)) throw Object.assign(new Error('Native task failed.'), { code: value.code });
  if (Object.keys(value).sort().join(',') !== 'ok,result' || value.ok !== true || !object(value.result)) invalid(); return value.result;
}
export async function sandboxPresentation(task: NativeTask, snapshot: unknown, images: ReadonlyMap<string, Uint8Array>, options: { signal?: AbortSignal; timeoutMs?: number }, bytes?: Uint8Array, access?: unknown): Promise<Record<string, unknown>> {
  const payload = JSON.stringify({ snapshot, images: [...images].map(([id, bytes]) => [id, Buffer.from(bytes).toString('base64')]), timeout_ms: options.timeoutMs ?? 90000,
    ...(bytes ? { bytes: Buffer.from(bytes).toString('base64') } : {}), ...(access ? { access } : {}) });
  // Validation includes a browser measurement and a separate bounded PDF
  // inspector. Their combined task budget is distinct from each browser limit.
  const result = decodeNativeResult(await runConfiguredNative(task, payload, { signal: options.signal }));
  if (!object(result)) invalid();
  if (task.endsWith('render')) {
    if (Object.keys(result).sort().join(',') !== 'bytes,proof' || typeof result.bytes !== 'string' || result.bytes.length > Math.ceil(64 * 1024 ** 2 * 4 / 3) + 4 || !object(result.proof)
      || Object.keys(result.proof).sort().join(',') !== 'candidate_field_count,chromium_version,font_hashes,fonts_ready,frame_draw_count,height_css_px,images_ready,link_targets_sha256,logo_draw_count,overflow_count,page_count,rendered_at,renderer_version,template_content_sha256,video_link_count,width_css_px') invalid();
    const output = Buffer.from(result.bytes, 'base64'); if (output.length < 100 || output.length > 64 * 1024 ** 2 || output.toString('base64') !== result.bytes || output.subarray(0, 5).toString() !== '%PDF-') invalid();
    return { bytes: new Uint8Array(output), proof: result.proof };
  }
  if (Object.keys(result).sort().join(',') !== 'embedded_font_count,height_points,image_draws_checked,page_count,pdf_sha256,text_regions_checked,validated_at,video_links_checked,width_points'
    || !bytes || result.pdf_sha256 !== createHash('sha256').update(bytes).digest('hex')) invalid();
  return result;
}
