# Durable stage attempt correlation — source candidate

This slice prepares future operator-only metadata. It is **not deployed**, is not
a canonical migration, and has not been executed in PostgreSQL. Canonical35,
the hosted web/worker, n8n settings, protected M02 job and old Ready versions are
unchanged by this source work. The source folder's `36` is a proposed next slice,
not an applied migration number or reserved timestamp.

## Confirmed gap and questions

The recorded successful English job retained only its latest n8n execution
reference,31686. The one metadata GET returned404. A separate current workflow
settings read showed execution-data retention disabled; those observations do
not prove the exact404 cause or reconstruct missing earlier execution IDs.
See the existing [handoff](../../../tracking/HANDOFF.md) and
[AT-074 requirement](../../../docs/quality/TEST_STRATEGY.md).

Operators need to answer these questions without node payloads:

1. Which stage, total attempt and per-stage attempt produced each execution ID?
2. Which accepted success/failure event belongs to that attempt?
3. Did retry/stage advancement preserve the previous binding, and was a missing
   execution reference explicitly unknown rather than reconstructed?

Existing claim functions already set `current_attempt_id`, counters, stage,
`n8n_execution_id` and `updated_at` atomically. Existing `job_events` retains
accepted event sequence/type/time by `(job_id,attempt_id)` but no claim history.
The worker's bound n8n work order and service claim input remain unchanged.

## Finite source change

`candidate.sql` adds a typed, append-only `eps.job_stage_attempts` table and one
`AFTER UPDATE OF current_attempt_id` row trigger on `eps.jobs`. It records only
a distinct new non-null attempt ID after existing claim validation succeeds.
The record and claim commit or roll back together. Same-ID claim replay,
heartbeats, callbacks, enqueue, cancellation and recovery without a fresh claim
produce no new row. Unique job/attempt, total-attempt and stage/attempt keys
reject conflicting identities. An insertion failure aborts that claim rather
than silently leaving a correlation gap.

The trigger additionally requires the running status and one-step claim-counter
and row-version increments, retaining job kind/source hash/correlation identity.
This is a guard on the established claim transition, not another authorization
implementation. All existing claim/event functions, lease checks, actor checks,
retry budgets and domain application remain unchanged.

The fourteen fields are schema version, job/attempt IDs, kind/stage, total and
stage counters, dispatch generation, correlation ID, input hash, workflow
execution reference/state, claim timestamp and job row version. No payload,
input/result/error object, source/transcript text, raw event ID, lease, digest of
a lease, actor/session identity, auth header, node data or request URL is copied.
Execution references follow the existing worker's200-character ASCII reference
grammar. Missing references use `not_provided`; unsafe direct/legacy text uses
`invalid_omitted` with a null reference. Its unsafe original is never copied.

There is no historical backfill. A job already running when a future migration
is installed has no row for that old attempt; its next genuinely new claim is
captured. Existing31686 and earlier stages stay historical/unreconstructed.
Route failures before a successful claim remain diagnosable through existing
outbox/job state; this table does not pretend that they acquired an attempt.

## Security and access

The new `eps_job_trace_owner` is non-login, non-inheriting and has no bypass,
database/role creation or superuser privilege. The trigger function runs as that
role, with empty search path and a fixed `eps.jobs`/AFTER/ROW/UPDATE scope. It
uses only `OLD`/`NEW` metadata, does not select existing jobs or auth/session data,
and can insert only the fourteen named columns. Forced RLS permits insertion
only by that role while inside a trigger. It has no SELECT/UPDATE/DELETE on the
new table, no SELECT on jobs, and no retained schema CREATE privilege.

PUBLIC/anon/authenticated/service-role table and function defaults are revoked.
No existing application/service identity gains access or membership; only the
existing migration administrator owns the new role. The function has no public
EXECUTE and is not an HTTP, MCP, worker RPC or UI operation. PostgreSQL trigger
invocation therefore reuses the previously authorized job update rather than
adding an independently callable write endpoint. This is the existing M07
internal service/operator exclusion from ordinary API/MCP parity.

`operator-query.sql` is a source template for an existing reviewed administrator,
with bound job UUID, after-attempt cursor and1–100 page size. It emits a closed
`attempt` projection (parsed by `parseJobStageAttemptTrace`) and at most100
accepted event sequence/type/time records plus an explicit truncation flag.
The event join uses both job and attempt IDs. It excludes callback receipts,
event-ID free text and current job payloads. There is no new admin credential,
public route or arbitrary SQL executor. Any future operator wrapper must retain
explicit target/identity/source/response checks; this template executes nothing.

These records have the same lifecycle as the referenced durable job. A foreign
key with restrictive deletion prevents silent orphaning. No payload retention
is enabled in n8n; this slice introduces no TTL/delete mechanism or data export.
Any future job-retention policy must coordinate removal of its metadata.

## Evidence and remaining gate

The TypeScript parser tests cover all job-kind namespaces, distinct stage/retry
bindings, detached output, null/unsafe execution refs, identity/counter bounds,
unknown payload/secret/session fields and safe errors. Python tests parse actual
SQL/PLpgSQL and inspect the closed table/privilege/trigger/query source. Existing
job tests continue to exercise claim contention, fencing, retry, cancellation,
callback idempotency and transactional rollback. These are deterministic source
tests, not database or hosted acceptance.

Observed local source checks on2026-11-01:17/17 focused jobs/parser tests and7/7
SQL/source/security tests passed; full TypeScript typecheck, targeted ESLint and
`git diff --check` passed. The SQL parser consumed the actual candidate, fixture,
query, trigger body and anonymous blocks. No database was opened for these checks.

`fixture.sql` is unexecuted actual SQL for a future **owned-local rollback**
proof. It creates only synthetic a074-prefixed records, exercises first/stage/
retry claims, same-ID replay, omitted refs, safe event joins, a rolled-back claim
and invalid counter transition, then checks least privilege. It intentionally
tests the actual trigger directly; it does not claim authenticated service API
coverage. The owner must wrap candidate plus fixture in one transaction and
roll back the role/DDL/data, preserve original database/catalogue/global roles,
and separately run existing real claim/callback/recovery contracts. The candidate
refuses execution without its local marker and exact history35. No local
database, migration, provider, n8n, process or deployment action was performed.

After local proof and an authorized guarded additive release, one successful
and one failed real nonprotected job must show exact durable stage/execution
bindings, accepted events and actionable producer error. AT-074 stays partial
until that operator audit actually passes; source tests do not close it.

## Primary references checked

- [PostgreSQL17 CREATE TRIGGER](https://www.postgresql.org/docs/17/sql-createtrigger.html)
  and [trigger functions](https://www.postgresql.org/docs/17/plpgsql-trigger.html):
  AFTER row events, `OLD`/`NEW`, scope variables and transaction-aborting errors.
- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
  and [function security](https://www.postgresql.org/docs/current/sql-createfunction.html):
  forced RLS, narrow owner privileges, empty search path and default EXECUTE.
- Project-local Supabase/Postgres, security and observability skills were read.
  The Supabase changelog markdown endpoint was attempted but this browser tool
  rejected its content type. This slice uses established PostgreSQL17 features,
  no new Supabase SDK/API feature. Advisors/runtime proof remains unperformed.
