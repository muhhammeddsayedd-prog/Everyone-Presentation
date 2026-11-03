# Reuse data returned by source lock acquisitions

Source-only candidate; entry disabled. No migration, database query, benchmark,
provider call or production change has been executed by this purpose.
`before-body.sql`, `candidate-body.sql` and `body.diff` expose the exact body
change for review. They are function-body artifacts, not runnable migrations.

## Evidence and fixed baseline

Actual diagnostic d958 completed the source-locking boundary in 6844.887972 ms
and assignment enumeration in 420.171976 ms before whole generation cancelled
at 8000.76 ms with SQLSTATE 57014. These are instrumented boundary intervals,
not individual-query costs; nested durations must not be added. This motivates
removing repeated data reads inside the helper but proves no speedup.

The exact raw receipt is
`tracking/evidence/m07/presentation-generation-stage-diagnostic/2026-11-03T02-34-41.040Z-d958af2c.json`
in Main, SHA256
`347a3d1bdee31a8367e9656b324789a72cc90fbd8358ac22150846f31f5c8099`.
The safe outcome is `d958af2c-outcome.json` beside it (Recovery commit 427e424).
The application failed; diagnostic custody and cleanup passed.

Pinned source is `../presentation-lock-source-pool-reuse/candidate.py`, SHA256
`c646bc4f62b3c98f836398edf19ff2d66e49c9ef851f62cdce7c6e54063a2a5d`.
Its inherited source chain is checked by that frozen builder. Before body:
`280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4`.
Candidate body:
`aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3`.
Four closed, once-only substitutions must invert to the exact baseline bytes.
Signature, existing invoker mode/search_path, declarations, scope checks and
exception conversion remain unchanged. No other function body changes.

## Four finite edits

1. Return `client_id` from the existing project `FOR SHARE NOWAIT` query;
   remove its second scalar SELECT. No FOUND branch or STRICT is introduced.
   Missing project rows and NULL client IDs still produce NULL.
2. Return active assignment pool IDs from the original assignment lock stream.
   The outer aggregate deduplicates IDs; the inner query locks every original
   assignment, ordered by assignment ID, including duplicate pool references.
3. Feed the existing MATERIALIZED selected CTE directly from the pool lock
   stream. Keep its DISTINCT outside that stream and its exact four fields.
   Remove the earlier pool/assignment EXISTS scan and the post-lock pool reread.
   Reset the existing pool-ID variable from actual selected rows; keep original
   candidate/media/frame arrays, ordered zipped pairs and NULL handling.
   Referenced archived pools remain included; no pool archive filter is added.
4. Return source asset IDs from the original media lock stream into the existing
   asset-ID variable. The original logo/video/frame union consumes those IDs
   instead of rereading media. A NULL source does not suppress its media lock;
   the unchanged final union discards NULLs. Empty aggregates remain UUID `{}`.

## Full consumption and row lock order

The 12 stages remain projects, clients, template, specs, roles, slots,
assignments, pool, candidates, media, assets, frame pairs. Each keeps SHARE,
NOWAIT, its original row predicate and original ordering. No extra table is
locked. The three changed multiple-row acquisitions use an ordered inner SELECT;
there is no DISTINCT, grouping, aggregate, LIMIT, offset or new filter at that
locking level. DISTINCT/array aggregation occurs only outside it.

Each outer aggregate consumes its entire inner stream. The pool CTE is
MATERIALIZED and its unfiltered first ID aggregate consumes every selected
row; all projections finish before the next candidate-table statement starts.
No caller cursor, LIMIT or conditional EXISTS can stop the stream early.
Selected fields come from locked row versions. All acquired locks stay owned
by the existing transaction and the original lock-not-available conversion stays.
The [PostgreSQL SELECT rules](https://www.postgresql.org/docs/17/sql-select.html)
make placement significant: an outer filter can narrow a subquery's locked rows.
The parser/AST checks explicitly reject such narrowing and invalid same-level
DISTINCT/aggregate locking shapes. Parsing is not database operator resolution
or proof that all physical row locks have been obtained.

## Necessary equivalence boundary

The helper itself does not lock the workspace. The pinned sole public generation
caller takes workspace FOR UPDATE before invoking it. Supported membership
writers use that fence; earlier independent source review also checked the
direct candidate-apply/link/archive routes. Existing SHARE locks prevent changes
to returned assignment/pool/media fields while later stages run. The selected
set therefore cannot gain an application phantom between lock and reuse.
Standalone unfenced helper calls and arbitrary privileged DML are outside this
equivalence claim; the tests retain a phantom counterexample.

Assignment pool IDs replace an EXISTS without an assignment workspace filter.
This requires the actual immediate composite FK:
`eps.assignments(workspace_id,workspace_candidate_id)` references
`eps.workspace_candidates(workspace_id,id)`. Pinned metadata SHA256
`12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c`
proves its ordered columns, validated status, NOT DEFERRABLE and not initially
deferred. Future actual admission must bind conrelid/confrelid, ordered
conkey/confkey and all three flags, not just the constraint name. Deferred or
invalid cross-workspace data is not admitted.

Every lock query still runs its original acting-user SELECT/UPDATE policies.
No authority result, session, clock, membership or capability is cached; no GUC,
policy, grant, function owner or definer mode is introduced. Entry and footer
`presentation_scope(p_workspace,true)` are byte-identical. Fresh late gates and
READ COMMITTED authority/race checks remain required, including expiry before
return. Returning data from a successful lock is the only reuse. Existing field
SELECT rights were already needed by the old rereads. Exact error precedence
under concurrent grant/DDL changes is not claimed: fewer read statements can
move the point at which an error is raised. The
[Supabase function guidance](https://supabase.com/docs/guides/database/functions)
distinguishes invoker privileges from definer privileges; this candidate keeps
the helper's original execution mode and search_path.

## Memory and acceptance limits

No new PL/pgSQL variable or full private-row cache is added. The existing pool
array holds unique active assignment references, then actual locked pool IDs;
the existing asset array briefly holds unique locked media source IDs before
the original final union overwrites it. Under the FK, workspace fence and
successful original RLS scope these are the same referenced UUID domains that
the old helper already collected. The existing selected CTE keeps the same four
fields, including its already-unbounded selected-frame arrays.

This is not a new 4 MiB record cache and needs no record-cache fallback. There
is no invented numeric row bound: PostgreSQL's existing allocation limits still
apply. Outer aggregate/sort work and transient old/new UUID arrays may change
peak memory; no constant-memory or measured resource improvement is claimed.

Offline checks cover finite inverses, final PL and embedded SELECT parsing,
full-stream AST restrictions, all 12 lock predicates/order/strength, declarations
and footer, source fields/NULL/empty behavior, archived/duplicate relations,
pinned immediate FK/caller and explicit invalid-FK/unfenced counterexamples.
They do not prove execution, current production metadata, performance or races.
Before runtime/release selection, a newly reviewed owned purpose must prove
actual lock sets/NOWAIT, current authority/expiry/RC races, full restoration,
and the fresh complete generation/semantic acceptance within the unchanged 8 s.
Earlier 393/278/c35 scopes remain dated evidence for helper280, not acceptance
of this changed helper. All earlier failures and claims remain frozen.

Focused command (offline only):

```powershell
D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe -X utf8 -B -m unittest discover -s development/m07/presentation-lock-acquisition-reuse -p test_candidate.py
```
