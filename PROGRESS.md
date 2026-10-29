# Development progress — Everyone Presentation Studio

**Last updated:** 2026-10-29 · **Pack:** 1.0 · **Current milestone:** M01 — in progress

**Current reality:** M00 is verified; M01/M02 remain in progress; M03-M07 have not started. Twelve coordinated migrations are applied locally and to the canonical Supabase project. Dedicated n8n WF01 and a narrow SCRAM/TLS local worker completed two actual signed-in pasted-text jobs through OpenAI (2972 and2970 tokens): three roles/five slots, original Arabic/UTF8 retained, earlier generated records archived, and no duplicate facts. Queued cancellation and browser reload before local worker relaunch passed. PDF/DOCX private intake, immutable document preparation and guarded ordinary replacement are implemented and locally proved; their real app/Storage tests are blocked by missing Chrome extension file URL access and unavailable native file-picker control. Worker availability-only startup retries and safe diagnostics are implemented; v4 is locally running, while earlier intermittent failure cause remains unconfirmed. Full M01 logo/Storage, HTTP/MCP and production acceptance remain separate; hosting stays deferred.

The machine-readable status mirror is [tracking/progress.json](tracking/progress.json). Update this file and that file together whenever work status changes. Evidence fields must describe actual work only.

## Milestone board

| Milestone | Status | Implementation commit/artifact | Required evidence | Blocker / next action |
|---|---|---|---|---|
| M00 Discovery and contracts | verified | tracking/discovery/; central-schema-map.yaml | Actual new canonical ownership/auth/history, guarded local replay and provider capability inventory | Continue M01; future provider/release gates remain explicit |
| M01 Foundation, project and logo | in_progress | apps/web/; packages/domain/; packages/central/; 6 M01 migrations applied | Real cloud schema/readback and local role/race proof; synthetic full UI plus central anonymous UI | Finish scoped central uploads and actual Producer/project journey |
| M02 Specs, roles and first durable pipeline | in_progress | Local/cloud12, dedicated live WF01, private file intake/runtime, source/manual/Processing UI | Real signed-in pasted/relaunch OpenAI jobs, retained and archived provenance, queued cancellation; local file/parser/SQL and controlled UI proofs | Enable browser file attachment, run real PDF/DOCX/invalid-file and pending-edit protection checks; hosting deferred |
| M03 Media, library and video processing | not_started | None | Real uploads/transcripts/frames; reuse/duplicate handling; independent failures | Depends on M02 |
| M04 Assignments and final review | not_started | None | Selection/Shortlist rules; one-Main concurrency; edits/confirmation | Depends on M03 |
| M05 Template, versioning and PDF | not_started | None | Frozen manifests; real viewer/PDF; historical media; render recovery | Depends on M04 |
| M06 External review and delivery | not_started | None | Latest-ready scoped links; guest feedback; link-scoped PDFs; expiry/revoke | Depends on M05 |
| M07 API/MCP and production readiness | not_started | None | Real Claude parity; live integrations; restore/deploy evidence | Depends on M06 |

## Allowed status transitions

`not_started → in_progress → implemented_unverified → verified`.

`in_progress` or `implemented_unverified → blocked` when a required dependency is unavailable; record the prior state and work still possible. `verified → in_progress` when a later change invalidates acceptance. A milestone with any unrun required integration check cannot be `verified`. Documentation corrections alone do not change implementation status.

## Session log (append newest first)

### 2026-10-29 - Private document boundary released; live cancellation and queued recovery observed

- Applied additive11/12 once after source-hashed local assertions and exact cloud dry-run. Fresh [cloud12 readback](tracking/evidence/cloud-specs-assets/2026-10-29T00-58-48-399742Z-cf9b507d-readback.json) preserved prior business/source/media/Storage records and catalog authorities. Original failed/unconfirmed10/11 validation receipts remain unchanged, with bounded read-only reconciliation beside them.
- Provisioned one independent private document-verifier key and activated exactly three readiness flags plus the existing worker's one file-executor membership. Actual [file-mode credential/TLS/ACL proof](tracking/evidence/m02/specs-runtime/2026-10-29T01-08-47-128Z-files-authenticated-gateway.json) verifies ten operations/three groups and denies table/Auth authority. No new Auth identity, service-role credential, public listener or hosted worker was introduced.
- Actual [queued cancellation](tracking/evidence/m02/live-specs-cancellation/2026-10-29T01-14-20-624210+00-00-111d53b2-metadata.json) retained all three roles/five slots and made zero stage/provider attempts. The first real Producer received only the previously absent operations.retry capability under existing project-write access; inactive/revoked grants were not reactivated.
- Actual [queued-before-worker-relaunch processing](tracking/evidence/m02/live-specs-restart/2026-10-29T01-20-45-384033+00-00-7529509b-metadata.json) completed three delivered n8n stages and real OpenAI2970tokens after browser reload. New three roles/five slots have current origin IDs; old three/five are archived with evidence retained. This is not a database-restart or in-flight expired-lease proof. Subsequent intermittent gateway failures are separate from the completed job and are being diagnosed.
- [Current check scopes](tracking/evidence/m02/specs-file-checks/README.md) retain the263 full-suite module check,19 controlled file/source UI journeys and root-observed build/production-denial/53-skill checks. Later worker observability/recovery changes have separate checks. Neither intercepted UI nor native parser fixtures prove actual uploaded-file Storage/OpenAI acceptance.
- Browser advertises real file intake, but attachment failed because the ChatGPT extension lacks file URL permission; the Windows native control pipe is unavailable. The owner was asked to enable that setting or attach the prepared files manually. No file job or successful Storage gate is fabricated. Untouched generated facts remain preserved for those tests. Hosting remains deferred.

### 2026-10-29 - Real specs workflow and app acceptance resumed

- Owner explicitly requested finishing specs with real OpenAI and testing through the app, while hosting stays deferred. Resumed from clean792800f; prior local/synthetic proofs remain separate.
- Planned path: real narrow credentialed canonical DB connection, outward n8n routing, local native/OpenAI daemon, persisted status/fact loading, real signed-in browser acceptance and document purpose/storage flow. No reset/seed, forged user or service-role fallback.
- Ownership: domain PG adapter and forward schema; worker runtime/n8n router; UI status and browser fixtures; root cloud/provider orchestration, private provisioning and actual app acceptance.

### 2026-10-29 - Local source persistence and native pipeline proved

- Commits: UI `6ac2ada`, provider scalar guard `cac474f`, retained pipeline/proof `2e38b6d`.
- Implemented the pasted-source form, same-key retry after unknown outcomes, fresh-version reload, dirty-edit protection and persistent job links. New7 controlled source journeys and existing7 specs/order journeys pass; final1440/320 views were inspected. These are intercepted browser fixtures, not hosted Auth/Storage.
- CLI-generated `20261028222030_m02_specs_pipeline.sql` (SHA1e5319bb...) is applied **only locally**. It retains immutable exact UTF8 inputs per job, original extraction/role origin IDs and working facts across correction/configuration changes. Initial apply rejects changed/nonempty working drafts; old queued/running work becomes INPUT_CHANGED without overwriting facts. Exact authorized ACK replay remains available while processing is paused.
- Corrected candidate rollback tracking/evidence/m02/specs-pipeline-candidate/2026-10-28T22-23-06-800Z-0b783b98-rollback.json and persisted10 assertions tracking/evidence/m02/specs-pipeline-local/2026-10-28T22-41-11-276Z-491d3795-rollback.json pass. The initial broad manual-response privacy assertion and the promotion ACL-equality failure remain failed. Read-only tracking/evidence/m02/specs-pipeline-local-reconciliation/2026-10-28T22-39-25-741Z-ff19e860.json verifies only17 reviewed EXEC additions across13 old helpers and releases the exact dead-owner lock; no reapply/reset or original receipt rewrite.
- Actual logging tracking/evidence/m02/native-logging/2026-10-28T22-52-38-127Z-5128e4cc.json and native tracking/evidence/m02/native-executor/2026-10-28T23-00-53-971Z-c26f43c2.json pass. Real parser/adapter/SQL use separate commits; BOM/CRLF/UTF16 maps/hash match, duplicate callbacks do not duplicate facts, source correction protects manual facts, cancellation blocks late publication, and actual restart preserves/reclaims/fences leases. Two concurrent client claims have one winner; server lock overlap is unproven. All fixtures/test login/defaults/catalog/row digests/counts and HBA are restored.
- The first logging run failed before any private bind because socket peer mapping rejected the custom role; cleanup passed. The observed container loopback uses TRUST. The final fixed nobody/direct-role path tests authorization only, with credential authentication explicitly false. No HBA/Auth/provider configuration changed. Malformed JSONB casts stay inside the safe handler; provider NUL/lone surrogates fail with one safe RESULT_INVALID callback before SQL.
- 195 module tests (85/5/12/18/34/41),26 operational tests, full/scoped lint, typecheck, isolated production build and production fixture denial pass. All53 project-local skills validate with zero errors/warnings. No paid provider/cloud call or hosting selection occurred. M01/M02 remain in progress.

### 2026-10-29 - Local persistence and source intake resumed

- Resumed from clean2da44cf and the actual9-version/candidate proofs. Existing migration bytes, completed enrollment, private keys, unrelated records and historical failures stay preserved; hosting remains deferred by owner choice.
- Planned acceptance: immutable per-job source/provenance with ordinary correction, combined local rollback then coordinated persistent local history, actual native/SQL paragraph+hash+result integration, source/publication/revocation races and restart recovery, plus controlled source-form intent/dirty/stale behavior. No local fixture will be described as live n8n/hosted Auth/Storage.
- Parallel ownership: domain retention/SQL candidate; native executor integration transport/harness; source intake UI. Root coordinates migration/history, DB execution, independent review and final evidence.

### 2026-10-28 20:46Z - Initial three-stage SQL rollback proof

- [Actual stage rehearsal](tracking/evidence/m02/specs-stages-candidate/2026-10-28T20-46-58-625Z-a863a766-rollback.json) passes prepare/extract/apply, exact private source/metadata checks, current authority, leases/replay/recovery/cancel, manual-edit preservation and fault atomicity. The owned backend settled and full catalog/all counts restored, including the local-only Auth-RLS fixture setup. Nine applied versions remain unchanged.
- All earlier failed attempts remain failed: object property-order preflight mismatch, local Auth fixture grantability, ambiguous SQL local references and missing workspace verification-column SELECT. These were corrected without weakening authority or expected effects.
- Final source seals: candidate35214cb1, assertions1ac2fff7 and runner4fb9ca57. This is one SQL transaction using synthetic fixtures; no persistent kernel, concurrent sessions/restart, native executor coupling, provider, authenticated gateway or n8n flow was tested by it. Full M02 remains in progress.

### 2026-10-28 20:28Z - Local source/executor and container checkpoint

- Committed database9/release proof8c514a7, pasted-source/SDK hardening527fa79 and source facade/native executor da77ab4. [Current code proof](tracking/evidence/m02/provider-validation/checkpoint.json) records188 module tests (81 unit/server,5 contracts,12 jobs,15 integrations,34 worker,41 central), typecheck/build/production denial,15 offline configuration tests and325 strict pack checks. A lint-only prefer-const failure is retained; full lint and12 executor tests pass after correction. No newer browser journey is claimed.
- [Actual submit rehearsal](tracking/evidence/m02/specs-submit-candidate/2026-10-28T20-10-13-695Z-350ca6d9-rollback.json) passed initial exact text/job/outbox/cache/audit behavior and9 suppressed-write failures in one owned-local rollback, with full catalog/all counts restored. This does not prove persistence, races, provider or source replacement. Stage/apply kernel remains an unapplied candidate.
- Executor review caught and fixed SQL response/token mismatches, hung gateway cancellation and lease expiry during source fetch.12 executor tests cover actual isolated text parsing plus synthetic gateway/provider responses. No runtime service credential or fake source asset was provisioned.
- Fresh [Auth grantability](tracking/evidence/m02/provider-access/stage-auth-boundary.json) and [policy catalog](tracking/evidence/m02/provider-access/stage-auth-policies.json) reads changed no rows/permissions. The narrowly reviewed private boolean Auth helper exception is documented in DECISIONS; candidate proof is still required.
- Owner chose local container testing; hosting stays undecided. Commit4440d31 and the final [parser receipt](tracking/evidence/m02/document-container/2026-10-28T20-25-30-385Z-181a29f5.json) pass7 real parser cases; [targeting checks](tracking/evidence/m02/document-container/2026-10-28T20-25-50-772Z-preflight-negatives.json) pass3 negatives. All owned containers were removed. These remain one-shot native preparation/cleanup proof. No n8n/gateway/full worker or production claim follows.

### 2026-10-28 19:33Z - Ninth cloud release and one real synthetic provider evaluation

- Migration9 `20261028184145_m02_role_order.sql` applied locally/cloud with SHA256 `14f96c7e635fe46cb11393a881bca26068d696c32f5e454df8655299702b1efa`. [Actual apply](tracking/evidence/cloud-role-order/2026-10-28T19-23-27-369394Z-bc35d553-apply.json) and [independent readback](tracking/evidence/cloud-role-order/2026-10-28T19-31-14-242836Z-dc97d5dc-readback.json) passed:32 public RPCs/60 routines/19 forced-RLS tables, preserved prior catalog/source/spec/role/slot/preferences/workspace digests and base counts. Fresh advisors report 33 WARN (32 curated definers plus unresolved Auth leaked-password protection); anonymous new-RPC401/42501 proves lookup/denial only.
- Current nine-version local evidence: [full DB25 stages/three pairs](development/local-db/receipts/2026-10-28T19-03-28-322Z-test-db-summary-499067f3.json), [jobs29/six pairs/restart](tracking/evidence/m02/local/2026-10-28T19-05-03-586Z-35d591fb.json), [manual24/four pairs](tracking/evidence/m02/specs-local/2026-10-28T19-06-45-233Z-5698a461.json), [order23/four sampled blockers](tracking/evidence/m02/role-order-local/2026-10-28T19-02-20-589Z-b9d09e55.json) and [eleven replay cases](tracking/evidence/m01/replay-scope/2026-10-28T19-09-29-124Z-fixed.json) passed with strict cleanup. Earlier8 backfill/driver failures remain dated history.
- [Presence at 19:07](tracking/evidence/m02/provider-access/2026-10-28T19-07-58-393Z-presence.json) and [read-only access at 19:08](tracking/evidence/m02/provider-access/2026-10-28T19-08-27-697Z-read-only-access.json) supersede the earlier blank-field observation: both APIs HTTP200 and the selected model available. No credential values are recorded. [One actual synthetic OpenAI evaluation](tracking/evidence/m02/provider-evaluation/2026-10-28T19-31-30-526Z-0cfe7e61.json) passed at 19:31:30; requested/resolved `gpt-6.1-sol`,1413 input/1575 output/2988 total tokens, three roles/five slots and validated source evidence/nulls. No DB apply, cloud business write, n8n call or full pipeline acceptance.
- [n8n API discovery at 19:32](tracking/evidence/m02/provider-access/2026-10-28T19-32-50-135Z-n8n-discovery.json) found a personal project with name unrecorded and unrelated inactive W05 Workspace Language Presentation. No workflow was changed/run, no Drive connector reused; Studio WF-01 still needs implementation. MCP still returns -32603.
- The c2df325 checkpoint below (159 module/19 controlled browser/15 offline tests) remains historical. Later [provider-validation](tracking/evidence/m02/provider-validation/) actually passed 170 modules (80 unit/server+5 contracts+12 jobs+15 integrations+22 worker+36 central), lint and typecheck before the latest submit facade changes. Post-facade broad validation remains pending; no newer browser/build result is claimed. Actual source persistence/stages/service identity/document outputs/n8n workflow/worker host remain unfinished. Milestone statuses are unchanged.

### 2026-10-28 - Processing views, role-order controls and parser process

- Committed `c2df325`: durable job list/detail with cursor/status filters, safe stage/error labels, current-scope destination links, serial polling/deadlines, frozen retry intents and stale cancellation reload. Retry/cancel controls require the existing operations.retry capability; no new grant was issued. Empty central state stays quiet; fixtures explicitly do not simulate jobs.
- Added exact role-only reorder domain/SDK/HTTP/UI against the existing PUT workspace order contract. It fetches a stable complete role list and current workspace version, protects unsaved edits and preserves uncertain write intent. Slot/assignment order maps remain an explicit503. Local candidate rollback at 18:38:43Z passed exact catalog/count restoration; migration9 is prepared, not yet claimed applied. Its persistent races and cloud release are the next gates.
- Document preparation now defaults to a fixed separate Node24 process for reserve/write/verify publication. Actual synthetic PDF/DOCX/text tests cover cancellation, deadline/reuse and two-child admission; the parser preserves source hashes/evidence and enforces10k paragraphs. Heap/deadline/pipes are bounded, but no OS sandbox/RSS/CPU/egress or live worker service is claimed.
- Actual integrated source checks: 159 module tests (77 unit/server,3 contracts,12 jobs,14 integrations,17 worker,36 central),19 controlled browser journeys,15 injected configuration/provider-inspection tests, lint/typecheck/build and production fixture denial passed. Node warnings remain in retained logs; no real Auth/Storage/provider request occurred in those tests. Evidence: tracking/evidence/m02/extended-validation/.
- At the owner's request, created ignored `.env.worker.local` with blank OpenAI/n8n fields and confirmed Git exclusion. Added fixed bounded private loader and read-only provider inspection utility; neither selects a model, generates content, executes a workflow or restores MCP. The actual presence check still found all four fields empty. No credential value is in source/tracking/chat. Official model/API documentation is checked; live credentials and evaluation are pending.

### 2026-10-28 18:23Z - Manual specs persisted and editor connected

- Applied immutable migration8 `20261028172320_m02_manual_specs_draft.sql` through the separately sealed seven-to-eight release helper. Exact dry-run, apply and independent 18:21:07Z readback passed:31 public RPCs,58 inspected routines,19 forced-RLS app relations. Existing business/Storage counts and workspace-version/branding digest are unchanged. One pristine empty Spec was backfilled for the existing workspace; no role, source, job, identity or provider was fabricated.
- The initial real local7-to8 application/backfill passed its bounded checks, then the driver rejected an inner PL/pgSQL END as transaction control. The failed receipt remains failed. A driver-only repair and truthful already-applied8 rerun passed23 manual stages,21 column-update denials plus insert/source boundaries and four actual sampled blocker pairs. Full M01, queue/restart and replay suites then passed against8 with strict cleanup.
- Specs HTTP/SDK and editable requirements/roles/slots are connected. Unknown headcount remains null with one provisional slot; count reduction requires explicit retired slots. Original multilingual wording/arrays survive unrelated edits. Save failures preserve edits, uncertain create retries reuse the same key/body, and stale edits require explicit reload. Assignment retirement/Undo remains gated until its later integration.
- Latest checkpoint:139 module tests, lint/typecheck/build, seven controlled browser journeys and18 offline release tests pass. Browser tests use synthetic API responses and contain no real Auth/Storage/provider proof; 320/768/1024/1440 layouts were checked. New-RPC anonymous HTTP returns401/42501 (schema lookup resolves), without sign-in, user JWT, cache notification or business payload logging.
- Fresh cloud advisors:32 WARN,31 intentional scoped authenticated-definer RPCs plus unresolved Auth leaked-password protection. No Auth/billing change. n8n read-only discovery at 18:16Z still returns MCP-32603. Current grants stay at four M01 capabilities; no service/login/key was provisioned. Role-only ordering and durable Processing views are the next independent work.

### 2026-10-28 - Development resumed; durable jobs and post-lock authorization

- Owner reported working sign-in/project access, then closed all review tabs. Live signed-in browser/Storage proof remains pending; no more email requests or review tabs were opened.
- Applied local forward migrations `20261028162702_m01_replay_scope_refresh.sql` and `20261028162800_m02_jobs_outbox.sql`; original five bytes preserved. Cloud release remains pending this entry.
- Actual local replay regression reproduced10 cached-response disclosures and one already-protected path before the fix; fixed11 cases, legitimate closed-state replays, exact advisory waits/distinct backends and strict cleanup pass. Retained the two initial harness failures.
- M02 local proof passed27 stages, six backend pairs, committed-lease survival across graceful same-volume PostgreSQL restart, old-token rejection and strict cleanup. Full M01 regression passed23 stages/three race pairs/both cleanups. These are SQL/catalog tests, not hosted Auth/Storage or providers.
- Added user-scoped jobs HTTP mapping and neutral specs draft/slot planning;120 module tests, lint/typecheck/build and four fixture browser tests pass. Specs persistence candidate is being developed separately; no fake jobs or extracted facts are shown.
- Evidence: `tracking/evidence/m01/replay-scope/`, `tracking/evidence/m02/local/`, `tracking/evidence/m02/http/`, `tracking/evidence/m02/validation/`. n8n lookup still returns MCP-32603; required provider/runtime configuration is absent.

### 2026-10-28 - Final Auth/probe validation seal

- Final module suite passes104 tests; ten probe tests include permission-hidden404/no-effect semantics and rejection of transport500 bodies masquerading as403/404/409. Fresh authenticated checksums bracket every Ready mutation attempt. Eight Auth tests include safe code mapping and deterministic SSR callback-error rendering. Lint/typecheck/build pass; four fixture browser journeys pass separately. No authenticated Storage execution, rate-setting change or agent email request occurred.

### 2026-10-28 - Scoped account access granted; sign-in recovery and probe prepared

- Actual Auth inspection14:09 and bounded grant/readback14:10 completed for the owner-supplied account. Fresh scoped14:54 metadata confirms the four M01 capabilities and both writable memberships; canonical names/versions remain unchanged, with no test-project workspace/upload/Ready logo at that observation. No Auth user, workspace or media was created by these operations.
- Improved safe Auth error messages without exact-reset guesses or automatic resend; deterministic server snapshots cover the callback-error UI. The controlled recovery screen was observed in Chrome, with extension warnings separated. No email or Auth/rate configuration action was performed by the agent.
- Added independently reviewed, development-only cookie-scoped Storage probe. Eight injected-transport SDK/Sharp/HMAC tests pass, including no-effect delete handling and denied-after-write checksum detection; no service-role or arbitrary network/storage targets. Current process30061 enables the probe. Actual HTTP anonymous401, bearer403 and foreign-origin403 pass. No signed-in Storage probe has run.
- Current root suite:102 module tests, lint/typecheck/build PASS, four separate synthetic browser/HTTP journeys PASS. Build output was isolated from the running central app. Exact logs and boundaries: tracking/evidence/m01/signed-in/validation/ and tracking/discovery/M01_SIGNED_IN_CHECKPOINT.md.
- Owner-reported other-Chrome login is distinct from connected Person1 session: that profile remains logged out after email429. Reopen an existing session or complete same-profile email sign-in when available, then perform the actual M01 workspace/logo journey. M01 is not verified; M02 remains an isolated candidate and n8n access still fails.

### 2026-10-28 - Real Producer identity scoped; connected browser acceptance pending

- Actual read-only inspection at 14:09:34.372709Z found one confirmed, previously signed-in, nonanonymous, nondeleted, nonbanned principal. The reviewed grant action at 14:10:07.994212Z completed and read back exactly active `projects.read`, `projects.write`, `workspaces.read`, `workspaces.write` plus writable membership for Dummy Test / Dummy Client. It wrote no Auth user, workspace or media. Exact receipts: `tracking/evidence/m01/producer-bootstrap/2026-10-28T14-09-59-341574Z-inspect.json` and `2026-10-28T14-10-26-482481Z-grants.json`. Prior zero-account observations below remain historical.
- The owner reports signing in in another Chrome. Connected Chrome Person1 remains logged out; its login attempt received a generic HTTP429 email throttle response. Read-only Auth configuration metadata at 14:17:24.131722Z confirms `auth.email.max_frequency=1m0s`; the CLI exposes neither SMTP configuration nor project email quota in this check. No rate/Auth setting was changed and no email was sent by the agent.
- M01 remains `in_progress`. Auth error/recovery UX and a safe development logo acceptance probe are under implementation by other agents; the probe has not been enabled or run. Next: establish the verified user's session in the connected browser, then exercise canonical project/workspace operations and hosted private Storage using the already-completed scoped grants. No bootstrap recreation/regrant is required.

### 2026-10-28 - Isolated M02 job/outbox candidate rehearsed

- Added private job/event/outbox candidate DDL, user-scoped get/list/retry/cancel facade and six adversarial SDK tests. No sixth root migration or cloud/service identity was created. The candidate is deliberately unexported/unwired and is not a fake multi-RPC transaction repository.
- Independent review fixed nullable reason parity and consistent JOB-before-OUTBOX lock order. Root's exact-byte rollback rehearsal passed at08:24:38Z, restoring five migration versions,30 app policies, zero candidate tables/roles/functions and zero fixture counts. Atomic outbox failure, dedupe, denied scopes, lease expiry/stale ACK, retry/cancel budgets and revoked replay are covered. Real two-session/restart/stage/provider/UI proof remains unrun.
- The first rehearsal failed before DDL because a harness replacement string changed PostgreSQL dollar delimiters. The failure is preserved; callback substitution fixed the harness, the successful composed SQL digest is recorded, and candidate bytes were unchanged.
- Current npm module suite passes86 tests, with lint/typecheck pass; evidence is in tracking/evidence/m02/candidate/. Operational Python checks pass20 tests (14bootstrap,3release recovery,3source privacy exception). A known-private-material scan preserves the unchanged supplied design reference's existing business contact under an exact-file-hash exception, while refusing any verifier key or new setup identity copy.
- M01 code/setup checkpoint: b85ee32. At this checkpoint, the actual private-email inspection at08:30:14Z found0 accounts; the requested canonical test pair was ready with no grants/workspace/media. Sign-in and hosted Storage gates were pending; the later14:09/14:10 enrollment evidence is recorded above.

### 2026-10-28 - Owner test records created; scoped logo capability enabled

- Created and read back the explicitly requested canonical Dummy Test project and Dummy Client through a reviewed bounded setup tool. No Auth user, workspace or media was created. The supplied email remained private; this initial readback found zero matching Auth principals, so Producer grants were pending human sign-in at that time. See `tracking/discovery/PRODUCER_BOOTSTRAP.md`.
- Added the fifth immutable migration `20261028072515_m01_logo_upload_capability.sql`: ordinary users see client_logo only with active workspace read/write and writable canonical project scope. Runtime decoder/signer readiness still intersects this metadata; target authorization remains enforced on every operation.
- Local full SQL suite passed21 stages, all three real-backend race pairs and both cleanups. Cloud dry-run/apply/readback passed with unchanged owner/ACL/history and business/media counts. A fresh advisor query reports18 intentional definer WARN findings; an initial extractor's unrecognized-results zero count was explicitly invalidated, not claimed as zero findings.
- Separate actual local bootstrap rehearsal passed24 action invocations and rollback/zero cleanup. Fourteen Python coordinator/guard tests and three release-evidence failure tests pass. Review fixed record recreation and deleted-grant restoration on finalized retries. Failure and recovery evidence is retained; no raw email, secret or CLI diagnostics are tracked.
- Restarted the owned central dev server (session63564) with development logo verification enabled; fresh anonymous HTTP checks pass session200/no-store, internal401 and fixture403. The attached Chrome tab shows real sign-in; its extension-injected hydration warning is recorded separately from application errors. No email was sent by the agent. Existing .env.local bytes remain unchanged.
- Fresh n8n project discovery still returns MCP-32603. M01 signed-in/Storage tests and later real AI/worker/PDF/guest/MCP/restore/deployment remain unverified.

### 2026-10-28 - Private logo foundation applied, recovery and reuse checked

- Added and applied `20261028024205_m01_private_logo_boundary.sql` after independent review, rollback-only rehearsal, role/RLS/forged-proof/expiry tests and a genuine two-backend completion race. New-key replay, narrow UPDATE lock behavior, inherited Storage ACLs and zero-row expiry transitions were corrected before freezing the applied bytes.
- Cloud dry-run/apply/readback passed under `tracking/evidence/cloud-logo-foundation/`: 18 scoped RPCs, 13 forced-RLS app relations, private 5 MiB PNG/JPEG/WebP bucket and eight restrictive/permissive Storage policies. Actual security advisors report 18 intentional scoped-definer warnings, retained with review rationale.
- Actual Node-generated compact HMAC bytes were accepted by the SQL finalizer; a changed signature failed and all synthetic fixtures rolled back. The full local SQL suite ran three distinct-backend race pairs with verified scoped cleanup.
- Added explicit canonical client-logo reuse. Ready media reads, cancellation and completed replay survive disabled uploads or missing verifier configuration. Root's current checkpoint has 80 application tests, four real fixture browser/HTTP tests and build PASS; lint/typecheck and all 53 skill integrity checks passed. Sources and exact limits are in `tracking/evidence/m01/readonly-reuse-checkpoint/` and `LOGO_RECOVERY_REVIEW.md`.
- Privately provisioned a dedicated purpose key with matching protected local configuration, without writing existing environment bytes or enabling uploads. No raw output/key is in source or receipts. The provisioning helper and launcher passed independent review; inspect confirms the matching key.
- First Producer email/sign-in and first real project/client details remain pending. A fresh n8n project-list read at 03:58:29Z still returned -32603. No fake cloud identity/project/media, live AI job, hosted byte-transfer proof or production deployment was created.
- Local source history currently includes `369a77d`, `fdf0e11` and `bf31caa`; the final code/source checkpoint is `f6164a7b1ba66e2f2ec746041c6de827bf75edb0`, with a documentation-only follow-up in Git history.

### 2026-10-28 — Verified discovery and applied canonical foundation

- Owner explicitly selected the inspected empty Everyone-Presentation project as canonical. M00 is now verified against the packet assessment in `tracking/discovery/M00_ACCEPTANCE_ASSESSMENT.md`; unknown later provider/hosting/worker/Claude checks remain visible.
- Applied and read back three immutable migrations in cloud and local PostgreSQL: `20261028010943`, `20261028013324`, `20261028013655`. Cloud readback confirms 11 forced-RLS relations, 12 user-scoped RPCs, narrow nonlogin/non-BYPASSRLS roles and no reverse privilege inheritance. Only three audience defaults were inserted; no auth/business/media fixtures were created.
- Real local role tests exposed Auth grantability and PL/pgSQL alias failures. The original bytes and failures remain retained; two additive forward migrations corrected them. Full rollback assertions and same/different-key races pass on distinct SQL backends, with observed lock waits and scoped fixture cleanup.
- Added actual Supabase SSR/user-bearer integration and central-mode sign-in UI. Public Auth readiness returned200; only the local site URL and exact callback allowlist were changed. No email was requested. The first real Producer identity/sign-in and real project remain pending.
- Actual central anonymous browser/API checks pass at `http://127.0.0.1:3000`, including fixture403/internal401, desktop and320px reflow. Dynamic private fixture paths were removed from Turbopack's source graph after a reproducible refresh loop; Node24's actual workspace loading and the final browser/build gates pass.
- Standard test commands now refuse empty test globs. The central SDK suite has seven actual fixture tests rather than an earlier miswired zero-test command. At that earlier checkpoint the full application run had60 tests and four browser/API tests, plus separate actual SQL suites/races and central anonymous smoke. These counts are not real AI/n8n acceptance.
- Current M01 is `in_progress`: private central logo storage/verification is still disabled and the first authenticated Producer/project journey is not run. M02 contains isolated tested components; M03–M07 remain unstarted. No production app deployment, PDF/guest/MCP/restore proof.
- Exact receipts: `tracking/evidence/cloud-foundation/`, `tracking/evidence/local-checks/`, `development/local-db/receipts/` and `tracking/evidence/m01/DB_CONCURRENCY.json`. Secrets/CLI linked metadata/private traces remain ignored.

### 2026-10-28 — M00 discovery, M01 local foundation and isolated M02 preparation

- Started from a specification-only folder; initialized a local Git repository and npm workspaces, preserving pack/contracts/assets/skills. No remote, push or deployment.
- Implemented 17 M01 shared domain/HTTP operations with a persistent synthetic canonical adapter: protected project listing/writeback, workspace reuse, optimistic versions/idempotency, private decoded logo transfer/metadata and audience presets. Built the six-step Everyone shell, autosave/recovery and honest pending screens. Production/staging fixture denial is enforced.
- User restored CLI access. Read-only cloud receipts identify Everyone-Presentation, `pyibofyctwnqpvktepse`, PostgreSQL 17.11, with no business relations/auth users/buckets/migration schema. Canonical-source decision was requested. No cloud writes occurred.
- Local Supabase attempt rejected unexpected IPv6 wildcard binding and stopped only owned `eps-local-dev`, retaining backup. Current linked-root guard refuses local startup/reset/seed; no migration was authored/applied. Four isolated guard checks pass.
- Added provider-independent job transaction/lease/outbox/recovery contracts, safe OpenAI strict extraction and n8n dispatch adapters, plus bounded real document parsing. These M02 components remain unconnected to central persistence, specs/roles UI and real service processing.
- Independent reviews found and corrected a session-key creation race, exact cancel/archive DTO mismatches, browser origin normalization, UI stale workspace revision/signout/placement issues, DOCX relationship-validation and ZIP CRC gaps. The retained evidence distinguishes initial failures, fixture tests, actual synthetic-file decoding and browser runs.
- Application checks and source commit are recorded in the final local evidence/handoff. Full production acceptance, PDF/guest/MCP/restore/200-file/service checks remain not run.
- Secrets: private session-bearing failed traces retained under ignored `.local/private-test-traces/`; sanitized hash/path manifest committed instead. No service keys, CLI linked metadata, real personal fixtures or tokens are included in source/evidence.
- Next: resolve canonical-source/ownership, establish an isolated local representation and coordinated migrations, finish central M01, then connect the M02 vertical pipeline. See `tracking/HANDOFF.md`.

### 2026-10-28 — Implementation started

- M00 read-only discovery and runtime inventory started. Required evidence: canonical mapping, provider access checks, local setup proof and explicit unknowns.
- M01 independent development work started: typed operations, persistent synthetic adapter, protected app/API and private logo upload. This does not verify cloud prerequisites.
- No cloud mutations authorized or performed. Supabase connection is not installed; available n8n metadata calls returned internal errors.


### 2026-10-28 — Project-local Codex skill installation

- Scope: install all supplied Claude development skills for Codex. App implementation remains not started; M00–M07 and all release gates retain their prior states.
- Installed: 53 canonical skills and all 550 source files in `.agents/skills/`; `.claude/skills/` remains unchanged. No nested duplicates or fixture skills were excluded. 71 installed files contain documented metadata, policy, path or link adaptations.
- Authority/routing: appended the Codex skills section to `AGENTS.md`; added `.agents/SKILL_POLICY.md` and `SKILLS_SETUP.md`. Confirmed requirements, central Supabase, OpenAI, n8n Cloud, separate worker, existing design and existing authorization prevail over generic upstream instructions.
- Provenance: `SKILLS_LOCK.json` pins the supplied local file snapshot with SHA256 `2d44fb85e09505e8bb55780f7158cb7efc115c3947e6661e0b60c70a5d0594c0` plus source/installed file hashes. This directory is not a Git checkout; no upstream commit or clean Git status is asserted.
- Tooling: `tools/manage_project_skills.py`, pinned validation requirements/lock and ignored `.venv-skills/`. `tools/validate_pack.py` now excludes vendored skills and the tooling environment from pack checks; the dedicated skill checker covers the installed pack.
- Validation: `python -X utf8 tools/manage_project_skills.py --report` PASS — 53 skills, 550/550 payload files, 436 local support links, zero errors/warnings. Bundled skill-creator `quick_validate.py` PASS for all 53 skills; `tracking/SKILLS_CREATOR_VALIDATION.json` records the results. All commands used `.venv-skills/Scripts/python.exe` on local Windows/Python 3.14.7.
- Existing pack: `python -X utf8 tools/validate_pack.py --strict` PASS — 325 assertions, including full JSON Schema/OpenAPI metadata validation and PostgreSQL syntax parsing. `pip check` PASS. These are static checks, not app acceptance.
- Independent review: baseline and four isolated negative cases passed (missing payload, modified installed skill, stale source and install overwrite refusal); checks did not modify the fixture copies. Review caught a mandatory cross-model pause in generic guidance; the installed copy now makes external review optional within existing authorization. Original finding and resolution are retained in `tracking/SKILLS_REVIEW.json`.
- Host discovery: an independent Codex subagent received the refreshed project skill catalog with all 53 installed entries. This confirms discovery in that session; individual workflows and bundled launchers remain unexecuted.
- Retained failure: `tracking/SKILLS_VALIDATION.initial.json` records the initial ViewTransition description error; its Codex metadata was repaired and revalidated. The initial dependency command requested unavailable `pglast==7.10`; no installation completed from that command. The resolved isolated environment uses supported wheel `pglast==7.21`.
- Side effects: no global skill/config changes, app code, cloud reads/writes, migrations, service requests, bundled launchers, hooks, deployments or commits. Downloaded Python validation dependencies into the project-local environment only.
- Next action: begin M00 using the existing milestone/context packet and relevant installed skills; inspect authorized cloud metadata read-only and record observed discovery evidence.

### 2026-10-27 — Documentation handoff

- Completed: development specification pack and initial progress structure.
- Implemented code: none; standalone prototype predates this pack and remains a UX reference.
- Executed service tests: none.
- Applied migrations: none.
- External systems changed: none.
- Next action: read M00, inspect existing repo and authorized Supabase metadata; fill discovery mapping without altering cloud schema.

### Session entry template

Copy and fill this template at the end of every implementation session:

```markdown
### YYYY-MM-DD HH:MM TZ — Mxx — concise outcome
- Starting state / ending state:
- Actor and implementation branch/commit:
- Files and operations changed:
- Migrations: exact filenames; local/staging/production status separately:
- Tests: exact command or scenario ID; environment; pass/fail/not-run; evidence path:
- Real providers used: service + sanitized request/job IDs; never credentials:
- UX/demo outcome:
- Contract or decision amendments:
- Remaining defects and external blockers:
- Next exact action and expected result:
```

## Release ledger

| Gate | Status | Evidence |
|---|---|---|
| Existing cloud schema understood and mapped | passed (M00 scope) | Owner-confirmed new canonical system; actual metadata/migration readback |
| All domain/access/migration tests | not_run | — |
| Real OpenAI+n8n+worker path | not_run | — |
| Real full UI and PDF flow | not_run | — |
| Guest expiry/revoke/version isolation | not_run | — |
| API/MCP meaningful-action parity | not_run | — |
| Representative 200-file sizing exercise | not_run | — |
| Metadata and referenced media restore exercise | not_run | — |
| Production deployment smoke test | not_run | — |

## Current blockers

- Owner-reported sign-in/project visibility and closed review tabs remain separate from the unrun full hosted M01 logo/Storage journey. Preserve existing account, keys and grants; do not send more sign-in links or reopen visible review tabs.
- Cloud migration10, authenticated service gateway, private document uploads/outputs, actual dispatcher/recovery scheduling and Studio WF01 are unrun. Local TRUST is not credential-authentication evidence. Hosting remains deferred.
- Source correction retains old evidence/manual facts; automatic publication into a nonempty working draft waits. Concurrent source/publication/revocation barriers, file/vision paths and full real-provider processing still require acceptance.
- Earlier provider access and one real synthetic OpenAI component evaluation are historical, not the native synthetic-provider run. M03-M07, representative media/fonts/template, Claude parity, PDF/guest, restore/sizing/deployment remain unfinished. Never reset/seed the linked cloud root.
