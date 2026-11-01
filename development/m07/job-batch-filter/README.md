# Job batch filter source checkpoint

Implemented source in an isolated backend worktree, base8be5ce4. No commit,
official migration creation, SQL execution, private input, provider, deployment,
worker or process-control operation was performed for this slice. An offline
`npm ci --ignore-scripts` installed the existing lockfile only into this worktree;
it did not modify dependencies, the lockfile, Main or Claude's frontend.

The new required-five-argument RPC copies the exact current four-argument list
body (SHA256a2239225b995673e9ab432ac63014f742b25032cc586c790535db260c551d241),
adding only the nonnull batch guard and SQL equality predicate. Existing actor,
capability, project access, row DTO, status, UUID ordering, cursor and page logic
and requester-only Cast Library frame access remain identical. The old function's
complete pg_proc row must remain unchanged. The builder composes original M02
plus the two exact M03 patches and independently verifies the result against the
protected applied30 catalogue source SHA. The initial M02-only draft was caught
before execution; its tests lacked frame authority coverage. No SQL or Main
change occurred from that incorrect draft. Revised fixtures include cast-only
requesters, origin operators, other-requester frames and cast-read revocation.
The new function is owned by `eps_jobs_owner`, authenticated-only EXECUTE with
no PUBLIC/default-ACL leak, no persistent schema CREATE and no new table grants.

`candidate.sql.txt` is **not a canonical migration**. Its admission requires an
owned-local source-name, the existing local system ID, postgres session, explicit
proof marker and exact37 history. A future reviewed Root controller must add its
exact name/OID/marker admission before calling it. Root will supply the official
next migration filename and canonical history guard separately; no timestamp is
invented here. Preserve functional body bytes when promoting the candidate.

`fixture.sql` is source-only and must run inside that controller's savepoint,
with all feature DDL/data/temporary roles rolled back and original database,
Auth/Storage/global-role/lock cleanup verified by the owning controller. It
creates only synthetic actors/projects/workspaces/jobs and calls the real new
and old RPCs. It checks same-batch rows across two projects, workspace-read and
operations-read paths, cast-only own-frame access without origin membership,
foreign-frame and ordinary denial, no-membership/no-capability denial, revocation,
null/other batch exclusion, status intersection, exact three-page UUID traversal,
legacy unfiltered results and direct-table/anonymous denial. It does not enqueue
work, call a provider, claim a lease, process media or establish restore credit.

Inert verification commands, using this worktree's installed Node dependencies
and the existing project Python environment:

```text
node tools/run-tests.mjs tests/domain/job-filters.test.ts packages/central/test/jobs.test.ts tests/server/job-batch-filter.test.ts tests/server/job-http.test.ts
npm.cmd run test:contracts
npm.cmd run typecheck
<existing-project-python> -X utf8 -B development/m07/job-batch-filter/test_candidate.py
```

The Python checks parse the complete draft and every fixture SQL/PLpgSQL block,
including function arity inside actual PLpgSQL expressions and controlled error
queries. These checks do not resolve PostgreSQL names or substitute for Root's
future actual owned-native fixture execution. No operator entrypoint is included.

Shared DTO/HTTP/MCP contract is documented in
`docs/integrations/JOB_BATCH_FILTER.md`. Request3's optional workspace-bound batch
summary and counts remain separate. No frontend or full redesign merge belongs
to this patch. Existing canonical37/web37 acceptance and all historical sealed
sources remain Root-owned and unchanged in Main.

Initial verification passed24 focused/13 contract/6 inert checks but did not
establish current frame-authority coverage; review retracted the broad clearance.
Revised verification is recorded in the handback after the M03 composition and
cast-only MCP regressions pass. The expanded fixture has58 parsed SQL
statements/7 SQL or PLpgSQL blocks; the draft has14/3. Native Postgres execution
and hosted filter acceptance remain unverified. No source commit was made.

Corrected source verification:25 focused domain/SDK/HTTP/official-MCP cases,
6 existing M07 authority cases and7 inert SQL/source checks passed. The old
authority test that hid reads for cast.read was corrected with an explicit
no-read-capability negative. Full `npm.cmd test`, typecheck, targeted lint and
diff checks then completed with exit0. Full test output was truncated; no
reconstructed aggregate count is claimed. The MCP preliminary-gate correction
applies only to list_jobs/get_job, with retry/cancel and all final SQL/RLS checks
unchanged. Root must still execute the owned native fixture before integration.
