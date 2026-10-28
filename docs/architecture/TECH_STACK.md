# Technology stack and environment decisions

Version 1.0 • 27 October 2026

## Stack

| Layer | Chosen direction | Reason and implementation constraint |
|---|---|---|
| Business database | Existing Supabase/PostgreSQL | User requirement; reuse canonical projects/clients/identities and suitable cast fields; coordinated migrations |
| Auth | Existing business auth and project authorization, discovered in M00 | Avoid a second independent user directory; map capabilities and validate token/session issuer |
| Objects | Existing suitable private Supabase Storage buckets, or new app-scoped private buckets | Reusable media plus generated PDFs; resumable uploads and controlled playback; do not expose service key |
| Frontend/API | React + Next.js App Router + TypeScript | Shared typed web/API application, server-rendered shell and interactive casting UI; version selected/pinned in M00 |
| UI | Tailwind token layer + accessible primitives compatible with existing Everyone UI | Preserve dark shell, green accent, typography and keyboard behavior; do not import Market Radar business features |
| Form/query state | React Hook Form + schema validation; TanStack Query when server-state complexity requires it | Debounced autosave, stale-version handling, job polling, retry and mutation status; avoid duplicate global stores |
| Runtime/schema | Current supported Node LTS; Zod or equivalent with exported JSON schemas | One schema source across validation/contracts; match deployed runtimes rather than unpinned latest |
| Database access | Thin typed repository adapter + parameterized SQL and explicit transactional functions | Supports private eps schema, transaction integrity and existing DB ownership; no ORM migration drift |
| Orchestration | Existing n8n Cloud | User requirement; exported versioned workflows and restricted credentials; durable application job state |
| Embedded AI | Official OpenAI SDK, transcription + Responses structured extraction | User requirement; schema validation, source provenance, configurable evaluated models |
| Media worker | Containerized Node service with FFmpeg/ffprobe; optional isolated document converter | Native binary work outside n8n Cloud; bounded resource use and allowlisted tasks |
| Template/PDF | Versioned React/HTML/CSS templates + Playwright Chromium print rendering | Same frozen manifest drives viewer and PDF; all fields and real frames fit deterministic pages |
| Agent integration | Official compatible MCP SDK; authenticated remote Streamable HTTP | Complete operation parity; client auth/transport tested with actual intended Claude clients |
| Testing | Unit/domain tests, database integration tests, OpenAPI/schema tests, Playwright, worker fixtures, live-service smoke | Each test resolves a real product/integrity risk; mocks do not count as integrated service proof |
| Delivery | Existing suitable Everyone CI/CD and hosting; separate web/API and worker deployments | Hosting vendor not selected by user; prefer existing compatible platform over introducing another service |
| Monitoring | Existing business telemetry if suitable; structured logs/metrics and error tracking adapter | Track jobs/errors/cost without raw secrets/media in logs |

## Versions and lockfile policy

This pack intentionally specifies responsibilities rather than guessing future exact package patch versions. M00 records compatible versions in `tracking/ENVIRONMENT_INVENTORY.md` and the implementation lockfile: Node, package manager, Next.js/React, Supabase CLI/client, OpenAI SDK, MCP SDK/protocol, Playwright/Chromium, FFmpeg and document converter. Use the supported stable versions at installation time that fit the chosen runtime. Pin deployed worker image digests and template/font assets. Upgrade deliberately and rerun affected media/auth/render contract tests.

OpenAI model IDs are configuration, not hardcoded product requirements. Evaluate available supported models on English/Arabic/mixed intro samples, correction frequency, cost and latency. Record model/prompt/schema version per job. Verify current capabilities, upload limits and deprecation notices at implementation; do not copy old sample models from a prototype. Official structured outputs enforce schema shape but can still contain factual mistakes [S05](../../SOURCES.md#s05).

## Hosting requirements, not a hidden vendor decision

The web/API runtime must support the selected Node framework, secure secret injection, private DB connectivity, outbound service calls and the chosen MCP transport lifecycle. The worker runtime must support a long-lived/container process, native FFmpeg and Chromium, enough ephemeral disk/CPU/memory, controlled egress and background work beyond web-request limits. The database must remain the user's central Supabase system. n8n remains their existing Cloud instance.

If existing Everyone hosting meets these needs, reuse it. If a component does not, Codex records a narrowly scoped deployment choice with runtime constraints and actual cost estimates once workloads are measured. Do not silently choose Neon, a replacement database, a self-hosted n8n instance, or a new cloud account. There is no approved hosting purchase in this documentation pack.

## Environment matrix

| Environment | Data and services | Purpose |
|---|---|---|
| Local | Local Supabase + synthetic central fixtures; stub providers by default; local worker | Rapid deterministic development and migration replay |
| Integration/staging | Authorized isolated schema/database/branch following business setup; real test credentials; real n8n workflows and worker | Real upload/extraction/render/guest/MCP acceptance without unrelated business records |
| Production | Shared central DB and canonical auth/storage; production service credentials and controlled jobs | Authorized business use after release evidence |

Never point a destructive local reset/seed at cloud. Staging isolation method depends on discovered ecosystem. Use separate workflow IDs, callback secrets and object prefixes per environment. A public browser receives only allowed public config; OpenAI, n8n and privileged Supabase credentials remain server-side.

See [configuration contract](../operations/CONFIGURATION.md), [discovery runbook](../data/SUPABASE_DISCOVERY_AND_MIGRATIONS.md), and [release runbook](../operations/DEPLOYMENT_AND_RUNBOOK.md). Provider setup and quota availability are integration dependencies, not product questions to restart the interview over.
