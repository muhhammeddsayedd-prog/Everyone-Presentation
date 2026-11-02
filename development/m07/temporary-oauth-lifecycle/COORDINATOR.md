# Disabled live coordinator

`coordinator.mjs` now wires the complete operator-session proof. It is a new
purpose built on the frozen primitives; it supersedes the earlier README's
statement that coordinator wiring was pending. No old helper file was edited.
All new live flags remain false. No provider/auth/MCP request or listener was
started during preparation. Worker pause/resume remains fenced by Root.

## Exact admission

The future private `coordinator-inputs.json` is created exclusively under
`Main/.local/temporary-oauth-lifecycle/<new UUID>/` with the reviewed Win32
current-owner/SYSTEM ACL. It contains only the run UUID, exact approved helper
source pins, and a SHA-pinned **successful new production web Ready receipt**.
`coordinator-inputs.template.json` is a shape reference, not a usable input.

The bridge independently derives the owner Auth UUID from the SHA-pinned
accepted owner/Claude request receipt. It never prints that UUID publicly or
reads an existing token/session credential. It verifies the new web Ready
receipt, protected web plan/build/inputs, normal build receipt, exact source
manifest and deployed metadata. It takes only the existing `sb_publishable_`
key from the admitted public build environment and compares it with the
protected build plan. No service/admin key or environment credential extraction
is accepted. The deployed source's three MCP auth/route blobs must match Main.

Every phase rechecks exact helper/dependency/product source pins and the same
private context. The actual stable alias and exact deployment are independently
read through the normal Vercel65.8 CLI; both must equal the admitted Ready
deployment. No consumed web deployment/configuration claim is replayed.

Fresh read-only Supabase2.122 queries, through the existing bounded normal CLI
reader and new protected SQL files, verify current history39, the exact public
client with `none` auth, registered callback3118, code/refresh grants, one enabled
exact resource, existing nonanonymous owner, current projects.read grant and
active project membership. Only booleans and the already fixed client UUID are
returned for registration/owner checks. Complete session metadata is private.
The old metadata reader's pure SQL builder and bounded transport are reused;
its old disabled entry/claim is never executed.

Public metadata/JWKS reads use exact fixed URLs, bounded bodies/time, no cookies
or redirects. The protected resource must advertise the exact issuer/resource
and openid scope. Token/code grants use official MCP client2.4 PKCE primitives;
there is no registration, credential cache, auto-refresh or reconnect provider.

## Commands after a separately reviewed arming and Root resume

The following are documentation, not commands run by this preparation:

```text
node development/m07/temporary-oauth-lifecycle/coordinator.mjs seal
node development/m07/temporary-oauth-lifecycle/coordinator.mjs prepare <new-run-uuid>
node development/m07/temporary-oauth-lifecycle/coordinator.mjs authorize <same-run-uuid>
node development/m07/temporary-oauth-lifecycle/coordinator.mjs expiry <same-run-uuid>
node development/m07/temporary-oauth-lifecycle/coordinator.mjs refresh <same-run-uuid>
node development/m07/temporary-oauth-lifecycle/coordinator.mjs logout <same-run-uuid>
node development/m07/temporary-oauth-lifecycle/coordinator.mjs reconcile <same-run-uuid>
node development/m07/temporary-oauth-lifecycle/coordinator.mjs cleanup <same-run-uuid>
```

Only `seal` is source-only and callable while disabled. Other public CLI paths
refuse before private/provider access. Arming later requires only the **new**
flags in `coordinator.mjs`, `coordinator_bridge.py` and
`coordinator_callback.mjs`; the frozen old callback/metadata flags stay false.
Root must approve the armed source pins before private inputs are created.
Live commands require the normal clean child environment: debug/Node injection,
TLS overrides and credential-routing environment overrides are refused before
private access. The code-only `seal` tolerates a shell diagnostic DEBUG setting;
its Python child still receives only the explicit safe environment whitelist.

`prepare` permanently claims the new purpose, verifies admission and saves
immutable discovery/JWKS/original session inventory. `authorize` additionally
requires the exclusive protected `coordinator-ready.json` with exact run,
`owner_ready:true` and private context SHA256. Root creates it only when the
owner is ready. The owner controls sign-in and consent in the browser; nothing
automates approval. The normal bridge context must be captured in RAM when
computing this binding, never forwarded to chat. Python `canonical(context)`
and the Node coordinator use the same sorted ASCII JSON binding.

The callback adapter is a new coordinator-owned copy of the reviewed bounded
loopback source. It binds only localhost3118's IPv4/IPv6 loopback listeners,
fails on conflicts, and closes only its own resources. Readiness prints only
`http://localhost:3118/start`; the authorization URL/code/verifier are private.
The single callback consumes its state before a permanent exchange claim.

Returned tokens are persisted/fsynced in immutable protected generations before
normal markers. Signature-verified issuer/resource/client/principal/delegation
and a current session UUID **absent from the original baseline** are required.
A reused same-client session cannot become owned or be logged out. One actual
official SDK fixed get_project read supplies a safe request ID. MCP uses the
app's supported2025-11-25 legacy handshake explicitly, with at most one each of
initialize/initialized/get_project; no protocol probe/fallback or auth retry.
No project payload is persisted or returned publicly.

`expiry` returns the signed natural deadline without a phase claim while it is
too early. After the deadline it verifies the unchanged expired signed bearer
and requires a genuine401 invalid_token response. `refresh` dispatches one
claimed public refresh, observes the bounded raw token response before SDK
fallback, saves the returned generation first, verifies exact same owned
session/later signed times and actual replacement, then makes the successful
fixed MCP read. No real JWT claim or global clock is edited.

`logout` requires that completed refresh proof and a current unexpired owned
bearer. It checks all original unrelated session projections before dispatch,
uses only exact scope=local, then requires two equal independent absence/metadata
readbacks, rejected last-owned refresh, immediate rejection of the unchanged
formerly valid bearer, and a final preservation readback. Original and newly
observed unrelated id/client/created/not-after fields must remain exact. Extra
independently created sessions are permitted. Any lost or altered row makes the
proof unconfirmed; no repair or broader revoke is attempted.

The successful result is `protocol_passed` for this operator SDK session only.
The actual Claude renewal observer and a genuine owner read proving its access
after cleanup remain separate required evidence. The coordinator cannot read
Claude credentials and does not claim that observation.

## Unknown outcomes and cleanup

Outer phase claims and native code/refresh/logout/denial claims are permanent.
A consumed phase refuses replay, including after a response/persistence failure.
An SDK return without a completed business proof is not relabeled acceptance.
`reconcile` performs only new read-only provider metadata queries and local claim
inspection. It never opens a listener, calls MCP, exchanges/refreshes a token,
logs out, or creates a missing normal marker. Source drift fails admission.

`cleanup` is a separate one-time bounded phase for a persisted, signature-verified
current new owned token, including a token saved before a failed return. It
checks the same original baseline, refuses any consumed logout claim, and can
only local-signout that exact owned session, with independent absence and
preservation readbacks. It does not repair the failed phase or establish
protocol acceptance. An expired/lost/unparseable last token, reused session,
source drift or unknown prior logout leaves cleanup unconfirmed; there is no
global/client-wide/admin fallback or old-refresh retry.

Public receipts are closed projections under
`tracking/evidence/m07/temporary-oauth-lifecycle-coordinator/`. Private context,
principal/session UUIDs, public-key value, authorization URLs, codes/verifiers,
tokens, raw provider responses and CLI diagnostics never enter public output.
Python bridge stdout is a **private captured channel** and must not be forwarded
by an operator tool. No unrelated files, sessions, clients or grants are deleted.

## Focused offline evidence

The coordinator tests use real SDK/JOSE and in-memory fake provider/durable ports.
They cover the entire sequence, source drift before reads, unknown grant/write
outcomes, permanent replay refusal/read-only reconciliation, secret omission,
reused same-client preservation and narrow cleanup. Bridge tests parse the
actual fixed read-only SQL, reject disabled provider entries, check private web
source/build/public-key admission, and retain every frozen helper source byte.
No old full app suite or SQL/Docker proof needs rerunning for this isolated
coordinator. These are offline checks, not live auth acceptance.
