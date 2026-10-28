# Canonical database inventory

Current state: nine immutable migrations are applied locally/cloud. The [fresh readback](../evidence/cloud-role-order/2026-10-28T19-31-14-242836Z-dc97d5dc-readback.json) started at `2026-10-28T19:31:00.356213+00:00` and finished at `19:31:14.242819+00:00`; it verifies 32 public RPCs, 60 inspected routines and 19 forced-RLS app relations. The ninth migration adds role-only ordering. Owner-reported login/project activity and aggregate business counts are separate from an agent-observed signed-in journey or hosted Storage acceptance.

Updated 2026-10-28. The owner-approved canonical system is `Everyone-Presentation`, project `pyibofyctwnqpvktepse`, `eu-west-1`, PostgreSQL 17.11. Its initial empty state was inspected read-only; the owner then approved establishing the new canonical schema. M01 application occurred afterward. These are separate evidence phases.

## Current physical state

The [ninth application](../evidence/cloud-role-order/2026-10-28T19-23-27-369394Z-bc35d553-apply.json) completed at `19:23:27.369377+00:00`; the separate fresh readback above verifies exact prior catalog plus the narrow role-order routine/ACL/RLS delta. Existing base counts and full workspace/spec/role/slot/preferences hashes are unchanged. Earlier [eighth application](../evidence/cloud-manual-specs/2026-10-28T18-20-20-516377Z-6af99217-apply.json), sixth/seventh, logo and original foundation receipts retain their original observations.

| Concern | Actual canonical objects / evidence |
| --- | --- |
| Business identities | `public.clients`, `public.projects`; UUID keys and direct project/client/workspace foreign keys from the applied migration |
| Principal identity | Existing managed `auth.users(id)` UUID; observed `auth.uid()`, `auth.jwt()` and `auth.role()` functions |
| Permission ownership | `public.project_memberships`, `public.client_memberships`, `public.app_capability_grants`; explicit active grants and write scope |
| Private app records | Existing workspace/media/preset/idempotency/audit/upload/key tables, `eps.jobs`, `eps.job_events`, `eps.outbox_events`, plus `eps.specs`, `eps.roles`, `eps.slots` |
| RLS | All 19 canonical/app relations have RLS and FORCE RLS; managed Storage retains its ownership/flags |
| User RPCs | 32 `public.eps_*` functions: seventeen API-owner, one logo-verifier-owner, four jobs-owner and ten specs-owner; authenticated execute allowed, anonymous/service-role execute denied; empty search paths |
| Internal routines | 60 total inspected including public RPCs; role ordering adds one public wrapper/one private DTO reader to the manual foundation; shared idempotency helper stays VOLATILE/SECURITY INVOKER; generic enqueue has no ordinary-user/API-owner execute grant |
| Runtime roles | API/draft/logo/jobs owners are non-login and non-BYPASSRLS. Jobs dispatcher has only bounded claim/finish execute, no direct queue DML or provisioned login; narrow jobs owner inherits managed Auth with INHERIT=true, SET/admin=false |
| Identity permissions | One-way inherited `authenticated` privileges into the API owner; INHERIT true, SET/admin false |
| Direct table exposure | Authenticated direct canonical update false; private `eps` select false |
| Private branding Storage | One `eps-brand-assets` bucket, public=false, 5 MiB, PNG/JPEG/WebP; existing logo/jobs policies plus restrictive specs-owner/initializer object/bucket denials |
| Verifier isolation | User/API-owner key reads denied; ordinary API owner cannot update verified checksum/width; private verifier helper execution and verifier project/preset writes denied |
| Release row-count snapshot (03:32) | Auth users, clients, projects, workspaces, project memberships, capability grants, media, uploads and verification keys all zero; bucket count one. This snapshot is immutable; later verifier configuration is recorded below. Three audience presets were not recounted by the logo release |
| Historical eighth-release counts (18:20–18:21), preserved again by ninth release | One pristine current spec covers the one workspace; roles/slots zero. Base counts remain one Auth user/client/project/workspace/media/upload/Storage object/key/bucket, four capabilities, one project/client membership, three presets and five audit/replay records; jobs/outbox/events zero |

The current canonical system is not empty. Counts establish record/object existence only: Ready media, selected client/workspace logo and actual image bytes were not observed. An optional scoped metadata query timed out and was not retried. The release provisioned no identity, key, business fixture, provider/service credential or workflow. The owner reported working login/project visibility, then closed review tabs; connected Person1 was last signed out. The enabled development Storage probe in owned process 30061 has never executed against hosted Storage.

The schema-release receipt records `key_provisioning=false` and `runtime_enablement=false`; those release-phase values and zero-key snapshot remain unchanged. A configured bucket and successful DDL do not prove signing-context propagation, real transfer, immutable provider bytes or Sharp verification.

## Later verifier configuration

Root's separate [provision receipt](../evidence/cloud-logo-verifier/2026-10-28T04-05-15-847982Z-658a983b-provision.json), observed `2026-10-28T04:04:59.429274+00:00`, records successful key configuration. The [reopened inspection](../evidence/cloud-logo-verifier/2026-10-28T04-06-30-395598Z-21d6e564-inspect.json), observed `2026-10-28T04:06:23.761385+00:00`, confirms the database key matches the protected runtime file. Root reports one active 32-byte `client_logo` key. These metadata receipts contain no key values or raw CLI output; `.env.local` was unchanged.

The ignored key/phase files are protected for CurrentUser and SYSTEM and use native exclusive CREATE_NEW writes. The strict completed/target-bound loader passes only two key fields to the child environment; the historical loader probe printed neither flag nor secret. Subsequent owned process 30061 loaded that configuration with development upload/probe flags. Database purposes are normally capability-scoped; an enabled runtime is not hosted transfer/immutability acceptance.

## Discovery history retained

- [Initial project identity](linked-project-metadata.json): project created `2026-10-27T23:32:29.131306Z`; no names/IDs were fabricated.
- [Initial metadata](central-metadata.json), observed `2026-10-28T00:52:20.635659+00:00`: no app relations/functions/columns/constraints in inspected `public`/`eps`, no `eps` or `supabase_migrations` schema. Managed schemas were `auth`, `extensions`, `graphql`, `graphql_public`, `public`, `realtime`, `storage`, `vault`.
- [Initial service counts](central-services.json), observed `2026-10-28T00:55:27.478662+00:00`: zero auth users and buckets; no other business relations were found.
- Existing extensions were `plpgsql 1.0`, `pg_stat_statements 1.11`, `uuid-ossp 1.1`, `pgcrypto 1.3`, `supabase_vault 0.3.1`. The app does not repurpose managed Auth/Storage internals.
- [Auth privilege discovery](auth-privileges.json) and [role membership](auth-role-membership.json): cloud `postgres` can use Auth helpers but cannot grant managed Auth schema/helper privileges directly; it has ADMIN on `authenticated`. This justified the additive inheritance fix.

The original receipt `observed_at` values and empty results remain unchanged. Cloud mutations are recorded separately under M01, after the explicit canonical-system amendment. No managed Auth RLS/ownership policy was changed, and no broad user/media row export or function-body dump was performed.

## Manual specs local and cloud checkpoint

Migration eight has SHA256 `8ab866a49cb2e01eabf3b83076fe4519a60255263d0a1a170ef3ba9718a2349c`. The [first local run](../evidence/m02/specs-local/2026-10-28T18-02-35-594Z-b35f9f60.json) actually applied it and proved pre-DDL workspace backfill/column ACLs, then failed in the driver historical-assertion guard; cleanup and count restoration passed. That failure remains a failure. The corrected [local rerun](../evidence/m02/specs-local/2026-10-28T18-07-04-016Z-0fdcf864.json) passed 23 stages/four sampled blocker pairs and strict cleanup; it explicitly reports `first_migration_application=false` and does not claim a second first-backfill proof. The [local contract](../evidence/cloud-manual-specs/local-contract.json), observed 18:16:20.553Z, separately records exact metadata without calling cloud.

The guarded [cloud release](../evidence/cloud-manual-specs/RELEASE_REVIEW.md) preserved all prior seven migration hashes, business counts and workspace-state hash. Three ordinary forced-RLS tables, 26 routines (nine public), two isolated nonlogin/non-BYPASS roles, sixteen policies and one initializer trigger were verified. Working-column grants exclude source/identity setters; empty specs are persisted atomically on workspace creation/backfill, never synthesized by GET. One pristine spec covers the existing cloud workspace; roles/slots remain zero. The [anonymous boundary](../evidence/cloud-manual-specs/anonymous-rpc-boundary.json), observed 18:22:46.882Z, returned HTTP401/42501, not PGRST202; it establishes function lookup and denial only. No schema-cache NOTIFY was needed or performed.

The release also pins the later [full local DB suite](../../development/local-db/receipts/2026-10-28T18-07-49-870Z-test-db-summary-68140882.json), [M01 replay proof](../evidence/m01/replay-scope/2026-10-28T18-10-19-748Z-fixed.json) and [jobs/restart proof](../evidence/m02/local/2026-10-28T18-08-57-532Z-7930ab51.json). Earlier rollback, alias-failure, seven-version and Node-to-SQL receipts retain their dates. Local Storage is a catalog/GUC simulation, not hosted HTTP.

## Ninth migration and provider evidence

Migration `20261028184145` has SHA256 `14f96c7e635fe46cb11393a881bca26068d696c32f5e454df8655299702b1efa`. The [role-order release review](../evidence/cloud-role-order/RELEASE_REVIEW.md) pins the local full DB25-stage/three-pair suite, jobs29-stage/six-pair/restart suite, manual24-stage/four-pair suite and [role-order23-stage/four-pair proof](../evidence/m02/role-order-local/2026-10-28T19-02-20-589Z-b9d09e55.json). Narrow sort-order UPDATE and three operation-specific policies were added without source/identity writes. The cloud release changed no source/spec/role/slot/preferences/workspace digest or base count. The [anonymous new-RPC check](../evidence/cloud-role-order/anonymous-rpc-boundary.json), observed 19:33:12.299Z, returned401/42501: lookup/denial only.

[Configured API access](../evidence/m02/provider-access/2026-10-28T19-08-27-697Z-read-only-access.json) and [one actual synthetic OpenAI evaluation](../evidence/m02/provider-evaluation/2026-10-28T19-31-30-526Z-0cfe7e61.json) now exist. The evaluation projects three roles/five slots through the pure domain validator; it makes no DB application/cloud business write/n8n call and proves no end-to-end pipeline. [Runtime/provider detail](runtime-and-access.md#provider-access-and-single-synthetic-evaluation) also distinguishes working n8n API inventory from its still-failing MCP connection and unrelated existing workflow.

## Remaining acceptance boundaries

Manual source submission, lease-bound extraction/apply, assignment retirement/Undo and connected processing remain unfinished. Existing manual SQL fails closed when an assignment relation is present rather than claiming assignment integration. The separate synthetic provider call does not establish a worker daemon, authenticated hosted manual UI journey or live logo acceptance. Fresh advisors observed `19:33:17.593408+00:00` report 33 WARN: 32 curated public-definer findings and unresolved `auth_leaked_password_protection`. Passwordless UI does not establish exemption. No Auth or billing settings changed; production follow-up is recorded in [role-order release review](../evidence/cloud-role-order/RELEASE_REVIEW.md). No zero-warning, M01/M02 pipeline or production acceptance is claimed.
