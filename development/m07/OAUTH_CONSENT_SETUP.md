# Studio OAuth consent UI and operator setup

## 2026-10-30 live discovery follow-up

Authenticated [dashboard discovery](../../tracking/evidence/m07/live-settings-oauth/2026-10-30-provider-discovery.json) now confirms OAuth disabled, no apps/hooks, SiteURL http://127.0.0.1:3000 and one existing /api/auth/callback redirect, current ECCP256 signing. No provider setting/key/client changed; DCR and authorization-path configured values remain uninspected. [Current29 local issuer proof](oauth-hook29/README.md) passes9stages in rollback only, not a canonical migration or enabled hook.

The consent parser now accepts omitted optional URI/logo metadata from pinned Auth2.197.0 while requiring approved client ID/nonblank name and the same account/scope/redirect checks.13focused tests pass. Initial redirect-only denial remains: provider GETdetails can bind/autoapprove/consume an authorization and does not provide an authoritative client binding on its redirect branch. It must not be used as passive discovery or blindly repeated. [Pinned source](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/api/oauthserver/authorize.go).

Installed Claude Code2.1.301 supports preconfigured client ID/fixed port. Prepare exactly one named public client EveryoneStudioLocalM07, no secret, PKCES256/openid, callback **http://localhost:3118/callback**. The development-only resource is http://127.0.0.1:3000/mcp; issuer/JWKS stay existing centralHTTPS. Keep the SiteURL, sign-in callback and signing key. Exact client registration callback is separate from browser sign-in redirects. Pinned Auth same-origin sign-in matching may allow /api/oauth/callback without another allowlist entry; verify the actual flow before adding any rule, never add a broad wildcard. [Claude client documentation](https://code.claude.com/docs/en/mcp#use-pre-configured-oauth-credentials), [Supabase setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started).

Coordinated issuer30 preflight/proof must precede registration/activation. Use the real generated client ID, remembered resource registry and approved-client list. Private per-invocation MCP configuration plus an isolated credential directory avoids global configuration; --scope local alone still writes home settings. No login/model call/configuration change occurred in this follow-up. Browser action-time confirmation applies before creating delegated access. Hosting and hosted conversational client remain deferred.

## Original implementation and operator notes

Implemented locally on2026-10-30. No live OAuth approval, sign-in mail, provider
configuration, hook enablement, client registration, tunnel or deployment was
performed by this implementation.

## Reviewable application artifacts

`/oauth/consent?authorization_id=UUID` is a dedicated Everyone page using existing
brand tokens/assets. It displays the client name/website from Supabase's verified
authorization response, the verified browser account, `openid`, and the meaning
of current Studio business permissions. Approve/Deny are standard OAuth consent,
not an extra business-operation approval gate. It does not load remote logos or
accept client/redirect metadata from query parameters.

The three narrow browser routes are:

| Route | Purpose |
| --- | --- |
| `POST /api/oauth/authorization` | Details or one explicit approve/deny decision for the supplied authorization selector. |
| `POST /api/oauth/sign-in` | Request one magic link for an existing account only, with `shouldCreateUser:false`. |
| `GET /api/oauth/callback` | Exchange the ordinary Auth PKCE code and return to the validated authorization selector. |

The general `/api/auth` flow remains unchanged. The consent callback accepts only
its UUID selector and bounded code; no arbitrary return path. Request URL logs
are already disabled in `next.config.ts`. No code or raw provider body is logged,
displayed in the consent UI or written to evidence by these routes.

Consent/sign-in requests require exact configured Host/Origin, JSON at most4KiB,
a closed body and UUID request correlation. They explicitly reject Authorization
headers. The authorization route uses `getCentralClient(false)` and
`verifyCentralUser` with the existing HttpOnly browser session; an MCP bearer
cannot substitute for browser consent. Callback state uses the existing Supabase
PKCE/cookie machinery. No browser cookie/token is read outside those normal
server APIs.

The installed Supabase JS2.118.0 OAuth SDK methods handle details, approval and
denial. Both decisions set `skipBrowserRedirect:true`; only their validated
provider redirect is sent to the browser. Redirects require HTTPS or HTTP
loopback, no credentials/fragment/control characters, and decisions are bound to
the provider-verified callback origin/path. Initial redirect-only responses are
refused: the installed provider API omits the client, account, scope and callback
metadata on that branch. They cannot prove this is an approved Studio client.
Automatic resumption of an already-consented request is therefore unsupported
until an authoritative provider binding is available. Fresh consent details
require an approved client ID and exactly the supported `openid` scope.

This page is deliberately a Studio-client consent surface. If the central
project already has unrelated OAuth clients needing a different consent UI,
preserve/route that existing behavior before changing the shared authorization
path. Claim-preserving issuance hooks alone do not prove consent-UI compatibility
for those clients.

An uncertain decision response triggers one safe re-read of the same provider
authorization. A redirect from that read is accepted only against the callback
verified earlier in the same decision request. It never repeats approval or creates a fresh authorization. If
still unknown, the page retains a status-check action and suppresses further
Approve/Deny controls, even when a later read still reports pending consent.

## Configuration work still required

Current observed Auth is v2.197.0; OAuth metadata discovery returned404 in the
root's sanitized receipt. That means metadata is unavailable; the exact provider
flag is not inferred. [Pinned source research](OAUTH_HOOK_RESEARCH.md) separates
Auth implementation facts from unverified hosted gateway behavior.

Before any provider mutation:

1. Read the actual existing OAuth settings, Site URL, allowed sign-in redirects,
   signing algorithm, configured access-token hook and existing clients. Preserve
   unrelated central business applications and their login destinations.
2. Confirm the combined Site URL plus authorization path can reach this consent
   page. Supabase's documented authorization path is `/oauth/consent`. Changing a
   shared Site URL can affect other applications; do not repoint it silently.
3. Prepare the narrow browser Auth return URL
   `{APP_BASE_URL}/api/oauth/callback?authorization_id={UUID}` under the existing
   sign-in redirect allowlist. Check the provider's query matching and use the
   narrowest valid rule, never a site-wide wildcard just for convenience.
4. Prepare an approved OAuth client with its exact registered callback URI and
   PKCE S256. Its callback is distinct from Studio's browser Auth callback. Local
   Claude Code may use a loopback callback; use the actual installed client's
   configured callback/port. Do not invent a client UUID or register broad
   wildcard client redirect URIs. DCR is not advertised by this adapter.
5. Review the resource/client registry, approved-client environment list and
   [local-only issuance-hook candidate](oauth-hook/README.md). The hook must preserve
   ordinary sessions/other clients, support refresh, retain trusted `scope` and
   issue the exact resource audience plus `eps_delegation`.
6. Keep OAuth resource mode disabled until these pieces are compatible. Prepare
   exact restoration/forward-fix steps for settings and hook state before
   activation. Actual provider configuration belongs to the root/operator scope.

Then demonstrate the real browser consent and installed Claude Code flow,
privately verify JWT issuer/audience/client/scope/delegation, ordinary `/user`,
narrow session and business RPCs, refresh and revocation. Keep source-only,
synthetic fixtures and actual provider receipts separate. Hosted conversational
Claude remains deferred with hosting; no public reachability was introduced.

## Local evidence

`tests/server/oauth-consent.test.ts` first failed because the core module did not
exist, then passed9 tests. Cases include closed provider/client/account/scope
projection, approve/deny with suppressed SDK auto-navigation, same-authorization
unknown-outcome recovery, unsafe/mismatched redirects, CSRF and bearer denial,
closed request IDs, existing-account-only sign-in, callback return binding and
private error/code suppression.
The final case runs the actual installed SSR/OAuth SDK using synthetic HttpOnly
cookie storage and controlled Auth responses, verifies its browser user, and
checks the SDK's actual details/consent HTTP requests. It is still a fixture.
An additional failing boundary regression caught array-to-string action
coercion; action now requires an actual enum string before any identity/provider
access. Oversized and malformed-UTF8 JSON are rejected at that same boundary.

Independent review then reproduced an initial redirect-only allowlist bypass.
The correction refuses metadata-free initial reads and decisions while retaining
callback-bound recovery inside the verified decision request. Eleven focused
server cases pass after the new RED regression; the earlier9-case result remains
historical. The current desktop suite also includes refused-reconnect behavior.

Four desktop-only Playwright cases exercise verified metadata/keyboard approval,
uncertain status without reapproval, signed-out return handling and query metadata
rejection against controlled synthetic API responses. Initial run had2 passes
and2 failures because Strict Mode sent duplicate initial details reads. The
abort-aware microtask dispatch fixed that; the separate r2 run passed4/4. Visual
inspection then identified the dark SVG needed the same inversion as the app's
existing brand treatment; r3 passed4/4 with the corrected asset, and the final
desktop screenshot was visually reviewed for readable content, visible brand,
focus and no overflow. Failed/r2 artifacts
remain in their original `.local/m07-oauth-consent-test-results*` directories.
No mobile tests were run. This does not establish real OAuth or assistive-tech
acceptance.
Final root typecheck and focused ESLint both passed after the final boundary
correction. The root integrator owns broader regression/release gates.

Primary documentation checked:
[Supabase OAuth setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started),
[OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows),
[custom token hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook),
[hook security model](https://supabase.com/docs/guides/auth/auth-hooks), plus the
installed SDK source/types for actual method signatures and redirect behavior.
