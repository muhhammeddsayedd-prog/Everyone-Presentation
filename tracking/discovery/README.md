# Discovery evidence and current canonical state

Updated 2026-10-28. Nine reviewed migrations are applied locally/cloud; the [fresh role-order readback](../evidence/cloud-role-order/2026-10-28T19-31-14-242836Z-dc97d5dc-readback.json), finished 19:31:14.242819Z, verifies 32 public RPCs, 60 inspected routines and 19 forced-RLS app relations. Existing base counts and workspace/spec/role/slot/preferences hashes were preserved; the cloud still has one pristine spec and zero roles/slots. Actual OpenAI/n8n API access and one synthetic OpenAI extraction are recorded separately below, without database application or a workflow run. [Producer enrollment](PRODUCER_BOOTSTRAP.md) remains completed with four scoped grants. The owner reports working login/project visibility, then closed review tabs; connected Person1 was last signed out. No newer authenticated browser or hosted Storage acceptance is established by this release. The guarded Storage probe is enabled in owned process 30061 but has never run against hosted Storage. Historical observations remain unchanged.

| Record | Evidence boundary |
| --- | --- |
| [Initial local inventory](local-inventory.json) | Original specification-only workspace, tools, configuration names and assets |
| [Initial failed runtime](local-runtime-evidence.json) | Failed empty Supabase runtime binding check and scoped stop with backup retained |
| [Selected project identity](linked-project-metadata.json) | Actual project identity from read-only listing |
| [Initial cloud metadata](central-metadata.json) | Original empty app schemas/history; observation time unchanged |
| [Current database inventory](database-inventory.md) | Actual applied tables, roles/RLS/RPCs, versions, counts and evidence limits |
| [Central mapping](../../contracts/database/central-schema-map.yaml) | Current physical ownership/read-write paths and explicit future concerns |
| [Canonical ownership](canonical-ownership.md) | Owner decision, coordinated schema, user/resource permission model |
| [Migration ownership](migration-ownership.md) | One coordinated nine-version history, immutable hashes and local/cloud receipts |
| [Processing foundation release](../evidence/cloud-processing-foundation/RELEASE_REVIEW.md) | Historical seven-version foundation release; source/stage/provider pipeline remains unfinished |
| [Manual specs release](../evidence/cloud-manual-specs/RELEASE_REVIEW.md) | Actual eighth migration, narrow column ACLs, stable empty-spec backfill, exact cloud readback and unchanged shared records |
| [Role-order release](../evidence/cloud-role-order/RELEASE_REVIEW.md) | Actual ninth migration, exact narrow sort-order grant/RPC/RLS delta and unchanged source/order/preferences/base records |
| [Configured provider access](../evidence/m02/provider-access/2026-10-28T19-08-27-697Z-read-only-access.json) | Both APIs HTTP200; selected extraction model available. No generation/workflow execution in that read-only receipt |
| [One actual synthetic extraction](../evidence/m02/provider-evaluation/2026-10-28T19-31-30-526Z-0cfe7e61.json) | One OpenAI request passed strict/evidence/domain assertions: three roles/five slots/null facts; no DB application, cloud business write, n8n call or full pipeline |
| [n8n API discovery](../evidence/m02/provider-access/2026-10-28T19-32-50-135Z-n8n-discovery.json) | One personal project with name redacted; Presentation-name result is an unrelated inactive W05 workflow, not Studio WF-01. MCP still -32603; no workflow change/run |
| [Local manual specs proof](../evidence/m02/specs-local/2026-10-28T18-07-04-016Z-0fdcf864.json) | 23 stages/four sampled backend-blocker pairs and strict cleanup passed; prior failed run and actual first backfill remain separately recorded |
| [Historical manual specs rollback](../evidence/m02/specs-candidate/2026-10-28T17-13-57-335Z-991a6489-rollback.json) | Candidate assertions passed with exact catalog/business restoration before promotion; no source/provider proof |
| [Fresh security advisors](../evidence/cloud-role-order/security-advisors.json) | 33 WARN: 32 curated public-definer findings plus unresolved leaked-password protection; no Auth/billing changes or zero-warning claim |
| [Current signed-in checkpoint](M01_SIGNED_IN_CHECKPOINT.md) | Actual account/grants and aggregate records versus owner-reported activity, last signed-out connected profile and unexecuted hosted probe |
| [Local reproduction](local-reproduction.md) | Supported guarded local target, actual role/race proof and staging plan |
| [Runtime and access](runtime-and-access.md) | Pinned runtime, actual service access, capability and delegated-client plan |
| [Producer enrollment](PRODUCER_BOOTSTRAP.md) | Actual 14:09Z account-readiness inspection and 14:10Z four-capability/two-membership grant readback; connected-browser session and Storage journey remain unverified |
| [Integration decisions](integration-decisions.md) | Confirmed boundaries and remaining feature gates |
| [Fresh service metadata](service-metadata-refresh-2026-10-28.json) | n8n still `-32603`; Vercel Everyone-name query returned no default-scope match |
| [Later n8n refresh](n8n-enrollment-refresh-2026-10-28T14-28-30Z.json) | Root reports another actual `n8n.search_projects` response around 14:22Z with MCP `-32603`; recorded_at is this note's time, not an invented tool observation timestamp |
| [Auth email configuration metadata](../evidence/m01/signed-in/auth-email-delivery-config.json) | Read-only 14:17Z inspection exposes max_frequency=1m0s; SMTP/project quota unknown; no Auth/rate change or email request in that inspection |
| [Asset inventory](assets.md) | Available brand sources and known missing fonts/template/representative media |
| [M00 assessment](M00_ACCEPTANCE_ASSESSMENT.md) | Exact discovery acceptance assessment; milestone status remains the root's ledger decision |
| [Logo acceptance assessment](LOGO_ACCEPTANCE_ASSESSMENT.md) | Current physical foundation versus local simulation, real-user/Storage and M01 gates |
| [Storage policy context](storage-policy-context.json) / [release privileges](storage-release-privileges.json) | Read-only managed helper, ownership/ACL and policy delegation observations before logo release |
| [Verifier configuration](../evidence/cloud-logo-verifier/2026-10-28T04-06-30-395598Z-21d6e564-inspect.json) | Later protected purpose key matches runtime file; no values, raw diagnostics, `.env.local` modification or enablement |
| [Read-only logo recovery](../evidence/m01/LOGO_RECOVERY_REVIEW.md) | Ready reads/reuse survive missing upload verifier; current 80-app/four-browser synthetic checkpoint passed |

Earlier release/configuration receipts retain their original paths/timestamps. The [database inventory](database-inventory.md) distinguishes the local eighth-migration driver failure/backfill, later nine-version proofs and fresh cloud readback. Local Auth/Storage catalogs are simulations, separate from hosted HTTP behavior. The [anonymous role-order check](../evidence/cloud-role-order/anonymous-rpc-boundary.json) returned HTTP401/42501, not a missing-function result; it proves lookup/denial only. n8n MCP still fails -32603 while its separately configured management API works; [runtime evidence](runtime-and-access.md#provider-access-and-single-synthetic-evaluation) keeps that distinction and the synthetic extraction limits explicit. When UI acceptance resumes, use the existing enrolled account/project/workspace; no setup regrant is needed. Hosted probe, source/stage/storage/service pipeline, assignment retirement, Claude/PDF/guest/restore/deployment gates remain open.

These records use `tracking/discovery/` alongside the progress ledger, fulfilling the categories in `docs/data/SUPABASE_DISCOVERY_AND_MIGRATIONS.md` without a second mutable report under `docs/discovery/`. No credentials, bearer URLs, private media or real personal fixtures belong here. The linked canonical root is not a disposable reset/seed target.
