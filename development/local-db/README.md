# Isolated canonical database replay

This harness runs the already-pulled official Supabase Postgres image locally for reviewed SQL replay. It does not run Supabase Auth/Storage/REST, use the hosted database, or replace the project's cloud link. The user confirmed the empty Everyone-Presentation project as canonical; this harness tests its proposed coordinated root migration history using isolated local data before any cloud DDL.

The exact image tag/digest and owned resource names are pinned in `instance.json`. The dedicated container publishes **only `127.0.0.1:55433` → PostgreSQL 5432**. Every operation verifies a local Docker named-pipe/Unix-socket context, workspace/instance labels on the container, volume and network, exact image digest, exact owned volume mount, all configured and observed host bindings, the dedicated bridge attachment, PostgreSQL major version and the database system identifier. Any mismatch refuses SQL. Unrelated containers, networks and volumes are never stopped, removed or adopted.

The local password and ownership/database fingerprints live under ignored `.local/local-postgres/`. The generated password travels through Docker's `--env-file`; it never appears in command arguments, console output or committed receipts. `docker exec` invokes `psql` over the container's Unix socket with explicit user/database/host and no psqlrc. The runner has no connection-string, cloud-project, remote-host, reset or delete option. It never executes `supabase db reset`, seeds a cloud database, changes `.temp/project-ref`, or invokes the Supabase CLI.

```powershell
node tools/local-postgres.mjs start
node tools/local-postgres.mjs status
node tools/local-postgres.mjs privileges
node tools/local-postgres.mjs bootstrap
```

`start` preserves its volume and reuses only resources with matching ownership. `bootstrap` first performs the read-only target inspection. The observed official image already supplied `auth.users`, `auth.uid()` and `anon`, `authenticated`, `service_role`, `postgres`; it did **not** contain `auth.jwt()`. The initial app replay failed and rolled back on that missing prerequisite. The repaired bootstrap creates only the absent local `auth.jwt()` helper from `request.jwt.claims`; it retains existing `auth.users` and `auth.uid`. Its new helper is marked as a synthetic local prerequisite and owned by the existing `supabase_auth_admin` role. The original failure remains recorded; the root app migration is unchanged.

The official image's `postgres` role is not a superuser and does not own managed auth. For this local prerequisite bootstrap only, the runner verifies and uses its existing `supabase_admin` superuser/schema-owner role over the already-verified container Unix socket. Migration replay/tests continue using `postgres`. The bootstrap checks uid/jwt behavior under the actual `authenticated` role with synthetic transaction-local claims and rolls that check back. This image's existing `auth.uid()` reads `request.jwt.claim.sub`, while the local JWT helper reads `request.jwt.claims`; the harness sets both, matching the DB acceptance test. An initial helper check that set only `claims` failed and was corrected without replacing the existing uid function. No hosted Auth login or JWT cryptographic verification is claimed. If any managed prerequisite is absent after app tables already exist, the bootstrap refuses that fallback. Replay/tests also refuse early if users/uid/jwt are incomplete.

The bootstrap also creates a private local ownership/hash ledger and a compatible `supabase_migrations.schema_migrations` table. Application SQL comes exclusively from the coordinated root `supabase/migrations/` history. The local hash ledger supplements that history; it is not another production migration source.

`privileges` performs a guarded read-only catalog inspection of managed auth usage, execute grantability and the existing `postgres`→`authenticated` role membership attributes. After the first app migration had applied, the actual role test failed because the new non-owner API role lacked auth-schema usage. Local inspection matched the owner's fresh cloud evidence: `anon`/`authenticated` already had auth usage; `postgres` had no auth usage/uid/jwt execute grant options; its `authenticated` membership had ADMIN/INHERIT/SET true. Therefore no local baseline grant or reset was performed. App-role inheritance belongs in a reviewed forward app migration, not an invented grant against managed auth. The catalog receipt also records that app tables already exist; no empty-database assumption is used.

## Review gate and replay

The root integration owner reviews the exact migration/test SQL and records its SHA256 and reviewer in `reviewed.json`. A manifest entry has this shape:

```json
{
  "path": "supabase/migrations/20261028010943_m01_canonical_foundation.sql",
  "sha256": "the exact 64-character lowercase SHA256 after review",
  "reviewed_by": "root integration owner",
  "reviewed_at": "actual review timestamp"
}
```

Only matching root migration files and explicitly reviewed `tests/db/*.sql` files are accepted. File bytes must still match the reviewed hash; symbolic-link aliases, path traversal, the guarded design reference and psql metacommands are refused. Migrations must omit their own BEGIN/COMMIT/ROLLBACK because the runner owns the atomic boundary.

```powershell
node tools/local-postgres.mjs replay --file supabase/migrations/20261028010943_m01_canonical_foundation.sql
node tools/local-postgres.mjs test --file tests/db/<reviewed-test>.sql
```

A migration runs with bounded timeouts, an advisory transaction lock, a database ownership guard and both migration/hash ledger writes in the same transaction. A failed statement rolls everything back; a matching replay reports `already_applied`; a changed historical hash requires a forward migration. Test sessions receive `eps.local_fixture_tests=eps-presentation-canonical-pg17-local` only after target verification. Tests should create synthetic data inside their reviewed BEGIN/ROLLBACK boundary and exercise real non-owner roles; a passing owner query alone does not prove RLS.

`verifyLocalTarget()` and `runReviewedSqlFile(path,{test:true})` are exported for an exact reviewed concurrency test orchestrator. They cannot accept a remote connection or arbitrary SQL text. Actual migration/test receipts record paths, hashes, results and target metadata; they do not assert cloud application.

## Preserved startup failure

The first dedicated start used an additional `--internal` bridge restriction. Docker retained the configured `127.0.0.1:55433` binding but reported no actual published endpoint (`5432/tcp: []`). The guard refused SQL. The implementation was corrected to a dedicated normal bridge supporting host publication. Only the newly created, ownership-verified container was recreated; its initialized named volume/password were preserved, and the first internal network `eps-presentation-canonical-pg17-network` was retained. No app migration had run. The successful receipt records the actual single IPv4 loopback publication.

Sanitized receipts are under `receipts/`; `startup-latest.log` is the captured, credential-redacted startup log. This is local PostgreSQL evidence only. Hosted auth, storage, central runtime privileges, web writeback and production acceptance require their own evidence.
