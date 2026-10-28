# Canonical database inventory

Updated 2026-10-28. The owner-approved canonical system is `Everyone-Presentation`, project `pyibofyctwnqpvktepse`, `eu-west-1`, PostgreSQL 17.11. Its initial empty state was inspected read-only; the owner then approved establishing the new canonical schema. M01 application occurred afterward. These are separate evidence phases.

## Current physical state

The actual cloud application at `2026-10-28T01:49:13.227154+00:00` and readback at `2026-10-28T01:51:11.069521+00:00` are recorded in [apply](../evidence/cloud-foundation/apply.json) and [readback](../evidence/cloud-foundation/readback.json). The three immutable versions are `20261028010943`, `20261028013324`, and `20261028013655`.

| Concern | Actual canonical objects / evidence |
| --- | --- |
| Business identities | `public.clients`, `public.projects`; UUID keys and direct project/client/workspace foreign keys from the applied migration |
| Principal identity | Existing managed `auth.users(id)` UUID; observed `auth.uid()`, `auth.jwt()` and `auth.role()` functions |
| Permission ownership | `public.project_memberships`, `public.client_memberships`, `public.app_capability_grants`; explicit active grants and write scope |
| Private app records | `eps.workspaces`, `eps.user_workspace_preferences`, `eps.media_assets`, `eps.audience_presets`, `eps.idempotency_records`, `eps.audit_events` |
| RLS | All 11 new canonical/app relations read back with RLS and FORCE RLS enabled |
| User RPCs | Twelve `public.eps_*` functions read back as `eps_api_owner` owned, SECURITY DEFINER, empty search path, authenticated execution allowed, anonymous execution denied |
| Runtime roles | `eps_api_owner`, `eps_draft_owner`: no login, superuser, CREATEROLE or BYPASSRLS; no reverse authenticated-to-owner membership |
| Identity permissions | One-way inherited `authenticated` privileges into the API owner; INHERIT true, SET/admin false |
| Direct table exposure | Authenticated direct canonical update false; private `eps` select false |
| Actual row counts | Auth users, clients, projects, workspaces, memberships, capability grants, media and buckets all zero; exactly three default audience presets |

There are no real projects or app users yet. No cloud fixture, candidate/person record, source media or storage object was created. Existing-project-before-workspace is implemented against the canonical table and tested with local synthetic records; the actual signed-in user/project journey remains M01 acceptance work.

The minimal media registry is deployed, while private bucket/upload/verification operations remain unavailable. A zero-bucket observation is known absence, not evidence of configured storage. `available_purposes=[]` prevents claiming a working central logo upload.

## Discovery history retained

- [Initial project identity](linked-project-metadata.json): project created `2026-10-27T23:32:29.131306Z`; no names/IDs were fabricated.
- [Initial metadata](central-metadata.json), observed `2026-10-28T00:52:20.635659+00:00`: no app relations/functions/columns/constraints in inspected `public`/`eps`, no `eps` or `supabase_migrations` schema. Managed schemas were `auth`, `extensions`, `graphql`, `graphql_public`, `public`, `realtime`, `storage`, `vault`.
- [Initial service counts](central-services.json), observed `2026-10-28T00:55:27.478662+00:00`: zero auth users and buckets; no other business relations were found.
- Existing extensions were `plpgsql 1.0`, `pg_stat_statements 1.11`, `uuid-ossp 1.1`, `pgcrypto 1.3`, `supabase_vault 0.3.1`. The app does not repurpose managed Auth/Storage internals.
- [Auth privilege discovery](auth-privileges.json) and [role membership](auth-role-membership.json): cloud `postgres` can use Auth helpers but cannot grant managed Auth schema/helper privileges directly; it has ADMIN on `authenticated`. This justified the additive inheritance fix.

The original receipt `observed_at` values and empty results remain unchanged. Cloud mutations are recorded separately under M01, after the explicit canonical-system amendment. No managed Auth RLS/ownership policy was changed, and no broad user/media row export or function-body dump was performed.

## Remaining acceptance boundaries

Local replay, runtime roles, canonical writeback, revisions, idempotency and two real concurrent-session races passed; see the [local suite summary](../../development/local-db/receipts/2026-10-28T01-46-46-146Z-test-db-summary-8fbb2c6b.json). This does not prove a hosted signed-in app journey, storage/processing, restoration or production readiness. Those gates remain visible in their owning milestones.
