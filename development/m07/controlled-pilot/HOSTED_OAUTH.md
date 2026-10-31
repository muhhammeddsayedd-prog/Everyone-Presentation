# Hosted OAuth preparation

These helpers prepare the controlled pilot at `https://everyone-presentation-pilot.vercel.app`. They do not claim hosted core, worker or delegated-client acceptance. The owner configures and signs in to Claude Code. No helper reads or writes Claude configuration or starts a model call. The frozen loopback helpers under `development/m07/app-oauth/` remain unchanged.

The resource is **`https://everyone-presentation-pilot.vercel.app/mcp`**. There is no `/api/mcp` route. The central issuer remains `https://pyibofyctwnqpvktepse.supabase.co/auth/v1`; moving the app does not move the issuer. Both the resource gate and consent code read the same approved client IDs.

## Provider configuration

`hosted-oauth-plan.mjs` exports a pure public desired configuration. It performs no writes and invents no client UUID. The six Management API fields are:

```json
{
  "site_url": "https://everyone-presentation-pilot.vercel.app",
  "oauth_server_enabled": true,
  "oauth_server_authorization_path": "/oauth/consent",
  "oauth_server_allow_dynamic_registration": false,
  "hook_custom_access_token_enabled": true,
  "hook_custom_access_token_uri": "pg-functions://postgres/eps/mcp_custom_access_token_hook"
}
```

The [public Management API schema](https://github.com/supabase/supabase/blob/master/apps/docs/spec/api_v1_openapi.json) defines these fields on `PATCH /v1/projects/{ref}/config/auth`. Retain all unrelated configuration. Freshly inspect any existing custom access token hook before activation; this plan must not replace an unrelated hook. A Postgres hook requires no HTTP hook secret. Its installed narrow owner, function body and effective grants remain separate database prerequisites.

The [pinned CLI 2.122.0 encoder](https://github.com/supabase/cli/blob/v2.122.0/apps/cli/src/commands/config/push/push.encoders.ts) maps `auth.oauth_server.enabled`, `.allow_dynamic_registration` and `.authorization_url_path` to these provider fields. It groups a hook's enabled state and URI together. OAuth server fields are independent changed leaves: inspect the real plan and ensure enabling the server includes the consent path in the same update. Do not disable an already enabled server merely to force a diff. An operator config writer must compare nonselected remote state in memory and retain its permanent dispatch claim; these public preparation helpers do not implement that writer.

[Supabase's setup guide](https://supabase.com/docs/guides/auth/oauth-server/getting-started) resolves the authorization path against Site URL. The result must be `https://everyone-presentation-pilot.vercel.app/oauth/consent`. Site URL also affects ordinary default email destinations, so changing it is intentional shared Auth configuration. Preserve the two existing exact ordinary callbacks:

- `http://127.0.0.1:3000/api/auth/callback`
- `https://everyone-presentation-pilot.vercel.app/api/auth/callback`

The app's OAuth business sign-in callback is `/api/oauth/callback?authorization_id=<actual UUID>`. In [pinned Auth 2.197.0 redirect validation](https://github.com/supabase/auth/blob/v2.197.0/internal/utilities/request.go#L89-L107), a matching Site URL scheme, hostname and port permit a same-origin path/query. Thus the hosted Site URL covers that callback without adding a broad redirect wildcard. This is a source inference, not a live sign-in result. General Auth redirects and the public OAuth client's redirect URI are different settings.

## Actual public client registration

Register one dedicated hosted client. The [pinned Auth registration implementation](https://github.com/supabase/auth/blob/v2.197.0/internal/api/oauthserver/service.go) accepts this shape:

```json
{
  "client_name": "Everyone Presentation Studio Hosted Pilot — Claude Code",
  "client_type": "public",
  "token_endpoint_auth_method": "none",
  "redirect_uris": ["http://localhost:3118/callback"],
  "grant_types": ["authorization_code", "refresh_token"]
}
```

Use `client_name`, not the inconsistent `name` spelling in some documentation examples. Do not send a client secret or invent a UUID. The [pinned registration handler](https://github.com/supabase/auth/blob/v2.197.0/internal/api/oauthserver/handlers.go#L95-L117) creates a manual registration and only returns a client secret for confidential clients. This operator refuses secret-bearing or unknown response shapes.

`hosted-oauth-client.py` has `inspect`, `create` and `readback` modes. Importing it is inert. Root executes it after signed-in core acceptance and confirmed provider configuration. It uses the existing protected CLI login through `supabase@2.122.0 projects api-keys --project-ref pyibofyctwnqpvktepse --output json`, capturing stdout privately in process memory. The [pinned CLI output implementation](https://github.com/supabase/cli/blob/v2.122.0/apps/cli/src/commands/projects/api-keys/api-keys.handler.ts) emits the legacy JSON array; its [API-key reader](https://github.com/supabase/cli/blob/v2.122.0/apps/cli/src/command-internal/get-api-keys.ts) omits `reveal` by default. The operator requires exactly one retained legacy `service_role` JWT for the fixed project. An absent, disabled, masked or nonlegacy key is a concrete refusal; it does not reveal newer keys, mint another key, extract the management token or invoke undocumented temporary-key APIs.

JWT shape, project and role checks do not independently verify the JWT signature. Provenance is the successful fixed-project CLI request over its authenticated Management API transport. The key is sent only in headers to the fixed central `/auth/v1/admin/oauth/clients` list/create endpoint. No redirect is followed. No key value or digest is written, printed, put in arguments/environment or uploaded to Vercel/Claude. Immutable Python strings are released after use; this is not a claim of physical memory erasure.

Before creating, the helper acquires and fsyncs a permanent exclusive claim, then rechecks the complete observed client list and source pins. It sends at most one POST. A lost response gets two readback attempts and no POST retry. A known returned client UUID must match the independently observed registration. Existing clients are compared in memory, never copied or hashed into the public receipt. A reused claim can observe current matching metadata but cannot credit the lost original baseline. Run `readback` after an unknown outcome; do not remove the claim to retry.

The public receipt selects eight client fields and uses `evidence_kind: "actual_provider_observation"` only in the real operator entry point. Pure tests default to `synthetic`. `validate_public_receipt(..., require_actual=True)` excludes synthetic results. Provider client metadata does not prove the application resource registry binding: `application_resource_binding_observed` remains false. The separate guarded hosted-binding operator must consume the real UUID and independent client/core evidence. One client must not have two enabled application resources.

## Public app configuration and verification

Only after actual client registration, guarded resource binding and hosted core proof, prepare the four public web variables using `publicMcpEnvironment(actualClientId)`:

```text
MCP_AUTH_MODE=oauth
MCP_RESOURCE_URL=https://everyone-presentation-pilot.vercel.app/mcp
MCP_AUTH_ISSUER=https://pyibofyctwnqpvktepse.supabase.co/auth/v1
MCP_AUTH_CLIENT_IDS=<actual provider-issued hosted client UUID>
```

The function validates public inputs; it neither validates acceptance receipts nor writes environment variables. The operator configuring Vercel must bind those prerequisites and preserve every unrelated variable.

`node development/m07/controlled-pilot/hosted-oauth-readiness.mjs disabled` checks the app's disabled metadata/MCP responses. It makes no provider request and cannot claim the provider server is off. `ready` checks eleven fixed public requests: central discovery and public JWKS, app discovery/resource metadata, denied MCP POST/GET/malformed bearer/cross-origin requests, malformed consent input, CSRF denial and consent HTML. All fetches omit cookies, prohibit redirect following, use time/body limits and emit closed status/boolean results. It never sends a valid authorization selector or requests authorization details, approval, tokens or login.

Passing public readiness proves the public boundary only. Actual delegated session verification, business RPC permission refresh, revocation, signed-in consent and refresh behavior remain client acceptance. Initial already-consented redirect-only provider responses still fail closed because they lack authoritative client/user/scope binding; do not bypass this limitation or repeatedly inspect a real authorization ID as a harmless probe.

For owner-managed Claude Code setup, the [official MCP instructions](https://code.claude.com/docs/en/mcp) support an explicit public client ID, callback port `3118`, and `oauth.scopes: "openid"` in an HTTP server definition. Use the actual hosted client UUID and resource `/mcp`. Do not add a service key, client secret, email/profile scope or `offline_access`. The owner performs client configuration and login; these helpers do not do so.

## Local validation boundary

Only synthetic tests were executed while authoring these helpers: ten Node tests and twelve Python tests, after missing-module RED and additional genuine failing regressions for actual application environment-name interoperability, importable public signing keys, create-response identity, independent readback attempts and honest secret-response rejection metadata. Scoped ESLint and syntax checks pass. No provider, CLI credential loader, actual client, database, Vercel environment or login operation was executed by the author. Root owns any later execution and its distinct observed receipts.
