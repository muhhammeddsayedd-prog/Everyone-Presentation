# OAuth selector, authoritative binding and consuming-call coordination

## Current deployed checkpoint - 2026-10-31

Canonical32 applied successfully through `release_v3.py` in
`2026-10-31T11-24-21-659878Z-apply.json`; two independent readbacks passed all16
security checks and preserved the protected M02 status. The complete corrected
wire first passed the actual hosted rollback diagnostic at11:23. Web deployment
`dpl_CpsHsrG38KcRt2qQzci6CMhD7VSu` is Ready and owns the stable pilot alias.
Eight deployed anonymous checks and refreshed signed-in Projects passed.
Fresh owner initial authorization, reconnect and authenticated MCP read remain
pending; server read receipts must be paired with the owner client result.

The actual failed-release response was HTTP400/SQLSTATE42601: the guard generator
joined `::jsonb` and `then` without whitespace, before candidate execution. V3
fixes exactly those two separators. Full native wire tests reproduced the old
failure and executed the corrected transaction. The managed-Auth grant-option
limitation is separately confirmed and addressed by the private metadata bridge;
it was not the observed dispatch failure. Older sources/claims/receipts stay frozen.
Use only the current V3 readback for current state, and never repeat an apply.

The app formerly required a UUID for Supabase's opaque authorization selector.
Auth2.197.0 generates32 lowercase unpadded base32 characters separately from the
record UUID. The screenshot's exact message is the page's pre-provider invalid
selector branch. The browser session is not consulted on that branch.

Pinned source, commit `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`:

- [Selector creation](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/models/oauth_authorization.go#L76).
- [Base32 generator](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/crypto/crypto.go#L159).
- [Consuming details GET](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/api/oauthserver/authorize.go#L183).
- [Approval/denial update fields](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/models/oauth_authorization.go#L141).
- [Comma-separated registered redirect URIs](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/models/oauth_client.go#L118).

Installed auth-js2.118.0 accepts a string selector and returns either full
`OAuthAuthorizationDetails` or `OAuthRedirect`. GET can bind the authenticated
user and autoapprove an already-consented request. A repeat after approval fails
because the request is no longer pending. Repeated GET is not passive discovery.

## RPC contract

The additive CLI-generated migration is
`supabase/migrations/20261031104603_m07_oauth_consent_binding_and_claims.sql`.
Its pinned SHA256 is
`0d7b7a7577ffe1ff4b24eba202ce6ac7e87c616ca8039397800e607c651908a5`.

The initial and V2 controlled dispatches returned unconfirmed; independent
readbacks show canonical history31 and no new objects. A later instrumented
diagnostic captured actual PostgreSQL42601, `missing "THEN" at end of SQL
expression`. Both old controllers concatenated `::jsonb` and `then` into
`::jsonbthen` in their pre/post guards. The candidate had not been reached on that
branch. Execution of the older failed transactions' rollback statements remains
unproven. Separately, canonical privilege metadata and a
faithful local reproduction confirmed a source hazard: postgres can SELECT the
managed OAuth authorization/client tables but cannot grant that SELECT to another
role, so the14 initial column grants would be no-ops if executed under that role.
This is not proof that the cloud dispatch reached that SQL. The original c308
candidate,087 controller, V2 a14 controller/0d7 candidate, discovery sources,
private apply claims and compiled SQL remain frozen; archived source bytes are
in `source-history/`. All invocation claims remain retained without replay.

Current operator is `release_v3.py`, SHA256
`bec36223e8b22217ab5c9e1a2c557ff9aa0bd4dabbeae1361469fdc9079a1c77`.
Its only generated SQL change from V2 is the two missing whitespace separators.
The full generated old wire reproduces42601 locally; the corrected full wire
executes both guards, candidate and coordinated history in the owned disposable
database. See `2026-10-31T11-20-39-713Z-409d1db2-local.json`.

Actual corrected whole-wire cloud proof is
`2026-10-31T11-23-07-040476Z-corrected-wire-v4-rollback-diagnostic.json`:
CLI exit0, metadata returned, history32 inside the transaction, all16 security
checks true, both exact guards passed, followed by explicit ROLLBACK. Two fresh
independent readbacks confirm original31/no new objects/protected status intact.
Managed Auth policy creation succeeded in this actual transaction; the earlier
ownership concern was not an observed failure. No architecture change followed
that concern. Root owns the reviewed V3 apply in its separate claim namespace.

The corrected V2 uses a narrow postgres-owned SECURITY DEFINER binding function,
using only that role's existing SELECT. It retains all explicit session, user,
client/resource, scope, registered callback and expiry checks. Only the NOLOGIN
coordinator owner may execute it; its exact owner, source body, search path,
timezone and two-entry function ACL are checked before commit and on readback.
No managed OAuth-table grant or managed owner-role membership is added.

`public.eps_oauth_consent_claim(p_authorization_id text,p_resource text,p_action text,p_request_id uuid)`
returns exactly `{claim_id,state,binding}`. States are `claimed`,
`consent_ready`, `in_progress`, `already_processed`. Only `claimed` returns a
non-null claim UUID and authorizes one upstream provider call.

Binding contains exactly `authorization_id`, `client` with `id/name/uri/logo_uri`,
`redirect_uri`, `scope`, `user_id`, `status`, `expires_at`. No authorization code,
OAuth state, PKCE value, token or secret is selected or returned. Optional client
URI/logo values are present as null when absent.

The ordinary active browser session must have the matching signed principal and
session, `aud=authenticated`, no OAuth client/delegation claims, and a native
session with no OAuth client and valid `not_after`. The native authorization must
have an enabled client/resource registry binding, exactly `openid`, an exactly
registered callback, and no different user. Exactly one enabled registry resource
is required for that client. Native resource null is legitimate; explicit resource
mismatch is rejected. The app additionally checks its configured client allowlist
and safe callback URL before calling the provider.

Global SHA256(selector) uniqueness and transaction advisory locks coordinate
multiple server instances and browsers. The stored claim binds principal,
ordinary session and immutable native authorization metadata. Only the winner
calls provider GET. After full verified details, `finish(consent_ready)` requires
native pending/current user; later details return authoritative metadata without
another provider GET. Approve and deny share one decision slot, claimed only
after consent_ready. There is no automatic lease takeover or unknown-outcome
retry.

`public.eps_oauth_consent_finish(p_authorization_id text,p_resource text,p_claim_id uuid,p_outcome text)`
uses the same envelope. Outcomes are `consent_ready`, `redirect`, `uncertain`,
`rejected`. Redirect finish requires current native user plus approved status for
details/approve or denied status for deny. The app may return the provider URL
only after this succeeds. The redirect itself is never persisted. Duplicate
requests receive an in-progress/already-processed state rather than a replayed
authorization code.

The new NOLOGIN/NOINHERIT owner has7 column SELECT grants:4sessions and3registry.
It cannot directly read either managed OAuth table, authorization codes,
OAuth state, PKCE, client secrets, refresh material or whole Auth tables. Existing
managed Auth RLS flags, owners and policies are preserved; only two narrow new
SELECT policies are added. Claims have forced RLS and no public table access.

## Evidence and commands

No cloud migration was applied by the author of this draft. Root owns applying
and deploying after review. The existing completed31 operators remain frozen.

- Actual read-only discovery:
  `tracking/evidence/m07/oauth-consent-fix/2026-10-31T10-55-03-058615Z-catalogue.json`.
- Current local proof:
  `tracking/evidence/m07/oauth-consent-fix/2026-10-31T11-04-38-400Z-94828484-local.json`.
  It passes35 SQL assertions, the exact V2 after catalogue and all16 security
  postconditions, and real independent-connection races for duplicate
  details, opposite decisions and different browsers. The identical candidate is
  committed only in a marked disposable synthetic database for races. Its owned
  database/role are removed by exact marker/OID checks; all original global role
  metadata and the original app database are preserved.
- `python -X utf8 -B -m unittest discover -s development/m07/oauth-consent-fix -p test_release_v2.py`
  passes12 controlled tests, including injected column/table ACL, grant-option,
  membership, role-flag, policy-authority and bridge-definition/ACL failures.
- `python -X utf8 -B development/m07/oauth-consent-fix/release_v3.py preflight`
  is read-only. Latest receipt at draft handoff:
  `2026-10-31T11-06-53-154838Z-preflight.json`.
- Root-only reviewed execution:
  `python -X utf8 -B development/m07/oauth-consent-fix/release_v3.py apply`.
  It creates one durable exclusive local apply claim before its sole dispatch.
  Fresh exact metadata31 and protected M02 status must match. The transaction
  applies the pinned migration, appends coordinated history32 and compares the
  exact expected after catalogue/ACL/policy/role/security/status before COMMIT.
  Two independent readbacks follow. No credentials/raw CLI diagnostics persist.
- If dispatch is uncertain, keep the claim and use only
  `python -X utf8 -B development/m07/oauth-consent-fix/release_v3.py readback`.
  It does not dispatch or infer normal transport completion.

V2 uses its own `.local/m07-oauth-consent-release-v2` claim namespace and verifies
the original failed invocation's retained source/claim/SQL hashes and unchanged31
readbacks. The original invocation must never be replayed or its claim cleared.
Read-only managed authority metadata is recorded in
`2026-10-31T10-59-52-027757Z-grant-authority.json`. A separate read-only function
default-ACL query timed out; its specific processes were confirmed absent and a
fresh V2 preflight passed. Default ACL discovery is unverified; the exact bridge
ACL transaction guard remains required.

Historical receipts remain: the first local receipt's hardcoded32 assertion
count actually represented28; later receipts derive the count. A concurrency
runner assertion initially counted postgres memberships twice under different
PG17 grantors; its failure and guarded cleanup correction remain recorded. Later
local proofs pass with distinct-member verification and exact role restoration.

## Forward fix and restoration

Prefer an additive forward fix if a provider response differs. Keep durable
claims when the upstream outcome is unknown; restart authorization from the
client rather than resetting a claim or repeating approval. Initial consent,
reconnect and authenticated owner MCP reads still require real provider proof.

If the new web path must be disabled, restore the previous web deployment and
revoke authenticated EXECUTE on the two new public RPCs through a separately
reviewed migration. Preserve the new claim ledger and migration history. Do not
reset managed Auth tables, revoke existing client grants, change signing keys or
remove old ready presentation snapshots. Existing Auth RLS flags and old policies
were not changed and need no restoration. A later cleanup may remove only these
specifically owned additive objects after dependency inspection; it must not
blindly drop roles, Auth policies or unrelated business records.

Screen-reader/M03 accuracy checks, mobile waiver and other existing acceptance
boundaries remain recorded in the main handoff. These local tests and metadata
receipts do not establish owner Claude authorization or production release.
