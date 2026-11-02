# Historical research before actual-Claude observation implementation

Root selected the actual-Claude observation approach below. The product event
and signed-JWT regressions are now committed as `c88f58c`; [README.md](README.md)
describes that current implementation. This note preserves the earlier research
and its evidence boundaries, rather than implying a separate SDK was run.

Research only, observed 2026-11-01 at 23:57–23:58 UTC. No authorization,
callback listener, code exchange, refresh, logout, consent revocation or new
client/session was started. The owner's active Claude upload journey remains
untouched. No credential store was read.

## Current observed public/client configuration

Fresh public discovery from the pilot mirror and canonical issuer agrees on
the existing issuer, `/auth/v1/oauth/authorize`, `/auth/v1/oauth/token`,
`authorization_code`, `refresh_token` and S256. The mirror advertises only
`openid`; canonical discovery advertises its additional standard scopes. Neither
advertises a `revocation_endpoint`. Do not guess an OAuth `/revoke` endpoint.

One new read-only normal Supabase CLI 2.122.0 query, using the existing login
and explicit linked target `pyibofyctwnqpvktepse`, confirmed exactly one client
`f2acafd5-d4b6-4176-b86c-067c57e45ecc`: not deleted, public, authentication method
`none`, registered `http://localhost:3118/callback`, both code/refresh grants and
enabled exact pilot MCP resource. It read only these projected booleans/client
UUID, no token/session rows. Exit 0, no timeout/overflow, rollback, no retry.
The closed metadata receipt is protected under
`.local/completion-oauth/05035dc7-6a95-4f26-afab-7354abf9f92c/metadata.json`.

## Preservation boundary

Supabase documents that OAuth `revokeGrant(clientId)` invalidates every session
and refresh token for that user/client. It would also interrupt the owner's
working Claude connection. Do not invoke it under a requirement to preserve
unrelated sessions. The similarly named Supabase Management API `/v1/oauth/revoke`
concerns platform OAuth applications, requires a client secret, and is not the
public Auth-server session flow.

The documented `signOut({scope:'local'})` targets the current session; the
default is global and is prohibited for this bounded purpose. Installed
`@supabase/auth-js` implements it with `POST /logout?scope=local` and the acting
session JWT. A separate temporary-session helper can use that documented path,
subject to fresh public API-key/gateway requirements and current source checks.
No service/management credential is needed or permitted. Do not use the
producer's existing browser/Claude token as that acting session.

JWT signature validity alone survives logout until expiry, as Supabase
documents. Studio additionally checks actual current session existence on every
MCP request (`apps/web/lib/mcp-auth.ts`), so an unchanged formerly valid bearer
should fail immediately after its own session is removed. Verify both that
resource denial and rejected refresh; do not call a successful logout response
or metadata absence complete acceptance. Preserve/check unrelated session IDs
and access before/after through a separately bounded metadata projection.

## Actual Claude versus a same-client protocol observer

Official Claude Code documentation describes stored-token 401 handling as
refresh, reconnect and one retry. Its private token storage is opaque here.
Do not extract it, enable unreviewed raw debug logging, fake an expired JWT,
shorten global JWT expiry, or call a second SDK client "Claude".

The current resource gate logs bounded authorization stages and error enums;
it deliberately omits identity/session/iat/exp. Existing project-read logs bind
the actual owner request/client/project, while the historical refresh observer
can show source-grounded session timestamps. Those observations cannot establish
which exact token a current Claude process refreshed/retained/used, or prove
rotation and post-revocation denial by themselves.

The smallest actual-Claude observation is:

1. After its current journey finishes, owner makes one safe `get_project` in
   the existing connection and retains its request ID.
2. A narrowly reviewed server observation records **only after successful JWT,
   delegation and current-session verification** the matched request ID,
   client/principal/session UUID and integral `iat`/`exp`; no token, body,
   headers, email or personal data. Existing authorization decisions remain
   unchanged. This extra observation is not implemented by this research.
3. Wait past the observed token's natural `exp`, without re-login/reconnect,
   clock changes or global expiry changes. Owner invokes the same read again.
   Match the actual successful MCP request to the same session/client and a
   later signed issuance/expiry. Current claims and session readback establish
   renewed access; if the client proactively refreshes there need not be a
   resource 401. Do not label proactive refresh a captured expired-token denial.
4. Actual client-wide revoke would require the owner to finish and intentionally
   disconnect its working client first, with explicit scope for all affected
   same-client sessions. It cannot be added under the current preservation
   boundary. The separate-session procedure below proves session revocation,
   not consent-wide client revocation or Claude's own refresh-token storage.

## Genuine separate-session protocol proof, if selected

This can establish the actual provider and deployed MCP lifecycle under the
**same registered public client ID**, honestly labeled an operator SDK session.
It cannot alone close actual-Claude automatic refresh/rotation acceptance.

- Use pinned official `@modelcontextprotocol/client` 2.4.0 already installed,
  existing public client information only, and PKCE S256 with exact issuer,
  `openid`, resource and registered localhost3118 callback. Never dynamically
  register/save another client. Bind callback state and issuer to the one run.
- Start only when owner is ready, port3118 is unused and the normal current
  session inventory is preserved. Fail on a port conflict; never stop the owner
  process or substitute an unregistered callback. Owner controls browser login
  and consent, using a distinct temporary OAuth session for its existing user.
- Keep generated verifier/state and freshly issued tokens in RAM or a protected
  current-owner/SYSTEM private inbox; no CLI argv, URL/log dumps, environment,
  global credential cache, source or public token digests. The callback code is
  unavoidably in the OAuth callback URL but must never be printed or logged.
  A fixed local `/start` page can redirect in the browser without placing an
  authorization URL in a shell argument.
- Verify signed issuer/audience/client/session/principal/iat/exp and exact
  delegation. Make one read-only MCP `get_project` using that issued bearer and
  bind its actual request ID. Do not allow SDK automatic refresh to obscure the
  deliberate old-bearer expiry check.
- Wait naturally until that exact access token expires. One unchanged old-bearer
  MCP request must deny. Then make one public refresh grant with the exact
  existing client ID (no secret), save the returned rotated token atomically
  before any later action, verify its signed binding, and make a successful
  read-only MCP call. Record safe changed-token booleans, times and request IDs,
  never raw tokens or their public hashes. If no new refresh token is issued,
  rotation is unverified rather than assumed.
- A refresh outcome lost after dispatch is not automatically retryable: token
  rotation may have committed. Retain the unknown receipt and target only this
  known fresh session for cleanup; do not trigger refresh-token reuse detection
  against another session or retry old credentials to invent a result.
- Explicitly log out this fresh session with local scope, then require denied
  refresh and denied MCP use of the formerly valid new bearer. Independently
  verify the exact new session absent and unrelated session/access preservation.
  This is a bounded session-revocation test, not `revokeGrant` acceptance.

An hour-scale natural-expiry wait may be required; use the actual issued `exp`,
not the sample docs' duration, and keep the pilot running under its current
owner-stop policy. No active wait/session is prepared yet. Root should choose
the exact acceptance claim before implementing an inert helper: current work
does not silently replace the intended-client criterion with another client.

## Primary sources and local implementation

- [Supabase OAuth flows and refresh grants](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
  document public client refresh, optional rotation and client-wide grant revoke.
- [Supabase local/global signout](https://supabase.com/docs/guides/auth/signout)
  distinguishes current-session logout and access-token expiry.
- [Official Claude Code MCP authentication](https://code.claude.com/docs/en/mcp#authenticate-with-remote-mcp-servers)
  describes actual stored-token refresh/reconnect/retry behavior and owner login.
- [Official MCP TypeScript OAuth client](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/clients/oauth.md)
  describes `OAuthClientProvider`, existing client information, PKCE, storage,
  callback state/issuer and transport refresh. Installed 2.4.0 declarations,
  rather than unpinned latest examples, must govern any new helper.
- Local: `docs/HOSTED_MCP_CONNECTION.md`,
  `development/m07/oauth-refresh-metadata36/README.md`,
  `apps/web/lib/mcp-auth.ts`, installed client2.4.0 OAuth declarations and
  `node_modules/@supabase/auth-js/src/GoTrueAdminApi.ts`.
