# Separate read-only cleanup reconciliation

This new purpose does not repair or replay the frozen lifecycle run. Its live
entry is disabled for root's source review. The original local-logout normal
marker records the required204; the original outer logout remains unknown and
the consumed refresh-denial claim has no normal marker or generation3. Those
historical facts are preserved. The failed provider response was not captured,
so its precise error/status and refresh-token denial remain unconfirmed.

The new helper is fixed to run402aca12, deploymentJ3, product sourcec88 and its
exact manifest. Root supplies a distinct purpose UUID. It reuses frozen
`Coordinator`/`nativePorts` for normal source/context/deployment/preflight and
bounded metadata reads. Its facade exposes only private reads/inspection and
permits one fresh public JWKS GET plus one fixed MCP `get_project` probe.
Token, logout, authorization, consent, listener, claim, normal-marker and
private-generation writes are forbidden. This source author made none of those
calls, and made no actual provider calls for this new helper.

Admission requires all39 frozen source pins, the native normal logout record,
unknown native denial state, unknown outer logout, latest private generation
still refresh/gen2, exact signed initial/refreshed identity continuity and an
unexpired refreshed JWT. A fresh bounded canonical JWKS response verifies its
signature, issuer, exact resource audience, principal, existing public client,
nonempty owned session UUID and existing delegation/scope. No invented current
session row is supplied to the old admission function; independent JOSE
verification permits checking the already-removed session's old bearer.

Two independent current inventories must contain exactly the five original
baseline rows, including every projected client/created_at/not_after value,
with no owned session and no truncation. Existing30-second/1-second freshness
rules apply. Only then is the unchanged gen2 bearer sent once, in RAM, to the
fixed project's MCP `get_project`. Require401 plus Bearer `invalid_token`,
with both request start and finish before the signed expiry. There is no SDK
authentication provider or automatic refresh/retry. A third current inventory
must preserve the same exact five rows; deployment and source pins are checked
again before a pass. A used instance refuses a second execution immediately.

The closed public receipt contains counts, safe signed times/session pseudonym,
fixed public bindings, frozen/new source hashes, inventory observation times
and the denial status. It never contains a raw session/principal, bearer or
refresh token, response body, private headers, public key value or raw errors.
The new entry pins its actual imported coordinator/core and JOSE entry/direct
JWT/local-JWKS modules before and after. This is not a complete transitive
dependency audit. Native readers retain their existing internal CLI policy.

The result scope is only `cleanup_and_bearer_denial_verified`.
`refresh_denial_unconfirmed`, `original_outer_logout_unknown_retained` and
`full_protocol_verified: false` remain explicit. Actual Claude's access is a
separate owner observation. Root may release the product/history freeze only
after reviewing the actual preservation/denial pass; source tests alone cannot
release it. No private/frozen marker is modified by the result receipt.

After root source review, arming only this new file and confirming an adequate
remaining gen2 lifetime, root can run one bounded invocation:

```text
node development/m07/temporary-oauth-lifecycle/reconcile-cleanup.mjs 402aca12-60e1-464e-8573-c48958c3ab1f <new-purpose-UUID>
```

The command writes only a fresh exclusive public result under
`tracking/evidence/m07/temporary-oauth-cleanup-reconciliation/`. An unknown result
is preserved; it grants no replay of logout, refresh or the consumed denial.
There is no durable dispatch claim because root expressly scoped this new
purpose to read-only processing without private claims or marker writes.

Focused synthetic tests use real JOSE signatures and injected read-only ports.
They cover exact five-row preservation, valid reconciliation/privacy, disabled
entry, unknown/changed phase and generation state, source drift, expired/foreign
claims, stale/incomplete/current-row changes, accepted bearer/wrong challenge,
expiry during the request, final source/row drift, forbidden writes and repeat
execution. RED first caught absent preservation refusal (1pass/1fail), then
the complete suite passed. These are local tests, not live reconciliation.

```text
node --test development/m07/temporary-oauth-lifecycle/reconcile-cleanup.test.mjs
node node_modules/eslint/bin/eslint.js development/m07/temporary-oauth-lifecycle/reconcile-cleanup.mjs development/m07/temporary-oauth-lifecycle/reconcile-cleanup.test.mjs --max-warnings 0
```
