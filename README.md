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

`npm.cmd run dev` uses clearly labelled synthetic identities and persistent local state. `npm.cmd run dev:central` uses the owner-confirmed real Supabase project and email sign-in at http://127.0.0.1:3000. Its publishable URL/key are configured in ignored `apps/web/.env.local` on this machine; another installation must configure them securely. The private logo schema, adapter and protected verifier configuration exist; the standard launcher keeps uploads off unless CENTRAL_LOGO_UPLOADS_ENABLED=true is explicitly supplied for development. The current owned session enables that gate; actual signed-in Producer/Storage acceptance remains unrun. `npm.cmd start` refuses production while release acceptance is unfinished.

Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run test:db` and `npm.cmd run test:e2e`. The browser suite owns a separate fixture server on port3100; the database suite verifies only the dedicated local PostgreSQL container on port55433. Install Chromium with `npx.cmd playwright install chromium` if needed. [Cloud logo foundation evidence](tracking/evidence/cloud-logo-foundation/2026-10-28T03-32-17-619834Z-6a35754c-apply.json) records the fourth applied/read-back migration, 18 scoped RPCs, 13 forced-RLS app relations and one private bucket. The separate dedicated verifier configuration is [documented here](tracking/evidence/cloud-logo-verifier/README.md). The fifth [scoped capability forward fix](tracking/evidence/cloud-logo-capability/) is also applied. The explicitly requested Dummy Test / Dummy Client canonical test records exist. [Producer enrollment](tracking/discovery/PRODUCER_BOOTSTRAP.md) completed with actual account-readiness inspection at 14:09Z and four active M01 capabilities plus project/client write memberships read back at 14:10Z. The connected Chrome Person1 profile remains logged out after HTTP429 email throttling; the owner's reported sign-in in another Chrome does not establish this profile's session. No fake Auth users or generic cloud fixtures were seeded. Never reset/seed/start the linked Supabase root; use the guarded [local harness](development/local-db/README.md).

The earlier application checkpoint passes 80 tests, four fixture browser/HTTP journeys, lint/typecheck and build. Guarded SQL role/concurrency and Node-to-SQL receipt tests are separate proof; actual signed-in cloud/Storage/AI/MCP/release checks remain distinct. Run `node tools/check-logo-receipt-db.mjs` for the reviewed Node/SQL interoperability check. Use `python tools/package_pack.py --check` to inspect source-only packaging; the generated archive goes to ignored `dist/`, preserving the original pack manifest.

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

Bounded initial setup is completed. Retain the existing private state; finalized setup retries confirm state read-only and never restore revoked grants or recreate records. `node tools/test-producer-bootstrap.mjs` rehearses fixed synthetic SQL locally with rollback; it cannot target cloud. Next, establish the enrolled user's session in the connected browser and exercise the real project/workspace/private-logo journey. Auth recovery UX and the guarded development logo probe are implemented and locally tested. The current development process enables the probe; actual authenticated Storage execution remains unrun. The read-only 14:17Z Auth metadata check exposed only `auth.email.max_frequency=1m0s`, not SMTP configuration or project email quota. No Auth/rate settings changed and no email was sent by the agent. M01 remains in progress.

The newer isolated M02 checkpoint passes86 module tests, lint/typecheck and a real SQL rollback rehearsal; see [its scope](tracking/discovery/m02-job-transaction-boundary.md). Its candidate has not been persisted or connected to providers/UI. Earlier browser/build results remain historical.
