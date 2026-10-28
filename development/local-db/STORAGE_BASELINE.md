# Local Storage policy simulation

Status: reviewed and applied in the owned local container. Root recorded the exact SQL hash and ran the guarded action; the [apply receipt](receipts/2026-10-28T02-59-07-508Z-storage-baseline.json) reports `applied`, and the [same-hash repeat receipt](receipts/2026-10-28T02-59-20-266Z-storage-baseline.json) reports `already_applied`. This fixture is exclusively for SQL policy tests. It is not a running Supabase Storage server or hosted integration.

## Observed prerequisites

The guarded, read-only [inspection receipt](receipts/2026-10-28T02-56-28-679Z-storage-baseline-inspect.json) verifies the existing local `storage` namespace is empty and owned by `supabase_admin`. Earlier storage-privileges output showed no tables/helpers; that query did not test namespace existence.

The image already supplies `supabase_storage_admin` as a non-superuser, non-BYPASSRLS, NOINHERIT role. `postgres` is not its member. Existing `supautils.policy_grants` includes `postgres` policy management on `storage.buckets` and `storage.objects`. This fixture changes no role membership, managed Auth grant, schema owner or supautils setting.

Hosted [ACL/policy metadata](../../tracking/discovery/storage-release-privileges.json), observed `2026-10-28T02:53:56Z`, establishes matching schema/table ownership and policy delegation. The simulated table ACLs match that receipt: `anon`/`authenticated` SELECT/INSERT/UPDATE/DELETE; `service_role` all privileges; `postgres` all privileges with grant option. RLS still limits ordinary DML.

## Supported policy migration path

Official [supautils documentation](https://github.com/supabase/supautils/blob/dfad913d9745b0a008aacfae7e9829360ca4675a/README.md#manage-policies) describes policy delegation without table ownership. Supabase's [managed policy troubleshooting guide](https://supabase.com/kb/troubleshooting/realtime-must-be-owner-of-table-messages) distinguishes delegated policy statements from forbidden `ALTER TABLE`, and identifies `postgres` as the SQL Editor/CLI migration role. The live configuration explicitly includes both Storage tables.

App migrations should use the already-enabled managed RLS and CREATE/ALTER/DROP POLICY through that hook. They must not change managed ownership, grant the owning role to `postgres`, alter managed RLS flags/columns, or assume arbitrary managed-schema DDL is delegated. Local policy execution remains separate from cloud application evidence.

## Fixed action and review

```powershell
node tools/local-postgres.mjs storage-baseline --inspect
node tools/local-postgres.mjs storage-baseline
node tools/local-postgres.mjs storage-privileges
```

`--inspect` is read-only apart from its sanitized filesystem receipt. Applying [local-storage-baseline.sql](local-storage-baseline.sql) requires an exact `reviewed.json.local_baselines` entry containing `path`, SHA256 and `reviewed_by`. Root records it after technical review. The action accepts no arbitrary SQL, role, file, target, host or cloud argument.

Every action verifies the existing container/volume/network ownership, pinned image, all loopback bindings and database system identifier. The baseline also checks `eps_local_guard.instance`, existing roles and policy configuration. It refuses nonempty/unexpected Storage entities before creation. The verified local `supabase_admin` creates only missing simulated objects, owned by `supabase_storage_admin`, in one bounded transaction. App replay/tests continue as `postgres`.

Private `eps_local_guard.storage_baseline` records version 1, exact script SHA256 and schema/entity OIDs, owners, RLS flags, columns/defaults and helper definitions. Same-hash repetition reads and compares this fingerprint, then reports `already_applied`. Changed hashes/catalogs refuse overwrite/adoption. App policies are outside this fingerprint. The fixture does not enter the canonical app migration ledger.

## Simulation limits

Only minimal buckets/objects and operation helpers are reproduced. There is single-key uniqueness, with no provider version history, signing tokens, HTTP router, verified JWTs, byte backend, MIME/size enforcement, bucket/delete protection triggers, cleanup, S3/TUS, CDN or callbacks. SQL tests supply synthetic request claims/headers/operation context.

Hosted Storage has additional columns, indexes, triggers and behavior. Local policy tests prove only the tested PostgreSQL predicates under those synthetic contexts. HTTP propagation, signed-upsert denial, real byte validation and immutable provider bytes require separate [logo-boundary acceptance](../../tracking/discovery/logo-storage-boundary.md).

Preparation performed read-only inspection only. Root subsequently applied SQL hash `e48d5ce64e31ff2671231d39585bf4b5cd24b3b3f535caed400baa5a7bfed383` at `2026-10-28T02:59:07.508Z`; matching-hash/fingerprint repetition succeeded at `2026-10-28T02:59:20.266Z`. Neither action changed cloud state or added an app migration ledger entry. Retain both receipts and any future failure history.
