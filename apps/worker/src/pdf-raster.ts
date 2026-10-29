import { createHash } from 'node:crypto';
import { runOwnedNativeMedia } from './video-container.ts';
import { DocumentPreparationError, DOCUMENT_LIMITS } from './types.ts';
export interface RasterPdfPage { page: number; sha256: string; width: number; height: number; bytes: Uint8Array }
export interface RasterPdfResult { source_asset_id: string; source_sha256: string; rasterizer_version: string; pages: RasterPdfPage[]; page_images?: { page: number; image_coverage: number }[] }
function fail(code = 'DOCUMENT_RASTER_FAILED'): never { throw new DocumentPreparationError(code, 'Scanned PDF page preparation could not complete. The original was retained.'); }
export async function rasterPdfPages(bytes: Uint8Array, sourceAssetId: string, pages: number[], options: { imageId: string; signal?: AbortSignal; inspectOnly?: boolean }): Promise<RasterPdfResult> {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > DOCUMENT_LIMITS.maximumBytes || !/^[A-Za-z0-9._:-]{1,200}$/u.test(sourceAssetId) || !Array.isArray(pages) || !pages.length && !options.inspectOnly || pages.length > 20 || new Set(pages).size !== pages.length || pages.some(page => !Number.isSafeInteger(page) || page < 1 || page > 200)) fail('DOCUMENT_LIMIT_EXCEEDED');
  const snapshot = Buffer.from(bytes); const hash = createHash('sha256').update(snapshot).digest('hex'); let envelope;
  try { envelope = JSON.parse(await runOwnedNativeMedia(JSON.stringify({ source_asset_id: sourceAssetId, bytes: snapshot.toString('base64'), pages, inspect_only: options.inspectOnly ?? false }), options)); }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'VIDEO_PREPARATION_CANCELLED') throw new DocumentPreparationError('DOCUMENT_PREPARATION_CANCELLED', 'Scanned PDF preparation was cancelled.');
      if (['VIDEO_PREPARATION_BUSY', 'VIDEO_CONTAINER_UNAVAILABLE', 'VIDEO_PROCESS_TIMEOUT', 'VIDEO_CONTAINER_INSPECTION_FAILED'].includes(String(error.code))) throw new DocumentPreparationError('DOCUMENT_RASTER_FAILED', 'The native PDF raster worker is temporarily unavailable.', true);
    }
    return fail();
  }
  if (envelope?.ok === false && ['SOURCE_UNREADABLE', 'DOCUMENT_LIMIT_EXCEEDED', 'DOCUMENT_RASTER_FAILED'].includes(envelope.code)) fail(envelope.code);
  const result = envelope?.result; if (envelope?.ok !== true || result?.source_asset_id !== sourceAssetId || result?.source_sha256 !== hash || !Array.isArray(result.pages) || result.pages.length !== pages.length || typeof result.rasterizer_version !== 'string' || !/^pdftoppm version [\d.]+$/u.test(result.rasterizer_version)) fail();
  const output: RasterPdfPage[] = [];
  for (const [index, page] of result.pages.entries()) {
    if (!page || Object.keys(page).sort().join(',') !== 'bytes,height,page,sha256,width' || page.page !== pages[index] || typeof page.bytes !== 'string' || page.bytes.length > 6 * 1024 * 1024 || !Number.isSafeInteger(page.width) || page.width < 1 || page.width > 2048 || !Number.isSafeInteger(page.height) || page.height < 1 || page.height > 2048) fail();
    const image = Buffer.from(page.bytes, 'base64'); if (!image.length || image.length > 4 * 1024 * 1024 || image.toString('base64') !== page.bytes || createHash('sha256').update(image).digest('hex') !== page.sha256 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) fail(); output.push({ page: page.page, width: page.width, height: page.height, sha256: page.sha256, bytes: image });
  }
  if (!Array.isArray(result.page_images) || result.page_images.length > 200 || result.page_images.some((page: unknown, index: number) => !page || typeof page !== 'object' || !('page' in page) || !('image_coverage' in page) || page.page !== index + 1 || typeof page.image_coverage !== 'number' || !Number.isFinite(page.image_coverage) || page.image_coverage < 0 || page.image_coverage > 1)) fail();
  return { source_asset_id: sourceAssetId, source_sha256: hash, rasterizer_version: result.rasterizer_version, pages: output, page_images: result.page_images };
}
