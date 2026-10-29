# M04 assignment slice contract

Implemented locally in new `packages/domain/src/casting-types.ts` and `casting.ts`.
The public shapes match the existing OpenAPI/MCP assignment contracts. Domain
code provides strict boundary parsers, a typed service seam and immutable
transaction plans. New `packages/central/src/casting.ts` implements the verified
user RPC adapter, including full reorder maps. It is not wired into the shared
studio, HTTP or MCP yet and no actual database operation was called by this agent.
Root owns those integrations; the SQL agent owns constrained
RPCs, RLS, durable idempotency/audit and actual two-session race proof. Hosting is
deferred. No existing M03 file, barrel, migration or activation source was changed.

## Public operations

HTTP paths below are relative to `/api/v1`. MCP uses the identical snake-case
operation, acting user, input, success data and typed errors. Mutations require
`workspaces.write` plus current project write; listing requires `workspaces.read`
plus current project read. These operations do not grant shared-fact editing or
factual confirmation. A permitted contributor can organize casting without
`cast.write`/`cast.review`.

| Operation | HTTP | Body / success data | Planned SQL RPC |
| --- | --- | --- | --- |
| `list_assignments` | `GET /workspaces/{workspace_id}/assignments` | `output_type?`, `cursor?`, `limit?`; `Assignment[]` plus page | `public.eps_list_assignments(uuid,text,text,integer)` |
| `create_assignment` | `POST /workspaces/{workspace_id}/assignments` | `AssignmentCreate` / `Assignment`,201 | `public.eps_create_assignment(uuid,jsonb,text)` |
| `update_assignment` | `PATCH /assignments/{assignment_id}` | `AssignmentPatch` / `Assignment` | `public.eps_update_assignment(uuid,jsonb,text)` |
| `set_slot_main` | `PUT /slots/{slot_id}/main` | `SetSlotMain` / `SetSlotMainResult` | `public.eps_set_slot_main(uuid,jsonb,text)` |
| `undo_slot_main` | `POST /slots/{slot_id}/main/undo` | `MainUndo` / `SetSlotMainResult` | `public.eps_undo_slot_main(uuid,jsonb,text)` |
| `remove_assignment` | `POST /assignments/{assignment_id}/remove` | `ArchiveRequest` / `Success {success:true,affected_ids:[assignment_id]}` | `public.eps_remove_assignment(uuid,jsonb,text)` |
| `reorder_workspace` | `PUT /workspaces/{workspace_id}/order` | Full `ReorderWorkspace` maps / `Workspace` | `public.eps_reorder_workspace(uuid,jsonb,text)` |

The new central method deliberately uses `parseCastingReorderWorkspace`; the
existing M02 `parseReorderWorkspace`/specs adapter remains role-only until root
switches composition. The parser preserves absent scopes versus explicit empty
scopes and rejects aliases that would overwrite a normalized map key. SQL must
still verify exact eligible sets, canonical UUID scope aliases and current locks.

For child routes, the internal curated `public.eps_get_casting_context(text,uuid)`
returns exactly `{workspace_id,slot_id,role_id,workspace_candidate_id}`; the pool ID
is null for `slot`, non-null for `assignment`. It requires current corresponding
workspace/project read or write authority and returns no facts or media. Archived
identity remains readable for an already committed idempotent acknowledgement.
Every mutation independently rechecks permissions/parents in its transaction.
The adapter binds public results to these parents and route IDs, validates the
Main inverse/affected rows, and rejects malformed/private/cross-scope DTO fields.
No new external HTTP/MCP operation exposes this internal read.

All mutation context keys are bounded1..200 characters, required, preserved
exactly and rejected for header control characters. Request correlation and
`clientType=browser|api|mcp` are metadata, never authority. The central adapter
derives the acting principal from its current verified user session/JWT; it must
not accept `CastingAuthority`, private inverse records or actor claims from bodies.
List default25/max100 and opaque cursor max4000 are parsed strictly. SQL pagination
must bind the cursor to workspace/output and deterministic ordered scope; changing
filters restarts pagination. A draft-revision fence is recommended for order edits.
Mutation input has a64KiB serialized UTF-8 operation budget in both central adapter
and draft SQL; oversized notes/wording/order requests fail before parent RPC reads.
This is a technical transaction budget, not a casting headcount maximum.

## State and revision rules

New assignments are Option with explicit Shortlist false by default. Direct
Shortlist creation sets true and also appears in Selection. Selection is derived
from every active assignment; there is no editable Selection field. An existing
active candidate/slot relationship is returned unchanged: create never resets its
position, notes, wording or Shortlist choice. A later Shortlist change uses patch
with its current assignment version. Re-adding after explicit removal creates a
new Option; archived assignment/history remains retained.

Main is independent from Shortlist. Position never changes `sort_order`. The
dedicated Main operation accepts a target assignment in the same active slot or
null. It demotes the old Main to Backup and promotes the target atomically. Null
clears Main; no Main is valid. A target already Main, or clearing an already empty
slot, is a successful no-op after current slot-version validation.

Root confirmed that **both Main promotion and Main demotion/clearing use the
dedicated operation**. Patch permits Option/Backup only for a current non-Main.
Trying to demote the current Main by patch returns `MAIN_OPERATION_REQUIRED`,409.
Other notes/Shortlist/wording edits on a Main remain allowed.

| Change | Assignment revision | Slot revision | Workspace row/draft revision |
| --- | --- | --- | --- |
| New assignment | starts1 | +1 | +1 once |
| Remove assignment | +1; archived | +1 | +1 once |
| Option/Backup position | +1 | +1 | +1 once |
| Main set/clear/Undo | each changed row +1 | +1 | +1 once |
| Notes/Shortlist/wording | changed row +1 | unchanged | +1 once |
| No-op | unchanged | unchanged | unchanged |

Notes are assignment-local. `presentation_notes` and `internal_notes` are separate;
internal notes must never enter external/render-safe data. Wording has only the
ten published keys. Omitted keys preserve overrides, null removes the override
and inherits source again. Outer ASCII space/tab/CR/LF is trimmed; blank text
normalizes to null. Interior whitespace and NBSP/other Unicode are retained.
There is no undocumented10k cutoff. The parsed-operation64KiB budget is shared
with the central adapter; stored wording can grow through separate valid patches.
The planner never
changes reusable profile facts, project availability or selected media. Shape
validation cannot prove semantic truth: source-backed review/AI assistance remains
separate and must not claim a factual guarantee from this parser.

## Audited Main Undo

The private event projection is `MainUndoRecord`: event/workspace/slot IDs,
resulting slot revision, consumed flag, and1..2 changes containing assignment ID,
previous/resulting positions and resulting assignment revision. The SQL agent
stores immutable before/after assignment DTOs plus slot revisions under the audit
event, and projects this narrow record; consumption is append-only.

Only the public inverse is returned: event ID, slot ID, expected resulting slot
revision and exact previous assignment positions. Undo validates the body/path
slot, event scope, exact inverse ID/position set, unused authority, current slot
revision, and every affected assignment's resulting revision/position/activity.
An affected note edit invalidates Undo even when slot revision did not change.
An unrelated note edit survives and does not prevent a safe inverse. Another
currently permitted actor, including MCP, may apply the valid inverse; there is
no human-only or original-author-only gate.

Successful Undo returns changed rows and `undo:null`, and requests consumption of
the original event. It does not expose generic role/slot retirement restoration.
Retirement-effect contracts remain a separate integration task; MainUndo cannot
serve as archival Undo.

## Persistence and error contract

Recheck current capability/project/child relationships before returning a cached
idempotent acknowledgement. Same actor/operation/key plus changed body returns
`IDEMPOTENCY_KEY_REUSED`,409. Original same-key replay returns its own committed
acknowledgement before comparing the old requested revision against the post-write
state. In particular, same-key Undo can replay its success after consumption;
fresh-key use of consumed authority fails. No idempotency is claimed by a pure plan.
If duplicate resolution changed an affected assignment's pool relationship, old
cached acknowledgements must fail with typed stale state rather than replaying a
receipt bound to a different current parent. The draft kernel applies that fence.

Lock current workspace first, then relevant slot/assignments in the agreed stable
order. Recheck revisions after lock waits. Use composite same-workspace FKs and
partial unique boundaries for active candidate/slot and active Main. Demote before
promoting in SQL. Apply assignment changes, aggregate revision, audit inverse and
idempotency receipt in the same transaction. No network/provider work under locks.
Do not expose assignments in a released state before required post19 lifecycle
hooks are composed; preserve Ready supporting files and existing project pins.

Typed domain errors: `VALIDATION_FAILED`400, `AUTH_REQUIRED`401,
`CAPABILITY_REQUIRED`403, `RESOURCE_NOT_FOUND`404, `STALE_RESOURCE_VERSION`409,
`MAIN_OPERATION_REQUIRED`409, `MAIN_UNDO_INVALID`409,
`MAIN_UNDO_ALREADY_USED`409 and `ASSIGNMENT_STATE_INVALID`409. The last protects an
inconsistent server projection; it is not a mechanism to repair conflicting rows.

## Evidence and remaining integration

Sixteen focused domain tests pass, including independent two-role choices,
Shortlist/Main separation, current-version no-ops, strict inputs, null overrides,
scope/permission denial, archival/history, exact inverse/consumption fences,
unrelated-note preservation and deterministic ordering. The initial test run was
RED for the missing module before implementation. Typecheck and scoped lint pass.
Nine installed-SDK synthetic-boundary checks pass for exact RPC arguments,
verified-actor binding, parent reads, strict response decoding, safe business
errors, removal Success, durable-idempotency delegation and full reorder. The
broader domain/server170 and central124 tests pass. These deterministic checks
are not SQL concurrency, live permission, HTTP/MCP or browser acceptance.

Root integration needs: compose barrel/studio service types; existing HTTP/MCP
catalog entries routed to the new central adapter; Main conflict/Undo controls;
switch full reorder composition; scoped retirement and
duplicate-collapse hooks. SQL/list/idempotency/race proofs, actual API/MCP/browser
journeys, Pending/cover projection, series/review/template/AI and M05 remain open.

## Unwired board handoff

`apps/web/components/CastingBoard.tsx` is a new standalone client component; root
has added the responsive `casting-board-layout` styling separately. Props are
`workspaceId`, `projectId`, `actor`, optional `initialOutput`, `onDirtyChange` and
`onWorkspaceChanged`. It remounts by actor/workspace, bounds read/write attempts,
guards late reads, loads all structural pages with a draft-revision fence and
derives counts from real active assignments. Profile labels are separately
permission checked; failed refreshes remove cached labels instead of implying a
current reusable-fact read. Selected project frames remain the actual pinned IDs.

The component includes the role/slot board, existing-pool add/direct Shortlist,
Main set/clear/server-bound Undo, Option/Backup, explicit Shortlist, assignment
notes/removal and keyboard move-earlier/later operations. Shortlist follows the
shared order; its toggle changes only the local view. Root should coordinate or
hide the outer working-output selector when wiring this view, rather than show
two independent selectors. An unknown save retains its exact operation keys and
locks other writes for an explicit same-request retry. Known failed edits keep
note text visible with a copy/discard/reload repair path. No private notes or
credentials are persisted in browser storage.

The board is deliberately unwired until the composed database work is approved.
Typecheck/scoped lint pass; no browser, responsive rendering, keyboard runtime,
actual API/MCP or persisted board acceptance is claimed here. Move/copy actions,
display-wording editing, candidate inspection drawer and final Review remain
later M04 integration work, not silently completed by this first board slice.
