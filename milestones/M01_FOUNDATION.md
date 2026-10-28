# M01 — Application foundation, existing project and client logo

**Dependencies:** M00 mapping/runtime/auth strategy. **Next:** M02. **Runnable slice:** signed-in user chooses an authorized central project, edits permitted details and persists client branding in a real workspace.

## Required context

Read the baseline and progress/handoff; M00 discovery output; PRD; architecture/stack; data schema, access and transaction contracts; API_CONTRACT.md and OPERATION_INDEX.md; SITEMAP_AND_PAGES.md; PRESENTATION_TEMPLATE.md; CONFIGURATION.md. Read the OpenAPI schemas for projects/workspaces/uploads/media/audience presets and the design-reference SQL only as a design guide.

## Rules this slice owns

BR-002, BR-021, BR-022, BR-025, BR-030–BR-032, BR-036. Production workspace always references an existing authorized central project. Authorized project/client changes update canonical shared records. App navigation does not require a completed specs sheet or video upload. Missing content is acceptable; absent project authorization is not. Logo is optional, retains aspect/transparency, defaults to cover placement, and can be replaced/removed from the workspace selection. Removing selection is not permission to physically delete a shared client asset. Full Claude parity requires domain operations now, even though final MCP adapter is M07.

## Build sequence

1. Bootstrap or integrate the chosen TypeScript repository layout and lockfile using M00's existing-repo conventions. Add environment validation, logging/request IDs, typed errors and a production assertion that rejects fixture auth/central adapters.
2. Implement canonical auth session validation and actor/capability resolution. Implement project-scoped authorization before returning project/workspace data. Use existing membership rules rather than duplicating a second user directory.
3. Implement the central project/client adapter. Project listing uses search/pagination and returns only permitted records. Project detail reads real shared values; updates validate capability and concurrency and write to the discovered canonical owner. Return normalized DTOs without leaking unrelated business columns.
4. Create or reuse app-owned identity/workspace objects through coordinated local migrations. Enforce one Casting workspace per central project default and idempotent creation. The same project selection opens existing workspace instead of creating duplicates.
5. Build global navigation Projects, Cast Library, Presentations, Processing, Settings, plus six-step workspace navigation. Unimplemented feature screens are honest placeholders/empty states; no simulated successful generation or service operation in production mode.
6. Implement minimal upload-session storage primitives for logo assets: scoped request, actual completion verification, safe allowed image decoding, persistent private asset metadata, preview URL handling, failure/cancel states. This primitive will be extended in M03. Do not accept unbounded SVG/HTML/script uploads as branding without safe conversion; initial approved PNG/JPEG/WebP path is sufficient.
7. Implement Project tab logo upload/replace/remove and cover/every-slide placement. Save references and placement in workspace; central client-logo canonical ownership follows M00 mapping. Shared default client asset changes and workspace selection are explicit actions, not an accidental overwrite of another project's branding.
8. Implement autosave with saving/saved/failed states and row_version checks. Prevent stale async upload callbacks from changing another project after user navigation. Provide recovery/refresh rather than silently losing updates.
9. Add audience preset read/manage model or existing settings adapter with Internal Production/Agency/Client default presets labelled as defaults. Settings capability manages presets; project users choose allowed presets. Capture policy versions for later series use; editing a preset cannot retroactively widen old shared content.

## Data and operations

Core changes: discovered canonical adapter and permissions; verified integration_bindings if needed; workspaces; initial media_assets; audience_presets; audit/idempotency primitives. Add proper FK/capability tests. Do not populate the full library with real cast data during scaffolding.

Operations include `list_projects`, `get_project`, `update_project`, `create_workspace`, `get_workspace`, `update_workspace`, `create_upload_session`, `complete_upload`, `cancel_upload`, media reads and audience-preset management. Follow current OpenAPI exact names and DTOs. Every mutation shares request validation, actor authorization, optimistic concurrency/idempotency and error serialization.

Define runnable implementation scripts and document them: dev web/worker, build, lint, typecheck, test:unit, test:contracts, test:db and test:e2e. Do not claim the commands existed before adding them. The pack validation tool is distinct from app tests.

## UI states and acceptance

- Authorized user sees only permitted central projects. Empty result has an explanation; no fake local project is generated. Wrong ID/unauthorized workspace request is denied through direct API as well as UI.
- Selecting the same real project twice returns the same workspace. Refresh retains it.
- Permitted project/client edit is visible in a fresh canonical adapter read; denied editor cannot alter shared values.
- Upload a transparent logo, replace it, change placement, navigate away/back and reload; same asset/setting persists. Remove selection and verify referenced historical/shared assets are not deleted.
- Invalid or interrupted logo upload shows a local error while allowing other navigation; a late old upload cannot overwrite a new project selection.
- Auth session expiry/stale edit is actionable and does not create silent duplicate records.
- Six navigation steps remain accessible with no specs/candidates while production project access stays enforced.
- UI keyboard navigation, focus, labels and core viewport behavior match experience contract.

Run M01-associated acceptance scenarios with real local DB and discovered auth integration where available. Tests using local auth fixtures are useful, but cloud auth/project integration must be separately evidenced before verification. A rendered shell alone is incomplete.

## Demonstration and handoff

Demonstrate project search → existing project → canonical detail edit → logo upload/placement → refresh. Include actual migration filenames, protected routes, data adapter module paths, script commands and test evidence in ledger. M02 should inherit a real authenticated persistent app, upload primitive and service-operation foundation; list remaining external integration blocks precisely.

## Codex execution prompt

> Implement M01 as a persistent vertical slice against the discovered central adapter. Build auth/capabilities, real project selection/writeback, workspace identity, app navigation and private logo upload. Use the shared operations and contracts; no fixture adapter in production. Validate the explicit acceptance journey and update progress and handoff for M02.
