# Fixed 93bb local role cleanup — disabled source preparation

This separate sidecar reconciles only the failed local run
93bb8f21-2f2e-4305-948e-f78897c497d1. `APPLY_ENABLED=false` refuses before private
artifacts, local-target verification or SQL. No provider or credential transport
exists. It does not rerun the failed proof, its claim or its controller, and gives
no concurrency acceptance credit. The original failure/observation remain exact.

The exact failed receipt, captured trace-role observation, raw controller, plan,
execution claim, full original Auth/Storage catalogue, source33 catalogue and
retained run/PID lock are SHA256-bound. All 312 failed source seals must match the
plan/claim and raw Git blobs at fc4ad6d. Current pure cleanup helper sources are
separately pinned: the trace helper is the reviewed 444e89c3 OID forward fix.
Its transitive local module closure is verified before dynamic imports. Raw
native OID strings remain unchanged in JSON equality; normalization is only for
strict uint32 validation. The two older roles' creation-time OIDs were not saved.
Their fresh OIDs are bound to their atomic run markers, baseline absence and
recorded source33 grant graph; none are invented as historical observations.

Actual application requires exact Docker Desktop Linux engine/container/image/
volume/network/loopback/local-instance ownership and system7701520506262638626.
The original process32580 must be absent and the permanent test lock must match
its exact run/PID/hash. Only the local container Unix socket is used. Docker/Git
binary hashes, child environment, timeout and output bounds are fixed. DEBUG,
ambient PG/DB/OpenAI/n8n credentials and NODE_OPTIONS are not passed.

The connection uses the existing local supabase_admin login because the original
postgres role lacks catalogue-lock privileges. No grants are added. Exact original
baseline comparisons use SET LOCAL ROLE postgres; the authenticated session stays
supabase_admin, then current role returns to supabase_admin for catalogue locks
and drops. Baseline context is captured in the preflight and must reproduce the
failed run's exact original data/function/grant fingerprint before any claim.
Full catalogue checks normalize only search_path/timezone as the original reader
did; all other metadata remains compared, including Auth/Storage and RLS/ACLs.

All three role drops occur in one transaction. Catalogue locks, exact complete
role-row equality, zero other clients, local database/system/instance identity,
both disposable database names absent and history29 are checked inside it.
Before dropping, globals/catalogue may differ only by these three owned roles
and their exact memberships. Existing roleCleanupSql33 guards and the new strict
trace cleanup guard are composed without their outer BEGIN/COMMIT, retaining
their inner checks. No DROP OWNED, CASCADE, REASSIGN, REVOKE or database deletion
is emitted. After all drops, the full unfiltered original globals, catalogue and
baseline must match before COMMIT.

A separate permanent cleanup claim precedes SQL. A unique marker after COMMIT,
two independent read-only postchecks and unchanged lock/source/target identity
are required before removing only that exact lock. Unknown actions retain the
claim and lock and are never replayed. `readback` uses the saved preflight and
fixed postcheck only; it never drops anything, invents a normal return or releases
the lock. It can record observed restored state for a separate reviewed decision.

The direct reviewed Docker transport permits at most 8MiB SQL and 16MiB combined
output with a 60-second process timeout. This is necessary because the exact
1.4MiB catalogue guards exceed runOwnedLocalSql's existing 512KiB input limit;
that helper and its bound are unchanged. Routine verifyLocalTarget remains a
mandatory check before each SQL call. Raw SQL/error output and baseline payloads
stay in process memory/private task records; public receipts contain hashes and
booleans. No user transcript, media, provider key or auth token is read.

Inert checks: `node --test development/m07/worker38-concurrency-cleanup93bb/cleanup.test.mjs`.
They parse emitted SQL/PLpgSQL and test guards against captured metadata and
synthetic baseline/old-role OIDs. They perform no SQL or provider operation and do
not claim actual cleanup. The ten cases include read-only recovery of all 312
Git source seals and a port-only protocol simulation: permanent claim before
mutation, normal return plus two postchecks before lock release, refusal to replay,
and retention after unknown mutation or failed readback. The fixed CLI still
refuses before IO; simulated ports have no executable transport fallback.
Root must review/arm a coherent checkpoint before a
single `apply`; this authoring task did not arm or execute it.

Root's first armed preflight stopped before the cleanup claim or any drop because
the psql JSON-cell parser already returns the flat catalogue object; the initial
sidecar incorrectly looked for a nested `catalog` field. The exact armed source
and failure are archived separately. The narrow forward fix preserves the raw
catalogue query result and full 16,876-field comparison. A captured
flat-cell regression failed before that fix and passed after it. The gate is
reset false; no failed cleanup claim is replayed, and original roles/lock remain
until Root separately verifies and performs cleanup.
