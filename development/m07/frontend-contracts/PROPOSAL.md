# M07 frontend contract requests: source review and next slice

Source-only proposal, 2026-10-31. None of the six requested additions is implemented by this document. No product source, database, dependency/lock file, frontend worktree or cloud resource was changed for this review. The English release's frozen web/worker graphs stay unchanged.

## Coordination and evidence boundary

Read Claude's `tracking/CODEX_BACKEND_COORDINATION.md` and `docs/frontend/IMPLEMENTATION_RECORD.md`, including Backend dependencies 1–6, in `Everyone-Presentation-Studio-Frontend`. The recorded completion head is `b1d1ca4`. The worktree subsequently reached `031c17bc5119f83a68e784eb66ca56ba05d5053f` (a link-note apostrophe fix); the main source reviewed here is `28c3d3cc9127460c5b2f7b13015c840703f7f4fb`. These are source observations, not deployment claims. `source-review.json` records the inspected bytes.

Claude reports 113 fixture/mock e2e checks, lint, types and build passing. Its isolated axe-core 4.10.2 audit covered 42 journey end states and resulted in two Studio fixes; two external callback-fixture findings were excluded. These results have not been rerun by this review and do not establish connected-pilot acceptance. Full redesign integration remains a separate checkpoint. Main already adapted only the agreed small English display slice, documented in `docs/integrations/ENGLISH_TRANSCRIPT.md`.

Keep the owner-verified initial OAuth authorization, reconnect and authenticated Dummy Pilot Test read completed. Keep the existing local recovery proof completed, AT-072 manual screen-reader acceptance pending, mobile testing skipped, and the pilot running. Accessibility automation below does not close AT-072. This proposal does not alter the live English rollout's status.

## Request-to-contract map

All paths below are relative to `/api/v1` for signed-in HTTP. MCP must use the same domain operation, current delegated capabilities, resource checks and RPC as HTTP; it must not bypass them with a privileged database identity.

| Request | Existing operation and storage | Confirmed gap / permission boundary | Proposed finite addition |
| --- | --- | --- | --- |
| 1. Workspace summary | `getWorkspace`, `listRoles`, `listSlots`, `listWorkspaceCandidates`, `listAssignments`, `listPresentationSeries` and `getWorkspaceReview`; `eps.workspaces`, `roles`, `slots`, `workspace_candidates`, `assignments`, `presentation_series`, `presentation_versions`, canonical `candidates` | Existing lists are cursor-paged (normally at most 100). No summary operation exists. `workspaces.read` plus current project access permits project participation/counts; library review state additionally requires `cast.read`. Review issues depend on a particular series/output/audience and draft, not workspace alone. | `getWorkspaceSummary` / `GET /workspaces/{workspace_id}/summary` / `get_workspace_summary`, backed by one scoped aggregate RPC. Recommended first slice; details below. |
| 2. Version feedback summary | Signed-in `listFeedback` / `eps_list_feedback`; guest `listFeedback` through the guest session route; `feedback_comments`, `feedback_preferences`, `version_slides` | No summary exists. Comments and preferences share a single cursor page. Signed-in readers use `eps.feedback_internal_require`; guests must retain link/session/expiry/revocation/version checks and external-only comment filtering. | Shared body-free aggregate, two existing authority entry points: signed-in `GET /versions/{version_id}/feedback/summary` + MCP `get_feedback_summary`; guest `GET /review/versions/{version_id}/feedback/summary`. Do not make the signed-in endpoint anonymous. |
| 3. Jobs batch filter / summary | `CentralJob.batch_id` and `eps.jobs.batch_id` already exist. `listJobs` / `eps_list_jobs` accepts workspace/status/cursor/limit only. | HTTP and central SDK reject `batch_id` today, as does the closed catalog input. `operations.read` does not bypass project membership: `eps.jobs_can_access(workspace_id,'read')` still checks current project scope. A caller-supplied batch UUID is grouping metadata, not authority. | First add `batch_id` as an optional validated UUID filter to the existing shared operation. Then optional workspace-bound `getJobBatchSummary` / `GET /job-batches/{batch_id}?workspace_id=...` / MCP equivalent. Do not infer an inaccessible global batch total. |
| 4. Optional list totals | `listProjects` (`projects.read`) / `eps_list_projects`; `searchCandidates` (`cast.read`) / `eps_search_candidates`; `Page` is exactly `{next_cursor}` | No totals. Shared DTO parsers and published schemas reject extra fields. Adding an uncoordinated SQL `total` would fail response validation. | Optional `page.total` for these two list types only, with explicit schema/parser/MCP changes and filtered-count semantics. Keep omitted-count UI fallback while absent. Do not add a required total to every `Page`. |
| 5. Atomic cross-slot move | `CastingAssignmentOperations` has create/update/remove, set/undo Main, and workspace reorder. `AssignmentPatch` cannot change `slot_id` or participation. `eps_reorder_workspace` validates exact in-slot sets. | Existing remove + create is two mutations, creates a different assignment, and cannot guarantee preservation/atomicity. No move operation exists. The source and target must be active in the same writable workspace; moving cannot grant cross-project access or change the person. | `moveAssignment` / `POST /assignments/{assignment_id}/move` / `move_assignment` with the proposed body/result, dedicated atomic RPC and shared domain tests. Recommend refusing a current Main with `MAIN_OPERATION_REQUIRED`, one of Claude's permitted behaviors, to preserve the explicit Main workflow. |
| 6. Pinned accessibility dependency | Root pins `@playwright/test` 1.64.1. No `@axe-core/playwright` dependency exists in this root package. Claude used isolated axe-core 4.10.2. | The engine version does not establish the installed wrapper version or a committed test setup. No dependency was installed or registry version selected in this review. | In a separate tooling checkpoint after source unfreezing, verify the official wrapper release/compatibility, pin its exact version and resulting lock entry, then add focused existing-journey accessibility specs. Preserve real-page vs external callback-fixture scope. |

## First slice: workspace summary with exact meanings

Implement request 1 first after the English rollout and preservation checkpoint. It unblocks the redesigned step/header counts without a worker/provider job or a casting mutation. Coordinate the following proposed nullable-field refinement with Claude before consumers are changed; no owner questionnaire is needed.

Proposed closed data DTO (normal HTTP request-id envelope remains outside this object):

```typescript
interface WorkspaceSummary {
  workspace_id: string;
  row_version: number;
  draft_revision: number;
  roles_needing_clarification: number;
  project_candidate_count: number;
  unreviewed_candidate_count: number | null;
  open_slot_count: number;
  assignment_count: { selection: number; shortlist: number };
  latest_ready_versions: {
    series_id: string;
    output_type: 'selection' | 'shortlist';
    version_no: number;
  }[];
  review_issue_count: number | null; // Always null in this first slice.
}
```

`workspace_id`, `row_version` and `draft_revision` bind the response to the loaded workspace and draft. They do not make separate earlier or later page fetches an atomic snapshot. Counts are nonnegative safe integers, versions positive safe integers; validate resource identities, duplicate series and finite response bounds. No facts, names, transcripts, feedback bodies, tokens or signed URLs belong in this summary.

| Field | Exact proposed definition |
| --- | --- |
| Workspace gate | Require current internal acting user, effective `workspaces.read`, active workspace, active canonical project and current `eps.project_scope(project_id,false)`. Return existing scoped 404/403 semantics. Do not count rows before authorization. OAuth uses the same effective grants. |
| `roles_needing_clarification` | Count distinct active roles in this workspace with `headcount IS NULL` **or** at least one role clarification whose `resolved` is false. One role with several markers counts once. A resolved marker does not override an unknown headcount. Workspace/spec-level markers are not roles and do not add to this count. This matches the existing provisional-headcount warning; explicitly document this combined meaning. |
| `project_candidate_count` | Count active `workspace_candidates` participation rows in this workspace. The active `(workspace_id,candidate_id)` uniqueness already gives one count per participating person. Do not count videos, uploads or assignments. Do not add a global candidate-archived filter: M04 explicitly retains ongoing project participation after global library archival. Existing duplicate-link transactions manage participation/assignments. |
| `unreviewed_candidate_count` | If effective `cast.read` is absent, return **null**, not zero and not a hidden aggregate of protected library state. Otherwise count those same active participation rows whose canonical row is not `eps.cast_is_reviewed(candidate)`. That function checks the supplied-facts/source fingerprint, not just a nonnull timestamp; do not redefine Reviewed. Global library archival alone does not remove an active project participant from this count. Missing/inconsistent canonical joins must fail explicitly rather than silently lower the count. |
| Active assignment set | The workspace's non-archived assignments joined to non-archived slots and roles in that workspace, as `eps_list_assignments` does. Do not require Main, selected frames, Reviewed or availability. Existing lifecycle/participation validity guards remain authoritative; do not hide an invalid active assignment by filtering its person out of this set. |
| `assignment_count.selection` | Number of rows in that active assignment set, including Option, Main and Backup. A person assigned to two slots counts twice, because the product generates one slide per included assignment. |
| `assignment_count.shortlist` | Number of rows in that same set with `shortlist_included=true`, independently of position. Never infer Shortlist from Main/Backup. |
| `open_slot_count` | Count active slots of active roles with zero assignments in that active **Selection** set. A slot containing an Option or Backup is filled for this count. A provisional slot still is an actual active slot and counts if empty; do not present this as a confirmed headcount deficit. An empty Shortlist does not make a Selection-filled slot open. The no-role fallback Pending presentation slide is not a slot and adds zero. |
| `latest_ready_versions` | For every non-archived series in this workspace with a nonnull latest-ready pointer, return that same series' Ready version number/output only after checking the referenced Ready version belongs to it and the workspace. Sort deterministically by `series_id`. Different audience scopes can have separate series for the same output; do not collapse them to a single newest Selection/Shortlist. Null-pointer series contribute no entry. Fail on inconsistent pointers or an exceeded explicit response budget; never silently return a partial list while presenting it as complete. |
| `review_issue_count` | Return **null** in this first slice. `get_workspace_review` takes `series_id` and separately enforces `cast.read`; issues/fit depend on its output/audience/template/draft and can include processing state. Neither all-series sums nor loaded-page issue totals are a workspace truth. The redesigned UI must keep its unknown/not-loaded state. A later scoped review-summary contract can supply a count tied to a particular series/fingerprint if needed. |

All aggregates and the workspace revision must be computed from one consistent database snapshot. Prefer a single read-only SQL aggregate statement (or a genuinely stable, read-only function with one statement snapshot), not several unpinned REST calls or browser summation. Reuse the existing scoped-owner/RLS model with only the necessary explicit reads. A `cast.read`-absent branch must not accidentally turn RLS-hidden candidates into a misleading count of zero. No new table, broad service credential, provider call, job, audit mutation or presentation backfill is needed for this read.

Existing M05 `eps.presentation_scope(workspace,false)` permits current project scope plus `workspaces.read`; its `cast.read` check is inside the **write-only** branch. The existing version-read RLS can therefore validate Ready metadata for this summary without a new bypass or mandatory `cast.read`. That is separate from protected live-library review state. An independent source review confirmed the definitions above and found no remaining source issue; no product or cloud execution was part of that review.

### Shared files and release dependency

Before implementation, acknowledge the above DTO/count definitions and the nullable review-state count in the existing backend-coordination note; Claude retains its layouts. Publish the shared schema/type first, then consume it in the redesign. The existing omitted/partial-count fallback remains until a matching server is served.

Expected touched ownership boundaries (not changes made here):

- Shared contracts: `contracts/openapi.yaml`, `contracts/mcp-tool-catalog.json`, any generated contract/runtime/parity artifacts derived by the existing tools. Add one operation with `workspaces.read`; preserve all existing tools and OAuth capability expressions. `apps/web/lib/mcp.ts` uses the catalog, shared HTTP dispatch and output validation, so publish its operation/response schema together.
- Domain: a small summary type and operation in `packages/domain/src/` plus exported public surface; reuse the shared validation/error model. Do not couple it to React or provider code.
- Central SDK: a scoped RPC adapter and closed DTO parser in `packages/central/src/`, with workspace/series identity checks and nullable count validation. Existing exact `Page` parsers need no change for this slice.
- Database: one additive, least-privilege read RPC in the next coordinated migration after actual canonical34 release/inspection. Its guard/history/source assumptions must be generated for that actual target; do not copy an old migration's hardcoded predecessor history or change the frozen migration34.
- HTTP/MCP: extend the appropriate workspace/review dispatcher and route registration, share one operation, retain no-store/error/request correlation and current session/origin checks. No changes to issuer/consent/token exchange are required.
- Frontend: Claude owns workspace header/steps/summary consumers. Integrate only the agreed calls/types/fallback handling; do not edit its worktree for this proposal or overwrite the full redesign. Keep English group validators and no-raw-fallback behavior.

### Finite acceptance for this slice

1. Local database synthetic fixtures: empty workspace; more than 100 roles/pool/assignment rows; multiple unresolved markers/unknown headcount; provisional empty slot; Option-only/Backup-only filled slots; explicit Shortlist; one person assigned twice; archived role/slot/participation lifecycle; retained globally archived library participant; two audiences for the same output; no Ready pointer and inconsistent-pointer rejection.
2. Permission fixtures: anonymous/foreign project/archived project or workspace denied; `workspaces.read` without `cast.read` gets accurate non-library counts plus `unreviewed_candidate_count:null`; with both grants the fingerprint-based count is exact; revoked effective capability/project membership remains denied, including MCP.
3. Shared domain/SDK/HTTP/MCP tests: closed DTO, request validation, null versus zero, integer bounds, resource-identity mismatch, stable ordering, consistent snapshot/revision, identical HTTP/MCP response and advertised read-only tool metadata. Keep existing operations valid.
4. Run the affected contract/central/domain/database suites plus lint/types/build once after changes. If generated MCP dispatch/catalog changes affect shared paths, run OAuth/discovery/authenticated project-read regression without reopening the already passed owner connection acceptance or requesting reconfiguration.
5. After deploying that coherent later checkpoint, verify the actual served build and signed-in workspace count display, then perform a read-only summary through the existing authorized MCP client. Record local fixtures separately from real-service evidence. No source-only proposal or mock result earns hosted credit.

## Remaining request semantics and risks

### Feedback summary

Pin the requested version; do not substitute newest-ready or aggregate a whole series. Include actual version slide IDs (zero counts allowed), and enforce existing slide/kind policy: cover has no feedback; Pending has comments but no preferences; Candidate has both. Preference counts describe current stored votes by value, not historical toggles. Existing preferences have no visibility column: mirror their existing version visibility exactly; do not invent a new private/public vote distinction. Comments exclude soft-deleted rows and, for guests, internal visibility. Count each visible comment row, including replies; `unresolved_count` counts visible rows with `resolved=false`. A thread count would be a different field, not this count. Totals are sums over the same per-slide scope and same read snapshot.

Guest aggregation must enter through the existing fixed guest operation/session boundary and recheck link expiry, revocation, intended series/version and guest session before querying. Internal totals may include internal comments; guest totals and unresolved counts must never reveal their existence. Preserve rate limiting, no-store and guest-origin behavior. Finite tests: >100 combined feedback rows, votes set/clear, mixed internal/external replies, deletion/resolution, zero rows, two versions, foreign slide, expired/revoked session and exact signed-in/guest/MCP parity appropriate to each identity. No comment bodies or author names are needed for this read.

### Jobs batch

Preserve all six statuses: `queued`, `running`, `waiting_for_input`, `succeeded`, `failed`, `cancelled`. A batch total means **persisted accessible jobs**, not selected files, upload intents, a 200-item local queue or provider executions. Jobs are created after successful intake; failed uploads may have no job. Retries change the same job/attempt/dispatch state, not the total number of selected files. A new summary should require `workspace_id` and filter both workspace and batch under `eps.jobs_can_access`; include every status key even at zero and ensure `total=sum(by_status)`. A batch UUID reused in another workspace must not leak its existence/count. An arbitrary inaccessible batch should have the same safe scoped behavior as an absent batch. Do not add global operations authority. Apply all filters on every cursor page and preserve existing limits/UUID validation. The current UUID job cursor is not query-bound; do not claim it rejects switching filters, or bundle a new cursor format into this small filter addition. Add tests for >100 jobs, shared UUID across accessible/inaccessible workspaces, zero/one/many states and the already contracted 202 retry result. Do not retry any live job merely to test a filter.

### Optional list totals

Count all matching authorized rows **before** cursor/limit in the same snapshot as the returned page. Projects use the existing canonical project/client `q` match plus current project access/archival policy. Candidate search uses its existing full filter predicate, review fingerprint, unknown-handling semantics, archive/merge exclusion and `cast.read`. Do not count global rows and then filter the page. Keep its query-bound cursor behavior. Adding an optional `page.total` requires a coordinated parser/schema change for these operations; existing consumers must accept omission. Test filter changes, later cursor pages with unchanged total and denied/project-scoped rows. Avoid silently altering every page helper because many callers use strict exact-shape validation.

### Atomic move

Use the proposed payload `{row_version,target_slot_id,expected_target_slot_row_version,position:'option'|'backup'}` and result `{assignment,source_slot,target_slot}`. Preserve assignment ID, workspace/person participation, notes (including internal), slide wording and Shortlist; only its slot/order/allowed position, revisions and timestamps change. Append to the target slot's bounded ordering; do not use workspace reorder to transfer ownership. Refuse current Main with `MAIN_OPERATION_REQUIRED` and require the existing explicit Main operation first. Do not move cross-workspace, into an archived role/slot, into the same slot, or into a slot already containing that canonical person. The active pool uniqueness and existing duplicate-link behavior inform the last check; keep the unique active assignment constraints as the race backstop.

Lock in the existing global order: workspace, both roles sorted, both slots sorted, relevant participation, assignment rows. Recheck authority and active parents after locks. Validate assignment and target-slot revisions before mutation; advance both slot revisions and the assignment once, then the workspace/draft once. Maintain one-Main/uniqueness invariants and roll back the whole operation on stale input, duplicate, overflow or failure. Extend the existing bounded idempotency/audit policy allowlists and assignment-change records for this operation; scope/replay fences remain required even on cached responses. A move must not become an unsupported generic lifecycle-undo operation or change old Main undo behavior. Ready snapshots stay untouched.

Finite tests: move across two roles/within one role, preservation of all carried fields/ID, target append order, Main refusal, same-slot/duplicate/cross-workspace denial, stale revisions, same-key replay/conflict, authority revoked before replay, opposed moves/concurrent insert/Main changes, no partial move and deadlock-free deterministic locking, draft increment, old Ready version equality, and HTTP/MCP parity. This is a separate mutation slice after the summary reads, not a shortcut bundled into the English deployment.

### Accessibility package

When source is unfrozen, verify and pin the official `@axe-core/playwright` wrapper plus resolved engine/lock against the project's supported Node/Playwright, then commit narrowly scoped fixture-driven accessibility tests using real Studio regions/states. Record the chosen official package evidence at that implementation time; the isolated engine 4.10.2 is historical audit evidence, not proof of the appropriate current wrapper package. Keep callback stand-in pages out of Studio acceptance and preserve screen-reader acceptance as pending.

## Next concrete action

Parent completes the English34 live controlled scan, app/guest display, newly saved version and old-cohort preservation proof first. At the next coherent checkpoint, coordinate request 1's DTO/null semantics with Claude, then implement and locally verify the single workspace-summary domain/RPC/HTTP/MCP slice above. Requests 2–6 stay acknowledged/unimplemented until their own source and verification checkpoints. Existing remaining M07 live requirements in `development/m07/REMAINING_AFTER_ENGLISH34.md` (including the still-partial operator trace) remain open; none is displaced or marked passed by this proposal.
