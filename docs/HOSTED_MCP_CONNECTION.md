# Hosted Studio connection for Claude Code

App-side setup is configured on the hosted pilot. Client registration, resource
binding and web activation passed their checks; all eleven public OAuth/MCP
checks and the signed-in workspace checks passed on the new deployment. Your
Claude login, consent, refresh and complete agent journey remain unverified.

| Setting | Value |
| --- | --- |
| Studio | https://everyone-presentation-pilot.vercel.app |
| MCP URL | https://everyone-presentation-pilot.vercel.app/mcp |
| Transport | Streamable HTTP |
| OAuth issuer | https://pyibofyctwnqpvktepse.supabase.co/auth/v1 |
| Public client ID | `f2acafd5-d4b6-4176-b86c-067c57e45ecc` |
| Callback | `http://localhost:3118/callback` |
| Scope | `openid` |
| Authorization metadata | https://everyone-presentation-pilot.vercel.app/.well-known/oauth-authorization-server |
| Client authentication | Public client, no secret, PKCE S256 |

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

Automatic resumption of an already-consented request is currently unsupported
when the provider returns only a redirect URL. Studio deliberately rejects that
response without verified client, account and scope details. If reauthentication
shows `OAUTH_PROVIDER_RESPONSE_INVALID` (503), report that error name; keep this
reconnect case pending rather than bypassing the check. See the existing
[consent setup record](../development/m07/OAUTH_CONSENT_SETUP.md).

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

The pilot stays available until the owner stops it. Screen-reader AT-072, broader
independent M03 semantic checks, the owner Claude acceptance journey and complete
production release acceptance remain pending. Mobile testing is skipped.
