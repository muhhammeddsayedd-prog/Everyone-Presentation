import type { Actor, AudiencePreset, MutationContext, Page } from './types.ts';
import type { Assignment, AssignmentPosition, CastingOutput, SlideWordingField } from './casting-types.ts';
import type { CandidateFacts } from './candidate-types.ts';
import type { RoleRequirements } from './specs-types.ts';

export interface TemplateIdentity { key: string; version: string; content_sha256: string; font_key: string }
export interface PresentationSeries {
  id: string; workspace_id: string; output_type: CastingOutput; audience_preset_id: string; audience_snapshot: AudiencePreset;
  title: string; latest_ready_version_id: string | null; latest_ready_version_no: number | null; row_version: number; archived: boolean;
  template_key: string; template_version: string; template_content_sha256: string; font_key: string;
}
export interface SeriesCreate { workspace_id: string; output_type: CastingOutput; audience_preset_id: string; title?: string }
export interface SeriesPatch { row_version: number; title?: string; archived?: boolean }
export interface SeriesListOptions { workspace_id?: string; output_type?: CastingOutput; cursor?: string; limit?: number }
export interface ReviewOptions { series_id: string; output_type?: CastingOutput }
export interface ReviewIssue { code: string; severity: 'information' | 'warning' | 'blocking'; entity_id: string | null; field: string | null; message: string; repair_action: string | null }
export type ReviewFields = Record<SlideWordingField, string>;
export interface ReviewFrame { asset_id: string; source_asset_id: string; timestamp_ms: number; width: number; height: number; sha256: string }
export interface ReviewSlide {
  kind: 'candidate' | 'pending'; role_id: string | null; role_name: string; slot_id: string | null; slot_label: string;
  assignment_id: string | null; workspace_candidate_id: string | null; candidate_id: string | null; candidate_media_id: string | null;
  position: AssignmentPosition | null; review_status: 'unreviewed' | 'reviewed' | null;
  assignment_row_version: number | null; workspace_candidate_row_version: number | null; candidate_row_version: number | null;
  requirements: RoleRequirements; provisional: boolean;
  fields: ReviewFields; source_fields: ReviewFields; frames: ReviewFrame[]; video_asset_id: string | null;
}
export interface ReviewFit {
  status: 'unmeasured' | 'measured' | 'failed'; input_fingerprint: string | null; measured_at: string | null;
  overflows: { slide_index: number; field: string; axis: 'horizontal' | 'vertical'; overflow_px: number }[];
  error_code: string | null;
}
export interface WorkspaceReview {
  workspace_id: string; series_id: string; input_fingerprint: string; draft_revision: number; output_type: CastingOutput;
  candidate_slide_count: number; pending_slide_count: number; issues: ReviewIssue[]; can_generate: boolean; unreviewed_candidate_ids: string[];
  template: TemplateIdentity;
  cover: { project_name: string; client_name: string | null; title: string; output_type: CastingOutput; logo_asset_id: string | null; logo_placement: 'cover' | 'every_slide' };
  slides: ReviewSlide[]; fit: ReviewFit;
}
export interface AiSuggestionCreate {
  workspace_id: string; capability: 'slide_shorten' | 'normalize_english' | 'contextual_instruction';
  target_type: 'assignment' | 'role' | 'workspace_candidate' | 'candidate'; target_id: string; target_row_version: number;
  field: string; instruction: string; source_text?: string;
}
export interface AiSuggestion {
  id: string; target_id: string; target_row_version: number; status: 'queued' | 'running' | 'waiting_for_input' | 'succeeded' | 'failed' | 'cancelled';
  suggested_text: string | null; proposed_changes: { field: string; old_value: string | null; new_value: string | null }[];
  warnings: { code: string; message: string; entity_id: string | null }[];
}
export interface ReviewMutationContext extends MutationContext { idempotencyKey: string }
export interface ReviewJobAccepted { job_id: string; resource_id: string; poll_url: string; status: 'queued' | 'running' | 'waiting_for_input' | 'succeeded' | 'failed' | 'cancelled' }
export interface ReviewFitRequest { series_id: string; expected_input_fingerprint: string }
export interface CastingRetirement {
  workspace_id: string; resource_id: string; operation: 'retire_slots' | 'archive_role' | 'remove_workspace_candidate';
  undo_event_id: string; expected_workspace_row_version: number; assignment_ids: string[]; slot_ids: string[];
  main_count: number; shortlist_count: number; can_undo: boolean; unavailable_reason: string | null;
}
export interface CastingRetirementUndo { expected_workspace_row_version: number }
export interface CastingRetirementUndoResult { success: true; affected_ids: string[]; workspace_row_version: number }
export interface ReviewOperations {
  listPresentationSeries(actor: Actor, options?: SeriesListOptions): Promise<{ data: PresentationSeries[]; page: Page }>;
  createPresentationSeries(actor: Actor, input: SeriesCreate, context: ReviewMutationContext): Promise<PresentationSeries>;
  getPresentationSeries(actor: Actor, seriesId: string): Promise<PresentationSeries>;
  updatePresentationSeries(actor: Actor, seriesId: string, input: SeriesPatch, context: ReviewMutationContext): Promise<PresentationSeries>;
  getWorkspaceReview(actor: Actor, workspaceId: string, options: ReviewOptions): Promise<WorkspaceReview>;
  requestWorkspaceReviewFit(actor: Actor, workspaceId: string, input: ReviewFitRequest, context: ReviewMutationContext): Promise<ReviewJobAccepted>;
  createAiSuggestion(actor: Actor, input: AiSuggestionCreate, context: ReviewMutationContext): Promise<ReviewJobAccepted>;
  getAiSuggestion(actor: Actor, suggestionId: string): Promise<AiSuggestion>;
  getCastingRetirement(actor: Actor, workspaceId: string, resourceId: string): Promise<CastingRetirement>;
  undoCastingRetirement(actor: Actor, workspaceId: string, eventId: string, input: CastingRetirementUndo, context: ReviewMutationContext): Promise<CastingRetirementUndoResult>;
}

/** Pure projection oracle from server-loaded scoped data. Authorization and
 * coherent-snapshot fingerprinting remain in the transactional adapter. */
export interface ReviewProjectionInput {
  workspace_id: string; output_type: CastingOutput;
  roles: { id: string; workspace_id: string; name: string; sort_order: number; archived: boolean; requirements?: RoleRequirements }[];
  slots: { id: string; role_id: string; label: string; sort_order: number; archived: boolean; provisional?: boolean }[];
  pool: { id: string; workspace_id: string; candidate_id: string; selected_candidate_media_id: string | null; selected_frame_asset_ids: string[]; availability: string | null; fresh_material_required: boolean; row_version: number }[];
  candidates: { id: string; facts: CandidateFacts; review_status: 'unreviewed' | 'reviewed'; archived: boolean; row_version: number }[];
  assignments: Assignment[];
  media: { id: string; candidate_id: string; source_asset_id: string; frames: ReviewFrame[] }[];
}
