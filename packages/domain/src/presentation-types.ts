import type { Actor, AudiencePreset, MutationContext, Page } from './types.ts';
import type { AssignmentPosition, CastingOutput } from './casting-types.ts';
import type { RoleRequirements } from './specs-types.ts';
import type { ReviewFields, ReviewFrame, ReviewJobAccepted, TemplateIdentity, WorkspaceReview } from './review-types.ts';

export interface GenerateVersion {
  expected_workspace_row_version: number; expected_draft_revision: number; expected_input_fingerprint: string;
  generation_note?: string | null;
}
export interface VersionSlide {
  id: string; version_id: string; order: number; kind: 'cover' | 'candidate' | 'pending';
  assignment_id: string | null; candidate_id: string | null; role_label: string | null; role_category: string | null; slot_label: string | null;
  position: AssignmentPosition | null; fields: ReviewFields | null; requirements: RoleRequirements | null;
  frame_asset_ids: string[]; video_asset_id: string | null; logo_asset_id: string | null;
}
export interface ManifestAsset {
  asset_id: string; sha256: string; asset_kind: 'client_logo' | 'candidate_frame' | 'candidate_video'; mime_type: string; byte_size: number;
}
export interface FrozenAsset extends ManifestAsset {
  bucket: string; object_key: string; width: number | null; height: number | null; duration_ms: number | null;
  source_asset_id: string | null; timestamp_ms: number | null;
}
export interface FrozenSlide extends VersionSlide {
  role_id: string | null; slot_id: string | null; candidate_media_id: string | null; provisional: boolean;
  review_status: 'reviewed' | 'unreviewed' | null; frames: ReviewFrame[];
}
export interface RenderSnapshot {
  schema_version: '1.0'; hash_protocol: 'eps-cast-canonical-v1';
  version_id: string; series_id: string; workspace_id: string; project_id: string; version_no: number; created_at: string;
  input_workspace_row_version: number; input_draft_revision: number; input_fingerprint: string;
  template: TemplateIdentity & { font_hashes: Record<string, string> };
  render_configuration: { renderer_version: 'everyone-casting-pdf-v1'; application_origin: string };
  audience_snapshot: AudiencePreset; cover: WorkspaceReview['cover']; slides: FrozenSlide[]; asset_inventory: FrozenAsset[];
}
/** Closed published manifest: deliberately excludes private asset destinations. */
export interface PresentationManifest {
  schema_version: '1.0'; version_id: string; series_id: string; output_type: CastingOutput; audience_snapshot: AudiencePreset;
  template_version: string; template_content_hash: string; asset_inventory: ManifestAsset[];
  project_name: string; client_name: string | null; logo_asset_id: string | null; logo_placement: 'cover' | 'every_slide';
  input_draft_revision: number; input_fingerprint: string; slides: VersionSlide[]; created_at: string;
}
export interface PresentationRenderContext {
  cover: WorkspaceReview['cover']; template: TemplateIdentity;
  slide_contexts: { slide_id: string; role_id: string | null; slot_id: string | null; provisional: boolean;
    review_status: 'reviewed' | 'unreviewed' | null; frames: ReviewFrame[] }[];
}
export interface PresentationVersion {
  id: string; series_id: string; version_no: number; status: 'queued' | 'rendering' | 'ready' | 'failed';
  input_draft_revision: number; input_fingerprint: string; template_version: string; manifest_hash: string; slides: VersionSlide[];
  pdf_asset_id: string | null; manifest_asset_id: string | null; created_at: string; ready_at: string | null; generation_job_id: string;
  generated_by: string; failure_code: string | null; render_context: PresentationRenderContext;
}
export interface VersionListOptions { cursor?: string; limit?: number }
export interface PdfDownload { version_id: string; download_url: string; expires_at: string; filename: string; size_bytes: number }
export interface VersionMediaPlayback { asset_id: string; url: string; expires_at: string; mime_type: string; source_version_id: string }
export interface PresentationContent { bytes: Uint8Array; mimeType: string; filename?: string }
export type PresentationMutationContext = MutationContext & { idempotencyKey: string };
export interface PresentationOperations {
  listVersions(actor: Actor, seriesId: string, options?: VersionListOptions): Promise<{ data: PresentationVersion[]; page: Page }>;
  generateVersion(actor: Actor, seriesId: string, input: GenerateVersion, context: PresentationMutationContext): Promise<ReviewJobAccepted>;
  getVersion(actor: Actor, versionId: string): Promise<PresentationVersion>;
  downloadVersionPdf(actor: Actor, versionId: string): Promise<PdfDownload>;
  playVersionMedia(actor: Actor, versionId: string, assetId: string): Promise<VersionMediaPlayback>;
  getVersionMediaContent(actor: Actor, versionId: string, assetId: string): Promise<PresentationContent>;
  getVersionPdfContent(actor: Actor, versionId: string): Promise<PresentationContent>;
}
export interface PresentationChangeSummary {
  has_changes: boolean; added_assignments: number; removed_assignments: number; changed_fields: number; changed_media: number;
  changed_requirements: number; changed_casting: number; order_changed: boolean; branding_changed: boolean; template_changed: boolean; shared_source_changed: boolean;
}
