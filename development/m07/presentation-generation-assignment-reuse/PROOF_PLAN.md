# Bounded assignment enumeration candidate

Source preparation only. `ENTRY_ENABLED = False`; no runner, migration, SQL,
Docker or provider call is included. Consumed sources, claims and receipts are
unchanged. This candidate has no measured performance result.

## Observed baseline and limits

The one actual diagnostic `13f5ba7e` returned normal process exit0 and preserved
the application's statement-timeout failure: code57014, SQL8001.129ms and
client8006.7785ms. Its protected1000-byte context was independently hash/ACL
verified. Safe receipt SHA `24bfbc438f1e9f77a85d0ec56e0bf6905ec801cca71dcc16dadb9780d3e74acf`
and outcome SHA `7b3142cddcfd28dbaa34fdfa0febc07bffb384f53fdacd79e877f27b06131587`
remain dated evidence, not a performance pass. Failed combined78 remains open.

The actual stack reached `eps.mcp_token_permits_capability:4` through
`has_capability`, `project_scope`, and `review_scope` while
`eps.review_snapshot_data:36` enumerated one slot's active assignments. The
public generator was at line26, inside its review call. This identifies the
active cancellation location, not cumulative stage cost, actual invocation
counts, the first/last slot, or failed78's exact cancelled phase. The fixed large
fixture has16 active slots and19 active assignments; sixteen enumeration queries
and up to sixteen NO_MAIN queries are nominal complete-path source counts.

The source baseline is helper280 plus the existing four candidate bodies.
`candidate.py` changes only review DATA body
`4b37255bd919719086175f5df2b197584555f3c08000ee13fe18a7dbe62f8cc3`.
It pins the frozen four-body builder, applies five exact body edits, and proves
the inverse is byte-equal. No consumed builder/projection or production source
is edited. The other three candidate bodies and helper280 remain exact.

Pinned metadata12df contains active-assignment index
`(workspace_id, slot_id, sort_order, id) WHERE archived_at IS NULL`, the active
slot/candidate unique index and one-Main index. It also contains the validated
composite `(workspace_id, slot_id)` foreign key, with its default NOT DEFERRABLE
and immediate behavior. There is no captured execution
plan for the timed-out query, so this proposal adds no index and promises no
specific scan plan or RLS invocation reduction.

## Finite change and equivalence boundary

At the first original active slot, after its original provisional warning,
enumerate RLS-visible active assignment rows for the current workspace/output
once, ordered by slot_id/sort_order/id. Store only typed row data in function
locals. The collection includes no capability, membership, session, denial or
clock result and is never put in a GUC, session store or public JSON.

Use the existing shared4194304-byte row-data budget. Count physical composite,
serialized field bytes, identity bytes and conservative entry overhead, including
TOASTed/private internal notes. Stream into the collection row by row; do not
aggregate all full rows before checking the budget. If any row does not fit,
discard every retained assignment row, refund only the bytes accepted by this
enumeration, mark it incomplete, and fall back to the original per-slot table
query. No row limit, partial answer, retry or changed snapshot budget is added.
An empty complete collection is a complete data enumeration, not an authorization
decision. An expired/denied caller must still fail the unchanged live gates.

Keep original role/slot traversal. Each cached slot branch repeats the complete
original workspace/slot/archive/output predicate and sort_order/id order. The
UNION ALL fallback is mutually exclusive, retains the original complete table
predicate/order, and does not accumulate an unbounded per-slot result array.
Only the original database branch is eligible on incomplete collection; no
partial rows can enter output. False-branch RLS or init-plan startup work may
still occur, so source inspection does not promise zero authorization work.

Derive NO_MAIN from the same included rows already traversed, resetting the flag
per slot. This is equivalent to the old slot-only EXISTS specifically because
the validated, nondeferrable/immediate composite foreign key makes assignments for a slot share its
workspace, and the actor's assignment SELECT policy remains
`eps.review_scope(workspace_id)`. Position, shortlist and archive predicates are
unchanged. The pending/NO_MAIN/provisional warning order is retained.
An actual proof must read `pg_constraint` for this exact relation/name and require
convalidated=true, condeferrable=false and condeferred=false before using this
candidate. A deferred constraint allowing a temporarily inconsistent workspace
would invalidate the NO_MAIN replacement; it is not an admitted state.

Whole-workspace prefetch can read authorized assignment rows belonging to an
archived or otherwise unvisited role/slot earlier than the original traversal.
They consume budget but never enter output, because original role/slot traversal
is unchanged. This can change cost and technical error timing. Overflow must
produce complete original-query fallback; unconditional error-precedence or
performance equivalence is not claimed. There is no catch masking a permission,
timeout or technical failure during loading.

Both old and new DATA functions remain STABLE and use the same calling-query
snapshot. This justifies consistent row data, not an authorization cache or a
claim that clock expiry cannot occur. The exact wrapper's start and return
`review_require` plus `cast.read` checks remain intact, as do all direct DATA
callers' existing guards. The public generator's workspace fence, helper280's
lock order/NOWAIT and entry/exit checks, final fingerprint/revision validation,
English validation, version freezing and idempotency are unchanged. No extra
privileges, function, SECURITY DEFINER, policy or timeout are introduced.

## Official security and SQL constraints checked

The current [Supabase functions guidance](https://supabase.com/docs/guides/database/functions)
prefers SECURITY INVOKER and explains that definer privileges can expose rows
the caller cannot read. This source keeps the exact existing function identity,
default invoker behavior, STABLE option and empty search_path; it does not turn
one-pass enumeration into a privileged function. Signatures, owners, OIDs, ACLs,
configuration and RLS must remain exact in any actual proof.

[PostgreSQL17 volatility documentation](https://www.postgresql.org/docs/17/xfunc-volatility.html)
defines the calling-query snapshot used by STABLE functions.
[PostgreSQL17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
keeps normal table reads subject to actor policies. The new enumeration uses
ordinary schema-qualified table reads under those same policies. Generic skill
examples of definer helpers or cached auth initPlans are not applied.

## Offline checks and required actual proof

The offline suite checks SQL/PLpgSQL parsing, complete function-option equality,
five-edit inverse, cached/fallback whole predicate AST and order equality,
shared-budget all-or-nothing source guards, Selection/Shortlist row/order/Main/
Pending behavior, invisible/archived/unvisited rows, exact pinned FK/policy/index,
including deferred/not-valid FK negative cases,
oversized private-row fallback, preserved application calls/errors/outputs, and
disabled-before-assembly behavior. These are source/contract checks; they do not
establish PostgreSQL operator resolution, real RLS execution, concurrency or time.
A RAM-only mutant dropping cached Shortlist filtering must turn the AST equality
regression RED with the real source restored GREEN and disk hashes unchanged.

Before any new actual test, Root reviews this finite candidate and the subsequent
fresh default-off proof source/plan. Do not rerun old controllers or claims.
The next runtime should first make exactly one fresh-backend candidate MCP-large
public generation under the same8s controls, before component/warm queries. Keep
the private cancellation-context instrument in the temporary measurement only;
retain its safe code/server/client measurement before assertions. Failure stops;
no warmed retry or timeout/authority relaxation. Success alone is not release
acceptance: fresh old/new normalized review/fingerprint/snapshot/manifest/pin/
companion equality and the previously unreached combined contracts remain due.

The reviewed proof must include Selection and Shortlist, active versus archived
scope, tie ordering, no-Main/Main excluded from Shortlist, empty slots/no rows,
actual actor RLS and denied membership/delegation, and unchanged final live-clock
expiry behavior including empty tails. An actual unbounded private
`assignments.internal_notes` canary may exceed4MiB under outer rollback to verify
complete fallback without changing public facts; the pinned table has no text
length CHECK on this private field. Preserve old Ready rows and full state after
rollback; no immutable trigger suppression or new fixture grants.

Capture any SELECT-only query-plan evidence after the first measured call in a
separate owned backend, with the same actual role and8s bound; do not EXPLAIN
ANALYZE the mutation function. No EXPLAIN/provider/SQL is authorized now.
Any runtime uses a new purpose/UUID/once claim, original shared lock and pinned
38-to39-to40 bootstrap, complete pg_proc identity and five-prosrc mask, full
fresh before/after state and original29 catalogue/data/global-role preservation,
exact resource cleanup, successful same-engine empty label inventories and fresh
shared-lock absence. No cross-run fixture-UUID raw-hash equality claim is allowed.
