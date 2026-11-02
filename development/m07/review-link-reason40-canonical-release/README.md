# Disabled canonical SQL40 release purpose

This is new source preparation, with `READ_ENABLED=False`, `APPLY_ENABLED=False`.
No CLI/provider call, canonical
checkpoint, plan, claim, migration or production acceptance has been performed by
this purpose. Root owns review, receipt binding, arming and any later operation.
User MCP parity remains separate acceptance evidence; it is not an additional
authorization or read-only preparation barrier.

The sole migration is `20261102085405_m07_review_link_action_reason.sql`, SHA256
`08bf4de8a63823b0e7c9aee75560a6e7de0620eb9b8b3c483c65929578db8212`.
It adds nullable `eps.audit_events.reason` and replaces exactly four existing
function bodies. OIDs, owners, ACLs, signatures, security attributes, RLS and
existing row bytes remain preserved. No worker/native rebuild is required.

The local functional proof is the actual passed owned PG17 run51a83db4,
`tracking/evidence/m07/review-link-reason40-preparing-proof/2026-11-02T10-22-01.195Z-51a83db4.json`,
SHA256 `d79b1938472a0d943c3c7e993bffeaeff1c51d78a73454e092b16767dbfd4060`.
Its `source_seals[<SQL40 migration path>]` binds08bf. Its inherited top-level
`migration_sha256` identifies bootstrap39 and is retained unchanged. The failed
50f795f1 attempt and its cleanup remain historical evidence. This local proof
does not claim canonical, MCP, UI or new release-collector execution.

## Guard and preservation scope

The source reads the frozen project39 pure projector and existing normal Windows
private-file guard. It never invokes an old operator, provider adapter, claim or
AT069 transport. Exact39 full version history, four old source hashes and their
full `pg_proc` identities, existing canonical schema/permission metadata and
current production native46 configuration are required. Business aggregates may
have advanced since39; the reviewed forward39 closed-kind, nonnegative, sum and
historical monotonic checks remain required. Each current row/hash is captured
and preserved.
All seven lifecycle counters must be zero and all five processing flags enabled.

The new projection qualifies only:

- Four `prosrc` changes, separately requiring their exact proved new hashes.
- Six catalogue fields for the appended nullable text column, a complete new
  `pg_attribute` matching existing nullable `request_id` except name/ordinal,
  and audit `relnatts +1`. Existing audit ACLs remain in their original normalized
  identity projection; the whole table is never omitted.
- Any new dependency of that column must be the ordinary text-type dependency;
  every old global dependency remains exact.
- Exactly one new full migration-history row. Old history rows, all global role
  OIDs/attributes and memberships remain hashed separately. Only the existing
  normal CLI login's renewable expiry is normalized, as in the accepted39 guard.

All76 business/trace/intent table hashes and raw checkpoint rows are compared.
For historical audit rows, only the newly added `reason` key is removed from the
old-column comparison, and every such reason must independently remain null.
All other old row fields, authority rows, immutable Ready versions, sessions,
grants, configuration and metadata remain exact. No target reset or backfill.

## Fresh protected checkpoints

A later authorized `prepare` captures two equal readbacks plus a fresh protected
before checkpoint in `.local/review-link-reason40-canonical-release/<run>/`.
After apply, two new independent readbacks plus a separately captured fresh
after checkpoint must agree exactly. Raw rows stay in RAM or private ACL files.
The existing bounded normal CLI capture allows16MiB stdout,64KiB stderr and60s;
each private serialized artifact is also limited to16MiB. Overflow, truncation,
timeout or any preservation failure refuses acceptance. No partial checkpoint.

Private checkpoint shape is `{schema_version,purpose,target,run,phase,observed_at,
state,application_tables,catalogue}`. `state.history` is the complete ordered
version list; `application_tables` has exactly76 relations. Managed Auth data,
storage object bytes and media are outside this application checkpoint. A
checkpoint is backup evidence, never a restore proof.

The public accepted outcome binds `local_proof:{path,sha256}`,
`before_checkpoint:{path,sha256,history_path:['state','history'],tables:76,
scope:'before_apply',restore_verified:false}` and `checkpoint` with the same shape
and `scope:'after_apply'`. `first.history`, `second.history` and the private after
checkpoint's `state.history` must be identical40 histories. Fresh post40 evidence
cannot be substituted with the historical39/d506 checkpoint. No accepted40
record exists while the source is disabled; the web release registry stays null.

## Future execution protocol, subject to Root review

The only transport is the existing authenticated normal CLI command:
`npx.cmd --yes supabase@2.122.0 db query --linked --project-ref
pyibofyctwnqpvktepse --file <unique protected SQL> --output-format json --workdir
<Main>`. No credential extraction, alternate session or cloud reset. The linked
project file and clean existing reader environment must match. Raw streams and
database errors are never logged.

The entry is `release.py prepare|apply|reconcile <fresh UUID>`. Before a live
prepare, Root reviews source pins and actual owned-local collector validation,
creates protected `query-validation.json` containing only that actual public
receipt's `{path,sha256}`, and arms only the intended live flags. Admission binds
its actual normal/negative/checkpoint results, cleanup and unchanged query source;
an absent proof cannot be replaced with parse-only tests or the older51a proof.
The proof also seals all `release.py` bytes: only the exact single
`READ_ENABLED` and `APPLY_ENABLED` boolean assignment lines are normalized to
false for comparison with the proof's disabled source. Literal flag activation
is allowed; duplicate/malformed assignments or any other orchestration drift
refuse admission. Line endings and all other bytes remain unchanged.
A prepare claim is exclusive and permanent;
an unknown prepare is retained, without automatic retry or a fabricated plan.
Apply requires unchanged pins/admission, the exact fresh preimage/checkpoint and
no prior apply claim. One durable exclusive claim precedes the only dispatch.

The transaction locks history then all76 tables, rechecks the complete preimage,
executes the byte-exact08bf migration, adds its sole history row, and checks the
complete expected postimage before COMMIT. A nonce selected only after COMMIT is
required for a normal-return file bound to the claim. Two independent readbacks
and fresh after-checkpoint/old-row/catalogue comparisons must also pass. A timeout
or lost nonce remains unknown even when applied state is later visible. The
read-only `reconcile` never reapplies, repairs markers or creates a missing after
checkpoint. It reports `observed_applied` when full normal acceptance is absent.

## Local source validation

Run only while this new purpose remains disabled:

```powershell
& '<Main>/.venv-skills/Scripts/python.exe' -X utf8 -B -m unittest discover -s development/m07/review-link-reason40-canonical-release -p test_release.py -v
```

The suite uses synthetic in-memory phase I/O. It checks disabled admission,
actual51a proof source binding, source drift, exact old-row/metadata/role identity
negative cases, unknown dispatch and permanent replay refusal, safe checkpoint
references, and secret omission. Actual generated snapshot/checkpoint/transaction
SQL and assertion PL/pgSQL are parsed, including all76 relation selectors and the
100/52-argument JSON chunks. This is source validation, not execution of these new
collector/transaction queries against a database. A separate owned-local query
validation may be authorized before any canonical operation; none is claimed here.

## Disabled owned-local validation plan

`local-compiler.py`, `local.py` and `local-cases.mjs` define a fresh purpose, with
`EXECUTION_ENABLED=false` before target inspection. Compilation does not run SQL
or Docker. It reuses only the pinned fe4f PG17 bootstrap's owned container/volume,
network-none restore38→functional39, shared-lock protocol, original29 readbacks
and exact owned cleanup. It never replays an earlier compiler main or claim.

The exact previously reviewed three synthetic busy rows are qualified using
their COPY fingerprints: one job and leased outbox become terminal, and the
existing normal job trigger changes the linked rendering version's four control
fields. No direct version DML, trigger suppression or immutable Ready rewrite.
Only those three old row hashes and five declared local configuration setup
tables are excluded from the outer clone preservation check. Every other old
row, source backup and original guarded cluster remains exact. Before the new
baseline, the five local singleton configs are enabled and frame native46 is set.

The actual new collector and checkpoint SQL bytes are unchanged. The local
Python subclass qualifies the owned database/system/run and the verified
synthetic restore's absent canonical CLI-role and protected-M02 identities in a
validation copy only. It retains the full actual row/hash/OID values in every SQL
preimage and readback, binds a fresh verified synthetic static anchor, and never
creates production protected data or role OIDs. This proves collector/transaction
execution and preservation, not canonical protected-cohort admission.

The actual `Context.render` is used. Only its migration database admission is
changed from canonical postgres to the owned project39 database plus exact system
and run; an inverse byte comparison proves the four function changes and all
other SQL guards remain intact. A deliberately wrong captured preimage must
actually refuse and roll back before migration. Then one correct rendered
transaction must return its COMMIT nonce; two independent before/after collectors
and full76-table checkpoints must agree, and actual old-row/catalogue/role/
membership/function/dependency preservation must pass. Raw checkpoint rows stay
in RAM; only safe validation summaries are public. The new bootstrap retains a
fresh permanent claim and exact cleanup on failure; it has no automatic replay.

Root must review the final source/disabled local plan before separately arming
only the new local flag and authorizing one fresh UUID run. No such local run is
claimed by this source preparation. Canonical READ/APPLY stay false independently.
