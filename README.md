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

`npm.cmd run dev` uses clearly labelled synthetic identities and persistent local state. `npm.cmd run dev:central` uses the owner-confirmed real Supabase project and email sign-in at http://127.0.0.1:3000. Its publishable URL/key are configured in ignored `apps/web/.env.local` on this machine; another installation must configure them securely. The private logo schema, adapter and protected verifier configuration exist; the standard launcher keeps uploads off unless CENTRAL_LOGO_UPLOADS_ENABLED=true is explicitly supplied for development. A previously launched development process enabled that gate; verify current ownership before a serving claim. Actual signed-in Producer/Storage acceptance remains unrun. `npm.cmd start` refuses production while release acceptance is unfinished.

Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test` and `npm.cmd run test:e2e`. Controlled browsers own port3100 and `.next-e2e`; do not build concurrently with them. Current sealed local10 checks are `node tools/test-m02-specs-pipeline-local.mjs`, `node tools/test-m02-native-logging.mjs` and `node tools/test-m02-native-executor.mjs`. They share the owned local SQL test lock. Historical nine-version suites retain their exact guards and receipts; do not weaken them to run on10. Never reset/seed/start the linked Supabase root.

Ten coordinated migrations are applied locally. The newest, `20261028222030_m02_specs_pipeline.sql`, retains original pasted inputs and supports scoped submission, stage leases and initial draft publication. [Native integration](tracking/evidence/m02/native-executor/2026-10-28T23-00-53-971Z-c26f43c2.json) passes with actual SQL/parser/adapter, synthetic Responses, separate commits, cancellation/correction/restart and full cleanup. The local internal TRUST route proves database authorization only; credential authentication remains unverified. No cloud operation occurred in this session; the [last cloud readback](tracking/evidence/cloud-role-order/2026-10-28T19-31-14-242836Z-dc97d5dc-readback.json) verifies9. Completed real Producer enrollment is preserved; full hosted user/Storage acceptance remains unrun.

The [current local checkpoint](tracking/evidence/m02/local-persistence-session/quality.json) passes195 module tests,26 operational tests, lint/typecheck/build and production fixture denial. The [source intake browser proof](tracking/evidence/m02/source-intake-ui/final-visual/summary.json) records7 new and7 existing controlled journeys plus inspected1440/320 views. The source form preserves unknown request intent and manual facts; missing hosted processing still returns503 with manual editing available. Retained inputs and old evidence survive correction; initial automatic apply waits on nonempty/changed facts. M01/M02 remain in progress. Authenticated service/storage/dispatcher/Studio WF01, full real-provider processing and later milestones remain unfinished; hosting is deferred. Earlier188/170/159-module and19-browser checkpoints remain historical.

Actual [provider presence](tracking/evidence/m02/provider-access/2026-10-28T19-07-58-393Z-presence.json) at 19:07 and [read-only API access](tracking/evidence/m02/provider-access/2026-10-28T19-08-27-697Z-read-only-access.json) at 19:08 establish configured OpenAI/n8n access, both HTTP200, and selected `gpt-6.1-sol` availability. [One actual synthetic OpenAI extraction](tracking/evidence/m02/provider-evaluation/2026-10-28T19-31-30-526Z-0cfe7e61.json), completed 19:31:30Z, passed three-role/five-slot/source-evidence/null assertions with 1413 input/1575 output/2988 total tokens. Requested and resolved model were `gpt-6.1-sol`. It made no database application, cloud business write or n8n call and does not prove the full pipeline. The [19:32 n8n API inventory](tracking/evidence/m02/provider-access/2026-10-28T19-32-50-135Z-n8n-discovery.json) found one personal project with name unrecorded and an unrelated inactive W05 workflow; neither is a Studio WF-01 delivery or permission to reuse a Drive connector. The historical MCP attempt failed -32603; management API access was successful. [Current handoff](tracking/HANDOFF.md) identifies the remaining service/storage/worker-host/WF-01, authenticated UI, MCP, PDF and release gates.

The requested local private provider file is `.env.worker.local` at the repository root; Git ignores it. Keep keys there or in server secret management, never in chat/source. [Private configuration instructions](tools/WORKER_PRIVATE_ENV.md) explain the OpenAI/n8n fields and read-only access check. The file is not included in source archives; another installation must create its own private configuration.

The private logo verifier setup remains protected and [documented here](tracking/evidence/cloud-logo-verifier/README.md). Do not recreate the key, repeat completed enrollment or restore revoked grants. Use `python tools/package_pack.py --check` for source-only packaging; `dist/` artifacts are development snapshots, not deployments. The supplied manifest and historical source archives are retained.

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

For a single-file context dossier, run `python3 tools/assemble_context.py M03` (choose the milestone). For document consistency checks, install the optional tools requirements in an isolated environment and run `python3 tools/validate_pack.py`. These scripts check/gather the specification; they do not implement or test the app itself.

## Important boundaries

The supplied database model remains design reference. M00 discovery and the owner-confirmed new canonical system are now mapped in [the physical schema record](contracts/database/central-schema-map.yaml). The guarded reference SQL is intentionally not a deployable cloud migration. Hosting vendor, available credentials/quotas, actual template assets and representative media are technical discovery dependencies. Defaults and unresolved facts are labelled, so Codex can proceed without silently inventing them.

The included standalone HTML is a UX reference with simulated AI and permissive demo navigation. It is not evidence of a production backend. The real release requires completed human and Claude journeys, actual service/PDF proof and recovery evidence.

## Deliverable verification

See [PACK_VALIDATION.md](PACK_VALIDATION.md) for documentation-pack checks. Application implementation and applied cloud migrations have their own timestamped evidence in [PROGRESS.md](PROGRESS.md); authenticated M01 acceptance and the complete production release remain unverified.

Bounded initial setup is completed. Finalized setup retries confirm existing state read-only; they do not restore grants or recreate records. Auth recovery UX and a guarded development logo probe are implemented, but the hosted probe remains unrun. No Auth/rate/billing setting changed and no sign-in email was sent by the agent. Continue from the current handoff; older evidence timestamps remain historical.
