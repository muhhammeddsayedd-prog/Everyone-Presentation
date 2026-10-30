# Local Studio OAuth connection

Prepared 2026-10-30. **Pending operator completion:** the actual registered public
client UUID and current app/provider readiness receipts must be filled below
before these connection instructions are ready to use. This document does not
configure Claude Code, start a login, approve consent or issue a token.

The coordinated native issuer30 is installed and independently verified. The original local database remains29. Provider activation is prepared but unsaved while the required browser action-time confirmation is pending; no actual client UUID or OAuth runtime is available yet. See the [actual preparation summary](../../tracking/evidence/m07/app-oauth/2026-10-30-pre-activation-summary.json).

## Exact local connection

| Item | Value | Evidence/status |
| --- | --- | --- |
| App origin | `http://127.0.0.1:3000` | Root must verify the currently owned process and restarted configuration. |
| MCP resource/audience | `http://127.0.0.1:3000/mcp` | Exact resource binding; no trailing slash. |
| Central issuer | `https://pyibofyctwnqpvktepse.supabase.co/auth/v1` | Existing central HTTPS issuer; preserve signing configuration. |
| Public client name | `EveryoneStudioLocalM07` | Planned registration; confirm actual returned metadata. |
| Public client UUID | **PENDING: actual returned UUID** | Never substitute a generated example or a synthetic fixture. |
| Registered client callback | `http://localhost:3118/callback` | Exact callback for the user's Claude Code connection. |
| Requested scope | `openid` | Identity scope; current business permissions remain separate. |
| Client authentication | Public client, no secret, authorization code + PKCE S256 | Confirm actual provider registration. |
| Current app/provider proof | **PENDING: root receipt paths and observed time** | Metadata/challenge alone do not establish token issuance. |

The client callback uses `localhost`; the app resource uses `127.0.0.1`. They
serve different purposes. Studio's ordinary browser sign-in callback and
`/api/oauth/callback` are separate from the client callback above.

## App-side readiness before handoff

The root/operator owns configuration and provider/database operations. Required
application settings, using the real public UUID, are:

```dotenv
APP_ENV=development
CENTRAL_ADAPTER_MODE=supabase
APP_BASE_URL=http://127.0.0.1:3000
MCP_AUTH_MODE=oauth
MCP_RESOURCE_URL=http://127.0.0.1:3000/mcp
MCP_AUTH_ISSUER=https://pyibofyctwnqpvktepse.supabase.co/auth/v1
MCP_AUTH_CLIENT_IDS=<ACTUAL_PUBLIC_CLIENT_UUID>
```

The local HTTP resource additionally requires a nonproduction `NODE_ENV`.
Issuer, discovery and JWKS remain HTTPS. The same real UUID must be present in
the app allowlist and one enabled, exact resource-registry binding. The reviewed
native issuer hook must be installed and actually selected by Auth. Keep any
unrelated hook behavior, existing Site URL, browser redirects, signing settings
and unrelated clients intact. Dynamic registration is not advertised by Studio.

The [configuration parser](../../apps/web/lib/mcp-auth-config.ts),
[resource gate](../../apps/web/lib/mcp-auth.ts) and
[own-session check](../../apps/web/lib/mcp-central-session.ts) require signature,
issuer, exact resource audience, approved client, authenticated nonanonymous
principal, active matching session and the issuer-signed `eps_delegation` claim.
Signed atomic capabilities are intersected with current central grants; domain
permissions and project membership still apply to each operation. An ordinary
browser bearer or `openid` alone does not authorize MCP business operations.

Read-only app checks, after the root restarts with the reviewed configuration:

| Probe, without cookies or Authorization | Required observation |
| --- | --- |
| `GET /.well-known/oauth-protected-resource/mcp` | HTTP200; exact resource above, existing central authorization server, `openid`; no registration endpoint. |
| `GET /.well-known/oauth-authorization-server` | HTTP200; exact central issuer/authorize/token/JWKS URLs, code flow and S256; no advertised dynamic registration. |
| `GET /mcp` with `Accept: application/json, text/event-stream` | HTTP401 with Bearer challenge pointing to the path-aware protected-resource metadata. No business operation or user context is created. |
| The same MCP request through `http://localhost:3000/mcp` | HTTP403 for the incorrect configured resource host. |

Record only statuses and these public projected fields, plus observation time and
owned-process identity. OAuth mode disabled/local may return metadata404;
unavailable or incompatible upstream metadata returns503. Either remains pending.
Successful metadata is not a signed-token, refresh, revocation or client proof.

A separate root-controlled PKCE pending-consent probe would create new Auth
state, so it is not a read-only diagnostic. After actual client registration,
use a fresh state and S256 challenge, no cookies, the exact client callback and
`openid`; inspect the initial response with redirects disabled, then stop before
the consent page. Never reuse an existing authorization selector or call
`getAuthorizationDetails` as passive discovery: the pinned provider can bind a
user or autoapprove an existing consent. No approval, token exchange or existing
consent consumption is part of this probe proposal.

## User-owned Claude Code setup and login

Only after the pending UUID/readiness fields are completed, the user can merge
this entry into the project's `.mcp.json` under `mcpServers`, preserving any
existing entries. Save it with a text editor as UTF-8. This avoids sending JSON
through a Windows command shim and pins the requested scope explicitly:

```json
{
  "mcpServers": {
    "everyone-studio": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp",
      "oauth": {
        "clientId": "<ACTUAL_PUBLIC_CLIENT_UUID>",
        "callbackPort": 3118,
        "scopes": "openid"
      }
    }
  }
}
```

From that project directory, the user can then run in PowerShell:

```powershell
claude.cmd mcp login everyone-studio
```

These are user-owned project configuration/login instructions; this work has
not created or changed `.mcp.json` or Claude settings. Public clients use no
client secret. Keep port3118 available. In the browser, verify the local
Studio origin, actual approved client name, existing business account and
`openid` before choosing consent. After returning to Claude Code, use `/mcp` to
check the connection. Registration and login do not themselves prove a complete
business journey, upload-byte transfer, refresh or revocation.

The installed native package is Claude Code2.1.301. Its read-only `mcp add` and
`mcp add-json` help confirms the client/callback options, but exposes no scope
flag. Its public JavaScript is a launcher, so automatic scope selection was not
verified from implementation. Current
[official Claude Code guidance](https://code.claude.com/docs/en/mcp#use-pre-configured-oauth-credentials)
documents the public-client ID and fixed callback; the
[scope setting](https://code.claude.com/docs/en/mcp#restrict-oauth-scopes) takes
precedence over discovered scopes. Those docs also allow automatically appending
`offline_access` if the authorization server advertises it. Verify the actual
provider metadata and consent request contain only Studio's supported `openid`;
the config snippet alone is not client compatibility proof.

Provider setup and PKCE behavior were checked against
[Supabase OAuth setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
and [OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows).
The changelog markdown endpoint was unavailable through the documentation tool;
no complete current changelog review is claimed. See
[consent constraints](OAUTH_CONSENT_SETUP.md),
[signed-claim contract](MCP_AUTH.md) and
[issuer release preparation](issuer-release30/README.md) for the separate
implementation, synthetic/local proof and live-provider boundaries. Hosting,
hosted conversational clients and the full human/delegated release journey
remain separate acceptance work.
