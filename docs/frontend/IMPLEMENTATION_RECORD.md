# Frontend implementation record

This record covers the frontend redesign (presentation and interactions) only. Codex owns the canonical milestone progress, `tracking/*` and the handoff files.

| Item | Value |
|---|---|
| Branch | `frontend/redesign` |
| Worktree | `D:\Everyone\Presentation\Everyone-Presentation-Studio-Frontend` |
| Baseline | `main` @ `93981ca` |
| Design references | `redesign-output/` (copied untracked from the main checkout), `Design Elements/assets/brand/tokens.css`, `docs/experience/SITEMAP_AND_PAGES.md`, `docs/experience/PRESENTATION_TEMPLATE.md` |
| Route / interaction map | [ROUTE_INTERACTION_MATRIX.md](ROUTE_INTERACTION_MATRIX.md) |

## Decisions and assumptions applied

1. **Open design decisions.** `redesign-output/README.md` lists three open decisions; `README.md` has no list of four. The product owner approved these defaults on 2026-10-31:
   - **Role reorder:** an "Order" dialog with a keyboard list (move up / move down) as well as drag. There is no drag-only path (AT-071).
   - **Mobile global navigation:** a menu sheet opened from the top bar. It lists all five destinations plus recent workspaces.
   - **Bulk actions in the Candidates table:** out of v1, because there are no bulk endpoints.
2. **Fonts.** General Sans is absent from the repository. The UI uses IBM Plex Sans and IBM Plex Sans Arabic (Medium and SemiBold, SIL OFL, already in `apps/web/public/fonts`) as the recorded development substitute (X-004). The font stack still names General Sans first, so licensed files can be dropped in later.
3. **Tokens.** The canonical names in `tokens.css` win; the `ds.css` values map onto them. These mockup sizes are adopted:
   - sidebar 232 px
   - top bar 56 px
   - page title 26 px
   - control height 36 px
4. **No invented data.** Counts and summaries that the API does not serve are omitted rather than estimated:
   - per-step counts in the workspace header
   - project-list slot fill and "latest output"
   - Cast Library totals
   - guest feedback summary
   - per-file batch marks
5. **Browser dialogs.** `window.confirm` is being replaced by an accessible `alertdialog` (`useConfirm`). The button names state the consequence, and Cancel takes initial focus. Remaining native confirms are listed under Open frontend work.
6. **Output control.** The working-output control is a segmented "Cast Selection / Cast Shortlist" toggle in the workspace header. It was previously a select labelled "Working output". On Casting, Review and Presentation in central mode, the casting board's existing Selection / Shortlist control stays the only one, so no two controls share a name.
7. **Role ordering form.** The approved "Order dialog" is a non-modal "Change role order" panel inside the Specs Roles section. It is a keyboard list with Move up / Move down for each role. It is non-modal so that "Reload saved requirements" and order retry stay reachable while ordering; a modal would trap focus away from that recovery path. Casting keeps compact earlier/later buttons and a drag handle on each role chip.
8. **Casting layout.** The board focuses one role at a time through a role strip, and that role's slots render as lanes. The mockup shows every role's lanes at once, but each slot's assign control (the "Project candidate" list) would then repeat across all roles under one name. Narrow screens use the same strip, as the mobile concept does.
9. **Inline overlays.** The candidate inspector, assignment notes and casting-removal review render their drawer or modal inside the owning row (fixed to the viewport; no portal). Focus trap, Escape and focus return are unchanged, and the owner's DOM scope still contains its controls.
10. **English transcripts (Codex contract, 2026-10-31).** Display uses only `english_transcript` / `english_text` when the status is available. Every other status shows an English absence message. There is no language selector and no fallback to the original-language transcript. Applied in batch 6 (`components/english-transcript.tsx`, `SourceTranscript`, the candidate profile and the internal review source panel).

11. **Sharing stays on its page.** Link create, copy-once, expiry, PDF permission, extend, revoke and rotate keep the restyled sharing page (`/presentations/series/{id}/sharing`) rather than the drawer in the concept. That page holds the dense link-confirmation, expiry and rate-limit contracts (the `m06-*` specs). The viewer's "Share and review" action links to it.
12. **Guest canvas.** The guest shell uses the brand light-theme tokens on a warm `#f6f4ef` canvas. The registered slide template keeps its own colours.

## Design system (batch 1)

| Area | Location |
|---|---|
| Cascade | `apps/web/app/globals.css` declares the layer order `base, components, features, screens`. |
| Element defaults and UI fonts | `styles/base.css` |
| Shared controls | `styles/components.css`: buttons (primary, quiet, danger, danger-quiet, small, icon); segmented control; tabs; badges (ok, warn, bad, info, outline, pending, dot); Main / Option / Backup position chips; Shortlist star; filter chips; fields and form grids; stepper; toggle; search field; save state; panel, card, kv and metric; data table; notices; empty, loading, skeleton and permission states; drawer, modal, menu, toast and sticky bar; layouts (`split-rail`, `split-source`, `board-tray`, `facet-layout`). |
| Shell, workspace header, sign-in | `styles/shell.css` |
| Rules still owned by unrebuilt screens | `styles/features.css` (moved verbatim from the old `globals.css`; screens leave it as they are rebuilt) |
| Redesigned screen layouts | `styles/screens.css` |
| React primitives | `components/ui/Overlay.tsx` (`Drawer`, `Modal`, `ConfirmModal`, `useFocusTrap`: focus trap, Escape, focus return, `aria-modal`); `components/ui/Menu.tsx` (menu-button pattern with arrow, Home and End keys); `components/ui/Toast.tsx` (polite live region with an optional Undo action); `components/ui/Confirm.tsx` (`useConfirm`) |
| Icons | `components/Icon.tsx`, extended with 28 glyphs |

## Screen coverage

| Screen | Status | Notes |
|---|---|---|
| Shell: sidebar, top bar, mobile sheet, recent workspaces | done | The environment status sits in the top bar; the banner shows only below 768 px. |
| Development sign-in | restyled | Labels and requests are unchanged. |
| Central sign-in (`BusinessSignIn`) | restyled | Request and callback logic is unchanged. |
| OAuth consent | unchanged | Its CSS module already uses the shared tokens. Visual changes are deferred until coordinated with Codex. |
| Projects list and project panel | done | Table, filter, panel (workspace status, last updated, logo placement, ready series in central mode, planned modules) |
| Workspace header and steps | done | Breadcrumb, unpublished-changes badge, output toggle, Review & generate |
| Project step | done | Details panel with autosave and technical details, Next up links, client branding with a live cover preview and segmented placement |
| Specs | done | Source/editor split; role summary rows with a three-column grid; "Change role order" panel; removal-consequence dialog; confirm dialogs |
| Candidates | done | Tabs; summary rows (portrait, three frame slots, availability, attention badges); inspector drawer (material, frames up to 3, notes, files, new introduction) |
| Casting | done | Role strip; slot lanes; compact cards with position chip, Shortlist star and actions menu; Main Undo toast; notes drawer; candidate tray |
| Review | done | Grouped checks (blocks / needs attention / information), slide list, assignment inspector, sticky context rail with draft summary and page strip |
| Saved version viewer | done | Slide rail, App view / PDF preview (all frames together), Left/Right slide keys, frame carousel unchanged |
| Transcripts | done | English-only display per the Codex contract; explicit absence states; no original-language fallback |
| Cast Library | done | Facet sidebar (supported parameters only), review radio group, include-missing toggle, removable chips, grid or list, duplicate and unknown marks |
| Candidate profile | done | Media-first two-column layout; archive confirm dialog |
| Guest review | done (visual) | Light canvas, logo and primary contrast; flow, token handling and feedback logic unchanged |
| Processing | restyled | Status text plus tone; grouping by project and batch was already in place |
| Settings, Presentations index, sharing page, presentation generation step | restyled | Shared panels, controls and notices; layouts not rebuilt yet |

## Checks

| Date | Check | Environment | Result |
|---|---|---|---|
| 2026-10-31 | Baseline `npm run lint`, `npm run typecheck` | Worktree at `93981ca`, unmodified | Pass |
| 2026-10-31 | Baseline `npx playwright test` (99 tests) | `local_fixture` test server | 98 passed, 1 failed: `source-intake-ui.spec.ts:196`. The retried job stays "Failed" instead of "Queued". It reproduces twice on unmodified code, so it is a pre-existing backend or fixture issue. |
| 2026-10-31 | Batch 1–2: lint and typecheck | Worktree | Pass |
| 2026-10-31 | Batch 1–2: full `npx playwright test` (99 tests) | `local_fixture` test server | 98 passed. The only failure is the same pre-existing `source-intake-ui.spec.ts:196`. An earlier run caught two regressions, both fixed before commit: the toast region's `role="status"` collided with bare `getByRole('status')`, and a hidden file input overflowed horizontally. |
| 2026-10-31 | Browser screenshots at 1440 × 900 and 390 × 844: sign-in, Projects, Project step, navigation sheet | `next dev`, `local_fixture`, data directory outside the repo | No console errors. The 390 px shots are layout evidence only, not mobile acceptance. |

| 2026-10-31 | Batches 3, 4 and 5: lint, typecheck, full e2e after each | `local_fixture` test server | 98 passed each time; only the pre-existing `source-intake-ui.spec.ts:196` failed. Fixed before commit: a legacy list gap, grid `min-width` overflow at 320 px, and the drawer reopening after Undo. |

| 2026-10-31 | Batches 6, 7 and 8–9: lint, typecheck, full e2e after each | `local_fixture` test server | 98 → 99 passed (the new `cast-library-ui` spec added one); only the pre-existing `source-intake-ui.spec.ts:196` failed. |
| 2026-10-31 | Screenshot review: Specs, Candidates list and drawer, Casting board and menu, Review, version App/PDF views, guest page at 390 px | Mocked central-mode specs plus temporary screenshot probes (probes reverted, not committed) | Visual only. The 390 px views are layout evidence, not mobile acceptance. |

**Test updates.** Native `dialog` handlers became in-app alert-dialog clicks in these specs:
- `source-intake-ui`
- `specs-ui`
- `file-source-intake-ui`

UI moves needed one extra click in these specs; no assertion was weakened:
- `role-order-ui`: open "Change role order" first.
- `candidate-pagination-ui`, `casting-retirement-ui`, `retirement-undo-ui`: open the candidate inspector first.
- `casting-board-ui`: the locked-state check targets the card actions menu, which is where Set as Main moved.
- `version-transcript-ui`, `review-ui`: fixtures carry the English group. Assertions check the English text and that the original-language text is not displayed; the legacy no-group case shows "not captured".
- New: `cast-library-ui`.

**Environment note.** `tools/dev-test-server.mjs` puts `EPS_DATA_DIR` inside the repository (`.local/e2e-studio`). Turbopack watches that directory, so `next dev` recompiles after every fixture write and the browser keeps reloading. Playwright still passes, but interactive browsing needs a data directory outside the repository. This is reported, not changed, because the server script is shared.

## Backend dependencies for Codex

1. **`GET /workspaces/{id}/summary`**
   - Returns `{ roles_needing_clarification, project_candidate_count, unreviewed_candidate_count, open_slot_count, assignment_count: { selection, shortlist }, latest_ready_versions: [{ series_id, output_type, version_no }], review_issue_count | null }`.
   - Read-only. Requires `workspaces.read`.
   - Used for the step statuses and Selection / Shortlist counts in the workspace header, and for the "Next up" items with real counts.
2. **`GET /versions/{id}/feedback/summary`**
   - Returns `{ per_slide: [{ version_slide_id, preferred, maybe, not_preferred, comment_count, unresolved_count }], totals }`.
   - Only external feedback is counted for guests; internal counts appear only with `workspaces.read`.
   - Replaces the per-slide counts the UI currently builds from loaded responses.
3. **`GET /jobs?batch_id=`**
   - Adds a batch filter, plus an optional `GET /job-batches/{batch_id}` returning `{ total, by_status }`.
   - Provides per-file batch marks without paging every job.
4. **Optional `total` on list pages**
   - For `/candidates` and `/projects`.
   - Used for the sidebar and Cast Library counts. Without it, the UI omits counts.
5. **Retry from a fixture-failed job.** See the baseline failure above, `source-intake-ui.spec.ts:196`.

## Open frontend work

1. **Remaining native confirms:**
   - `GuestReviewView` (discard unsent comment)
   - `ReviewFeedbackPanel` (role/slot switch with an unsent comment)
   - `SupportingFiles` (archive)

   Guest specs answer these natively today. Convert them together with those specs.
2. **Guest preferences.** Preferred / Maybe / Not preferred are still buttons. The PRESENTATION_TEMPLATE §4 target is a radio group, which needs its specs updated (`guest-review-ui`, `m06-review-findings`).
3. **Layouts not yet rebuilt** (styled through the shared system only):
   - share drawer (see decision 11)
   - presentations index with series rename and archive (`update_presentation_series` has no UI)
   - processing job detail drawer and per-file batch strip
   - sectioned Settings with scope-before-save text
   - presentation generation step
   - Specs headcount stepper (the existing count field and slot editor are restyled)
   - moving an assignment to another slot (order within a slot works)
   - inline repair buttons in Review groups (repair text is shown)
4. **Keyboard alternatives.** Casting cards use the slot "Project candidate" list. A tray-level "assign selected person" shortcut (A key) from the concept is not built.
5. **Accessibility checks.** Run an automated contrast and axe pass once `@axe-core/playwright` is approved as a dev dependency. Codex owns dependency changes.

## Pending acceptance (unchanged by this work)

- **AT-072:** manual screen-reader acceptance is still pending until someone actually performs it.
- **Mobile acceptance:** remains skipped (owner decision, 2026-10-30). Responsive layouts are implemented and screenshot-checked only.

## Commits

| Commit | Batch | Summary |
|---|---|---|
| 2e102c8 | 1–2 | Design system layers, UI primitives, shell, Projects, workspace header, Project step, frontend records |
| 1fbd5f6 | 3 | Specs split view, role rows, ordering panel, retirement dialog |
| 166485c | 4 | Candidates tabs, summary rows, inspector drawer |
| 6bb7d6d | 5 | Casting lanes, card menu, Main Undo toast, notes drawer, tray |
| c9677aa | — | Record update |
| 8aed642 | 6 | Review rail, version viewer, English-only transcripts |
| 0ada675 | 7 | Cast Library facets, media-first profile, `cast-library-ui` spec |
| cb378b2 | 8–9 | Guest light canvas, toned processing status |
