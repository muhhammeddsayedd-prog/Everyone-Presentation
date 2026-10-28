# Implementation roadmap

Build one vertical slice at a time. Each milestone packet contains its outcome, required context, relevant product rules, exact work, data/API responsibilities, acceptance evidence and handoff. The consolidated context generator can package the listed files into one current dossier per milestone. Do not treat a milestone name as sufficient instruction or depend on the original chat.

| Milestone | Runnable outcome | Primary data/integration work | Completion demonstration |
|---|---|---|---|
| [M00](M00_DISCOVERY.md) | Verified foundation plan for the actual ecosystem | Read-only central schema/auth/hosting inventory; field mapping; migration ownership; version locks | Explain real canonical entities and local/staging path from evidence |
| [M01](M01_FOUNDATION.md) | Signed-in user selects real project and saves logo/details | Auth/capabilities, central adapter, workspace, private logo storage, app shell | Reload persistent project workspace; authorized central write visible to adapter; denied project hidden |
| [M02](M02_SPECS.md) | Real specs become editable roles/slots | Durable jobs/outbox/callbacks; PDF/Word/text parse; OpenAI structured extraction; n8n | One brief through real pipeline, unknowns marked, count creates individual slots |
| [M03](M03_MEDIA_LIBRARY.md) | Real videos become reusable searchable candidate profiles/media | Resumable uploads, worker/audio/frames, transcription/extraction, duplicate choice, library | Several independent files including failure; candidate reuse after reload; actual frames/source provenance |
| [M04](M04_CASTING_REVIEW.md) | Producer organizes Selection/Shortlist and completes final data review | Assignment transactions, one Main, explicit shortlist, review/wording, confirmation | Same candidate two roles, open slot, factual correction, concurrent Main test |
| [M05](M05_PRESENTATIONS.md) | Real branded viewer and PDF from immutable versions | Manifest capture, templates, PDF worker, exports, monotonic ready pointer | Selection/Shortlist exact page counts; old PDF unchanged after edits; failed new render preserves prior |
| [M06](M06_EXTERNAL_REVIEW.md) | External guests review, comment and download authorized PDFs | Links, guest sessions, feedback, fixed-version media grants and guest PDF variants | Newest ready link + original-media old PDF; shared feedback; expire/revoke/disable tests |
| [M07](M07_API_MCP_RELEASE.md) | Whole app usable by Claude and production-ready | Final HTTP/MCP adapters/auth/client tests, real-service parity, sizing/recovery/deployment | Human and Claude complete end-to-end journey; operator restores and retries safely |

## Dependency order and parallel work

The logical dependency is M00 → M01 → M02 → M03 → M04 → M05 → M06 → M07. A later milestone's isolated UI, schema draft or test fixture may be prepared earlier, but its acceptance depends on earlier verified capabilities. Shared domain APIs are built with each feature. M07 completes external API/MCP packaging and integration; it does not begin API design from scratch.

M02 introduces the real durable processing skeleton because specs extraction already needs it. M03 reuses that infrastructure for video processing. M01 uses the upload-session primitives for logo persistence before video stages exist. M05 prepares the export model; M06 adds link-scoped delivery variants using identical frozen content. These boundaries avoid rewriting foundational work at each milestone.

## Common definition of done

- Required slice functions using persistent data and the intended integrations, not just a mock screen.
- Domain, permissions, errors, idempotency and concurrency behave through shared operation contracts.
- Migrations replay locally and are coordinated with existing business history; cloud/staging application status recorded separately.
- Contract, meaningful behavior and integration checks have actual evidence. Not-run checks are visible, never replaced by assumed success.
- UI has loading/empty/partial/error states, usable keyboard controls and clear save/progress status.
- Relevant UI operations are in OpenAPI and mapped for MCP; any adapter deferred to M07 has an explicit parity entry.
- Progress, decisions, environment inventory and handoff reflect actual work and the next exact action.

## Estimates

No calendar or monetary estimate is asserted before M00 and representative media measurements. After discovery, estimate each vertical slice against actual repo reuse, service access, template readiness, sample durations and team capacity. This is a development dependency plan, not a promised delivery date.

## Context packets

Run `python3 tools/assemble_context.py M00` (substitute M01…M07) to rebuild `context-packets/M00_CONTEXT.md` from current source documents and progress. Generated packets are conveniences, not a second source of truth. Edit source contracts and regenerate; never hand-edit generated copies. Prebuilt initial packets are included so an isolated Codex session can start with one file.

## Starting prompt

Use [CODEX_START_HERE.md](../CODEX_START_HERE.md). Begin M00 unless the actual repository and progress evidence show earlier milestones already verified. Resume from evidence, not from a user saying only “continue.”
