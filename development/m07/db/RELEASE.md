# Fixed29 release candidate

## Current status - canonical29 applied

Root applied reserved migration29 once to `pyibofyctwnqpvktepse`: [3a0afd9f apply](../../../tracking/evidence/cloud-m07-29/2026-10-30T11-52-15-216806Z-3a0afd9f-apply.json) finished2026-10-30T11:52:15Z. [Independent f553771a readback](../../../tracking/evidence/cloud-m07-29/2026-10-30T11-52-36-310355Z-f553771a-readback.json) finished11:52:36Z and passes exact history/catalogue/data preservation. Local b17a0d67 promotion and f40f96c2 independent inspect preceded it. The sealed `CURRENT_PROFILE_REVIEW.md` bundle and earlier refusal/reconciliation receipts remain unchanged.

[Post29 authenticated startup](../../../tracking/evidence/m06/guest-export-runtime/2026-10-30T11-53-17-871Z-d3a747b7.json) passed all12 exact native-service operations without claiming a job or invoking a provider. [New owned web/worker runtime](../../../tracking/evidence/m07/runtime29-transition/2026-10-30-owned-processes-ready.json) is running (worker60408 to8836; web33724 to62080 to53776). [Actual Settings](../../../tracking/evidence/m07/live-app/2026-10-30-settings-sign-in-pending.json) loaded central-mode but signed out; authenticated values/write proof awaits user sign-in. Settings/session/typed UI and timezone display sources are operational implementations, not facade-only placeholders; their actual new-runtime browser acceptance is still separate. Hook30 passed seven local SQL stages but is neither migrated nor provider-enabled. No OAuth client/issuer/hook enablement, hosting or live delegated journey follows from29. Preserve old history28 harnesses as historical; do not rerun them on29. [Final scoped quality](../../../tracking/evidence/m07/quality/2026-10-30-final-scope.json) passes747modules,80correctly selected desktop cases, typecheck/lint/build/production guard with656source bytes unchanged. Earlier87labels are qualified because seven mixed320px cases ran despite the skip flag; no mobile acceptance is credited. Post29 restore remains a bounded follow-up after the OID boundary fix; no success is pre-credited.

## Historical preparation and release plan - retained

The reserved version is `20261030111549`, generated once in UTC. The draft and
candidate have SHA256 `6531e8decab5496e212eb01575aca666cd9e03b0575f92dd66bd380760f84af4`.
`release29-plan.json` points to the exact draft, source-bound proof and catalogue
delta. The original prepared checkpoint preceded migration/manifest insertion.
The root subsequently froze those exact bytes and established the empty local
Auth prerequisite (`2026-10-30T11-22-09-016Z-3de2c0a5-auth-prerequisite.json`).
The first promotion was refused before dispatch
(`2026-10-30T11-22-37-612Z-1cf50401-promote.json`); at that checkpoint local history remained28, no
promotion claim was created, and the shared lock was released.

Read-only reconciliation and an authorized disposable metadata reconstruction
identify exactly six original-versus-dump/restore differences among16,103 fields:
the original public schema retains a PUBLIC USAGE grant; an explicit owner-only
table ACL becomes its equivalent NULL/default ACL; four immutable configuration
CHECKs have associative AND parentheses flattened during dump parsing. The PUBLIC
grant is a real pre-existing baseline permission and must be preserved. It is not
an ACL-order discrepancy. Raw catalogue artifacts and stable role OIDs are in
`tracking/evidence/m07/local29-reconciliation/2026-10-30T11-26-57-791Z-7f8695f6-report.json`.
The following semantic-proof receipt verifies the exact default owner ACL,
all27 Boolean truth cases and nine string boundaries. No original data, schema,
grant, role, source seal or migration changed during that diagnosis. A separate
bounded current comparison proof subsequently matched all16,103 original fields,
rehearsed the unchanged candidate in a rollback and passed root review. Root then
applied local29 once through the separately pinned current helper. Receipt
`2026-10-30T11-43-29-462Z-b17a0d67-current-promote.json` records one dispatch,
the exact original-profile before/after, unchanged old data/configuration/Auth
counts and lock release. The first refused receipt remains preserved.

`2026-10-30T11-14-22-968Z-fbcf3562.json` under
`tracking/evidence/m07/database29/` proves the exact composed candidate, an initial
pure-DDL rollback, actual compact before/after readback, unchanged established
safe-data/Auth counts/configuration/key metadata, the real-role Settings/session
groups, saved timezone consumption, reduced direct-API capability discovery,
Ready snapshot preservation and actual concurrent revision/replay/revocation
checks. The original owned local28 state and roles were restored after deleting
the disposable clone and its two created roles. Earlier RED, harness failures and
the c6bb Settings/session proof remain historical and unchanged.

The delta adds two private tables, constrained roles/functions/policies and
grants. Exactly29 established catalogue fields change: three exact-source guarded
function bodies, five Auth session column ACLs, ten model/template column ACLs,
seven helper function ACLs, two private idempotency/audit table ACLs and two schema
ACLs. There are zero deletions. Only the narrow own-session SELECT policy is added
to managed Auth. Existing Auth policies, owners, RLS flags, OAuth clients/consents,
users, grants and secret values are not changed.

The local freeze, empty Auth prerequisite and current-profile promotion have
completed. Do not repeat them. The original helper, plan and fbc proof remain
unchanged evidence. Current root inspection uses:

```
node tools/promote-m07-local29-current.mjs inspect
```

The completed `freeze` wrote the already reserved migration bytes and appended the reviewed
manifest without rewriting any old source. `auth-prerequisite` was necessary only
because this project's local Auth fixture has no sessions table. It creates an
empty explicitly synthetic catalogue subset in the fingerprinted owned local
database through its local administrator; no Auth row is seeded. This operation
is separate from migration29 and never runs against canonical Supabase. The
preceding28 data/catalogue/key metadata remained exact. The current helper used
the exact raw original-profile state and applied reviewed29 once, then verified
exact catalogue/data/history preservation. Unknown outcomes retain the shared
lock and require read-only reconciliation. Do not repeat the mutation.

The revised cloud linkage additionally requires the sealed review bundle SHA
`4486d6b5f5ca363511d68790e58f3fcdce9433e1a388b298810a2d3db0b66779`,
every linked source/proof, the full original-profile catalogue rehearsal and
the actual passed current promotion receipt. It uses the original-profile delta;
only the exact pre-existing PUBLIC USAGE pair may differ from the original fbc
delta. Canonical protected metadata remains strict against its own before state.
See `CLOUD_PROFILE_LINKAGE.md`; the sealed earlier review notes remain unchanged.

Source-only preparation and, after root final review, sealing are:

```
.venv-skills/Scripts/python.exe -X utf8 tools/freeze-m07-cloud29-review.py prepare <actual-current-promote-receipt> <actual-auth-prerequisite-receipt>
.venv-skills/Scripts/python.exe -X utf8 tools/freeze-m07-cloud29-review.py <actual-promote-receipt> <actual-auth-prerequisite-receipt>
.venv-skills/Scripts/python.exe -X utf8 -m unittest discover -s tests/operations -p test_m07_29_release.py
```

The prepare action writes only a new timestamped `release29-cloud-review-*.prepared.json`; it leaves
the helper's CONFIG_SHA pending. The freezer verifies those receipts, exact29
source history and all linked source hashes before final sealing can pin
`release29-reviewed.json` in the helper. Both actions perform no CLI or DB calls.
The helper remains fail-closed while that pin is pending. The offline20 tests
exercise restricted arguments/target/flags, catalogue/data drift, quiescence,
exclusive-claim ordering, exact-profile linkage, source/baseline drift, unknown outcomes and independent readback; they do not
prove cloud execution.

The canonical helper fixes target `pyibofyctwnqpvktepse`, uses the established
CLI2.122.0 wrapper, and accepts only `inspect`, `dry-run`, `apply`, `readback`.
It performs no seed/Vault synchronization, force reset, credential export,
identity/OAuth client registration, hook creation or configuration enablement.
`inspect` and `dry-run` are read-only. A passed dry-run must show exactly the one
reserved migration with unchanged before/after state. No cloud command is
authorized by this document itself.

Before a separately authorized apply, the root integrator must verify ownership
and stop its actual web/worker processes, preserving protected process evidence.
The private `.local/cloud-m07-29/quiesced.json` record must contain
`observed_at`, `target`, `migration_sha256`, `owned_processes_verified:true`,
`web_stopped:true`, `worker_stopped:true`, the actual `owned_pids` integer list and
an existing `ownership_evidence` file under `.local/`. The helper independently
checks each PID is absent without stopping processes or inspecting command lines.
The record is valid for15 minutes. The database admission independently requires
zero queued/running jobs and zero leased outbox rows; protected M02 remains
waiting_for_input with its manual note. Runtime identity and all12 native-service
operation grants remain unchanged. Never fabricate that process evidence from a
successful database query.

The apply helper requires the fresh same-source/same-state dry-run, a matching
quiescence record and exact28 canonical history. A protected exclusive claim is
written before one `db push --linked --project-ref pyibofyctwnqpvktepse
--skip-vault`. Raw CLI diagnostics stay private. A timeout or unknown write outcome
never authorizes another push: `readback` independently verifies the original
claim and exact history29/data/catalogue preservation.

The OAuth allowlist starts empty and remote delegation fails closed. Register
and retain a known Studio client identity before issuing tokens; disable its row
instead of deleting that remembered identity. Provider OAuth, consent UI, token
hook, actual audience-bearing issuance, Claude clients, real revocation and
hosting remain separate unverified work. No production or canonical apply is
claimed by local SQL, protocol fixtures or these artifacts.
