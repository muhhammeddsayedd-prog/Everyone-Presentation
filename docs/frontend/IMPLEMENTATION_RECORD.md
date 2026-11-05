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
| P1 global pages | Pages: Projects, Project overview, Cast Library (page mode), Candidate profile, Presentations index, Processing, Settings, and Page not found. Each uses `PageFrame`.
- **Panels:** filters and sections; the overview's shared details; the profile's supplied facts.
- **Cover grids:** `shell/Cover.tsx` draws an editorial cover from record fields only. It is not a rendered slide.
- **Portraits:** real candidate frames from `CandidatePortrait`, read lazily on view. The initial shows when there is no frame.
- **Other:** quick actions; a closable project details panel; filter counts given as accessible descriptions; module cards on the overview; processing quick filters next to the `Status` select; a Settings section nav; a 404 state.
- **Unchanged:** contracts, routes, mutations, permissions and visible texts that specs depend on. | Verified (mock) |
| P2 workspace editor + live stage | Project, Specs, Candidates and Casting become config panels beside a live slide stage (`components/workspace/`).
- **Draft data:** `WorkspaceDraftProvider` reads the saved records (roles, slots, pool, assignments, profiles, selected introductions, series, settings) and holds unsaved panel edits as an overlay.
- **Projection:** `draft-review.ts` (`buildDraftReview`) projects them exactly as the server review does.
- **Rendering:** `StageSlide` draws pages with the worker's own registered renderer (1.0/1.1 `renderRegisteredReviewDocument`, 1.2.0 `renderPageMarkup`) in a shadow root.
- **Stage:** `LiveStage` adds status, the previewed series and template, Slide or All pages, a pager, keyboard navigation and a lazy `SlideStrip`.
- **Selection sync:** panels declare `data-draft-focus` and `data-draft-field`, so the stage and the panel select each other and the edited field is highlighted.
- **Unchanged:** saves, permissions, conflicts and generation; the server stays the authority. | Verified (mock); connected read-only parity |
| P3 review, versions, sharing | Review, Versions and Share & feedback become panel + stage (+ right panel) screens; the saved-version viewer and its original-introduction page move into the same frame.
- **Shared stage:** `workspace/DeckStage.tsx` (status chip, Slide / All pages, pager, keyboard, thumbnail strip, toned field highlight) now draws every draft deck; `LiveStage` uses it. `workspace/useStageDeck.ts` puts a server review on it.
- **Review** (`review/ReviewWorkspace.tsx`): series and creation in the panel; server checks grouped as Information, Images and video, Profiles not reviewed, Pending slots and Layout fit, each with the server's severity; a check shows its slide with the named field marked (overflow red, notes amber), and Fix opens the inspector (Facts, Video & transcript, Wording). The stage is the server-checked draft, labelled with its revision; an unsaved wording/availability edit or an unapplied AI suggestion is previewed on it and labelled as such. A draft moved after the check is reported, not silently re-checked.
- **Versions** (`WorkspacePresentationView.tsx`): series, working-draft card (changes since the last ready version, blocking checks, Generate), saved history and paging in the panel. The stage shows either the server-checked working draft (what Generate captures) or the selected saved version's own snapshot (`presentation/saved-version.tsx`), never a mix. Generation keeps the expected row version, draft revision and fingerprint, the same idempotency key on confirm, and the 409 stale refusal.
- **Share & feedback** (`share/ShareWorkspace.tsx`): one component for `/presentations/series/{id}/sharing` and a new workspace step `share`. Links (create, edit, rotate, revoke, copy-once URL) stay the existing `ReviewLinksPanel`; the stage shows the version guests see; the right panel is the feedback for the slide on the stage, and choosing a candidate there moves the stage. Unsent comments are protected on slide or version change.
- **Viewer** (`PresentationVersionView.tsx`): slide list with comment counts in the panel, the saved stage (App view carousel / PDF preview), feedback beside it, PDF/PowerPoint/Share actions; queued, failed and missing states.
- **Media:** `/presentations/versions/{id}/media/{asset}` and the guest `/m` page get a player stage with the captured transcript beside it; access is still requested only on Play.
- **Top bar:** Share on every step; Generate version on Review (it opens Versions, where generation lives). | Verified (mock); connected read-only viewer check |
| P4–P5 | Guest, mobile, hardening | Not started |

P3 checks (2026-11-05, branch `frontend/presentation-first-p3`):
- Gate: `npm run lint`, `npm run typecheck`, `npm test` and `npm run check:production-guard` pass. `npx playwright test`: 172 passed, 0 failed (163 earlier + 2 P2 follow-up + 7 P3). Unit suites 1,057 passed (477 domain/server incl. the 2 new parity tests; the worker suite skips one by design).
- New `tests/e2e/presentation-first-p3.spec.ts` (7 tests, axe on every P3 screen):
  - a check brings its slide with the named field marked; Fix opens the inspector on the right tab and field; typed wording is previewed and labelled unsaved, and discarding restores the checked draft;
  - a draft moved after the check is reported (revision n → m) and "Check again" re-reads the review;
  - a measured overflow opens its page with the field marked as overflowing and its wording ready to shorten;
  - Versions shows either the server-checked draft or the selected snapshot, never content from the other; an unregistered template is reported, not approximated; a stale draft is refused by the server and Generate stays disabled; the request body carries the expected row version, draft revision and fingerprint;
  - Share: links in the panel, internal series without link controls, feedback follows the slide and choosing a candidate in feedback moves the stage; an unsent comment is protected;
  - viewer slide list, keyboard paging (arrows, End) and comment counts; queued version without PDF; missing version;
  - the original-introduction page at 1440, 1024 and 390 px without sideways scrolling.
- P2 follow-up in `tests/e2e/live-stage-ui.spec.ts` (+2): a remote change to the record being edited never replaces the unsaved text (field and slide), and saving it meets the server's stale-version check; a remote change to another record shows on its slide while the edit elsewhere is kept.
- New `tests/domain/saved-version-parity.test.ts` (2 tests): the viewer's `reviewFromPresentationVersion` equals the worker's `reviewFromRenderSnapshot`; 1.1.0 registered markup and every 1.2.0 composed page are identical to what the worker prints (with the worker's `editorialSnapshotOptions`, for logo on the cover and on every slide).
- Investigated mismatch: the worker composes 1.2.0 PDFs with the logo's retained pixel size; the viewer did not. The markup was already identical in the fixtures, but the viewer now passes the decoded logo size so the composed deck is identical too. Fit measurement composes without it, so the draft stages already match the server's measurement.
- Specs adjusted to the new structure (behaviour unchanged): `review-ui` (stage thumbnail + "Review Father 1", tabs, the inspector region), `presentation-ui` ("Versions" heading, history list instead of a select, the server-check line instead of a cover heading), `presentation-recovery` (the viewer may also read feedback for the same version, still never the live library), `guest-sharing-recovery` (panel heading "Share & feedback").
- Fixed while checking: slide buttons named by `aria-label` showed text that was not in their names (axe); the person and comment count are now a description beside the button. Inspector tabs no longer carry `aria-pressed`. The wide-panel grid outranked the narrow reset for non-workspace frames (media page side by side at 390 px). P2 used an unstyled `notice-warn` class; it is `notice-warning` now.
- Connected, read-only: the latest ready version of the release-verification series (1.1.0, version 2) passes the viewer's path — frozen-content check, registered template identity, 2 rendered pages for 2 saved slides, all 3 retained frames and the version label. No 1.2.0 version is ready anywhere in the pilot (the Editorial fit issue stays isolated). Nothing was written; the read was deleted from the scratch area. No staging exists, so generation, link creation/rotation/revocation and comments were verified with mocks only.
- Vercel: the production project `everyone-presentation-pilot` has no Git repository linked (`link: null`) and Git deployments disabled; every deployment is a CLI upload. Merging P2 to `main` (0e74a811) created no deployment.

Owner feedback after P3 (2026-11-05):
- The live stage showed Everyone Casting 1.1.0 for a workspace without a series, because the Studio default template is still 1.1.0. The design kit (`everyone_template_design_kit/`) is the registered Everyone Film Editorial 1.2.0 template. Without a 1.2.0 series (and while 1.1.0 is the default) the stage now offers "Everyone Film Editorial 1.2.0 · preview only" and says which template the workspace still generates with. The default and generation are unchanged: moving the default to 1.2.0 is a production setting and waits for the staged 1.2.0 fit-font database fix (f7693ed8).
- The config panel is resizable: drag its right edge, or use the handle's keys (←/→ 16 px, Shift 64 px, Home/End, Enter or double-click resets). Widths are remembered per panel kind in `eps.panel.width.v1` (guarded storage) and clamped so the page keeps 480 px. Only the grid's panel column changes; the stage, slide scaling, strip, right panel and drawers follow. The embedded Cast Library stacks its filters above the results when the panel is under 720 px (container query). Test: `live-stage-ui` "the config panel can be resized…".

Differences from the P3 mockups (deliberate or deferred):
- Review's stage shows the server-checked draft, not the browser-recomputed live draft, because Review is where the server's result is read; unsaved inspector edits are previewed on it and labelled. The live draft stays on Project, Specs, Candidates and Casting.
- Review's footer opens Versions ("Open Presentation") instead of generating from Review: generation keeps one place with its fingerprint, idempotency and confirmation flow.
- The inspector does not show per-field source citations ("video 0:04", "agent sheet"): the API has no per-field provenance. Reviewed is a one-way confirmation button, not a toggle, as in the API.
- Transcripts are the captured English text, not timestamped lines with an Original toggle: the contract provides no segments, and original-language text is never a display fallback. "Click a line to jump" is therefore not offered.
- Saved versions keep "App view" (one frame at a time) and "PDF preview" (all frames) — the product rule; drafts use "Slide" / "All pages". No zoom control.
- History cards, the viewer's slide list and the saved strip have no image thumbnails: they would read every version's images up front. They show number, role / slot, person and comment counts.
- "Preview as guest" is not offered: guest URLs are shown once and not stored, and there is no tokenless guest preview. "New URL" is "Rotate URL"; the link form stays visible instead of opening from a button.
- Feedback counts are shown for the selected version (and per slide), not for every version in the list, which would need one request per version. Comments are per slide, not pinned to positions on the slide.
- Collaborator avatars and notifications are not shown (no presence API).
- "Back to slide" on the media page opens the saved version, which has no per-slide address.
- Below 1024 px the panel, stage and right panel stack; the bottom-sheet pattern is P4.

P2 checks (2026-11-05):
- Gate: `npm run lint`, `npm run typecheck`, `npm test` and `npm run check:production-guard` all pass. `npx playwright test`: 163 passed, 0 failed (156 earlier specs + 7 new). The unit suites pass in full (1,055 tests; the worker suite skips one by design).
- New `tests/domain/workspace-draft-preview.test.ts` (6 tests):
  - server order and field rules (trimmed facts, saved wording, casting-ID fallback, Pending slots);
  - Selection versus Shortlist;
  - each overlay key, and that clearing it restores the saved slide;
  - foreign frames are dropped and reported;
  - inconsistent records, unreadable profiles and unknown templates pause the preview;
  - 1.2.0 page kinds and focus lookup;
  - 1.0/1.1 pages match the registered document.
- New `tests/e2e/live-stage-ui.spec.ts` (7 tests):
  - typed notes reach the slide before saving, are written once, and stay after the refresh and a reload;
  - discard restores the saved slide;
  - an edit made elsewhere (draft revision moved) appears on focus;
  - a failed read offers Try again and recovers;
  - an unreadable profile pauses instead of inventing facts;
  - stage ↔ panel selection and keyboard navigation;
  - 1.2.0 ↔ 1.1.0 switching, and All pages;
  - axe (WCAG 2.1 AA), and no sideways scroll at 390 px.
- Specs adjusted where the preview legitimately adds reads:
  - `specs-ui` now expects exactly one preview slot read per role. The editor still pages no slots before a role is opened.
  - `casting-retirement-ui` arms its one-time preview failure after the stage has loaded, so the removal review's own read is the one that fails.
- Fixed while checking:
  - Role queries reach into open shadow roots, so the slide's own headings duplicated the panel's. The canvas is now `aria-hidden`, and the stage is a single named image ("Slide n of N: …").
  - Absolute screen-reader text in the thumbnails escaped the strip's clipping and widened the page to 856 px at 390 px. Thumbnails are now positioned.
  - Thumbnail names now contain their visible text (axe `label-content-name-mismatch`).
  - `.specs-source` was sticky inside the scrolling panel and overlapped the roles.
  - A drawer opened from the panel was painted under the sticky stage.
  - `ActionMenu` closed on any scroll anywhere. The live strip and a focus-scrolled panel closed menus a frame after they opened, failing `casting-board-ui` 2–3 times in 10. Menus now follow their button when a container holding it scrolls, close only when the button leaves the screen, and ignore unrelated scrolls; afterwards 10/10. The strip now scrolls only itself, never the page.
- Connected parity, read-only, against the live pilot with the designated "Release verification · Casting" test workspace:
  - The same records the browser reads (roles, slots, pool, assignments, profile, introductions) were run through `buildDraftReview`.
  - The result equals `GET /workspaces/{id}/review` for its 1.1.0 and 1.2.0 Selection series: slides, cover and template identity.
  - The registered renderer produced byte-identical markup for both templates.
  - Nothing was written. Private record data was not stored in the repository.
- Scale (node, synthetic): about 600–680 slides cost 13–40 ms to rebuild per keystroke, and 8 visible 1.2.0 pages under 1 ms to render. The stage defers edits (`useDeferredValue`), so typing is not blocked. The thumbnail strip renders pages only when they near view. A live pilot workspace has 657 Pending slides.

Differences from the P2 mockups (deliberate or deferred):
- The stage toggles are "Slide" and "All pages", not "App view" and "PDF preview". The stage always shows the printed page, and the saved-version viewer keeps its app carousel. There is no zoom control yet.
- The top bar keeps "Review & generate". Share and Generate version move into the bar with P3.
- Specs uses jump links instead of tabs, in page order (Brief, General, Roles) and marking the section in view. Every section stays mounted, so unsaved edits survive. Candidates keeps its existing tabs.
- A drawer opened from the panel (for example assignment notes) covers the panel only, so its slide stays in view. Below 1024 px drawers keep their full-width behaviour.
- Below 1024 px the panel is the page and the stage follows it. The mockup's bottom-sheet pattern for workspace steps is planned for P4.
- Review and Presentation keep their own layouts until P3.

P1 checks (local, `local_fixture` and mocked API, 2026-11-05):
- `npm run lint`, `npm run typecheck`, `npm test` and `npm run check:production-guard`: all pass.
- `npx playwright test`: 156 passed, 0 failed.
- New `tests/e2e/global-pages-ui.spec.ts` (5 tests):
  - the filter panel and its loaded counts (descriptions);
  - the cover grid and the closable details panel;
  - collapse by button and by Ctrl+\, remembered across a reload;
  - the 1024 px overlay with focus trap, Escape returning focus to the toggle, and the 390 px bottom sheet;
  - Cast Library portraits from real frames, with initials otherwise;
  - the Presentations output filter and the Settings section links;
  - axe (WCAG 2.1 AA) on each page.
- Fixed while checking:
  - Panel titles must not repeat a page h1, so they are named "Filters" or "Sections".
  - Hidden absolute-positioned text added a space to button names, so counts became descriptions.
  - Cover buttons had an `aria-label` that did not contain their visible text; they are now named by hidden text.
  - Planned module cards were faded with opacity, which failed contrast.
  - `.candidate-portrait` collided with the workspace thumbnail class; the new class is `.library-portrait`.
  - Fact chips duplicated text, which broke an exact-text spec; they were removed.
- Visual check: 83 screens re-captured from the real app with the screenshot harness (synthetic API, 1440 px and 390 px) and compared with `Screenshots 2 Improved Design/`.

Differences from the P1 mockups (deliberate or deferred):
- Project and series covers are editorial covers built from record fields, not rendered presentation pages, and they do not load client logos.
- The candidate profile shows a hero, facts and media instead of the mockup's slide preview. The slide preview needs the P2 draft-deck renderer.
- The sign-in screens keep their existing layout inside the new frame.
- Below 1280 px the right details panel stacks under the page instead of opening as a drawer.
- Processing keeps the `Status` select, which specs depend on, and adds quick-filter links beside it.
- The Cast Library embedded in the workspace Candidates step keeps its previous layout until P2.

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
