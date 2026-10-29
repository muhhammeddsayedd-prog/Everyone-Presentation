import { DomainError } from '../../domain/src/types.ts';
import { slideWordingFields } from '../../domain/src/casting-types.ts';
import type { AiSuggestion, PresentationSeries, ReviewFields, ReviewFit, ReviewFrame, ReviewJobAccepted, ReviewSlide, WorkspaceReview } from '../../domain/src/review-types.ts';
import { audienceDto } from './dto.ts';
import { parseRoleRequirements } from '../../domain/src/specs.ts';
import type { CastingRetirement, CastingRetirementUndoResult } from '../../domain/src/review-types.ts';

function fail(): never { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central review data did not match its published contract.', 503); }
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value && !/[\p{C}]/u.test(value);
const integer = (value: unknown, min = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const nullable = (value: unknown, check: (value: unknown) => boolean) => value === null || check(value);
const timestamp = (value: unknown) => typeof value === 'string' && value.length <= 50 && Number.isFinite(Date.parse(value));
function string(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 786432) return false;
  for (const char of value) { const point = char.codePointAt(0)!; if (point >= 0xd800 && point <= 0xdfff || point < 32 && ![9, 10, 13].includes(point) || point === 127) return false; }
  return true;
}
export function reviewRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![null, Object.prototype].includes(Object.getPrototypeOf(value)) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail();
  return value as Record<string, unknown>;
}
export function presentationSeriesDto(value: unknown): PresentationSeries {
  const row = reviewRecord(value, ['id', 'workspace_id', 'output_type', 'audience_preset_id', 'audience_snapshot', 'title', 'latest_ready_version_id', 'latest_ready_version_no', 'row_version', 'archived', 'template_key', 'template_version', 'template_content_sha256', 'font_key']);
  if (![row.id, row.workspace_id, row.audience_preset_id, row.template_key, row.template_version, row.font_key].every(isId) || !['selection', 'shortlist'].includes(row.output_type as string) || !string(row.title) || !digest(row.template_content_sha256) || !integer(row.row_version, 1) || typeof row.archived !== 'boolean' || !nullable(row.latest_ready_version_id, isId) || !nullable(row.latest_ready_version_no, value => integer(value, 1)) || (row.latest_ready_version_id === null) !== (row.latest_ready_version_no === null)) fail();
  const audience = audienceDto(row.audience_snapshot); if (audience.id !== row.audience_preset_id) fail();
  return structuredClone({ ...row, audience_snapshot: audience }) as unknown as PresentationSeries;
}
function fields(value: unknown): ReviewFields { const row = reviewRecord(value, slideWordingFields); if (!Object.values(row).every(string)) fail(); return structuredClone(row) as ReviewFields; }
function frame(value: unknown): ReviewFrame {
  const row = reviewRecord(value, ['asset_id', 'source_asset_id', 'timestamp_ms', 'width', 'height', 'sha256']);
  if (!isId(row.asset_id) || !isId(row.source_asset_id) || !digest(row.sha256) || !integer(row.timestamp_ms) || !integer(row.width, 1) || !integer(row.height, 1)) fail();
  return structuredClone(row) as unknown as ReviewFrame;
}
function slide(value: unknown): ReviewSlide {
  const hasCategory = Boolean(value && typeof value === 'object' && Object.hasOwn(value, 'role_category'));
  const row = reviewRecord(value, ['kind', 'role_id', 'role_name', ...(hasCategory ? ['role_category'] : []), 'slot_id', 'slot_label', 'assignment_id', 'workspace_candidate_id', 'candidate_id', 'candidate_media_id', 'position', 'review_status', 'assignment_row_version', 'workspace_candidate_row_version', 'candidate_row_version', 'requirements', 'provisional', 'fields', 'source_fields', 'frames', 'video_asset_id']);
  if (hasCategory && !nullable(row.role_category, string)) fail();
  if (!['candidate', 'pending'].includes(row.kind as string) || !string(row.role_name) || !string(row.slot_label)
    || typeof row.provisional !== 'boolean' || !['role_id', 'slot_id', 'assignment_id', 'workspace_candidate_id', 'candidate_id', 'candidate_media_id', 'video_asset_id'].every(key => nullable(row[key], isId)) || !Array.isArray(row.frames) || row.frames.length > 3) fail();
  let requirements; try { requirements = parseRoleRequirements(row.requirements); } catch { fail(); }
  const selected = row.frames.map(frame); const resolved = fields(row.fields); const source = fields(row.source_fields);
  if (new Set(selected.map(row => row.asset_id)).size !== selected.length || selected.some(item => item.source_asset_id !== row.video_asset_id)) fail();
  if (row.kind === 'candidate') {
    if (![row.role_id, row.slot_id, row.assignment_id, row.workspace_candidate_id, row.candidate_id].every(isId) || !['assignment_row_version', 'workspace_candidate_row_version', 'candidate_row_version'].every(key => integer(row[key], 1)) || !['main', 'option', 'backup'].includes(row.position as string) || !['reviewed', 'unreviewed'].includes(row.review_status as string)) fail();
  } else if (['assignment_id', 'workspace_candidate_id', 'candidate_id', 'candidate_media_id', 'video_asset_id', 'position', 'review_status', 'assignment_row_version', 'workspace_candidate_row_version', 'candidate_row_version'].some(key => row[key] !== null) || selected.length || Object.values(resolved).some(value => value !== 'Not provided') || Object.values(source).some(value => value !== 'Not provided')) fail();
  return { ...structuredClone(row), requirements, fields: resolved, source_fields: source, frames: selected } as unknown as ReviewSlide;
}
function fit(value: unknown, fingerprint: string, slides: number): ReviewFit {
  const row = reviewRecord(value, ['status', 'input_fingerprint', 'measured_at', 'overflows', 'error_code']);
  if (!['unmeasured', 'measured', 'failed'].includes(row.status as string) || !nullable(row.input_fingerprint, digest) || !nullable(row.measured_at, timestamp) || !nullable(row.error_code, isId) || !Array.isArray(row.overflows) || row.overflows.length > 10000) fail();
  for (const overflow of row.overflows) {
    const item = reviewRecord(overflow, ['slide_index', 'field', 'axis', 'overflow_px']);
    if (!integer(item.slide_index) || item.slide_index > slides || !isId(item.field) || !['horizontal', 'vertical'].includes(item.axis as string) || typeof item.overflow_px !== 'number' || !Number.isFinite(item.overflow_px) || item.overflow_px <= 0) fail();
  }
  if (row.status === 'measured' && (row.input_fingerprint !== fingerprint || !timestamp(row.measured_at) || row.error_code !== null)) fail();
  if (row.status !== 'measured' && row.error_code === null) fail();
  return structuredClone(row) as unknown as ReviewFit;
}
export function workspaceReviewDto(value: unknown): WorkspaceReview {
  const row = reviewRecord(value, ['workspace_id', 'series_id', 'input_fingerprint', 'draft_revision', 'output_type', 'candidate_slide_count', 'pending_slide_count', 'issues', 'can_generate', 'unreviewed_candidate_ids', 'template', 'cover', 'slides', 'fit']);
  if (!isId(row.workspace_id) || !isId(row.series_id) || !digest(row.input_fingerprint) || !integer(row.draft_revision) || !['selection', 'shortlist'].includes(row.output_type as string) || !integer(row.candidate_slide_count) || !integer(row.pending_slide_count) || typeof row.can_generate !== 'boolean' || !Array.isArray(row.issues) || row.issues.length > 100000 || !Array.isArray(row.unreviewed_candidate_ids) || row.unreviewed_candidate_ids.some(value => !isId(value)) || !Array.isArray(row.slides) || row.slides.length > 10000 || new TextEncoder().encode(JSON.stringify(value)).byteLength > 16 * 1024 * 1024) fail();
  const template = reviewRecord(row.template, ['key', 'version', 'content_sha256', 'font_key']);
  if (![template.key, template.version, template.font_key].every(isId) || !digest(template.content_sha256)) fail();
  const cover = reviewRecord(row.cover, ['project_name', 'client_name', 'title', 'output_type', 'logo_asset_id', 'logo_placement']);
  if (!string(cover.project_name) || !nullable(cover.client_name, string) || !string(cover.title) || cover.output_type !== row.output_type || !nullable(cover.logo_asset_id, isId) || !['cover', 'every_slide'].includes(cover.logo_placement as string)) fail();
  const slides = row.slides.map(slide); const candidateSlides = slides.filter(row => row.kind === 'candidate');
  if (template.version === '1.1.0' && slides.some(item => !Object.hasOwn(item, 'role_category'))) fail();
  if (candidateSlides.length !== row.candidate_slide_count || slides.length - candidateSlides.length !== row.pending_slide_count || new Set(candidateSlides.map(row => row.assignment_id)).size !== candidateSlides.length || new Set(candidateSlides.map(row => `${row.slot_id}:${row.candidate_id}`)).size !== candidateSlides.length) fail();
  const unreviewed = [...new Set(candidateSlides.filter(row => row.review_status === 'unreviewed').map(row => row.candidate_id!))];
  if (unreviewed.length !== row.unreviewed_candidate_ids.length || unreviewed.some(id => !(row.unreviewed_candidate_ids as string[]).includes(id))) fail();
  for (const issue of row.issues) { const item = reviewRecord(issue, ['code', 'severity', 'entity_id', 'field', 'message', 'repair_action']); if (!isId(item.code) || !['information', 'warning', 'blocking'].includes(item.severity as string) || !nullable(item.entity_id, isId) || !nullable(item.field, string) || !string(item.message) || !nullable(item.repair_action, string)) fail(); }
  const measurement = fit(row.fit, row.input_fingerprint, slides.length);
  if (row.can_generate && (measurement.status !== 'measured' || measurement.overflows.length || row.issues.some(issue => (issue as Record<string, unknown>).severity === 'blocking'))) fail();
  return { ...structuredClone(row), slides, fit: measurement } as unknown as WorkspaceReview;
}
export function reviewJobDto(value: unknown): ReviewJobAccepted {
  const row = reviewRecord(value, ['job_id', 'resource_id', 'poll_url', 'status']);
  if (!isId(row.job_id) || !isId(row.resource_id) || row.poll_url !== `/api/v1/jobs/${encodeURIComponent(row.job_id as string)}` || !['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'].includes(row.status as string)) fail();
  return structuredClone(row) as unknown as ReviewJobAccepted;
}
export function aiSuggestionDto(value: unknown): AiSuggestion {
  const row = reviewRecord(value, ['id', 'target_id', 'target_row_version', 'status', 'suggested_text', 'proposed_changes', 'warnings']);
  if (!isId(row.id) || !isId(row.target_id) || !integer(row.target_row_version, 1) || !['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'].includes(row.status as string) || !nullable(row.suggested_text, string) || !Array.isArray(row.proposed_changes) || row.proposed_changes.length > 10 || !Array.isArray(row.warnings) || row.warnings.length > 100) fail();
  for (const change of row.proposed_changes) { const item = reviewRecord(change, ['field', 'old_value', 'new_value']); if (!isId(item.field) || !nullable(item.old_value, string) || !nullable(item.new_value, string)) fail(); }
  for (const warning of row.warnings) { const item = reviewRecord(warning, ['code', 'message', 'entity_id']); if (!isId(item.code) || !string(item.message) || !nullable(item.entity_id, isId)) fail(); }
  if (row.status !== 'succeeded' && (row.suggested_text !== null || row.proposed_changes.length)) fail();
  return structuredClone(row) as unknown as AiSuggestion;
}
export function castingRetirementDto(value: unknown): CastingRetirement {
  const row = reviewRecord(value, ['workspace_id', 'resource_id', 'operation', 'undo_event_id', 'expected_workspace_row_version', 'assignment_ids', 'slot_ids', 'main_count', 'shortlist_count', 'can_undo', 'unavailable_reason']);
  if (![row.workspace_id, row.resource_id, row.undo_event_id].every(isId) || !['retire_slots', 'archive_role', 'remove_workspace_candidate'].includes(row.operation as string) || !integer(row.expected_workspace_row_version, 1) || !integer(row.main_count) || !integer(row.shortlist_count) || typeof row.can_undo !== 'boolean' || !nullable(row.unavailable_reason, string)) fail();
  for (const name of ['assignment_ids', 'slot_ids']) if (!Array.isArray(row[name]) || (row[name] as unknown[]).length > 1000 || !(row[name] as unknown[]).every(isId) || new Set(row[name] as string[]).size !== (row[name] as unknown[]).length) fail();
  if ((row.main_count as number) > (row.assignment_ids as string[]).length || (row.shortlist_count as number) > (row.assignment_ids as string[]).length || row.can_undo && row.unavailable_reason !== null) fail();
  return structuredClone(row) as unknown as CastingRetirement;
}
export function retirementUndoDto(value: unknown): CastingRetirementUndoResult {
  const row = reviewRecord(value, ['success', 'affected_ids', 'workspace_row_version']);
  if (row.success !== true || !integer(row.workspace_row_version, 1) || !Array.isArray(row.affected_ids) || row.affected_ids.length > 10000 || !row.affected_ids.every(isId) || new Set(row.affected_ids).size !== row.affected_ids.length) fail();
  return structuredClone(row) as unknown as CastingRetirementUndoResult;
}
