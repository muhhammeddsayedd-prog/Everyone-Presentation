# M07 delegated MCP authorization adapter

Observed 2026-10-30. This is a local implementation and synthetic signed-issuer
verification record. It does not establish configured Supabase OAuth, live
revocation, an intended Claude client connection, public hosting or deployment.

## Components and integration contract

`apps/web/lib/mcp-auth-config.ts` exports
`readMcpAuthConfig(env, runtime, centralUrl)`:

| Mode | Behavior |
| --- | --- |
| `local` (default) | Available only for central-mode HTTP loopback in development/test with `NODE_ENV` other than production. Retains the existing separately guarded local session/bearer flow. |
| `disabled` | No remote OAuth or development fallback. Used when the implicit local mode cannot safely apply. |
| `oauth` | Requires all configuration below, the existing HTTPS central issuer and approved clients. Public resources require HTTPS. Explicit HTTP loopback resources are allowed only in development/test with nonproduction NODE_ENV. Missing/malformed configuration fails closed. |

OAuth configuration is `MCP_AUTH_MODE=oauth`, `MCP_RESOURCE_URL` equal to the
configured app origin plus `/mcp`, `MCP_AUTH_ISSUER` equal to the existing central
origin plus `/auth/v1`, and `MCP_AUTH_CLIENT_IDS` containing one to32 comma-separated
approved OAuth client UUIDs. No credentials belong in these variables. The helper
derives the JWKS and discovery destinations; request headers, tool arguments,
JWT `jku` and arbitrary operator URLs cannot choose them. Other issuers require a
separately reviewed adapter. A local OAuth test may explicitly bind the resource
to `http://127.0.0.1:3000/mcp` (or localhost/IPv6 loopback); this exception never
permits an HTTP issuer/JWKS, public HTTP resource, staging or production HTTP.

`apps/web/lib/mcp-auth.ts` exports:

- `createMcpResourceGate(config, { fetch?, checkSession? })` returns an asynchronous
  request gate producing SDK `AuthInfo` or an HTTP challenge/error response.
- `verifiedMcpIdentity(authInfo)` returns the immutable verified principal,
  session/client IDs and effective capabilities. Only an actual gate result is
  accepted; a spread copy or caller JSON does not establish identity.
- `requireMcpCapability(authInfo, capability)` enforces effective delegation.
  Integration must use these capabilities for both tools/list and tools/call;
  existing domain/RPC resource checks still apply independently.
- `loadMcpAuthorizationMetadata(config, { fetch? })` loads only the known central
  discovery endpoint, validates issuer/endpoints, code flow, PKCE S256 and openid,
  then projects the supported metadata. It does not assume that OAuth is enabled.
- `mcpMetadataResponse(request, config, metadata)` serves the SDK's path-aware
  `/.well-known/oauth-protected-resource/mcp` and authorization-server metadata
  mirror. It accepts the loader's validated object, checks its configured
  destinations again, and does not expose provider registration endpoints.

The root transport integration must gate each request, derive its actor from
`verifiedMcpIdentity`, instantiate request-scoped business clients and a fresh MCP
server, and pass that same verified object into
`handler.fetch(request, { authInfo })`. Do not reuse another request's actor,
tokens or business clients. The helper's SDK authInfo contains the bearer by SDK
contract; never serialize or log that object.

## Token and delegation contract

The SDK gate always sets `expectedResource`. JOSE verifies an ES256/RS256
signature against the fixed central JWKS plus issuer, audience, `exp` and `nbf`.
Additional validation requires a single exact resource `aud`, UUID `sub`,
`role=authenticated`, explicit `is_anonymous=false`, approved `client_id`,
UUID `session_id`, integral `iat/exp` and nonfuture issuance. Ordinary browser
JWTs with `aud=authenticated`, service-role credentials, ID tokens for another
audience, expired/future/forged tokens and missing delegation are denied.

The only advertised OAuth scope is `openid`, establishing identity. Missing it
produces the SDK's403 `insufficient_scope` challenge. Business access uses this
separate, issuer-signed claim:

```json
{
  "eps_delegation": {
    "v": 1,
    "resource": "https://studio.example.invalid/mcp",
    "client_id": "30000000-0000-4000-8000-000000000001",
    "capabilities": ["workspaces.read", "cast.review"]
  }
}
```

This example is synthetic. A [local-only SQL hook candidate](oauth-hook/README.md)
has passed isolated real-role tests; no canonical hook has been installed or
enabled. A promoted and provider-tested hook must bind an approved client to the correct
resource and owner-approved delegation, preserving other business applications
and ordinary browser sessions. User-editable metadata cannot authorize it.
Claim capability names must be known atomic business grants. The gate intersects
them with fresh capabilities returned by the session checker; a signed delegation
never grants more than the current business user.

`checkSession` is a required runtime dependency for successful OAuth access.
It receives the verified bearer/principal/session/client/resource in private
request memory and must establish actual session existence, same user/client,
current grant validity and current business capabilities through a narrow
user-scoped operation. Its returned identity must match exactly. Missing or
unavailable checking returns503; revoked/mismatched identity returns401. There is
no permissive getUser-only fallback, service-role workaround, SQL migration or
cloud Auth configuration included in this slice.

## Verification and remaining gates

The focused suite first failed with `MODULE_NOT_FOUND` for the then-absent
configuration module. The explicit local OAuth configuration case also failed
before adding its narrowly bounded loopback exception. After implementation,
`node tools/run-tests.mjs tests/server/mcp-auth.test.ts` passed9 tests. These use a
fresh synthetic ES256 signing key, real JOSE verification, the installed official
SDK client/server, and controlled fetch/session-check fixtures. Coverage includes
identity and capability intersection, wrong/missing/privileged/anonymous/forged
credentials, expiry/nbf, client mismatch, scope, Origin/Host/query credentials,
revoked/unavailable sessions, bounded/redirect-denied discovery/JWKS, token-key
URL isolation and concurrent principals. Typecheck and focused ESLint also pass.

During parallel root integration, an initial broader `npm run test:unit` run
surfaced older MCP fixture failures. A focused rerun of `guest-mcp.test.ts` had
one pass and one failure: the synthetic composition lacked `studio.getCapabilities`
required by the new root discovery filter. The earlier transcript MCP fixture
also failed. These failures were reported to the root integrator and do not
change the focused9-test auth result. Full-unit acceptance requires root's final
integrated rerun; it is not claimed here.

The SDK transport test observed both `2026-07-28` modern and `2025-11-25` legacy
requests, separate principals and no MCP session IDs. Client2.4.0 defaults to
legacy negotiation; modern tests explicitly use
`versionNegotiation: { mode: { pin: '2026-07-28' } }`.
`supportedProtocolVersions` alone does not select modern negotiation. The exported
`LATEST_PROTOCOL_VERSION=2025-11-25` constant describes legacy defaults; it is not
the modern handler's supported-version registry.

Installed pins checked: official MCP core/server/client2.4.0, Supabase JS2.118.0,
SSR0.12.7 and Node24.18.0. JOSE6.2.13 was initially transitive; the web workspace
must own it as an exact direct dependency. The npm registry confirmed MCP
client2.4.0 and JOSE6.2.13 availability/integrity. Root subsequently added JOSE as
an exact direct web dependency. No dependency upgrade is needed
solely because the legacy exported protocol constant differs from modern docs.

Supabase OAuth is a feasible existing-identity option, but still requires actual
provider enablement, consent UI/client registration, reviewed resource/delegation
hook and narrow session/grant checks. Current Supabase OAuth custom scopes are
unsupported; `studio:*` scopes must not be advertised as existing provider
capabilities. Immediate access-JWT revocation is not implied by sign-out or
getUser. A real integration must prove audience-bearing tokens remain compatible
with the central Auth/RPC boundary and preserve audit attribution. Do not silently
treat an upstream/browser token as resource-specific MCP delegation.

Actual Claude Code/conversational-client sign-in, refresh/revocation, capability
revocation during an in-flight operation, cross-project denial against live
delegated credentials, central shared-data parity and public/deployed transport
remain unverified. Claude remote connectors originate from Anthropic servers and
require public reachability. Hosting remains deferred; no tunnel was introduced.

## Primary sources checked

- [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
  for resource audiences, bearer challenges and metadata.
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
  for Origin checks and modern/legacy transport differences.
- [Official TypeScript SDK authorization](https://ts.sdk.modelcontextprotocol.io/v2/serving/authorization)
  plus installed2.4.0 declarations/source for the actual helper signatures.
- [Supabase OAuth setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
  for enablement, authorization UI and canonical endpoints.
- [Supabase OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
  for the supported OIDC scopes and current custom-scope limitation.
- [Supabase token security](https://supabase.com/docs/guides/auth/oauth-server/token-security)
  for client-specific JWT claims, audience hooks and RLS.
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions) and
  [sign-out](https://supabase.com/docs/guides/auth/signout) for session lookup and
  access JWT validity after revocation.
- [Claude Code MCP](https://code.claude.com/docs/en/mcp) and
  [Claude remote connector requirements](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
  for client configuration and reachability constraints.
