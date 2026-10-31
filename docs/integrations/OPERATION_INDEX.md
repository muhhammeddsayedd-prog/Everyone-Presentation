# API and MCP operation index

`openapi.yaml` owns schemas and paths. The [current implementation matrix](IMPLEMENTATION_PARITY.md) is generated from `contracts/operation-parity.json` and reconciled with the actual composed runtime/catalog by `tools/check_m07_parity.py`. This index is an operation reference, not live service or production acceptance. Internal capability requirements also require current project/library/purpose scope. The media-grant minting HTTP path remains a contract-only service path; actual minting uses the private leased gateway.

| Operation ID | HTTP route (under `/api/v1`) | Capability / audience | MCP |
| --- | --- | --- | --- |
| `get_capabilities` | `GET /capabilities` | workspaces.read | Yes |
| `list_projects` | `GET /projects` | projects.read | Yes |
| `get_project` | `GET /projects/{project_id}` | projects.read | Yes |
| `update_project` | `PATCH /projects/{project_id}` | projects.write | Yes |
| `list_workspaces` | `GET /workspaces` | workspaces.read | Yes |
| `create_workspace` | `POST /workspaces` | workspaces.write | Yes |
| `get_workspace` | `GET /workspaces/{workspace_id}` | workspaces.read | Yes |
| `get_workspace_summary` | `GET /workspaces/{workspace_id}/summary` | workspaces.read; library review count null without cast.read | Yes |
| `update_workspace` | `PATCH /workspaces/{workspace_id}` | workspaces.write | Yes |
| `get_specs` | `GET /workspaces/{workspace_id}/specs` | workspaces.read | Yes |
| `submit_specs` | `POST /workspaces/{workspace_id}/specs` | workspaces.write | Yes |
| `update_specs` | `PATCH /workspaces/{workspace_id}/specs` | workspaces.write | Yes |
| `list_roles` | `GET /workspaces/{workspace_id}/roles` | workspaces.read | Yes |
| `create_role` | `POST /workspaces/{workspace_id}/roles` | workspaces.write | Yes |
| `suggest_candidate_filters` | `GET /roles/{role_id}/candidate-filters` | workspaces.read AND cast.read | Yes |
| `update_role` | `PATCH /roles/{role_id}` | workspaces.write | Yes |
| `archive_role` | `POST /roles/{role_id}/archive` | workspaces.write | Yes |
| `list_slots` | `GET /roles/{role_id}/slots` | workspaces.read | Yes |
| `resize_role_slots` | `POST /roles/{role_id}/slots/resize` | workspaces.write | Yes |
| `update_slot` | `PATCH /slots/{slot_id}` | workspaces.write | Yes |
| `search_candidates` | `GET /candidates` | cast.read | Yes |
| `create_candidate` | `POST /candidates` | cast.write | Yes |
| `get_candidate` | `GET /candidates/{candidate_id}` | cast.read | Yes |
| `update_candidate` | `PATCH /candidates/{candidate_id}` | cast.write | Yes |
| `confirm_candidate_reviewed` | `POST /candidates/{candidate_id}/reviewed` | cast.review | Yes |
| `archive_candidate` | `POST /candidates/{candidate_id}/archive` | cast.write | Yes |
| `get_candidate_media` | `GET /candidates/{candidate_id}/media` | cast.read | Yes |
| `update_candidate_frames` | `PUT /candidate-media/{candidate_media_id}/frames` | cast.write | Yes |
| `extract_candidate_frames` | `POST /candidate-media/{candidate_media_id}/frames/extract` | cast.upload | Yes |
| `list_duplicate_matches` | `GET /candidates/{candidate_id}/duplicates` | cast.read | Yes |
| `resolve_duplicate` | `POST /candidates/{candidate_id}/duplicates/resolve` | cast.write | Yes |
| `create_upload_session` | `POST /uploads` | purpose-specific: cast.upload OR workspaces.write OR projects.write | Yes |
| `get_upload_session` | `GET /uploads/{upload_id}` | purpose-specific: cast.upload OR workspaces.write OR projects.write | Yes |
| `complete_upload` | `POST /uploads/{upload_id}/complete` | purpose-specific: cast.upload OR workspaces.write OR projects.write | Yes |
| `cancel_upload` | `POST /uploads/{upload_id}/cancel` | purpose-specific: cast.upload OR workspaces.write OR projects.write | Yes |
| `get_media` | `GET /media/{asset_id}` | workspaces.read OR cast.read | Yes |
| `get_media_content` | `GET /media/{asset_id}/content` | workspaces.read OR cast.read; actual parent/purpose checked | No; existing authorized binary companion, documented in M07 |
| `play_media` | `POST /media/{asset_id}/playback` | workspaces.read OR cast.read | Yes |
| `list_workspace_candidates` | `GET /workspaces/{workspace_id}/candidates` | workspaces.read | Yes |
| `add_workspace_candidate` | `POST /workspaces/{workspace_id}/candidates` | workspaces.write AND cast.read | Yes |
| `update_workspace_candidate` | `PATCH /workspace-candidates/{workspace_candidate_id}` | workspaces.write | Yes |
| `remove_workspace_candidate` | `POST /workspace-candidates/{workspace_candidate_id}/remove` | workspaces.write | Yes |
| `list_assignments` | `GET /workspaces/{workspace_id}/assignments` | workspaces.read | Yes |
| `create_assignment` | `POST /workspaces/{workspace_id}/assignments` | workspaces.write | Yes |
| `update_assignment` | `PATCH /assignments/{assignment_id}` | workspaces.write | Yes |
| `set_slot_main` | `PUT /slots/{slot_id}/main` | workspaces.write | Yes |
| `undo_slot_main` | `POST /slots/{slot_id}/main/undo` | workspaces.write | Yes |
| `remove_assignment` | `POST /assignments/{assignment_id}/remove` | workspaces.write | Yes |
| `reorder_workspace` | `PUT /workspaces/{workspace_id}/order` | workspaces.write | Yes |
| `get_workspace_review` | `GET /workspaces/{workspace_id}/review` | workspaces.read | Yes |
| `create_ai_suggestion` | `POST /ai-suggestions` | workspaces.write | Yes |
| `get_ai_suggestion` | `GET /ai-suggestions/{suggestion_id}` | workspaces.read | Yes |
| `list_audience_presets` | `GET /audience-presets` | workspaces.read | Yes |
| `create_audience_preset` | `POST /audience-presets` | settings.manage | Yes |
| `update_audience_preset` | `PATCH /audience-presets/{preset_id}` | settings.manage | Yes |
| `archive_audience_preset` | `POST /audience-presets/{preset_id}/archive` | settings.manage | Yes |
| `list_presentation_series` | `GET /presentation-series` | workspaces.read | Yes |
| `create_presentation_series` | `POST /presentation-series` | presentations.generate | Yes |
| `get_presentation_series` | `GET /presentation-series/{series_id}` | workspaces.read | Yes |
| `update_presentation_series` | `PATCH /presentation-series/{series_id}` | presentations.generate | Yes |
| `list_versions` | `GET /presentation-series/{series_id}/versions` | workspaces.read | Yes |
| `generate_version` | `POST /presentation-series/{series_id}/versions` | presentations.generate | Yes |
| `get_version` | `GET /versions/{version_id}` | workspaces.read | Yes |
| `download_version_pdf` | `POST /versions/{version_id}/pdf` | workspaces.read | Yes |
| `list_review_links` | `GET /review-links` | review_links.manage | Yes |
| `create_review_link` | `POST /review-links` | review_links.manage | Yes |
| `update_review_link` | `PATCH /review-links/{review_link_id}` | review_links.manage | Yes |
| `revoke_review_link` | `POST /review-links/{review_link_id}/revoke` | review_links.manage | Yes |
| `rotate_review_link` | `POST /review-links/{review_link_id}/rotate` | review_links.manage | Yes |
| `list_feedback` | `GET /versions/{version_id}/feedback` | workspaces.read | Yes |
| `create_comment` | `POST /versions/{version_id}/comments` | workspaces.write | Yes |
| `update_comment` | `PATCH /comments/{comment_id}` | workspaces.write | Yes |
| `set_preference` | `PUT /versions/{version_id}/preferences` | workspaces.write | Yes |
| `list_jobs` | `GET /jobs` | operations.read OR owning workspace read | Yes |
| `get_job` | `GET /jobs/{job_id}` | operations.read OR owning workspace read | Yes |
| `retry_job` | `POST /jobs/{job_id}/retry` | operations.retry | Yes |
| `cancel_job` | `POST /jobs/{job_id}/cancel` | operations.retry | Yes |
| `get_settings` | `GET /settings` | settings.manage | Yes |
| `update_settings` | `PATCH /settings` | settings.manage | Yes |
| `prepare_pdf_export` | `POST /pdf-exports` | review_links.manage | Yes |
| `get_pdf_export` | `GET /pdf-exports/{export_id}` | review_links.manage | Yes |
| `download_pdf_export` | `POST /pdf-exports/{export_id}/download` | review_links.manage | Yes |
| `guest_open_review` | `POST /review/open` | review-token | No |
| `guest_identify` | `PUT /review/identity` | guest | No |
| `guest_get_current_version` | `GET /review/presentation` | guest | No |
| `guest_get_version` | `GET /review/versions/{version_id}` | guest | No |
| `guest_list_feedback` | `GET /review/versions/{version_id}/feedback` | guest | No |
| `guest_create_comment` | `POST /review/versions/{version_id}/comments` | guest | No |
| `guest_update_comment` | `PATCH /review/comments/{comment_id}` | guest | No |
| `guest_set_preference` | `PUT /review/versions/{version_id}/preferences` | guest | No |
| `guest_prepare_pdf_export` | `POST /review/versions/{version_id}/pdf-exports` | guest | No |
| `guest_get_pdf_export` | `GET /review/pdf-exports/{export_id}` | guest | No |
| `guest_download_pdf_export` | `POST /review/pdf-exports/{export_id}/download` | guest | No |
| `play_review_media` | `POST /review-media/versions/{version_id}/media/{asset_id}/playback` | media-grant | No |
| `guest_play_media` | `POST /review/versions/{version_id}/media/{asset_id}` | guest | No |
| `reserve_job_output` | `POST /internal/jobs/outputs` | service.job-scoped (service-only) | No |
| `complete_job_output` | `POST /internal/jobs/outputs/complete` | service.job-scoped (service-only) | No |
| `get_job_asset_access` | `POST /internal/jobs/assets/access` | service.job-scoped (service-only) | No |
| `mint_review_media_grant` | `POST /internal/pdf-exports/media-grant` | service.job-scoped (service-only) | No |
| `claim_job_stage` | `POST /internal/jobs/claim` | service.job-scoped (service-only) | No |
| `record_job_event` | `POST /internal/jobs/events` | service.job-scoped (service-only) | No |
| `complete_job_stage` | `POST /internal/jobs/complete` | service.job-scoped (service-only) | No |
| `fail_job_stage` | `POST /internal/jobs/fail` | service.job-scoped (service-only) | No |
| `list_candidate_support` | `GET /candidates/{candidate_id}/supporting-files` | cast.read | Yes |
| `archive_candidate_support` | `POST /candidate-support/{candidate_support_id}/archive` | cast.write | Yes |
| `request_workspace_review_fit` | `POST /workspaces/{workspace_id}/review/fit` | workspaces.write | Yes |
| `get_casting_retirement` | `GET /workspaces/{workspace_id}/retirements/{resource_id}` | workspaces.write | Yes |
| `undo_casting_retirement` | `POST /workspaces/{workspace_id}/retirements/{event_id}/undo` | workspaces.write | Yes |
| `play_version_media` | `POST /versions/{version_id}/media/{asset_id}/playback` | workspaces.read | Yes |
| `get_version_media_content` | `GET /versions/{version_id}/media/{asset_id}/content` | workspaces.read | No; binary companion to playback/download |
| `get_version_pdf_content` | `GET /versions/{version_id}/pdf/content` | workspaces.read | No; binary companion to playback/download |
| `guest_get_session` | `GET /review/session` | guest | No; browser resume after initial token removal |
| `get_pdf_export_content` | `GET /pdf-exports/{export_id}/content` | review_links.manage | No; binary companion to export download |
| `guest_get_pdf_export_content` | `GET /review/pdf-exports/{export_id}/content` | guest | No; binary companion to guest export download |
| `guest_get_media_content` | `GET /review/versions/{version_id}/media/{asset_id}/content` | guest | No; request-authorized frame/logo/original byte proxy |
| `get_review_media_content` | `GET /review-media/versions/{version_id}/media/{asset_id}/content` | media-grant | No; fixed-version PDF original byte proxy |
