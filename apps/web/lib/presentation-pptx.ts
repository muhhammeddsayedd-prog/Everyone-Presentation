import { DomainError, type Actor } from '@eps/domain';
import type { PresentationOperations } from '../../../packages/domain/src/presentation-types';
import { reviewFromPresentationVersion } from '../../../packages/domain/src/presentation';
import editorialRegistry from '../../../packages/templates/versions/1.2.0/registry.json';
import { composeCastingDeck, editorialDateLabel } from '../../../packages/templates/versions/1.2.0/compose-casting';
import { imageSize, renderDeckPptx, type PptxImage } from '../../../packages/templates/versions/1.2.0/pptx';
import { PPTX_STATIC_IMAGES } from '../../../packages/templates/versions/1.2.0/static-images';

export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
/** Editable PowerPoint for a Ready Everyone Film editorial version, composed from the
 * same frozen version data and template as its PDF. Every read goes through the
 * caller's own version and media permissions; nothing is stored or shared. */
export async function versionPptx(actor: Actor, versionId: string, service: PresentationOperations, origin: string) {
  const version = await service.getVersion(actor, versionId);
  if (version.status !== 'ready') throw new DomainError('PRESENTATION_NOT_READY', 'The saved version is still processing. Try again when it is Ready.', 409);
  const template = version.render_context.template;
  if (template.key !== editorialRegistry.key || template.version !== editorialRegistry.version || template.content_sha256 !== editorialRegistry.content_sha256)
    throw new DomainError('PPTX_TEMPLATE_UNSUPPORTED', 'Editable PowerPoint is available for versions saved with the Everyone Film editorial template 1.2.0.', 409);
  const deck = composeCastingDeck(reviewFromPresentationVersion(version, 'pptx-export'), { versionLabel: `Version ${version.version_no}`, dateLabel: editorialDateLabel(version.created_at) });
  const ids = [...new Set(deck.pages.flatMap(page => page.elements.flatMap(element => element.kind === 'image' && element.source.type === 'asset' ? [element.source.asset_id] : [])))];
  const images: Record<string, PptxImage> = {}; let total = 0;
  for (const id of ids) {
    const content = await service.getVersionMediaContent(actor, versionId, id);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(content.mimeType)) throw new DomainError('PPTX_ASSET_UNSUPPORTED', 'A saved image could not be placed in PowerPoint.', 422);
    total += content.bytes.byteLength; if (total > 128 * 1024 * 1024) throw new DomainError('PPTX_TOO_LARGE', 'This version is too large for an on-demand PowerPoint.', 413);
    images[id] = { data: `data:${content.mimeType};base64,${Buffer.from(content.bytes).toString('base64')}`, natural: imageSize(content.bytes) };
  }
  // Links open the retained original in the app, where the viewer's own access applies.
  const videoHrefs = Object.fromEntries(version.slides.flatMap(slide => slide.video_asset_id ? [[slide.video_asset_id, `${origin}/presentations/versions/${version.id}/media/${slide.video_asset_id}`]] : []));
  const bytes = await renderDeckPptx(deck, { images, staticImages: PPTX_STATIC_IMAGES, videoHrefs }, { subject: `${version.render_context.cover.project_name} — Version ${version.version_no}` });
  const base = `${version.render_context.cover.project_name}-${version.render_context.cover.output_type}-v${version.version_no}`.replace(/[^A-Za-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 120) || 'presentation';
  return { bytes, filename: `${base}.pptx`, slide_count: deck.pages.length };
}
/** Claude/MCP: the same build under the caller's authority, returned as a verified
 * summary plus the in-app content route. That link needs the same signed-in user;
 * no bearer URL or stored copy is created. */
export async function versionPptxDownload(actor: Actor, versionId: string, service: PresentationOperations, origin: string) {
  const built = await versionPptx(actor, versionId, service, origin);
  return { version_id: versionId, download_url: `${origin}/api/v1/versions/${encodeURIComponent(versionId)}/pptx/content`, access: 'signed_in_session' as const,
    filename: built.filename, size_bytes: built.bytes.byteLength, slide_count: built.slide_count, template_version: editorialRegistry.version };
}
