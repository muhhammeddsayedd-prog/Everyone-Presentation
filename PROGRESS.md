# Development progress — Everyone Presentation Studio

**Last updated:** 2026-10-28 · **Pack:** 1.0 · **Current milestone:** M01 — in progress

**Current reality:** M00 is verified for the owner-confirmed canonical Supabase system. Five reviewed M01 migrations are applied/read back locally and in cloud; 18 scoped RPCs, 13 forced-RLS app relations and the private branding boundary remain intact. The requested Dummy Test / Dummy Client records now exist. Producer grants await an actual confirmed sign-in. The central dev server was restarted with the private verifier and development upload flag; signed-in Storage acceptance remains unrun. Local DB proof now includes 21 stages and three race pairs, plus a separate 24-action bootstrap rollback. The earlier application checkpoint has 80 tests and four fixture browser journeys; it is not live-user proof. M02 has isolated components; the production app is incomplete.

The machine-readable status mirror is [tracking/progress.json](tracking/progress.json). Update this file and that file together whenever work status changes. Evidence fields must describe actual work only.

## Milestone board

| Milestone | Status | Implementation commit/artifact | Required evidence | Blocker / next action |
|---|---|---|---|---|
| M00 Discovery and contracts | verified | tracking/discovery/; central-schema-map.yaml | Actual new canonical ownership/auth/history, guarded local replay and provider capability inventory | Continue M01; future provider/release gates remain explicit |
| M01 Foundation, project and logo | in_progress | apps/web/; packages/domain/; packages/central/; 5 applied migrations | Real cloud schema/readback and local role/race proof; synthetic full UI plus central anonymous UI | Finish scoped central uploads and actual Producer/project journey |
| M02 Specs, roles and first durable pipeline | in_progress | packages/jobs/; packages/integrations/; apps/worker/ | Isolated rule/adapter/parser tests; no persisted central jobs, workflow or specs UI | Connect transactional repository, scoped assets/services and editable specs slice |
| M03 Media, library and video processing | not_started | None | Real uploads/transcripts/frames; reuse/duplicate handling; independent failures | Depends on M02 |
| M04 Assignments and final review | not_started | None | Selection/Shortlist rules; one-Main concurrency; edits/confirmation | Depends on M03 |
| M05 Template, versioning and PDF | not_started | None | Frozen manifests; real viewer/PDF; historical media; render recovery | Depends on M04 |
| M06 External review and delivery | not_started | None | Latest-ready scoped links; guest feedback; link-scoped PDFs; expiry/revoke | Depends on M05 |
| M07 API/MCP and production readiness | not_started | None | Real Claude parity; live integrations; restore/deploy evidence | Depends on M06 |

## Allowed status transitions

`not_started → in_progress → implemented_unverified → verified`.

`in_progress` or `implemented_unverified → blocked` when a required dependency is unavailable; record the prior state and work still possible. `verified → in_progress` when a later change invalidates acceptance. A milestone with any unrun required integration check cannot be `verified`. Documentation corrections alone do not change implementation status.

## Session log (append newest first)

### 2026-10-28 - Owner test records created; scoped logo capability enabled

- Created and read back the explicitly requested canonical Dummy Test project and Dummy Client through a reviewed bounded setup tool. No Auth user, workspace or media was created. The supplied email remains private; the readback found zero matching Auth principals, so Producer grants remain pending human sign-in. See `tracking/discovery/PRODUCER_BOOTSTRAP.md`.
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

- Producer email and test project/client details were supplied; the requested canonical records now exist. Actual confirmed account sign-in and scoped grants remain pending. Sign-in runs at http://127.0.0.1:3000/projects.
- The scoped capability forward fix is applied and the central dev process enables verification. Actual authorized Storage HTTP context, immutable signed transfer and reload acceptance remain unrun; no real image bytes are stored.
- n8n project discovery still returns MCP-32603. Real OpenAI key/model evaluation, worker/service jobs, representative real material, approved fonts/template, hosting and intended Claude clients remain later integration/release gates.
- The local PostgreSQL target is now proven and isolated; the historical failed CLI-local attempt is retained. Never reset/seed the linked root.
