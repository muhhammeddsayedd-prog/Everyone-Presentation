# Hosted Studio connection for Claude Code

App-side setup, initial owner authorization and an authenticated Dummy Pilot Test
read are verified on the hosted pilot. The owner confirmed the exact project
name/ID. Fresh redirect-only reconnect and subsequent MCP authentication also
passed, including the final project read after reconnect with matching owner/server
request ID23c439a1. Scoped connection acceptance is passed. Refresh-token
lifecycle and the complete delegated journey retain separate acceptance checks.

| Setting                | Value                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Studio                 | https://everyone-presentation-pilot.vercel.app                                        |
| MCP URL                | https://everyone-presentation-pilot.vercel.app/mcp                                    |
| Transport              | Streamable HTTP                                                                       |
| OAuth issuer           | https://pyibofyctwnqpvktepse.supabase.co/auth/v1                                      |
| Public client ID       | `f2acafd5-d4b6-4176-b86c-067c57e45ecc`                                                |
| Callback               | `http://localhost:3118/callback`                                                      |
| Scope                  | `openid`                                                                              |
| Authorization metadata | https://everyone-presentation-pilot.vercel.app/.well-known/oauth-authorization-server |
| Client authentication  | Public client, no secret, PKCE S256                                                   |

Merge this entry into your Claude Code MCP configuration yourself:

```json
{
  "mcpServers": {
    "everyone-studio": {
      "type": "http",
      "url": "https://everyone-presentation-pilot.vercel.app/mcp",
      "oauth": {
        "clientId": "f2acafd5-d4b6-4176-b86c-067c57e45ecc",
        "callbackPort": 3118,
        "authServerMetadataUrl": "https://everyone-presentation-pilot.vercel.app/.well-known/oauth-authorization-server",
        "scopes": "openid"
      }
    }
  }
}
```

Use the Studio metadata URL together with the pinned scope. The central issuer
advertises additional scopes, including `offline_access`; current Claude Code
documentation says it can append that scope. Studio's mirror advertises only
`openid`, retaining the same central issuer and authorization/token endpoints.
This is the documented compatibility configuration; its actual owner-client
login and refresh remain acceptance checks.

Then start authentication yourself:

```powershell
claude mcp login everyone-studio
```

Sign in to Studio as `mohamed.abdelrahman@everyone.film` in the browser opened by
Claude Code, complete the emailed sign-in link if prompted, and review the Studio
consent page. Approve access to finish the callback. The delegated client uses
your existing Studio permissions.

The consent correction accepts Supabase's opaque authorization selector and both
valid details responses. A redirect-only reconnect is checked against the native
authorization, approved client/resource, exact scope, registered callback and
current browser session before it is forwarded. Durable claims prevent duplicate
consuming reads and decisions. This replaces the earlier refusal documented in
the historical [consent setup record](../development/m07/OAUTH_CONSENT_SETUP.md).
Initial authorization and the first authenticated MCP read have actual receipts
and owner confirmation. Redirect-only reconnect has actual provider and MCP
authentication proof; the final post-reconnect project read also passed with
matching request ID23c439a1. Start a fresh connection from
Claude rather than reloading an expired or already processed consent URL.

Then check the connection:

```powershell
claude mcp get everyone-studio
```

Inside Claude Code, `/mcp` also opens connection status and authentication controls.
A first read-only request can be: “List my Everyone projects and find Dummy Pilot
Test.” The owner manages Claude configuration and login; the development agent
has not configured Claude, approved consent, exchanged a token or called a Claude
model.

The command syntax, fixed callback and public-client setup follow the current
[official Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

The October31 failed attempt was verified against this registered client and
exact loopback callback. It failed in the app's coordinator RPC before native
authorization details: the coordinator role could not resolve the managed Auth
schema. The deployed correction uses a private browser-context bridge and keeps
the existing permission checks. No Claude configuration change is required for
that defect. Initial authorization and the authenticated Dummy Pilot Test read passed with
owner confirmation. Actual redirect-only reconnect and the final authenticated
project read passed with the exact owner/server request ID. Scoped connection
acceptance is recorded in the final investigation receipt. The localhost callback and
Supabase token exchange run outside Vercel; a returned redirect alone cannot
prove those stages succeeded. See the [investigation evidence](../development/m07/oauth-attempt-trace/README.md).

The pilot stays available until the owner stops it. Screen-reader AT-072, broader
independent M03 semantic checks, the complete delegated business journey and
production release acceptance remain pending. Mobile testing is skipped.
