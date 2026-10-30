# Hook30: local-only delegated JWT issuance candidate

This directory is a reviewable SQL implementation, isolated proof harness and
synthetic tests. It is not an actual Supabase migration or registered Auth hook.
No provider configuration, client identity, global hook setting or original
database history is changed by these commands.

## Interface and authority

`eps.mcp_custom_access_token_hook(event jsonb) -> jsonb` accepts the native
Supabase Authv2.197.0 event and returns `{"claims": original_or_updated_claims}`.
Its verified input contract is documented in
[the pinned source research](../OAUTH_HOOK_RESEARCH.md). OAuth `client_id` and
`scope` come from `event.claims`, including on refresh; caller/user metadata,
client names, top-level client_id and claimed business capabilities do not grant
authority.

For ordinary browser or unrelated client issuance, the complete claims object is
returned unchanged. For any remembered Studio client, exactly one operator-owned
`eps.mcp_oauth_resources` row must be enabled. Disabled or ambiguous registration,
non-authenticated/anonymous role, invalid/mismatched event user/claim subject,
invalid session, missing required claims or scope without the exact `openid`
token fails closed. The function preserves issuer scope and all existing
required/optional claims. It changes only `aud` and `eps_delegation`; delegation
contains current active atomic grants for the exact event user, in stable order.

The registry and capability schema are reused from immutable candidate29.
Nothing adds clients or enabled resources. The capability list matches the
existing13 business grants; reviewed permission remains independent of casting
approval. A client cannot elevate itself using uploaded text or token metadata.

## Privilege model

The private, non-exposed function runs as `eps_mcp_issuer_owner`, a constrained
NOLOGIN/NOINHERIT/NOSUPERUSER/NOBYPASSRLS role with no role/database creation or
replication. It receives schema usage and SELECT on only three registry columns
and three capability-grant columns. Dedicated role-specific SELECT policies
permit those metadata reads while forced RLS remains enabled. The hook validates
and filters its exact issuer event user in the body. It does not use auth.uid,
the own-session RPC or has_capability recursively: native token issuance has no
acting-user JWT request context yet.

No Auth user/session/table grants are added. Only `supabase_auth_admin` receives
the hook EXECUTE grant; PUBLIC, anon, authenticated, service_role and the ordinary
postgres execution grant are revoked. The owner retains its necessary intrinsic
ownership rights; privileged local administration can explicitly SET ROLE for
DDL. The postgres membership is non-inheriting and cannot grant admin rights.

Ownership transfer requires temporary schema CREATE, following the established
project migration pattern. It exists only inside the candidate transaction,
while the role cannot log in, and is revoked before commit. The persisted owner
has no schema CREATE. Search path is fixed empty and table references are fully
qualified.

## Commands and guard conditions

Coordinate the shared database test window first. The harness acquires
`.local/local-postgres/test-db.lock` with exclusive creation; it never deletes
another process's lock. Existing local target/container identity verification
must pass. Original history must remain28 with the separately established empty
managed Auth session subset and no connected peer/client or candidate roles.

```powershell
node --check development/m07/oauth-hook/run-local30.mjs
node development/m07/oauth-hook/run-local30.mjs --red
node development/m07/oauth-hook/run-local30.mjs
```

The harness creates a new owned disposable database with an exact random name,
OID and hook30 comment, dumps/restores the original28 into it, applies the exact
frozen candidate29 bytes there, then applies/tests candidate30. It does not rerun
the Auth fixture against either database. Candidate30 itself refuses ordinary
database names, missing ownership comment/GUC, wrong history or absent29 objects.
Tests roll back their synthetic data. Before releasing the lock, cleanup verifies
database ownership/OID and no active clients, removes only that database and the
three exact-created candidate role OIDs, then compares the original data hashes,
catalogue, global roles/memberships and OIDs with the baseline.

Any unconfirmed cleanup retains the lock and a private local diagnostic; do not
switch database targets or remove unrelated roles to get a green test. Source
snapshots and immutable receipts retain each attempt, including failures.

## Proof and remaining integration gates

SQL tests use real native Auth/public caller roles and explicitly synthetic
events. They cover initial/refresh scope, full optional claim preservation,
ignored user/top-level authority, current/inactive/empty grants and revocation,
disabled/ambiguous clients, malformed identity/scope/required data, private
EXECUTE and final narrow-role privileges. Synthetic event data is never a real
issuer token or a cloud client identity.

The RED proof reproduced the absent issuance operation and restored the original
baseline. The first GREEN attempt failed during constrained-owner transfer
because the target role lacked temporary schema CREATE; its failure receipt and
source bytes remain preserved. The fix grants CREATE only inside the transaction
and verifies its revocation. Final actual results belong in the immutable
`tracking/evidence/m07/oauth-hook30/` receipts; see the root handoff for the latest
accepted attempt rather than inferring success from this document.

The final [GREEN receipt](../../../tracking/evidence/m07/oauth-hook30/2026-10-30T11-41-25-989Z-ea033081.json)
records7 passing SQL stages, removal of the disposable database and all3 exact
created roles, original28 data/catalogue/role OID equality and lock release.
Candidate SQL SHA256 is
`8c2081c02dfda6a6d081a6a3a4eaf76a59bee56c91a5fb24e91becfe32de19ca`.
The [RED receipt](../../../tracking/evidence/m07/oauth-hook30/2026-10-30T11-38-01-426Z-9deb3ca8.json)
and [initial failed GREEN](../../../tracking/evidence/m07/oauth-hook30/2026-10-30T11-39-01-953Z-b521a147.json)
remain preserved. Independent source security review found no additional
material issue; that review did not execute the provider or establish live
issuance/refresh compatibility.

Future setup is a separate coordinated release: discover and preserve any
existing provider hook, review/promote an additive canonical migration under the
existing release controls, read back exact privileges/source, register a real
approved client/resource and then configure native Auth to call this function.
The prospective native Postgres hook URI is
`pg-functions://postgres/eps/mcp_custom_access_token_hook`; it is not installed in
`supabase/config.toml` and no enabled flag is changed here. Compatibility with
the actual provider configuration UI/API remains to be established.

After activation, actual authorization-code issuance, refresh, private JWT
inspection, `/user`, narrow own-session and business RPCs, client revocation and
old browser/unrelated-client behavior must all be demonstrated. The local SQL
proof does not establish hosted Auth hook invocation, gateway/PostgREST audience
acceptance, real OAuth consent/client acceptance or deployment. No multi-audience
or broad/browser-token fallback is introduced.
