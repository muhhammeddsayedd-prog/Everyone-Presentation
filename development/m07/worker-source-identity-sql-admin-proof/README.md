# Owned worker40 fixture-context correction

This new purpose preserves the failed `dc652691` run and its permanent claim.
It composes the sealed prior compiler and callback as libraries. Its entry is
disabled, and source preparation writes no compiled controller, claim or SQL.

The failed combined fixture dispatch selected `postgres` session authorization
before qualification created `project39_proof.qualified_rows`. The bootstrap
created that schema as its original `supabase_admin` login. The actual first
error was `permission denied for schema project39_proof`; SQLSTATE was not
captured, so `42501` remains an inference.

The correction splits only that dispatch:

1. Reset to the original login and begin the qualification transaction. Before
   the unchanged qualification SQL can create its table, assert exact current
   and session role `supabase_admin`, superuser status, schema ownership, owned
   database/system and current run.
2. In a separate dispatch, explicitly select `postgres` session authorization
   for the unchanged valid configuration fixture. Managed metadata preparation,
   actual State collection and the frozen callback keep their existing context.

No grant, membership, schema owner, production SQL or accepted mask changes.
The actual restored function/policy path requires the existing writer,
`presentations.generate` and `review_links.manage` fixture capabilities;
`cast.read` is not needed for its create-series and revoke path and is not added.
The exact controller inverse proves every other inherited executable byte is
unchanged. The private callback changes only its flag and absolute sealed
library URL. New compiled/claim/resource/evidence namespaces prevent old replay.

The focused tests run with Main's isolated Python from this checkout:

```powershell
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/worker-source-identity-sql-admin-proof/test_correction.py
```

The tests compile in RAM, parse all generated JavaScript and both rendered SQL
transactions, and execute the actual old/new dispatch fragments against a small
source-derived schema-owner model. The old combined fragment is refused and
the split fragment passes. This is a deterministic source regression, not a new
Postgres execution. Default-off refusal occurs before any port or file read.
Production State SQL hashes, native value and concurrency projection remain
identical to the sealed prior purpose.

An actual owned run requires a separately reviewed flag-only arming commit,
fresh compile/runtime UUIDs, source-pin and shared-lock recheck, and one normal
invocation with the required Main root argument. Its inherited cleanup must
prove original29 data/catalogue/global roles equal, all owned resources absent
and shared lock released, including on failure. No canonical, image, provider
or deployed-worker acceptance is claimed by this source plan.
