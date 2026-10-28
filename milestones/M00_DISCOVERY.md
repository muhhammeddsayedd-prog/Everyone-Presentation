# M00 — Discover the ecosystem and freeze implementation contracts

**Status at handoff:** not started. **Dependencies:** supplied documentation and authorized environment/repository access. **Next:** M01.

## Outcome

Codex understands the actual Everyone ecosystem, knows which tables/fields/functions it can reuse, has a safe local/staging development path and a concrete compatible technology/runtime choice. No one should need to guess central project identity, user permissions or migration ownership when writing app code.

## Required context

Read AGENTS.md, CONTRACT_BASELINE.md, PROGRESS.md, tracking/DECISIONS.md and ENVIRONMENT_INVENTORY.md. Load docs/product/PRD.md; docs/architecture/TECHNICAL_ARCHITECTURE.md and TECH_STACK.md; docs/data/DATABASE_SCHEMA.md, SECURITY_AND_ACCESS.md and SUPABASE_DISCOVERY_AND_MIGRATIONS.md; contracts/database/central-schema-map.template.yaml; docs/operations/CONFIGURATION.md. Inspect existing repository instructions before changing anything. The SQL reference is design material, not a migration to run.

## Product context to preserve

The app generates Selection and Shortlist in one Casting workspace on an existing central project. Shared library facts may be reused across projects; assignment and presentation data are app-owned extensions. Authorized project/client edits must change central business records. New cast enters Unreviewed, correction/review is for producers/designated editors, and Claude can act with the same authority. Direct uploads are the only first-release external input route. The user's Supabase, OpenAI API and existing n8n Cloud are fixed stack choices. No new project-management product, database replacement or external connector project is needed.

The user authorized local schema/functions development after read-only cloud inspection. They did not say the cloud is empty. Unknown provider, hosting or schema facts are discovery inputs, not reasons to restart product questioning.

## Work sequence

1. Inventory the actual repository, branch/status, AGENTS files, installed services and configuration names without printing credentials. Identify whether this is a new app repo or existing monorepo and preserve unrelated work.
2. Inspect authorized cloud metadata read-only: schemas/relations/types/keys, functions/triggers, grants/RLS, existing migration history, auth/user membership model, projects/clients/cast/person records, storage buckets/policies. Read only minimal representative data needed to understand identity/field semantics; no broad personal-data export.
3. Fill the mapping template. For each logical project/client/principal/candidate and each shared fact, specify canonical owner, key type, read method, write method, permission source and migration adaptation. Prefer direct FKs when feasible; otherwise identity-only verified bindings. Decide exact one-workspace-per-project constraint compatible with central project lifecycle.
4. Identify authoritative migration repository/owner. Determine how app migrations join that history and how staging is isolated. Document drift and pre-existing functions rather than overwriting them.
5. Inspect current auth and intended user/delegated OAuth mechanisms. Map capabilities to real roles and project membership. Define tests for a permitted producer/editor, contributor, library-only viewer, unauthorized project actor and guest. Confirm Claude's delegated flow can be implemented without a privileged universal key.
6. Inspect hosting/CI and runtime constraints. Choose supported pinned Node/package/CLI/SDK versions and web/worker deployment shape. n8n Cloud remains orchestrator; native worker supports FFmpeg/Chromium and scoped callbacks. Do not choose a vendor account/purchase by assumption.
7. Locate template/logo/font reference assets and representative files. Record gaps separately from behavior requirements. The HTML reference is not a production template or source of valid real AI results.
8. Produce local fixture strategy and schema plan. If cloud is unavailable, create a clearly development-only canonical adapter with synthetic projects/users and log every unverified mapping. Continue useful isolated setup; do not mark discovery fully verified.
9. Reconcile contract changes across schema, API, JSON schemas, capability matrix and milestones before implementation starts. Write concise ADR entries for consequential choices and record implementation command conventions.

## Required artifacts

- Completed environment inventory with source/date and no secrets.
- Concrete `central-schema-map.yaml` created from the template, not a file still saying TBD for observed fields.
- A discovery report separating reused objects, app-owned additions, required compatibility changes and unknowns.
- Coordinated migration plan and local/staging strategy; no destructive reset of central data.
- Auth/capability map and delegated MCP compatibility plan.
- Runtime/version and worker plan; actual template/sample inventory.
- Updated contracts/decisions only where justified by evidence.

## Acceptance

- Show exactly how an existing authorized project is resolved and how central project/client edits will be written back; the plan creates no independent canonical project table.
- Show candidate shared fields reused where suitable and how app-specific extensions avoid duplicate truth.
- Identify the actual migration history and demonstrate local target identification before any reset/seed command.
- Demonstrate local schema/bootstrap replay or document the concrete external prerequisite preventing it; a written untested plan is not replay evidence.
- Map project and library permission boundaries without treating admin or Claude as automatic universal access.
- Record which provider/runtime capabilities are verified and which are not. No cloud resource should have been mutated during read-only discovery.

Use the M00-associated cases in TEST_STRATEGY.md. Required evidence: sanitized inventory, mapping, actual commands/results, adaptation decisions, local setup proof. If the cloud remains uninspected, M00 is `blocked`/`implemented_unverified` as appropriate even if local drafting is complete.

## Handoff to M01

Update PROGRESS.md and progress.json. HANDOFF.md names the canonical tables/adapter locations, exact local start/test commands selected, actual next implementation files, and unresolved provider assets. M01 can implement the shell/auth/project slice from this evidence without another interview.

## Codex execution prompt

> Implement M00 from this packet and its required context. Inspect the existing repository and authorized Supabase metadata read-only; record real canonical identity/field/auth/migration ownership; prepare the local development path and update contracts consistently. Do useful local work if an external dependency is unavailable, but do not claim cloud verification or apply design-reference.sql. Finish with evidence and a precise M01 handoff.
