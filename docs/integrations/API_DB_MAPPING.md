# API-to-data mapping and ownership

**Status:** logical implementation map. These are proposed `eps` fields, not claims about the uninspected cloud database. M00 replaces physical canonical project/client/person names through the discovery adapter without changing API meaning. See `docs/data/DATABASE_SCHEMA.md` and `contracts/openapi.yaml` together.

## Identity and shared records

| API field | Logical source / write rule |
| --- | --- |
| Project.id / client_id | App-facing UUID binding or compatible canonical UUID; never guessed external key |
| Project.name / client_name | Canonical business project/client owner via adapter; authorized writes update that owner |
| Project.client_logo_asset_id | Canonical client branding relation if suitable; adapter establishes ownership |
| Project.row_version / client_row_version | Verified canonical concurrency version; if unavailable, M00 implements compatible version/content fingerprint mechanism |
| Workspace.project_id | `workspaces.project_binding_id` (or direct canonical FK where compatible) |
| Workspace.title | Read-only canonical project display; never a stored project-name override |
| Workspace.active_output | Per-user last output preference; not a shared casting choice, does not advance draft revision |
| Workspace.module | `workspaces.module_type` |
| Workspace.logo_asset_id / logo_placement | Same-named workspace pin; placement `cover` or `every_slide`, null asset means none |
| API `archived` boolean | Derived from `archived_at IS NOT NULL` or the table’s archived lifecycle status |
| API row_version | Logical mutable-row bigint version, serialized as JSON integer within supported safe range |

New source rows do not establish permission by themselves. Validate canonical existence, entity kind and the actor’s central access when creating bindings. Existing central candidate/person fields remain canonical if suitable; an `eps.candidates` extension must not become a competing owner.

## Facts and requirements: retain supplied wording

| API field | Logical storage / projection |
| --- | --- |
| CandidateFacts.name | `candidates.display_name`, or mapped canonical name |
| CandidateFacts.casting_id | Stable `casting_id`; generated if absent on intake; non-null supplied correction must be unique |
| CandidateFacts.age_or_range | Lossless raw `age_or_range`; stated_age_min/max are conservative numeric search projections only |
| CandidateFacts.stated_gender | `gender_stated`, supplied profile data only |
| CandidateFacts.height_measurements | Lossless raw `height_measurements`; height_cm/measurements are validated supplied-value projections |
| CandidateFacts.skills_experience | Lossless raw `skills_experience`; skills[] and experience may support supplied-value search |
| CandidateFacts.previous_projects_roles | Lossless raw `previous_projects_roles`; previous_projects[] supports recorded-value search |
| languages / accents / city / classification | Same semantic owned fields, directly or via canonical mapping |
| Candidate.search_match | Query-only match/missing-filter explanation; not a persisted candidate attribute |
| Role.category | `roles.requirements.classification` |
| Role.requirements.age_range | Lossless raw requirement; age_min/max projections only when explicitly derivable |
| Role.requirements.appearance_performance | Lossless raw combined wording; do not guess a split into unsupported requirements |
| Role.requirements.location | `requirements.shoot_location`; not automatically candidate usual city |
| Role.requirements.availability_requirements | `requirements.availability_requirement` |
| Role.requirements.other_instructions | `requirements.instructions` |
| Role.clarifications | `requirements.clarification_fields` (source-backed structured entries) |
| Spec.source_asset_id / source_text | `specs.source_asset_id` / source text; stable initial source and ordinary corrections |

Null casting ID is an explicit exception to normal null-clears-field semantics: on create it allocates an app-generated display ID; on update it preserves the current stable ID. Candidate UUID, not this display value, is the identity key. If a new scan supplies an already-used casting ID, keep the completed scan under a provisional generated ID, retain the supplied ID in source/evidence metadata and show a possible match. The actor then resolves identity explicitly; do not fail the whole scan or auto-merge.

The projected Reviewed state also compares the saved `reviewed_facts_fingerprint` with the current reusable facts from canonical and extension owners. If another app changes a reusable fact, the profile is Unreviewed until authorized confirmation records the new fingerprint. Project availability, frame choices and template changes do not invalidate fact review. This is review-status consistency, not a conflicting-facts feature.

Do not reconstruct raw facts by concatenating lossy search arrays. Do not calculate birth dates from stated age. `age_as_of` records a known source/observation date with provenance; it does not authorize automatic age changes. Missing facts remain null/empty, not string `Not provided` in canonical storage.

## Media and imports

| API purpose / field | Logical media storage |
| --- | --- |
| specs | asset_kind `spec_document` |
| candidate_video | asset_kind `candidate_video` |
| candidate_support | asset_kind `candidate_support` (supporting docs/images, not automatically selected frames) |
| client_logo | asset_kind `client_logo` |
| audio (read DTO) | asset_kind `audio_derivative` |
| candidate_frame (read DTO) | asset_kind `frame` |
| preview_video / transcript | Same-named derived kinds |
| presentation_pdf | Canonical internal or link-scoped export PDF; business relation distinguishes ownership |
| presentation_manifest / presentation_preview | Fixed manifest/preview derivatives, scoped to version/export |
| document_text / document_page | Document preparation derivatives, scoped to source/job |
| MediaAsset.filename / size_bytes | original_filename / byte_size |
| MediaAsset.source_asset_id / source_timestamp_ms | parent_asset_id / time_offset_ms |
| CandidateMedia.source_asset_id | `candidate_media.video_asset_id` |
| CandidateMedia.preview_asset_id | Pinned derived preview FK |
| CandidateMedia.original_transcript / languages | transcript_original / transcript_languages (array; legacy single language can be normalized) |
| CandidateMedia.available_frames | Query derived from ready frame assets related to that exact video |
| UploadSession | Existing upload table if available, otherwise typed reservation metadata on media asset; signed URLs never persisted there |

Worker `reserve_job_output` is the only path to new derived output destinations. It validates allowed asset_kind for the active stage, parent source relation and byte/type bounds, then creates the asset reservation. `complete_job_output` verifies the uploaded object and marks it ready. Worker `get_job_asset_access` signs only actual input/output assets belonging to its current stage lease. Expired credentials are refreshed through this operation; no general bucket-path signer is exposed.

Library default frame arrays and workspace-selected arrays are independent. Every selected frame must resolve to an actual source video frame; no arbitrary uploaded face image is accepted as a claimed extracted frame. A supporting image remains supporting material unless a later explicitly defined product feature uses it.

## Casting, versions and feedback

| API field | Logical storage / behavior |
| --- | --- |
| WorkspaceCandidate.media_confirmed | Derived from media_confirmed_at/by for current chosen media set |
| WorkspaceCandidate.internal_notes | Project-candidate private notes, never an external field |
| Assignment.internal_notes | Slot-assignment private notes, never printed/external |
| Assignment.slide_wording | Ten-key wording overrides; null removes override and falls back to full source value |
| Assignment.shortlist_included | Explicit boolean; Selection always derives all active assignments |
| PresentationSeries.title | Optional presentation label, not a project/client-name override |
| PresentationSeries.audience_snapshot | Frozen audience_preset_snapshot; presets key/label/scope, no ten-field suppression |
| PresentationVersion.version_no | Logical `version_number`; monotonically allocated under series lock |
| WorkspaceReview.input_fingerprint | Hash of exact current render-relevant shared/canonical records, selections, requirements, branding and template/policy inputs |
| GenerateVersion.expected_input_fingerprint | Compared with recomputation in same consistent snapshot used for capture; detects shared-profile/client changes not reflected in workspace row version |
| VersionSlide.kind | `version_slides.kind`; candidate, cover or pending |
| Feedback version_slide_id | `feedback_comments.slide_id` / `feedback_preferences.slide_id`, immutable version_slides FK |
| Comment.visibility | Internal caller chooses internal/external; guest endpoint fixes external and queries external only |
| GuestAccess.version_id | Latest ready version or null while no ready content exists |
| GuestSession link generation | Captures current review_links.token_generation; rotation invalidates old sessions/grants |
| PresentationExport | `presentation_exports`, separate from fixed canonical version and PDF |
| Grant token | Only digest/verifier in review_media_grants; raw token exists transiently in renderer and privately inside exported PDF |

`get_workspace_review` requires the selected `series_id` so output/audience/template inputs are precisely defined. Create/reuse that series when the producer selects an output/audience for final review; then review and generate use the identical policy snapshot. The immutable manifest includes a content-hash inventory of referenced assets and the template content hash, not just mutable URLs.

A change to any render-relevant source changes the review fingerprint. The generation transaction compares it before capturing content; it returns a stale-review response if different. This is optimistic consistency, not a dedicated fact-conflict feature or a human-only gate. The actor/Claude can read the new review and generate with its new fingerprint.

## Jobs

API `Job.kind` maps to `jobs.job_type`. `attempt` is the displayed monotonic attempt number; `attempt_id` is the opaque current lease/attempt identity used on callbacks. Store `jobs.current_attempt_id` and latest accepted event sequence, plus event attempt/sequence in `job_events`. One active stage lease per job in the initial design. Different jobs/files can run concurrently.

Every stage result is checked against job kind, stage, current attempt, input hash and allowlisted result schema before application. Event replay does not duplicate output/business rows. Terminal cancellation invalidates application by any late callback. `row_version` and input fingerprint guards preserve manual corrections while worker assets remain inspectable for ordinary editing.
