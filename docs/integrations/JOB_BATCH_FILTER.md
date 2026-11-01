# Optional batch filter on job listing

Deployed on canonical schema38 and pilot web4Gm85. Preserve the passed signed-in
HTTP checks, owner-attested MCP empty filtered page, and isolated205-record
PostgreSQL pagination proof (100/100/5). Hosted nonempty pagination and actual
contributor/requester-frame cases are separate unverified scopes. See the
[bounded acceptance delta](../../development/m07/ACCEPTANCE_DELTA_2026-11-01.md).

Request3's first slice extends the existing `list_jobs` operation only:

```text
GET /api/v1/jobs?workspace_id=<workspace>&batch_id=<lowercase-UUID>&status=queued&limit=25
MCP list_jobs({ workspace_id, batch_id, status, cursor, limit })
```

`batch_id` is optional and must be a lowercase UUID. It groups existing jobs;
it grants no project, workspace, library, guest or service authority. Ordinary
jobs retain `operations.read OR owning workspace read` and
`eps.jobs_can_access(workspace_id,'read')`. Frame jobs retain the M03 requester-only
`cast.read` / `eps.frame_user_can_read(jobs)` branch, including legitimate global
requester access without origin-project membership. Both branches remain final
SQL/RLS authority; neither may fall back to the other's read scope.
A global batch filter still returns only rows the caller can currently access.
An inaccessible workspace retains the existing empty-page semantics. Missing
job-read capability retains `CAPABILITY_REQUIRED`; ordinary authentication and
current actor verification are unchanged.

The result stays `{data: Job[], page: {next_cursor: string|null}}` under the
normal HTTP/MCP request envelope. Filtering occurs in PostgreSQL before the
existing ascending job-ID order, cursor and `limit+1` page window. Status,
workspace and batch filters intersect. No first-page-derived total, global
batch count, new order, opaque cursor format or batch-summary operation is added.
Keep the same filters while traversing cursors; the existing cursor is an ID
threshold, not a snapshot or a filter-bound capability.

`JobListOptions` and its closed parser live in the shared domain package and are
re-exported by Central for existing import compatibility. The HTTP mapper and
SDK use the same parser; published MCP input validation accepts the same optional
UUID. Invalid/duplicate/unknown HTTP options fail before the service, and actor
overrides remain rejected. Provider rows from another batch fail DTO validation.

Unfiltered SDK calls continue to invoke the unchanged four-argument
`public.eps_list_jobs`. A supplied batch uses the distinct
`public.eps_list_jobs_by_batch(uuid,text,uuid,integer,uuid)` with five required
arguments. This avoids PostgREST overload/default ambiguity and preserves old
web/SDK clients. The new function has the existing `eps_jobs_owner`, empty search
path and current scoped read checks; only authenticated EXECUTE is granted.
No existing function, table, policy, role membership, workflow, worker, OAuth
client or environment changes are part of this slice.

Review exposed an existing MCP parity bug: the preliminary catalogue gate on
`list_jobs` and `get_job` omitted `cast.read`, despite canonical M03 supporting
cast-only requester frame reads. Both read-tool expressions and their recognized
preliminary gate now include `own frame read`; retry/cancel are unchanged. This
aligns advertising with existing SQL authority without adding any grant or OAuth
scope. Current actor, requester, resource and project checks still run in SQL.

Canonical migration38 `20261101110939_m07_job_batch_filter.sql` is applied.
The actual once-claim release returned normally and passed two equal full-state
readbacks; the separate readback passed two equal static reads. The old RPC,
permissions, all74 business-table hashes and trace rows stayed unchanged.
Evidence: `tracking/evidence/m07/job-batch-filter38-release/2026-11-01T17-28-00-388406Z-apply.json`
and `2026-11-01T17-28-42-546410Z-readback.json` in that folder. The actual owned
local proof also passed205 accessible jobs over100/100/5 pages, foreign/batch
exclusion, scoped authority and exact rollback/cleanup. Backend core, tests and
contracts from branch checkpoint758affc are integrated into Main; the stable
pilot serves compatible web/SDK `dpl_CUXVUZkWjkrQPBTv7XqmA9tF3y4o` with285 sealed
source files. Signed-in HTTP passed the empty batch filter, malformed/duplicate
parameter denials and the unchanged24-job unfiltered page. All those saved jobs
have null batch IDs: this is not a hosted nonzero batch demonstration. The205-row
nonzero case is local SQL evidence. The owner MCP empty filtered read passed;
completed connection/reconnect acceptance remains passed. Six public auth/
discovery checks passed, and the worker remains unchanged/healthy.
Frontend coordination is recorded separately; no redesign was merged here.

This implements the bounded AT-063 parity dependency, with deterministic AT-065
scope and AT-066 filtered-page checks. Representative batch/cost AT-060, full
delegated AT-064/068 and replacement/recovery acceptance retain their own gates.
Passed owner connection, English output and scoped AT-074 evidence are preserved.
