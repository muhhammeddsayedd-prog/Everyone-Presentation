# Current Codex handoff

Updated 2026-10-28. M00 verified; M01 in progress. The complete production app is not finished.

## Authority and actual source

The owner explicitly confirmed using the originally empty Everyone-Presentation Supabase project (pyibofyctwnqpvktepse, eu-west-1) as the new canonical system. This supersedes the original pre-existing-business-schema prerequisite only. Existing real project before workspace, exact user permissions, no invented people/facts/media, immutable versions and all other pack requirements remain.

M00 read-only discovery ended before the authorized M01 additive cloud application. This repository owns the single canonical migration history. M00 acceptance is documented in tracking/discovery/M00_ACCEPTANCE_ASSESSMENT.md. Do not restart the requirements interview or ask routine permission again.

## What runs now

The central-mode development app is running at http://127.0.0.1:3000 (tool session93076 at this checkpoint). Start it with npm.cmd run dev:central after npm.cmd ci. The actual Supabase publishable URL/key are configured in ignored apps/web/.env.local on this machine. No service-role key is used or exposed by normal app operations. A fresh authenticated user is verified with getUser; RPC identity comes from the same user JWT. Browser and bearer requests enforce the same user scope. Fixture endpoints are disabled in central mode.

Anonymous central browser/API checks passed with desktop and320px screenshots in tracking/evidence/cloud-foundation/. The real email sign-in form is visible; no email was sent by the agent. The development site URL and exact callback allowlist were configured through a reviewed two-field diff, without changing confirmation/provider/MFA settings. Public Auth readiness returned200, email/signup enabled, confirmation required. First Producer email is pending the owner's asynchronous answer, and actual human sign-in is required before assigning real permissions. No automatic first-user grant, fake cloud user or invented real project exists.

npm.cmd run dev is the separate labelled synthetic mode with persistent project/client/workspace/preset/verified-logo data. The browser test server owns port3100 and separate .local/e2e-studio state/build output, so it does not replace central mode. npm.cmd start still refuses production while release acceptance is incomplete.

## Actual canonical cloud/local foundation

Applied and read back all three immutable files:

- supabase/migrations/20261028010943_m01_canonical_foundation.sql
- supabase/migrations/20261028013324_m01_identity_role_inheritance.sql
- supabase/migrations/20261028013655_m01_workspace_scope_alias.sql

Cloud proof: tracking/evidence/cloud-foundation/{dry-run,apply,readback}.json. Twelve user-scoped RPCs and11 enabled+forced-RLS relations are present. Narrow function roles are nonlogin/non-BYPASSRLS; authenticated cannot assume the owner; no direct private-table read/canonical-write grant exists. Only three audience defaults were inserted. The readback snapshot had zero auth users, clients/projects, memberships/grants, workspaces/media/buckets. Do not describe these snapshot counts as permanently current if the owner signs in later.

public.clients/projects and explicit project/client memberships/capability grants are canonical. App-specific relations live in private eps. Actual physical mapping and ownership: contracts/database/central-schema-map.yaml and tracking/discovery/. The private owner inherits only existing authenticated permissions in one direction with INHERIT=true, SET=false, ADMIN=false; this was needed because actual managed Auth grant options differ from ordinary table ownership. No managed Auth owner/RLS policies were changed.

The dedicated local official Supabase PostgreSQL container is owned and fingerprinted at127.0.0.1:55433. It is not Supabase Auth/Storage/REST. Guards verify Docker context, image digest, container/volume/network/workspace ownership, actual bindings and system ID. Local secrets stay under ignored .local/local-postgres/. Commands and receipts: development/local-db/README.md and tools/local-postgres.mjs. The old CLI-local IPv6-binding failure and retained backup are historical; its config is archived. Never reset/seed/start the linked root. Root supabase/config.toml now enables the authoritative migration history and disables seeds; cloud application explicitly skipped Vault synchronization.

Applied migrations must never be rewritten. Real local execution exposed missing local auth.jwt baseline, managed Auth grantability and a PL/pgSQL record/alias ambiguity; the baseline adaptation and two additive forward fixes preserve those failures. The final role/RLS/domain rollback suite passed. Two same-key/distinct-key pairs used separate PostgreSQL backends with overlapping timestamps and >900ms lock waits, yielded one workspace per project and exact audit/idempotency counts, then strictly scoped cleanup passed. npm.cmd run test:db reproduces the guarded real suite; reviewed hashes are in development/local-db/reviewed.json.

## Tests and evidence boundaries

Latest actual checks: npm.cmd run typecheck, npm.cmd run lint (zero warnings), npm.cmd test (60 tests), npm.cmd run test:e2e (4 actual fixture browser/HTTP tests), npm.cmd run build, production guard, strict pack validation and all53 skill integrity checks passed. npm.cmd run test:db additionally passed its real PostgreSQL role and concurrency suites. tools/verify_local.py records commands/environment/results under tracking/evidence/local-checks/. Historical full synthetic checkpoint and failures are retained separately.

The60 tests are14 domain/server,3 contract,12 jobs,14 provider-adapter/error mapping,10 actual synthetic PDF/DOCX/UTF8 parsing and7 Supabase SDK tests with injected transport. They do not establish real AI, signed-in cloud writeback, guest/PDF/MCP or production acceptance. The test runner now refuses empty globs after an initially miswired central suite returned zero tests; the corrected suite actually ran seven. A stronger cache header intentionally required an API test expectation update. Central browser refresh loops caused by dynamic fixture-file tracing were fixed by keeping @eps/domain server-external; actual Node24 workspace loading, browser checks and build passed.

Network traces are disabled. Earlier session-bearing fixture trace ZIPs remain only in ignored .local/private-test-traces/; a sanitized SHA/path manifest preserves history. Never commit .env.local, Supabase .temp, database passwords, real personal fixtures, access tokens or raw provider payloads.

## Incomplete implementation and exact next work

M01 is in_progress. The twelve central capability/project/workspace/audience operations exist, but central upload/media operations return503 and upload_policy.available_purposes=[]; buckets remain empty. Full verified private logo persistence currently exists only in synthetic mode. The first real Producer/project journey is not run.

Read tracking/discovery/logo-storage-boundary.md before implementing storage. It proposes user-JWT scoped private transfer plus actual bounded Sharp/hash verification and a purpose/scope/expiry-bound server proof to prevent callers fabricating Ready. No verifier key, bucket, SQL or storage change was made for that proposal. The decisive gate is actual signed-upload immutability: deny upsert-capable signed-token issuance even before the path exists. A same-origin fallback still needs reliable operation-based denial of all signed-upload issuance. If operation context is unavailable, keep uploads503 or review a genuinely separate writer boundary; do not claim that lack of UPDATE policy alone proves immutability. Bound receipts before decoding and keep keys/proofs out of client/API/MCP/logs. This remains a technical implementation gate, not a new user approval requirement.

Next exact actions:

1. Use the pending real Producer email and a confirmed human Supabase sign-in to identify the actual auth principal; grant only explicit app/project/client permissions. Do not seed a fake user or assume first signup is owner. Obtain real initial project details before creating canonical records; workspace creation still requires an existing authorized project.
2. Inspect actual Storage policy/operation helper support read-only, implement the reviewed scoped logo reservation/verification boundary locally, and test actual authenticated private transfer/upsert denial before enabling central uploads. Complete M01 real authorized project edit/logo/reload journey with API parity.
3. M02 has isolated @eps/jobs, @eps/integrations and apps/worker document modules, not a connected durable pipeline. Implement the central transactional job/outbox repository, scoped callbacks/reserved outputs, specs/roles/slots API/UI, and real WF-01 using those components. No arbitrary SQL or worker shell task is exposed to users.

Fresh n8n project discovery still returns MCP-32603. Vercel search found zero Everyone-name projects in the default authenticated scope; no hosting vendor/account was selected. Real OpenAI key/model evaluation, n8n workflow access, native FFmpeg/render process isolation, representative real media, missing brand fonts/approved template, intended Claude OAuth/file-transfer clients, sizing, restore and app deployment remain future gates. M03–M07 are not started. No real AI/n8n processing, actual PDF/guest/MCP path or production release is claimed.

## Source checkpoint

Local Git repository, no remote/push. The verified source checkpoint and any follow-up ledger commit are recorded in Git history and the final session evidence. Preserve original contracts, skill payload hashes, historical failures and actual observedAt values. .gitattributes disables byte normalization because skill/design/generated-contract/reviewed-migration SHA256 records are byte-based.
