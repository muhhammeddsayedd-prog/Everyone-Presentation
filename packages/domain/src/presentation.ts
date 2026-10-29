import { DomainError } from './types.ts';
import { slideWordingFields } from './casting-types.ts';
import type { GenerateVersion, RenderSnapshot, VersionListOptions, FrozenSlide, VersionSlide, FrozenAsset, PresentationManifest, PresentationRenderContext, PresentationVersion, PresentationChangeSummary } from './presentation-types.ts';
import type { WorkspaceReview } from './review-types.ts';

export const PRESENTATION_MAXIMUM_BYTES = 8 * 1024 * 1024;
export const PRESENTATION_MAXIMUM_SLIDES = 1000;
function invalid(): never { throw new DomainError('VALIDATION_FAILED', 'Presentation data does not match its fixed contract.', 400); }
function object(value: unknown, keys: readonly string[], required: readonly string[] = keys): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some(key => !keys.includes(key)) || required.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum = 10000): string {
  if (typeof value !== 'string' || value.length > maximum) invalid();
  for (const char of value as string) { const cp = char.codePointAt(0)!; if (cp >= 0xd800 && cp <= 0xdfff || cp < 32 && ![9, 10, 13].includes(cp) || cp === 127) invalid(); }
  return value as string;
}
function identifier(value: unknown): string { const result = text(value, 200); if (!result || /[\\/\p{C}?#%]/u.test(result)) invalid(); return result; }
function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum || Object.is(value, -0)) invalid(); return value as number;
}
function digest(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) invalid(); return value as string; }
export function parseGenerateVersion(value: unknown): GenerateVersion {
  const row = object(value, ['expected_workspace_row_version', 'expected_draft_revision', 'expected_input_fingerprint', 'generation_note'],
    ['expected_workspace_row_version', 'expected_draft_revision', 'expected_input_fingerprint']);
  return { expected_workspace_row_version: integer(row.expected_workspace_row_version, 1), expected_draft_revision: integer(row.expected_draft_revision),
    expected_input_fingerprint: digest(row.expected_input_fingerprint),
    ...(Object.hasOwn(row, 'generation_note') ? { generation_note: row.generation_note === null ? null : text(row.generation_note, 8000) } : {}) };
}
export function parseVersionListOptions(value: unknown = {}): VersionListOptions {
  const row = object(value, ['cursor', 'limit'], []);
  return { limit: Object.hasOwn(row, 'limit') ? integer(row.limit, 1, 100) : 25,
    ...(Object.hasOwn(row, 'cursor') ? { cursor: text(row.cursor, 4000) || invalid() } : {}) };
}
/** These restricted JSON types match eps.cast_canonical: sorted ASCII keys,
 * safe integer numbers and exact UTF-8 string values. No date normalization. */
export function presentationCanonicalJson(value: unknown): string {
  const ancestors = new Set<object>(); const encoder = new TextEncoder(); let bytes = 0;
  function chunk(value: string): string { bytes += encoder.encode(value).byteLength; if (bytes > PRESENTATION_MAXIMUM_BYTES) invalid(); return value; }
  function serialize(item: unknown, depth: number): string {
    if (depth > 50) invalid();
    if (item === null) return chunk('null');
    if (typeof item === 'string') { text(item, PRESENTATION_MAXIMUM_BYTES); return chunk(JSON.stringify(item)); }
    if (typeof item === 'boolean') return chunk(item ? 'true' : 'false');
    if (typeof item === 'number') { integer(item, -Number.MAX_SAFE_INTEGER); return chunk(JSON.stringify(item)); }
    if (!item || typeof item !== 'object' || ancestors.has(item)) invalid();
    ancestors.add(item);
    try {
      if (Array.isArray(item)) { if (Object.keys(item).length !== item.length) invalid(); return chunk('[') + Array.from(item, (value, n) => (n ? chunk(',') : '') + serialize(value, depth + 1)).join('') + chunk(']'); }
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) invalid();
      const keys = Object.keys(item).sort(); if (keys.some(key => !/^[\x20-\x7e]+$/u.test(key))) invalid();
      return chunk('{') + keys.map((key, n) => (n ? chunk(',') : '') + chunk(JSON.stringify(key) + ':') + serialize((item as Record<string, unknown>)[key], depth + 1)).join('') + chunk('}');
    } finally { ancestors.delete(item); }
  }
  return serialize(value, 0);
}
export async function presentationCanonicalHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(presentationCanonicalJson(value));
  const hashed = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashed), byte => byte.toString(16).padStart(2, '0')).join('');
}
const slideKeys = ['id', 'version_id', 'order', 'kind', 'assignment_id', 'candidate_id', 'role_label', 'role_category', 'slot_label', 'position', 'fields', 'requirements', 'frame_asset_ids', 'video_asset_id', 'logo_asset_id'] as const;
const frozenSlideKeys = [...slideKeys, 'role_id', 'slot_id', 'candidate_media_id', 'provisional', 'review_status', 'frames'];
const requirementKeys = ['age_range', 'gender_requirement', 'appearance_performance', 'languages', 'accents', 'skills', 'scene_references', 'shoot_dates', 'location', 'availability_requirements', 'other_instructions'];
const inventoryKeys = ['asset_id', 'sha256', 'asset_kind', 'mime_type', 'byte_size'] as const;
const frozenInventoryKeys = [...inventoryKeys, 'bucket', 'object_key', 'width', 'height', 'duration_ms', 'source_asset_id', 'timestamp_ms'];
const nullableId = (value: unknown) => value === null ? null : identifier(value);
const nullableText = (value: unknown) => value === null ? null : text(value);
const bool = (value: unknown): boolean => { if (typeof value !== 'boolean') invalid(); return value as boolean; };
function timestamp(value: unknown): string {
  const result = text(value, 50);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/u.test(result) || !Number.isFinite(Date.parse(result))) invalid();
  return result;
}
function array(value: unknown, maximum: number): unknown[] { if (!Array.isArray(value) || value.length > maximum || Object.keys(value).length !== value.length) invalid(); return value as unknown[]; }
function ids(value: unknown, maximum: number): string[] { const result = array(value, maximum).map(identifier); if (new Set(result).size !== result.length) invalid(); return result; }
function requirements(value: unknown) {
  const row = object(value, requirementKeys);
  for (const key of requirementKeys) {
    if (['languages', 'accents', 'skills', 'scene_references', 'shoot_dates'].includes(key)) array(row[key], 1000).forEach(value => text(value));
    else nullableText(row[key]);
  }
  return structuredClone(row) as unknown as NonNullable<VersionSlide['requirements']>;
}
function fields(value: unknown) { const row = object(value, slideWordingFields); for (const key of slideWordingFields) text(row[key], 131072); return structuredClone(row) as unknown as NonNullable<VersionSlide['fields']>; }
function templateIdentity(value: unknown, fonts = false) {
  const row = object(value, ['key', 'version', 'content_sha256', 'font_key', ...(fonts ? ['font_hashes'] : [])]);
  identifier(row.key); identifier(row.version); identifier(row.font_key); digest(row.content_sha256);
  if (fonts) {
    const hashes = row.font_hashes;
    if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes) || ![Object.prototype, null].includes(Object.getPrototypeOf(hashes))) invalid();
    const entries = Object.entries(hashes); if (entries.length !== 6 || new Set(entries.map(([key]) => key)).size !== 6) invalid();
    for (const [key, hash] of entries) { if (!/^apps\/web\/public\/fonts\/IBMPlexSans(?:Arabic)?-(?:Regular|Medium|SemiBold)\.woff2$/u.test(key)) invalid(); digest(hash); }
  }
  return structuredClone(row);
}
function cover(value: unknown) {
  const row = object(value, ['project_name', 'client_name', 'title', 'output_type', 'logo_asset_id', 'logo_placement']);
  text(row.project_name); nullableText(row.client_name); text(row.title); nullableId(row.logo_asset_id);
  if (!['selection', 'shortlist'].includes(row.output_type as string) || !['cover', 'every_slide'].includes(row.logo_placement as string)) invalid();
  return structuredClone(row) as unknown as RenderSnapshot['cover'];
}
function audience(value: unknown) {
  const row = object(value, ['id', 'key', 'label', 'scope', 'settings', 'archived', 'row_version']);
  identifier(row.id); identifier(row.key); text(row.label); object(row.settings, []); bool(row.archived); integer(row.row_version, 1);
  if (!['internal', 'external'].includes(row.scope as string)) invalid();
  return structuredClone(row) as unknown as RenderSnapshot['audience_snapshot'];
}
function frame(value: unknown) {
  const row = object(value, ['asset_id', 'source_asset_id', 'timestamp_ms', 'width', 'height', 'sha256']);
  identifier(row.asset_id); identifier(row.source_asset_id); integer(row.timestamp_ms, 0, 1800000); integer(row.width, 1, 10000); integer(row.height, 1, 10000); digest(row.sha256);
  return structuredClone(row) as unknown as FrozenSlide['frames'][number];
}
export function parseVersionSlide(value: unknown): VersionSlide {
  const row = object(value, slideKeys);
  identifier(row.id); identifier(row.version_id); integer(row.order, 0, PRESENTATION_MAXIMUM_SLIDES - 1);
  if (!['cover', 'candidate', 'pending'].includes(row.kind as string)) invalid();
  for (const key of ['assignment_id', 'candidate_id', 'video_asset_id', 'logo_asset_id']) nullableId(row[key]);
  nullableText(row.role_label); nullableText(row.role_category); nullableText(row.slot_label); const selected = ids(row.frame_asset_ids, 3);
  if (row.kind === 'candidate') {
    identifier(row.assignment_id); identifier(row.candidate_id); text(row.role_label); text(row.slot_label);
    if (!['main', 'backup', 'option'].includes(row.position as string)) invalid(); fields(row.fields); requirements(row.requirements);
    if (selected.length && row.video_asset_id === null) invalid();
  } else {
    if (['assignment_id', 'candidate_id', 'position', 'fields', 'video_asset_id'].some(key => row[key] !== null) || selected.length) invalid();
    if (row.kind === 'cover') { if (row.role_label !== null || row.role_category !== null || row.slot_label !== null || row.requirements !== null) invalid(); }
    else { text(row.role_label); text(row.slot_label); requirements(row.requirements); }
  }
  return structuredClone(row) as unknown as VersionSlide;
}
function frozenSlide(value: unknown): FrozenSlide {
  const row = object(value, frozenSlideKeys);
  parseVersionSlide(Object.fromEntries(slideKeys.map(key => [key, row[key]])));
  nullableId(row.role_id); nullableId(row.slot_id); nullableId(row.candidate_media_id); bool(row.provisional);
  const selected = array(row.frames, 3).map(frame);
  if (selected.some((frame, n) => frame.asset_id !== (row.frame_asset_ids as string[])[n] || frame.source_asset_id !== row.video_asset_id) || selected.length !== (row.frame_asset_ids as string[]).length) invalid();
  if (row.kind === 'candidate') {
    identifier(row.role_id); identifier(row.slot_id); if (!['reviewed', 'unreviewed'].includes(row.review_status as string)) invalid();
    if (row.video_asset_id !== null && row.candidate_media_id === null || row.video_asset_id === null && row.candidate_media_id !== null) invalid();
  } else if (row.candidate_media_id !== null || row.review_status !== null || selected.length || row.kind === 'cover' && (row.role_id !== null || row.slot_id !== null || row.provisional !== false)) invalid();
  if (row.kind === 'pending' && (row.role_id === null) !== (row.slot_id === null)) invalid();
  return structuredClone(row) as unknown as FrozenSlide;
}
function frozenAsset(value: unknown): FrozenAsset {
  const row = object(value, frozenInventoryKeys);
  identifier(row.asset_id); digest(row.sha256); integer(row.byte_size, 1, 268435456);
  if (typeof row.bucket !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,99}$/u.test(row.bucket)
    || typeof row.object_key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,1023}$/u.test(row.object_key)
    || row.object_key.split('/').some(part => !part || part === '.' || part === '..')) invalid();
  for (const key of ['width', 'height']) if (row[key] !== null) integer(row[key], 1, 10000);
  if (row.width === null || row.height === null || (row.width as number) * (row.height as number) > 40000000) invalid();
  nullableId(row.source_asset_id); if (row.timestamp_ms !== null) integer(row.timestamp_ms, 0, 1800000);
  if (row.duration_ms !== null) integer(row.duration_ms, 1, 1800000);
  if (row.asset_kind === 'candidate_video') {
    if (!['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'].includes(row.mime_type as string) || row.duration_ms === null || row.source_asset_id !== null || row.timestamp_ms !== null) invalid();
  } else if (row.asset_kind === 'candidate_frame') {
    if (row.mime_type !== 'image/jpeg' || row.duration_ms !== null || row.source_asset_id === null || row.timestamp_ms === null || (row.byte_size as number) > 20971520) invalid();
  } else if (row.asset_kind === 'client_logo') {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(row.mime_type as string) || row.duration_ms !== null || row.source_asset_id !== null || row.timestamp_ms !== null || (row.byte_size as number) > 20971520) invalid();
  } else invalid();
  return structuredClone(row) as unknown as FrozenAsset;
}
export function presentationApplicationOrigin(value: unknown): string {
  const result = text(value, 1000); let url: URL; try { url = new URL(result); } catch { invalid(); }
  if (url!.origin !== result || url!.username || url!.password || url!.search || url!.hash
    || url!.protocol !== 'https:' && !(url!.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url!.hostname))) invalid();
  return result;
}
export function parseRenderSnapshot(value: unknown): RenderSnapshot {
  const row = object(value, ['schema_version', 'hash_protocol', 'version_id', 'series_id', 'workspace_id', 'project_id', 'version_no', 'created_at',
    'input_workspace_row_version', 'input_draft_revision', 'input_fingerprint', 'template', 'render_configuration', 'audience_snapshot', 'cover', 'slides', 'asset_inventory']);
  presentationCanonicalJson(row);
  if (row.schema_version !== '1.0' || row.hash_protocol !== 'eps-cast-canonical-v1') invalid();
  for (const key of ['version_id', 'series_id', 'workspace_id', 'project_id']) identifier(row[key]);
  integer(row.version_no, 1); integer(row.input_workspace_row_version, 1); integer(row.input_draft_revision); digest(row.input_fingerprint); timestamp(row.created_at);
  templateIdentity(row.template, true); audience(row.audience_snapshot); const capturedCover = cover(row.cover);
  const config = object(row.render_configuration, ['renderer_version', 'application_origin']);
  if (config.renderer_version !== 'everyone-casting-pdf-v1') invalid(); presentationApplicationOrigin(config.application_origin);
  const slides = array(row.slides, PRESENTATION_MAXIMUM_SLIDES).map(frozenSlide);
  if (slides.length < 2 || new Set(slides.map(item => item.id)).size !== slides.length || slides[0].kind !== 'cover'
    || slides.some((item, n) => item.order !== n || item.version_id !== row.version_id || n > 0 && item.kind === 'cover'
      || item.logo_asset_id !== (n === 0 || capturedCover.logo_placement === 'every_slide' ? capturedCover.logo_asset_id : null))) invalid();
  const candidates = slides.filter(item => item.kind === 'candidate');
  if (new Set(candidates.map(item => item.assignment_id)).size !== candidates.length || new Set(candidates.map(item => `${item.slot_id}:${item.candidate_id}`)).size !== candidates.length) invalid();
  const assets = array(row.asset_inventory, PRESENTATION_MAXIMUM_SLIDES * 4 + 1).map(frozenAsset);
  if (new Set(assets.map(item => item.asset_id)).size !== assets.length || assets.some((item, n) => n > 0 && item.asset_id <= assets[n - 1].asset_id)) invalid();
  const byId = new Map(assets.map(item => [item.asset_id, item])); const referenced = new Set<string>();
  for (const item of slides) {
    if (item.logo_asset_id) { if (byId.get(item.logo_asset_id)?.asset_kind !== 'client_logo') invalid(); referenced.add(item.logo_asset_id); }
    if (item.video_asset_id) { if (byId.get(item.video_asset_id)?.asset_kind !== 'candidate_video') invalid(); referenced.add(item.video_asset_id); }
    for (const selected of item.frames) {
      const asset = byId.get(selected.asset_id); if (!asset || asset.asset_kind !== 'candidate_frame' || asset.sha256 !== selected.sha256 || asset.width !== selected.width
        || asset.height !== selected.height || asset.source_asset_id !== selected.source_asset_id || asset.timestamp_ms !== selected.timestamp_ms) invalid();
      const source = byId.get(selected.source_asset_id); if (!source || source.asset_kind !== 'candidate_video' || source.duration_ms! < selected.timestamp_ms) invalid();
      referenced.add(selected.asset_id);
    }
  }
  if (referenced.size !== assets.length || assets.some(item => !referenced.has(item.asset_id)) || new TextEncoder().encode(presentationCanonicalJson(row)).byteLength > PRESENTATION_MAXIMUM_BYTES) invalid();
  return structuredClone(row) as unknown as RenderSnapshot;
}
function publishedSlide(slide: FrozenSlide): VersionSlide { return structuredClone(Object.fromEntries(slideKeys.map(key => [key, slide[key]]))) as unknown as VersionSlide; }
export function manifestFromSnapshot(snapshot: RenderSnapshot): PresentationManifest {
  return { schema_version: '1.0', version_id: snapshot.version_id, series_id: snapshot.series_id, output_type: snapshot.cover.output_type,
    audience_snapshot: structuredClone(snapshot.audience_snapshot), template_version: snapshot.template.version, template_content_hash: snapshot.template.content_sha256,
    asset_inventory: snapshot.asset_inventory.map(asset => ({ asset_id: asset.asset_id, sha256: asset.sha256, asset_kind: asset.asset_kind, mime_type: asset.mime_type, byte_size: asset.byte_size })),
    project_name: snapshot.cover.project_name, client_name: snapshot.cover.client_name, logo_asset_id: snapshot.cover.logo_asset_id, logo_placement: snapshot.cover.logo_placement,
    input_draft_revision: snapshot.input_draft_revision, input_fingerprint: snapshot.input_fingerprint, slides: snapshot.slides.map(publishedSlide), created_at: snapshot.created_at };
}
export function renderContextFromSnapshot(snapshot: RenderSnapshot): PresentationRenderContext {
  const { key, version, content_sha256, font_key } = snapshot.template;
  return { cover: structuredClone(snapshot.cover), template: { key, version, content_sha256, font_key },
    slide_contexts: snapshot.slides.map(slide => ({ slide_id: slide.id, role_id: slide.role_id, slot_id: slide.slot_id, provisional: slide.provisional,
      review_status: slide.review_status, frames: structuredClone(slide.frames) })) };
}
/** Compatibility input for the immutable registered renderer. It carries no
 * current business revisions or factual-source editing authority. */
function frozenReview(workspaceId: string, seriesId: string, fingerprint: string, draftRevision: number,
  slides: VersionSlide[], context: PresentationRenderContext): WorkspaceReview {
  const contents = slides.slice(1).map((slide, n) => {
    const extra = context.slide_contexts[n + 1];
    const displayed = slide.fields ?? Object.fromEntries(slideWordingFields.map(key => [key, 'Not provided'])) as NonNullable<VersionSlide['fields']>;
    return { kind: slide.kind as 'candidate' | 'pending', role_id: extra.role_id, role_name: slide.role_label ?? 'Requirements pending', role_category: slide.role_category,
      slot_id: extra.slot_id, slot_label: slide.slot_label ?? 'Pending', assignment_id: slide.assignment_id, workspace_candidate_id: null,
      candidate_id: slide.candidate_id, candidate_media_id: null, position: slide.position, review_status: extra.review_status,
      assignment_row_version: null, workspace_candidate_row_version: null, candidate_row_version: null,
      requirements: structuredClone(slide.requirements!), provisional: extra.provisional, fields: structuredClone(displayed), source_fields: structuredClone(displayed),
      frames: structuredClone(extra.frames), video_asset_id: slide.video_asset_id };
  });
  return { workspace_id: workspaceId, series_id: seriesId, input_fingerprint: fingerprint, draft_revision: draftRevision, output_type: context.cover.output_type,
    candidate_slide_count: contents.filter(slide => slide.kind === 'candidate').length, pending_slide_count: contents.filter(slide => slide.kind === 'pending').length,
    issues: [], can_generate: false, unreviewed_candidate_ids: [...new Set(contents.filter(slide => slide.review_status === 'unreviewed').map(slide => slide.candidate_id!))],
    template: structuredClone(context.template), cover: structuredClone(context.cover), slides: contents,
    fit: { status: 'unmeasured', input_fingerprint: null, measured_at: null, overflows: [], error_code: 'FIT_MEASUREMENT_REQUIRED' } };
}
export function reviewFromRenderSnapshot(snapshot: RenderSnapshot): WorkspaceReview {
  return frozenReview(snapshot.workspace_id, snapshot.series_id, snapshot.input_fingerprint, snapshot.input_draft_revision,
    snapshot.slides.map(publishedSlide), renderContextFromSnapshot(snapshot));
}
export function reviewFromPresentationVersion(version: PresentationVersion, workspaceId: string): WorkspaceReview {
  return frozenReview(workspaceId, version.series_id, version.input_fingerprint, version.input_draft_revision, version.slides, version.render_context);
}
function orderedSlides(value: unknown, versionId: string): VersionSlide[] {
  const slides = array(value, PRESENTATION_MAXIMUM_SLIDES).map(parseVersionSlide);
  if (slides.length < 2 || slides[0].kind !== 'cover' || new Set(slides.map(slide => slide.id)).size !== slides.length
    || slides.some((slide, n) => slide.version_id !== versionId || slide.order !== n || n > 0 && slide.kind === 'cover')) invalid();
  const assignments = slides.filter(slide => slide.kind === 'candidate').map(slide => slide.assignment_id);
  if (new Set(assignments).size !== assignments.length) invalid(); return slides;
}
export function parsePresentationRenderContext(value: unknown, slides: VersionSlide[]): PresentationRenderContext {
  const row = object(value, ['cover', 'template', 'slide_contexts']); const capturedCover = cover(row.cover); templateIdentity(row.template);
  const contexts = array(row.slide_contexts, PRESENTATION_MAXIMUM_SLIDES);
  if (contexts.length !== slides.length) invalid();
  for (let n = 0; n < contexts.length; n++) {
    const item = object(contexts[n], ['slide_id', 'role_id', 'slot_id', 'provisional', 'review_status', 'frames']); const slide = slides[n];
    if (identifier(item.slide_id) !== slide.id) invalid(); nullableId(item.role_id); nullableId(item.slot_id); bool(item.provisional);
    const selected = array(item.frames, 3).map(frame);
    if (selected.length !== slide.frame_asset_ids.length || selected.some((frame, i) => frame.asset_id !== slide.frame_asset_ids[i] || frame.source_asset_id !== slide.video_asset_id)) invalid();
    if (slide.kind === 'candidate') { identifier(item.role_id); identifier(item.slot_id); if (!['unreviewed', 'reviewed'].includes(item.review_status as string)) invalid(); }
    else if (item.review_status !== null || selected.length || slide.kind === 'cover' && (item.role_id !== null || item.slot_id !== null || item.provisional !== false)) invalid();
    if (slide.kind === 'pending' && (item.role_id === null) !== (item.slot_id === null)) invalid();
    if (slide.logo_asset_id !== (n === 0 || capturedCover.logo_placement === 'every_slide' ? capturedCover.logo_asset_id : null)) invalid();
  }
  return structuredClone(row) as unknown as PresentationRenderContext;
}
export function parsePresentationVersion(value: unknown): PresentationVersion {
  const row = object(value, ['id', 'series_id', 'version_no', 'status', 'input_draft_revision', 'input_fingerprint', 'template_version', 'manifest_hash', 'slides',
    'pdf_asset_id', 'manifest_asset_id', 'created_at', 'ready_at', 'generation_job_id', 'generated_by', 'failure_code', 'render_context']);
  presentationCanonicalJson(row);
  for (const key of ['id', 'series_id', 'generation_job_id', 'generated_by', 'template_version']) identifier(row[key]);
  integer(row.version_no, 1); integer(row.input_draft_revision); digest(row.input_fingerprint); digest(row.manifest_hash); timestamp(row.created_at);
  nullableId(row.pdf_asset_id); nullableId(row.manifest_asset_id);
  if (!['queued', 'rendering', 'ready', 'failed'].includes(row.status as string)) invalid();
  if (row.status === 'ready') {
    identifier(row.pdf_asset_id); identifier(row.manifest_asset_id); timestamp(row.ready_at);
    if (Date.parse(row.ready_at as string) < Date.parse(row.created_at as string) || row.failure_code !== null || row.pdf_asset_id === row.manifest_asset_id) invalid();
  } else if (row.pdf_asset_id !== null || row.manifest_asset_id !== null || row.ready_at !== null) invalid();
  if (row.status === 'failed') { if (typeof row.failure_code !== 'string' || !/^[A-Z][A-Z0-9_]{0,99}$/u.test(row.failure_code)) invalid(); }
  else if (row.failure_code !== null) invalid();
  const slides = orderedSlides(row.slides, row.id as string); const context = parsePresentationRenderContext(row.render_context, slides);
  if (context.template.version !== row.template_version || new TextEncoder().encode(presentationCanonicalJson(row)).byteLength > PRESENTATION_MAXIMUM_BYTES) invalid();
  return structuredClone(row) as unknown as PresentationVersion;
}
export function parsePresentationManifest(value: unknown): PresentationManifest {
  const row = object(value, ['schema_version', 'version_id', 'series_id', 'output_type', 'audience_snapshot', 'template_version', 'template_content_hash',
    'asset_inventory', 'project_name', 'client_name', 'logo_asset_id', 'logo_placement', 'input_draft_revision', 'input_fingerprint', 'slides', 'created_at']);
  presentationCanonicalJson(row);
  if (row.schema_version !== '1.0' || !['selection', 'shortlist'].includes(row.output_type as string) || !['cover', 'every_slide'].includes(row.logo_placement as string)) invalid();
  identifier(row.version_id); identifier(row.series_id); identifier(row.template_version); digest(row.template_content_hash); audience(row.audience_snapshot);
  text(row.project_name); nullableText(row.client_name); nullableId(row.logo_asset_id); integer(row.input_draft_revision); digest(row.input_fingerprint); timestamp(row.created_at);
  const slides = orderedSlides(row.slides, row.version_id as string); const assets = array(row.asset_inventory, PRESENTATION_MAXIMUM_SLIDES * 4 + 1).map(item => {
    const asset = object(item, inventoryKeys); identifier(asset.asset_id); digest(asset.sha256); integer(asset.byte_size, 1, 268435456);
    if (asset.asset_kind === 'candidate_video') { if (!['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'].includes(asset.mime_type as string)) invalid(); }
    else if (asset.asset_kind === 'candidate_frame') { if (asset.mime_type !== 'image/jpeg') invalid(); }
    else if (asset.asset_kind === 'client_logo') { if (!['image/png', 'image/jpeg', 'image/webp'].includes(asset.mime_type as string)) invalid(); }
    else invalid(); return asset;
  });
  if (new Set(assets.map(asset => asset.asset_id)).size !== assets.length || assets.some((asset, n) => n > 0 && (asset.asset_id as string) <= (assets[n - 1].asset_id as string))) invalid();
  const byId = new Map(assets.map(asset => [asset.asset_id, asset])); const used = new Set<string>();
  for (const [n, slide] of slides.entries()) {
    if (slide.logo_asset_id !== (n === 0 || row.logo_placement === 'every_slide' ? row.logo_asset_id : null)) invalid();
    if (slide.logo_asset_id) { if (byId.get(slide.logo_asset_id)?.asset_kind !== 'client_logo') invalid(); used.add(slide.logo_asset_id); }
    if (slide.video_asset_id) { if (byId.get(slide.video_asset_id)?.asset_kind !== 'candidate_video') invalid(); used.add(slide.video_asset_id); }
    for (const frameId of slide.frame_asset_ids) { if (byId.get(frameId)?.asset_kind !== 'candidate_frame') invalid(); used.add(frameId); }
  }
  if (used.size !== assets.length || assets.some(asset => !used.has(asset.asset_id as string)) || new TextEncoder().encode(presentationCanonicalJson(row)).byteLength > PRESENTATION_MAXIMUM_BYTES) invalid();
  return structuredClone(row) as unknown as PresentationManifest;
}
export function summarizePresentationChanges(current: WorkspaceReview, last: PresentationVersion | null): PresentationChangeSummary {
  const result: PresentationChangeSummary = { has_changes: false, added_assignments: 0, removed_assignments: 0, changed_fields: 0, changed_media: 0,
    changed_requirements: 0, changed_casting: 0, order_changed: false, branding_changed: false, template_changed: false, shared_source_changed: false };
  if (!last) return { ...result, has_changes: true, added_assignments: current.candidate_slide_count };
  if (current.series_id !== last.series_id || current.output_type !== last.render_context.cover.output_type) invalid();
  const previous = reviewFromPresentationVersion(last, current.workspace_id);
  const byAssignment = (review: WorkspaceReview) => new Map(review.slides.filter(slide => slide.kind === 'candidate').map(slide => [slide.assignment_id!, slide]));
  const before = byAssignment(previous); const after = byAssignment(current);
  const equal = (a: unknown, b: unknown) => presentationCanonicalJson(a) === presentationCanonicalJson(b);
  result.added_assignments = [...after.keys()].filter(id => !before.has(id)).length;
  result.removed_assignments = [...before.keys()].filter(id => !after.has(id)).length;
  for (const [id, slide] of after) {
    const old = before.get(id); if (!old) continue;
    result.changed_fields += slideWordingFields.filter(key => slide.fields[key] !== old.fields[key]).length;
    if (slide.position !== old.position) result.changed_casting++;
    if (!equal({ frames: slide.frames, video: slide.video_asset_id }, { frames: old.frames, video: old.video_asset_id })) result.changed_media++;
  }
  const slotContents = (review: WorkspaceReview) => new Map(review.slides.map(slide => [slide.slot_id ?? 'workspace-pending',
    { requirements: slide.requirements, role: slide.role_name, category: slide.role_category ?? null, slot: slide.slot_label, provisional: slide.provisional }]));
  const oldSlots = slotContents(previous); const newSlots = slotContents(current);
  for (const key of new Set([...oldSlots.keys(), ...newSlots.keys()])) {
    if (!oldSlots.has(key) || !newSlots.has(key) || !equal(oldSlots.get(key), newSlots.get(key))) result.changed_requirements++;
  }
  const order = (review: WorkspaceReview) => review.slides.map(slide => slide.assignment_id ? `candidate:${slide.assignment_id}` : `pending:${slide.slot_id ?? 'workspace'}`);
  const oldOrder = order(previous); const newOrder = order(current);
  result.order_changed = equal([...oldOrder].sort(), [...newOrder].sort()) && !equal(oldOrder, newOrder);
  result.branding_changed = !equal(current.cover, last.render_context.cover);
  result.template_changed = !equal(current.template, last.render_context.template);
  const visible = result.added_assignments + result.removed_assignments + result.changed_fields + result.changed_media + result.changed_requirements + result.changed_casting > 0
    || result.order_changed || result.branding_changed || result.template_changed;
  result.has_changes = visible || current.input_fingerprint !== last.input_fingerprint;
  result.shared_source_changed = current.input_fingerprint !== last.input_fingerprint && !visible;
  return result;
}
