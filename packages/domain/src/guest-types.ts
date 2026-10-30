import type { Actor, MutationContext, Page } from './types.ts';
import type { PdfDownload, VersionMediaPlayback, VersionSlide } from './presentation-types.ts';

export interface ReviewLink {
  id: string; series_id: string; label: string; expires_at: string; download_enabled: boolean;
  revoked_at: string | null; latest_ready_version_id: string | null; row_version: number; created_at: string;
}
export interface ReviewLinkCreated { link: ReviewLink; url: string; token: string }
export interface ReviewLinkCreate { series_id: string; label?: string; expires_at?: string; download_enabled?: boolean }
export interface ReviewLinkPatch { row_version: number; label?: string; expires_at?: string; download_enabled?: boolean }
export interface ReviewLinkListOptions { workspace_id?: string; cursor?: string; limit?: number }
export interface GuestAccess {
  access_token: string; expires_at: string; series_id: string; version_id: string | null;
  download_enabled: boolean; display_name: string | null; guest_session_id: string;
}
export type GuestBrowserAccess = Omit<GuestAccess, 'access_token'>;
/** This is a remembered label, never an authorization identity. */
export interface GuestIdentity { display_name: string; company?: string | null }
export interface ExternalPresentationVersion {
  id: string; series_id: string; version_no: number; title: string; output_type: 'selection' | 'shortlist';
  status: 'ready'; slides: VersionSlide[]; created_at: string; download_enabled: boolean;
  cover: { project_name: string; client_name: string | null; title: string; output_type: 'selection' | 'shortlist'; logo_asset_id: string | null; logo_placement: 'cover' | 'every_slide' };
  template_version: string; template_content_hash: string;
}
export interface FeedbackComment {
  id: string; series_id: string; version_id: string; version_slide_id: string; guest_session_id: string | null;
  author_display_name: string; company: string | null; visibility: 'external' | 'internal'; body: string;
  parent_comment_id: string | null; resolved: boolean; row_version: number; created_at: string; updated_at: string;
}
export interface GuestCommentCreate { version_slide_id: string; body: string; parent_comment_id?: string }
export interface CommentCreate extends GuestCommentCreate { visibility: 'external' | 'internal' }
export interface GuestCommentPatch { row_version: number; body: string }
export interface CommentPatch { row_version: number; body?: string; resolved?: boolean }
export type PreferenceValue = 'preferred' | 'maybe' | 'not_preferred';
export interface FeedbackPreference {
  id: string; version_slide_id: string; guest_session_id: string | null; author_display_name: string;
  value: PreferenceValue; row_version: number; updated_at: string;
}
export interface PreferenceSet { version_slide_id: string; value: PreferenceValue | null; row_version?: number | null }
export interface PreferenceResult { preference: FeedbackPreference | null; cleared: boolean }
export interface Feedback { comments: FeedbackComment[]; preferences: FeedbackPreference[]; version_id: string; page: Page }
export interface FeedbackListOptions { cursor?: string; limit?: number }
export interface PresentationExport {
  id: string; version_id: string; review_link_id: string; template_version: string; export_revision: number;
  status: 'queued' | 'rendering' | 'ready' | 'failed'; pdf_asset_id: string | null; job_id: string;
  created_at: string; ready_at: string | null; failure_code: string | null;
}
export interface ExportPrepare { version_id: string; review_link_id: string }
export interface ExportPreparation { export: PresentationExport; job_id: string | null; cached: boolean }
export type GuestMutationContext = MutationContext & { idempotencyKey: string };
/** Private transport result. It is never included in a JSON response. */
export interface GuestContent {
  body: ReadableStream<Uint8Array>; mimeType: string; size: number; status: 200 | 206;
  contentRange?: string; filename?: string;
}
export interface ReviewLinkOperations {
  listReviewLinks(actor: Actor, options?: ReviewLinkListOptions): Promise<{ data: ReviewLink[]; page: Page }>;
  createReviewLink(actor: Actor, input: ReviewLinkCreate, context: GuestMutationContext): Promise<ReviewLinkCreated>;
  updateReviewLink(actor: Actor, id: string, input: ReviewLinkPatch, context?: GuestMutationContext): Promise<ReviewLink>;
  revokeReviewLink(actor: Actor, id: string, input: { row_version: number }, context: GuestMutationContext): Promise<ReviewLink>;
  rotateReviewLink(actor: Actor, id: string, input: { row_version: number }, context: GuestMutationContext): Promise<ReviewLinkCreated>;
  listFeedback(actor: Actor, versionId: string, options?: FeedbackListOptions): Promise<Feedback>;
  createComment(actor: Actor, versionId: string, input: CommentCreate, context: GuestMutationContext): Promise<FeedbackComment>;
  updateComment(actor: Actor, id: string, input: CommentPatch, context?: GuestMutationContext): Promise<FeedbackComment>;
  setPreference(actor: Actor, versionId: string, input: PreferenceSet, context: GuestMutationContext): Promise<PreferenceResult>;
  preparePdfExport(actor: Actor, input: ExportPrepare, context: GuestMutationContext): Promise<ExportPreparation>;
  getPdfExport(actor: Actor, id: string): Promise<PresentationExport>;
  downloadPdfExport(actor: Actor, id: string): Promise<PdfDownload>;
  getPdfExportContent(actor: Actor, id: string, range?: string | null): Promise<GuestContent>;
}
export interface GuestReviewOperations {
  openReview(token: string): Promise<GuestAccess>;
  getSession(session: string): Promise<GuestAccess>;
  identify(session: string, input: GuestIdentity, context?: GuestMutationContext): Promise<GuestAccess>;
  getCurrentVersion(session: string): Promise<ExternalPresentationVersion | null>;
  getVersion(session: string, id: string): Promise<ExternalPresentationVersion>;
  listFeedback(session: string, versionId: string, options?: FeedbackListOptions): Promise<Feedback>;
  createComment(session: string, versionId: string, input: GuestCommentCreate, context: GuestMutationContext): Promise<FeedbackComment>;
  updateComment(session: string, id: string, input: GuestCommentPatch, context?: GuestMutationContext): Promise<FeedbackComment>;
  setPreference(session: string, versionId: string, input: PreferenceSet, context: GuestMutationContext): Promise<PreferenceResult>;
  preparePdfExport(session: string, versionId: string, context: GuestMutationContext): Promise<ExportPreparation>;
  getPdfExport(session: string, id: string): Promise<PresentationExport>;
  downloadPdfExport(session: string, id: string): Promise<PdfDownload>;
  playMedia(session: string, versionId: string, assetId: string): Promise<VersionMediaPlayback>;
  playGrantMedia(grant: string, versionId: string, assetId: string): Promise<VersionMediaPlayback>;
  getMediaContent(session: string, versionId: string, assetId: string, range?: string | null): Promise<GuestContent>;
  getPdfExportContent(session: string, id: string, range?: string | null): Promise<GuestContent>;
  getGrantMediaContent(grant: string, versionId: string, assetId: string, range?: string | null): Promise<GuestContent>;
}
