import { createHash } from 'node:crypto';
import { readPdfPage, type PdfOCRMetadata } from '../../../packages/integrations/src/openai-pdf-ocr.ts';
import type { OpenAIMediaConfig } from '../../../packages/integrations/src/openai-media.ts';
import { inspectPdfTextIsolated } from './pdf-inspect.ts';
import { prepareDocumentIsolated } from './process.ts';
import { rasterPdfPages } from './pdf-raster.ts';
import { DOCUMENT_LIMITS, DocumentPreparationError, mapParagraphs, normalizeSourceText, type PreparedDocument } from './types.ts';
export interface PdfVisionOptions { imageId: string; openAI: OpenAIMediaConfig; signal?: AbortSignal; onMetadata?: (metadata: PdfOCRMetadata & { rasterizer_version: string }) => void;
  inspect?: typeof inspectPdfTextIsolated; raster?: typeof rasterPdfPages; read?: typeof readPdfPage; imageCoverage?: typeof rasterPdfPages; }
export function pdfPageNeedsVision(text: string, imageCoverage: number): boolean { return !text.trim() || imageCoverage >= 0.65 || imageCoverage >= 0.35 && text.trim().length <= 300; }
/** Ordinary text PDFs preserve the existing preparation path. Only missing pages
 * enter native raster + original-language vision reading. No image is persisted
 * or placed in SQL, outbox, callbacks or logs. */
export async function preparePdfWithVision(bytes: Uint8Array, sourceAssetId: string, options: PdfVisionOptions): Promise<PreparedDocument> {
  let existing: PreparedDocument | undefined;
  try { existing = await prepareDocumentIsolated({ bytes, sourceAssetId, mimeType: 'application/pdf' }, { signal: options.signal }); }
  catch (error) { if (!(error instanceof DocumentPreparationError) || error.code !== 'DOCUMENT_VISION_REQUIRED') throw error; }
  const coverage = await (options.imageCoverage ?? rasterPdfPages)(bytes, sourceAssetId, [], { imageId: options.imageId, signal: options.signal, inspectOnly: true });
  const byPage = new Map(coverage.page_images?.map(page => [page.page, page.image_coverage]) ?? []);
  const existingByPage = new Map<number, string>(); for (const paragraph of existing?.paragraphs ?? []) if (paragraph.page !== null) existingByPage.set(paragraph.page, `${existingByPage.get(paragraph.page) ?? ''}\n${paragraph.text}`.trim());
  const hasDominantImage = [...existingByPage].some(([page, text]) => pdfPageNeedsVision(text, byPage.get(page) ?? 0));
  if (existing && !existing.warnings.some(warning => warning.startsWith('Pages without extractable text:')) && !hasDominantImage) {
    for (const page of coverage.page_images ?? []) if (page.image_coverage >= 0.15) existing.warnings.push(`Page ${page.page} includes image content that text extraction cannot confirm. Review the original for additional requirements.`);
    return existing;
  }
  const inspected = await (options.inspect ?? inspectPdfTextIsolated)(bytes, sourceAssetId, options.signal);
  const missing = inspected.pages.filter(page => pdfPageNeedsVision(page.text, byPage.get(page.page) ?? 0)).map(page => page.page);
  if (!missing.length || missing.length > 20) throw new DocumentPreparationError('DOCUMENT_LIMIT_EXCEEDED', 'Split this PDF into sources with at most twenty scanned pages per processing job.');
  const rendered = await (options.raster ?? rasterPdfPages)(bytes, sourceAssetId, missing, { imageId: options.imageId, signal: options.signal });
  if (rendered.source_sha256 !== inspected.source_sha256 || rendered.source_asset_id !== sourceAssetId || rendered.pages.length !== missing.length) throw new DocumentPreparationError('DOCUMENT_RASTER_FAILED', 'Scanned pages did not match the source PDF.');
  const pages = inspected.pages.map(page => ({ ...page })); const warnings = [`Vision-read PDF pages: ${missing.join(', ')}. Check the source for recognition errors.`];
  for (const [index, page] of rendered.pages.entries()) {
    if (page.page !== missing[index]) throw new DocumentPreparationError('DOCUMENT_RASTER_FAILED', 'A scanned page was outside the requested source mapping.');
    const result = await (options.read ?? readPdfPage)({ source_asset_id: sourceAssetId, source_sha256: inspected.source_sha256, page: page.page, image_sha256: page.sha256, bytes: page.bytes }, options.openAI, options.signal);
    const target = pages.find(item => item.page === page.page)!; const originalText = target.text; target.text = normalizeSourceText(result.text).trim();
    if (originalText && !target.text.includes(originalText)) target.text = `${originalText}\n\n${target.text}`.trim();
    for (const uncertainty of result.uncertainties) if (warnings.length < 200) warnings.push(`Page ${page.page}: ${uncertainty}`);
    try { options.onMetadata?.({ ...result.metadata, rasterizer_version: rendered.rasterizer_version }); } catch { /* Operator sinks cannot repeat a paid provider request. */ }
  }
  let text = ''; const paragraphs: PreparedDocument['paragraphs'] = [];
  for (const page of pages) { if (text && page.text) text += '\n\n'; paragraphs.push(...mapParagraphs(page.text, page.page, text.length, paragraphs.length)); text += page.text; if (text.length > DOCUMENT_LIMITS.maximumTextCharacters) throw new DocumentPreparationError('DOCUMENT_LIMIT_EXCEEDED', 'The prepared PDF exceeds the supported text limit.'); }
  if (!text.trim() || !paragraphs.length) throw new DocumentPreparationError('SOURCE_UNREADABLE', 'This PDF has no readable requirements. Enter them manually or replace the source.');
  return { sourceAssetId, sourceSha256: createHash('sha256').update(bytes).digest('hex'), text, paragraphs, extractionMethod: 'pdf_vision', warnings };
}
