# Canonical database inventory

Updated 2026-10-28. The owner-approved canonical system is `Everyone-Presentation`, project `pyibofyctwnqpvktepse`, `eu-west-1`, PostgreSQL 17.11. Its initial empty state was inspected read-only; the owner then approved establishing the new canonical schema. M01 application occurred afterward. These are separate evidence phases.

## Current physical state

The current [logo apply receipt and embedded readback](../evidence/cloud-logo-foundation/2026-10-28T03-32-17-619834Z-6a35754c-apply.json) is observed at `2026-10-28T03:32:17.619929+00:00`; the embedded readback has no separate timestamp. It seals four immutable versions: `20261028010943`, `20261028013324`, `20261028013655`, and `20261028024205`. The [original foundation apply](../evidence/cloud-foundation/apply.json) and [three-version readback](../evidence/cloud-foundation/readback.json) remain valid historical evidence at their original times.

| Concern | Actual canonical objects / evidence |
| --- | --- |
| Business identities | `public.clients`, `public.projects`; UUID keys and direct project/client/workspace foreign keys from the applied migration |
| Principal identity | Existing managed `auth.users(id)` UUID; observed `auth.uid()`, `auth.jwt()` and `auth.role()` functions |
| Permission ownership | `public.project_memberships`, `public.client_memberships`, `public.app_capability_grants`; explicit active grants and write scope |
| Private app records | `eps.workspaces`, `eps.user_workspace_preferences`, `eps.media_assets`, `eps.audience_presets`, `eps.idempotency_records`, `eps.audit_events`, plus new `eps.upload_sessions` and `eps.logo_verification_keys` |
| RLS | All 13 canonical/app relations read back with RLS and FORCE RLS enabled; managed Storage retains its existing RLS ownership/flags |
| User RPCs | Eighteen `public.eps_*` functions, SECURITY DEFINER, empty search path, authenticated execution allowed and anonymous denied; seventeen owned by `eps_api_owner`, final logo completion owned by `eps_logo_verify_owner` |
| Runtime roles | API/draft owners and new logo verifier are non-login, non-superuser, non-CREATEROLE, non-BYPASSRLS; unsafe/reverse verifier membership absent |
| Identity permissions | One-way inherited `authenticated` privileges into the API owner; INHERIT true, SET/admin false |
| Direct table exposure | Authenticated direct canonical update false; private `eps` select false |
| Private branding Storage | One `eps-brand-assets` bucket, public=false, 5 MiB, PNG/JPEG/WebP; eight logo policies include restrictive operation/immutability and verifier object/bucket guards |
| Verifier isolation | User/API-owner key reads denied; ordinary API owner cannot update verified checksum/width; private verifier helper execution and verifier project/preset writes denied |
| Release row-count snapshot (03:32) | Auth users, clients, projects, workspaces, project memberships, capability grants, media, uploads and verification keys all zero; bucket count one. This snapshot is immutable; later verifier configuration is recorded below. Three audience presets were not recounted by the logo release |

There are no real projects or app users in the latest count snapshot. No cloud fixture, candidate/person record, verification key, source media or object bytes were created by this release. Existing-project-before-workspace is implemented against the canonical table and tested locally; the signed-in user/project journey remains M01 acceptance work.

The schema-release receipt records `key_provisioning=false` and `runtime_enablement=false`; those release-phase values and zero-key snapshot remain unchanged. A configured bucket and successful DDL do not prove signing-context propagation, real transfer, immutable provider bytes or Sharp verification.

## Later verifier configuration

Root's separate [provision receipt](../evidence/cloud-logo-verifier/2026-10-28T04-05-15-847982Z-658a983b-provision.json), observed `2026-10-28T04:04:59.429274+00:00`, records successful key configuration. The [reopened inspection](../evidence/cloud-logo-verifier/2026-10-28T04-06-30-395598Z-21d6e564-inspect.json), observed `2026-10-28T04:06:23.761385+00:00`, confirms the database key matches the protected runtime file. Root reports one active 32-byte `client_logo` key. These metadata receipts contain no key values or raw CLI output; `.env.local` was unchanged.

The ignored key/phase files are protected for CurrentUser and SYSTEM and use native exclusive CREATE_NEW writes to prevent overwrite or partial-state adoption. The strict completed/target-bound loader passes only two key-configuration fields to the child environment; root's loader probe passed without an upload flag or secret output. The running server predates key installation, so full startup/relaunch proof remains pending. Runtime uploads and database available purposes remain off; no real user/project or Storage HTTP acceptance is implied.

## Discovery history retained

- [Initial project identity](linked-project-metadata.json): project created `2026-10-27T23:32:29.131306Z`; no names/IDs were fabricated.
- [Initial metadata](central-metadata.json), observed `2026-10-28T00:52:20.635659+00:00`: no app relations/functions/columns/constraints in inspected `public`/`eps`, no `eps` or `supabase_migrations` schema. Managed schemas were `auth`, `extensions`, `graphql`, `graphql_public`, `public`, `realtime`, `storage`, `vault`.
- [Initial service counts](central-services.json), observed `2026-10-28T00:55:27.478662+00:00`: zero auth users and buckets; no other business relations were found.
- Existing extensions were `plpgsql 1.0`, `pg_stat_statements 1.11`, `uuid-ossp 1.1`, `pgcrypto 1.3`, `supabase_vault 0.3.1`. The app does not repurpose managed Auth/Storage internals.
- [Auth privilege discovery](auth-privileges.json) and [role membership](auth-role-membership.json): cloud `postgres` can use Auth helpers but cannot grant managed Auth schema/helper privileges directly; it has ADMIN on `authenticated`. This justified the additive inheritance fix.

The original receipt `observed_at` values and empty results remain unchanged. Cloud mutations are recorded separately under M01, after the explicit canonical-system amendment. No managed Auth RLS/ownership policy was changed, and no broad user/media row export or function-body dump was performed.

## Remaining acceptance boundaries

The [latest local suite](../../development/local-db/receipts/2026-10-28T03-22-41-050Z-test-db-summary-59ca1af3.json) passed 19 stages and three independent-backend race pairs, including distinct-key logo completion, with scoped cleanup. [Node-to-SQL interoperability](../../development/local-db/receipts/2026-10-28T03-20-25-083Z-logo-node-sql-interop.json) verifies the actual signer against SQL using synthetic authority and rolled-back metadata. Local Storage is a catalog/GUC simulation, separate from real cloud DDL and unperformed Storage HTTP/byte acceptance. See [logo acceptance assessment](LOGO_ACCEPTANCE_ASSESSMENT.md); no M01 verification is claimed here.
