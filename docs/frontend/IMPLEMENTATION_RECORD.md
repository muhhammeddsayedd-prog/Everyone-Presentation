# Frontend implementation record

This record covers the frontend redesign (presentation and interactions) only. Codex owns the canonical milestone progress, `tracking/*` and the handoff files.

| Item | Value |
|---|---|
| Branch | `frontend/redesign` |
| Worktree | `D:\Everyone\Presentation\Everyone-Presentation-Studio-Frontend` |
| Baseline | `main` @ `93981ca`; `main` @ `009536e` merged in as `91b8e9d` (canonical English transcript types) |
| Design references | `redesign-output/` (copied untracked from the main checkout), `Design Elements/assets/brand/tokens.css`, `docs/experience/SITEMAP_AND_PAGES.md`, `docs/experience/PRESENTATION_TEMPLATE.md`, `docs/integrations/ENGLISH_TRANSCRIPT.md` |
| Route / interaction map | [ROUTE_INTERACTION_MATRIX.md](ROUTE_INTERACTION_MATRIX.md) |

## Presentation-first redesign (from 2026-11-05)

A second redesign brings the app to the approved concept in `Screenshots 2 Improved Design/` (204 screens, same names as `Screenshots 2/`). It runs on branch `frontend/presentation-first` in worktree `D:\Everyone\Presentation\Everyone-Presentation-Studio-PresentationFirst`, from `main` @ `def3c848`. The approved plan has six phases (P0–P5), each merged to `main` only after its gate passes.

Owner decisions (2026-11-05):
- The live slide preview is computed in the browser, using the existing `projectReviewSlides` and `composeCastingDeck`. The server review stays the authority for checks and for generating versions.
- Rollout is phased.
- The uncommitted collapsible sidebar on `frontend/responsive` is superseded and will not be merged.
- The UI font is General Sans. It is self-hosted under the ITF Free Font License, which permits self-hosting. This replaces decision 2 below.

| Phase | Scope | Status |
|---|---|---|
| P0 + shell | General Sans. Frame tokens. `components/shell/Frame.tsx`: `AppFrame`, `TopBar`, `IconRail`, `RailLink`, `FramePortal`. `components/shell/PageFrame.tsx`: `PageFrame` with `ConfigPanel` and `RightPanel`. `components/shell/preferences.ts`: panel state stored as `eps.panel.v1` (try/catch), plus `useMediaQuery` and `useHydrated`. `app/styles/frame.css`. The icon rail replaces the sidebar and menu sheet. The workspace title, output toggle and Review & generate move into the top bar. The six steps become the rail's second group with unchanged link names. Under 768 px the rail is a bottom tab bar. Recent workspaces are in a rail menu that opens beside it. The panel collapses with Ctrl/Cmd+\ at ≥1280, is an overlay at 768–1279 and a bottom sheet under 768. Ported from `frontend/responsive`: fixed-position `ActionMenu`, the share-drawer aria-busy wait, and the media-query hooks. | Verified (mock) |
| P1 global pages | Config panels and grids for Projects, overview, Cast Library, profile, Presentations, Processing, Settings | Not started |
| P2 workspace editor + live stage | `WorkspaceDraftProvider`, `useDraftDeck`, `LiveStage`, `SlideStrip`; steps become panels | Not started |
| P3–P5 | Review, versions, sharing, guest, mobile, hardening | Not started |

P0 checks (local, `local_fixture` and mocked API, 2026-11-05):
- `npm run lint`, `npm run typecheck`, `npm test` and `npm run check:production-guard`: all pass.
  - In one earlier interrupted run, 8 worker child-process tests failed under machine load. `npm run test:worker` then passed 270/270 on this branch and on `main`, and the rerun of the gate passed.
- `npx playwright test`: 150 of 151 passed. The failure was `processing-ui` "controlled active detail polls…", a test race.
  - Cause: the list and the detail refresh on the same tick, and a list read still in flight landed after the read count was taken. It failed 1 in 6 on this branch and 0 in 6 on `main`.
  - Fix: the spec now waits for the read count to settle before fast-forwarding 30 s. It then passed 12/12.
- New `tests/e2e/frame-ui.spec.ts` (3 tests): rail names, current page, tooltip on focus and axe; the recent-workspaces menu (keyboard use, opens beside the rail); the bottom bar at 390 px with no overflow at 390 or 320 px. All pass.
- Visual comparison with `Screenshots 2 Improved Design/` at 1440, 1024 and 390 px: the frame matches. Page bodies keep their previous layout until P1 (global pages) and P2 (workspace editor and live stage).

## Status vocabulary

These four values are used here and in the matrix.

| Status | Meaning |
|---|---|
| **Verified (mock)** | Implemented and verified by specs against mocked central responses or the `local_fixture` server. No connected backend has been checked. |
| **Awaiting connected** | Implemented and verified with mocks. It still needs a run against the connected pilot backend with synthetic data. |
| **Restyled** | Uses the shared design system, but some interaction work in the contract remains. The work is named in the row. |
| **Blocked** | Needs a missing backend contract. See Backend dependencies. |

No journey in this record has been verified against the connected pilot backend from this worktree. Everything marked verified is mock or fixture evidence (see Checks).

## Decisions and assumptions applied

1. **Open design decisions** (approved by the product owner, 2026-10-31).
   - **Role reorder:** keyboard ordering with move up / move down, as well as drag. There is no drag-only path (AT-071). See decision 7 for the form it takes.
   - **Mobile global navigation:** a menu sheet opened from the top bar. It lists all five destinations plus recent workspaces.
   - **Bulk actions in the Candidates table:** out of v1, because there are no bulk endpoints.
2. **Fonts.** General Sans is absent from the repository. The UI uses IBM Plex Sans and IBM Plex Sans Arabic (SIL OFL), the recorded development substitute (X-004). The stack still names General Sans first.
3. **Tokens.** The canonical `tokens.css` names win, and the `ds.css` values map onto them. Adopted sizes:
   - sidebar 232 px
   - top bar 56 px
   - page title 26 px
   - control height 36 px
4. **No invented data.** Counts the API does not serve are omitted rather than estimated:
   - step counts in the workspace header
   - project slot fill
   - library totals
   - feedback summaries
   - batch totals across pages

   Counts that are shown are computed from loaded rows and say so when they are partial: casting coverage per role, batch strip counts, feedback preference counts.
5. **Confirmations.** Every former `window.confirm` is an accessible `alertdialog` (`useConfirm`). The dialog names the consequence, Cancel takes initial focus, and the old behaviour (cancel keeps the unsaved work) is preserved. Guest pages have their own provider.
6. **Output control.** The workspace header has a segmented "Cast Selection / Cast Shortlist" toggle. On Casting, Review and Presentation in central mode, the board's own Selection / Shortlist control is the only one.
7. **Role ordering form (intentional UX decision).** Specs orders roles in a non-modal "Change role order" panel: a keyboard list with Move up / Move down. It is non-modal on purpose, so that "Reload saved requirements" and order retry stay reachable while ordering; a modal would trap focus away from recovery. Casting keeps compact earlier/later buttons and a drag handle on each role chip.
8. **Casting layout.** The board opens on **All roles**, the approved overview: every role's slot lanes, with a coverage line per role. **One role** is kept as a focused view, and on narrow screens it plays the role-selector part of the mobile concept. Repeated controls carry their slot or person in the accessible name, for example "Project candidate for Father 1", "Assign as Option to Father 1" and "Include Karim in Shortlist for Father 1". Specs scope to the intended slot region.
9. **Inline overlays.** The candidate inspector, assignment notes and casting-removal review render their drawer or modal inside the owning row (fixed to the viewport). The DOM scope still contains its controls.
10. **Focus trap.** Overlays answer Escape and Tab at document level, for the top-most overlay only, and pull stray focus back. This fixes a case where a control disabled mid-write left focus on `body`.
11. **English transcripts.** Only `english_transcript` / `english_text` are displayed. The canonical types come from `@eps/domain` (main `35cd663`). The client mirrors the shared group rules:
    - a group is all-or-nothing, and a partial group is invalid
    - English text must be Latin-script
    - an available version capture needs a 64-hex hash
    - a missing legacy group means "not captured"
    - original-language text is never displayed

    There is no language selector.
12. **Sharing.** The "Share for review" drawer, opened from the saved version and the Presentation step, and the `/presentations/series/{id}/sharing` page embed the same `ReviewLinksPanel`. Link create, copy-once, expiry, PDF, extend, revoke and rotate therefore have one implementation. Internal-audience and archived series explain why they cannot be shared.
13. **Guest canvas and preferences.** The guest shell uses the brand light-theme tokens on a warm canvas.
    - **Controls:** Preferred / Maybe / Not preferred is a native radio group. Arrow keys move and save the choice.
    - **Checked state:** follows the confirmed save only.
    - **During a save:** the radios stay focusable and changes are ignored. The group locks only while an outcome is uncertain.
14. **Processing detail.** `?job=` keeps the job list and opens the job detail in a drawer. The URL stays shareable.
15. **No cross-slot move.** See Backend dependencies, item 5.

## Design system

| Area | Location |
|---|---|
| Cascade | `apps/web/app/globals.css`, layers `base, components, features, screens` |
| Element defaults and UI fonts | `styles/base.css` |
| Shared controls, data display, overlays, layouts | `styles/components.css` |
| Shell, workspace header, sign-in | `styles/shell.css` |
| Legacy feature rules still in use | `styles/features.css` |
| Screen layouts | `styles/screens.css` |
| React primitives | `components/ui/Overlay.tsx` (`Drawer`, `Modal`, `ConfirmModal`, `useFocusTrap`), `components/ui/Menu.tsx`, `components/ui/Toast.tsx`, `components/ui/Confirm.tsx` |

## Screen coverage

| Screen | Status | Notes |
|---|---|---|
| Shell, navigation sheet, recent workspaces | Verified (mock) | |
| Development sign-in | Verified (mock) | Fixture server; labels and requests unchanged |
| Central sign-in | Restyled | Logic unchanged. The connected magic-link flow is Codex's verified path and was not re-run here. |
| OAuth consent | Unchanged | Specs pass; no visual change without coordination |
| Projects, project panel | Verified (mock) | Fixture server |
| Workspace header, Project step, logo | Verified (mock) | Fixture server with real logo bytes (`foundation`) |
| Specs | Verified (mock) | Split view, role rows, ordering panel, headcount stepper (buttons, arrow keys), retire-slots dialog, confirm dialogs |
| Candidates | Verified (mock) | Tabs, summary rows, inspector drawer, frames up to 3, files, new introduction |
| Casting | Verified (mock) | All-roles overview and One role view, coverage per role, card menu (Main / Option / Backup, notes, order, inspect, remove), Main Undo toast, keyboard tray assignment, contextual names |
| Review | Verified (mock) | Grouped checks with repair actions (measure fit; open the assignment inspector with focus; go to Candidates, Casting, Specs, branding or the profile), inspector, context rail |
| Presentation step (generation) | Verified (mock) | Draft beside series context, preflight summary (blocking first), stale-draft notice, uncertain-request confirmation, history and viewer |
| Saved version viewer | Verified (mock) | Slide rail, App view / PDF preview, slide keys, Share for review drawer |
| Presentations index | Verified (mock) | Rename (validated), archive (confirmed), restore, stale-write message, permission gating |
| Sharing page and drawer | Verified (mock) | One shared link panel; copy-once, expiry, extend, revoke, rotate specs unchanged |
| Transcripts | Verified (mock) | English-only, including partial, non-English, unavailable and legacy groups |
| Cast Library, candidate profile | Verified (mock) | Facets, chips, missing-values toggle, grid or list, media-first profile, archive confirm. The supporting-file archive confirm is implemented but not yet covered by a spec. |
| Guest review | Verified (mock) | Light canvas, preference radio group (keyboard, save feedback, refused-save recovery), unsent-comment guard |
| Processing | Verified (mock) | Job drawer (state, stage, progress, safe failure, retry and cancel), batch file strip with page-scoped counts |
| Settings | Verified (mock) | Sectioned rows with a "What this changes" column, permission note, preset archive confirm. Defaults validation, uncertain save and conflict are unchanged. |
| Step and summary counts | Blocked | Backend dependencies 1–4 |
| Move assignment to another slot | Blocked | Backend dependency 5 |

## Checks

| Date | Check | Environment | Result |
|---|---|---|---|
| 2026-10-31 | Baseline lint, typecheck, e2e (99) | Worktree at `93981ca`, fixture and mock server | Lint and typecheck pass; e2e 98 passed. `source-intake-ui:196` failed (later explained, see Source-intake retry below). |
| 2026-10-31 | Batches 1–9 | Same | Recorded per commit; 98–99 passed, only `source-intake-ui:196` failing |
| 2026-10-31 | Continuation: per-group focused specs | Port-3110 copy of the test server (`.local/pw`, untracked), because another checkout holds port 3100 | All groups passed before each commit |
| 2026-10-31 | axe-core 4.10.2, WCAG 2.2 A/AA (including colour contrast), injected after each of 42 journey end states across 14 specs | Same server; axe loaded from an isolated install, not a project dependency | 38 of 42 clean on the first pass. Two Studio findings (`aria-prohibited-attr` on a labelled filter-chip container and the frame strip) were fixed and re-audited clean. Two findings were on the external OAuth client callback page (a test stand-in for Claude's localhost receiver), which is out of scope. No contrast violations. |
| 2026-10-31 | Completion gate: `npm run lint`, `npm run typecheck`, `npm run build` (production), full e2e (113 tests) | Worktree at the completion head. E2E ran on the port-3110 copy of the fixture and mock test server. | Lint, typecheck and build pass. E2E: 111 passed and 2 failed on the first run. Both failures were `api-contracts`, which hard-coded the 3100 origin. That origin is now overridable with `EPS_E2E_ORIGIN` (default unchanged), and both re-ran green. Result: 113 of 113 pass. |

**Source-intake retry (previously failing on baseline).** `source-intake-ui:196` failed because its mock answered `POST /jobs/{id}/retry` with the whole Job. `contracts/openapi.yaml` defines `202 JobAccepted {job_id, resource_id, poll_url, status}`, and the UI correctly rejects any other shape. The mock now returns the contracted acknowledgement (commit `80bfb80`); the assertions are unchanged. No frontend or backend defect was involved.

**Port independence.** Two specs assumed port 3100:
- `file-source-intake-ui`: its storage mock now echoes the app's own origin.
- `api-contracts`: its request origin reads `EPS_E2E_ORIGIN`, with the default unchanged.

Intent and assertions are unchanged.

### Test updates since the checkpoint

| Spec | Change |
|---|---|
| `guest-review-ui` | Preference by radio, plus a "Preference saved" status assertion |
| `casting-board-ui` | Repeated controls scoped by slot names; new overview and keyboard tray test |
| `specs-ui` | Stepper buttons and arrow keys |
| `review-ui` | Follows a repair into the inspector and checks focus |
| `processing-ui` | Failure text scoped to the job drawer |
| `version-transcript-ui` | Partial, non-English and unavailable groups |
| New specs | `guest-preference-ui`, `presentations-index-ui`, `share-drawer-ui`, `processing-batch-ui` |

## Motion

Motion follows `Design Elements/DESIGN.md` §7 and `docs/DESIGN_STYLE.md` §8:
- durations of 120, 200 and 320 ms with the standard, enter and exit easings;
- only transform, opacity and colour change;
- no parallax, bounce, confetti, autoplay, WebGL or cursor effects.

Under `prefers-reduced-motion` nothing moves. The CSS kill switch in `base.css` covers CSS, and every scripted animation checks `motionAllowed()` first.

**Source.** [React Bits](https://reactbits.dev) is used as a source catalogue through the shadcn registry. The licence is MIT + Commons Clause, and each ported file names its source component.
- `components.json` at the repository root registers `@react-bits`.
- `.mcp.json` starts the shadcn MCP server (`shadcn@4.22.1`, pinned to a release at least two weeks old) when Claude Code is opened in this checkout.
- Components are only *viewed* and ported by hand to CSS and the Web Animations API. Never run `shadcn add` or the MCP install action: they install `gsap`/`motion` and change `package.json` and the lockfile, which Codex owns.
- No runtime dependency was added.

| Primitive (`components/motion/`) | Ported from | Used in | Accessibility |
|---|---|---|---|
| `useExitMotion` (overlay exits) | — | Drawer, Modal, ConfirmModal, toasts, mobile navigation sheet | The real dialog unmounts at once. An inert, `aria-hidden` copy without role or ids plays the exit for 160–200 ms and removes itself, so focus return and role queries are unchanged. |
| `stagger` (callback ref) | AnimatedList | Projects table, Cast Library results, presentation series, processing jobs and batch strip, Review issues | Rows rise in once with a 30 ms step (capped at 12). Batches over 50 appear at once. |
| `SegmentIndicator` | Glide Select / Segment Pulse (idea only) | Every `.segmented` group, the workspace step underline, the guest preference radio group | Reads `aria-pressed`, `aria-current` or the checked radio. The controls are unchanged. |
| `AnimatedNumber` | Counter | Casting coverage (filled, Main chosen), Review group counts | The DOM text is always the real value. The outgoing value is a pseudo-element. Nothing moves on first render. |
| `TextReveal` | BlurText / SplitText | Sign-in heroes (central and development), guest review title | The words stay plain text with their spaces, so the heading name is unchanged. |
| `useRouteFade` | AnimatedContent / FadeContent | `<main>` on a pathname change | Opacity only, so fixed inline drawers keep viewport positioning. |
| CSS (`styles/motion.css`) | — | Slide cross-fade, badge and save-status colour transitions, Shortlist star press, Cast Library portrait hover (1.02) | — |

**Not adopted.**
- **Breaks the design rules:** backgrounds (WebGL or canvas), cursor effects, Ballpit, Magnet, Tilted, Holo and Glare cards, Glitch, Decrypted and Scrambled text, Electric and Star borders, and anything that loops or autoplays.
- **Deferred:**
  - **CountUp from zero.** It would put intermediate values into the DOM text; numbers roll on change instead.
  - **Rolling digits on the headcount stepper.** The value is an `<input>`.
  - **Exit motion on removed casting cards.** In-flow copies would overlap the reflowing list.

**Checks.** `tests/e2e/motion-ui.spec.ts` covers:
- the exit copy is inert and hidden, leaves no dialog behind, and focus returns;
- under reduced motion there are no exit copies and no script animations;
- the segmented fill follows the pressed option;
- the revealed sign-in heading keeps its exact accessible name.

## Backend dependencies for Codex

1. **`GET /workspaces/{id}/summary`** (requires `workspaces.read`).
   - **Returns:** `{ roles_needing_clarification, project_candidate_count, unreviewed_candidate_count, open_slot_count, assignment_count: { selection, shortlist }, latest_ready_versions: [{ series_id, output_type, version_no }], review_issue_count | null }`.
   - **Used for:** step statuses, Selection / Shortlist counts and Next up counts.
2. **`GET /versions/{id}/feedback/summary`**.
   - **Returns:** `{ per_slide: [{ version_slide_id, preferred, maybe, not_preferred, comment_count, unresolved_count }], totals }`.
   - **Scope:** guests receive external feedback only.
   - **Replaces:** the counts built from loaded responses.
3. **`GET /jobs?batch_id=`** plus an optional `GET /job-batches/{batch_id}` returning `{ total, by_status }`.
   - **Current behaviour:** the batch strip is complete only for batches that fit on the loaded page, and says so otherwise.
4. **Optional `total` on list pages** (`/candidates`, `/projects`). Without it, counts are omitted.
5. **Move an assignment to another slot.** `PUT /workspaces/{id}/order` only reorders the exact assignments already in a slot (`casting_order_ids` compares them with the slot's rows).
   - **Proposed:** `POST /assignments/{id}/move { row_version, target_slot_id, expected_target_slot_row_version, position: 'option' | 'backup' }`, which returns `{ assignment, source_slot, target_slot }`.
   - **Required behaviour:**
     - keep notes, slide wording and the Shortlist flag
     - a Main leaves as Backup, or the move is refused with `MAIN_OPERATION_REQUIRED`
     - refuse a duplicate person in the target slot
     - bump both slot revisions in one transaction
     - be idempotent

   Until it exists the UI offers order-within-slot, remove, and assign elsewhere.
6. **Dev dependency `@axe-core/playwright`** (pinned) for committed accessibility specs. The audit above used axe-core from an isolated install.

## Open frontend work

None in the supported scope. Remaining items are the blocked dependencies above and these acceptance steps:
- **Connected verification:** run the journeys against the connected pilot with dedicated synthetic data. This needs the integrated deployment that Codex owns.
- **AT-072:** manual screen-reader acceptance stays pending until someone performs it.
- **Mobile acceptance:** stays skipped (owner decision, 2026-10-30). Responsive layouts are implemented and checked at 320 and 390 px as layout evidence only.

## Commits

| Commit | Summary |
|---|---|
| 2e102c8 | Design system, shell, Projects, Project step, records |
| 1fbd5f6 | Specs split view, role rows, ordering panel, retirement dialog |
| 166485c | Candidates tabs, rows, inspector drawer |
| 6bb7d6d | Casting lanes, card menu, Main Undo toast, notes drawer, tray |
| c9677aa | Record update |
| 8aed642 | Review rail, version viewer, English-only transcripts |
| 0ada675 | Cast Library facets, media-first profile |
| cb378b2 | Guest light canvas, toned processing status |
| a787fd3 | Record update |
| 91b8e9d | Merge `main` (canonical English types) |
| b0b2f4e | Canonical English types and group rules |
| 80bfb80 | Retry mock answers the contracted JobAccepted |
| cb3ed81 | Guest preference radio group, last native confirms |
| cead05b | Casting all-roles overview, keyboard tray assignment |
| d2604b9 | Specs headcount stepper |
| ec3eaed | Review repair actions |
| 3dc9be2 | Presentations index rename, archive, restore |
| b37aafd | Sharing drawer, generation checks, focus trap |
| 1e1910f | Sectioned Settings, processing job drawer, batch strip |
| a6d8cab | Labelled containers get valid roles (axe) |
