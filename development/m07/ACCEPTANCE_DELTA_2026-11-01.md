# Bounded M07 acceptance delta

Reconciled on 2 November 2026 (Africa/Cairo) against the latest repository
checkpoint, observed 1 November at 20:29:11 UTC. This is a companion to the
[existing M07 matrix](../../tracking/evidence/m07/ACCEPTANCE_MATRIX.md), not a
new release programme. No live operation, deployment, credential read or cloud
mutation was performed for this reconciliation. Later actual receipts take
precedence over this snapshot.

The current recorded release is canonical38, web `dpl_4Gm85atSx5XG8kd8w3tfXCTDjNro`,
worker `dpl_G6CVBYjPxYwh8zNaAYLu4pURoVG4`, native50082/daemonce23, English1.0,
all five processing flags enabled. The `current_hosted_release` object in
`tracking/progress.json` and the latest handoff agree. Several older root objects still contain prior
current-state labels; they must not override the newer receipts.

| Existing item | Carry forward | Exact missing evidence and next action |
| --- | --- | --- |
| AT-064/068 producer Claude journey | Initial authorization, reconnect and exact correlated project read passed; workspace summary, job guidance and empty batch reads have accepted owner receipts. | Fresh supported local-byte upload through the existing connection, completion/job/results, permitted review/assignment, saved version, PDF/media/readback and link creation/revocation in one coherent journey. Root prepares a fresh nonce-bound inbox; owner operates the existing Claude session. Never replay the expired 04:06 inbox. Preserve uncertainty and confirm only facts actually established. |
| AT-063 workspace summary | Signed-in HTTP and owner MCP results matched; absent review issue count is `null`, not zero. | No new summary acceptance needed unless changed. Use the same operation during the fresh journey for parity/readback. Receipt has no MCP request ID, so do not add a server-correlation claim. |
| AT-063 feedback summary | Canonical37, deployed signed-in HTTP exact-version/all-three-slide zero counts, invalid query rejection and public missing-session denial passed. Local SQL covers more than100 rows and privacy/lifecycle cases. | Actual `get_feedback_summary` through existing Claude connection, plus fresh anonymous guest summary for the requested Ready version. Verify nonzero external counts, internal-note count exclusion, foreign/internal version denial, expiry and post-revocation rejection; compare signed-in/app data without publishing note bodies. Revoke temporary links and verify rejection. Existing English guest playback/PDF/revocation remains passed independently. |
| AT-063/066 batch filtering | Canonical38 applied/read back; old RPC preserved. Owned local205 accessible jobs paged100/100/5 with interleaved foreign/other-batch exclusions and complete rollback/cleanup. Signed-in empty-filter/invalid/duplicate/unfiltered cases and owner MCP empty0/null read passed. | No second205-row fixture needed. Hosted nonzero batch pagination is not established and must not be inferred; it is separate from the closed local pagination criterion and real processing workload. Preserve filters while traversing the ID cursor. |
| AT-065 frame-job reads | Existing M03 SQL requester-only `cast.read` branch is preserved; list/get MCP preliminary gate now advertises it. Nested native SQL proof covers cast-only delegated claims, own-frame reads, ordinary/foreign-frame denial and synthetic expiry. | Real appropriately restricted actor/client read and denial evidence remains absent. Exercise actual requester frame reads without granting ordinary-job, retry or cancel authority. Do not replace this with owner success or synthetic claims. |
| AT-065 token lifecycle | Working accepted OAuth configuration and narrow resource/session gate; source-founded retained-client session refresh timestamp observed. | Actual intended-client expired-token refresh and subsequent MCP use; token rotation/revocation and access denial while preserving unrelated sessions. Owner retains configuration/sign-in/consent control. The timestamp is not token receipt, exact process, rotation, revocation or refreshed-token MCP evidence. Do not rerun the history36 metadata observer against38. |
| AT-065 actual contributor | Deterministic authorization/real-role local SQL denials passed. | Use an existing real contributor with genuine current project/capability scope to compare UI/API/MCP denials for shared-fact review/edit and restricted project/library reads. No real contributor is established by the inspected evidence. Discover authorized existing identity first; never substitute owner permissions, create a fake cloud identity or reduce the owner's working grants for convenience. |
| AT-060 representative workload | Historical200-file bounded synthetic native diagnostic passed198 successes/two intended failures, peak2, one drained restart; source classifier overlay remains separate. | Actual representative processing through Storage/n8n/OpenAI/native worker with measured bytes, queue/attempt durations, retry/failure counts and provider usage/cost. Keep it separate from205 synthetic job rows, which enqueue no AI. Bound by approved samples/budget and current serial worker. Do not report200 representative scans from tiny probe-heavy no-audio synthetic files. |
| AT-070 recovery | Actual local38 metadata/four filesystem objects/native PDF-video/fences, corrupt-backup refusals and full cleanup/preservation passed. | Independent owned recovery target plus Storage/API upload/download and referenced-object reconciliation; actual Auth/resource/provider/workflow/template configuration restore where required. Do not reset the pilot or replay consumed local38 preparation/execution. The149474ms rehearsal is not RTO/RPO. |
| AT-069 replacement/rollback | Current drained forward worker cutover/startup/pin/resume passed within its own scope. | Queued-job deployed replacement and compatible rollback remain open. Preparation was automatically rejected, reason only `blocked by policy`. Preserve the blocker; no tool/transport/manual equivalent retry. Reviewable proposal must identify the exact rejected action and missing authorization. |
| AT-074 operator trace | Paired real successful/failed job audit plus actionable app/API/owner MCP guidance passed. | No reopening of scoped AT-074. Diagnostic worker failure emission remains unit-only, and the historical136 provider cause remains unknown; neither demands retrying that protected historical job. |
| AT-072 / mobile | Screen-reader test pending; mobile skipped by owner. | Claude frontend owner completes manual assistive-technology acceptance on the integrated interface. Automated checks cannot close it. Keep mobile skipped. |

## Exact existing receipts and runners

- Accepted connection:
  `tracking/evidence/m07/oauth-attempt-trace/2026-10-31-owner-connection-acceptance.json`.
- Accepted workspace MCP summary:
  `tracking/evidence/m07/workspace-summary35-web/2026-11-01-owner-mcp-summary-read.json`.
- Accepted owner batch MCP empty page (request `dec726b0-c6e9-4b7f-a592-34903c6a77c7`):
  `tracking/evidence/m07/job-batch-filter38-web/2026-11-01-owner-filtered-MCP-read.json`.
- Feedback HTTP exact version `4f1b81a1-adb7-425b-8223-458d8bd82c28`:
  `tracking/evidence/m07/feedback-summary37-web/2026-11-01T10-14-22-596098Z-authenticated-summary.json`;
  input denial `2026-11-01T10-14-50-245943Z-authenticated-input-denial.json`
  and public missing-session/auth checks `2026-11-01T10-14-33-792Z-public-regression.json`
  in that folder. The read explicitly records MCP/guest/nonzero-hosted acceptance false.
- Native205-pagination/delegated-claims proof:
  `tracking/evidence/m07/job-batch-filter-proof/2026-11-01T17-23-47-142Z-bb9cf2bf.json`.
  This receipt explicitly records real OAuth, HTTP, MCP, cloud and provider checks false.
- Refresh metadata only:
  `tracking/evidence/m07/oauth-refresh-metadata36/2026-11-01T09-47-58-887145Z-9042fd51-4d70-42d6-9b51-86cd72cfd147.json`.
  Its observer is pinned to canonical36 and is not a lifecycle test.
- Current38 local restore:
  `tracking/evidence/m07/recovery38/2026-11-01T20-19-31-495Z-639da33a.json`
  and `2026-11-01T20-24-11-582932Z-Root-admission.json` in that folder.
- Fresh upload parent: `tools/client-upload-inbox.mts`, documented in
  `development/m07/PRIVATE_UPLOAD_HANDOFF.md`. Its `prepare` requires actual approved
  metadata/source bytes; transfer consumes a fresh private capability handoff once.
- Existing SQL proof sources: `development/m07/feedback-summary37-proof/` and
  `development/m07/job-batch-filter-proof/`. Their completed once-only run inputs
  stay frozen; their readmes' original disabled/pre-execution text is historical.

## Coordination and current-document corrections

Claude's existing append-only coordination file is in the isolated frontend
worktree at `Everyone-Presentation-Studio-Frontend/tracking/CODEX_BACKEND_COORDINATION.md`.
Its latest 20:29 entry records current worker/recovery evidence and preserves the
English DTO contract and Main catch-all query validation. Root owns releases and
current shared tracking updates; Claude owns frontend components and manual
screen-reader interaction checks.

Current documentation should reconcile, without rewriting historical evidence:

- `FEEDBACK_SUMMARY.md` introductory source-only/unapplied label versus actual37
  applied/deployed signed-in read; retain missing MCP/guest evidence explicitly.
- `JOB_BATCH_FILTER.md` owner-MCP-pending sentence versus accepted empty-page receipt.
- `progress.json` root `notes`, `current_pilot`, `latest_checkpoint`, `active_session`
  and earlier backend next-action values versus `current_hosted_release`/latest handoff.
- `RELEASE_EVIDENCE.md` October31 current overview/English-disabled/current33 labels
  versus current38 deployed English1.0 and scoped AT-074/current38 recovery proof.

The current request authorizes bounded temporary review-link testing and revocation;
older pending action-time permission labels alone do not require another approval.
Do not send links to anyone. An actually new audience/access grant beyond that test
still needs its specific authorization. No completion status changes follow from
this document alone.
