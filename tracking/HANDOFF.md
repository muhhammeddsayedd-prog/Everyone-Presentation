# Current Codex handoff

Updated 2026-10-28. M00 verified; M01 in progress; M02 isolated preparation. The production app is not complete.

## Authority and canonical system

The owner explicitly confirmed the initially empty Everyone-Presentation project (pyibofyctwnqpvktepse, eu-west-1) as canonical. This supersedes only the old pre-existing-business-schema prerequisite. Preserve existing-project-before-workspace, real identities, exact capabilities, immutable versions and all other contracts. No requirements re-interview or routine permission question is needed.

Four immutable migrations are applied locally and in cloud: 20261028010943, 20261028013324, 20261028013655 and 20261028024205. The fourth is `supabase/migrations/20261028024205_m01_private_logo_boundary.sql`, SHA256 b04af5119b4e384bd96136573eec39e69f21a0ffb7d9f4aeb07bbf48f2976b9d. Never rewrite applied bytes; add forward fixes.

Cloud receipts: tracking/evidence/cloud-foundation/ (historical first three) and tracking/evidence/cloud-logo-foundation/ (fourth dry-run/apply/readback). Current physical foundation has 18 scoped RPCs, 13 enabled+forced-RLS app relations, one private 5MiB PNG/JPEG/WebP bucket and eight Storage policies. Discovery mapping/ownership is in contracts/database/central-schema-map.yaml and tracking/discovery/. The release snapshot's zero key/user/business/media counts remain historical; do not change its observed_at or describe them as permanent.

A later dedicated 32-byte logo-purpose key was generated inside PostgreSQL and matched to protected local configuration. Actual provision/reopened inspect: tracking/evidence/cloud-logo-verifier/. No raw secret, digest or returned CLI output is recorded in source. Existing apps/web/.env.local bytes were unchanged. The private phase/key files are ignored and protected for the current Windows user and SYSTEM. Exclusive CREATE_NEW handles prevent concurrent adoption/overwrite; incomplete DB/filesystem provisioning requires recovery of the same key, never blind regeneration/deletion.

## What runs

Actual central development app: http://127.0.0.1:3000/projects, started with `npm.cmd run dev:central` (existing tool session93076 predates key installation). Public Supabase URL/key are configured privately on this machine. The current code was exercised by a fresh anonymous browser/API check after the recovery changes: real sign-in UI, internal401, fixture403, no browser errors/overlay. No email was requested by the agent and no fake cloud user/project/media was seeded.

The updated launcher privately loads only the two verifier fields from a valid completed target-bound configuration on next startup. Actual loader check passed without value output or a feature flag. Current running process predates this installation; relaunch the owned server before enabling/testing new uploads. A malformed optional private key configuration is rejected for loading while read-only startup remains usable.

Upload purposes remain [] and runtime uploads remain disabled. Ready metadata/content, client-default reuse, cancellation and scope-checked completed replay survive unavailable upload verification. New reservation/mint/new completion stay503 without required configuration. API/UI actor permissions and private byte checksum checks remain enforced.

`npm.cmd run dev` is the separately labelled synthetic app. Do not start it on the same occupied port. Fixture Playwright tests own port3100, separate state and build output. The actual local PostgreSQL container is fingerprinted/owned on127.0.0.1:55433. Its Storage catalog is a deliberately simulated SQL fixture, not an Auth/Storage HTTP service. Never reset/seed/start the CLI-linked root. Root config enables the single migration history, disables seeds, and cloud pushes skip Vault.

## Actual evidence

- Current application: 80 tests (16 domain/server,3 contracts,12 jobs,14 provider adapters,10 actual synthetic document parsers,25 central SDK/receipt tests); four fixture browser/HTTP journeys; build PASS. Exact latest logs/artifacts: tracking/evidence/m01/readonly-reuse-checkpoint/. Lint/typecheck passed after recovery/reuse changes. Static pack and53-skill integrity checks passed separately.
- Guarded PostgreSQL role/RLS/state assertions and three actual backend race pairs passed, with strict scoped cleanup. Latest full DB receipt: development/local-db/receipts/2026-10-28T03-22-41-050Z-test-db-summary-59ca1af3.json. Logo race proof: tracking/evidence/m01/LOGO_CONCURRENCY.json.
- Actual Node compact HMAC bytes passed SQL finalize; wrong MAC failed; all fixtures rolled back: development/local-db/receipts/2026-10-28T03-20-25-083Z-logo-node-sql-interop.json. Reproduce with `node tools/check-logo-receipt-db.mjs`.
- SQL independent review and rollback rehearsal preserve the failed synthetic-key probe and fixes for new-key replay, terminal row locks, inherited ACLs and expiry between transitions. See LOGO_SQL_INDEPENDENT_REVIEW.md and LOGO_RECOVERY_REVIEW.md in tracking/evidence/m01/.
- Actual security advisors returned18 intentional authenticated-definer WARN findings, with no other finding. Review rationale is in tracking/evidence/cloud-logo-foundation/security-advisor-review.md. Do not call this zero warnings or production acceptance.
- Session-bearing trace ZIPs are retained only under ignored private storage with a sanitized hash manifest. Sanitized historical PNG/JSON/text test artifacts are source-retained; trace ZIPs are excluded. A later reuse cleanup-revision failure has only a delegate-reported note because its root output directory was replaced; no missing capture is claimed.

These are distinct local/synthetic/SDK/SQL/cloud-metadata/configuration results. No real signed-in Producer writeback, hosted Storage token/byte acceptance, AI/n8n execution, native rendering, guest path, MCP client, restore or deployment is proved.

## Required next actions

1. Await the pending actual Producer email/confirmed human sign-in and first real project/client details. Verify that principal, assign only documented capabilities/resource memberships and create the owner-supplied canonical record. No automatic first-user grant, invented user/project or cloud fixture. Workspace creation still requires an existing permitted central project.
2. Relaunch through the updated central launcher for the owned development acceptance session. Complete the actual M01 journey and Storage gate: explicit-false mint, unsafe upsert mint denied BEFORE object existence, real private image decode/hash, preissued-token overwrite denial, replacement/removal/reuse/reload, revoked scope and cancellation. Read tracking/discovery/LOGO_ACCEPTANCE_ASSESSMENT.md and storage-operation-context-research.md. Development availability can be enabled as part of these authorized tests; changing advertised DB purposes requires a reviewed forward change, not editing an applied migration. No production-ready claim until required evidence exists.
3. Finish remaining M01 keyboard/session/stale-error acceptance and record exact receipts before marking verified. Then connect M02: actual transactional jobs/outbox repository, scoped services/output reservations, editable specs/roles/slots UI/API, worker and real WF-01. Existing @eps/jobs/@eps/integrations/apps/worker modules are isolated components, not a connected pipeline.

Fresh n8n project discovery at2026-10-28T03:58:29Z still returned -32603 (n8n-refresh receipt in discovery). Restore existing connection; do not substitute another orchestrator/workspace. OpenAI key/evaluated model, representative authorized media, native FFmpeg/worker isolation, hosting selection, approved template/missing six fonts, intended Claude clients, sizing/restore and deployment remain future gates. M03-M07 remain not started.

## Source and packaging

Local Git only, no remote/push. Initial checkpoints:369a77d, fdf0e11, bf31caa; final code/source checkpoint: f6164a7b1ba66e2f2ec746041c6de827bf75edb0. Preserve source seals, historical receipts and observed_at values. .gitattributes preserves byte hashes and permits CRLF diff checks without normalizing migrations/skills.

`python tools/package_pack.py --check` inspects Git-eligible source with explicit private/generated path denial. Actual archives go to ignored dist/ with a separate SOURCE_MANIFEST.json; original MANIFEST.json/parent pack archive remain historical and unchanged. Never commit private config, .env.local, .local, Supabase .temp, credentials, raw traces or personal fixtures.

The final code checkpoint includes the source/private-material scan in tracking/evidence/source-logo-checkpoint-scan.json. Post-configuration cloud key ACL/RLS/readiness passed in tracking/evidence/cloud-logo-verifier/readiness.json. A documentation-only follow-up records this commit; consult git log for its own SHA.
