# Canonical Supabase M01 adapter

This server-only package supplies the real Supabase authentication/client and curated RPC adapter. It does not provision users, assign capabilities, create canonical projects, mutate cloud configuration or deploy a service. The integration owner wires it into Next.js and records actual database/auth acceptance separately.

## Configuration and package versions

Required server configuration:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

`readCentralConfig()` validates an HTTPS origin (or explicit loopback HTTP for local Supabase) and a new-format `sb_publishable_…` public key. It never falls back to `SUPABASE_SERVER_KEY`, a secret key, legacy service-role JWT, database password or universal acting identity. Error messages name required configuration without serializing its values. The canonical project URL/key are supplied by the environment; no cloud identity or credential is hardcoded in this package.

On 2026-10-28 the npm registry reported `@supabase/supabase-js` **2.118.0** (Node ≥22) and `@supabase/ssr` **0.12.7** (peer `supabase-js` ^2.114.0). The package pins both exact versions, compatible with this repository's Node 24. The Supabase changelog and current primary SSR/auth/client documentation were checked before implementation. The upcoming removal of old CBC TLS suites does not require downgrading TLS or adding a custom legacy agent to this Node client.

## Request-scoped clients and identity

`createRequestServerClient({ url, publishableKey, cookies: { getAll, setAll }, secureCookies? })` creates a fresh SSR client for one incoming request. Cookie writes forward **both** the cookie array and the SDK's second cache-header argument. The Next adapter must apply those headers to its response along with the cookies. It must not swallow failed cookie writes, reuse a client across users/requests, or cache authentication responses. Cookies are HttpOnly, SameSite=Lax, scoped to `/`, and Secure by default in production. Disabling Secure cookies in production is rejected.

The factory returns the official SDK client, so the web layer can implement its authorized OTP/PKCE callback and refresh flows. The package itself sends no email or sign-in request unless its caller explicitly invokes such an SDK operation. It creates no anonymous identity or default producer.

`createBearerUserClient({ url, publishableKey, accessToken })` supports a user-authenticated HTTP/MCP adapter. It holds that user's token in request-local memory, disables token persistence/automatic refresh and sends the same token to Auth and every RPC. Obvious privileged service JWTs are rejected. The raw token is never part of an actor DTO or stored in a tracking record.

`verifyCentralUser(client)` calls the Auth server's `getUser()` using the actual request session/token. It does not trust the cookie's embedded user object, `getSession()`, `user_metadata` or an actor ID supplied by an API caller. Anonymous and non-user identities fail. Auth throttling and temporary outages remain retryable errors; they do not become fabricated sign-in success or a blanket invalid-password response. Fetch failures are sanitized before the SDK can propagate/log their original exception details.

`await createCentralStudio(client)` verifies that fresh user and returns `.verifiedIdentity` plus the M01 operation methods. It accepts only a client created by this package's request/user factory. A supplied domain actor must match the verified principal. Actor IDs and capabilities are never passed to SQL as authority: every RPC derives `auth.uid()` and checks live capability grants, project membership and separate client-write membership in the database.

## Curated operation boundary

| Operation | Public RPC |
|---|---|
| Capabilities | `eps_get_capabilities` |
| Project list/read/update | `eps_list_projects`, `eps_get_project`, `eps_update_project` |
| Workspace list/create/read/update | `eps_list_workspaces`, `eps_create_workspace`, `eps_get_workspace`, `eps_update_workspace` |
| Audience preset list/create/update/archive | `eps_list_audience_presets`, `eps_create_audience_preset`, `eps_update_audience_preset`, `eps_archive_audience_preset` |

Methods retain the existing domain signatures and DTOs. Lists use the RPC's opaque cursor and return `{data, page}`; workspace listing supports an optional central `project_id` filter. Mutations pass explicit IDs, strict input field sets, row versions and idempotency keys to the constrained SQL functions. Optional server correlation uses `x-eps-request-id` (1–128 characters from the agreed safe identifier alphabet) and `x-eps-client-type` (`browser`, `api` or `mcp`); SQL stores only these declared metadata fields, never all headers. There is no arbitrary table, schema, SQL or RPC-name operation exposed to callers.

Responses are checked for the complete published M01 projection. Unexpected/private columns or malformed DTOs fail closed with `CENTRAL_RESPONSE_INVALID`; they are not spread into a browser response. Database errors use an allowlisted code/status/message mapping and at most a safe current row version. Raw SQL, hints, paths and provider diagnostics do not become user-facing messages.

Private logo upload, upload completion/cancellation and media read/playback methods currently return a typed **503 `FEATURE_NOT_IMPLEMENTED`**. They do not substitute local storage or fabricate cloud asset IDs. The canonical capabilities RPC advertises no available upload purposes until that separate Storage implementation is wired. Other project/workspace operations remain usable.

## Verification boundary

```powershell
npm.cmd exec -- tsx --test packages/central/test/*.test.ts
npm.cmd exec -- eslint packages/central --max-warnings 0
npm.cmd run typecheck
```

Observed local results: **7/7 deterministic adapter tests passed**, package ESLint passed with zero warnings, and repository typecheck passed. Tests use the actual pinned Supabase SDK with an injected synthetic HTTP transport; no real Auth request, cloud SQL or email is involved. The tests verify:

- Public-only configuration and privilege-token rejection, fresh Auth verification, anonymous/invalid-user denial and actor/session binding.
- Exact curated RPC argument mapping, user token continuity, correlation headers, no-store/timeout behavior and unchanged database-derived capabilities despite forged user metadata.
- Strict input rejection, malformed/private DTO rejection and truthful unsupported Storage errors.
- Typed/sanitized database errors and retryable Auth throttling/outages. The throttling regression and the error allowlist's inherited prototype-key regression were observed failing before their fixes. Unknown `P0001` messages including `toString`, `constructor` and `__proto__` now retain the generic redacted 503 response.
- Actual SDK SSR cookie writes reaching the cookie adapter together with private cache headers, without printing or attaching cookie/token values.

Real database migration/replay/RLS evidence, actual human sign-in, explicit producer enrollment, canonical project/client writes and deployed session refresh remain integration-owner gates. An account that signs in receives no business authority until an authorized owner grants the required capabilities and resource memberships. This package does not treat zero cloud users as permission to create a synthetic cloud producer.

Primary references: [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims), [RPC](https://supabase.com/docs/reference/javascript/rpc), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [TLS changelog](https://supabase.com/changelog/cbc-tls-ciphers-deprecated). The installed SDK type/source definitions were also inspected for the current cookie-header API.
