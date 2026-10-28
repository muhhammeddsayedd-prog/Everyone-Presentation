# One coordinated canonical migration history

Updated 2026-10-28. By explicit owner decision, `Everyone-Presentation` (`pyibofyctwnqpvktepse`) is the canonical system. This repository's `supabase/migrations/` is its one coordinated history. The product owner retains release authority; Codex authors and validates changes. There is no configured Git remote. Initial discovery found no app migration history or business tables; no unrelated history was replaced.

| Version | Purpose | Local / canonical cloud |
| --- | --- | --- |
| `20261028010943` | Canonical M01 identities, memberships, RLS, workspace and RPC foundation | Applied / applied |
| `20261028013324` | Forward fix: inherit existing managed authenticated identity privileges in one direction | Applied / applied |
| `20261028013655` | Forward fix: remove actual workspace PL/pgSQL alias ambiguity | Applied / applied |
| `20261028024205` | Private logo reservations, receipt verifier and restrictive Storage policies | Applied / applied; runtime upload capability disabled |

The [current logo release receipt](../evidence/cloud-logo-foundation/2026-10-28T03-32-17-619834Z-6a35754c-apply.json), observed `2026-10-28T03:32:17.619929+00:00`, seals all four immutable file hashes and embeds actual versions, ownership, policy/RPC and count readback. The preceding [dry run](../evidence/cloud-logo-foundation/2026-10-28T03-31-14-099273Z-c546ebcb-dry-run.json) found only the fourth migration pending. The [original three-version apply](../evidence/cloud-foundation/apply.json) and [readback](../evidence/cloud-foundation/readback.json) remain historical evidence. `design-reference.sql` was not installed; Vault sync, seeds, key provisioning and runtime upload enablement were excluded.

Local runtime failures were retained and corrected additively. Applied history was not rewritten to hide failures. The [latest local acceptance summary](../../development/local-db/receipts/2026-10-28T03-22-41-050Z-test-db-summary-59ca1af3.json) records 19 stages, three independent-backend race pairs and successful scoped cleanup. The logo candidate also had independent static review and rolled-back probes before local promotion; the first probe failure remains preserved. [Actual Node-to-SQL HMAC interoperability](../../development/local-db/receipts/2026-10-28T03-20-25-083Z-logo-node-sql-interop.json) uses a known synthetic key and proves rollback of all fixtures.

The linked root is a canonical migration source, not a disposable local database. Current config explicitly enables migrations and disables seeds; the cloud link remains under ignored `.temp/`. `tools/local-postgres.mjs` owns the separate labelled, loopback-only local runtime and reviewed-hash ledger. Never remove the user's cloud link or run local reset/seed/start against the linked root.

Future changes join this sequence additively. Check the current target/history and pending source hashes, replay with actual restricted roles locally, reconcile drift, then apply through the authorized release path. Preserve ready versions and referenced media as those features arrive. Prefer a forward fix over destructive rebuild; application rollback and metadata/media restoration remain separate operational exercises.

No cloud users, clients or projects were seeded, and no media bytes exist yet. Staging provider topology, hosting and metadata-plus-media restore are future integration/release gates; their absence is not concealed by the proven M01 schema application.

The local Storage baseline is a separately reviewed, fingerprinted SQL catalog simulation under `development/local-db/`, not another canonical migration history or an HTTP service. Cloud policy creation uses the observed narrow `supautils.policy_grants` delegation; no managed table owner or broad role membership was changed. The actual private bucket and SQL receipt boundary do not authorize advertising working uploads before real-user/Storage verification.

Key provisioning occurred later as a separate configuration operation, not a fifth schema migration. [Provision](../evidence/cloud-logo-verifier/2026-10-28T04-05-15-847982Z-658a983b-provision.json) at `04:04:59.429274+00:00` and [reopened inspection](../evidence/cloud-logo-verifier/2026-10-28T04-06-30-395598Z-21d6e564-inspect.json) at `04:06:23.761385+00:00` confirm the purpose key matches protected runtime configuration. The immutable 03:32 release receipt still correctly records zero keys and no provisioning in that phase. Upload enablement and database purposes remain off; the earlier running server still needs a fresh startup with that configuration.
