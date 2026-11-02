# Actual Claude token-lifecycle observation

The product emits a separate closed `eps.mcp.verified_token` event only after
JWT signature/issuer/audience/time checks, delegation, current live session and
SDK scope acceptance. It observes only the existing approved public client
`f2acafd5-d4b6-4176-b86c-067c57e45ecc`. It does not change authentication,
permissions, discovery, token lifetime or API responses. The existing closed
authorization-stage trace remains unchanged.

The exact event fields are `event`, `trace_id`, `client_id`, `session_sha256`,
`iat` and `exp`. The pseudonym is SHA256 of the verified canonical session UUID;
it permits same-session correlation without logging that UUID. Integral times
come from the already verified JWT. No raw token, session UUID, principal,
headers, payload, email or raw errors enter this event. The observation is
request-local and synchronous/async sink failures cannot affect authorization.
No new credential or provider request is involved.

This event proves token/session acceptance, not a completed business operation.
The route adds its existing `trace_id` to the existing safe project-read receipt,
allowing the owner-visible tool result `request_id` to be joined to the token
event from that same HTTP exchange. A later business-context failure may still
follow token acceptance; require the matched successful project read as well.

## Owner's actual existing Claude connection

Wait until root deploys this exact source and the current upload journey has
finished. Use the existing connection; do not re-enroll, reconnect, sign in
again, inspect credential stores or enable raw HTTP/debug logs.

1. Through actual Claude, read existing authorized project
   `6da14b82-8458-451f-aa21-28cb6c85bdc5` (currently Live Testing Project).
   Retain only the actual result's request ID and time. Root reads the bound
   deployment's normal runtime logs and joins that successful project receipt's
   trace ID to exactly one closed verified-token observation.
2. Record its signed `iat`, `exp` and session pseudonym. Keep this connection
   intact; no owner login/reconnect, global expiry edit or fabricated token.
   Wait naturally past that observed token's `exp`, using the real issued
   duration, not a sample duration from documentation.
3. Make the same read through actual Claude after that deadline. Match its
   actual result request ID to the same client/session pseudonym and a later
   issuance/expiry, with a successful current live-session check. Record actual
   event/provider times and owner attestation that there was no re-enrollment.
   The session pseudonym must not change; a new session is a different result.
4. Retain both matched read receipts and closed token observations, exact
   deployed source identity and natural-expiry deadline. A new token after
   natural expiry with the same session and a genuine Claude read establishes
   renewed operational access under that connection. It does not expose or
   directly observe Claude's private refresh-token storage.

Claude may refresh proactively, so the later token's `iat` may precede the old
`exp`. Require that the **later successful read** happened after the first
`exp`, and that the token changed its signed issuance and extended its expiry.
Do not require an application 401 when none occurred or label this an actual
old-expired-bearer rejection. If a real expiry denial/retry trace exists, preserve
it separately. [Official Claude authentication documentation](https://code.claude.com/docs/en/mcp#authenticate-with-remote-mcp-servers)
describes refresh/reconnect and one retry after a stored-token 401; that source
does not turn an unobserved HTTP exchange into actual test evidence.

Initial connection, reconnect and real MCP reads already have separate scoped
proof. This new source and signed-JWT tests do not themselves establish live
refresh, actual rotation, revocation or full release acceptance. No SDK client
is substituted for Claude, and no live OAuth action was performed by this work.

## Separate rotation and targeted-session revocation requirement

Rotation and invalidated-refresh denial require further bounded actual evidence.
Metadata timestamps alone do not prove receipt/storage of a rotated token.
If that evidence is collected with a separately authorized temporary OAuth
session using the existing registered client, label it as that session's
provider/protocol proof, not actual Claude's token-storage behavior.

For targeted revocation, first bind the fresh owned session and preserve the
other current sessions/access through safe metadata before/after. Use only
that owned session's documented `signOut({scope:'local'})`; then require its
refresh rejected, its unchanged formerly valid bearer denied by Studio's live
session gate, exact owned-session absence and unrelated-session preservation.
Preserve unknown mutation outcomes and never automatically retry a possibly
accepted rotation or logout. Owner controls genuine login and consent; no new
identity or credential-store extraction is authorized by this document.

Never use default/global signout, `others`, client-wide grant revoke, registry
disable, a permission reduction, secret rotation or a global expiry change as
a substitute. Supabase's client-wide `revokeGrant` invalidates every same-client
session for that user and would interrupt the working Claude connection.
[OAuth grant behavior](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows#revoking-access)
and [local/global signout behavior](https://supabase.com/docs/guides/auth/signout)
define those distinct scopes. This separate live revocation proof is pending.

## Offline verification

Six new synthetic signed-JWT tests cover the exact event projection, real JOSE
verification, rejected/expired/forged/insufficient-scope silence, fresh-session
denial/unavailability, synchronous/async observer errors, concurrent sessions,
fixed-client filtering and malformed/missing trace IDs. Together with existing
auth/stage suites, 21 focused tests pass. Focused lint and root TypeScript pass.
Fresh full deterministic gates are recorded separately after the source commit;
they are not hosted/client acceptance.

```text
node tools/run-tests.mjs tests/server/mcp-auth.test.ts tests/server/mcp-auth-stage-trace.test.ts tests/server/mcp-verified-token-trace.test.ts
```
