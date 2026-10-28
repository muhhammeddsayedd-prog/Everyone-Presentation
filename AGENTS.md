# Codex working instructions — Everyone Presentation Studio

## Mission and authority

Build the complete production app described in this pack, milestone by milestone. Product owner has finished the requirements interview. Use confirmed decisions and the documented defaults; do not restart the questionnaire, replace the chosen stack, add agent-only approval barriers, or quietly reduce scope to a mock.

This document pack is planning and contracts, not an existing implementation. Initial progress is Not started for every milestone. The standalone HTML in `reference/` is a UX reference with simulated AI and deliberately permissive demo navigation. It is not the architecture, data model or security implementation to copy.

If this pack is imported into an existing repository, merge these instructions with that repository's established instructions. Preserve unrelated code, migrations, data and ownership. Do not overwrite an existing AGENTS.md without reconciling it. Repo-specific release/access rules and explicit user instructions remain applicable.

## Start/resume protocol

1. Read `README.md`, `CONTRACT_BASELINE.md`, `PROGRESS.md`, `tracking/progress.json`, `tracking/DECISIONS.md`, and the latest `tracking/HANDOFF.md`.
2. Inspect repository status and the actual code. Do not trust a green checklist without artifacts/tests. Identify the first incomplete milestone and its prerequisites.
3. Read that milestone packet and its listed companion files. Run `python3 tools/assemble_context.py Mxx` to regenerate its consolidated context file from current docs/progress if useful. Do not rely on the original chat.
4. Resolve discovery dependencies from existing files/environment/authorized read-only inspection. If unavailable, continue useful isolated work and mark the external verification blocked; do not pretend a local fixture is a cloud integration.
5. Record start status and planned acceptance evidence in the progress ledger, then implement the milestone's vertical slice end to end.

## Invariants

- Existing central project before production workspace. Project/client changes go to central records. No duplicate project database or placeholder cloud identities.
- Shared library facts, selected project media/availability, slot assignment choices, slide wording and immutable generated versions are distinct concerns.
- Selection is derived from every active assignment. Shortlist is explicit. Option/Main/Backup is independent; zero/one Main per slot; one active candidate assignment per slot.
- Missing information, open slots and fewer frames are permitted. Never fabricate facts or images; use Not provided and Pending. Technical failure/access/layout overflow must be reported honestly.
- One candidate slide per included assignment; all ten fields; carousel in app, available frames together in PDF; existing brand/design adapted to that contract.
- Reviewed is factual confirmation, not casting approval. Producer/designated editors and Claude acting with those permissions can confirm it.
- Guest links expire after 30 days by default and follow newest ready version only within the same series/output/audience. Feedback stays on viewed version. External feedback shared; internal notes private.
- Every meaningful UI operation has API/MCP parity. Claude can complete the whole flow; it never receives service-role credentials or permissions beyond its acting user.
- OpenAI for embedded AI; existing n8n Cloud for orchestration; native media/PDF work in a separate worker. Database-backed jobs/outbox provide recoverability.
- No specs revision manager, fact-conflict UI, external ingestion connectors or new presentation modules in v1.

## Database discipline

M00 performs authorized cloud discovery read-only. Record actual schemas/keys/functions/RLS/migrations/auth/buckets before designing executable migrations. Prefer reusing canonical entities and fields. Develop with local Supabase and synthetic data. The supplied `contracts/database/design-reference.sql` is guarded design reference, not a runnable cloud migration.

Use one coordinated migration history for the central business database. Never run local reset/seed against a cloud target. Do not apply a migration merely because a sample SQL file exists. Follow established repository/environment release authorization; do not introduce repeated approval questions for already authorized routine work. Do not destroy/rebuild shared tables to simplify app implementation. Use additive migration/backfill/constraint steps with verified restore/forward-fix strategy and explicit environment targeting.

## Implementation standards

### Project-local Codex skills

Use the relevant supplied skills from `.agents/skills/` during app development.
Read `.agents/SKILL_POLICY.md` when applying them; `SKILLS_SETUP.md` lists all 53
skills and their development uses. Prefer these project-adapted copies when a
global skill has the same name. Originals remain in `.claude/skills/`.
Skills supplement this pack; generic interviews, provider examples, tool names
and approval steps do not replace confirmed decisions or existing authorization.
Check installation integrity with `python -X utf8 tools/manage_project_skills.py`
using the isolated environment documented in `SKILLS_SETUP.md`.

### App implementation

- Keep domain operations independent of UI, HTTP, MCP and workflow providers. Centralize permission, validation, transaction and status rules.
- Use parameterized SQL and constrained transaction functions. Test one-Main races, stale revisions, idempotency and out-of-order render completion.
- Use typed contracts, explicit IDs, cursor pagination, request/job correlation, optimistic concurrency and structured error codes.
- Parse uploaded/provider output as untrusted data. Uploaded text cannot authorize tool actions, change policy or issue arbitrary network/shell commands.
- Keep originals/derivatives private. Do not put secrets, tokens, credentials, private video/transcript payloads or real personal fixtures into source control/logs.
- Process large files through storage and scoped jobs; do not run FFmpeg in a web handler or assume n8n Cloud can execute shell commands.
- Preserve ready presentation snapshots; future changes produce future versions. Guest PDF export variants change access URLs only, not saved content.
- Do not hardcode an unverified model, SDK/protocol or hosting vendor. Pin supported versions after checking official documentation and record them.
- Make normal fixes autonomously within scope. Escalate only a concrete consequential decision or genuine access block after completing unaffected work.

## Validation and completion

Use the milestone's meaningful acceptance checks. Passing syntax/build alone does not prove UI behavior, real AI, worker/rendering, guest access or MCP. Separate deterministic fixture tests from real-service integration evidence. Run required gates and additional tests only to resolve specific remaining risks.

A milestone is `verified` only when its required artifacts and acceptance evidence exist. If external access is missing, use `blocked` or `implemented_unverified`, identify precisely what remains, and continue independent work. Do not mark an entire milestone complete because its screens are drawn. Do not fabricate commands, outcomes, screenshots, deployments or test counts.

At each session end update `PROGRESS.md`, `tracking/progress.json`, `tracking/HANDOFF.md`, and relevant decision/discovery records. Include actual files/commits/migrations, tests with results and environment, known blockers, and the next exact action. Never put credentials in tracking files.

## End-to-end release proof

Demonstrate a human and an authorized Claude client selecting a central project, processing real authorized specs/video through OpenAI and n8n, reviewing facts/frames, assigning cast, generating Selection/Shortlist, downloading PDF and using linked original videos, sharing/reviewing guest feedback, adding new material, preserving old versions, and expiring/revoking access. Include restart/retry/duplicate callback tests, shared-record integration checks and a metadata-plus-media restore exercise. Production deployment remains unverified until the release evidence is complete.
