# M04 — Casting assignments, Selection/Shortlist and final review

**Dependencies:** M03 reusable candidates/media; M02 roles/slots. **Next:** M05. **Runnable slice:** producer builds both casting outputs from one workspace and reviews facts/frames/wording before generation.

## Required context

Read baseline/progress/handoff; PRD; data schema/security/transaction contracts, especially assignment uniqueness and Main transaction; API/operation index and slide-wording JSON schema; AI specification; Casting/Review page contracts; presentation template and fixtures; TEST_STRATEGY. Read the exact ten presentation fields and their data ownership.

## Non-negotiable product rules

BR-006, BR-010, BR-013–BR-020, BR-022–BR-024, BR-030–BR-031. Every headcount slot is individual. Same candidate may be assigned independently to several slots/roles. At most one active candidate assignment per slot for the same person. New assignment is Option; zero/one Main, any number Backups/Options.

Selection includes every active assignment. There is no editable include-in-Selection switch. Shortlist inclusion is explicit, independent from position. Adding directly in Shortlist creates the assignment visible in Selection. The unassigned project pool does not create slides. An empty output slot will get Pending; Options-only slots are populated. Missing facts, Unreviewed candidate, no Main and fewer frames remain allowed after clear review.

Reusable corrections save to canonical/library facts and affect future drafts. Project availability stays on workspace candidate. Assignment-specific presentation notes and short display wording stay on the assignment. Confirming a factual profile marks Reviewed but does not approve booking. Clause applies equally to permitted Claude. Optional AI may propose wording; it never decides Shortlist or invents facts.

## Build sequence

1. Implement assignment create/update/archive, reorder and explicit shortlist field, backed by DB uniqueness for active candidate+slot and max-one Main. Enforce that slot/workspace/candidate relation belongs to the same workspace. Do not depend on UI button disabling for integrity.
2. Implement atomic `set_slot_main`: lock slot, validate actor/current row versions, demote existing Main to Backup by documented default, promote selected assignment, record audit and return changed rows. Undo uses current revisions and a validated inverse transaction; it cannot undo someone else's intervening change blindly.
3. Build Casting board with role sections/slot cards, candidate add/remove, positions, Shortlist inclusion, explicit drag/reorder plus accessible keyboard alternatives. Selection/Shortlist toggle changes output view, not underlying candidate identity. Show counts by output/role/slot and pending state accurately.
4. Support assigning the same person to a second role without copying a profile. Removing one assignment preserves other roles and shared library data. Removing a workspace candidate with active assignments must expose affected choices and use a clear confirmed operation; do not silently orphan references.
5. Implement minimal presentation-series create/reuse/read and template-context selection now, before final review. The producer chooses output/audience/template; `get_workspace_review` requires that exact `series_id` so its fingerprint matches future generation. Build Review list/drawer combining requirements, assignment context, facts, frames, source transcript/video, availability, notes and template wording. Show source-backed values and Not provided. Distinguish reusable profile edit from presentation-only wording. Review confirmations require current revision/fact fingerprint to avoid confirming stale values. M05 extends this foundation with generated versions.
6. Implement direct field correction and Reviewed transition under cast.write/cast.review, with audit. Contributor can prepare permitted project data but cannot confirm library facts. An agent with producer authority uses identical operation, not a human-only gate.
7. Add deterministic preflight calculation: empty slots, missing fields, fewer/no media, unreviewed profiles, stale source issues and long wording. Missing content produces warnings. Single-slide overflow produces actionable field/length/layout warning to resolve before final render. Do not silently clip text or drop fields.
8. Implement optional contextual AI wording suggestion using only selected supplied text/facts and desired field budget, grounded output schema, no side effects until applied. UI previews and actor applies/edits; Claude may request and apply through same operations. Full profile remains intact.
9. Track meaningful working-draft changes since last ready generation for display. Do not implement a general specs/fact-conflict version product. Change summary can show added candidate/new media/position/wording facts sufficient to understand what will change in next output.

## API and data completion

Implement `create_assignment`, `update_assignment`, `set_slot_main`, `remove_assignment`, `reorder_workspace`, `get_workspace_review`, `create_ai_suggestion`, minimal `create_presentation_series`/series read/list and candidate/availability edits and review confirmation as specified. Add/reuse the presentation_series table with audience snapshot identity and selected template context; no rendering yet. All actor access, row_version and idempotency checks apply identically through HTTP/UI/MCP. Return affected rows after atomic Main operation so clients can update reliably.

Use query views/projections for Selection and Shortlist; do not store contradictory selection flags. Define stable page order: explicit role order, slot order, assignment order. Position change does not silently reorder. Store full fields separate from any `slide_wording` overrides; all overrides still must be truthful and complete for their field.

## Acceptance scenarios

- Same person Father and Manager has independent position, Shortlist and notes. One profile correction appears in both future draft pages; one assignment-note edit appears only there.
- Add three options to one slot; set one Main, replace with another; exactly one Main exists. Simultaneous producer/API/Claude Main changes serialize or return a stale conflict with no duplicate Main.
- Shortlisted Option is valid; non-shortlisted Main is valid; Selection contains both. Unassigned project candidate excluded. Adding directly to Shortlist also appears in Selection.
- Removing assignment preserves other slots and library media; resizing roles follows affected-assignment safety; old version snapshots later remain unchanged.
- Empty slot, no Main, missing height, Unreviewed status and two-frame candidate can pass content review with accurate warnings; no facts are fabricated.
- Full reusable experience remains saved after shorter slide wording applied. AI cannot add unprovided credits, measurement or availability.
- Unauthorized contributor denied shared fact review/edit; permitted human/Claude can confirm. Profile row_version changes between display and confirmation produce explicit stale response.
- Preflight page projection matches fixture order/counts intended for M05: Selection 8 pages, Shortlist 6 for the included happy-path fixture. Counts are independently derived from assignments, not hardcoded output labels.
- All direct controls keyboard usable; status changes persist after reload and show accurate save errors.

## Demonstration and handoff

Demonstrate role → add candidate from library → assign same person elsewhere → mark Main/Backup → include explicit Shortlist → correct reusable fact → shorten presentation text → confirm profile → review with open slot. Record meaningful domain/DB/concurrency/browser/API tests and migrated constraints. M05 should receive a deterministic, validated render-input projection and complete review actions, not unresolved assignment semantics. Update ledger and next-action handoff.

## Codex execution prompt

> Implement M04's casting board and final review using shared transactions and exact Selection/Shortlist rules. Prove one-Main concurrency, independent multiple-role assignments, permission-correct profile confirmation and truthful display wording. Preserve missing-content flexibility. Prepare deterministic output projection and hand off to generation with actual test evidence.
