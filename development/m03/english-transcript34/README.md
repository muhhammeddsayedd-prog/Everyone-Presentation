# English transcript projection34

This is additive source preparation against the exact discovered canonical33
functions. No database, OpenAI, worker, browser or hosting operation is performed
by these files. Canonical33 and the accepted OAuth/MCP connection remain intact.

Migration34 adds an optional NULL/`1.0` candidate processing flag. NULL omits the
frozen job key, preserving v1 hashes and payload shape. Missing or explicit JSON
null frozen flags retain legacy v1. A flagged job uses v2 and
stores its English projection separately from the unmodified original transcript.
English unavailability is explicit and never copies original text into display.
The worker additionally checks the output script; database structural validation
is not independent evidence of translation accuracy.

Full original UTF-8 SHA, source asset, frozen job hash, configured extraction model,
task, SDK and prompt/schema identities are validated. At most64 actual provider
metadata records survive. Each record retains actual successful chunk correlation
and usage, including a successful chunk that exceeds the aggregate output limit.
SQL checks each chunk digest's SHA shape; it does **not** independently recompute
JavaScript whitespace segmentation/JSON envelope digests. There is no invented
aggregate request or response identifier.

The200000-character limit applies to normalized display text, not a new raw-source
restriction. English failure retains the full source hash and existing facts;
the unchanged transcribe/apply validators keep their existing source limits.
The helper-only200001-character unavailable test does not claim that the existing
transcribe stage would accept that source length.

Future generated versions use a new immutable English companion alongside their
existing raw companion. Capture matches current media row revision and full raw
hash inside the existing acting-user/version scope. Reads use only the fixed
version/video pin and frozen companion; old versions report `not_captured` with
no live-library fallback. No historical raw companion, snapshot, manifest, PDF
content, Ready version or original asset is rewritten or backfilled. The existing
whole-row version trigger also freezes the newly added cohort field.

`build_ports.py` reads a SHA-pinned **private** canonical33 function archive and
compiles15 once-only literal changes across8 functions. Each SQL port checks the
exact original body/owner/ACL/definer/config and checks every non-body `pg_proc`
attribute after replacement. `port-patches.json` contains safe source hashes only.
No private canonical body is copied to this helper folder.

Offline commands:

```powershell
python -X utf8 -B development/m03/english-transcript34/build_ports.py
.venv-skills/Scripts/python.exe -X utf8 -B -m unittest discover -s development/m03/english-transcript34 -p test_source.py
```

The11 source tests check compiler parity, source bindings, authority preservation,
legacy boundaries, immutable read paths and parse exact SQL, including every
fully reconstructed patched body. The offline PL/pgSQL grammar check uses record
stand-ins for catalogue-dependent composite declarations: field/type/permission
resolution still requires the isolated database gate. Tests require the retained private archive and
the existing `pglast` environment. Passing them does not execute the SQL tests.

## Pending isolated SQL proof

Do not run while the shared local recovery lock is retained. The coordinating
runner must verify an owned disposable canonical33 clone, its exact database OID,
marker, history, all role/catalogue preimages, no unexpected sessions and retained
lock. It must provision the existing synthetic ordinary-session fixture required
by33, without relaxing managed Auth policies or copying any actual user session.
It must preserve the original local29 and protect the historical M02 job.

Within one parent-owned transaction, with `eps.english34_test_run` and
`eps.english34_test_oid` set from the independently verified clone identity:

1. `test-target.sql` (refuses original/shared/cloud databases).
2. Existing synthetic M04/M05 setup and behavior fragments, with synthetic
   external audience as in the previous transcript28 harness, then
   `tests/db/m06-transcript28-legacy.sql` to create a genuine pre34 version through
   the Generate RPC. Use existing session/role fixtures needed by current33.
3. `before34.sql`, migration34, `validation-tests.sql`, `capture-tests.sql`.
4. ROLLBACK, then verify original/clone catalogue and role preimages, cleanup and
   lock state. No replay/cleanup may be inferred from process exit alone.

Validator tests cover valid available/unavailable/missing paths, legacy v1,
invalid feature flags, raw/job/asset changes, metadata/model/prompt tampering,
unknown private fields, bounds and grants. Capture tests cover old row hashes,
cached old acknowledgement without backfill, new capture/replay, English and raw
SHA binding, immutable updates/deletes/cohort, later-library changes and wrong
video scope. Synthetic Ready metadata is injected by the old fixture: these tests
make no claim about native PDF bytes or real provider/workflow execution.

## Owned controller preparation

`controller.mjs` derives a new metadata-mode33 controller from the frozen29
controller and the pure recovery33 compiler. It preserves actual30–33 migration
execution and the existing name/marker/OID, original29, global role and shared
lock checks. The new hook replaces the metadata-restore task with the exact34
synthetic transaction above, adapting only its admission to the already owned
`eps_m07_r33_source_<run>` clone. It asserts the full source33 catalogue, data and
history are identical after rollback. It does not insert a34 history label.

Six pure Node tests cover source closure, migration suffix parity, actual rendered
wire, ordinary-session-before-Generate ordering, rollback and execution prerequisites.
The Python parser suite also checks the actual rendered owned wire. Commands:

```powershell
node --test development/m03/english-transcript34/controller.test.mjs
node development/m03/english-transcript34/run.mjs prepare
```

Preparation contacts no database. Root verified actual533 cleanup at15:01:22 UTC
and authorized this new runner after independent review of the direct-DROP
forward fix. `EXECUTION_ENABLED` is now true. The29 dependency pins include the
immutable successful cleanup receipt; execution also requires its exact
baseline/catalogue/global-role/DB-absence/postcheck/unlock assertions. Previous
closed preparations37c86f65 and9741f5e8 are historical and must never be replayed.
Old dependency pins remain in SHA-named source history.

Root alone dispatches a new prepared run exactly once after checking fresh target
admission and source closure. The parent still verifies original29, exact owned
clone OID/marker, role identities, no unexpected clients, all catalogue preimages,
rollback, cleanup and the shared lock. This runner inserts no34 history label.
The current corrected source still requires its own actual SQL proof.

Root's first owned run `ae5b4f86` actually migrated30–33 and reached the34
validator fixture, then refused an untyped `to_jsonb(anyelement)` literal in its
adversarial VALUES loop. Its receipt confirms both disposable databases and new
roles were removed, original29/catalogue/global roles were unchanged and the lock
was released. That failed run remains failed and cannot be replayed. The forward
fixture adds `::text` to that one literal. A new offline regression failed on the
retained old bytes and passes on the corrected fixture; it checks every active
owned SQL fixture for direct untyped JSON polymorphic literal arguments.

Actual SQL execution, initial activation, hosted source/worker coherence, real
English processing and app/guest checks remain pending. Existing M03 accuracy,
screen-reader and broader acceptance boundaries retain their recorded status;
mobile remains skipped.
