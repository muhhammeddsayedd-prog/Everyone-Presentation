# Canonical system decision and M01 physical ownership

Updated 2026-10-28. The product owner explicitly confirmed that the inspected empty `Everyone-Presentation` project (`pyibofyctwnqpvktepse`) will be canonical. The amendment in `tracking/DECISIONS.md` supersedes the earlier search for pre-existing business tables. Existing-project-before-workspace, permissions and immutable history rules still apply. No real users/projects or synthetic cloud fixtures have been created.

This repository's `supabase/migrations/` is the one coordinated new history. The foundation and two additive fixes (`20261028010943`, `20261028013324`, `20261028013655`) now applied to the guarded local runtime and actual canonical cloud. [Cloud application](../evidence/cloud-foundation/apply.json) and [readback](../evidence/cloud-foundation/readback.json) retain exact timestamps, hashes, versions, roles/grants/RLS and counts. Physical names below are now current cloud objects, while the initial empty receipt remains unchanged.

Local failures were retained: a managed Auth prerequisite gap, real Auth schema permission failure, and PL/pgSQL record/alias ambiguity. Applied source files were preserved and app defects corrected additively. The full local role/RLS suite and actual separate-session same-key/distinct-key races then passed with scoped cleanup; [final summary](../../development/local-db/receipts/2026-10-28T01-46-46-146Z-test-db-summary-8fbb2c6b.json).

| Concern | Owner / implementation |
| --- | --- |
| Client identity/name/default logo | `public.clients`; canonical write through `public.eps_update_project` with separate client membership and revision |
| Project identity/name/client relation/lifecycle | `public.projects`; no duplicate live project table; exact UUID FK from workspace |
| Principal identity | Existing managed `auth.users(id)` and `auth.uid()`; server verifies the user token with `getUser` per request |
| Project/client scope | `public.project_memberships`, `public.client_memberships`: explicit principal, active and write scope |
| App capabilities | `public.app_capability_grants`: explicit active capability strings; no admin-label shortcut |
| Casting workspace | Private `eps.workspaces`, one active Casting workspace per project |
| Output tab preference | `eps.user_workspace_preferences`; one user's view choice does not change shared casting state |
| Logo metadata | Minimal private `eps.media_assets`; storage reservation/verification remains unimplemented and unavailable in capability output |
| Audience presets | Private `eps.audience_presets`; Internal Production, Agency and Client are configuration defaults |
| Idempotency/audit | Private `eps.idempotency_records` and append-only `eps.audit_events`; advisory transaction locks serialize replay identities |

Public RPC wrappers derive `auth.uid()` and take no actor/principal arguments. The public canonical tables grant authenticated reads under RLS, while writes use validated wrappers. Private `eps` tables grant no direct client access. `eps_api_owner` is non-login, non-owner and non-BYPASSRLS; required definer wrappers bridge the private schema and remain subject to explicit RLS. Invoker helpers enforce current grants and scope. All function default PUBLIC execution is revoked.

Actual grantability inspection found that cloud `postgres` can use Auth schema/helpers but cannot grant those managed privileges. It does have ADMIN on `authenticated`; see `auth-privileges.json` and `auth-role-membership.json`. The forward fix therefore grants the existing `authenticated` role to `eps_api_owner` with per-membership `INHERIT TRUE`, `SET FALSE`, `ADMIN FALSE`. This direction gives the private function role existing managed identity access; it does not let authenticated users assume the function owner. Both roles remain non-login/non-BYPASSRLS, and managed Auth schema ownership/policies remain unchanged. Guarded role tests verify effective privileges and reverse-membership denial before broader application acceptance.

`eps_draft_owner` is a separate non-login/non-BYPASSRLS trigger role. It can read project identity/client relation and update only workspace revision/draft counters. Its fixed trigger invalidates future drafts after shared project/client changes, including other affected projects, without granting their data to the editing user. No public callable function accepts arbitrary invalidation scope.

Contributor preparation authority is independent from shared-record editing: workspace operations need workspace capability plus writable canonical project membership; they do not require `projects.write`. Canonical project/client updates require that separate capability and their own scope. Current resource scope is checked before returning cached idempotent responses, so an old key cannot restore access after membership revocation.

No managed `auth.users` RLS/policy is changed. Anonymous JWTs are rejected. Foreign keys and current grants/membership checks deny unknown/deleted principals where their bindings have been removed; server auth verification remains required. Immediate soft-deletion/session revocation semantics and existing issued-token lifetimes must be demonstrated with real auth integration rather than claimed from SQL fixtures.

Local validation uses the separately owned, loopback-only Postgres runtime and exact reviewed hashes. `tests/db/m01-foundation.sql` rolls back synthetic fixtures; reviewed concurrency files commit only their scoped namespace for independent sessions and then clean it up. Actual SQL/role proof and cloud metadata are recorded separately from the actual central anonymous browser smoke. Cloud readback contains zero auth users, clients, projects, grants, memberships, media and buckets; only three audience defaults exist. A signed-in user/project journey and private storage remain unverified, so this ownership record does not declare M01 or production complete.
