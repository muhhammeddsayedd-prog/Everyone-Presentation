# Cycle 9: latest everyone. design across the whole app (2026-11-19)

Branch `cycle9/latest-design` (pushed), worktree `D:/Everyone/Presentation/EPS-c9-design`. Base `cycle8/v2-template` cf8e5c37.
Plan approved by the owner: `C:\Users\iway\.claude\plans\steady-sparking-bear.md`.

## Scope

- **Frontend only:** `apps/web` CSS, components and motion.
- **Outside apps/web:** three files changed — `package-lock.json` (for the `motion` dependency), `eslint.config.mjs` (the vendored-code exception) and `tests/e2e/frame-ui.spec.ts`. Two specs had small selector updates: `project-create-ui` (scoped locator) and the cycle 7 specs (Add-to-project name).
- **Unchanged:** API, MCP, contracts, packages, worker, migrations and database. Verified by diff and by local-replica parity (25/25 REST, 112 MCP tools by name).

## Owner decisions (2026-11-19)

- Install `motion` (motion.dev), pinned at **14.9.1**, plus React Bits components. Use only Motion or CSS variants, never GSAP. This supersedes the earlier "no new dependency, port to WAAPI" rule.
- The motion level is "expressive but purposeful": layout and shared-element transitions, springs, count-ups, staggered lists and hero reveals. No confetti, parallax or cursor effects. Reduced motion turns everything off.

## What was built

- **Wave 0, foundation (me):**
  - Tokens: `latest.tokens.css` (`--ui-*`, `--bi-*`), with the old token names aliased onto the new scale.
  - The verbatim `bi` layer is imported as `@layer bi`, the lowest layer.
  - General Sans woff2 fonts.
  - The new shell: a black top bar with the white navigation pill, a project-frame band and a 7-step pill bar.
  - Paper config panels: colour tokens are remapped to ink, and `--color-accent-text` is used for green text.
  - `latest.css` primitives.
  - The motion layer: `components/motion/README.md`.
- **Wave 1, five parallel agents in their own worktrees and branches:**
  - A: global pages.
  - B: workspace steps 1–4 and the live stage.
  - C: Review, Presentation, Share and the saved viewer.
  - D: Library, profile, Processing and Settings.
  - E: guest, OAuth and system states, then the whole-app phone pass in `latest-mobile.css`.
- **Wave 2, three independent reviews (design fidelity, accessibility and motion, full-stack and performance), then two fix agents (X, Y) plus my own core fixes:**
  - The Studio shell moved to the `app/(studio)/layout.tsx` route group. The catch-all page used to remount the whole app on every navigation; this was found by a probe.
  - LazyMotion with `domMax` loaded on demand.
  - Reduced-motion entrances start settled, and the hero reveal is SSR-safe (this fixed the `auth-sign-in` unit regression).
  - The nav pill glides via `layoutId`; the step pill slides via FLIP.
  - A step chosen from the keyboard keeps focus.
  - `KpiNumber` uses a CSS counter, so the DOM text is always the real value. The React Bits CountUp source was removed because it made a polling spec flaky.
  - WCAG fixes:
    - label-in-name: "Add to project: <name>";
    - nested-interactive frame strip is now `role=group`;
    - focus ring on the white pill is now ink;
    - contrast of the count chip on paper.
  - Touch targets of at least 44px on phones.
  - P1 and P2 layout fixes from the fidelity review.

## Evidence (real runs)

- **e2e full suite** (47 specs, Chromium, fixture server on :3191): **218/218** at ddbe1f28. It was also 218/218 after each Wave 1 merge.
- **Unit:** 551/551 at ddbe1f28.
- **Other suites at 41573712** (Wave 2 run; the later changes are web-only): contracts 13/13, jobs 19/19, integrations 92/92, worker 293 pass + 5 skipped, central 220/220.
- **typecheck and lint:** clean.
- **Local replica (Docker), compared with the base web:**
  - REST read parity 25/25.
  - MCP tools/list 112 = 112 (names identical; the schemas were compared by total length only, not byte for byte).
  - Browser journeys (projects, candidates, casting board, review, saved 1.4 version, guest link create/open/revoke): 0 errors on both servers.
  - The full `run-all.sh` was **not** run, because it resets a stack owned by another session.
- **Bundle (gzip, first measured at 41573712):**
  - Motion added about 50 KB per app route; the shared chunk was unchanged.
  - LazyMotion was applied afterwards; it has not been re-measured.
  - CSS went from 31 KB to 58 KB.
- **Accessibility:** axe was clean on 32/34 route×width runs before the fixes. The two failures (`ws-cast`) were fixed and are covered by the specs' axe checks.
- **Screenshots:**
  - `.local/cycle9/ui/{before,wave0,a..e,fx,fy,wv2design}` in the respective worktrees.
  - The a11y artifacts are in `.local/cycle9/wave2-a11y/`.

## Staging

- **Sealed source:** receipt `tracking/evidence/m07/controlled-pilot/2026-11-19T08-48-58-709Z-fecaa1bb-web-source.json` — 447 entries, 0 private hits, base ddbe1f28.
- **Vercel PREVIEW:** `dpl_2s8AapuKSc8qgUVDPtEa4M9afqRz` (`-e APP_BASE_URL=https://everyone-presentation-staging.vercel.app`), READY, aliased to **https://everyone-presentation-staging.vercel.app**.
- **Production alias:** unchanged (`dpl_Et3KieHUi9jLZ1iU1cmdSqpAauDY`).
- **Smoke checks via `vercel curl`:**
  - `/projects` returns 200 and serves the new CSS.
  - `/api/session` returns `mode: supabase`.
  - The guest route returns 200.
  - **Pending:** a signed-in click-through on staging needs the owner's login.
- **Rollback:** point the alias back at `dpl_3hyf85md2n4Di5JqYykVaa2UJHvw` (the cycle 8 staging build):
  `vc alias set everyone-presentation-pilot-o1dufvobx-muhammed-abdelrahman.vercel.app everyone-presentation-staging.vercel.app`

## Open items

- The owner tests on staging, signed in.
- Production promotion needs separate owner approval.
- Accepted design deviations, all recorded in the agent reports:
  - No data is invented, so there are no KPIs or progress figures the API doesn't provide.
  - The casting board stays in the 400px panel.
  - On phones, the workspace steps stay in the top pill bar and are not in the tab bar.
  - The profile hero has no fact strip (it would duplicate strictly-matched age text).
- Uncommitted gallery work from another session in the main checkout (`CandidateMediaGallery.tsx`, `profile.css`, and others) was not merged. Reconcile it against the restyled profile.
- `polish.css` customizable select: a long label pushes the chevron out. The series selects use a classic-select override instead.
- Worktrees `EPS-c9-{a..e,verify}` hold only screenshots and branches now; their `node_modules` were removed because drive D: was nearly full.
