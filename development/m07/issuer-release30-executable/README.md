# Executable issuer30 release work

This new subtree implements the app-side issuer release after exact history29.
It preserves the frozen inert issuer30 package, historical hook29 proofs and all
old releases. It never configures/logs in Claude Code or edits client credential
files. Root owns canonical apply, provider configuration and central tracking.

**Canonical30 is applied and independently verified; the original owned local
baseline remains29.** Root completed the fixed
[inspect](../../../tracking/evidence/m07/issuer-release30-executable/2026-10-30T16-10-37-741009Z-33ba02bf-canonical-inspect.json),
[dry-run](../../../tracking/evidence/m07/issuer-release30-executable/2026-10-30T16-11-28-884556Z-4a6dbe09-canonical-dry-run.json),
[single apply](../../../tracking/evidence/m07/issuer-release30-executable/2026-10-30T16-12-49-727075Z-34f06b25-canonical-apply.json)
and [independent readback](../../../tracking/evidence/m07/issuer-release30-executable/2026-10-30T16-13-26-090472Z-12920568-canonical-readback.json).
The apply finished at16:12:49 UTC and readback at16:13:26 UTC on2026-10-30.
Both verify exactly42 created/8 changed raw catalogue fields, with the protected
remainder/data/Settings/runtime12/M02 instruction and old role identities
preserved; canonical catalogue count is now16655. The sole separately recorded
managed-auth lifecycle change is the CLI login role's short expiry extension.

The later [binding inspection](../../../tracking/evidence/m07/app-oauth/2026-10-30T16-14-01-872234Z-inspect-binding.json)
confirms history30, the private issuer function and its narrow effective
permissions, both forced-RLS lookup tables, Settings row_version3 and no
registered resource/client pair. Provider activation has not occurred at this
checkpoint; root's required action-time confirmation remains pending. Database
function existence does not establish provider hook registration or invocation.
See the [current metadata summary](../../../tracking/evidence/m07/issuer-release30-executable/2026-10-30-current-release-summary.json)
for exact receipt hashes and environment distinctions.

The earlier canonical read-only receipt
[`b19aca5b`](../../../tracking/evidence/m07/issuer-release30-executable/2026-10-30T15-31-12-986032Z-b19aca5b-canonical-discovery.json)
records 16613 catalogue fields, 61 safe role identities and 102 membership edges;
exact history29 and all 356 historical selected pins matched. At that preflight,
issuer role/function/policies were absent. Settings was Africa/Cairo/template1.1.0/
row_version3, the registry was empty, runtime had12 operations, no jobs/outbox leases
were active, and the protected M02 instruction remained present. Auth admin had no prior
executable EPS/PUBLIC routines and EPS USAGE/CREATE were false. No canonical data
or provider configuration was mutated by discovery.

The pinned CLI2.122.0 created
`supabase/migrations/20261030154824_m07_native_oauth_issuer.sql` locally. Its bytes
equal `candidate.sql`, SHA256
`e5fd2121784c8372743f330664508b2a38a25cd622b24cf6765c570ae6f2a785`.
Root applied these exact bytes once to canonical history30. `release-plan.json`
binds the exact new version/path/hash. `candidate-provenance.json` preserves its earlier preparation
checkpoint before that CLI file existed; it is not a current release-status record.
The4735-byte issuer/grants suffix is unchanged from proven
136de/8c208, SHA256
`6fdab1bd84db93d427780f86ff5d8797a4fc67580796f379df4876f7bb269018`.

Admission compares the full raw catalogue, current protected data fingerprints,
ordered history, mutable Settings, empty registry, quiescence, all existing role
OIDs and prior Auth-admin effective app privileges. It does not normalize unknown
metadata differences. The CLI-managed login role's short credential expiry is
captured separately and is not asserted as a stable app invariant. External
release targeting must still bind the exact existing central project; a database
called postgres alone is insufficient.

`run-local.mjs` is a new controller, not an invocation of an old history28/29
harness. It verifies original29, takes the shared local test lock, then creates
one UUID-named/OID/comment/owner-verified disposable database from a read-only
seven-schema pg_dump into template0. The unchanged exact eight-pair restore
planner restores only its previously proven representations inside that owned
database; every unknown pair is refused. `profile-adapter.mjs` replaces only
that planner's ownership predicate with the new exact name/marker/owner/OID
predicate. Full16430-field app/Storage/Auth-session catalogue and safe data must
match source after correction. Clone effective-privilege comparisons cover the
seven restored schemas; the original's complete all-schema privilege snapshot
must still remain exact after cleanup. Its local admission is an explicit
separate prefix using the local before-state and owned identity; issuer/grants
bytes stay exact. Two injected failures test DDL and migration-history rollback;
nine real-role/RLS stages run before and after a committed candidate, with all
synthetic event rows rolled back. A forward fix restores the DB permission/
function surface while retaining committed migration history. The remaining
new NOLOGIN role is removed only after verified owned DB removal, then exact
marker/OID/attributes/captured memberships/no-dependencies/no-clients checks
under catalogue locks. Every preexisting role/OID/membership and the complete
original29 snapshot must match before releasing only this run's lock.

**Actual local proof passed:**
[`36b1483b`](../../../tracking/evidence/m07/issuer-release30-executable/2026-10-30T15-54-37-082Z-36b1483b-local-proof.json),
57512ms test duration. Both injected DDL/history failures rolled back exactly;
nine real-role/RLS stages passed before commit and nine after committed30.
The forward fix restored the exact DB surface while retaining history30; only
the new global role and its owned edges remained until DB-first cleanup.
The exact owned DB and new role are absent, the complete original29 data/
Settings/catalogue and all preexisting role OIDs/attributes/memberships match,
and the shared lock is released. Six SELECT columns only were effective across
EPS/PUBLIC/Auth; no Auth table/column grant or public/anon/authenticated/service
hook EXEC was permitted. The native-Auth role has EXEC; function owner is the
narrow issuer role, empty search path and source hash
`b6e422c7df5cb146e9d0c0aaaad6dfa7fc5373a36179d82284438cf599fd218c`.

The initial
[`8a0ca519`](../../../tracking/evidence/m07/issuer-release30-executable/2026-10-30T15-50-11-884Z-8a0ca519-local-proof.json)
attempt refused TEMPLATE cloning before creating anything because the source
contained pg_cron and pg_net background workers. Read-only diagnosis identified
them; neither was stopped or reconfigured. Exact first controller701f bytes are
preserved under `source-history/`, along with its failure/confirmed-cleanup
receipt. The separately reviewed dump/profile correction then passed.

Source review and closed-plan checks precede execution. Any uncertain identity/commit/cleanup
retains protected diagnostics and the lock; there is no automatic write retry.
Private diagnostics and local SQL artifacts remain under owner/SYSTEM-only
ignored `.local/m07-issuer30-local/`. Public receipts contain safe metadata and
fingerprints, not Auth bodies, credential values or token/media payloads.

```powershell
.venv-skills/Scripts/python.exe -X utf8 -m unittest discover -s development/m07/issuer-release30-executable -p 'test_*.py'
node --test development/m07/issuer-release30-executable/admission.test.mjs development/m07/issuer-release30-executable/cleanup.test.mjs development/m07/issuer-release30-executable/profile-adapter.test.mjs
```

The pure suite currently passes28 Python and9 JavaScript checks, including
independently authored release guards and failed-before-implementation cases.
The original owned local database was not promoted: it remains at29, with the
issuer role/function absent there. Only its disposable clone committed30 for
the proof, retained30 through forward-fix, and was then removed. That local
cleanup does not remove the now-persistent canonical issuer role/function.
The actual local SQL proof remains distinct from signed JWT issuance, real
refresh/revocation or a user's Claude Code connection.

## Root-owned canonical controller

`release.py` accepts only `inspect`, `dry-run`, `apply`, or `readback`. It binds
the fixed central target and pinned CLI2.122.0; verifies exact original29 plus
only the pending CLI-created30 file, source seals and successful native proof;
and compares the entire canonical catalogue/protected current data/Settings/
history/old roles and effective privileges. `expected-delta.json` records exactly
42 created and8 changed raw catalogue fields with no deleted fields. Every
canonical before-value for those8 changes matches the proven local value;
there is no generic ACL sorting, catalogue normalization or inferred extra delta.

Root supplied `quiescence.json` using `quiescence.schema.json`: exact8 fields,
fresh aware UTC timestamp, fixed target, verified ownership/stop booleans, unique
owned PIDs and an existing private ownership-receipt path. The controller checks
actual PID absence without reading commands or environments. Apply requires a
fresh same-source successful dry-run, writes a protected exclusive permanent
dispatch claim before one push, and independently checks the result. Unknown
dispatch/commit outcomes use readback only. Raw errors stay protected at file
creation; unexpected payload fields never enter public tracking receipts.

All preexisting role identities/memberships and other safe attributes are preserved.
The only separately
qualified managed-auth lifecycle field is `cli_login_postgres.valid_until`: an
observed monotonic temporary-login expiry within10minutes of observation may be
recorded, with both raw values retained. It is never rewritten or hidden as
catalogue normalization. Any other role/identity/privilege drift fails.

Root stopped the five freshly verified owned development processes for release,
then restarted the worker/web after independent readback. The
[16:15:51 UTC runtime receipt](../../../tracking/evidence/m07/app-oauth/2026-10-30-runtime-after30.json)
records worker44164→17764 and web44336→58208→59556, two auxiliary consoles and
127.0.0.1:3000 owned by59556. This is dated ownership/listener evidence; verify
freshly before any later process action. It does not claim a pristine console.

This subagent's follow-up is metadata-only; root executed the canonical release.
Provider/client configuration and activation remain root's separate next phase.
Do not repeat the push or frozen before29 inspect/dry-run guards. Once a client
is intentionally bound, use the dedicated binding/readiness inspections rather
than rerunning this release's empty-registry readback frame. Preserve the
permanent dispatch claim and all prior receipts.

A hook creation toast is not an effective-ACL receipt. Generic
dashboard hook deletion/replacement may restore PUBLIC/anon/authenticated EXEC
in current upstream Studio source; use a reviewed coordinated ACL restoration/
forward fix and fresh readback rather than assuming generic deletion is safe.
The completed restore29 proof does not establish issuer30/provider-config restore.
