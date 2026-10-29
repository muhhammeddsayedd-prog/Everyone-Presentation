# Application API contract

**Contract:** `contracts/openapi.yaml`, version `1.0.0-design`. **Status:** specified, not deployed. All routes are under `/api/v1`. `OPERATION_INDEX.md` lists the complete operation surface; `MCP_INTEGRATION.md` maps the internal operations to Claude tools. Physical database mappings are established during M00; transport semantics are shared by the browser, API clients and MCP adapter.

## 1. One domain service, several callers

Put authorization, validation and transactional rules in `packages/domain` (or an equivalent clearly separated service layer), not in React components, n8n expressions, or individual MCP handlers. Next.js Route Handlers are transport adapters. UI server actions, if used, invoke those same operations. The worker and n8n callbacks commit results through narrow internal operations; neither receives a general “execute arbitrary SQL” endpoint.

The API is built alongside every feature milestone. M07 finishes OAuth/MCP client integration, complete external documentation and parity testing; it does not postpone domain APIs until the UI is finished.

The OpenAPI contract is the source for generated types and contract tests. It is a design baseline rather than a guarantee that any endpoint currently exists. On implementation changes, update it and the MCP catalog in the same commit, preserve the BR rules, and log consequential decisions.

## 2. Identity, authorization and scope

| Caller | Authentication | Additional authorization |
| --- | --- | --- |
| Internal browser | Existing Everyone identity integration discovered in M00; verified server session/access token | Required capability plus project access, or approved shared-library access |
| Direct API / Claude | Access token for the acting user; MCP OAuth resource audience validated | Identical domain permissions to browser; no agent-only human approval gate |
| External reviewer | Bearer link exchanged for short-lived `X-Review-Session` / secure browser session | One live link, one immutable audience-scoped series, permitted ready versions/media/feedback only |
| n8n / worker | Separate verified service credential plus current job stage lease | Only allowed stage, input resources, output prefix and callbacks for that job |

Guest access is intentionally bearer access without sign-in. A typed display name is attribution, not identity verification. Session ownership prevents one guest from editing another guest’s response, but cannot prove the name is true. Internal auth must not accidentally grant guests Cast Library access through reused serializers.

Every query that loads an assignment, slot, candidate media, comment or version checks its actual parent scope. A caller cannot supply an authorized workspace ID beside an unauthorized child ID to bypass access. Return a scoped 404 where revealing existence would expose another project. Download/media issuance repeats authorization; an earlier list response is not a permanent grant.

M00 maps capability names to actual Everyone roles. The required capabilities in the OpenAPI `x-capability` metadata are effective checks, not arbitrary role strings accepted from the request. `cast.review` belongs to producers/designated casting editors. Claude can exercise it when its acting user has it.

## 3. Request and response conventions

- IDs are opaque strings externally, backed by app UUIDs and discovered canonical mappings. Do not parse a project ID to determine tenancy, permission or human-readable code.
- JSON uses `snake_case`. Timestamps are UTC ISO 8601; the UI renders Africa/Cairo by default or the user’s configured timezone.
- Successful JSON responses include `request_id`, typed `data`, and optional `warnings`. Lists include `page.next_cursor`; clients stop when it is null. Default page size 25, maximum 100 is an implementation default, not the 200-video batch sizing target.
- Missing facts are null/empty arrays in data; `Not provided` is a rendered slide value. “Needs clarification,” profile Reviewed, casting Main and reviewer Preferred are separate fields/states.
- Use stable machine error codes. Shape: `{request_id, error: {code, message, details, retryable}}`.
- Never send API keys, Supabase service credentials, raw bearer review tokens, private storage object credentials, or transcript bodies in analytics/error logs.

Illustrative error (not an observed failure):

```json
{
  "request_id": "req_demo_001",
  "error": {
    "code": "STALE_RESOURCE_VERSION",
    "message": "This slot changed. Reload its current choices and retry.",
    "details": {"resource_type": "slot", "current_row_version": 8},
    "retryable": false
  }
}
```

### Standard error classes

| HTTP | Typical code | Caller action |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Fix malformed JSON/parameter |
| 401 | `AUTH_REQUIRED`, `REVIEW_TOKEN_INVALID` | Authenticate or obtain valid review link/session |
| 403 | `CAPABILITY_REQUIRED`, `PDF_DOWNLOAD_DISABLED` | Respect scope; do not retry as privileged service |
| 404 | `RESOURCE_NOT_FOUND` | Refresh scoped list; do not probe other IDs |
| 409 | `STALE_RESOURCE_VERSION`, `IDEMPOTENCY_KEY_REUSED`, `SLOT_MAIN_CONFLICT`, `ACTIVE_ASSIGNMENT_EXISTS` | Read current resource or use intended transactional operation |
| 422 | `SOURCE_UNREADABLE`, `FRAME_NOT_FROM_SOURCE`, `TEXT_OVERFLOW`, `EXPLICIT_RETIREMENT_REQUIRED` | Correct source/wording/selection; no blind retry |
| 429 | `RATE_LIMITED` | Honor `Retry-After`; bounded backoff |
| 503 | `DEPENDENCY_UNAVAILABLE` | Retry if marked retryable; retain job state |

Missing values and Pending slots are not `422` errors. `TEXT_OVERFLOW` concerns actual template fit after the explicit final-review warning, not absence of information.

## 4. Concurrency and idempotency

Mutations of existing records require the last observed `row_version`. The backend compares and increments it atomically. A stale write returns 409 without losing the other edit. HTTP requests must not trust client-supplied principal, owner, `reviewed_by`, source binding or published-version pointers.

Creates, upload completion, generation, assignment-position changes, Main changes and processing retries require `Idempotency-Key`. Scope records by acting identity + operation + key; hash the canonical request body and relevant path. Replay with the same request returns its original successful response/resource IDs. The same key with another body returns 409. Claim a key transactionally so simultaneous requests cannot create duplicates. Expired key cleanup must never cause a still-running generation to be duplicated; retain the resource linkage through the job lifecycle.

A generation captures the expected workspace `row_version`, `draft_revision` and `expected_input_fingerprint` returned by review. Recompute the fingerprint over render-relevant shared candidate/client/project facts, requirements, chosen media, branding, template and audience policy in the same consistent read snapshot used for capture. This catches shared-record updates made elsewhere even when the workspace row version did not change. Snapshot construction either succeeds consistently or returns stale-state feedback. Network loss after accepting generation is recovered by replaying the same key and polling the returned job. Do not create a fresh version on every poll.

Responses containing a newly created/rotated bearer link secret must be replayable without storing its plaintext in general logs. Store only its verifier for authentication and an encrypted, short-lived idempotency response where replay requires the original secret; restrict decryption to the link service. Token rotation invalidates prior sessions by link token generation, not merely by changing a URL in the UI.

## 5. Exact business mutations

### Projects, clients and branding

`Workspace.title` is a read-only canonical project display value; it is not a presentation-only project-name override. `Workspace.active_output` is the acting user’s last selected output, resolved through per-user preferences; changing it does not change another user’s tab or advance the presentation draft. `create_workspace` accepts an existing authorized central project ID. It creates or returns the connected Casting workspace; no provisional local project is invented. `update_project` writes the canonical fields through the discovered adapter. Where it touches a client name/logo, it also compares the client version and requires the caller’s central-client write permission. If a canonical table lacks integer row versions, M00 must implement a compatible concurrency token/version mapping rather than overwrite without a check.

`logo_asset_id` on a workspace pins the logo used for new presentations. `logo_placement` is `cover` or `every_slide`; a null logo asset means no logo. The shared client-logo record and workspace pin are distinct. Existing generated versions retain the captured asset. Preserve alpha/aspect ratio; only verified image assets qualify.

### Specs, roles and slots

`submit_specs` accepts exactly one source asset or text payload. It extracts the initial stable specs; it is not a revision-management endpoint. Normal corrections use `update_specs` and role operations. The producer can proceed while clarification items remain.

`create_role` and `resize_role_slots` generate individual slots. Increasing count appends stable new slots. Decreasing a role with assigned slots requires explicit `retire_slot_ids`; a backend transaction retires chosen slots and live assignments while preserving history. Repeated scene references do not multiply headcount. Slot labels may be edited independently from role name.

### Cast, source media and duplicates

`suggest_candidate_filters` deterministically transforms explicit role requirements into editable library filters. It does not rank suitability. `include_unknown=true` permits missing structured-filter values alongside positive matches but labels them as unknown in `search_match`; it never treats missing as confirmed qualification. Known contradictory values still fail the filter. This setting does not bypass free-text `q`. Do not infer usual city from shoot location, or a candidate’s age from the role’s age range.

`create_upload_session` authorizes its declared purpose: candidate media requires `cast.upload`; specs requires workspace write; shared client logo requires project/client write; real frame replacements are extracted from the selected video through the frame-extraction operation, not accepted as arbitrary uploaded candidate imagery. The application chooses the storage key and permitted byte/type bounds. The caller does not select arbitrary bucket/object destinations.

The bytes go directly to private Storage through a scoped resumable/signed transfer. `complete_upload` verifies size, type and storage existence and returns `UploadCompletion` with `processing_job_id` when processing is queued. A logo or supporting file can be ready with no asynchronous scan job. Never report a fictional job simply to standardize the UI. An uploaded specs asset is subsequently submitted via `submit_specs`.

Supabase documents TUS resumable uploads with progress and recovery; use this for candidate videos, with the provider’s currently supported upload options. [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads), checked 2026-10-27.

A completed new candidate scan creates an immediately visible Unreviewed record. Possible matches are suggestions based on supplied identifiers/name/media metadata, not face recognition. `resolve_duplicate` explicitly keeps the new profile or links it to an existing profile. Linking rewires live references and preserves historical snapshots. Same candidate+slot collisions are resolved atomically with at most one Main, union of explicit Shortlist inclusion, and recorded behavior for conflicting slide notes (preserve one active note and retain the other in the operation’s audit/context for normal editing; no fact-conflict UI). Existing reusable facts are not silently overwritten from the scan.

Profile edits and `confirm_candidate_reviewed` check library editor capabilities. Reviewed is projected from the saved confirmed reusable-facts fingerprint and current canonical/extension facts; an outside app’s fact edit cannot leave a stale Reviewed badge. Project availability and template changes do not reset this fact-review status. Confirmation may include confirmed absence of values; Reviewed does not mean every field is populated and does not mean final booking approval.

Supporting-file association archival is the additive M03 operation
`archive_candidate_support`. HTTP and MCP accept only
`CandidateSupportArchive: {row_version}` with an Idempotency-Key and current
`cast.write` authority. `reason`, deletion flags and other fields are rejected;
this operation does not use the generic `ArchiveRequest`. Its public response
is `Success: {success:true, affected_ids:[candidate_support_id]}` inside the
normal response envelope. The adapter validates the private SQL acknowledgement
`{ok:true}` and maps it to that public shape. Archival retains the private asset
and does not alter candidate facts. Other archive operations keep their own
published request contracts.

### Project media and assignments

`workspace_candidates` holds project availability, selected candidate media/frames and internal notes. The Library’s default frame selection can change without rewriting another workspace’s chosen material. `update_workspace_candidate` validates that every selected frame belongs to its selected source media; maximum three, fewer allowed. No automatically substituting the newest candidate video into an existing presentation.

`create_assignment` always starts Option. All active assignments are Selection; there is no writable Selection-included flag. Shortlist is an independent explicit boolean. Changing to Backup does not add to Shortlist. `set_slot_main` is the only operation that promotes to Main; in one transaction it locks the slot, moves existing Main to Backup, sets chosen assignment Main and updates the slot version. A null chosen assignment clears Main. Undo is permitted only against the unchanged returned slot version and the server-recorded `undo_event_id`; verify restore positions against that audit snapshot rather than trusting a supplied list. It restores all affected positions. Independent slots remain independent.

### Generation and versions

`get_workspace_review` requires the selected `series_id`; the producer selects output/audience and creates/reuses its series before this final review, so the fingerprint uses the exact frozen series policy/template. It returns informational/warning items for missing facts, unreviewed profiles, two frames, zero Main and Pending slots. It flags actual overflow and inaccessible/invalid media separately. `generate_version` checks an exact current review/snapshot state, freezes all facts/media/branding/requirements/wording, allocates monotonic `version_no`, and enqueues rendering. It never edits an earlier version.

The renderer returns a validated manifest and PDF. `latest_ready_version_id` advances only if the newly ready `version_no` is higher than the current pointer. If v3 finishes before v2, the later v2 callback cannot move the review link backwards. Render failure retains the last successful version and does not publish the failed draft.

Audience scope belongs to `presentation_series`. A different output/audience uses a separate series. Editing a saved audience preset does not retroactively change old series or broaden a live external link. Internal notes are always internal. Presets do not suppress any of the ten agreed presentation fields; presentation notes are printed content and must not be used as a private-note channel.

## 6. Guest review and immutable attribution

`guest_open_review` exchanges the URL bearer token for a short-lived session. View is available immediately. `guest_identify` stores the supplied name before the first comment/preference, with optional company. Revalidate live link expiry/revocation and token generation on every request; a session must not extend the underlying 30-day grant.

The guest API uses a dedicated external projection. It exposes only ready version slides, authorized referenced media, visible external feedback and the download capability. Do not expose internal job IDs, audit trails, pool/library records or internal notes. Return frame/video IDs solely to issue same-version media access; those IDs are not general library permissions.

Feedback writes include immutable `version_slide_id`; the server derives and validates version, series and assignment from that slide. A reviewer who kept v2 open may write feedback to v2 after v3 becomes latest. Do not silently redirect that feedback to v3. All reviewers authorized for the same presentation see external comments/preferences, with version labels. Feedback responses page the combined comment/preference records using a stable typed cursor and expose `page.next_cursor`; the UI can continue fetching without assuming one response contains every reviewer. Preferences are separate from production casting positions.

A valid review link can exist before its first ready version. `GuestAccess.version_id` is then null; the UI shows Preparing presentation, and current-version reads return `PRESENTATION_NOT_READY` until a ready version exists. Do not expose queued/rendering content.

One preference per guest identity/session and version slide; `value:null` clears it. The result is `{preference:null, cleared:true}`. A display-name change cannot grant ownership of someone else’s response. Guest comment inputs are separate strict schemas: guests cannot supply visibility or resolved state. Guest writes are always external; updates allow only their own body text and current row version. Internal actors may create internal or external comments explicitly, and the guest query always filters to external records.

Canonical internal PDFs use authenticated fixed-version playback URLs. Guest PDFs use a separately prepared, cached link-scoped export of the exact same frozen content. `guest_prepare_pdf_export`/`prepare_pdf_export` creates or reuses `presentation_exports`; return 202 when rendering is required and 200 when a ready authorized cache entry exists. Poll the export, then download using `guest_download_pdf_export` or its internal equivalent. No AI scanning is rerun. Do not replace the canonical PDF with one guest link’s variant.

The active export renderer obtains a one-time `review_media_grants` token through service-only `mint_review_media_grant`; its verifier is stored and the raw secret appears only in the private rendered PDF and the worker’s transient memory. It is never stored in the version manifest, job input/output, outbox or logs. PDF video links point to `/m/:grantToken/versions/:versionId/media/:assetId`, preserving original content while checking the parent link’s current viewing permission. Never embed a permanently assumed Storage signed URL. Raw URL tokens must be redacted from access logs and referrers; use `Referrer-Policy: no-referrer` and no third-party analytics on review/media pages.

Parent expiry, revocation or token rotation denies grant playback. Rotation revokes old grants and invalidates their export cache. Link expiry edits propagate to its non-revoked grants, including naturally expired grants; they never clear a revocation. Disabling PDF downloads blocks preparing and downloading a PDF, but does not revoke video playback in PDFs already downloaded while parent viewing access remains live. The download flag and the viewing grant are distinct permissions.

Short-lived media URLs have a bounded lifetime; revoking the review link prevents new issuance but cannot retract already downloaded bytes. If immediate denial of every subsequent byte request is required, use an authenticated proxy/range endpoint that rechecks the live grant instead of issuing reusable direct URLs. Document the chosen bound in the deployment runbook.

## 7. Async jobs and operations UI

Jobs are durable records in Supabase, not browser promises or n8n execution-screen state. `JobAccepted` returns a job ID, resource ID where available, and poll URL. Poll with backoff or subscribe to authorized status updates; reconnect after navigation. Batch grouping is metadata; every file has independent progress/failure. The planning target of 200 files does not mean 200 simultaneous provider requests.

Service-only endpoints carry `x-capability: service.job-scoped` in OpenAPI. This is a restricted service-lease scope, not a guest-review or acting-user capability. They validate service identity, job ownership, active stage lease, input hash, event ID and sequence. `record_job_event` cannot mutate arbitrary profile fields. `complete_job_stage` dispatches typed validation by the job kind/result schema and commits a short transaction. Duplicate events return an applied/duplicate/stale receipt, without repeating side effects. Failed/cancelled/obsolete attempt output cannot overwrite a newer result.

## 8. Contract tests required

Generate tests for every operation’s request and success/error envelope. Add behavioral tests for cross-project child-ID substitution, stale updates, idempotency replay/different-body rejection, one Main under concurrency, immediate Unreviewed availability, explicit duplicate linking, Selection/Shortlist differences, no silent profile overwrite, immutable snapshots, out-of-order render completion, expired/revoked guest access, guest ownership, all-reviewer external feedback, disabled PDF, and foreign-version media denial.

The catalog is complete only when every meaningful visible control has an operation and that operation is usable under the same user through MCP. Internal worker endpoints are deliberately excluded from user tool parity because they are service mechanisms, not app controls.
