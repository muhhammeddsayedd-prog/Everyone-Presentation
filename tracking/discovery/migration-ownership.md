# One coordinated canonical migration history

Updated 2026-10-28. By explicit owner decision, `Everyone-Presentation` (`pyibofyctwnqpvktepse`) is the canonical system. This repository's `supabase/migrations/` is its one coordinated history. The product owner retains release authority; Codex authors and validates changes. There is no configured Git remote. Initial discovery found no app migration history or business tables; no unrelated history was replaced.

| Version | Purpose | Local / canonical cloud |
| --- | --- | --- |
| `20261028010943` | Canonical M01 identities, memberships, RLS, workspace and RPC foundation | Applied / applied |
| `20261028013324` | Forward fix: inherit existing managed authenticated identity privileges in one direction | Applied / applied |
| `20261028013655` | Forward fix: remove actual workspace PL/pgSQL alias ambiguity | Applied / applied |

Exact immutable file hashes are in [the cloud apply receipt](../evidence/cloud-foundation/apply.json); actual cloud versions, ownership, grants and row counts are in [readback](../evidence/cloud-foundation/readback.json). `design-reference.sql` remained guarded and was not installed. The release used `--skip-vault`, no seeds and no custom role-export file.

Local runtime failures were retained and corrected additively. The initial applied file was never rewritten to hide a failure. The [local acceptance summary](../../development/local-db/receipts/2026-10-28T01-46-46-146Z-test-db-summary-8fbb2c6b.json) records actual replay, runtime role/domain assertions, separate database backend PIDs and overlapping concurrent claim windows, verification, and successful scoped fixture cleanup.

The linked root is a canonical migration source, not a disposable local database. Current config explicitly enables migrations and disables seeds; the cloud link remains under ignored `.temp/`. `tools/local-postgres.mjs` owns the separate labelled, loopback-only local runtime and reviewed-hash ledger. Never remove the user's cloud link or run local reset/seed/start against the linked root.

Future changes join this sequence additively. Check the current target/history and pending source hashes, replay with actual restricted roles locally, reconcile drift, then apply through the authorized release path. Preserve ready versions and referenced media as those features arrive. Prefer a forward fix over destructive rebuild; application rollback and metadata/media restoration remain separate operational exercises.

No cloud users, clients or projects were seeded, and no media bytes exist yet. Staging provider topology, hosting and metadata-plus-media restore are future integration/release gates; their absence is not concealed by the proven M01 schema application.
