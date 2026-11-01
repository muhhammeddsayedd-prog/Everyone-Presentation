# Attempt36 release-query proof plan

This purpose is source preparation only. It has not prepared a run, acquired a
lock, created a database, executed SQL or called a provider. Its execution flag
will start false. The passed 7cff local proof and its original 185 source seals,
claim, artifacts and receipt remain unchanged.

The finite reuse seam is the frozen `compileAttempt36` and
`createAttempt36Runtime`. A new compiler changes only the runtime import and
invocation, evidence/private purposes, source-guard error label and its own
before-target execution guard. The inherited source read/seal, original29
admission, owned database name/OID/owner/comment fencing, actual30–33 upgrade,
Auth/Storage catalogue, global-role comparisons, cleanup and shared lock stay.

The new runtime passes a wrapped `ctx.sql` into that frozen runtime. It accepts
only the exact body returned by frozen `renderAttempt36Wire`. Inside that one
outer transaction it injects tagged read-only metadata SELECTs, immediately
before candidate36 DDL and after the still-empty trace table is installed.
The exact production history36 row is inserted transactionally before the
shared postcondition, matching production order. The existing actual34/35 setup
and temporary history labels run first.
The direct fixture and real generate/claim/callback/manual-retry fixture then run
unchanged, followed by their existing full rollback to33.

Only the seven exact tagged JSON rows are removed from returned stdout before
the frozen observation checker sees it. The two original fixture markers and
the final rollback observation are preserved byte for byte. Unknown/missing/
duplicate/out-of-order tags fail. No original stdout containing SQL payload is
published. The protected private capture contains metadata and hashes only.

Stable `job-attempt-observability36-release/state.py` supplies both actual SQL
queries and `check_transition(before, after, local=True,
migration_version=state.VERSION)`. That checker runs the exact catalogue-delta and
new-schema gates, preserve every old74 table hash, OAuth state, English config,
protected-job state and the normalized old catalogue. Local metadata compares
the actual empty-clone values; it does not assert production-only CLI role OID,
protected-job presence or English-enabled configuration. History36 exists only
inside the test and rolls back to33. The new report explicitly overrides the
historical hook's candidate36_history_inserted:false field. Cloud admission
remains separately stricter.

The Python query/validation bridge will run only under the reviewed existing
isolated Python binary, with a pinned hash, bounded stdin/stdout, clean env,
fixed arguments and no network or CLI. It will not call release.py. State-query
and all imported source bytes must be finalized, hashed and checked before any
once-only claim. Apply enablement and the later actual-proof admission template
belong to release.py, outside the stable query core.

A new root-owned prepare/execute entrypoint will use a fresh UUID and permanent
exclusive claim. It will not reuse any7cff claim or replay a completed side
effect. A numeric normal child return is distinct from a signal/unknown return;
the controller's actual proof plus full cleanup receipt supplies acceptance.

Pure tests will cover exact185-source/cleanup admission, narrow compiler/wire
seams, exact tagged-output handling, negative metadata gates, immutable claims
and full synthetic hook wiring. A source-only test pass is not PostgreSQL,
provider, n8n or hosted acceptance. Root will review and enable a fresh purpose
before any actual run.
