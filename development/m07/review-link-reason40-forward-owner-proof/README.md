# Disabled owned fixture actor correction

This is a new default-off candidate for Root review. Failed80be, its armed
source3658/6d81, private controller, permanent claim and receipt stay unchanged.
No new controller main, SQL, Docker, provider or canonical phase has run.

The observed first error was `permission denied to set role
"supabase_storage_admin"`, native psql exit3. SQLSTATE was not retained in terse
stderr;42501 is an inferred insufficient-privilege mapping, not a captured value.
The failure happened before the0062 prerequisite,0074 or ledger insertion.

The sealed bootstrap connects only to the owned container as supabase_admin.
The callback deliberately changed SESSION AUTHORIZATION to non-super postgres
before the fixture; that actor cannot enter StorageAdmin. There is no new grant,
membership, role attribute, owner-copy or production privilege change here.

The entire semantic correction is two exact fixture SQL insertions:

1. After the existing owned database/system/run/history guard, RESET SESSION
   AUTHORIZATION to the connection's original supabase_admin. Require exact
   session/current user and its existing super flag, then use the existing
   StorageAdmin role for the same managed schema fixture.
2. The existing RESET ROLE returns to the original owned administrator for the
   one synthetic coordination row. Before the fixture result and inherited
   collector, restore SESSION AUTHORIZATION postgres and assert both actor IDs.

The correction is source-hash bounded to old fixture7031a11d and inverse-checked.
All other fixture bytes, exact0062 column/historical darkcheck/unmodified0074,
ledger increment, old-bucket-column preservation, unknown ACL/value probes,
diagnostic0, correct guarded COMMIT/readbacks/full76 and cleanup are unchanged.
No existing Storage/Auth schema/privilege field is ignored.

There is no added runtime wrapper layer: cases.mjs is the parallel source version
at the same layer, byte-equal to the consumed callback except default-off flag.
The compiler projects the corrected fixture data and a fresh namespace from the
sealed previous compiler; generated private case-library bytes are identical.
The old bridge, guard, transport, render and bootstrap/cleanup code are reused.

The new namespace uses Source/.local/reason40-forward-owner-source/ and
Source/.local/reason40-forward-owner-validation/<fresh UUID>/, eps-r40u- resource
prefix and eps.reason40forwardowner.* labels. The same protected Main diagnostic
directory uses a new runtime UUID. No old claim or controller is reused. Shared
lock ownership, original29 data/catalogue/global roles and exact owned absence
remain mandatory even on failure. Canonical source/consumed flags stay frozen.

Five focused source tests pass. The real parsed old fixture produces the actor
regression RED; the corrected parsed sequence passes. Missing admin assertion,
role reset or actor return refuses, as does any extra input-source edit. All
SQL/PLpgSQL and generated Node parse, four collector/config/qualification SQL
strings plus private case bytes remain identical, and the new entry refuses
before target inspection. These are source checks; a later owned run is needed
to prove actual role transitions, fixture and transaction outcome.

Run pure checks from the unarmed Runtime checkout via Mainvenv, preserving the
Main armed-source provenance refusal documented in2b1023:

```powershell
& '<Main>/.venv-skills/Scripts/python.exe' -X utf8 -B -m unittest discover -s development/m07/review-link-reason40-forward-owner-proof -p test_correction.py -v
```

Root reviews the concrete candidate and new disabled plan before any flag-only
arm/fresh compile/single run. No additional owner approval barrier is introduced.
