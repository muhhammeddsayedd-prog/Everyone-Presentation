# Environment inventory and discovery record

Updated 2026-10-28. Current observations are separate from historical empty-target discovery and production acceptance. No secrets recorded.

## Canonical system and migration ownership

The owner explicitly confirmed the formerly empty Everyone-Presentation Supabase project (`pyibofyctwnqpvktepse`, eu-west-1, PostgreSQL17.11) as the new canonical business system. This resolves the original existing-schema dependency. This repository now owns the single coordinated migration history. M00 read-only discovery ended before the subsequent authorized M01 additive application.

Four reviewed migrations are applied locally and to cloud: 20261028010943, 20261028013324, 20261028013655 and 20261028024205. Initial three-version receipts remain under tracking/evidence/cloud-foundation/. The later dry-run/application/readback under tracking/evidence/cloud-logo-foundation/ confirms 13 enabled+forced-RLS app relations, 18 authenticated scoped RPCs, narrow nonlogin/non-BYPASSRLS function roles, one private 5 MiB brand bucket and eight scoped Storage policies. The release snapshot had zero users/business/media/uploads/keys; only three audience defaults existed. A subsequent dedicated key was privately provisioned and matched to the protected runtime file, with current inspect receipts under tracking/evidence/cloud-logo-verifier/. Snapshot observations retain their actual times; no auth/business/media fixture was seeded.

Canonical owners: public.clients, public.projects, public.project_memberships, public.client_memberships and public.app_capability_grants; real principal identity is managed auth.users.id UUID. App extensions are private eps relations. Supabase getUser verifies the acting user; curated eps_* RPCs derive the same JWT identity and enforce capability plus resource scope. The typed adapter uses a publishable key and actual user token, never a service-role key. Exact objects/columns/keys and pending future cast fields: contracts/database/central-schema-map.yaml.

Managed auth grantability was inspected in cloud and matched locally: postgres cannot grant Auth schema/function privileges directly, but has ADMIN on authenticated. The reviewed forward fix uses one-way INHERIT=true, SET=false, ADMIN=false membership for the private nonlogin API owner. Existing auth owners/RLS remain unchanged. Source/receipts preserve the original failed grants and PL/pgSQL alias failure, corrected through immutable forward migrations.

## Actual application serving and authentication

- Central development app runs at http://127.0.0.1:3000 via npm.cmd run dev:central. Actual anonymous browser/API checks passed; fixture endpoints return403 and internal data returns401. Desktop/320px captures: tracking/evidence/cloud-foundation/.
- Real public Auth settings read returned200 with email enabled, signup enabled and confirmation required. Only the development site URL and exact callback allowlist were updated after reviewing a two-field config diff. No email, user or session was created by that setup.
- First Producer identity is pending the owner's email response and actual human sign-in. No automatic first-user producer grant or invented real project exists. Authenticated production writeback/user journey is not yet claimed.
- Central logo storage/verification code and schema are implemented and locally tested. Uploads remain disabled with available_purposes=[] pending actual user-JWT transfer/immutability checks. Ready metadata/content, cancellation and completed replay work independently of upload verifier availability. Explicit client-default reuse is implemented and fixture-browser tested. No real cloud image bytes are stored or claimed.
- Fixture mode remains development/test only and is denied by production/staging guards. npm.cmd start intentionally refuses release while required acceptance is unfinished. No app deployment or production serving occurred.

## Local runtime and tests

Original pack had no application or Git history. A local Git repo and npm workspaces now contain Next web/API, shared domain, central adapter, isolated jobs/integrations and document-worker modules. No remote/push exists.

Pinned/observed: Node24.18.0, npm11.16.0, Next16.4.3, React19.3.1, TypeScript6.0.3, ESLint10.13.0 with compatible direct plugins, AJV8.20.0, Sharp0.35.5, Playwright1.64.1, SupabaseCLI2.122.0, supabase-js2.118.0 and SSR0.12.7. Official documentation/registry and installed APIs were checked; package-lock.json is authoritative. Initial TS7 compiler-API lint incompatibility and plugin peer mismatch were corrected.

The dedicated owned local Supabase PostgreSQL container publishes only127.0.0.1:55433. Its official image digest, target/volume/network/system-ID checks, local-only prerequisite adaptations and immutable receipts are under development/local-db/. Real role/RLS/canonical mutation/rollback tests and three pairs of distinct SQL-session races pass; timestamps demonstrate overlapping starts and transaction lock waits. Reviewed fixtures were cleaned. Actual Node compact receipt bytes also passed the SQL finalizer and rolled back completely. npm.cmd run test:db runs that guarded suite. No reset/seed/cloud connection is supported by this runner.

The earlier CLI-local eps-local-dev attempt failed an IPv6 binding probe and was stopped with backup retained. Its old config is preserved in development/local-db/historical-supabase-cli-config.toml. Root supabase/config.toml is now the enabled authoritative cloud migration source with seeds disabled; the user's ignored .temp link remains intact. Never run local reset/seed/start in the linked root.

Synthetic browser tests run on dedicated127.0.0.1:3100 with a separate build directory/state, leaving central mode independent. The full local check recorder is tools/verify_local.py. The later read-only/reuse runtime checkpoint passes 80 application tests, four browser/HTTP journeys and build, with lint/typecheck separately passed. Tests distinguish fixture SDK transport from actual synthetic binary parsing and actual PostgreSQL/HTTP/browser execution. Auth network traces are disabled; earlier signed fixture traces are retained privately under ignored .local/ with sanitized hash receipts.

## Providers, hosting, native worker and release gates

- OpenAI official SDK7.45.1 strict extraction adapter is implemented/tested with injected transport. Server key, evaluated model, representative files and a real request remain unavailable/unverified; no model is hardcoded.
- n8n project discovery at 2026-10-28T03:58:29Z again returned connector MCP-32603. No workspace/workflow IDs are confirmed. The scoped dispatch adapter has deterministic tests; no workflow execution occurred.
- Vercel read-only project search for Everyone returned zero matches in its default authenticated scope. Other teams/names may exist; no vendor/account/deployment was selected or provisioned.
- @eps/jobs provides tested transactional repository/fencing/outbox/retry contracts; persistent central jobs and scoped scheduler/service bindings are not implemented.
- Document worker: PDF.js6.4.299, Mammoth1.13.0 and Yauzl3.4.0 parse actual synthetic UTF8/DOCX/PDF files. No worker HTTP/runtime isolation, scanned-PDF vision or legacy DOC conversion is claimed. FFmpeg/ffprobe remain absent from PATH; media/render container, real sizing and native processing are pending.
- MCP SDK/protocol/delegated OAuth and intended Claude clients remain implementation/test gates. No MCP endpoint or completed parity is claimed.
- Everyone SVG/logo/tokens are reused. Six required font binaries/licenses, approved presentation template and authorized representative real specs/videos are missing. System fonts remain fallback; screenshots are not approved template/font acceptance.

Production remains unverified: actual Producer/project flow, verified central private uploads, real OpenAI+n8n+worker, rendered immutable PDF, guest delivery, Claude parity, sizing, restore and deployment evidence are still required.
