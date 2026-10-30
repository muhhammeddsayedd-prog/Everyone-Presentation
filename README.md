# Everyone Presentation Studio — Codex development pack

**Version 1.0 · 27 October 2026**

A complete initial specification for developing the presentation app end to end. Casting is the first production module: connected Cast Selection and Cast Shortlist, real uploads and AI extraction, shared Cast Library, branded immutable presentations/PDFs, external review and full Claude API/MCP operation.

**Resume from [tracking/HANDOFF.md](tracking/HANDOFF.md) and [PROGRESS.md](PROGRESS.md).** The original pack started without app code. Current implementation and actual service evidence are recorded there; no milestone or production acceptance is implied by this specification.

## Run the development app

Requires Node 24 and npm 11. From this directory:

```powershell
npm.cmd ci
npm.cmd run dev
```

`npm.cmd run dev` uses clearly labelled synthetic identities and persistent local state. `npm.cmd run dev:central` uses the owner-confirmed canonical Supabase project and real business sign-in at http://127.0.0.1:3000. Producer enrollment is complete; do not repeat it. The publishable URL/key are configured in ignored `apps/web/.env.local` on this machine; another installation must configure them securely. Uploads require their documented database, verifier and explicit development feature gates. Check current process ownership and [the latest handoff](tracking/HANDOFF.md) before a serving or readiness claim. `npm.cmd start` refuses production while release acceptance is unfinished.

Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test` and `npm.cmd run test:e2e`. Controlled browsers own port3100 and `.next-e2e`; do not build concurrently with them. Database proof runners share the owned local SQL test lock and require exact reviewed migration histories. Select the current runner from [PROGRESS.md](PROGRESS.md) and the handoff; retain historical guards and receipts unchanged. Never reset or seed the linked cloud project.

M02, M04 and M05 are verified within their scoped matrices: [specs](tracking/evidence/m02/ACCEPTANCE_MATRIX.md), [casting/review](tracking/evidence/m04/ACCEPTANCE_MATRIX.md), and [immutable versions/PDF](tracking/evidence/m05/ACCEPTANCE_MATRIX.md). M06 guest sharing, feedback and fixed-version PDF/video delivery are implemented on canonical/local history28. Actual link lifecycle, five saved guest files/24 independently inspected pages (the first three exports plus V5; V4 retains byte-only acceptance), and V5's frozen video transcript are documented in [M06 acceptance](tracking/evidence/m06/ACCEPTANCE_MATRIX.md). Old versions remain unchanged. M06 is implemented_unverified for manual assistive-technology acceptance; the owner waived further manual phone testing. [Current composed quality](tracking/evidence/m06/quality/2026-10-30T03-57-34-127660Z-87226dbf-validator-operational-overlay.json) passes83 controlled browser and693 module tests with scoped operational checks. M03 retains its independently grounded two-fact Arabic correction/Reviewed proof; [broader English/mixed semantic evaluation](tracking/evidence/m03/ACCEPTANCE_MATRIX.md) remains unverified. M07 is not started. Hosting stays deferred; external Claude OAuth, restore, endurance and production remain separate release work. The [saved V5 PDF acceptance](tracking/evidence/m06/live-artifacts/2026-10-30-v5-independent-visual-review.json) confirms canonical bytes, all six pages and both source frames. The source ZIP remains the frozen278985e package before this acceptance-only follow-up; its contents and privacy receipt are unchanged.

The [real signed-in pasted-text journey](tracking/evidence/m02/live-specs-app/ui-text-baseline.json) and [canonical readback](tracking/evidence/m02/live-specs-app/2026-10-28T23-54-07.641799+00-00-database.json) prove actual native preparation, Studio WF01/n8n orchestration, OpenAI extraction and persisted roles/slots, including reload and same-source job reuse. [Cancellation](tracking/evidence/m02/live-specs-cancellation/ui.json) and [worker relaunch](tracking/evidence/m02/live-specs-restart/completed-ui.json) have separate actual app evidence. The [PDF and Arabic DOCX workflow](tracking/evidence/m02/live-specs-files/2026-10-29T07-27-45-389593+00-00-f054a457-metadata.json) now passes through actual private Storage, native preparation, n8n/OpenAI and saved requirements. [Manual-edit protection](tracking/evidence/m02/specs-protection/manual-edit-comparison.json) retains saved facts when a later provider result reaches a changed draft. [File evidence and privacy checks](tracking/evidence/m02/live-specs-files/README.md) explain the exact acceptance scopes. Current database releases and remaining gates belong in the handoff and progress ledger, not a fixed migration count here.

The [historical module checkpoint](tracking/evidence/m02/specs-file-checks/final-modules.json) records 274 passing module tests, lint and typecheck. [Build, production fixture denial and skill validation](tracking/evidence/m02/specs-file-checks/root-commands.json) have separate recorded scopes. The [file/source browser proof](tracking/evidence/m02/file-source-ui/summary.json) records 19 controlled journeys with intercepted API/Storage responses; it is not live file acceptance. The [earlier 195-test checkpoint](tracking/evidence/m02/local-persistence-session/quality.json), [historical native SQL/parser proof with synthetic responses](tracking/evidence/m02/native-executor/2026-10-28T23-00-53-971Z-c26f43c2.json), and earlier 188/170/159-module checks remain dated evidence. Source correction preserves unknown request intent, manual facts and original evidence. These checkpoints precede M02 acceptance closure; current counts, milestone states and later evidence belong to the handoff and progress ledger.

Historical [provider presence](tracking/evidence/m02/provider-access/2026-10-28T19-07-58-393Z-presence.json) and [read-only API access](tracking/evidence/m02/provider-access/2026-10-28T19-08-27-697Z-read-only-access.json) established configured OpenAI/n8n access and selected `gpt-6.1-sol` availability. [The initial standalone OpenAI evaluation](tracking/evidence/m02/provider-evaluation/2026-10-28T19-31-30-526Z-0cfe7e61.json) used 2,988 tokens and passed its synthetic extraction assertions; it did not apply database results or call n8n. Later connected app evidence above proves the actual pasted-text pipeline. The [historical n8n inventory](tracking/evidence/m02/provider-access/2026-10-28T19-32-50-135Z-n8n-discovery.json) and MCP -32603 failure remain preserved; the unrelated W05 workflow was not reused for Studio. See the current handoff for remaining file, API/MCP, recovery and release acceptance.

The requested local private provider file is `.env.worker.local` at the repository root; Git ignores it. Keep keys there or in server secret management, never in chat/source. [Private configuration instructions](tools/WORKER_PRIVATE_ENV.md) explain the OpenAI/n8n fields and read-only access check. The file is not included in source archives; another installation must create its own private configuration.

The private logo verifier setup remains protected and [documented here](tracking/evidence/cloud-logo-verifier/README.md). Do not recreate the key, repeat completed enrollment or restore revoked grants. Use `.\.venv-skills\Scripts\python.exe tools/package_pack.py --check` for source-only packaging. Use the existing project interpreter rather than the Windows PATH Python installer alias; see the [retained scanner incident](tracking/evidence/security/private-scan-alias-incident.json). `dist/` artifacts are development snapshots, not deployments. The supplied manifest and historical source archives are retained.

## Document map

| Area | Main documents | Purpose |
|---|---|---|
| Execution | [AGENTS.md](AGENTS.md), [start prompts](CODEX_START_HERE.md), [contract baseline](CONTRACT_BASELINE.md) | How Codex starts/resumes, authoritative rules and naming |
| Product | [PRD](docs/product/PRD.md), [decisions](tracking/DECISIONS.md) | Full scope, workflows, confirmed decisions vs implementation defaults |
| Architecture | [technical architecture](docs/architecture/TECHNICAL_ARCHITECTURE.md), [tech stack](docs/architecture/TECH_STACK.md) | Component responsibilities, data flows, stack and runtime choices |
| Database | [schema/data dictionary](docs/data/DATABASE_SCHEMA.md), [transactions/functions](docs/data/TRANSACTION_FUNCTIONS.md), [access/security](docs/data/SECURITY_AND_ACCESS.md) | Tables, invariants, ownership, atomic operations and permissions |
| Existing Supabase | [discovery/migrations](docs/data/SUPABASE_DISCOVERY_AND_MIGRATIONS.md), [mapping template](contracts/database/central-schema-map.template.yaml), [guarded SQL](contracts/database/design-reference.sql) | Reuse real business records and produce safe coordinated migrations |
| Screens/design | [sitemap/pages](docs/experience/SITEMAP_AND_PAGES.md), [presentation template](docs/experience/PRESENTATION_TEMPLATE.md) | What each page shows/does, errors/states, exact slide content/layout |
| API/agents | [API contract](docs/integrations/API_CONTRACT.md), [operation index](docs/integrations/OPERATION_INDEX.md), [MCP](docs/integrations/MCP_INTEGRATION.md), [API/DB mapping](docs/integrations/API_DB_MAPPING.md) | Full shared operations, authorization, DTOs and agent parity |
| Machine contracts | [OpenAPI](contracts/openapi.yaml), [MCP catalog](contracts/mcp-tool-catalog.json), `contracts/json-schema/` | Typed interfaces, extraction/frame/wording/manifest/job schemas |
| Processing/AI | [AI specification](docs/integrations/AI_SPECIFICATION.md), [n8n workflows](workflows/README.md) | Prompts, source-grounding, native worker stages, retries and callbacks |
| Delivery plan | [roadmap](milestones/README.md), M00–M07 packets, `context-packets/` | Vertical slices with complete required context and acceptance evidence |
| Progress | [PROGRESS.md](PROGRESS.md), [machine status](tracking/progress.json), [handoff](tracking/HANDOFF.md), [environment inventory](tracking/ENVIRONMENT_INVENTORY.md) | Actual progress, evidence, blockers and next action across sessions |
| Quality | [test strategy](docs/quality/TEST_STRATEGY.md), [release evidence](docs/quality/RELEASE_EVIDENCE.md), `fixtures/` | Requirement-linked tests, synthetic data and real-service release checks |
| Operations | [configuration](docs/operations/CONFIGURATION.md), [deployment/recovery](docs/operations/DEPLOYMENT_AND_RUNBOOK.md), [.env.example](.env.example) | Environment setup, monitoring, retry/recovery and release procedure |
| References | [prototype/assets](reference/README.md), [sources](SOURCES.md) | Prior UX reference, visual evidence and official technical documentation |

## Decisions this pack preserves

- Production starts from an existing authorized central project; project/client edits update shared business records, and Project includes client-logo upload.
- Sources are direct uploads and shared internal library. Specs are stable. No dedicated fact-conflict/revised-spec product.
- Selection includes all assignments; Shortlist inclusion is explicit. One candidate may have independent assignments in several roles; each slot has at most one Main.
- Missing values, open slots and fewer frames remain valid. Use Not provided/Pending; never invent candidate facts or images.
- One candidate page per assignment, exact ten fields, carousel in app and available actual frames together in PDF. Design is maintained and text overflow is reviewed.
- Ready versions remain fixed. External links follow newest ready in the same presentation/output/audience, default 30 days. Guest feedback is shared among that presentation's reviewers and pinned to viewed version.
- External PDF variants preserve original media while enforcing parent-link access. Full app API/MCP lets Claude act with the same capabilities as its represented user.
- Existing Supabase, OpenAI and n8n Cloud remain fixed integrations; native worker handles media/PDF processing.

## How to use the pack

1. Extract the whole archive; preserve relative paths.
2. Put it alongside the intended implementation repository or merge its documentation/instructions carefully into that repository.
3. Give Codex the first-session prompt. It begins M00 discovery with the actual environment.
4. Codex implements M00–M07 in dependency order and updates the progress/handoff files after each session.
5. Use the acceptance evidence to verify each slice. Live integrations remain Not run until tested against actual services.

For a single-file context dossier, run `.\.venv-skills\Scripts\python.exe tools/assemble_context.py M04` (choose the milestone). For document consistency checks, use the documented isolated environment and run `.\.venv-skills\Scripts\python.exe tools/validate_pack.py`. These scripts check/gather the specification; they do not implement or test the app itself.

## Important boundaries

The supplied database model remains design reference. M00 discovery and the owner-confirmed new canonical system are now mapped in [the physical schema record](contracts/database/central-schema-map.yaml). The guarded reference SQL is intentionally not a deployable cloud migration. Hosting vendor, available credentials/quotas, actual template assets and representative media are technical discovery dependencies. Defaults and unresolved facts are labelled, so Codex can proceed without silently inventing them.

The included standalone HTML is a UX reference with simulated AI and permissive demo navigation. It is not evidence of a production backend. The real release requires completed human and Claude journeys, actual service/PDF proof and recovery evidence.

## Deliverable verification

See [PACK_VALIDATION.md](PACK_VALIDATION.md) for documentation-pack checks. Application implementation and applied cloud migrations have their own timestamped evidence in [PROGRESS.md](PROGRESS.md); authenticated M01 acceptance and the complete production release remain unverified.

Bounded initial setup is completed. Finalized setup retries confirm existing state read-only; they do not restore grants or recreate records. Auth recovery UX and a guarded development logo probe are implemented, but the hosted probe remains unrun. No Auth/rate/billing setting changed and no sign-in email was sent by the agent. Continue from the current handoff; older evidence timestamps remain historical.
