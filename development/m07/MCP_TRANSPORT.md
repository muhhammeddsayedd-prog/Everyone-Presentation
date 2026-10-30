# M07 HTTP/central session integration

Implemented locally on2026-10-30. This follows the signed-delegation adapter in
[MCP_AUTH.md](MCP_AUTH.md); it does not enable central OAuth or establish a live
Claude connection.

`apps/web/app/mcp/route.ts` now reads explicit local/disabled/OAuth configuration
and delegates to `mcp-http.ts`. Local mode retains the existing Host/Origin and
loopback development guard plus signed-in browser/bearer identity. OAuth mode
verifies the resource-specific signed token and actual session before creating
business services. It derives the actor exclusively from verified delegation,
compares fresh central capabilities' principal with that actor before protocol
dispatch, and supplies both `authInfo` and the effective capability intersection
to the official SDK/server. OAuth never calls `currentActor` as a fallback.

Each request composes fresh existing central services, including optional guest
sharing and the new settings service. Existing Next factories obtain the same
current request bearer through `getCentralClient`; they do not read a
caller-selected user ID or select another browser identity when a bearer fails.
Their Auth/RPC compatibility with future resource-audience tokens remains a real
provider integration gate.

The handler supports modern and stateless legacy Streamable HTTP. `auto` response
mode returns JSON normally and permits related SSE notifications; cleanup follows
response consumption/cancellation, preserving streaming output. GET/DELETE session
traffic is handled by the SDK's stateless405 behavior. Request bodies remain
bounded to96KiB. Transport errors and responses retain private no-store headers.

The two added Next discovery routes are:

- `/.well-known/oauth-protected-resource/mcp`
- `/.well-known/oauth-authorization-server`

They construct no business user/client. Local/disabled mode returns404; OAuth
mode loads only the fixed central public discovery URL and passes its validated
metadata object to the SDK helper. Missing or invalid metadata returns503. No
registration endpoint or unsupported custom OAuth scope is advertised.

`mcp-central-session.ts` adds a fresh publishable-key/acting-bearer client for
exactly `public.eps_validate_own_oauth_session(p_resource text)`, bounded by a
five-second abort signal. Its closed response is
`{active,principal_id,session_id,client_id,capabilities}`. Active IDs must be UUIDs;
inactive IDs can be null and inactive capabilities must be empty. Only atomic
business capability names are accepted. Missing RPC, private extra fields,
malformed data or dependency failure fails closed with503. Revoked/inactive
sessions reach the resource gate as401. There is no Auth-table grant, SQL
migration, service-role client, broad token exchange or cloud setting change in
this transport change. The separate reviewed database candidate and actual
provider compatibility have their own evidence.

`tests/server/mcp-http.test.ts` first failed because `mcp-http.ts` did not exist.
After implementation it passed6 focused tests. Fixtures use real JOSE signatures,
official SDK HTTP clients and actual Supabase JS user clients with controlled
central Auth/RPC responses. They cover revoked/missing/malformed session RPC,
no browser fallback, nullable inactive state, closed authority DTOs, insufficient
scope before business construction, concurrent modern/legacy client principals,
current capability filtering, malformed business results, explicit local guard,
public metadata and central-principal mismatch. These are synthetic integration
fixtures, not cloud acceptance. The previous combined9-auth plus5-transport run
passed14 tests; the final sixth transport test adds principal-mismatch coverage.
Focused ESLint passes. A root typecheck passed after route integration; the final
global gate is owned by the root integrator. No additional broad unit run was
started during concurrent edits.

Independent security review found no required transport change. It did not run
tests or verify live issuer metadata, client issuance or cloud compatibility.
Actual intended-client login, resource-bound Auth/RPC compatibility, refresh and
real revocation remain unverified. Hosting remains deferred.
