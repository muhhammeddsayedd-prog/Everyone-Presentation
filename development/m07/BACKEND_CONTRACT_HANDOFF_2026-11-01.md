# Backend contract handoff for the frontend integration

Prepared from Main `a5c25ff` and the latest retained release receipts. This is a
source/contract review, not a new deployment or hosted acceptance run. The latest
recorded pilot is canonical38/English1.0, web
`dpl_4Gm85atSx5XG8kd8w3tfXCTDjNro` and worker
`dpl_G6CVBYjPxYwh8zNaAYLu4pURoVG4`/native50082, with all five processing flags
enabled. Root owns the single pilot release path; Claude Code owns frontend.

The frontend worktree was observed at `frontend/redesign@cd2eadb` with an
in-progress merge and four unmerged paths: `CandidateDetailView.tsx`,
`SourceTranscript.tsx`, `WorkspaceReviewView.tsx` and `english-transcript.tsx`.
This review changed no frontend file, index, merge state, component or lockfile.
Resolve those hunks in that worktree while retaining its layouts and Main's
English group validators. Preserve Main's catch-all list-query validation.

## Available contracts

| Contract | Authoritative sources | Availability and remaining evidence |
| --- | --- | --- |
| Workspace summary | `packages/domain/src/workspace-summary.ts`; `packages/central/src/studio.ts`; `apps/web/lib/workspace-summary-http.ts`; migration `20261031182038_m07_workspace_summary.sql`; OpenAPI `WorkspaceSummary` | Deployed. Signed-in HTTP and owner-attested existing-connection MCP read passed. |
| Version feedback summary | `packages/domain/src/feedback-summary.ts`, `guest-types.ts`; `packages/central/src/guest-reviews.ts`; `apps/web/lib/guest-http.ts`; migration `20261101042702_m07_feedback_summary.sql`; `docs/integrations/FEEDBACK_SUMMARY.md` | Deployed. Signed-in exact-version HTTP and native SQL passed; owner MCP and hosted guest-summary delta remain open. |
| Job filtering and reads | `packages/domain/src/job-filters.ts`; `packages/central/src/jobs.ts`; `apps/web/lib/job-http.ts`, `mcp-capabilities.ts`; migration `20261101110939_m07_job_batch_filter.sql`; `docs/integrations/JOB_BATCH_FILTER.md` | Deployed. Signed-in filter validation/unfiltered reads and owner MCP empty filtered page passed. Actual205-job SQL pagination passed locally; hosted nonzero pagination is not claimed. |
| English projection | `packages/domain/src/english-transcript.ts`, `candidate-types.ts`, `presentation-types.ts`; `docs/integrations/ENGLISH_TRANSCRIPT.md` | Deployed/enabled. Actual candidate and frozen saved/guest playback/PDF evidence passed. The full redesigned frontend is not yet deployed. |
| Upload/processing | `packages/domain/src/types.ts` (`UploadSessionCreate`, `UploadSession`, `CompleteUpload`, `UploadCompletion`); `packages/central/src/studio.ts`, `candidate-storage.ts`, `tus-upload-session.ts`; OpenAPI and MCP catalog | Deployed. Real app processing passed; the complete owner-led MCP byte-upload-to-presentation journey remains open and needs a fresh transfer session. |
| Saved versions/guest access | `packages/domain/src/presentation-types.ts`, `guest-types.ts`; `packages/central/src/presentation.ts`, `guest-reviews.ts`, `presentation-storage.ts`, `guest-storage.ts`; `CONTRACT_BASELINE.md` | Deployed. Completed English guest playback/PDF/revocation evidence carries forward. Fresh anonymous guest and feedback-summary/version/privacy delta acceptance remain separate. |

Published operation paths, input/output schemas, capabilities and envelopes remain
in `contracts/openapi.yaml`, `contracts/mcp-tool-catalog.json` and
`contracts/operation-parity.json`; generated web contracts are generated output.
HTTP success is `{request_id,data}`. Paginated `data` contains its existing
`data` array and `page.next_cursor`; SDK methods return the inner service value.
Use the current shared types rather than redefining them in components.

## Count, loading and authorization semantics

- `GET /api/v1/workspaces/{id}/summary`, SDK `getWorkspaceSummary(actor,id)`,
  MCP `get_workspace_summary`: requires `workspaces.read` and current project
  authority. `unreviewed_candidate_count` is null without `cast.read`;
  `review_issue_count` is always null because issues need an output/audience.
  Null is unavailable, never zero. Other counts are nonnegative integers.
  Selection counts every active assignment; Shortlist counts explicit inclusion.
  A slot is open when it has no active assignment. Keep every Ready series entry,
  including separate audiences; the DTO intentionally has no audience label.
  Loading is pending; a failed/over-budget summary is unavailable. Do not infer
  zeros or drop series. Refetch after relevant draft mutations.
- `GET /api/v1/versions/{id}/feedback/summary`, SDK/MCP `getFeedbackSummary` /
  `get_feedback_summary`, and guest
  `GET /api/v1/review/versions/{id}/feedback/summary`: the closed DTO is
  `{version_id,per_slide:[{version_slide_id,preferred,maybe,not_preferred,
  comment_count,unresolved_count}],totals}`. Counts cover all authorized rows in
  one snapshot, including replies individually; deleted comments are excluded.
  Cover rows are zero; Pending rows have comments but no preferences. Totals sum
  per-slide counts. Signed-in access requires current `workspaces.read` and
  Ready-version/project scope. Guest authority uses its existing session/link,
  exact external series/version and expiry/revocation boundary; internal comments
  never contribute to guest counts. Cache by viewed version and authority;
  invalidate after feedback mutation. Loading/failure is not a zero summary.
- `GET /api/v1/jobs`, SDK `listJobs`, MCP `list_jobs`: optional lowercase UUID
  `batch_id` intersects `workspace_id`, `status`, `cursor`, `limit` (1..100).
  Omit it for the unchanged old RPC. Keep filters identical across pages;
  ascending job-ID cursor is a threshold, not a snapshot or permission grant.
  Read until `page.next_cursor === null`. No total or `by_status` exists: a loaded
  partial page cannot support whole-batch counts. Empty authorized pages are real
  empty results; request failure is unavailable. Unknown/duplicate query keys and
  malformed limits fail before service dispatch.
- Ordinary job reads retain operations/workspace read plus project checks. Frame
  jobs retain `cast.read`, current requester and frame-specific authority,
  including supported global requester access. MCP's preliminary `own frame read`
  branch reflects existing SQL authority; it grants no wider visibility. Reading
  a job does not grant retry/cancel. Presentation jobs expose `can_retry` and
  `can_cancel`; other kinds retain their existing action policy. Never infer an
  available action from successful GET or from owner-role acceptance.

## English, upload and failure behavior

Render candidate `english_transcript` only when
`english_transcript_status === 'available'`. Render saved playback's frozen
`english_text` only when `english_status === 'available'`; its hash belongs to
that saved companion. Both complete optional groups are validated by shared
helpers. Absent legacy groups mean `not_captured`; partial groups are invalid.
`not_provided` means no supplied speech, `unavailable` means processing could not
provide English, and `not_captured` means this saved/legacy material has no
capture. Keep these states explicit. Do not display original-language fields or
current candidate text as a fallback. Keep existing English language labels and
`Other spoken language` fallback. No app language selector is required.

Candidate video uploads use the exact server-returned TUS contract, reserved
destination/metadata and chunk size, with scoped transfer authorization. A
session's `open/completed/cancelled/expired` status is separate from asset and job
status. Transfer actual bytes before `complete_upload`; a session reservation or
client progress display does not prove stored bytes. Creation/completion retain
acting-user permissions and idempotency. Candidate completion requires
`start_processing:true`, verifies Storage type/size, and returns
`{asset,processing_job_id,status:'queued'}`. Other purposes can return `ready`
with no job; specs upload is followed by `submit_specs`. Poll/read the actual job
and persisted resource, retaining correlation IDs. Use a fresh session after
expiry; never replay the expired delegated inbox or expose its transfer secrets.

Errors use `{request_id,error:{code,message,details,retryable}}`. Preserve the
safe mapper and actionable `SOURCE_UNREADABLE` guidance: replace with a valid
supported file or enter available information manually. It remains nonretryable.
`UPLOAD_INCOMPLETE` means resume stored byte offset; `UPLOAD_EXPIRED` means start
another upload. A transient `STORAGE_TIMEOUT` is distinct from invalid source.
Reload current revisions on `STALE_RESOURCE_VERSION`; do not silently overwrite.
An idempotency key identifies one intent, so retries keep the key/body/path and
new intents get a new key. Never expose provider messages, credentials, private
source text or signed URLs in general logs. Technical failures stay visible.

## Saved-version and guest behavior

Read/render the requested immutable saved version, selected media, frame assets,
wording and captured transcript. New material creates future versions; no silent
backfill/rewrite of old content. Latest guest links follow newest Ready only in
their own series/output/audience, while feedback remains on its viewed version.
Guest PDF variants change access URLs while retaining frozen pages. PDF media
grants are fixed-version and still depend on the parent link; expiry/revocation
must deny guest, PDF and media access. The completed guest English check used the
normal connected browser; it does not establish a fresh anonymous-session pass.
Reviewed facts remain producer-confirmed facts, separate from suggestions and
transcription uncertainty. The earlier ASR omission is not a general ASR fix.

## Remaining frontend dependencies and exact integration action

Requests1/2/3 in frontend `docs/frontend/IMPLEMENTATION_RECORD.md` now have the
live contracts above. Consume them after completing the current merge and test
the integrated frontend against the one root-coordinated pilot release.

Request4 optional list totals and request3's optional batch-summary endpoint are
not implemented: omit unavailable totals and retain explicit partial-batch state.
Request5 cross-slot atomic move is not implemented; `AssignmentPatch` has no
`slot_id`, and workspace ordering only reorders existing slot membership. Retain
the documented remove/assign-elsewhere UI until a separate additive operation is
implemented with preserved notes/wording/Shortlist, duplicate/Main checks,
revisions, atomicity and idempotency. Request6 pinned axe tooling remains a
frontend testing dependency; it does not complete manual screen-reader AT-072.
Manual screen-reader acceptance is pending; mobile acceptance remains skipped.

The existing append-only coordination record in the frontend worktree remains
authoritative for historical messages. This concise handoff supersedes its old
availability labels only where supported by the latest retained receipts; it
does not claim new guest/MCP/contributor/refresh/restore acceptance.
