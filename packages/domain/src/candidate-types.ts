import type { ListOptions } from './types.ts';
import type { SourceReference } from './specs-types.ts';
import type { EnglishTranscriptStatus } from './english-transcript.ts';

/** Reusable supplied facts. Role requirements and project availability never belong here. */
export interface CandidateFacts {
  name: string | null; casting_id: string | null; age_or_range: string | null; stated_gender: string | null;
  height_measurements: string | null; languages: string[]; accents: string[]; skills_experience: string | null;
  city: string | null; previous_projects_roles: string | null; classification: string | null;
}
export interface CandidateSearchMatch { matched_filter_fields: string[]; unknown_filter_fields: string[] }
export interface Candidate {
  id: string; facts: CandidateFacts; review_status: 'unreviewed' | 'reviewed'; reviewed_at: string | null;
  reviewed_by: string | null; search_match: CandidateSearchMatch | null; possible_duplicate: boolean;
  merged_into_candidate_id: string | null; archived: boolean; row_version: number; created_at: string; updated_at: string;
}
export type CandidateSource = { kind: 'manual'; principal_id: string } | { kind: 'transcript'; source: SourceReference };
export interface StoredCandidate extends Candidate {
  source_kind: 'manual' | 'scan'; field_sources: Record<string, CandidateSource>;
  reviewed_facts_fingerprint: string | null; age_as_of: string | null;
}
export interface CandidateCreate { facts: CandidateFacts; source_asset_ids?: string[] }
export interface CandidatePatch { row_version: number; facts: CandidateFacts }
export interface CandidateConfirmation { row_version: number; confirmation_note?: string | null }
export interface CandidateSearch extends ListOptions {
  include_unknown?: boolean; age_or_range?: string; stated_gender?: string; height_measurements?: string;
  language?: string; accent?: string; skill?: string; city?: string; previous_project_role?: string;
  classification?: string; review_status?: 'unreviewed' | 'reviewed';
  /** A4: facet filters (OR within a facet, AND across); confirmed observations, supplied labels and facts only. */
  facets?: Partial<Record<string, string[]>>; facet_include_unknown?: boolean;
  /** Report the caller's membership in this project for each row. */
  workspace_id?: string;
}
export interface CandidateExtraction {
  schema_version: '1.0'; source_asset_id: string; facts: CandidateFacts; project_availability_statement: string | null;
  evidence: { field_path: string; source: SourceReference }[]; uncertainties: { field_path: string; reason: string }[];
}
export interface CandidateFrame { asset_id: string; source_asset_id: string; timestamp_ms: number; width: number; height: number; quality_flags: string[] }
export type CandidateProcessingIssue = 'NO_AUDIO' | 'TRANSCRIPTION_FAILED' | 'EXTRACTION_FAILED' | 'INSUFFICIENT_FRAMES' | 'FRAME_SELECTION_UNAVAILABLE' | 'ENGLISH_TRANSCRIPT_UNAVAILABLE';
export interface CandidateMedia {
  id: string; candidate_id: string; source_asset_id: string; preview_asset_id: string | null;
  transcript_asset_id: string | null; original_transcript: string | null; languages: string[];
  /** English display only. Missing legacy fields mean not_captured, never raw fallback. */
  english_transcript?: string | null; english_transcript_status?: EnglishTranscriptStatus;
  available_frames: CandidateFrame[]; selected_frame_asset_ids: string[]; processing_issues: CandidateProcessingIssue[]; row_version: number;
}
export interface FrameSelection { row_version: number; selected_frame_asset_ids: string[] }
export interface DuplicateMatch { candidate_id: string; display_name: string | null; match_reasons: string[] }
export type DuplicateResolution = { row_version: number; action: 'keep_new' }
  | { row_version: number; action: 'link_existing'; existing_candidate_id: string; existing_candidate_row_version: number };
/** Focus point as fractions (0..1) of the picture: the only framing preview, PDF and PowerPoint use. */
export interface PortraitCrop { focal_x: number; focal_y: number }
export type PortraitSource = 'frame' | 'photo';
/** unset = legacy row with nothing chosen; pinned = chosen; intentionally_empty = deliberately no picture. */
export type MediaSelectionState = 'unset' | 'pinned' | 'intentionally_empty';
export interface WorkspaceCandidate {
  id: string; workspace_id: string; candidate_id: string; selected_candidate_media_id: string | null;
  selected_frame_asset_ids: string[]; availability: string | null; fresh_material_required: boolean;
  media_confirmed: boolean; internal_notes: string | null;
  /** Project presentation picture. Library edits never change it; there is no Library fallback. */
  portrait_asset_id: string | null; portrait_source: PortraitSource | null; portrait_crop: PortraitCrop | null;
  media_selection_state: MediaSelectionState; row_version: number;
}
/** add_workspace_candidate result: already_member when the person was already in the project. */
export interface WorkspaceCandidateAdded extends WorkspaceCandidate { already_member: boolean }
export interface WorkspaceCandidatePicture {
  portrait_asset_id?: string | null; portrait_source?: PortraitSource | null; portrait_crop?: PortraitCrop | null;
  media_selection_state?: Exclude<MediaSelectionState, 'unset'>;
}
export interface WorkspaceCandidateCreate extends WorkspaceCandidatePicture {
  candidate_id: string; selected_candidate_media_id?: string | null; availability?: string | null; fresh_material_required?: boolean;
}
export interface WorkspaceCandidatePatch extends WorkspaceCandidatePicture {
  row_version: number; selected_candidate_media_id?: string | null; selected_frame_asset_ids?: string[];
  availability?: string | null; fresh_material_required?: boolean; media_confirmed?: boolean; internal_notes?: string | null;
}
/** A Cast Library search row: the profile plus card fields read in the same query. */
export interface LibraryCandidate extends Candidate {
  name_ar: string | null; talent_type: 'talent' | 'real_family' | 'group' | null; tape_count: number;
  portrait_photo: { photo_id: string; asset_id: string; thumb_asset_id: string } | null; portrait_frame_asset_id: string | null;
  processing: boolean; membership: { workspace_candidate_id: string; state: 'in_project' } | null;
}
/** What a candidate scan's save step did, recorded by the server. null = unknown (older job) or not finished. */
export type CandidateScanOutcome = 'created' | 'tape_added' | 'tape_rescanned';
/** Whether the save step added the person to the project. null = unknown (older job) or not finished. */
export type CandidateMembershipOutcome = 'added' | 'already_member' | 'not_requested';
export type CandidateUploadState = 'uploading' | 'processing' | 'ready' | 'needs_attention' | 'failed' | 'cancelled' | 'expired';
export interface CandidateUploadRow {
  upload_id: string; workspace_id: string; asset_id: string; filename: string | null; size_bytes: number; mime_type: string;
  target_candidate_id: string | null; created_at: string; upload_status: 'open' | 'completed' | 'cancelled' | 'expired'; state: CandidateUploadState;
  job: { id: string; status: 'queued' | 'running' | 'waiting_for_input' | 'succeeded' | 'failed' | 'cancelled'; stage: string; error_code: string | null; retryable: boolean; row_version: number; updated_at: string } | null;
  candidate_id: string | null; workspace_candidate_id: string | null;
  candidate_outcome: CandidateScanOutcome | null; membership_outcome: CandidateMembershipOutcome | null;
}
export interface MediaDefaults { selected_candidate_media_id: string | null; selected_frame_asset_ids: string[]; portrait_asset_id: string | null; portrait_source: PortraitSource | null }
export interface MediaRepairSuggestion { workspace_candidate_id: string; candidate_id: string; row_version: number; reason: 'default_available' | 'no_media_available'; suggestion: MediaDefaults | null }
export interface MediaRepairApply { items: { workspace_candidate_id: string; row_version: number }[] }
export interface MediaRepairResult {
  applied: WorkspaceCandidate[];
  skipped: { workspace_candidate_id: string; reason: 'changed' | 'already_chosen' | 'no_media_available' | 'not_found'; current_row_version?: number }[];
}
