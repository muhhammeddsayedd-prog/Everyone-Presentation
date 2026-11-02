# Temporary same-client OAuth lifecycle proof — source-only design

Prepared 2 November 2026. No helper, listener, authorization request, project
read, token exchange, refresh or logout was executed by this design. Production
worker preparation/resume remains a separate coordinated operation. The existing
actual-Claude observer and its acceptance criterion remain unchanged.

## Intended evidence and fixed scope

The proposed helper proves provider refresh-token rotation, natural expired
bearer denial, and targeted revocation for **one newly authorized operator SDK
session**. It uses the existing owner account and registered public client, not
a new account, OAuth registration or client secret. It does not prove how the
actual Claude application stores or rotates its credentials. That connection's
signed session/iat/exp observation and successful reads remain separately
documented in `../completion-oauth/README.md`.

Existing registration metadata was observed by the separate OAuth discovery
purpose on 1 November; it must be freshly admitted before later live use:

- Client `f2acafd5-d4b6-4176-b86c-067c57e45ecc`, authentication method `none`,
  authorization-code and refresh grants, PKCE S256.
- Exact callback `http://localhost:3118/callback`; no alternative port.
- Issuer `https://pyibofyctwnqpvktepse.supabase.co/auth/v1`, exact issuer-admitted
  `/oauth/authorize` and `/oauth/token` metadata endpoints.
- Resource `https://everyone-presentation-pilot.vercel.app/mcp`, scope `openid`.
- One read-only `get_project` for existing authorized project
  `6da14b82-8458-451f-aa21-28cb6c85bdc5`.

No token-store inspection, dynamic registration, managed client changes, global
expiry edit, permission reduction, `revokeGrant`, or global/others signout is
part of the helper.

## Source-grounded implementation choices

[Supabase OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
distinguish third-party OAuth exchange/refresh from native Supabase sign-in.
Use the installed official MCP client2.4.0 primitives with fixed pre-registered
client information, not `supabase-js.exchangeCodeForSession`. Pin declarations
and runtime bytes before implementation. `startAuthorization` supplies PKCE;
`exchangeAuthorization` validates response issuer. Omit DPoP and automatic
transport auth recovery so each grant has exactly one dispatch.

The installed SDK's `refreshAuthorization` preserves the old refresh token when
the response lacks a replacement. Therefore a bounded fetch adapter must inspect
the actual token response in RAM before that merge. Rotation requires a present
new refresh token unequal to the previous one; merely receiving a populated SDK
result is insufficient. No token or token digest enters public evidence.

[Supabase local signout](https://supabase.com/docs/guides/auth/signout) terminates
the current session while signed access tokens can remain cryptographically
valid until expiry. Studio additionally verifies current session activity on
every MCP request, so both refresh denial and immediate formerly-valid-bearer
MCP denial are required after logout.

Current official [logout source](https://github.com/supabase/auth/blob/master/internal/api/logout.go)
uses the loaded session for `scope=local`, but falls back to global logout when
there is no session context. The helper must accept only its signature-verified
nonempty UUID `session_id`; never legacy/sessionless JWTs. The official
[authentication middleware](https://github.com/supabase/auth/blob/master/internal/api/auth.go)
rejects a supplied session ID if its row is absent, and the
[route](https://github.com/supabase/auth/blob/master/internal/api/api.go)
uses that middleware. This supports the intended local-only path; managed
deployment version/behavior has not been exercised here. Unexpected compatibility
failure stops the proof, without broader revocation or alternate credentials.

## Proposed phases and evidence

Every mutating phase has a new permanent exclusive claim and bounded normal
return marker. Missing/ambiguous outcomes remain unknown; no automatic replay.
Commands do not accept caller-supplied tokens, endpoint overrides or raw URLs.

| Phase | Action and admission | Safe evidence |
| --- | --- | --- |
| Prepare | Pin sources/registration/metadata and a private current owner-session inventory; reserve a new run. No listener or grants. | Pins, fixed public scope, preflight booleans. |
| Authorize | Only after separate Root live authorization and owner readiness, bind unused localhost3118; owner signs in/consents. Exact state, issuer, callback and single code. | Callback checks, one normal exchange, verified claims and fresh-session admission. |
| Baseline | Persist tokens first, verify JOSE issuer/resource/client/principal/delegation/time claims; session ID must be absent from pre-authorization inventory. Make fixed read. | Session pseudonym, integral iat/exp and successful request ID. |
| Expiry | Close listener after exchange. Return actual signed expiry deadline rather than hold an hour-long process. Later send exactly the unchanged old bearer after natural exp. | Actual time, HTTP401/invalid-token result; no fabricated or edited JWT. |
| Refresh | One SDK public-client refresh grant for fixed resource. Persist new token generation before any next action; verify same fresh session/client/principal and later issuance/expiry. Make fixed read. | Raw-response replacement-present/changed booleans, new iat/exp and successful request ID. |
| Local logout | Snapshot unrelated current session IDs privately; require exact owned session still present and an unexpired verified bearer. Dispatch only POST `/auth/v1/logout?scope=local` with that bearer. | Normal response and exact owned-session absence in independent readback. |
| Denial/preservation | One attempted refresh with the last owned refresh token, then unchanged formerly-valid bearer MCP read. Verify unrelated session IDs retained and existing actual-Claude access preserved separately. | Both denials, owned absence, preservation booleans and safe request IDs. |

Before any grant or logout, a lost prior response consumes that phase forever.
After an unknown refresh, never replay the old refresh token: provider reuse
detection could terminate the session. Preserve private available tokens and the
unknown receipt. Cleanup may target only the known newly created session with a
verified suitable bearer; otherwise report cleanup pending. Do not discover a
broader fallback. If a new session was not created, do not refresh or log it out.

## Confidentiality and bounded transport

Reuse the existing reviewed Windows private-file primitive's protected
current-owner/SYSTEM ACL at first creation, with owner/ACL/reparse checks.
Keep verifier/state, code, session inventory, user UUID and tokens in RAM or a
private run inbox. Use exclusive generation files, flush/fsync and verify ACL
before saving a normal-return receipt; preserve earlier generations privately.
Do not reuse global browser/Claude/SDK caches. Tokens never enter argv,
environment, public JSON, exception text or raw diagnostics.

The loopback server exposes only fixed `/start` and `/callback` paths, validates
loopback peer/Host and bounded query size, and emits no URL/request logging.
`/start` redirects the owner browser to the authorization URL without placing
that URL in a shell command. Bind IPv4/IPv6 loopback consistently with registered
localhost, fail on a port conflict, and never kill another process. Close all
owned listeners promptly after the single callback or a bounded timeout.

The fetch adapter allows only admitted endpoint/method/body fields and exact
issuer/resource/client binding. Force manual/error redirects, omit cookies,
bound time and response bytes, and redact every failure to closed codes. Disable
SDK automatic refresh/reconnect/retry. Fetch raw replacement presence into RAM;
never persist raw HTTP bodies. Read-only MCP calls may still create normal audit
records, so none are permitted during the worker switch boundary.

## Concrete remaining risks and tests before live use

1. **Session reuse:** owner consent may reuse an existing session. Prove the
   signed ID is new against private preflight inventory; fail before logout if
   it is not. No private browser mode or UI assumption substitutes for this gate.
2. **Local-logout compatibility:** upstream source is not a deployed version
   receipt. Preserve an unexpected denial; do not replace the public OAuth
   bearer with a service/admin/browser token or client-wide revoke.
3. **Unrelated-session churn:** natural expiry or concurrent owner signout can
   change inventory. A mismatch makes preservation unconfirmed; it does not
   authorize restoring sessions or inventing a successful comparison.
4. **Lost rotated token:** journal creation and token persistence failure must
   retain unknown outcome without retry. Test crashes at each durable boundary.
5. **Natural wait:** actual signed exp may require an hour. Do not lower global
   JWT lifetime or retain a listener during that wait. Read only safe phase
   deadlines until a separately authorized expiry-check invocation.

The inert primitives/adapters are now implemented as described in `README.md`;
live coordinator wiring and arming still require Root review. Synthetic tests
should
cover swapped issuer/state/client/resource/session, reused preflight session,
port conflict, callback duplication, raw-response omitted/unchanged rotation,
no automatic redispatch, unknown response/persistence failures, local-only exact
logout URL, unrelated-session preservation refusal, closed safe projections and
actual protected-file ACL verification. These are local tests; genuine owner
consent, provider rotation/denials and preservation require their own later live
receipts. No such acceptance is claimed by this document.

## Verified local source pins

Main installed SDK2.4.0 `index.d.mts` SHA256
`314d358ab8a1a2a36d984e4bb5768c8a14ee9680ac80b37233a3c3b3b39d0468`;
runtime `public-CvV4ZHkX.mjs`
`51960a2096bc31dfb4e6a67c07dfaadf04adec75ddad1e032da63092d3decb46`.
Main `apps/web/lib/mcp-auth.ts`
`98a6bc17ffdd4e1360431cb998af14313c136dbc3c6714a1460a2d3897a3e99e`;
`tools/provision_logo_verifier.py`
`660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c`.
The installed auth-js2.118.0 source confirms explicit local-scope POST usage;
the proposed OAuth code/refresh exchange uses MCP2.4 primitives instead.
