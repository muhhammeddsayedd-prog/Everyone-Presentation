# Canonical schema application record and continuation

Updated 2026-10-28. The integration owner completed the prepared additive application to owner-approved `Everyone-Presentation`, `pyibofyctwnqpvktepse`, `eu-west-1`, PostgreSQL 17.11. This record supersedes the earlier pending-application plan while preserving the source hashes and separate raw receipts.

| Order | Applied local/cloud migration | SHA256 |
| --- | --- | --- |
| 1 | `20261028010943_m01_canonical_foundation.sql` | `8a5f3ed7727a72051e630307d2daecab8c4a74054398a6425e73bd85e17568b9` |
| 2 | `20261028013324_m01_identity_role_inheritance.sql` | `5382efe9fbdf9c194010257e0ac0024dcb447207522036560056d5d1a4e20e30` |
| 3 | `20261028013655_m01_workspace_scope_alias.sql` | `67ddb2cff9fed9c42d34657e833c613aec4afd2769543a991bbac84da355db64` |

Local prerequisite/role/RLS/revision/idempotency and real independent-session races passed with scoped fixture cleanup; [summary](../../development/local-db/receipts/2026-10-28T01-46-46-146Z-test-db-summary-8fbb2c6b.json). Earlier failures were retained and corrected through forward migrations. Local managed Auth prerequisite repairs were not applied as cloud application migrations.

## Actual cloud operation

The source config was deliberately changed from the old local-only preflight to canonical migration source: migrations enabled, seeds disabled, existing project link preserved. Fresh target/collision/auth-count metadata preceded the dry run. [Dry-run receipt](../evidence/cloud-foundation/dry-run.json) listed the exact three pending files.

Actual application at `2026-10-28T01:49:13.227154+00:00`, exit 0:

```powershell
npx.cmd --yes supabase@2.122.0 db push --linked --project-ref pyibofyctwnqpvktepse --skip-vault --yes --output-format json
```

[Apply receipt](../evidence/cloud-foundation/apply.json) records the reviewed hashes and no Vault synchronization/seeds. [Readback](../evidence/cloud-foundation/readback.json) at `2026-10-28T01:51:11.069521+00:00` confirms all three versions, 12 user RPCs, 11 forced-RLS relations, narrow role properties, one-way inherited identity access and no direct authenticated private-table read or canonical update.

The only data defaults are three audience presets. Auth users, projects, clients, memberships, grants, workspaces, media and buckets remain zero. There were no cloud fixtures, uploaded media, new users or email messages.

A separate narrowly scoped Auth configuration operation changed only the site URL and exact loopback callback. Its apply receipt is [auth-development-apply.json](../evidence/cloud-foundation/auth-development-apply.json), and [subsequent diff](../evidence/cloud-foundation/auth-development-diff.json) is empty. This does not prove a valid signed-in session. The actual [anonymous smoke](../evidence/cloud-foundation/anonymous-smoke.json) proves the central sign-in surface and anonymous/fixture-endpoint denials only.

## Future continuation

Keep one coordinated history and immutable applied files. For a new additive change: verify target/current history and source hashes, replay with actual restricted roles in the guarded local runtime, reconcile drift, and inspect a pending migration dry run before authorized application. Keep `--skip-vault`, no seed/fixture/custom role-export flags, and no credentials in command arguments/logs. A successful no-op is not evidence a new version applied.

If application fails, retain the exact result and read back which versions committed. Each migration is atomic in the chosen engine, while earlier successful files may remain. Add a reviewed forward fix rather than rewriting applied files, resetting the canonical database or dropping managed Auth/Storage objects. Application rollback and metadata-plus-media restore remain distinct operational exercises.

The cloud schema operation does not complete M01 or production release. Real authorized user/project provisioning and journey, private logo storage/verification, OpenAI+n8n+worker processing, guest delivery, intended Claude clients, sizing and restore retain their own gates.
