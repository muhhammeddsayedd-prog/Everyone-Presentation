# Workspace summary source checkpoint

This isolated backend slice implements `getWorkspaceSummary` through the shared
domain DTO/validator, acting-user central SDK, `GET
/api/v1/workspaces/{workspace_id}/summary` and read-only MCP
`get_workspace_summary`. It contains additive migration35 source
`20261031182038_m07_workspace_summary.sql`. The migration and transactional SQL
fixtures have **not been executed**. Nothing in this checkpoint claims hosted
availability; root owns database proof, coordinated integration and deployment.

The closed DTO is in `packages/domain/src/workspace-summary.ts`; OpenAPI,
self-contained MCP schemas and generated runtime validation publish the same
shape. The finite Ready-series limit is 1000, with an explicit failure above the
limit. Sorting, duplicate identities and cross-count consistency are validated
at the SDK boundary. `review_issue_count` is always null. Unreviewed is null
without current `cast.read`, never a fabricated zero.

The stable RPC uses the existing `eps_review_owner`, its current RLS and
`workspaces.read`/canonical project scope. Its only additional existing-owner
privilege is execution of `eps.cast_is_reviewed(eps.candidates)`. No role
attributes, RLS, auth hooks, processing flags, jobs, old Ready versions or
Reviewed facts are changed. No library query runs in the capability-absent
branch. The function is stable so gates, revisions and aggregates share the
caller statement snapshot. The existing workspace constraints enforce revision
lower bounds; the new RPC and DTO enforce the JavaScript safe upper bound.

Role clarification counts combine unknown headcount with unresolved role
markers, once per active role. Selection counts every active assignment joined
to active slots/roles; Shortlist is explicit. Open slots are actual active slots
without any Selection assignment, including provisional slots. Participation
retains globally archived library people. Ready entries keep separate audiences
and validate the pointer's status, series, workspace and version number.

The central fixture adapter fails explicitly for this operation; it cannot
assemble accurate casting totals from the foundation-only fixture store.
Synthetic HTTP/MCP tests use the actual central SDK and official MCP client
with an explicit fake HTTP boundary, and do not receive cloud credit.

`tests/db/m07-workspace-summary.sql` is a standalone rollback-only local fixture
source. It requires the reviewed local fixture marker, postgres and a free
synthetic namespace. It covers empty and more-than-one-page cases, clarification
and provisional semantics, Option/Main/Backup, explicit Shortlist, repeated
people across slots, archival, Reviewed fingerprints, separate Ready audiences,
null pointers, 1001-series overflow, inconsistent workspace pointers, current
capability/project revocation, archival and anonymous/service-role denial.
Artifact rows are synthetic metadata and prove no rendered bytes. SQL/PL/pgSQL
parsing is syntax proof only. The migration deliberately retains the current
`postgres` database guard and exact 34 history; any later clone proof must use a
separately reviewed owned-target transformation rather than silently bypassing
that guard.

Shared files requiring preservation during frontend integration are the generic
API route, MCP dispatcher, domain exports, OpenAPI/catalog/runtime schemas,
operation inventory and generated parity reference. No frontend component or
Claude worktree file changed. See main's source-only
`development/m07/frontend-contracts/PROPOSAL.md` and the acknowledgement in
`tracking/PARALLEL_WORK.md` for the coordinated nullable count semantics.

The hosted pilot, accepted Claude initial authorization/reconnect/project read,
English release and recovery evidence remain separate and preserved. AT-072
manual screen-reader acceptance stays pending; mobile stays skipped. No new
language labels or language selector are part of this slice.

Verification commands and results are recorded in `verification.json`. Database
execution, signed-in display integration and an actual MCP summary read remain
for the coordinated later release.

The snapshot behavior follows [PostgreSQL function volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html).
Function privilege/search-path handling follows [Supabase database functions](https://supabase.com/docs/guides/database/functions).
