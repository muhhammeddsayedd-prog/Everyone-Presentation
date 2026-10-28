# M00 acceptance assessment

Updated 2026-10-28. **Recommendation to the integration owner: M00 qualifies as `verified` for discovery, ownership/contracts and the safe local development path.** This file does not change the milestone ledger. Reconcile the current environment inventory/handoff with the receipts before changing that ledger; their earlier empty/unresolved-source statements are historical now.

The assessment applies the explicit owner amendment: the inspected empty `Everyone-Presentation` project is the new canonical system. It does not require finding business tables that the owner has confirmed do not exist. Initial discovery was read-only. Authorized M01 schema/Auth-redirect changes happened later and have separate receipts; they are not retroactively described as discovery reads.

## Exact M00 acceptance

| Packet acceptance | Evidence / disposition |
| --- | --- |
| Explain existing authorized project resolution and central writeback without a separate canonical project table | Actual `public.projects/clients`, explicit memberships/capability grants, direct workspace FK and 12 scoped RPCs are mapped. Local real-role tests exercise canonical writeback and denials; cloud application/readback confirms the physical surface. A real user/project journey remains M01 work because cloud has no users/projects yet. |
| Reuse suitable candidate shared fields and avoid duplicate truth | The actual initial canonical source had no candidate/person/business fields to reuse. That absence is evidenced, not an unknown table guess. M03 must establish one reusable candidate-fact owner; project media/availability, assignments, wording and snapshots remain separate as contracted. No duplicate candidate truth was created in M01. |
| Identify actual migration history and local target before any reset/seed | This repository owns the one new history; three actual versions and immutable hashes match local/cloud readback. The separate local runner verifies image/labels/loopback bindings/database identity and reviewed SQL hashes. No cloud reset/seed or real-person fixture was performed. |
| Demonstrate local bootstrap/schema replay or concrete prerequisite | Actual managed PostgreSQL replay, restricted roles, revisions/idempotency and canonical writes passed. Separate same-key and distinct-key sessions have different backend PIDs and overlapping timestamp windows, followed by effect verification and scoped cleanup. Image/helper differences and failed attempts are retained. |
| Map project/library boundaries without universal admin/Claude access | Explicit grants and independent project/client write scope are implemented and tested. Contributor preparation does not imply shared editing/review. Library-only/nonmember actors are denied project access; user metadata and declared client type are not authority. MCP is planned to delegate the same user permissions, not receive a service role. |
| Record verified versus unverified provider/runtime capabilities; no mutation during read-only discovery | Current runtime/versions, fresh n8n internal error, successful but empty default-scope Vercel name search, known absent buckets/fonts/samples and future MCP/worker/model gates are recorded honestly. Original discovery receipts retain their timestamps. Later owner-authorized M01 writes have separate apply/readback receipts. |

## Required artifact coverage

| Artifact | Current location / completeness |
| --- | --- |
| Sanitized environment inventory | `tracking/ENVIRONMENT_INVENTORY.md` plus `runtime-and-access.md`; root must replace stale initial-state prose in the main inventory with current apply/readback facts |
| Concrete physical map | `contracts/database/central-schema-map.yaml`; actual M01 keys/owners/read-write methods/roles/history, explicit absence/future status for unimplemented concerns |
| Discovery/reuse/add/adapt report | `database-inventory.md`, `integration-decisions.md`, `canonical-ownership.md`; actual empty baseline followed by approved new canonical objects |
| Migration/local/staging strategy | `migration-ownership.md`, `local-reproduction.md`, `canonical-release-plan.md`; one history, guarded real local path and isolated real-service staging plan without invented account IDs |
| Auth/capability/delegated-client plan | `runtime-and-access.md`, applied scoped RPC/RLS implementation, central user-token adapter and source MCP contract; actual intended-client execution remains M07 |
| Runtime/worker/assets plan | Implemented package versions locked; separate native worker responsibilities and missing production container/font/sample inputs are explicit in runtime/assets records |
| Justified decisions and contract reconciliation | Owner new-canonical amendment in `tracking/DECISIONS.md`, current physical map and unchanged product invariants; no replacement database/provider or permissive prototype security was adopted |

## Evidence boundaries carried forward

M00 verification does not close future integration facts by assumption. Actual signed-in user/project provisioning, private logo storage, OpenAI model/account/sample evaluation, n8n access/workflows, native worker resource limits/hosting, approved fonts/template, intended Claude OAuth/client transfer tests, sizing and restore remain their owning milestone gates. Their unavailable or unimplemented state is already discovered and documented; no current canonical keys/functions are being invented to hide those gates.

The remaining main-inventory reconciliation is documentation work with available evidence, not an access prerequisite or a new product decision. After that correction, no additional required M00 discovery artifact is missing. Production and M01–M07 verification still depend on their own implementation and acceptance evidence.

Key receipts: `tracking/evidence/cloud-foundation/apply.json`, `readback.json`, `auth-development-apply.json`, `auth-development-diff.json`, `anonymous-smoke.json`; local `development/local-db/receipts/2026-10-28T01-46-46-146Z-test-db-summary-8fbb2c6b.json`; and `tracking/discovery/service-metadata-refresh-2026-10-28.json`. Initial cloud/local receipts remain unchanged.
