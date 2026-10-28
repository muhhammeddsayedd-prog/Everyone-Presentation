export type Environment = 'development' | 'test' | 'staging' | 'production';
export interface Actor { principal_id: string }
export interface MutationContext { idempotencyKey?: string; requestId?: string; clientType?: 'browser' | 'api' | 'mcp' }
export interface Page { next_cursor: string | null }
export interface ListOptions { q?: string; cursor?: string; limit?: number }
export interface Project {
  id: string; name: string; client_id: string | null; client_name: string | null;
  client_logo_asset_id: string | null; row_version: number; client_row_version: number | null;
  casting_workspace_id: string | null; can_edit: boolean;
}
export interface ProjectPatch {
  row_version: number; name?: string; client_name?: string; client_logo_asset_id?: string | null;
  expected_client_row_version?: number | null;
}
export interface Workspace {
  id: string; project_id: string; module: 'casting'; title: string; logo_asset_id: string | null;
  logo_placement: 'cover' | 'every_slide'; active_output: 'selection' | 'shortlist'; row_version: number;
  draft_revision: number; has_unpublished_changes: boolean; created_at: string; updated_at: string;
}
export interface WorkspaceCreate { project_id: string; initial_output: 'selection' | 'shortlist' }
export interface WorkspacePatch { row_version: number; logo_asset_id?: string | null; logo_placement?: 'cover' | 'every_slide'; active_output?: 'selection' | 'shortlist' }
export interface AudiencePreset { id: string; key: string; label: string; scope: 'internal' | 'external'; settings: Record<string, never>; archived: boolean; row_version: number }
export interface AudiencePresetCreate { key?: string; label: string; scope: 'internal' | 'external'; settings: Record<string, never> }
export interface AudiencePresetPatch { row_version: number; label?: string; settings?: Record<string, never> }
export interface UploadSessionCreate { workspace_id?: string; candidate_id?: string; batch_id?: string; purpose: 'client_logo'; filename: string; mime_type: string; size_bytes: number; sha256?: string }
export interface UploadSession {
  id: string; asset_id: string; protocol: 'signed_put'; upload_url: string | null; upload_headers: Record<string, string>;
  expires_at: string; status: 'open' | 'completed' | 'cancelled' | 'expired'; maximum_bytes: number;
}
export interface MediaAsset {
  id: string; purpose: 'client_logo'; filename: string; mime_type: string; size_bytes: number; sha256: string | null;
  status: 'uploading' | 'ready' | 'failed' | 'quarantined' | 'archived'; duration_ms: number | null;
  width: number | null; height: number | null; source_asset_id: string | null; source_timestamp_ms: number | null; created_at: string;
}
export interface CompleteUpload { sha256?: string; actual_size_bytes: number; start_processing: boolean }
export interface UploadCompletion { asset: MediaAsset; processing_job_id: null; status: 'ready' }
export interface LogoDecoded { mimeType: string; width: number; height: number }
export interface StudioOptions {
  dataDir: string; environment: Environment; adapterMode: 'local_fixture'; appBaseUrl?: string;
  decodeLogo?: (bytes: Uint8Array) => Promise<LogoDecoded>;
}

export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;
  readonly retryable: boolean;
  constructor(code: string, message: string, status = 422, details: Record<string, unknown> = {}, retryable = false) {
    super(message);
    this.name = 'DomainError'; this.code = code; this.status = status; this.details = details; this.retryable = retryable;
  }
}
