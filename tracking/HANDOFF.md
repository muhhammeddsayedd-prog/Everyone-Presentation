# Current Codex handoff

Updated after the 2026-10-28T18:21Z independent cloud readback. M00 is verified;
M01/M02 remain in progress. The production app is incomplete. This section
supersedes the historical checkpoint below; do not redo completed setup.

Eight immutable migrations are now applied locally and in canonical cloud
`pyibofyctwnqpvktepse`. Migration8 is
`20261028172320_m02_manual_specs_draft.sql`, SHA256
`8ab866a49cb2e01eabf3b83076fe4519a60255263d0a1a170ef3ba9718a2349c`.
All earlier migration bytes remain unchanged. Latest receipt:
`tracking/evidence/cloud-manual-specs/2026-10-28T18-21-07-451865Z-b7e8cd80-readback.json`.
It verifies31 public RPCs/58 distinct routine contracts/19 forced-RLS app tables,
exact source/argument/result/ACL/column/policy/role/initializer boundaries, preserved
business/Storage counts and unchanged workspace-version/branding digest. One
pristine Spec was backfilled; roles/slots/queue remain empty. No source, identity,
grant, service login or provider was fabricated. Fresh advisors report32 WARN:
31 curated definer RPCs plus unresolved Auth leaked-password configuration.

Manual specs/role/slot SDK, HTTP and editor are connected. Original multilingual
wording and unchanged arrays survive ordinary edits; unknown headcount remains
null with one provisional slot; reductions require explicit retired slot IDs.
Uncertain create retries retain the same key/body, stale edits require explicit
reload, and archive-in-flight fields are protected. Assignment retirement/Undo
still fails closed until its later adapter. No automatic extraction is faked.

Latest manual editor checkpoint:139 module tests, lint/typecheck/build, seven
controlled browser journeys,20 tool tests and18 offline release tests pass.
Logs/screenshots: `tracking/evidence/m02/manual-validation/`. Controlled browser
tests use synthetic API responses, no real Auth/Storage/provider, traces off and
320/768/1024/1440 layouts. Existing Node color warnings remain recorded. Actual
anonymous new-RPC request returns401/42501; schema lookup resolves without an
explicit notification. This is not authenticated hosted editor acceptance.

Fresh8 local proofs: M01
`development/local-db/receipts/2026-10-28T18-07-49-870Z-test-db-summary-68140882.json`
(24 stages/three backend pairs/both cleanups); queue
`tracking/evidence/m02/local/2026-10-28T18-08-57-532Z-7930ab51.json`
(28 stages/six pairs/graceful same-volume restart/fencing); manual
`tracking/evidence/m02/specs-local/2026-10-28T18-07-04-016Z-0fdcf864.json`
(23 stages/column denials/four sampled blockers); replay
`tracking/evidence/m01/replay-scope/2026-10-28T18-10-19-748Z-fixed.json`
(11 cases). Strict cleanup passed. The initial7-to8 application/backfill receipt
`tracking/evidence/m02/specs-local/2026-10-28T18-02-35-594Z-b35f9f60.json` stays
overall FAILED due to the later harness parser error. Only the driver changed;
the successful rerun truthfully says already-applied8/backfill=false. Never reset
history or relabel the failed suite. Guarded `test:db:specs` joins the existing
three shared-lock local suites; historical7-only helpers now fail closed by design.

Current implementation assignments: root commits the manual8/editor baseline;
foundation_ui owns subsequent role-only reorder domain/SDK/HTTP/SpecsView;
foundation_domain owns its SQL candidate outside root migrations/manifest;
discovery_review owns ProcessingView/StudioApp/scoped CSS and controlled tests.
Inspect their current files/status before editing or committing. Role ordering
is already contracted by PUT workspace order; exact active-ID permutation and
ordinary concurrency rules apply. No SQL9 application is implied here.

Next exact action: finish/review/rehearse role ordering and Processing UI, then
implement scoped source/text submission, stage leases/events, typed atomic draft
commit, output reservations, service identity and actual dispatcher/worker/WF-01.
Keep job-to-outbox lock order and post-wait authorization. Do not represent a
JobRepository transaction as separate RPCs. Late results must preserve edits.
Fresh18:16Z n8n discovery still returned MCP-32603; recent bounded env checks found
no OpenAI model/key or worker/service/n8n runtime configuration. Source processing,
real provider/worker, representative media, missing fonts/template, hosting,
intended Claude clients and restore remain gates. M03-M07 have not started.

The owner closed review tabs; none were reopened or sign-in emails sent. Full
hosted UI/Storage probe remains unrun. Keep real enrollment and four grants as-is;
do not recreate keys or restore removed grants. Process session30061 was the
central dev server at3000; verify its current ownership before a serving claim.
Private env/verifier/enrollment remain ignored. Preserve the bounded scanner's
historical receipt and exact inherited-design-contact exception; no new identity
copy/key is exempt. Preserve prior ZIPs before a new development source snapshot.

## Historical checkpoint before manual8 release

The remainder records the earlier seven-version checkpoint and is historical.

## Authority and canonical state

The owner chose the initially empty `Everyone-Presentation` Supabase project (`pyibofyctwnqpvktepse`, eu-west-1) as canonical and authorized the complete milestone build. Requirements are confirmed. No re-interview or routine permission question is needed. Never reset/seed the linked cloud root, invent Auth users or rerun completed enrollment to restore revoked grants.

Seven immutable migrations are applied locally and in cloud. Preserve their bytes:

1. `20261028010943_m01_canonical_foundation.sql`
2. `20261028013324_m01_identity_role_inheritance.sql`
3. `20261028013655_m01_workspace_scope_alias.sql`
4. `20261028024205_m01_private_logo_boundary.sql`
5. `20261028072515_m01_logo_upload_capability.sql`
6. `20261028162702_m01_replay_scope_refresh.sql` ? SHA256 `82a4f2ec03efc0787aa58e5f1e68ab626e5dddb5e4c645444103456757bf4251`
7. `20261028162800_m02_jobs_outbox.sql` ? SHA256 `f619b3dfb9d964ab5902d04941b8cd59b44e9da36f1ab3f7b10bd45298ff4013`

The coordinated sixth/seventh release passed exact dry-run, apply and fresh readback. Latest receipt: `tracking/evidence/cloud-processing-foundation/2026-10-28T16-56-29-737639Z-6e03dbf9-readback.json`. It binds32 routines including22 authenticated public RPCs,16 forced-RLS app relations, function signatures/named arguments/returns/source, owners/ACLs, policy hashes and narrow role inheritance. The shared idempotency helper remains SECURITY INVOKER/VOLATILE. No service login, credential, provider, workflow or identity was created by this release.

Existing business/storage counts stayed unchanged: one Auth user, client, project, workspace, media/upload record and Storage object, four active capabilities and prior setup/runtime records. The three new queue tables are empty. These aggregate admin counts do not prove Ready state, exact image bytes, a full user-JWT journey or overwrite protection. An optional later scoped metadata CLI query timed out; no Ready result was recorded or invented.

Fresh security advisors report23 WARN findings:22 intentional authenticated-definer RPC findings and one unresolved `auth_leaked_password_protection` Auth configuration item. No Auth or billing setting changed. Supabase documents that feature as Pro-and-above; entitlement/password policy must be resolved before production. See `tracking/evidence/cloud-processing-foundation/RELEASE_REVIEW.md`. Earlier18-warning/zero-business observations remain historical.

## Account, workspace and runtime

Real Producer enrollment is completed. Four M01 capabilities (`projects.read/write`, `workspaces.read/write`) and write membership to owner-requested Dummy Test/Dummy Client were actually read back. The fixed test project is `4b70c8ce-18bd-4a8c-b5a9-bc1156c06463`; client is `f4a9937c-f575-4975-bdea-fb83b85e48c3`. Do not recreate them or automatically restore removed membership. Future feature capability rollout must respect current scope and the original Producer authorization; no settings/admin grant is implied by this checkpoint.

The owner reports successful sign-in and seeing Dummy Test, then closed all review tabs. Connected Chrome Person1 was still signed out on the agent's last refresh. The agent opened no review tabs or requested another email after the closure. Do not repeatedly ask the owner to sign in while independent work can continue. A verified connected session is still needed for the full M01 browser/Storage acceptance journey.

The owned central development process was started in unified session30061 at `http://127.0.0.1:3000/projects` through `tools/dev-central.mjs`. It loads the existing protected verifier, with `CENTRAL_LOGO_UPLOADS_ENABLED=true` and `EPS_CENTRAL_LOGO_PROBE_ENABLED=true` in that child only. `.env.local` was unchanged. Standard launcher defaults uploads/probe off. The verifier's protected `.local` phase/key files must not be printed, recreated or deleted; the older provisioning helper seals a historical migration set and is not a reason to regenerate the key.

The guarded `/dev/central-logo-probe` is implemented but NEVER executed against a signed-in hosted session. It accepts only the fixed project's authorized workspace UUID, uses normal cookie identity and scoped RPCs, and targets only newly reserved unselected probe assets. It reports sanitized IDs/status/hash/dimensions only. Unsafe token mint is tested before object existence; forbidden overwrite uses distinct bytes and before/after integrity reads. Do not export cookies/tokens/HAR/traces or substitute admin/GUC impersonation for real user HTTP acceptance.

`npm.cmd run dev` is the separately labelled synthetic adapter. Fixture browser tests own3100 and separate `.next-e2e`; central serving uses `.next`. Build while central is running with `EPS_TEST_SERVER=true`. Known extension hydration warnings and Node NO_COLOR/FORCE_COLOR warnings remain distinct from app errors. Never claim zero runtime warnings.

## Code and actual evidence

Local code commits this session: `0ec0433` (post-lock M01 scope recheck), `0ef61f9` (neutral specs/slot planning), `269a35e` (jobs/outbox, scoped HTTP, release guard). There is no remote/push/deployment.

- Root module suite:120 tests passed (50 unit/domain/server,3 contracts,12 jobs,14 integrations,10 actual synthetic document parsers,31 central SDK tests). Lint, typecheck and separate-output build passed. Four synthetic browser/HTTP journeys passed with traces off. Logs: `tracking/evidence/m02/validation/`.
- Operational Python suites:20 existing tool tests plus6 new processing-release recovery tests passed. Tests block real subprocess execution and cover lost responses, partial application, failed readback, count drift and refusal to blindly retry applied/partial history.
- Full local M01 regression:23 stages, three actual backend race pairs, both strict cleanups passed: `development/local-db/receipts/2026-10-28T16-44-39-449Z-test-db-summary-fcaee673.json`.
- M01 scope regression: baseline reproduced10 cached-response disclosures and one already-protected reserve path. Fixed11 cases passed current-scope denial after exact sampled advisory waits/distinct backends, legitimate closed-state replay controls and cleanup: `tracking/evidence/m01/replay-scope/2026-10-28T16-38-40-784Z-fixed.json`. Initial two harness failures and earlier baseline proof are retained. The fixture directly seeds synthetic replay caches; no cloud Auth/Storage transfer is proved.
- M02 durable foundation:27 stages, six backend pairs, both cancellation/dispatch orderings, graceful same-volume PostgreSQL restart, committed-lease persistence, controlled expiry/reclaim and old-token rejection, strict cleanup passed: `tracking/evidence/m02/local/2026-10-28T16-43-07-185Z-63e90f8d.json`.

Use `npm.cmd run test:db`, `npm.cmd run test:db:m02`, and `npm.cmd run test:db:replay-scope` for their distinct guarded local suites. They share an exclusive test lock, reject unexpected state, preserve unrelated rows and cannot target cloud. Owned Docker PostgreSQL17.6 is fingerprinted at127.0.0.1:55433; cloud is17.11. Local Auth/Storage catalogs are explicitly simulated, not hosted HTTP services. Never use root Supabase reset/seed/start.

## M02 implementation boundary and next action

`packages/central/src/jobs.ts` is now exported and wired to `/api/v1/jobs`, job detail/retry/cancel. API origin/session/input/concurrency/idempotency rules are shared; fixtures return honest503 for unavailable durable processing. Actual anonymous401/foreign-origin403/no-store checks passed. Authenticated HTTP and Processing UI are not demonstrated by those negative checks.

`packages/domain/src/specs.ts` and shared neutral types preserve original evidence and source language, unresolved markers, stable explicit slot IDs/order, provisional unknown counts and assignment before-images. Reductions require explicit affected slots. A configurable allocation budget fails before allocation without truncating facts. These are pure plans, not persistent transactions or provider results.

A reviewed manual specs persistence candidate is being rehearsed OUTSIDE root migrations: `development/m02/specs-draft-candidate.sql` and `tests/db/m02-specs-draft-candidate.sql`. It provides manual specs/role/slot CRUD, stable empty specs backfill+initializer and coupled row versions/draft/audit effects. It has no source submit/setter or fake job. Suppressed child writes must fail atomically; ArchiveRequest nullable reason parity is covered. Assignment retirement/Undo remains an explicit later integration gate. Check the latest candidate receipt before claiming any execution; do not promote automatically from static review.

Next: finish the guarded single-transaction candidate/fixture rollback with a predating workspace backfill case, verify exact catalog/row restoration, then connect real specs source submission, source/spec FKs, stage claim/heartbeat/event/fence validation, typed atomic result apply, output reservations and scoped service identity. A `JobRepository.transaction` must never be represented as separate RPC calls. Keep job?outbox lock ordering and fresh authorization after blocking waits.

Actual n8n project discovery still returns MCP-32603. Fresh process/project-env presence checks found no OpenAI model/key, n8n webhook/secret or worker/service runtime configuration. Do not fabricate provider calls/workflow exports or select another orchestrator. Worker document parsing is a tested library, not an isolated HTTP service. Real OpenAI/n8n/worker processing, representative authorized specs/video, native FFmpeg/PDF, six missing fonts/approved template, hosting, intended Claude clients, restore and production release remain unverified. M03?M07 have not started.

## Source hygiene

Private verifier/enrollment files, `.env.local`, Supabase `.temp`, private traces and generated output remain ignored. Preserve original supplied manifests and prior source archives under `dist/checkpoints/`. `python tools/package_pack.py --check` inspects eligible source; generated source ZIP is a snapshot, never a production deployment.

`tools/check_enrollment_source.py` scans known private key encodings and the setup identity without printing them. Preserve its historical fixed-path receipt when retaining a new checkpoint. One exact unchanged supplied `Design Elements/DESIGN.md` contains the original business contact and is narrowly exempt; no new identity copy or key is exempt. Do not claim that the contact is globally absent.
