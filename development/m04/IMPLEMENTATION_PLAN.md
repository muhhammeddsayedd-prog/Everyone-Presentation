# M04 implementation plan

Prepared 2026-10-29 as a planning baseline. **Implementation has since started in the assignment/lifecycle first slice.** New domain/central/HTTP modules, an unwired Casting board and composed local rollback proofs exist; see [the assignment contract](ASSIGNMENT_CONTRACT.md) and [current handoff](../../tracking/HANDOFF.md). No numbered M04 migration, promotion, cloud release or board browser acceptance is implied. Independent M03 quality acceptance remains explicit while useful M04 work continues. Hosting stays deferred.

## Authority and current starting point

Use the [M04 packet](../../milestones/M04_CASTING_REVIEW.md), [baseline](../../CONTRACT_BASELINE.md), [PRD](../../docs/product/PRD.md), [transaction contract](../../docs/data/TRANSACTION_FUNCTIONS.md), [schema](../../docs/data/DATABASE_SCHEMA.md), [security contract](../../docs/data/SECURITY_AND_ACCESS.md), [API contract](../../docs/integrations/API_CONTRACT.md), [operation index](../../docs/integrations/OPERATION_INDEX.md), [API/DB mapping](../../docs/integrations/API_DB_MAPPING.md), [OpenAPI](../../contracts/openapi.yaml), [MCP catalog](../../contracts/mcp-tool-catalog.json), [Casting/Review pages](../../docs/experience/SITEMAP_AND_PAGES.md), [template contract](../../docs/experience/PRESENTATION_TEMPLATE.md), [AI specification](../../docs/integrations/AI_SPECIFICATION.md), [WF-05](../../workflows/WF-05-CONTEXTUAL-AI.md), and [test catalogue](../../docs/quality/TEST_STRATEGY.md). This plan supplements those contracts; it does not replace them or the current handoff.

Observed when this plan was prepared: M02 supplies persistent specs/roles/individual slots; M03 supplies shared candidates, factual review, private media, project participation, availability and pinned frames. Audience presets already exist in `eps.audience_presets` and have domain/central/API/MCP implementations. At that baseline, `packages/templates/`, assignment services and presentation-series services did not yet exist. Current assignment progress is recorded separately above. Do not recreate existing candidate, project, client, preset or authentication entities.

The local schema baseline is the reviewed **19-migration** history, with immutable migration18 `20261029133455_m03_remaining_media_library.sql` SHA256 `2e190e001b2bda044d9c90da4287f54e5839b0af7ffec84d4c93083909c944fb` and migration19 `20261029135318_m03_frame_request_resubmission.sql` SHA256 `e816ad6b491626ace489efd256b56c322d25d9101de94e5fb8b24d2d4b745048`. [Local19 promotion](../../tracking/evidence/m03/frame-resubmission-promotion/2026-10-29T14-02-13-973Z-4999b031.json) is a local reference, not evidence of a cloud19 release. Root is separately executing the cloud release/app checks. At implementation start, bind the resulting actual cloud readback and fresh local snapshot; do not assume the cloud state from this plan or reuse old pristine business counts.

The asset inventory records missing production font binaries/licences and locally unavailable historical casting PDFs. A current repository font-file search found no supplied WOFF/WOFF2/TTF/OTF outside dependencies/archives. Use an explicitly identified fallback for development and record its actual geometry; production-template/font fidelity remains unverified until the proper assets are supplied. Preserve the existing Everyone assets and content contract.

## Ownership and data boundaries

| Concern | Authoritative existing/new record | Rule |
| --- | --- | --- |
| Project/client names and branding | Existing canonical records/workspace logo selection | No presentation-only project/client override. |
| Full reusable facts and Reviewed | Existing `eps.candidates` and its fact fingerprint | Reuse `update_candidate`/`confirm_candidate_reviewed`; project choices never reset factual confirmation. |
| Selected introduction, frames, availability | Existing `eps.workspace_candidates` | Reuse its pinned media/frames; never substitute a new global default. |
| Role/slot requirement and explicit order | Existing `eps.roles`/`eps.slots` | Preserve UUIDs, provisional-slot semantics and source evidence. |
| Position, Shortlist, notes, display overrides | New `eps.assignments` | Independent per slot; no `selection_included` column. |
| Output/audience/template context | New minimal `eps.presentation_series`, existing presets | Capture policy/template identity; no render or latest-ready success invented. |
| Output projection and review checks | Deterministic shared projection over the above | One candidate page per included assignment; Pending per empty output slot. |
| Optional AI assistance | New scoped `ai_suggestion` job/result | A proposal only; apply through normal versioned mutations. |

Add assignments with `(workspace_id, slot_id)` and `(workspace_id, workspace_candidate_id)` composite foreign keys, an active unique `(slot_id, workspace_candidate_id)` index, and an active unique `slot_id WHERE position='main'` index. Standard row version/audit/archive fields apply. Defaults are `position='option'`, `shortlist_included=false`, `slide_wording={}`. Archive rather than deleting referenced records.

The actual post19 `eps.audit_events` table has attribution fields only (`id`, principal/action/resource/request/client/time), with no JSON inverse/details column. Add a small private append-only assignment-change payload store linked to its audit event for exact before/after positions and resulting revisions, retirement effects and duplicate-note preservation; do not pretend the existing audit row already holds that data. Keep the payload schema bounded by operation, protect it with FORCE RLS and narrow owner grants, and expose only the typed authorized result. This is transaction/Undo evidence, not a general event-sourcing or fact-conflict product.

## Published operations and DTOs to implement/reuse

All HTTP paths below are relative to `/api/v1`. The same named operations must be available in MCP using the same acting-user service. All creates, assignment updates, Main/Undo, removals and reorder operations below carry `Idempotency-Key` where published. Validate strict request fields, current capability/scope, child-parent relationships, bounded pagination and expected revisions again on replay; no service-role fallback.

| Operation | Published HTTP route | Capability | Input / success data |
| --- | --- | --- | --- |
| `list_assignments` | `GET /workspaces/{workspace_id}/assignments` | `workspaces.read` + project read | Optional `output_type`, `cursor`, `limit` (1..100, default25); `Assignment[]` + `page`. |
| `create_assignment` | `POST /workspaces/{workspace_id}/assignments` | `workspaces.write` + project write | `AssignmentCreate` → `Assignment` (201). |
| `update_assignment` | `PATCH /assignments/{assignment_id}` | `workspaces.write` + project write | `AssignmentPatch` → `Assignment`. |
| `set_slot_main` | `PUT /slots/{slot_id}/main` | `workspaces.write` + project write | `SetSlotMain` → `SetSlotMainResult`. |
| `undo_slot_main` | `POST /slots/{slot_id}/main/undo` | `workspaces.write` + project write | `MainUndo` → `SetSlotMainResult`. |
| `remove_assignment` | `POST /assignments/{assignment_id}/remove` | `workspaces.write` + project write | `ArchiveRequest` → `Success`. |
| `reorder_workspace` | `PUT /workspaces/{workspace_id}/order` | `workspaces.write` + project write | `ReorderWorkspace` → `Workspace`. |
| `get_workspace_review` | `GET /workspaces/{workspace_id}/review` | `workspaces.read` + project read | Required `series_id`; optional matching `output_type`; `WorkspaceReview`. |
| `list_presentation_series` | `GET /presentation-series` | `workspaces.read` + project read | Optional `workspace_id`, `output_type`, `cursor`, `limit`; `PresentationSeries[]` + `page`. |
| `create_presentation_series` | `POST /presentation-series` | `presentations.generate` + project write | `PresentationSeriesCreate` → `PresentationSeries` (201). |
| `get_presentation_series` | `GET /presentation-series/{series_id}` | `workspaces.read` + project read | `PresentationSeries`. |
| `create_ai_suggestion` | `POST /ai-suggestions` | `workspaces.write` + project write | `AiSuggestionCreate` → real `JobAccepted` (202). |
| `get_ai_suggestion` | `GET /ai-suggestions/{suggestion_id}` | `workspaces.read` + project read | `AiSuggestion`; never expose unrelated/private job payloads. |

Existing operations remain the only paths for profile facts (`cast.write`), profile confirmation (`cast.review`), selected project media/availability (`workspaces.write` with existing cast-read relationship guards), library/media reads (`cast.read`) and audience settings (`settings.manage` for edits; `workspaces.read` for listing). A project contributor does not gain shared-fact write/review authority from the Review page. Preserve retained project-card visibility for archived/merged records under the existing M03 read rules.

Exact request/response points from the current machine contracts:

- `AssignmentCreate`: required `slot_id`, `workspace_candidate_id`, `expected_slot_row_version`; optional `shortlist_included` and nullable `presentation_notes`. No position input. Reuse an existing active same-slot relationship without creating a second one; do not reset its position or other choices. If the direct-Shortlist flow finds an existing non-shortlisted assignment, include it through ordinary `update_assignment` with its current version.
- `AssignmentPatch`: required `row_version`; optional `position` **only** `option|backup`, `shortlist_included`, nullable `presentation_notes`, nullable `internal_notes`, `slide_wording`. Main promotion uses only `set_slot_main`; no slot/candidate reassignment through this patch.
- `Assignment`: `id`, `workspace_id`, `slot_id`, `workspace_candidate_id`, `position`, `shortlist_included`, `presentation_notes`, `internal_notes`, `slide_wording`, `sort_order`, `row_version`, `archived`.
- `SetSlotMain`: required nullable `assignment_id`, `expected_slot_row_version`, literal `replacement_behavior='move_previous_to_backup'`. Null clears Main and demotes the former Main to Backup.
- `SetSlotMainResult`: `slot`, `affected_assignments[]`, nullable `undo`. `MainUndo` contains `undo_event_id`, `slot_id`, `expected_slot_row_version`, and `restore_assignment_positions:[{assignment_id,position}]`. Body/path slot IDs must agree. The restore list must equal the server-recorded inverse, not a client-authored position list.
- `ReorderWorkspace`: required workspace `row_version`; optional `role_ids`, `slot_ids_by_role`, `assignment_ids_by_slot`. Each supplied scope must contain its exact eligible ordered ID set; reject duplicates, foreign IDs and omissions. Omitted scopes remain unchanged. Preserve deterministic ties by ID defensively.
- `ArchiveRequest`: `row_version`, optional nullable `reason`. Preserve operation notes and the distinction between profile archival, project removal and one-assignment removal.
- `PresentationSeriesCreate`: required `workspace_id`, `output_type='selection'|'shortlist'`, `audience_preset_id`; optional `title`. `PresentationSeries` contains the audience snapshot, title, nullable latest-ready ID/no, row version and archived state. No existing version/render is implied by series creation.
- `WorkspaceReview`: `workspace_id`, `input_fingerprint` (64 lowercase hex), `draft_revision`, `output_type`, `candidate_slide_count`, `pending_slide_count`, `issues[]`, `can_generate`, `unreviewed_candidate_ids[]`. Issues have `code`, `severity='information'|'warning'|'blocking'`, nullable `entity_id`/`field`, `message`, nullable `repair_action`.
- `AiSuggestionCreate`: required `workspace_id`, `capability`, `target_type`, `target_id`, `target_row_version`, `instruction`; optional `field`, `source_text`. Published capabilities are `slide_shorten|normalize_english|contextual_instruction`; targets are `assignment|role|workspace_candidate|candidate`. Server-load authorized source; caller text is untrusted context, not permission. Apply candidate corrections only through `cast.write`, never through suggestion creation.
- `SlideWording` has only the ten keys listed below. Omitted keys inherit; null removes an existing override and falls back to source content, per API/DB mapping. Normalize stored overrides without replacing full facts.

Before the first implementation slice, resolve these engineering contract alignments together in OpenAPI, MCP, schemas, strict DTOs and tests:

1. **Template context:** the packet requires an exact series/template preflight, but current SeriesCreate/Series DTOs have no template field and Workspace has no template setting. Pin a registered template key/version/hash server-side on series creation and expose that identity through an additive typed contract; permit only registered template versions. A single development template is enough; no arbitrary template URL/editor/marketplace. Never silently use a different template between review and generation.
2. **Review data/fit:** the current Review DTO is a summary. Specify how the UI/API obtain the exact resolved ten-field/ordered preview bound to its fingerprint. Prefer a typed additive projection returned from the same review snapshot over unrelated resource reads being presented as one coherent snapshot. Keep internal inspector data separate from the render-safe projection. Do not return undeclared fields from strict DTOs.
3. **Retirement effects/Undo:** resize/archive contracts require affected-assignment summaries and bounded inverse actions, while published role/archive responses do not yet specify a role/slot restoration endpoint. Define the typed effect summary and, if exposing role/slot Undo, a narrowly scoped audit-bound restoration operation. `undo_slot_main` cannot act as generic archival restoration. Preserve versions and audit now; do not invent a client-only rollback.

## Post19 hooks that must be integrated atomically

These source hashes come from the local19 promotion's complete safe catalogue. Freshly verify ownership, security/search-path settings, grants and source hashes before authoring the next additive migration. They are not a substitute for root's actual cloud readback.

| Existing signature | Owner | Post19 source SHA256 | Required treatment |
| --- | --- | --- | --- |
| `eps.specs_retirement_gate()` | `eps_specs_owner` | `8ad2e54cc84045a9623c9c8938c658a1e73d624b05321eff6af2fed01f934f7b` | Present global existence guard returns503 once assignments exist. Replace its actual resize/archive call sites with scoped locks/archival/effects; do not turn the zero-argument guard into a blind no-op. |
| `public.eps_resize_role_slots(uuid,jsonb,text)` | `eps_specs_owner` | `957a17e5ed0e9679f95cb8892d66c2e276faf62c4c43fd02733f1f60a2f484f8` | Retire only explicit selected slots and their active assignments; preserve other slots and history; report effects. |
| `public.eps_archive_role(uuid,jsonb,text)` | `eps_specs_owner` | `d356c477c278d3c358d1baab46b3eab1189f43d675b23e33b78ba896df461a36` | Archive role, its slots and assignments in one versioned operation. |
| `eps.specs_machine_baseline(eps.specs)` | `eps_specs_apply_owner` | `f1d5e1a38858e06823cfbcc17baae4a0095e1d4c6befeaa2fa8a9318811cf155` | Global `to_regclass('eps.assignments')` currently makes safe machine-baseline/source-correction eligibility false for every workspace. Replace with scoped active-assignment protection; retain every existing pristine-source/manual-change guard. An RLS-hidden assignment must not yield a false “no assignments.” |
| `eps.cast_archive_with_reason(text,uuid,jsonb,text)` | `eps_cast_owner` | `71b109621008cbca1144c1293bf991fae95232d9f65adff8d57f81e4bd60a248` | Its project-removal branch has a global assignments503. Integrate confirmed scoped assignment archival and effect IDs; candidate-global archival must continue retaining project/history references. |
| `eps.cast_link_duplicate(uuid,jsonb,text)` | `eps_cast_owner` | `f5639a241377ef90bb430feb250c25cbd1adc64b114ec56f9539f6180254a4dd` | Remove the global assignments503 only after mapping/collapsing live assignments safely. **This is the post18 body including support merge; do not patch against old17 hash77ed… .** |
| `eps.support_move_after_merge(uuid,uuid)` | `eps_support_upload_owner` | `1950f511b18520801418d5b62b2d80753e730ea88666f06b53181e22ac9e2259` | Preserve the existing Ready-only association transfer, immutable original asset/upload proof, capability checks and audit hook. No attachment discard/reset. |
| `public.eps_extract_candidate_frames(uuid,jsonb,text)` | `eps_cast_owner` | `f7c45a6839ebf87e7a2de3bec424654402faf6055cdf1fc2472c931f9279f454` | Leave19 active-request coalescing/new-key-after-terminal fix unchanged; no resurrection of cancelled/failed work. |

Assignment storage must not be exposed in a committed/released state while these existing user paths still fail merely because the table exists. Develop fragments locally, then compose the new table/constraints/policies and all required forward integrations in one reviewed additive migration. Never edit migrations1–19 or disable their protections to make a test pass. Preserve current enabled models/configs, supporting-key lifecycle metadata, Storage rows and the **11 existing runtime ports**. AI/fit runtime extensions, if needed, require their own explicit narrow proof; no blanket runtime authority.

Duplicate linking must retain the target participation/assignment IDs where both identities occupy the same slot; Shortlist becomes OR; position precedence is Main, then Backup, then Option. Preserve both notes/wording in the audit/effect summary and retain a deterministic existing target display note until the actor ordinarily edits it. Preserve target project media/frames/availability choices; re-key or archive provisional participation with audit. The unique-Main boundary still applies. Permission checks cover every affected project, including after lock waits and on replay; hidden project references may not be rewritten.

## Thin implementation sequence

### 0. Bind the finished M03 baseline and align contracts

Read root's final M03 acceptance/readback and fresh local19 catalogue. Record exact source/owner/grant baseline, active data fingerprints and current process/config boundaries. Agree the three typed alignments above before source changes. Prepare a synthetic fixture mapper (`shortlisted` → `shortlist_included`, `internal_note` → `internal_notes`, symbolic IDs → local UUIDs); fixture JSON is not an executable seed/API body.

**Exit:** one consistent operation/type map and guarded local-only migration candidate; no cloud action, new identity, preset reseed or hosting change.

### 1. Assign an existing project candidate and remove it safely

Implement create/list/remove assignments through domain rules, constrained SQL, central SDK, HTTP/MCP and the Casting board. A first useful journey assigns a pool member to a slot as Option, toggles explicit Shortlist, reloads it and removes only that assignment. Integrate the lifecycle hooks above in the same local/release composition so candidate removal, duplicate resolution and role retirement retain their established behavior.

**Proof:** active candidate/slot uniqueness and composite-FK rejection under actual non-owner roles; same-key replay and changed-body denial; contributor project preparation without global fact rights; one person in two roles; remove one retains other assignments, media and support associations; assigned role/slot/project removal archives only the confirmed scope. Source-correction/manual-note tests remain valid with the assignments table present in an unrelated workspace.

### 2. Main replacement and audited Undo

Implement atomic set/clear Main, Option/Backup updates and audit-bound Undo, then expose the controls and returned affected rows in UI/API/MCP.

Use a consistent aggregate lock order compatible with existing M02/M03 paths: affected workspaces in UUID order first for mutations that touch several records/projects, then required role/slot/pool records in stable order, then affected assignment IDs in stable order. `set_slot_main` locks its slot before assignments and checks the expected slot revision **after** waiting. Keep transactions short; no provider/fit/media/network work while holding locks. Check deadlock-sensitive mixed paths (duplicate merge, slot retirement, assignment creation/removal and reorder), not just isolated Main transactions. Preserve existing candidate/media lock order where those records are involved.

Demote old Main before promoting target; bump changed assignment versions, slot version and draft revision once for the change; return coherent slot + affected assignments + inverse audit ID. Target already Main is a successful no-op. Undo verifies current slot and affected assignment revisions plus the exact server-recorded positions; reject stale/foreign/replayed inverse authority, without overwriting intervening edits.

**Proof:** two real local database sessions with a measured lock wait and the same expected slot version produce one winner/typed stale loser, never two Mains. Test clear Main, successful Undo, stale Undo after a later edit, forged inverse, scope substitution and no-op/replay. Do not describe an in-memory race as SQL concurrency proof. PostgreSQL17 documents [row-lock behavior and consistent lock order](https://www.postgresql.org/docs/17/explicit-locking.html) and [partial unique indexes](https://www.postgresql.org/docs/17/indexes-partial.html); checked2026-10-29.

### 3. Stable ordering and complete Casting controls

Implement explicit role/slot/assignment reorder with exact-set validation, keyboard move controls and honest save/retry states. Position changes never sort the board. Add/copy to another slot uses assignment creation and starts Option; direct Shortlist sets explicit inclusion. A move implemented from published create/remove operations must preserve the source until target creation succeeds, retain stable per-step keys and expose partial completion if source removal loses its revision—never falsely report an atomic move or silently remove a newer source choice.

**Proof:** reload order, missing/duplicate/foreign ID denial, cursor continuation across more than100 assignments, unaffected slot choices, exact Selection/Shortlist counts and keyboard paths. Avoid concatenating different filter/slot scopes or deriving order from database insertion time.

### 4. Minimal series plus deterministic ten-field review

Create/reuse a series from the selected workspace/output/audience policy and pinned registered template. Reuse existing preset storage; a changed access policy gets a distinct series. No generated version or Ready pointer is created in M04. Build the review list/drawer using scoped source/profile/media access and a shared render-safe projection. Keep ordinary fact editing, project availability/media editing, assignment notes and display-only wording visibly distinct.

Return a stable fingerprint from one coherent server snapshot over render-relevant canonical project/client values and logo; role/slot requirements and order; included assignments, positions, explicit overrides; reusable resolved facts; project availability/pinned media/frame order and checksums; template/content/font identity; audience policy snapshot. Shared fact/client changes must invalidate review even when this workspace's draft revision did not change. Unselected new frames and unrelated job timestamps must not fabricate changed slide content. M05 must reuse this exact projection/fingerprint function in its snapshot-capture transaction.

**Proof:** fixture exact ordered8/6 projection; shared-height update affects both assignment pages while a note override affects only one; source facts remain full; independent project availability; fingerprint changes for each relevant input and stays stable for unrelated processing; series/output mismatch and foreign child IDs denied. `confirm_candidate_reviewed` reuses its current fact/source fingerprint and row version; stale confirmation fails, project/template changes do not reset Reviewed. Generate/PDF/share controls remain accurately unavailable until their later implemented operation exists.

### 5. Actual fit checks and optional WF-05 assistance

Introduce the shared cover/candidate/Pending template components and registered template metadata in `packages/templates/`. Measure overflow with the actual selected layout and font/fallback used by the preview; character counts are only early hints. A bounded native/browser fit-measurement port can work outside database transactions, fenced by the captured review fingerprint and rechecked on completion. If measurement cannot complete, return a specific technical issue instead of claiming measured fit. Agree any asynchronous fit contract needed by the summary endpoint before implementing it. M05 retains authoritative final-PDF overflow validation.

Implement WF-05's `prepare_suggestion → generate_suggestion → validate_suggestion` as real `ai_suggestion` jobs/outbox with scoped polling, target version/source binding, configured supported OpenAI model/prompt/schema metadata and bounded retries. Reuse existing orchestration/lease principles; do not create an AI job handle without durable work. Validate [slide-wording.schema.json](../../contracts/json-schema/slide-wording.schema.json): `schema_version='1.0'`, `assignment_id`, `field`, `suggested_text`, `facts_preserved[]`, `warnings[]`. Unknown fields/targets, source injection, invented claims and stale targets are rejected/flagged. The server loads the relevant context; request `source_text` does not become canonical evidence. Keep raw source/provider output private.

The actor/Claude inspects and applies a suggestion through normal assignment/role/project-candidate/candidate mutations with current permissions/revisions. No automatic Shortlist, booking, global fact overwrite or human-only agent gate. Manual controls remain fully usable when AI is unavailable.

**Proof:** real long-text overflow identifies the correct field; accepted shorter wording preserves full reusable text, negation and qualifiers; Arabic-to-English normalization retains meaning; unsupported commands and source injection cannot execute; stale result cannot overwrite a newer edit. Deterministic provider tests and one actual authorized OpenAI+n8n assistance run have distinct evidence/usage scopes.

### 6. M04 acceptance and M05 handoff

Run the relevant contract/domain/SDK/HTTP/MCP/SQL/browser gates once stable. Capture a real authorized producer journey through assignment, second-role reuse, Main/Backup/Undo, explicit Shortlist, reusable correction, display wording, current profile confirmation and open-slot review. Local authenticated MCP parity is not an external Claude OAuth acceptance claim; preserve M07's separate gate.

M05 receives typed deterministic render input, chosen template identity, exact ten-field resolution, source asset inventory, series policy snapshot and stale-review contract. M04 does not claim Ready versions, PDF download, guest sharing, external feedback, restore or production deployment. Track meaningful future draft changes against the last ready input when M05 supplies it; until a ready version exists, do not pretend that comparison has already happened.

## Ten-field mapping and fixture oracle

Resolve exactly these keys in this order, with English labels and `Not provided` for missing values. Never store that display label back as a fact.

| Wording key | Visible label | Default source |
| --- | --- | --- |
| `name_or_id` | Name / Casting ID | Supplied candidate name, then casting ID. |
| `age_or_range` | Age / Age range | Supplied age/range; no upload-date aging/inference. |
| `height_measurements` | Height / Measurements | Supplied measurements/units. |
| `languages_accents` | Languages / Accents | Existing supplied language/accent arrays, preserving uncertainty. |
| `skills_experience` | Skills / Experience | Full reusable fact unless an explicit truthful assignment override exists. |
| `city` | City / Location | Supplied usual location, never shoot location inferred as residence. |
| `previous_projects_roles` | Previous projects / Roles | Recorded reusable prior work or accepted truthful override. |
| `classification` | Cast category | Supplied classification. |
| `availability` | Project availability | This workspace candidate's availability, never an old project statement. |
| `presentation_notes` | Presentation notes | Assignment's presentation note/wording. |

Stated gender remains searchable but is not an eleventh slide field. Internal notes, contacts, transcript bodies, processing issues and audit/provider metadata must not enter the render-safe ten-field payload. Actual source video/transcript remain accessible internally through existing authorized operations. Use selected real frames only:3/2/1/0 remain3/2/1/0, with an honest zero-frame placeholder and review acknowledgement; no duplication or invented portraits.

For [casting-happy-path.json](../../fixtures/casting-happy-path.json), assert the complete ordered manifest, not only totals:

- **Selection8:** cover; Father/Samir; Father/Omar; Manager/Samir; Manager/Maya; Waiter1/Omar; Waiter2/Maya; Pending Waiter3. Six candidate pages +one Pending +cover.
- **Shortlist6:** cover; Father/Samir; Manager/Samir; Waiter1/Omar; Pending Waiter2; Pending Waiter3. Three candidate pages +two Pending +cover.
- Lina is an unassigned pool member and appears in neither output. Samir repeats as two independent assignment pages. An Option-only slot is populated; a Shortlist slot with zero explicit inclusions is Pending even when Selection has candidates.
- [Edge recipes](../../fixtures/casting-edge-cases.json): all-empty5slots →6pages; no roles →cover+workspace-requirements Pending without a fictional role; Main/Shortlist independence; direct Shortlist; long wording; fewer frames; unknown headcount; unreviewed reuse. Historical-version/guest recipes remain M05/M06 proofs.

## Proposed file ownership when implementation is authorized

These are coordination boundaries, not parallel implementation already started.

| Owner lane | Proposed files and responsibility |
| --- | --- |
| Domain/data | New `packages/domain/src/casting-types.ts`, `casting.ts`, `review.ts`; corresponding central strict SDK modules/tests; `development/m04/assignments.sql`, `series-review.sql`; deterministic fixture mapper/tests. |
| Lifecycle/data integration | New `development/m04/lifecycle-forward.sql`; scoped specs retirement/machine-baseline and post19 duplicate/support integration; local behavior/race tests. Coordinate exact helper signatures with domain before editing shared SQL. |
| Root web/API/MCP/contracts | Casting/Review components/routes and `apps/web/components/api.ts`; shared API catch-all, `apps/web/lib/mcp.ts`, studio composition; OpenAPI/MCP/schema/generator updates as one change. Advertise only implemented operations. Root composes barrel exports and migration manifest after handoffs. |
| Worker/provider/template | `packages/templates/` template registry/components/fit helper; new versioned suggestion prompt/provider/parser; worker WF-05 executor/job tests and n8n workflow. No speculative hosting selection or uncontrolled provider call. |
| Coordinated release/proof | One new post19 additive migration only after full composed local rollback/race proof and review; sealed fresh-data readback/comparator and explicit root release. Shared local DB lock and exact target/history guard apply. No old-release-helper replay against data-bearing enabled state. |

## Required acceptance evidence

| Gate | Required evidence |
| --- | --- |
| AT-024/025/031 | Current fact confirmation permissions/staleness, two-role independence, reusable-height versus one-assignment wording/notes, retained full facts. |
| AT-026/027 | Actual non-owner two-session Main race, one-Main unique boundary, atomic demotion/clear, valid and stale/forged Undo, idempotent replay after lost response. |
| AT-028/029/030 | Exact fixture order/count8/6, pool exclusion, direct Shortlist visible in Selection, Option-only populated, per-output Pending, no writable Selection flag. |
| Lifecycle compatibility | Resize/archive confirmed scope; project removal affects only its assignments; duplicate same-slot collapse preserves ID/OR/position/notes/support/media pins; protected M02 note and unrelated-workspace source correction retained. No global table-existence503 regression. |
| AT-032/033 | Actual template/fallback fit and repair, full manual route, bounded source-only WF-05 run, no inferred facts/automatic casting decision; HTTP/MCP request/result/error parity and contributor denials. |
| Freshness/M05 interface | Shared project/client/profile mutation invalidates review fingerprint; template/output/policy/source changes covered; one consistent ordered render-input projection; no ready/version/guest claim from M04. |
| Browser/accessibility | Persistent reload/save failures, responsive Casting/Review, keyboard alternatives to drag, focus return, clear stale-state repair and permission-specific controls. Automated checks alone are not a WCAG conformance claim. |
| Release | Fresh nonempty local baseline, exact old-row/catalog/runtime/config preservation, bounded target/history/source seals, rollback/forward-fix strategy, separate actual cloud/app evidence. No seed/reset/identity recreation; hosting deferred. |

Mark M04 verified only after its required implemented paths and evidence exist. Root owns `PROGRESS.md`, `tracking/progress.json`, `tracking/HANDOFF.md` and milestone acceptance updates; this planning document changes none of their statuses.
