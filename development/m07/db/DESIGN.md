# M07 local candidate29 database design

This directory is development-only. It does not add a coordinated migration or
authorize canonical changes. Existing history28 sources and seals stay unchanged.
The canonical metadata-only queries are `discovery.sql` and
`discovery-privileges.sql`; both were executed read-only by the root integrator.
The receipts are `tracking/evidence/m07/2026-10-30-canonical-auth-settings-discovery.json`
and `2026-10-30-canonical-auth-policy-privileges.json`. No Auth row values or
credentials were read. Canonical history remains28.

Settings use the existing central business database, under private `eps`, with a
single app-default row and the existing `eps.presentation_templates` registry. `settings.manage` gates
both operations. A constrained NOLOGIN owner, FORCE RLS and explicit grants keep
tables inaccessible to direct authenticated/anonymous callers. No second local
settings database is introduced.

Implemented local candidate RPCs:

- `eps_get_settings()` returns exactly `template_version`, `default_timezone`,
  `default_review_expiry_days` (30), `models` (operator-owned JSON), `row_version`.
- `eps_update_settings(p_input jsonb,p_idempotency_key text)` accepts only required
  `row_version` and optional `default_timezone`, `template_version`. It checks the
  live capability before replay, rechecks it after advisory-lock acquisition,
  validates exact IANA timezone names and approved enabled template versions,
  locks the singleton row, compares its version, then updates/audits once. Audit
  request/client headers use existing `eps.finish_mutation` conventions.
- `eps_validate_own_oauth_session(p_resource text)` derives identity solely from
  signed `auth.jwt()` and `auth.uid()`. Closed response:
  `{active,principal_id,session_id,client_id,capabilities}`. Validation must bind
  the session to its actual user/client and current expiry/revocation state,
  bind the resource to issuer-signed delegation and an operator-controlled
  resource/client allowlist, and return only current business capabilities
  intersected with signed delegation. It does not return an Auth record, token,
  refresh metadata, user metadata or arbitrary caller-selected identity.

Settings changes affect defaults for future work. They never update any existing
series, version, Ready snapshot, PDF object or guest link. Template default use
must be integrated into future generation without modifying frozen templates or
rendering a historical version with a new default. The registry begins with the
actually supported `1.1.0`; older retained1.0.0 cannot render new versions with
the current renderer and is rejected as a new default. Models are a strict safe
projection of the existing specs/candidate/review configuration model columns,
not copies, guesses or writable settings. Expiry remains30 days in v1.

Actual sessions use `oauth_client_id`, not `client_id`, and have RLS enabled with
no existing policies. Canonical postgres has SELECT grant option on sessions and
its five required columns; the managed `supautils.policy_grants` permits a new
sessions policy. It is not a member of `supabase_auth_admin`. The candidate adds
one SELECT policy for the new NOLOGIN/NOBYPASSRLS function owner, limited to the
calling user's exact signed session and client. Only id/user_id/oauth_client_id/
not_after/scopes are granted. Hidden refresh-token metadata and user-agent columns
remain inaccessible. Existing managed owners, RLS flags, policies, and client-role
grants stay unchanged. No oauth_clients/oauth_consents grant or read is added.

The operator-owned resource/client table starts empty. A configured resource
must equal the signed audience and delegation resource; enabled client, active
same-user session, openid token/session scopes, current expiry, signed delegation
and current business capabilities are independently required. Inactive responses
keep their closed five-field shape and use null for absent/invalid claimed IDs.
No generated or placeholder identity is returned.

An exact-source-guarded addition to `eps.has_capability` also applies delegation
to direct business RPC calls. The private constrained helper handles top-level
signed delegation and known MCP client IDs, including disabled entries. It calls
the same session validator; those queries and their RLS use only UID predicates,
avoiding capability recursion. Ordinary browser tokens and unrelated OAuth
clients without Studio delegation preserve the existing authorization behavior.
Operators disable a known client row instead of deleting its remembered identity.

The official [Supabase OAuth flow documentation](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
and [Auth OpenAPI](https://github.com/supabase/auth/blob/master/openapi.yaml)
state that normal revokeGrant deletes active sessions for that user/client and
invalidates refresh tokens. Session disappearance therefore fences standard
provider revocation. Manual edits to managed OAuth tables are not a supported
revocation path. Actual provider revocation, issuance and audience compatibility
remain unverified; no OAuth provider, consent UI, client or hook is configured.

`local-auth-fixture.sql` is an explicitly synthetic subset added only to an owned
disposable test database because the foundation fixture lacks auth.sessions. It
never enters application migrations and is not live JWT/provider proof.

`run-local29.mjs --red` reproduces missing Settings/session RPCs on pristine28.
The normal runner uses a uniquely named/marked owned28 clone, records source
seals, exercises real database roles and preserves the original28 table data,
functions, grants, roles and memberships. It removes the owned clone/new roles
before releasing the shared test lock. SQL fixtures verify unchanged existing
Ready snapshots and media metadata, not actual canonical PDF byte retrieval.
