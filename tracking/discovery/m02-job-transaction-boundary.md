# M02 job/outbox local transaction boundary

The job/outbox foundation is persisted and tested on the owned local PostgreSQL
target. This is not M02 verification or a cloud release. The pinned Supabase CLI
2.122.0 created migration
`supabase/migrations/20261028162800_m02_jobs_outbox.sql`; root sealed its hash
`f619b3dfb9d964ab5902d04941b8cd59b44e9da36f1ab3f7b10bd45298ff4013`
and it was applied locally at 16:42:16 UTC on 28 October 2026. The first five
applied migration bytes remain unchanged. M01's independently reviewed permission
refresh is migration six; this migration requires precisely that six-version
baseline and becomes the seventh local version. No cloud operation, service
credential, provider or application processing runtime is enabled by this work.

The historical `development/m02/jobs-outbox-candidate.sql` and its rollback
receipts remain unchanged. They describe the earlier five-version rehearsal,
not the current persisted migration. The promoted migration also fixes the
reviewed candidate's bounded-scan starvation and post-lock replay authorization
gaps. Its dispatcher scans at most 1000 candidates, exits after the requested
number of actual leases, and can skip a held first parent to claim another job.
Mutation replay and dedupe returns repeat resource authorization after blocking
locks with a fresh READ COMMITTED command snapshot.

## Transaction and source authority

The deployed acting-user boundary remains verified Supabase user JWTs and curated
SQL RPCs. `JobRepository.transaction(callback)` in `@eps/jobs` cannot be implemented
as multiple independently committed Supabase requests. The new `jobs.ts` is a
typed get/list/retry/cancel facade, not an implementation that falsely claims such
requests are one transaction. The existing state-machine fixtures remain useful
conformance cases; their memory repository remains tests only.

The migration adds private forced-RLS `eps.jobs`, `eps.job_events` and
`eps.outbox_events`. It reuses canonical workspace/Auth FKs, the existing private
idempotency and audit tables, optimistic versions and current project permissions.
Atomic enqueue creates a job, its first outbox row, replay response and audit
together. Same frozen source/configuration reuses one dedupe identity. A cancelled
job is not silently recreated to reset its budget.

`eps.m02_enqueue_specs_job` is deliberately internal with **no execute grant to
authenticated users or eps_api_owner**. Specs/source tables do not exist yet.
Future `submit_specs` must lock and validate its actual source/specs records and
workspace revision in this same transaction before receiving an execute grant to
this helper. This foundation cannot establish source FK/provenance acceptance.
Job input contains IDs, hashes, versions and processing configuration references;
it rejects arbitrary source-text/provider-secret fields.

The database owns `eps.specs-input.pg-jsonb.v1`: SHA-256 of its fixed prefix plus
the PostgreSQL 17 JSONB text representation. Version numbers must be positive safe
integers; configuration references are bounded strings. The facade consumes the
stored fingerprint and never independently reconstructs it with JavaScript's
different sorted-JSON serializer. Future processors receive the persisted hash.
This is an explicit algorithm version, not a claim of RFC JSON canonicalization.

## Access and dispatch

The jobs function owner is nonlogin/non-BYPASSRLS, inherits only the managed Auth
baseline, and receives narrow workspace identity access. New restrictive Storage
policies deny its inherited byte authority. The separate nonlogin dispatcher role
has execute-only access to bounded claim/finish functions and no direct job/table
DML. No login or fake Auth service user is provisioned. A real service credential
and HTTP authentication mapping remain required before exposing service calls.

Current user scope is checked before mutation replay. User entrypoints reset the
private transaction-local mode; an ordinary user cannot gain dispatcher access by
supplying JSON or a custom-GUC value. Private dispatch functions establish their
constant mode internally after their execute ACL. Their outputs contain only a
bounded small workflow envelope plus a **separate private dispatcher lease**.
The lease must never be forwarded to n8n or logged.

Every mutator locks job before outbox. Claim reads a bounded candidate list without
locks, locks its parent job with `SKIP LOCKED`, then locks/rechecks the event's
identity and current eligibility. Finish locks the parent before reselecting the
event. This avoids reversing user retry/cancel lock order.

Claiming uses `FOR UPDATE SKIP LOCKED`, database clock, a fresh 256-bit token and
digest-only durable storage. Expired leases are reclaimable; old acknowledgements
cannot finish a new lease. Accepted acknowledgement is idempotent. Failed sends
receive bounded exponential jitter; five failed deliveries make a current queued
job visibly retryable. Cancelled or obsolete generations become Dead instead of
being dispatched. Cancellation does not promise to recall an already sent request.
The future sender must perform HTTP outside the transaction and acknowledge only
an actual accepted response. The SQL test's accepted flag is not provider evidence.

Retry/cancel accept the full OpenAPI JobMutation, including optional `reason`
(`string|null`, no additional schema length restriction). Exact accepted input is
included in idempotency matching. Public Job DTOs omit input, source/configuration,
stage results, dedupe values and lease verifiers. Provider diagnostics are redacted.

## Validation and remaining work

The SDK tests use the installed real Supabase SDK with synthetic injected fetch.
They cover identity binding, exact RPC arguments/DTOs, private-field rejection,
nullable reason, filters/cursors and error redaction. They are not cloud evidence.
The focused suite passed all six tests, with root typecheck and focused ESLint
passing after the optional-reason correction. Neither facade nor SQL foundation is
wired into the M01 runtime or a provider.

`tests/db/m02-jobs-outbox.sql` has an `EPS_M02_CANDIDATE_SQL` marker immediately
after BEGIN. The integration owner's runner substitutes the exact candidate,
sets the owned-target guard first and executes through the existing local target
verification. All candidate roles/tables/functions and synthetic fixtures roll
back. Assertions cover atomic failure, dedupe, current permissions, direct-role
denial, lease expiry/reclaim/fencing, backoff, acknowledgement, obsolete/cancelled
dispatch, retry budgets, version checks and event uniqueness. Tokens remain in
transaction-local test memory rather than printed rows.

Root's actual guarded [rollback rehearsal](../evidence/m02/candidate/2026-10-28T08-24-38-296Z-rollback.json)
passed at 08:24:38 UTC on 28 October 2026, matching candidate
`6d11982be08f17c435196d60891844b5691a9375af25b7b3e440bf9353506281`
and assertion file
`d6c96529bf1588f9c053c8449b6f2f6bec5ae443263a441b47cbecbd091ff30b`.
The composed SQL SHA256 was
`1a15fc2d8f32dfd619517f04034dad7c2d621371b64152bd833a532240a26279`.
Post-rollback readback restored the original five-version migration history,
30 app policies and every pre-run row count; candidate roles, tables and functions
were all absent. The [earlier harness composition failure](../evidence/m02/candidate/2026-10-28T08-23-59-899Z-rollback.json)
is retained. Root corrected literal-dollar replacement in the harness; no candidate
SQL change was needed. Independent static review covered the final lock order,
scope/fencing rechecks and nullable-reason contract. This is actual local SQL
evidence with synthetic Auth/Storage catalog fixtures, not hosted processing.

Uncommitted DDL is not visible to another session. The historical rollback alone
therefore established no two-backend behavior or committed restart durability.
The separate persisted proof below supplies those narrower local checks.

## Actual persisted local proof

`node tools/test-m02-local.mjs` passed all 27 recorded stages at 16:43:07 UTC on
28 October 2026. The [complete receipt](../evidence/m02/local/2026-10-28T16-43-07-185Z-63e90f8d.json)
seals the exact manifest and SQL sources. Independent static review preceded the
root manifest seal and execution. The [migration receipt](../../development/local-db/receipts/2026-10-28T16-42-16-770Z-replay.json)
records local application; subsequent runs accept only the matching applied hash.

The driver takes the shared local test lock, verifies all seven root migration
hashes and twenty explicit M02 SQL test entries, and checks the unchanged review
manifest before each stage. Every SQL session uses the owned Docker engine,
container labels, loopback-only publication, volume and database fingerprint.
There is no target/file/SQL command-line argument or cloud connection path.

| Actual backend pair | Recorded result |
| --- | --- |
| Same frozen input, distinct enqueue keys | One job/outbox/audit effect and two replay records; one RPC waited 1067 ms on dedupe. |
| Two eligible jobs with the first parent held | Different event IDs; the second dispatcher returned in 27 ms through SKIP LOCKED. |
| Membership revoked during cached enqueue replay | Second backend waited 1256 ms, then denied the previously authorized cached return. |
| One committed eligible event, overlapping claims | One lease; the second dispatcher returned zero leases in 6 ms. |
| Cancellation commits before dispatcher acknowledgement | Waiting acknowledgement returned stale and the outbox became Dead. |
| Dispatcher acknowledgement commits before cancellation | Waiting cancellation succeeded; the already accepted delivery remained Delivered. |

The held peer's PgSleep was observed through `pg_stat_activity`; frozen SQL
acquired the relevant lock before its reviewed four-second hold. Distinct backend
IDs, server timestamps and final effects support these concurrency checks. They
are not claims of a sampled wait event on the blocked peer or provider requests.

The [graceful PostgreSQL container restart](../../development/local-db/receipts/2026-10-28T16-42-47-805Z-durability-restart.json)
retained the same container, volume and database system identifier. Fsync,
synchronous_commit and full_page_writes were verified On. A committed queued job
and digest-only outbox lease survived. A new SQL backend refused to reclaim the
unexpired lease, then a controlled synthetic expiry allowed a fresh token and
rejected the old acknowledgement. This uses an owner-scoped test expiry update;
it does not claim that 90 seconds elapsed naturally, simulate power loss or prove
a dispatcher daemon restart. The future daemon does not yet exist. The raw lease
remained only in the test driver's memory and never entered receipts or fixtures.

The full fixture produced five jobs/outbox events, five enqueue audits, six
enqueue replay records and two cancellation audits/replays. Strict cleanup
checked recognized identities, labels, relationships and effects before deleting
only those synthetic rows, with no CASCADE or Storage deletion. Before/after
business counts matched exactly, jobs/events/outbox returned to zero, no fixture
table remained, and all seven migrations plus three forced-RLS queue relations
and restricted dispatcher ACLs remained. Any unexpected data causes preservation
and a nonzero test result. Root's later M01 regression run is separate evidence.

Still required: specs/source/role/slot schema and submission, stage-claim/heartbeat/
callback fencing and typed result application, source revision guards, scoped
worker output reservations, real dispatcher/recovery process, service identity,
n8n/OpenAI/document integration, API/UI wiring and all M02 real-service acceptance.
The WF-01 stages remain prepare_document → extract_specs → apply_specs; this
candidate does not pretend those processing stages have executed.

## Subsequent coordinated cloud release

Root subsequently applied migrations six and seven after the exact guarded dry-run. Fresh cloud readback at2026-10-28T16:56:29Z binds the seven versions,22 authenticated public RPCs/32 inspected routines and16 forced-RLS app relations. Existing business/storage counts stayed unchanged; the new queues are empty. See `tracking/evidence/cloud-processing-foundation/RELEASE_REVIEW.md` and its immutable apply/readback receipts. This supersedes only this document's earlier not-yet-applied cloud status; the source/stage/service/provider/UI boundaries remain. Actual security advisors report23 WARN findings:22 intentional scoped RPC findings and one unresolved leaked-password-protection Auth setting.
