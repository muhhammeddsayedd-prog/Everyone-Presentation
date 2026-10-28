# Discovery evidence and current canonical state

Updated 2026-10-28. The owner confirmed the inspected empty `Everyone-Presentation` project as canonical. Three reviewed M01 migrations now applied locally and to cloud, with actual readback. Initial empty-state receipts and local failures retain their original observations. Real-user auth/project behavior, storage, providers and production remain separate acceptance gates.

| Record | Evidence boundary |
| --- | --- |
| [Initial local inventory](local-inventory.json) | Original specification-only workspace, tools, configuration names and assets |
| [Initial failed runtime](local-runtime-evidence.json) | Failed empty Supabase runtime binding check and scoped stop with backup retained |
| [Selected project identity](linked-project-metadata.json) | Actual project identity from read-only listing |
| [Initial cloud metadata](central-metadata.json) | Original empty app schemas/history; observation time unchanged |
| [Current database inventory](database-inventory.md) | Actual applied tables, roles/RLS/RPCs, versions, counts and evidence limits |
| [Central mapping](../../contracts/database/central-schema-map.yaml) | Current physical ownership/read-write paths and explicit future concerns |
| [Canonical ownership](canonical-ownership.md) | Owner decision, coordinated schema, user/resource permission model |
| [Migration ownership](migration-ownership.md) | One actual three-version history, immutable hashes and local/cloud receipts |
| [Local reproduction](local-reproduction.md) | Supported guarded local target, actual role/race proof and staging plan |
| [Runtime and access](runtime-and-access.md) | Pinned runtime, actual service access, capability and delegated-client plan |
| [Integration decisions](integration-decisions.md) | Confirmed boundaries and remaining feature gates |
| [Fresh service metadata](service-metadata-refresh-2026-10-28.json) | n8n still `-32603`; Vercel Everyone-name query returned no default-scope match |
| [Asset inventory](assets.md) | Available brand sources and known missing fonts/template/representative media |
| [M00 assessment](M00_ACCEPTANCE_ASSESSMENT.md) | Exact discovery acceptance assessment; milestone status remains the root's ledger decision |

Actual cloud application/readback and the central-mode anonymous browser smoke are under `tracking/evidence/cloud-foundation/`. Actual local PostgreSQL role/RLS/race receipts are under `development/local-db/receipts/`. Fixture, real cloud metadata, real user sessions and real media/provider behavior are never interchangeable evidence.

These records use `tracking/discovery/` alongside the progress ledger, fulfilling the categories in `docs/data/SUPABASE_DISCOVERY_AND_MIGRATIONS.md` without a second mutable report under `docs/discovery/`. No credentials, bearer URLs, private media or real personal fixtures belong here. The linked canonical root is not a disposable reset/seed target.
