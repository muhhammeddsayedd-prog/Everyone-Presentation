# Coordinated issuer30 preparation and release

This plan is not an executed release. Current coordinated local/canonical
history29 stays intact. Do not run the frozen history28 harness, replay
migration29, or edit any already sealed issuer/recovery source or old receipt.

## 1. Fresh metadata and exact source artifact

Complete [ADMISSION.md](ADMISSION.md), seal the current target and all source
bytes, and independently review the final bounded delta. Preserve the proven
issuer/grants suffix exactly, or document every deliberate change with new
provenance and focused tests. The review-only exception is not the final
executable admission and must never be removed as a shortcut.

For this imperative migration history, first inspect the installed CLI version
and `supabase migration new --help`. After preparation authorizes generation,
use the installed Supabase CLI to create the timestamped coordinated file:

```powershell
# Future generation only; not run while preparing this package.
supabase migration new m07_native_oauth_issuer
```

The [official CLI reference](https://supabase.com/docs/reference/cli/supabase-migration-new)
documents generation under `supabase/migrations`; do not invent a timestamp or
create a second migration history. No such file is created now. Do not use
`db reset`, seeds, a broad push containing unrelated pending migrations, or
history repair. Retain migration29 bytes/history unchanged. Verify installed
help/version and relevant current upstream changes again at implementation;
the public changelog markdown fetch during package preparation was unavailable
through the documentation tool, so no complete current changelog review is
claimed here.

## 2. New bounded original29 rehearsal

Use a new sealed controller and disposable owned local original29 clone with
the shared lock, exact generated name/marker/owner/OID and actual final absence
checks. Preserve all existing global role OIDs and original29 data/catalogue.
Keep a separate explicit owned-local admission adapter with provenance; do not
weaken the canonical guard to accept arbitrary local targets. Do not edit or
rerun the frozen hook29 harness as if it proved this new release controller.

The already passed `01f780ed` proof provides nine rollback-only SQL stages and
an absent-hook RED. The next artifact still needs these additional proofs:

- Final canonical admission rejects wrong history, target, changed source/owner/
  ACL/RLS, existing role/function/policy and unresolved metadata. Parse and test
  the actual guard predicates; parser success alone is not execution proof.
- Apply the final issuer body with real-role/RLS checks, preserve ordinary and
  unrelated claim values structurally as JSONB, and verify exact trusted
  client/resource/openid/session/principal/current-active-grant gates.
- Inject a failure after DDL but before commit in one transaction; prove role,
  function, grants/policies and all data are absent/restored after ROLLBACK.
  Prove migration-history behavior with the actual selected release mechanism;
  do not assume SQL-body rollback alone covers history bookkeeping.
- Prove the committed path and separately specified forward fix on owned local
  resources. Since roles are cluster-wide, never drop/recreate an existing
  global role to simplify rehearsal. A committed new role needs an isolated
  owned cluster or explicitly proved absent-before/owned-after exact identity
  and dependency cleanup. Unknown ownership stops cleanup and retains evidence.
- Verify exact protected catalogue/data, Settings and MCP-registry state,
  existing Auth/session controls, runtime12 privileges, all preexisting role
  OIDs/memberships, immutable ready versions/media, and actual owned-resource
  absence before releasing only the current lock marker.

Rollback before commit must restore the exact baseline. For a committed release,
prefer a coordinated additive forward fix with issuer registry disabled and
the new Studio issuer hook still inactive. A removal recipe must explicitly account for the
two new policies, new function, column/schema grants, membership and role
dependencies, and revoke schema USAGE only if this release added it. Do not
drop shared roles/schema objects, remove prior grants, delete migration history
or guess at ownership. Write and prove that exact recipe before canonical apply;
this package does not supply an untested executable down migration.

## 3. One coordinated canonical apply and readback

After the final artifact, transaction/history proofs and existing release
authorization are concrete, adapt the established once-only release pattern
(such as `tools/release_m07_29.py`) to the new exact migration and target. Do not
run the fixed29 helper against30. Bind target, seal sources, take protected fresh
before evidence and apply only the reviewed coordinated migration. On unknown
dispatch/commit outcome, perform bounded readback first; never blindly retry.

Independent readback must verify history29 plus exactly the CLI-generated new
version, exact issuer source/owner/ACL/policies and narrow effective privileges,
the expected bounded catalogue delta and exact protected remainder, unchanged
preexisting roles/OIDs/memberships and protected data/config/runtime12/ready
versions/media. Preserve real current Settings edits and current resource state.
At this point this release has not registered or activated the new Studio issuer
hook, and no fabricated client is registered. Preserve any unrelated existing hook.
Keep metadata-plus-media recovery acceptance and migration30 implications
explicit: the completed restore29 proof is historical and does not automatically
prove restore of a committed issuer30 role/function or provider configuration.

## 4. Separate provider/client steps and live acceptance

Root's next action-time consent scope is OAuth-server enablement and one public
PKCE client `EveryoneStudioLocalM07`, exact redirect
`http://localhost:3118/callback`, for Claude 2.1.301. DCR off is desired, not
currently observed. Keep the existing central HTTPS issuer, Site URL, signing
configuration and unrelated clients unchanged. The actual UUID does not exist
yet; no placeholder registry row or broad URI is acceptable.

Observe and record the returned public UUID safely. After verifying actual
protected-resource metadata, register only that UUID with exact local resource
`http://127.0.0.1:3000/mcp` through a separately scoped operator operation.
Discover/preserve any existing hook. Activation is a separate release action
after issuer30/preparation is complete, not implied by client creation.

Then prove real initial code/PKCE issuance and hook invocation, signed JWT
claims/audience/delegation, gateway `/user`, own-session RPC and direct business
RPC authorization, actual refresh/revocation/current-grant changes and real
intended Claude-client use. Prove ordinary browser and unrelated client issuance
still work through the actual provider path. Synthetic events labelled refresh
and pinned Authv2.197.0 source facts remain separate evidence. Do not enable a
broad browser-token fallback, change global audience/signing settings or claim
hosting/endurance/provider-cost acceptance from local results.
