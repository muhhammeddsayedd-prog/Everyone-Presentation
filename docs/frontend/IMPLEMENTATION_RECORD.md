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
5. **Browser dialogs.** `window.confirm` is being replaced by an accessible `alertdialog` (`useConfirm`). The button names state the consequence, and Cancel takes initial focus. Remaining call sites are converted as each screen is rebuilt.
6. **Output control.** The working-output control is a segmented "Cast Selection / Cast Shortlist" toggle in the workspace header. It was previously a select labelled "Working output". On Casting, Review and Presentation in central mode, the casting board's existing Selection / Shortlist control stays the only one, so no two controls share a name.

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
| Specs, Candidates, Casting, Review, Presentation, Library, Profile, Guest, Processing, Settings | restyled | Rebuilt in batches 3–9. They already use the new controls, panels and notices. |

## Checks

| Date | Check | Environment | Result |
|---|---|---|---|
| 2026-10-31 | Baseline `npm run lint`, `npm run typecheck` | Worktree at `93981ca`, unmodified | Pass |
| 2026-10-31 | Baseline `npx playwright test` (99 tests) | `local_fixture` test server | 98 passed, 1 failed: `source-intake-ui.spec.ts:196`. The retried job stays "Failed" instead of "Queued". It reproduces twice on unmodified code, so it is a pre-existing backend or fixture issue. |
| 2026-10-31 | Batch 1–2: lint and typecheck | Worktree | Pass |
| 2026-10-31 | Batch 1–2: full `npx playwright test` (99 tests) | `local_fixture` test server | 98 passed. The only failure is the same pre-existing `source-intake-ui.spec.ts:196`. An earlier run caught two regressions, both fixed before commit: the toast region's `role="status"` collided with bare `getByRole('status')`, and a hidden file input overflowed horizontally. |
| 2026-10-31 | Browser screenshots at 1440 × 900 and 390 × 844: sign-in, Projects, Project step, navigation sheet | `next dev`, `local_fixture`, data directory outside the repo | No console errors. The 390 px shots are layout evidence only, not mobile acceptance. |

**Test updates.** `source-intake-ui.spec.ts` and `specs-ui.spec.ts` now answer the in-app "Leave this page?" alert dialog instead of a native browser dialog.

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

## Pending acceptance (unchanged by this work)

- **AT-072:** manual screen-reader acceptance is still pending until someone actually performs it.
- **Mobile acceptance:** remains skipped (owner decision, 2026-10-30). Responsive layouts are implemented and screenshot-checked only.

## Commits

| Commit | Batch | Summary |
|---|---|---|
| (this commit) | 1–2 | Design system layers, UI primitives, shell, Projects, workspace header, Project step, frontend records |
