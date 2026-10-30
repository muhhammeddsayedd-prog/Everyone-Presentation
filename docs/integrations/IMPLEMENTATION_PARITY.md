# Implemented operation delivery

Generated from `contracts/operation-parity.json` by `tools/check_m07_parity.py --write-doc`.

**Local source inventory:**86 user operations,86 composed MCP tools and115 OpenAPI operations. Twenty-eight prior non-tool operations remain excluded; the existing shared-media binary companion is the29th. This is source/contract reconciliation, not a real Claude OAuth connection, canonical settings installation, a human M07 journey or production acceptance.

UI groups include writes and the reads/discovery needed to perform them. An operation need not have a separate button. Navigation, local drafts and viewer controls are listed explicitly below.

| Meaningful UI group | Current UI sources |
| --- | --- |
| Acting-user controls and discovery | `apps/web/app/api/session/route.ts`, `apps/web/components/StudioApp.tsx` |
| Select existing project; canonical details; workspace; logo placement/output preference | `apps/web/components/ProjectList.tsx`, `apps/web/components/ProjectDetails.tsx`, `apps/web/components/LogoPanel.tsx`, `apps/web/components/WorkspaceView.tsx` |
| Import/correct specs; create/edit/retire roles and slots | `apps/web/components/SpecsView.tsx`, `apps/web/components/RoleEditor.tsx`, `apps/web/components/RoleSlots.tsx` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `apps/web/components/CastLibraryView.tsx`, `apps/web/components/CandidateDetailView.tsx`, `apps/web/components/RoleFilterSuggestions.tsx`, `apps/web/components/CandidateFrameExtraction.tsx`, `apps/web/components/SupportingFiles.tsx` |
| Acquire/resume/complete/cancel uploads; metadata and original playback | `apps/web/components/LogoPanel.tsx`, `apps/web/components/FileSourceIntake.tsx`, `apps/web/components/CandidateResumableUploads.tsx`, `apps/web/components/CandidateDetailView.tsx` |
| Library reuse; project material/availability/notes; removal | `apps/web/components/WorkspaceCandidatesView.tsx`, `apps/web/components/CastLibraryView.tsx` |
| Assign/edit Option/Backup/Shortlist; atomic Main/Undo; reorder | `apps/web/components/CastingBoard.tsx` |
| Series/output/audience; exact draft review; wording suggestions/fit; retirement Undo | `apps/web/components/WorkspaceReviewView.tsx`, `apps/web/components/CastingRetirementReview.tsx`, `apps/web/components/RetirementUndo.tsx`, `apps/web/components/ReviewSharingView.tsx` |
| Choose/create/edit/archive audience presets | `apps/web/components/SettingsView.tsx`, `apps/web/components/AudiencePresetRow.tsx`, `apps/web/components/WorkspaceReviewView.tsx` |
| Generate/poll/read immutable history; saved PDF/original video | `apps/web/components/WorkspacePresentationView.tsx`, `apps/web/components/PresentationVersionView.tsx`, `apps/web/components/PresentationIndex.tsx` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `apps/web/components/ReviewLinksPanel.tsx`, `apps/web/components/ReviewFeedbackPanel.tsx`, `apps/web/components/ReviewSharingView.tsx` |
| Inspect durable processing; retry/cancel eligible work | `apps/web/components/ProcessingView.tsx`, `apps/web/components/SpecsProcessing.tsx` |
| Read defaults; revision-fenced supported configuration changes | `apps/web/components/SettingsDefaults.tsx`, `apps/web/components/SettingsView.tsx` |

| UI group | Shared operation and service | HTTP under `/api/v1` | MCP |
| --- | --- | --- | --- |
| Acting-user controls and discovery | `get_capabilities` → `getCapabilities` in `packages/central/src/studio.ts` | `GET /capabilities` | `get_capabilities` |
| Select existing project; canonical details; workspace; logo placement/output preference | `list_projects` → `listProjects` in `packages/central/src/studio.ts` | `GET /projects` | `list_projects` |
| Select existing project; canonical details; workspace; logo placement/output preference | `get_project` → `getProject` in `packages/central/src/studio.ts` | `GET /projects/{project_id}` | `get_project` |
| Select existing project; canonical details; workspace; logo placement/output preference | `update_project` → `updateProject` in `packages/central/src/studio.ts` | `PATCH /projects/{project_id}` | `update_project` |
| Select existing project; canonical details; workspace; logo placement/output preference | `list_workspaces` → `listWorkspaces` in `packages/central/src/studio.ts` | `GET /workspaces` | `list_workspaces` |
| Select existing project; canonical details; workspace; logo placement/output preference | `create_workspace` → `createWorkspace` in `packages/central/src/studio.ts` | `POST /workspaces` | `create_workspace` |
| Select existing project; canonical details; workspace; logo placement/output preference | `get_workspace` → `getWorkspace` in `packages/central/src/studio.ts` | `GET /workspaces/{workspace_id}` | `get_workspace` |
| Select existing project; canonical details; workspace; logo placement/output preference | `update_workspace` → `updateWorkspace` in `packages/central/src/studio.ts` | `PATCH /workspaces/{workspace_id}` | `update_workspace` |
| Import/correct specs; create/edit/retire roles and slots | `get_specs` → `getSpecs` in `packages/central/src/specs.ts` | `GET /workspaces/{workspace_id}/specs` | `get_specs` |
| Import/correct specs; create/edit/retire roles and slots | `submit_specs` → `submitSpecs` in `packages/central/src/specs.ts` | `POST /workspaces/{workspace_id}/specs` | `submit_specs` |
| Import/correct specs; create/edit/retire roles and slots | `update_specs` → `updateSpecs` in `packages/central/src/specs.ts` | `PATCH /workspaces/{workspace_id}/specs` | `update_specs` |
| Import/correct specs; create/edit/retire roles and slots | `list_roles` → `listRoles` in `packages/central/src/specs.ts` | `GET /workspaces/{workspace_id}/roles` | `list_roles` |
| Import/correct specs; create/edit/retire roles and slots | `create_role` → `createRole` in `packages/central/src/specs.ts` | `POST /workspaces/{workspace_id}/roles` | `create_role` |
| Import/correct specs; create/edit/retire roles and slots | `update_role` → `updateRole` in `packages/central/src/specs.ts` | `PATCH /roles/{role_id}` | `update_role` |
| Import/correct specs; create/edit/retire roles and slots | `archive_role` → `archiveRole` in `packages/central/src/specs.ts` | `POST /roles/{role_id}/archive` | `archive_role` |
| Import/correct specs; create/edit/retire roles and slots | `list_slots` → `listSlots` in `packages/central/src/specs.ts` | `GET /roles/{role_id}/slots` | `list_slots` |
| Import/correct specs; create/edit/retire roles and slots | `resize_role_slots` → `resizeRoleSlots` in `packages/central/src/specs.ts` | `POST /roles/{role_id}/slots/resize` | `resize_role_slots` |
| Import/correct specs; create/edit/retire roles and slots | `update_slot` → `updateSlot` in `packages/central/src/specs.ts` | `PATCH /slots/{slot_id}` | `update_slot` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `search_candidates` → `searchCandidates` in `packages/central/src/candidates.ts` | `GET /candidates` | `search_candidates` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `create_candidate` → `createCandidate` in `packages/central/src/candidates.ts` | `POST /candidates` | `create_candidate` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `get_candidate` → `getCandidate` in `packages/central/src/candidates.ts` | `GET /candidates/{candidate_id}` | `get_candidate` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `update_candidate` → `updateCandidate` in `packages/central/src/candidates.ts` | `PATCH /candidates/{candidate_id}` | `update_candidate` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `confirm_candidate_reviewed` → `confirmCandidateReviewed` in `packages/central/src/candidates.ts` | `POST /candidates/{candidate_id}/reviewed` | `confirm_candidate_reviewed` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `archive_candidate` → `archiveCandidate` in `packages/central/src/candidates.ts` | `POST /candidates/{candidate_id}/archive` | `archive_candidate` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `get_candidate_media` → `getCandidateMedia` in `packages/central/src/candidates.ts` | `GET /candidates/{candidate_id}/media` | `get_candidate_media` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `update_candidate_frames` → `updateCandidateFrames` in `packages/central/src/candidates.ts` | `PUT /candidate-media/{candidate_media_id}/frames` | `update_candidate_frames` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `list_duplicate_matches` → `findCandidateDuplicates` in `packages/central/src/candidates.ts` | `GET /candidates/{candidate_id}/duplicates` | `list_duplicate_matches` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `resolve_duplicate` → `resolveCandidateDuplicate` in `packages/central/src/candidates.ts` | `POST /candidates/{candidate_id}/duplicates/resolve` | `resolve_duplicate` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `suggest_candidate_filters` → `suggestCandidateFilters` in `packages/central/src/candidate-filters.ts` | `GET /roles/{role_id}/candidate-filters` | `suggest_candidate_filters` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `extract_candidate_frames` → `extractCandidateFrames` in `packages/central/src/candidate-frame-extraction.ts` | `POST /candidate-media/{candidate_media_id}/frames/extract` | `extract_candidate_frames` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `list_candidate_support` → `listCandidateSupport` in `packages/central/src/candidate-support.ts` | `GET /candidates/{candidate_id}/supporting-files` | `list_candidate_support` |
| Search/supplied facts/Reviewed; actual frames; duplicates; support files | `archive_candidate_support` → `archiveCandidateSupport` in `packages/central/src/candidate-support.ts` | `POST /candidate-support/{candidate_support_id}/archive` | `archive_candidate_support` |
| Acquire/resume/complete/cancel uploads; metadata and original playback | `create_upload_session` → `createUploadSession` in `packages/central/src/studio.ts` | `POST /uploads` | `create_upload_session` |
| Acquire/resume/complete/cancel uploads; metadata and original playback | `get_upload_session` → `getUploadSession` in `packages/central/src/studio.ts` | `GET /uploads/{upload_id}` | `get_upload_session` |
| Acquire/resume/complete/cancel uploads; metadata and original playback | `complete_upload` → `completeUpload` in `packages/central/src/studio.ts` | `POST /uploads/{upload_id}/complete` | `complete_upload` |
| Acquire/resume/complete/cancel uploads; metadata and original playback | `cancel_upload` → `cancelUpload` in `packages/central/src/studio.ts` | `POST /uploads/{upload_id}/cancel` | `cancel_upload` |
| Acquire/resume/complete/cancel uploads; metadata and original playback | `get_media` → `getMedia` in `packages/central/src/studio.ts` | `GET /media/{asset_id}` | `get_media` |
| Acquire/resume/complete/cancel uploads; metadata and original playback | `play_media` → `playMedia` in `packages/central/src/studio.ts` | `POST /media/{asset_id}/playback` | `play_media` |
| Library reuse; project material/availability/notes; removal | `list_workspace_candidates` → `listWorkspaceCandidates` in `packages/central/src/candidates.ts` | `GET /workspaces/{workspace_id}/candidates` | `list_workspace_candidates` |
| Library reuse; project material/availability/notes; removal | `add_workspace_candidate` → `addWorkspaceCandidate` in `packages/central/src/candidates.ts` | `POST /workspaces/{workspace_id}/candidates` | `add_workspace_candidate` |
| Library reuse; project material/availability/notes; removal | `update_workspace_candidate` → `updateWorkspaceCandidate` in `packages/central/src/candidates.ts` | `PATCH /workspace-candidates/{workspace_candidate_id}` | `update_workspace_candidate` |
| Library reuse; project material/availability/notes; removal | `remove_workspace_candidate` → `removeWorkspaceCandidate` in `packages/central/src/candidates.ts` | `POST /workspace-candidates/{workspace_candidate_id}/remove` | `remove_workspace_candidate` |
| Assign/edit Option/Backup/Shortlist; atomic Main/Undo; reorder | `list_assignments` → `listAssignments` in `packages/central/src/casting.ts` | `GET /workspaces/{workspace_id}/assignments` | `list_assignments` |
| Assign/edit Option/Backup/Shortlist; atomic Main/Undo; reorder | `create_assignment` → `createAssignment` in `packages/central/src/casting.ts` | `POST /workspaces/{workspace_id}/assignments` | `create_assignment` |
| Assign/edit Option/Backup/Shortlist; atomic Main/Undo; reorder | `update_assignment` → `updateAssignment` in `packages/central/src/casting.ts` | `PATCH /assignments/{assignment_id}` | `update_assignment` |
| Assign/edit Option/Backup/Shortlist; atomic Main/Undo; reorder | `set_slot_main` → `setSlotMain` in `packages/central/src/casting.ts` | `PUT /slots/{slot_id}/main` | `set_slot_main` |
| Assign/edit Option/Backup/Shortlist; atomic Main/Undo; reorder | `undo_slot_main` → `undoSlotMain` in `packages/central/src/casting.ts` | `POST /slots/{slot_id}/main/undo` | `undo_slot_main` |
| Assign/edit Option/Backup/Shortlist; atomic Main/Undo; reorder | `remove_assignment` → `removeAssignment` in `packages/central/src/casting.ts` | `POST /assignments/{assignment_id}/remove` | `remove_assignment` |
| Assign/edit Option/Backup/Shortlist; atomic Main/Undo; reorder | `reorder_workspace` → `reorderWorkspace` in `packages/central/src/casting.ts` | `PUT /workspaces/{workspace_id}/order` | `reorder_workspace` |
| Series/output/audience; exact draft review; wording suggestions/fit; retirement Undo | `list_presentation_series` → `listPresentationSeries` in `packages/central/src/review.ts` | `GET /presentation-series` | `list_presentation_series` |
| Series/output/audience; exact draft review; wording suggestions/fit; retirement Undo | `create_presentation_series` → `createPresentationSeries` in `packages/central/src/review.ts` | `POST /presentation-series` | `create_presentation_series` |
| Series/output/audience; exact draft review; wording suggestions/fit; retirement Undo | `get_presentation_series` → `getPresentationSeries` in `packages/central/src/review.ts` | `GET /presentation-series/{series_id}` | `get_presentation_series` |
| Series/output/audience; exact draft review; wording suggestions/fit; retirement Undo | `update_presentation_series` → `updatePresentationSeries` in `packages/central/src/review.ts` | `PATCH /presentation-series/{series_id}` | `update_presentation_series` |
| Series/output/audience; exact draft review; wording suggestions/fit; retirement Undo | `get_workspace_review` → `getWorkspaceReview` in `packages/central/src/review.ts` | `GET /workspaces/{workspace_id}/review` | `get_workspace_review` |
| Series/output/audience; exact draft review; wording suggestions/fit; retirement Undo | `create_ai_suggestion` → `createAiSuggestion` in `packages/central/src/review.ts` | `POST /ai-suggestions` | `create_ai_suggestion` |
| Series/output/audience; exact draft review; wording suggestions/fit; retirement Undo | `get_ai_suggestion` → `getAiSuggestion` in `packages/central/src/review.ts` | `GET /ai-suggestions/{suggestion_id}` | `get_ai_suggestion` |
| Series/output/audience; exact draft review; wording suggestions/fit; retirement Undo | `request_workspace_review_fit` → `requestWorkspaceReviewFit` in `packages/central/src/review.ts` | `POST /workspaces/{workspace_id}/review/fit` | `request_workspace_review_fit` |
| Series/output/audience; exact draft review; wording suggestions/fit; retirement Undo | `get_casting_retirement` → `getCastingRetirement` in `packages/central/src/review.ts` | `GET /workspaces/{workspace_id}/retirements/{resource_id}` | `get_casting_retirement` |
| Series/output/audience; exact draft review; wording suggestions/fit; retirement Undo | `undo_casting_retirement` → `undoCastingRetirement` in `packages/central/src/review.ts` | `POST /workspaces/{workspace_id}/retirements/{event_id}/undo` | `undo_casting_retirement` |
| Choose/create/edit/archive audience presets | `list_audience_presets` → `listAudiencePresets` in `packages/central/src/studio.ts` | `GET /audience-presets` | `list_audience_presets` |
| Choose/create/edit/archive audience presets | `create_audience_preset` → `createAudiencePreset` in `packages/central/src/studio.ts` | `POST /audience-presets` | `create_audience_preset` |
| Choose/create/edit/archive audience presets | `update_audience_preset` → `updateAudiencePreset` in `packages/central/src/studio.ts` | `PATCH /audience-presets/{preset_id}` | `update_audience_preset` |
| Choose/create/edit/archive audience presets | `archive_audience_preset` → `archiveAudiencePreset` in `packages/central/src/studio.ts` | `POST /audience-presets/{preset_id}/archive` | `archive_audience_preset` |
| Generate/poll/read immutable history; saved PDF/original video | `list_versions` → `listVersions` in `packages/central/src/presentation.ts` | `GET /presentation-series/{series_id}/versions` | `list_versions` |
| Generate/poll/read immutable history; saved PDF/original video | `generate_version` → `generateVersion` in `packages/central/src/presentation.ts` | `POST /presentation-series/{series_id}/versions` | `generate_version` |
| Generate/poll/read immutable history; saved PDF/original video | `get_version` → `getVersion` in `packages/central/src/presentation.ts` | `GET /versions/{version_id}` | `get_version` |
| Generate/poll/read immutable history; saved PDF/original video | `download_version_pdf` → `downloadVersionPdf` in `packages/central/src/presentation.ts` | `POST /versions/{version_id}/pdf` | `download_version_pdf` |
| Generate/poll/read immutable history; saved PDF/original video | `play_version_media` → `playVersionMedia` in `packages/central/src/presentation.ts` | `POST /versions/{version_id}/media/{asset_id}/playback` | `play_version_media` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `list_review_links` → `listReviewLinks` in `packages/central/src/guest-reviews.ts` | `GET /review-links` | `list_review_links` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `create_review_link` → `createReviewLink` in `packages/central/src/guest-reviews.ts` | `POST /review-links` | `create_review_link` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `update_review_link` → `updateReviewLink` in `packages/central/src/guest-reviews.ts` | `PATCH /review-links/{review_link_id}` | `update_review_link` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `revoke_review_link` → `revokeReviewLink` in `packages/central/src/guest-reviews.ts` | `POST /review-links/{review_link_id}/revoke` | `revoke_review_link` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `rotate_review_link` → `rotateReviewLink` in `packages/central/src/guest-reviews.ts` | `POST /review-links/{review_link_id}/rotate` | `rotate_review_link` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `list_feedback` → `listFeedback` in `packages/central/src/guest-reviews.ts` | `GET /versions/{version_id}/feedback` | `list_feedback` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `create_comment` → `createComment` in `packages/central/src/guest-reviews.ts` | `POST /versions/{version_id}/comments` | `create_comment` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `update_comment` → `updateComment` in `packages/central/src/guest-reviews.ts` | `PATCH /comments/{comment_id}` | `update_comment` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `set_preference` → `setPreference` in `packages/central/src/guest-reviews.ts` | `PUT /versions/{version_id}/preferences` | `set_preference` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `prepare_pdf_export` → `preparePdfExport` in `packages/central/src/guest-reviews.ts` | `POST /pdf-exports` | `prepare_pdf_export` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `get_pdf_export` → `getPdfExport` in `packages/central/src/guest-reviews.ts` | `GET /pdf-exports/{export_id}` | `get_pdf_export` |
| Create/extend/toggle/revoke/rotate links; feedback; link-scoped PDF exports | `download_pdf_export` → `downloadPdfExport` in `packages/central/src/guest-reviews.ts` | `POST /pdf-exports/{export_id}/download` | `download_pdf_export` |
| Inspect durable processing; retry/cancel eligible work | `list_jobs` → `listJobs` in `packages/central/src/jobs.ts` | `GET /jobs` | `list_jobs` |
| Inspect durable processing; retry/cancel eligible work | `get_job` → `getJob` in `packages/central/src/jobs.ts` | `GET /jobs/{job_id}` | `get_job` |
| Inspect durable processing; retry/cancel eligible work | `retry_job` → `retryJob` in `packages/central/src/jobs.ts` | `POST /jobs/{job_id}/retry` | `retry_job` |
| Inspect durable processing; retry/cancel eligible work | `cancel_job` → `cancelJob` in `packages/central/src/jobs.ts` | `POST /jobs/{job_id}/cancel` | `cancel_job` |
| Read defaults; revision-fenced supported configuration changes | `get_settings` → `getSettings` in `packages/central/src/settings.ts` | `GET /settings` | `get_settings` |
| Read defaults; revision-fenced supported configuration changes | `update_settings` → `updateSettings` in `packages/central/src/settings.ts` | `PATCH /settings` | `update_settings` |

## Explicit non-tool boundaries

| Operation | HTTP contract | Actual mechanism / exclusion |
| --- | --- | --- |
| `guest_open_review` | `POST /review/open` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `guest_identify` | `PUT /review/identity` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `guest_get_current_version` | `GET /review/presentation` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `guest_get_version` | `GET /review/versions/{version_id}` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `guest_list_feedback` | `GET /review/versions/{version_id}/feedback` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `guest_create_comment` | `POST /review/versions/{version_id}/comments` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `guest_update_comment` | `PATCH /review/comments/{comment_id}` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `guest_set_preference` | `PUT /review/versions/{version_id}/preferences` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `guest_prepare_pdf_export` | `POST /review/versions/{version_id}/pdf-exports` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `guest_get_pdf_export` | `GET /review/pdf-exports/{export_id}` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `guest_download_pdf_export` | `POST /review/pdf-exports/{export_id}/download` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `play_review_media` | `POST /review-media/versions/{version_id}/media/{asset_id}/playback` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `guest_play_media` | `POST /review/versions/{version_id}/media/{asset_id}` | external_review_or_pdf_grant_identity: External audience/session or saved-PDF grant scope, intentionally separate from delegated internal users. |
| `reserve_job_output` | `POST /internal/jobs/outputs` | local_service_http_and_private_gateway: Separate verified service credential and current job-stage lease; loopback development/test handler. |
| `complete_job_output` | `POST /internal/jobs/outputs/complete` | local_service_http_and_private_gateway: Separate verified service credential and current job-stage lease; loopback development/test handler. |
| `get_job_asset_access` | `POST /internal/jobs/assets/access` | local_service_http_and_private_gateway: Separate verified service credential and current job-stage lease; loopback development/test handler. |
| `mint_review_media_grant` | `POST /internal/pdf-exports/media-grant` | gateway_only_no_next_http_handler: Private active-export lease; ordinary acting-user and guest tools cannot mint grants. |
| `claim_job_stage` | `POST /internal/jobs/claim` | local_service_http_and_private_gateway: Separate verified service credential and current job-stage lease; loopback development/test handler. |
| `record_job_event` | `POST /internal/jobs/events` | local_service_http_and_private_gateway: Separate verified service credential and current job-stage lease; loopback development/test handler. |
| `complete_job_stage` | `POST /internal/jobs/complete` | local_service_http_and_private_gateway: Separate verified service credential and current job-stage lease; loopback development/test handler. |
| `fail_job_stage` | `POST /internal/jobs/fail` | local_service_http_and_private_gateway: Separate verified service credential and current job-stage lease; loopback development/test handler. |
| `get_version_media_content` | `GET /versions/{version_id}/media/{asset_id}/content` | authorized_binary_companion: Bytes are transferred separately under the same parent authorization; no JSON/base64 user tool. |
| `get_version_pdf_content` | `GET /versions/{version_id}/pdf/content` | authorized_binary_companion: Bytes are transferred separately under the same parent authorization; no JSON/base64 user tool. |
| `guest_get_session` | `GET /review/session` | guest_browser_resume: Cookie-selected external context; internal agents do not impersonate anonymous reviewers. |
| `get_pdf_export_content` | `GET /pdf-exports/{export_id}/content` | authorized_binary_companion: Bytes are transferred separately under the same parent authorization; no JSON/base64 user tool. |
| `guest_get_pdf_export_content` | `GET /review/pdf-exports/{export_id}/content` | authorized_binary_companion: Bytes are transferred separately under the same parent authorization; no JSON/base64 user tool. |
| `guest_get_media_content` | `GET /review/versions/{version_id}/media/{asset_id}/content` | authorized_binary_companion: Bytes are transferred separately under the same parent authorization; no JSON/base64 user tool. |
| `get_review_media_content` | `GET /review-media/versions/{version_id}/media/{asset_id}/content` | authorized_binary_companion: Bytes are transferred separately under the same parent authorization; no JSON/base64 user tool. |
| `get_media_content` | `GET /media/{asset_id}/content` | authorized_binary_companion: Bytes are transferred separately under the same parent authorization; no JSON/base64 user tool. |

## Local UI and identity exceptions

- App navigation, expand/collapse, local frame/slide carousel position, unsaved form edits/discard and focus are local presentation state; their saved data/resources use the mapped read/write operations.
- Search/filter edits use query parameters on existing list operations; paginating is the same operation with its returned cursor.
- Authentication/sign-out and OAuth consent are identity protocol flows, not ordinary business tools. Delegated MCP identity has its separate protocol; no human-only business approval gate is introduced.
- Discovery/metadata and series maintenance tools may support a UI workflow without having a dedicated visible button. Browser authority originates through the session adapter; get_capabilities is its API/MCP discovery equivalent.

## Evidence and remaining acceptance

Candidate cursor/envelope/key reconciliation and24 controlled module cases are recorded in [candidate parity](../../development/m07/CANDIDATE_PARITY.md). Ten controlled desktop cases, later root-owned Settings/auth desktop cases and older MCP fixtures have separate scopes; their counts overlap other gates and must not be summed.

Fresh capability/delegation checks and strict success validation are implemented. Full real-service delegated client journeys, OAuth issuer configuration, live token revocation and end-to-end byte transfer remain unverified. Synthetic installed-client compatibility and actual canonical Settings/session RPC installation have separate dated evidence in the M07 acceptance matrix; this source checker does not prove them. Job-service HTTP remains loopback development/test only. Media-grant minting uses the leased private gateway; its documented HTTP path has no Next handler.

AT-072 manual screen-reader acceptance and broader M03 labelled English/mixed semantic evaluation remain pending. Mobile is skipped by owner instruction. Hosting is deferred. Use the [client runbook](../../development/m07/API_CLIENT_RUNBOOK.md) for current development origins and transfer protocols; no token values appear in it.
