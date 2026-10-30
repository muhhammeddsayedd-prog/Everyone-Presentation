import { DomainError } from './types.ts';
import { parseVersionSlide } from './presentation.ts';
import type { CommentCreate, CommentPatch, ExportPreparation, ExportPrepare, ExternalPresentationVersion, Feedback,
  FeedbackComment, FeedbackListOptions, FeedbackPreference, GuestAccess, GuestCommentCreate, GuestCommentPatch,
  GuestIdentity, PreferenceResult, PreferenceSet, PresentationExport, ReviewLink, ReviewLinkCreate, ReviewLinkListOptions, ReviewLinkPatch } from './guest-types.ts';

function invalid(): never { throw new DomainError('VALIDATION_FAILED', 'Review data does not match the supported contract.', 400); }
export function guestResponseInvalid(): never { throw new DomainError('DEPENDENCY_UNAVAILABLE', 'The review service returned an invalid response.', 503); }
export function guestRecord(value: unknown, keys: readonly string[], required: readonly string[] = keys): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some(key => !keys.includes(key)) || required.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}
export function guestText(value: unknown, maximum = 10000, nonempty = false): string {
  if (typeof value !== 'string' || nonempty && !value.trim()) invalid();
  let characters = 0;
  for (const character of value as string) { const point = character.codePointAt(0)!; if (++characters > maximum || point >= 0xd800 && point <= 0xdfff || point < 32 && ![9, 10, 13].includes(point) || point === 127) invalid(); }
  return value as string;
}
export function guestIdentifier(value: unknown): string {
  const result = guestText(value, 200, true); if (['.', '..'].includes(result) || /[\\/\p{C}?#%]/u.test(result)) invalid(); return result;
}
export function guestInteger(value: unknown, minimum = 1, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum || Object.is(value, -0)) invalid(); return value as number;
}
function bool(value: unknown): boolean { if (typeof value !== 'boolean') invalid(); return value as boolean; }
export function guestTimestamp(value: unknown): string {
  const result = guestText(value, 50); const match = /^(\d{4})-(\d\d)-(\d\d)T([0-2]\d):([0-5]\d):([0-5]\d)(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/u.exec(result);
  if (!match || !Number.isFinite(Date.parse(result))) invalid();
  const [year, month, day, hour] = match.slice(1, 5).map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || month < 1 || month > 12 || hour > 23 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) invalid();
  return result;
}
const nullableId = (value: unknown) => value === null ? null : guestIdentifier(value);
const nullableText = (value: unknown, maximum = 10000) => value === null ? null : guestText(value, maximum);
function nullableTimestamp(value: unknown) { return value === null ? null : guestTimestamp(value); }
function array(value: unknown, maximum = 100): unknown[] { if (!Array.isArray(value) || value.length > maximum || Object.keys(value).length !== value.length) invalid(); return value as unknown[]; }
function page(value: unknown) { const row = guestRecord(value, ['next_cursor']); return { next_cursor: row.next_cursor === null ? null : guestText(row.next_cursor, 4000, true) }; }
function projected<T>(action: () => T): T { try { return action(); } catch { return guestResponseInvalid(); } }

export function parseReviewLinkCreate(value: unknown): ReviewLinkCreate {
  const row = guestRecord(value, ['series_id', 'label', 'expires_at', 'download_enabled'], ['series_id']);
  return { series_id: guestIdentifier(row.series_id), ...(Object.hasOwn(row, 'label') ? { label: guestText(row.label, 160) } : {}),
    ...(Object.hasOwn(row, 'expires_at') ? { expires_at: guestTimestamp(row.expires_at) } : {}),
    ...(Object.hasOwn(row, 'download_enabled') ? { download_enabled: bool(row.download_enabled) } : {}) };
}
export function parseReviewLinkPatch(value: unknown): ReviewLinkPatch {
  const row = guestRecord(value, ['row_version', 'label', 'expires_at', 'download_enabled'], ['row_version']);
  return { row_version: guestInteger(row.row_version), ...(Object.hasOwn(row, 'label') ? { label: guestText(row.label, 160) } : {}),
    ...(Object.hasOwn(row, 'expires_at') ? { expires_at: guestTimestamp(row.expires_at) } : {}),
    ...(Object.hasOwn(row, 'download_enabled') ? { download_enabled: bool(row.download_enabled) } : {}) };
}
export function parseGuestRowVersion(value: unknown): { row_version: number } { const row = guestRecord(value, ['row_version']); return { row_version: guestInteger(row.row_version) }; }
export function parseGuestIdentity(value: unknown): GuestIdentity {
  const row = guestRecord(value, ['display_name', 'company'], ['display_name']);
  return { display_name: guestText(row.display_name, 120, true).trim(), ...(Object.hasOwn(row, 'company') ? { company: nullableText(row.company, 160)?.trim() ?? null } : {}) };
}
export function parseGuestCommentCreate(value: unknown): GuestCommentCreate {
  const row = guestRecord(value, ['version_slide_id', 'body', 'parent_comment_id'], ['version_slide_id', 'body']);
  return { version_slide_id: guestIdentifier(row.version_slide_id), body: guestText(row.body, 10000, true),
    ...(Object.hasOwn(row, 'parent_comment_id') ? { parent_comment_id: guestIdentifier(row.parent_comment_id) } : {}) };
}
export function parseCommentCreate(value: unknown): CommentCreate {
  const row = guestRecord(value, ['version_slide_id', 'body', 'parent_comment_id', 'visibility'], ['version_slide_id', 'body', 'visibility']);
  if (!['internal', 'external'].includes(row.visibility as string)) invalid();
  const { visibility: _, ...fields } = row; void _;
  return { ...parseGuestCommentCreate(fields), visibility: row.visibility as 'internal' | 'external' };
}
export function parseGuestCommentPatch(value: unknown): GuestCommentPatch {
  const row = guestRecord(value, ['row_version', 'body']); return { row_version: guestInteger(row.row_version), body: guestText(row.body, 10000, true) };
}
export function parseCommentPatch(value: unknown): CommentPatch {
  const row = guestRecord(value, ['row_version', 'body', 'resolved'], ['row_version']); if (!Object.hasOwn(row, 'body') && !Object.hasOwn(row, 'resolved')) invalid();
  return { row_version: guestInteger(row.row_version), ...(Object.hasOwn(row, 'body') ? { body: guestText(row.body, 10000, true) } : {}), ...(Object.hasOwn(row, 'resolved') ? { resolved: bool(row.resolved) } : {}) };
}
export function parsePreferenceSet(value: unknown): PreferenceSet {
  const row = guestRecord(value, ['version_slide_id', 'value', 'row_version'], ['version_slide_id', 'value']);
  if (row.value !== null && !['preferred', 'maybe', 'not_preferred'].includes(row.value as string)) invalid();
  return { version_slide_id: guestIdentifier(row.version_slide_id), value: row.value as PreferenceSet['value'],
    ...(Object.hasOwn(row, 'row_version') ? { row_version: row.row_version === null ? null : guestInteger(row.row_version) } : {}) };
}
export function parseGuestListOptions(value: unknown = {}): FeedbackListOptions {
  const row = guestRecord(value, ['cursor', 'limit'], []);
  return { ...(Object.hasOwn(row, 'cursor') ? { cursor: guestText(row.cursor, 4000, true) } : {}), ...(Object.hasOwn(row, 'limit') ? { limit: guestInteger(row.limit, 1, 100) } : {}) };
}
export function parseReviewLinkListOptions(value: unknown = {}): ReviewLinkListOptions {
  const row = guestRecord(value, ['workspace_id', 'cursor', 'limit'], []); const { workspace_id: _, ...options } = row; void _;
  return { ...parseGuestListOptions(options), ...(Object.hasOwn(row, 'workspace_id') ? { workspace_id: guestIdentifier(row.workspace_id) } : {}) };
}
export function parseExportPrepare(value: unknown): ExportPrepare { const row = guestRecord(value, ['version_id', 'review_link_id']); return { version_id: guestIdentifier(row.version_id), review_link_id: guestIdentifier(row.review_link_id) }; }
export function reviewLinkDto(value: unknown): ReviewLink {
  return projected(() => {
    const row = guestRecord(value, ['id', 'series_id', 'label', 'expires_at', 'download_enabled', 'revoked_at', 'latest_ready_version_id', 'row_version', 'created_at']);
    return { id: guestIdentifier(row.id), series_id: guestIdentifier(row.series_id), label: guestText(row.label, 160), expires_at: guestTimestamp(row.expires_at), download_enabled: bool(row.download_enabled),
      revoked_at: nullableTimestamp(row.revoked_at), latest_ready_version_id: nullableId(row.latest_ready_version_id), row_version: guestInteger(row.row_version), created_at: guestTimestamp(row.created_at) };
  });
}
export function guestAccessDto(value: unknown, accessToken: string): GuestAccess {
  return projected(() => {
    const row = guestRecord(value, ['expires_at', 'series_id', 'version_id', 'download_enabled', 'display_name', 'guest_session_id']);
    return { access_token: accessToken, expires_at: guestTimestamp(row.expires_at), series_id: guestIdentifier(row.series_id), version_id: nullableId(row.version_id),
      download_enabled: bool(row.download_enabled), display_name: nullableText(row.display_name, 120), guest_session_id: guestIdentifier(row.guest_session_id) };
  });
}
export function externalVersionDto(value: unknown): ExternalPresentationVersion {
  return projected(() => {
    const row = guestRecord(value, ['id', 'series_id', 'version_no', 'title', 'output_type', 'status', 'slides', 'created_at', 'download_enabled', 'cover', 'template_version', 'template_content_hash']);
    if (row.status !== 'ready' || !['selection', 'shortlist'].includes(row.output_type as string)) invalid();
    const slides = array(row.slides, 1000).map(parseVersionSlide); const id = guestIdentifier(row.id);
    if (slides.length < 2 || slides[0].kind !== 'cover' || slides.slice(1).some(slide => slide.kind === 'cover')
      || slides.some((slide, n) => slide.version_id !== id || slide.order !== n) || new Set(slides.map(slide => slide.id)).size !== slides.length) invalid();
    const cover = guestRecord(row.cover, ['project_name', 'client_name', 'title', 'output_type', 'logo_asset_id', 'logo_placement']);
    if (cover.output_type !== row.output_type || cover.title !== row.title || !['cover', 'every_slide'].includes(cover.logo_placement as string)
      || typeof row.template_content_hash !== 'string' || !/^[a-f0-9]{64}$/u.test(row.template_content_hash)) invalid();
    return { id, series_id: guestIdentifier(row.series_id), version_no: guestInteger(row.version_no), title: guestText(row.title), output_type: row.output_type as 'selection' | 'shortlist',
      status: 'ready', slides, created_at: guestTimestamp(row.created_at), download_enabled: bool(row.download_enabled),
      cover: { project_name: guestText(cover.project_name), client_name: nullableText(cover.client_name), title: guestText(cover.title), output_type: cover.output_type as 'selection' | 'shortlist',
        logo_asset_id: nullableId(cover.logo_asset_id), logo_placement: cover.logo_placement as 'cover' | 'every_slide' },
      template_version: guestText(row.template_version, 200, true), template_content_hash: row.template_content_hash };
  });
}
export function feedbackCommentDto(value: unknown, externalOnly = false): FeedbackComment {
  return projected(() => {
    const row = guestRecord(value, ['id', 'series_id', 'version_id', 'version_slide_id', 'guest_session_id', 'author_display_name', 'company', 'visibility', 'body', 'parent_comment_id', 'resolved', 'row_version', 'created_at', 'updated_at']);
    if (!['internal', 'external'].includes(row.visibility as string) || externalOnly && row.visibility !== 'external') invalid();
    return { id: guestIdentifier(row.id), series_id: guestIdentifier(row.series_id), version_id: guestIdentifier(row.version_id), version_slide_id: guestIdentifier(row.version_slide_id),
      guest_session_id: nullableId(row.guest_session_id), author_display_name: guestText(row.author_display_name, 120, true), company: nullableText(row.company, 160), visibility: row.visibility as 'internal' | 'external',
      body: guestText(row.body, 10000, true), parent_comment_id: nullableId(row.parent_comment_id), resolved: bool(row.resolved), row_version: guestInteger(row.row_version), created_at: guestTimestamp(row.created_at), updated_at: guestTimestamp(row.updated_at) };
  });
}
function preferenceDto(value: unknown): FeedbackPreference {
  const row = guestRecord(value, ['id', 'version_slide_id', 'guest_session_id', 'author_display_name', 'value', 'row_version', 'updated_at']);
  if (!['preferred', 'maybe', 'not_preferred'].includes(row.value as string)) invalid();
  return { id: guestIdentifier(row.id), version_slide_id: guestIdentifier(row.version_slide_id), guest_session_id: nullableId(row.guest_session_id), author_display_name: guestText(row.author_display_name, 120, true),
    value: row.value as FeedbackPreference['value'], row_version: guestInteger(row.row_version), updated_at: guestTimestamp(row.updated_at) };
}
export function preferenceResultDto(value: unknown): PreferenceResult { return projected(() => { const row = guestRecord(value, ['preference', 'cleared']); const cleared = bool(row.cleared); if (cleared !== (row.preference === null)) invalid(); return { preference: row.preference === null ? null : preferenceDto(row.preference), cleared }; }); }
export function guestFeedbackDto(value: unknown, externalOnly = false): Feedback {
  return projected(() => { const row = guestRecord(value, ['comments', 'preferences', 'version_id', 'page']); const versionId = guestIdentifier(row.version_id);
    const comments = array(row.comments).map(item => feedbackCommentDto(item, externalOnly)); const preferences = array(row.preferences).map(preferenceDto);
    if (comments.length + preferences.length > 100 || comments.some(item => item.version_id !== versionId) || new Set(comments.map(item => item.id)).size !== comments.length || new Set(preferences.map(item => item.id)).size !== preferences.length) invalid();
    return { comments, preferences, version_id: versionId, page: page(row.page) };
  });
}
export function presentationExportDto(value: unknown): PresentationExport {
  return projected(() => { const row = guestRecord(value, ['id', 'version_id', 'review_link_id', 'template_version', 'export_revision', 'status', 'pdf_asset_id', 'job_id', 'created_at', 'ready_at', 'failure_code']);
    if (!['queued', 'rendering', 'ready', 'failed'].includes(row.status as string)) invalid();
    const result: PresentationExport = { id: guestIdentifier(row.id), version_id: guestIdentifier(row.version_id), review_link_id: guestIdentifier(row.review_link_id), template_version: guestText(row.template_version, 200, true),
      export_revision: guestInteger(row.export_revision), status: row.status as PresentationExport['status'], pdf_asset_id: nullableId(row.pdf_asset_id), job_id: guestIdentifier(row.job_id), created_at: guestTimestamp(row.created_at), ready_at: nullableTimestamp(row.ready_at), failure_code: nullableText(row.failure_code, 100) };
    if (result.status === 'ready' && (!result.pdf_asset_id || !result.ready_at) || result.status !== 'ready' && result.ready_at !== null) invalid(); return result;
  });
}
export function exportPreparationDto(value: unknown): ExportPreparation { return projected(() => { const row = guestRecord(value, ['export', 'job_id', 'cached']); const result = { export: presentationExportDto(row.export), job_id: nullableId(row.job_id), cached: bool(row.cached) };
  if (result.cached !== (result.export.status === 'ready') || result.cached && result.job_id !== null || !result.cached && result.job_id !== result.export.job_id) invalid(); return result; }); }
