# M02 job/outbox candidate boundary

This is isolated implementation preparation, not M02 verification. The candidate
is `development/m02/jobs-outbox-candidate.sql`, outside the five released root
migrations. It requires the owned local target and exactly those five versions.
Root must review and rehearse it inside a rollback before creating any release
migration. No cloud operation, service identity, credential or provider is enabled.

## Transaction and source authority

The deployed acting-user boundary remains verified Supabase user JWTs and curated
SQL RPCs. `JobRepository.transaction(callback)` in `@eps/jobs` cannot be implemented
as multiple independently committed Supabase requests. The new `jobs.ts` is a
typed get/list/retry/cancel facade, not an implementation that falsely claims such
requests are one transaction. The existing state-machine fixtures remain useful
conformance cases; their memory repository remains tests only.

The candidate adds private forced-RLS `eps.jobs`, `eps.job_events` and
`eps.outbox_events`. It reuses canonical workspace/Auth FKs, the existing private
idempotency and audit tables, optimistic versions and current project permissions.
Atomic enqueue creates a job, its first outbox row, replay response and audit
together. Same frozen source/configuration reuses one dedupe identity. A cancelled
job is not silently recreated to reset its budget.

`eps.m02_enqueue_specs_job` is deliberately internal with **no execute grant to
authenticated users or eps_api_owner**. Specs/source tables do not exist yet.
Future `submit_specs` must lock and validate its actual source/specs records and
workspace revision in this same transaction before receiving an execute grant to
this helper. This candidate cannot establish source FK/provenance acceptance.
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
passing after the optional-reason correction. Neither facade nor candidate is
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

Uncommitted DDL is not visible to another session. Therefore this rollback-only
candidate cannot prove two-backend dedupe/SKIP LOCKED behavior, committed restart
durability or durable scheduling. Those tests require a reviewed local application
of a frozen migration. No concurrency or restart acceptance is inferred here.

Still required: specs/source/role/slot schema and submission, stage-claim/heartbeat/
callback fencing and typed result application, source revision guards, scoped
worker output reservations, real dispatcher/recovery process, service identity,
n8n/OpenAI/document integration, API/UI wiring and all M02 real-service acceptance.
The WF-01 stages remain prepare_document → extract_specs → apply_specs; this
candidate does not pretend those processing stages have executed.
