# Coordinated processing foundation release

The exact sixth and seventh migrations passed the guarded cloud dry-run and
application, followed by an independent readback at 2026-10-28T16:56:29Z. The
original five migration hashes are unchanged. The latest cloud receipt is
`2026-10-28T16-56-29-737639Z-6e03dbf9-readback.json`.

Readback binds 32 routine signatures, argument names, return types, source hashes,
owners, volatility, search paths and execute grants, plus 16 forced-RLS app
relations, narrow private roles, queue grants and policy-expression hashes.
These include 22 authenticated public RPCs; the remaining routines are private.
The shared idempotency helper remains VOLATILE and SECURITY INVOKER.

Business/storage counts before and after release match. They are not empty:
one real Auth user, client, project, workspace, media/upload record and Storage
object exist, alongside four capabilities and the prior setup/runtime records.
The new jobs/outbox/events tables have zero rows. No identity, source fixture,
provider, workflow, credential or service login was provisioned by this release.

## Actual local evidence

- `development/local-db/receipts/2026-10-28T16-44-39-449Z-test-db-summary-fcaee673.json`:
  23 M01 regression stages, three backend race pairs, both cleanups passed.
- `tracking/evidence/m01/replay-scope/2026-10-28T16-38-40-784Z-fixed.json`:
  eleven current-scope denials after exact observed advisory waits, distinct
  backends, legitimate closed-state replay controls and cleanup passed.
- `tracking/evidence/m02/local/2026-10-28T16-43-07-185Z-63e90f8d.json`:
  27 stages, six backend pairs, both cancellation/dispatch orderings, committed
  lease survival across a graceful same-volume PostgreSQL restart, controlled
  expiry/fence recovery and cleanup passed.

Local PostgreSQL is 17.6 with simulated Auth/Storage catalogs; the linked cloud
is 17.11. These tests do not represent cloud HTTP, an actual dispatcher daemon,
stage callbacks, OpenAI/n8n, or a media worker execution. The source/SQL proof
seals and before/attempt/final receipts are retained by the release helper.

## Security advisors

The fresh actual CLI `results` envelope reports **23 WARN findings**:

- 22 `authenticated_security_definer_function_executable` findings correspond
  to the intentional curated public RPCs. Each uses its narrow non-BYPASS owner,
  explicit acting-user/capability/resource checks, constrained inputs and private
  RLS-backed data. Anonymous and service-role execute are denied. Internal queue
  and enqueue routines are not exposed to ordinary actors.
- One `auth_leaked_password_protection` finding is an unresolved Auth service
  configuration item. The app currently offers email links; that does not prove
  the underlying password service is disabled or exempt. No Auth settings or
  billing were changed. Supabase documents the leaked-password feature as
  available on Pro and above; project entitlement and the intended password
  policy must be resolved before production acceptance. See the official
  [password-security guide](https://supabase.com/docs/guides/auth/password-security),
  checked 2026-10-28.

The earlier 18-warning observation is historical. This observation does not
establish when the Auth setting became disabled, and is not a zero-warning
security or production sign-off.

## Remaining acceptance

The owner reported a successful sign-in and project visibility, then closed the
review tabs. A connected signed-in browser journey and the prepared hosted
Storage probe have not been run by the agent. Aggregate workspace/media/object
counts do not prove image bytes, Ready state, overwrite denial or the full UI
journey. An optional later scoped metadata CLI query timed out before returning;
no Ready-state result was recorded, and it did not affect the completed release.

Specs/source persistence, lease-bound stage callbacks and result application,
output reservation, dispatcher/worker service identity, real provider configuration
and the Processing/Specs interface remain unfinished. This release is a working
database/HTTP foundation, not M02 pipeline or production acceptance.
