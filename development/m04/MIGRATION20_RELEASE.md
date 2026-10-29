# M04 casting migration20 release

Canonical20 is now applied and independently read back. The [single apply](../../tracking/evidence/cloud-m04-casting/2026-10-29T18-04-35-944214Z-beeda9c6-apply.json) and [independent readback](../../tracking/evidence/cloud-m04-casting/2026-10-29T18-06-32-278912Z-2e383297-readback.json) both pass. All existing business/media/source/configuration/Auth state and eleven runtime operations are retained, with three new empty casting tables at release. The one-shot claim is retained; do not reapply migration20.

The CLI-generated migration is
`supabase/migrations/20261029174841_m04_casting_assignments_lifecycle.sql`,
SHA256 `2825681bf529f1b32db2473749180901f0961b025e8da847b38ad49c06f4b900`.
It composes the unchanged assignment kernel `f19d1946…` followed by lifecycle
integration `0c9719e9…`, with an exact19 prerequisite. The numbered migration has
no transaction control; the established local runner and Supabase CLI own the
atomic boundary. No fixture, key, image, configuration, provider or hosting
change is included. The reviewed19 manifest is retained byte-for-byte beside
the preparation receipt; the reviewed20 manifest is separately retained.

The actual generated migration plus temporary history20 passed all eight
assignment/lifecycle/boundary assertions in
[the rollback proof](../../tracking/evidence/m04/migration-local/2026-10-29T17-50-48-101Z-2d85109f.json).
Catalog, business records and managed Auth metadata returned exactly to local19
after rollback. The [one-time local promotion](../../tracking/evidence/m04/migration-promotion/2026-10-29T17-55-46-337Z-813da042.json)
then matched the complete expected20 snapshot, preserved full Auth policies,
all existing counts/hashes, configuration and runtime authority, and left the
three new tables empty. The shared local lock was released after verification.
The prior isolated two-actor Main race remains bound to the unchanged fragments.

## Canonical guard

`tools/release_m04_casting.py` accepts only `inspect`, `dry-run`, `apply` and
`readback` for canonical project `pyibofyctwnqpvktepse`. It seals all20 migration
files, the exact reviewed manifest, local rollback and promotion, the prior Main
race, readback query and dependencies before CLI access. Seeds remain disabled;
the exact push command skips Vault and has no arbitrary target or SQL option.

The fixed read-only query includes all prior metadata fingerprints plus full
Auth table policy metadata and observed PUBLIC/authenticated schema privilege
bits. It never selects Auth records, credentials, key bytes or key digests.
Comparison preserves all actual existing rows, source/media facts, protected
M02 job and note, frame/support configuration and eleven runtime operations.
The three new FORCE-RLS tables must be empty. New function owners remain
NOLOGIN, non-BYPASSRLS and without CREATE privileges. Existing source and
explicit ACL changes must equal the reviewed local delta.

The only environment derivations are the effective privileges of the two new
owners from observed schema defaults, and their execution of the three existing
managed Storage predicates from PUBLIC/authenticated inheritance. A schema
CREATE privilege blocks release. Five unchanged local-only Storage fixture
constraint/index rows may be absent from cloud; actual cloud rows are never
discarded or normalized. Existing role privileges remain unchanged.

A successful dry-run must name exactly migration20 and preserve the entire
readback snapshot. Apply requires that same source and before-state within
15 minutes. An owner/SYSTEM-protected one-shot claim and tracked attempt exist
before dispatch. A claim or prior apply attempt prevents another apply even
when the CLI result is unknown. Use `readback` to reconcile that outcome.
Raw CLI output stays in protected ignored files; receipts contain metadata only.

## Restore and forward-fix strategy

DDL and migration history are atomic. A transaction failure before commit must
leave19 intact; inspect history and the sealed metadata to establish that result.
Never rerun an unconfirmed apply. A dispatched-but-unknown operation retains its
intent and is resolved with read-only comparison against the retained before
state and exact expected delta.

After commit, preserve assignment identities, private audit/inverse rows,
immutable media, all existing facts and every original migration. Application
code can be corrected or its new board wiring reverted while preserving the
schema; existing role-only reorder requests remain valid subsets of the full
order operation. Do not drop new tables or restore old lifecycle bodies that
would ignore active assignments. A database defect receives a separately
reviewed additive forward migration with its own exact current-state guards and
preservation proof. Source19 function bodies and ACLs remain available in the
immutable history and pre-release metadata for that analysis.

No metadata-plus-media restore, hosted Auth concurrency, endurance or production
deployment acceptance is established by this migration. Hosting stays deferred.
M03 vision selection, if added, follows as a separate post20 migration and must
not change these reviewed20 bytes.

## Validation commands

Use the repository Node24 and isolated Python environment:

```powershell
node tools/run-tests.mjs tests/operations/m04-migration-composition.test.mjs tests/operations/m04-local-promotion.test.mjs
.\.venv-skills\Scripts\python.exe -X utf8 -m unittest discover -s tests/operations -p test_m04_casting_release.py
.\.venv-skills\Scripts\python.exe -X utf8 tools/release_m04_casting.py dry-run
```

The seven Node checks and ten Python checks are offline guard tests. The last
command performs actual canonical read-only discovery and CLI migration planning;
it does not apply the migration. Local promotion is already complete and must
not be repeated. Canonical apply and its independent readback remain separate
from the draft/test receipts until explicitly executed and recorded.

Current primary references checked for this integration:
[PostgreSQL17 row locks](https://www.postgresql.org/docs/17/explicit-locking.html),
[row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[Supabase function security](https://supabase.com/docs/guides/database/functions),
[PG17.11 compatibility changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes),
and [explicit Data API grants](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
No legacy-cipher PGP/custom operator/public-table default-grant change is part of
this assignment migration; public RPC execution is explicitly granted.
