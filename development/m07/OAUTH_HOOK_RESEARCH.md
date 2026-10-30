# Supabase OAuth issuance: pinned source findings and hook proposal

Research on2026-10-30. No hook, role, grant, migration or provider configuration
was created by this work. The proposal below is a review input, not runnable SQL
or proof that the current hosted gateway accepts a resource-audience JWT.

## Exact version and source boundary

The root's sanitized provider receipt,
`tracking/evidence/m07/2026-10-30-provider-auth-metadata.json`, reports Auth
`v2.197.0` and unavailable OAuth discovery (HTTP404). A404 does not establish the
exact OAuth enablement/configuration flag. Official Git tag `v2.197.0` resolves to
commit `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`; the findings below were checked
against that commit rather than relying on current master.

| Question | Verified source behavior | Remaining live boundary |
| --- | --- | --- |
| Does `/user` always demand `aud=authenticated`? | `UserGet` compares the JWT's first audience with `requestAud`. For non-admin roles, `requestAud` uses `X-JWT-AUD` if present, otherwise the token's first audience, then the configured default. The current Studio user client sets no `X-JWT-AUD`. | Actual hosted gateway headers/configuration and a real resource-only token have not been tested. |
| Does JWT parsing pin an audience? | `parseJWTClaims` supplies configured valid algorithms and key/signature verification; this call does not supply `WithAudience`. | Other hosted gateway/PostgREST audience checks remain separate. |
| What is the hook input? | `CustomAccessTokenInput` contains `metadata`, `user_id`, `claims`, `authentication_method`. OAuth `client_id` and `scope` are inside `claims`. | Never treat user metadata or a caller body as these issuer fields. |
| Does the access JWT contain scope? | `GenerateAccessToken` reads `session.Scopes`, populates `AccessTokenClaims.Scope` (`scope,omitempty`) and `ClientID`, then invokes the hook. This is inside the JWT claims, not just the token HTTP response. | A real issued token still needs wire verification; nil/empty session scope is omitted. |
| Does refresh preserve the client/scope? | Refresh validates the OAuth client against the existing session, then calls the same `GenerateAccessToken` with that session/client. The generator again reads session scope before the hook. | Real refresh/revocation acceptance remains unverified. |
| Can a hook set a single resource audience? | Hook output validation accepts `aud` as a string or array. The resource gate deliberately requires one exact string. | No array fallback or global Auth audience change is proposed. |
| Does `getUser` prove all revocation guarantees? | `maybeLoadUserOrSession` rejects a missing session row, but general Supabase docs explain that signed access JWTs can remain valid until expiry at other consumers. | Preserve the narrow own-session/client/resource/RLS checks and prove actual deletion, refresh and direct-RPC behavior. |

Pinned primary files:

- [`UserGet`](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/api/user.go)
- [`requestAud`](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/api/helpers.go)
  and [`X-JWT-AUD` constant](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/api/api.go)
- [`parseJWTClaims` and session lookup](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/api/auth.go)
- [`CustomAccessTokenInput` and access claims](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/hooks/v0hooks/v0hooks.go)
- [`GenerateAccessToken`, refresh and output schema](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/tokens/service.go)

Current [hook documentation](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
requires retaining `iss`, `aud`, `exp`, `iat`, `sub`, `role`, `aal`, `session_id`,
`email`, `phone`, `is_anonymous`. Preserve the entire original claims object,
including issuer-generated `client_id`, `scope`, session and optional claims.
The pinned source schema's required list is narrower than the current prose;
preserving everything satisfies the stricter contract and avoids drift.

## Minimum hook design for database review

Read any existing configured hook first and compose its behavior. Do not replace
an unrelated hook or alter the global Auth JWT audience setting.

The trusted discriminator is `event->'claims'->>'client_id'`. Initial OAuth
issuance uses `oauth_provider/authorization_code`, while refresh uses
`token_refresh`; branching only on the initial method would silently lose the
delegation on refresh. The client field must come from Auth's event, never
`user_metadata`, client name, redirect query or the consent API body.

For registered Studio clients, map the trusted UUID to exactly one enabled row
in the operator-owned `eps.mcp_oauth_resources` registry. A registered but
disabled client, ambiguous enabled resources, malformed principal/session,
anonymous/non-authenticated role or missing trusted `openid` scope must fail
closed. Use separate OAuth client registrations for local/staging/production.
Unregistered OAuth clients and ordinary browser issuance retain their original
claims and behavior.

The core algorithm, intentionally without executable DDL/grants, is:

```sql
-- Proposed internal hook body; not a migration and not installed.
claims := event -> 'claims';
client_text := claims ->> 'client_id';
-- Validate UUID shape before casting. If this client is absent from the
-- operator registry, return the original claims without changing other apps.
-- A registered client must have exactly one enabled resource.
-- Require event.user_id = claims.sub, authenticated/nonanonymous claims,
-- UUID session_id and issuer-provided claims.scope containing openid.
-- Read only active public.app_capability_grants for this exact event user,
-- restrict to the reviewed atomic capability vocabulary, sort/deduplicate.
claims := jsonb_set(claims, '{aud}', to_jsonb(approved_resource));
claims := jsonb_set(claims, '{eps_delegation}', jsonb_build_object(
  'v', 1, 'resource', approved_resource,
  'client_id', approved_client_uuid::text,
  'capabilities', current_atomic_grants));
return jsonb_build_object('claims', claims);
```

Do not manufacture `scope`: the pinned issuer already supplies the actual
session's scope. Do not query a guessed token/session lifecycle stage merely to
reconstruct it. The resource gate, session RPC and business operations recheck
current authority; signed capabilities are an upper bound, never a substitute
for current grants, project membership or resource scope.

The preferred starting privilege model is an internal, non-exposed
`SECURITY INVOKER` hook executable only by `supabase_auth_admin`. Grant only the
columns needed for the registry and active capability lookup, with deliberate
RLS policies for that native Auth role. This does not grant ordinary API users
access to those rows. If the established ownership model requires a dedicated
definer instead, use a NOLOGIN/NOBYPASSRLS owner with those same narrow reads,
fixed empty search_path and explicit RLS; never a postgres/service-role owner or
an authenticated/public callable hook. Database owner must verify the actual
role/RLS/migration state before authoring executable changes.

Required local tests include ordinary browser/unknown-client claim preservation,
registered disabled/ambiguous client denial, forged top-level client_id and user
metadata ignored, initial and refreshed scope preservation, missing openid,
anonymous/role/principal/session mismatch, capability revocation and sorted
bounded delegation. Required live proof is a real approved-client code flow:
inspect claims privately, verify `/user`, narrow session RPC, ordinary business
RPC, refresh and revocation with current central infrastructure. No broad or
browser-token fallback is an acceptable substitute if one boundary rejects it.
