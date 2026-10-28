# DESIGN.md — everyone. Market Radar UI system

This is the build spec for the web app's look and behaviour. Codex builds the UI from this file alone.
- **Brand source:** `docs/DESIGN_STYLE.md`, measured on www.everyone.film.
- **Tokens:** `assets/brand/tokens.css`, copied to `apps/web/styles/tokens.css`, with a JSON copy in `tokens.json`.
- **Data names** below refer to `docs/DATA_SCHEMA.md`.
- **Out of scope:** no ads pages and no jobs pages (D-08). The team signal comes from LinkedIn employee snapshots.

Stack reminder: Next.js App Router, Tailwind v4 mapped to the tokens, Radix primitives (shadcn-style components restyled here), TanStack Table, Recharts, lucide-react (1.5 px stroke).

---

## 1. Principles

1. **The work leads.** Every list leads with the thumbnail or logo. Text is metadata.
2. **Black stage, quiet type.** True black background, hairline borders, General Sans Medium. Nothing glows, nothing has a drop shadow (except floating popovers).
3. **One green.** `--color-accent` (#00cd6d) is used only for:
   - the active navigation item;
   - the primary action;
   - the focus ring;
   - "new" dots;
   - positive deltas;
   - the selected filter.

   Everything else is grayscale.
4. **Dense but calm.** Many items per screen and generous outer margins, with tight groups and one idea per row.
5. **Two clicks to the answer.** Every entity (competitor, brand, agency, person, campaign) is a link wherever it appears.
6. **Bilingual by default.** Arabic content renders right-to-left with the Arabic font, inline next to English UI.
7. **Honest data.** Show confidence, source and date on every AI-derived value. A missing value is shown as "—", never guessed.

## 2. Tokens

All values live in `assets/brand/tokens.css`. Never hard-code a colour, size or duration in a component.

| Group | Values |
|---|---|
| Spacing (4 px base) | 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 (`--space-*`) |
| Radii | `--radius-sm` 8 px (chips, buttons, inputs, thumbnails: the site radius), `--radius-md` 12 px (cards, popovers, dialogs), `--radius-full` 999 px (pills, toggles, avatars) |
| Elevation | Borders, not shadows. `--elevation-1` = 1 px `--color-border`; `--elevation-2` = 1 px `--color-border-strong`. A shadow only on popovers and dialogs (`--elevation-pop`). |
| Focus | `--focus-ring`: 2 px bg gap + 2 px accent. Shown with `:focus-visible` on every interactive element. |
| Z-index | base 0 · sticky 100 · sidebar 200 · topbar 300 · drawer 400 · dialog 500 · popover/command 600 · toast 700 |
| Breakpoints | xs 375 · sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536 |
| Layout | Sidebar 248 / 72 collapsed · topbar 64 · bottom nav 64 (mobile) · content max 1440 · gutter 16 mobile, 24 md, 32 lg+ |
| Motion | fast 120 ms (hover, press) · base 200 ms (menus, tabs) · slow 320 ms (drawers, card media) · `--ease-standard` cubic-bezier(.2,0,0,1) |

## 3. Colour

### 3.1 Semantic tokens (dark default)

| Token | Value | Use |
|---|---|---|
| `--color-bg` | #000000 | Page |
| `--color-surface-1` | #0b0b0c | Cards, sidebar, table body |
| `--color-surface-2` | #141416 | Hover, inputs, table header, skeletons |
| `--color-surface-3` | #1c1c1f | Selected rows, pressed, popovers |
| `--color-border` | #26262a | Hairlines |
| `--color-border-strong` | #3a3a40 | Inputs, toggles at rest |
| `--color-text-primary` | #ffffff | Titles, values |
| `--color-text-secondary` | #c4c4c4 | Body copy, secondary values |
| `--color-text-muted` | #8e9094 | Meta (dates, counts, captions). AA on every surface. |
| `--color-text-label` | #7d7f82 | Uppercase micro-labels, **on bg / surface-1 / surface-2 only** (4.2:1 on surface-3 fails) |
| `--color-accent` / `-strong` / `-deep` / `-soft` | #00cd6d / #00b460 / #176e45 / 12% green | See §1.3. Deep green is a fill only (white text 6.3:1). |
| `--color-text-on-accent` | #000000 | Text on green fills (9.95:1) |
| success / warning / danger / info | #00cd6d / #f5b544 / #ff6b6b / #5aa9ff (plus `-soft` 14% fills) | Status pills, toasts, deltas |

The light theme overrides these in `:root[data-theme="light"]`: accent text #176e45, muted #626468, and bright greens as fills only. The full list is in tokens.css.

### 3.2 Platform colours (small badges only)

| Platform | Token | Hex (dark) | Contrast on surface-3 |
|---|---|---|---|
| Vimeo | `--platform-vimeo` | #1ab7ea | 7.3 |
| Instagram (and stories) | `--platform-instagram` | #f0508c | 5.0 |
| Website | `--platform-website` | #c4c4c4 | 9.8 |
| LinkedIn | `--platform-linkedin` | #4a9eff | 6.2 |
| YouTube | `--platform-youtube` | #ff4e45 | 5.2 |
| News / awards | `--platform-news` | #f5b544 | 9.4 |

Platform colour appears only as the badge glyph and its 1 px outline. Never as a card background, a chart series that isn't about platforms, or large fills.

### 3.3 Status mapping

| State | Pill |
|---|---|
| `ai_status` published | Success soft + "Published" |
| `ai_status` review | Warning soft + "Needs review" |
| `ai_status` pending / processing | Surface-3 + muted + "Processing" |
| `ai_status` failed | Danger soft + "AI failed" |
| item `removed` | Surface-3 + strike-through date + "Removed" |
| account active / failing / paused / invalid | Success / danger / muted / warning |
| entity unconfirmed | Outline pill "Unconfirmed" |

### 3.4 Chart palette

Categorical (use in this order; all at least 6.5:1 on #000 and #0b0b0b):

| # | Hex | # | Hex |
|---|---|---|---|
| 1 | #00cd6d (accent; "our" series or the first competitor) | 5 | #b48cff |
| 2 | #5aa9ff | 6 | #4fd1c5 |
| 3 | #f5b544 | 7 | #ff9f43 |
| 4 | #ff7a90 | 8 | #c4c4c4 (other / everything else) |

- **Sequential green** (heatmaps, low to high): #0b2a1c → #0f4a2f → #176e45 → #00964f → #00b460 → #00cd6d → #6be3a6 → #b8f2d3.
- **Chart chrome:** grid lines `--chart-grid` (#1c1c1f), axis `--chart-axis`, labels `--chart-label` (#8e9094, 12 px, tabular numerals).
- **Baseline:** when Everyone Films is plotted as the baseline, it always uses series 1 (green) and the label "everyone." (lowercase).
- **No colour-only meaning:** every chart has a legend or direct labels, and tooltips name the series.

## 4. Typography

Fonts: General Sans (Medium 500 / Semibold 600 / Bold Italic 700), plus IBM Plex Sans Arabic for Arabic. Load them with `next/font/local` from `apps/web/public/fonts/` (files listed in tokens.css).

| Style | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|
| Display | clamp(40–68 px) / 1.1 | 600 | −0.01em | Login hero, brief cover statement |
| Wordmark label | clamp(32–49 px) / 1.15 | 700 italic | −1.5 px | Section names on brief pages ("this week", "launches") |
| H1 | 32 / 1.15 | 600 | −0.01em | Page titles |
| H2 | 24 / 1.1 | 600 | — | Section titles, entity names in headers |
| H3 | 18 / 1.25 | 600 | — | Card group titles, panel titles |
| Card title | 22 / 1.1 | 500 | — | Titles on thumbnails (site project title) |
| Body large | 16 / 1.5 | 500 | — | Summaries, brief body |
| Body | 14 / 1.3 | 500 | — | Default UI text |
| Small | 13 / 1.35 | 500 | — | Meta, table cells |
| Micro-label | 12 / 1.2, UPPERCASE | 500 | 0.01em (≈0.14 px) | Field names, kickers, column headers |
| KPI | 36 / 1, tabular | 600 | — | Stat tiles |

Rules:
- **Numbers:** metrics, counts, money and dates in tables use `font-variant-numeric: tabular-nums`.
- **Arabic:** any element showing source content (captions, titles, summaries_ar, names_ar) gets `dir="auto"` and `lang` when known (`ar`). The font stack falls back to IBM Plex Sans Arabic automatically through `unicode-range`. Arabic line height is +0.15 relative to Latin (`:lang(ar) { line-height: calc(var(--leading-body) + .15) }`).
- **Line length:** at most 72 characters for paragraphs (brief body, summaries).
- **Overflow:** truncate titles with ellipsis after 2 lines on cards (`line-clamp-2`) and 1 line in rows. The full text goes in a tooltip and on the detail page.

## 5. Layout

### 5.1 App shell (≥ 1024 px)

```
┌────────────┬──────────────────────────────────────────────────────────────────┐
│ everyone.  │ [⌘K Search everything…        ] [EG|KSA|UAE|All] [Last 7 days ▾] (●)│  ← topbar 64, sticky
│ Market     ├──────────────────────────────────────────────────────────────────┤
│ Radar      │                                                                  │
│            │  PAGE KICKER (micro-label)                                        │
│ RADAR      │  Page title H1                              [secondary] [primary]  │
│ ● Pulse    │  ───────────────────────────────────────────────────────────────  │
│   Feed     │  FilterBar (sticky under topbar when scrolling)                   │
│   Campaigns│                                                                  │
│   Briefs   │  Content (max 1440, gutters 32)                                  │
│   News     │                                                                  │
│ MARKET     │                                                                  │
│   Competit.│                                                                  │
│   Brands   │                                                                  │
│   Agencies │                                                                  │
│   People   │                                                                  │
│   Markets ▸│                                                                  │
│   Compare  │                                                                  │
│ WORK       │                                                                  │
│   Review 12│                                                                  │
│ ADMIN      │  (admins only)                                                   │
│   Competit.│                                                                  │
│   Taxonom. │                                                                  │
│   Pipeline │                                                                  │
│   Costs    │                                                                  │
│   Users&key│                                                                  │
│ ────────── │                                                                  │
│ API docs   │                                                                  │
│ Settings   │                                                                  │
│ ◐ Theme    │                                                                  │
│ (MA) Moham.│                                                                  │
└────────────┴──────────────────────────────────────────────────────────────────┘
```

**Sidebar** (`surface-1`, right border, 248 px; collapses to 72 px with the toggle or ⌘\ and stores the choice in localStorage):
- **Top:** the wordmark (white, 104 px wide) + the "Market Radar" label (Body, secondary). When collapsed, the three-dot mark replaces it.
- **Groups:** RADAR, MARKET, WORK, ADMIN. Each group has a micro-label heading.
- **Nav items:** 36 px high, radius 8, a 16 px icon + label.
- **Active item:** surface-2 background, a 2 px green bar on the left, white text and icon.
- **Inactive item:** secondary text, muted icon.
- **Review badge:** shows the open count in a pill (warning soft).

**Topbar** (bg with bottom border):
- global search trigger (opens SearchCommand);
- market switcher (segmented control: EG · KSA · UAE · All; persisted in the URL as `?market=` and in localStorage; applies to every page);
- date range (Today, 7 days, 30 days, 90 days, This year, Since 1 Jan 2024, Custom);
- a pipeline status dot (green "Up to date 08:12" / warning "Running" / danger "3 sources failing", linking to admin pipeline for admins);
- user menu (avatar initials, name, role, theme, sign out).

### 5.2 Tablet (768–1023)
The sidebar collapses to 72 px by default and the topbar search becomes an icon button. Grids drop to 2–3 columns.

### 5.3 Mobile (< 768)
- **Bottom nav** (64 px, bg + top border): Pulse, Feed, Search, Review, and **Menu**. Menu is the site's white rounded-square button with three dots; it opens a full-height sheet with all navigation.
- **Topbar** (56 px): wordmark at 88 px and the market switcher as a compact select.
- **Filters** go in a bottom sheet behind a "Filters (3)" button.
- **Layouts:** cards go single-column; tables turn into stacked rows (label/value pairs as in the site footer).
- **Sizing:** the side gutter is 16 px and there is no horizontal page scroll. Wide tables scroll inside their own container, with a fade at the edge.

### 5.4 Page grid
- 12 columns, 24 px gutters (lg+). Card grids use `repeat(auto-fill, minmax(280px, 1fr))`, or 240 px for dense views.
- Detail pages: main content takes 8 columns and the right rail takes 4 (key facts, credits, links). On < 1024 the rail moves below the main content.

## 6. Components

Each component lives in `apps/web/components/ui/` (primitives) or `components/features/` (domain). Every component: typed props, `className` passthrough, a forwarded ref where interactive, a Storybook-style example on the `/dev/components` page (dev only).

| Component | Anatomy | Variants / props | States and behaviour |
|---|---|---|---|
| **Button** | label (+ optional leading icon) | `variant`: primary (accent fill, black text), secondary (surface-2, border-strong, white), ghost (transparent, secondary text), danger (danger outline → danger fill on confirm); `size`: sm 32 / md 36 / lg 44; `loading`; `asChild` | hover: primary → accent-strong, secondary → surface-3; active: translateY(0.5px); disabled: 40% opacity, no pointer; loading: spinner replaces the icon, width is kept; focus ring |
| **IconButton** | icon 16/20 | ghost / secondary; `aria-label` required; sm 32 / md 36 | Tooltip on hover/focus after 400 ms |
| **Chip / FilterChip** | label (+ count) (+ remove ×) | `selected`; `removable`; radius full, 28 high | Unselected: surface-2 + secondary text. Selected: accent-soft background + accent text + 1 px accent border. |
| **GlassLabel** | text on frosted chip | Over images only: `--glass-bg` 72% + 12 px backdrop blur, black text, radius 8, padding 6×10, 13–14 px Medium | Hover on the parent card brightens to `--glass-bg-hover`. Falls back to solid #e9e9e9 when backdrop-filter is unsupported. |
| **PlatformBadge** | glyph 12 + optional label | `platform` (vimeo, instagram, instagram_stories (glyph + "Story"), website, linkedin, youtube, news); `showLabel` | 1 px outline in platform colour, transparent fill, 20 px high |
| **CountryBadge** | code text | EG / KSA / UAE / OTHER | Micro-label style, surface-2, radius 6 |
| **ConfidenceMeter** | 5-segment bar + % | `value` 0–1, `threshold` (default from settings, 0.80) | Segments fill accent when ≥ threshold, warning when below. Tooltip: "Confidence 0.86 · auto-published (≥ 0.80)". Never colour-only: always shows the number. |
| **StatusPill** | dot + text | Per §3.3 | — |
| **LogoTile** | square/circle logo | `src`, `name`, `size` 24/32/40/64/96, `tone` auto (dark tile #141416 for light logos; light tile #f5f5f5 for dark logos; detected from the stored logo metadata or an admin toggle) | Fallback: initials in General Sans Semibold on surface-2 |
| **Avatar** | initials / photo | Members and people (no photos of people by default) | — |
| **ItemCard** | thumbnail (16:9 film; 4:5 Instagram; 9:16 story/reel shown in a 4:5 crop), scrim, title bottom-left (Card title 22 → 16 px in dense mode, 2 lines), GlassLabel top-left (competitor name), PlatformBadge top-right, footer row: LogoTile 24 (competitor) · brand link · date (relative) · key metric (views or plays) · ConfidenceMeter mini (3 px bar) | `density`: comfortable / dense; `item` from `app.feed_v`; `onOpen` | Hover: media scale 1.02 over 320 ms, glass brightens, border goes to border-strong. Click opens the item drawer (intercepting route `/items/[id]`). A "New" accent dot appears if `first_seen_at` is within 24 h. Removed items: grayscale 60% + "Removed" pill. Review items: warning pill. |
| **ItemRow** | 96×54 thumb · title + caption excerpt (1 line each) · competitor · brand · agency · format · country · platform · date · metrics · status | List mode of the feed | Row height 72; hover surface-2; selected surface-3; keyboard ↑/↓ moves focus, Enter opens |
| **CampaignCard** | key-art thumbnail (first item) + up to 3 extra mini-thumbs strip · title (H3) · brand LogoTile + name · production house · agency · date span "12 Mar – 4 Apr 2026" · platforms badges · item count | `campaign` from `app.campaigns_v` | Same hover as ItemCard |
| **CompetitorCard** | LogoTile 64 · name (H3) · markets badges · tier pill (Pilot / Next wave / Adjacent / Baseline) · categories (max 3 chips + "+n") · activity sparkline (30 days, `app.stats_daily`) · last post relative time | `competitor` | Hover border-strong |
| **EntityHeader** | LogoTile 96 (or initials) · kicker (micro-label: COMPETITOR / BRAND / AGENCY / PERSON) · name H1 (+ name_ar on a second line, dir=rtl) · badges · key facts row (label/value pairs in site-footer style) · actions (Compare, Open website, Edit for admins) | `kind`, `entity` | Sticky compact version (56 px) after scrolling 200 px |
| **StatTile (KPI)** | micro-label · KPI number (tabular) · delta vs previous period (▲ accent / ▼ danger / – muted) · optional sparkline | `label`, `value`, `delta`, `href` | Clickable tiles show hover border-strong and link to a filtered list |
| **Tabs** | underline tabs | `items`, route-aware (each tab is a URL segment) | Active: white text + 2 px accent underline; inactive: secondary. Arrow-key navigation (Radix). Scrollable on mobile with fades. |
| **DataTable** | TanStack Table: header (surface-2, micro-label, sortable with ↑↓ icon), rows (surface-1, 1 px border-bottom), sticky first column optional | `columns`, `data`, `sorting`, `onRowClick`, `selection`, `density` | Server-side sort and pagination (keyset), column visibility menu, CSV export (FR-W17), empty and loading states built in |
| **FilterBar** | search input · facet dropdowns (multi-select with search: competitor, brand, agency, platform, format, occasion, industry, country, confidence, status) · active chips row · "Clear all" · saved views menu · Grid/List toggle (right) | URL-synced (`nuqs` or `useSearchParams`) | Sticky under the topbar; on mobile collapses into a "Filters (n)" sheet |
| **ViewToggle** | two pills "GRID" / "LIST" (site pattern: small pill switch + uppercase micro-label) | `value` | Persisted per page in localStorage |
| **SearchCommand (⌘K)** | Radix Dialog + cmdk: input, groups (Items, Campaigns, Competitors, Brands, Agencies, People, News, Pages), recent searches, "Search all results for '…'" → `/search?q=` | Calls `app.search` (debounced 200 ms, min 2 chars) | ↑/↓/Enter, Esc closes; shows the platform badge and thumbnail in item results |
| **Sheet / Drawer** | right side, 560 px (item detail), 420 px (filters); bottom sheet on mobile | `open`, `onOpenChange`, `title` | Slide 320 ms; focus trap; Esc closes; the URL changes for the item drawer |
| **Dialog** | title, body, footer actions | confirm / form | Max width 560; overlay `--color-overlay`; destructive confirms name the object |
| **Toast** | icon + message + optional action | success / warning / danger / info | Bottom right (bottom centre on mobile), 5 s, pause on hover, `aria-live=polite` |
| **EmptyState** | three-dot mark (muted) or icon · one line title · one line hint · optional action | — | Copy examples in §10 |
| **Skeleton** | surface-2 blocks with a 1.2 s shimmer (off under reduced motion) | Shapes per component (card, row, tile, header) | Shown when loading takes more than 150 ms |
| **InfiniteList** | IntersectionObserver sentinel + "Load more" button fallback | Keyset cursor (`published_at`, `id`) | Shows "You're all caught up · since 1 Jan 2024" at the end |
| **Pagination** | Prev / Next + page size (admin tables) | — | — |
| **Timeline** | vertical: date marker (micro-label) · event card (item or campaign mini) | Campaign detail, person/brand history | Groups by month |
| **Chart wrappers** | `LineChart`, `BarChart` (stacked/grouped), `AreaSpark`, `Heatmap` (weekday × week), `ShareBar` (100% horizontal) built on Recharts with token colours, 12 px labels, tooltips on surface-3 | `data`, `series` (with stable colour assignment by entity id) | Every chart has a "View as table" toggle for accessibility |
| **ReviewCard** | left: thumbnail + caption (original + EN) + source link; right: AI suggestion form (brand, agency, production house, credits list, format, occasion, country, campaign) with each field's confidence and evidence snippet; footer: actions Approve (A), Edit (E), Reject (R), Skip (J), Previous (K), Merge… | `task` from `app.review_tasks` + item | Keyboard hints shown as kbd chips; optimistic update with undo toast (5 s) |
| **CodeBlock** | mono 13 px, surface-2, copy button, language label | API docs, key reveal | Key reveal: shows a once-only secret with a warning row |
| **KeyValue** | micro-label + value pairs in a grid | Detail rails, profile overviews | Site footer pattern |
| **MarketSwitcher** | segmented control | EG / KSA / UAE / All | Accent-soft on the selected segment |
| **DateRangePicker** | presets + calendar (Radix Popover) | — | — |

## 7. Interaction and motion

- **Durations:** 120 ms for hover/press colour, 200 ms for menus, tabs and popovers (fade + 4 px slide), 320 ms for drawers and card media scale. Easing `--ease-standard`, with enter/exit variants for drawers.
- **Card hover:** media scales to 1.02, the glass label brightens and the border goes to border-strong. No lift or shadow.
- **Reveal on scroll** (site signature): **only** on brief pages and the login hero. Display text starts in `--color-text-label` gray and each line turns white when it enters the viewport (IntersectionObserver, 320 ms). Never in data views.
- **Live updates:** after the WF-70 revalidation, new items show a non-intrusive pill at the top of the feed ("8 new items · Show"). The view never jumps on its own.
- **Optimistic actions:** review actions apply at once with an undo toast and roll back on error with a danger toast.
- **Loading:** skeletons, not spinners, for page content. Spinners only inside buttons.
- **Reduced motion:** all durations are 0, there is no shimmer, no reveal and no scale.
- **Keyboard:**
  - ⌘K / Ctrl+K: search.
  - `G then F`: feed. `G then C`: campaigns. `G then R`: review.
  - `/`: focus the filter search.
  - Review page: J/K, A, E, R, S.
  - `?`: shortcut sheet.

## 8. Screen specs

Shared rules for every page:
- **Global filters:** the market switcher and the date range from the topbar apply wherever they make sense.
- **Data sources:** data comes from `app` views and tables under RLS through server components. Searches use `app.search`; "similar" uses `app.similar`.
- **Caching:** each page lists its cache tags (see TECHNICAL §10).
- **Errors:** every page has a skeleton, an empty state and an error state. The error state reads "Couldn't load this. Retry" with the request id in a muted line.

### 8.1 `/login` — Sign in
- **Purpose:** Google sign-in (invite-only).
- **Layout:** full-bleed black. Centred column, max 480.
  ```
  everyone.                          (wordmark 160 px, white)
  Market Radar                       (H3 secondary)

  If it's not everyone—              (Display, reveals gray → white)
  it's no one.

  [ G  Sign in with Google ]         (secondary button, lg, full width)
  Invite-only. Ask Mohamed for access.   (small muted)
  ```
  - An optional faint green scribble SVG behind the display text (accent-deep at 30% opacity) echoes the site hero. It is decorative: `aria-hidden`.
- **States:** the OAuth error shows a danger inline message "Google sign-in didn't finish. Try again."
- **Mobile:** same, with the display text at 40 px.

### 8.2 `/no-access`
- **Purpose:** a signed-in Google account without a membership.
- **Content:** wordmark, H2 "Your account isn't on the invite list yet.", body "Ask Mohamed Abdelrahman to invite {email}.", a button "Sign out", and a muted line "Signed in as {email}".

### 8.3 `/` — Market pulse (home)
- **Purpose:** what changed today and this week, by market (FR-W2).
- **Layout:**
  ```
  MARKET PULSE · 16 Oct 2026 · KSA                            [Open feed] [This week's brief]
  ┌ StatTile ┐┌ StatTile ┐┌ StatTile ┐┌ StatTile ┐┌ StatTile ┐
  │New items ││Commercial││New        ││New       ││Needs     │
  │   148 ▲12││ works 37 ││campaigns 9││clients 4 ││review 12 │
  └──────────┘└──────────┘└───────────┘└──────────┘└──────────┘
  BIG LAUNCHES (last 7 days)                                              See all →
  [ItemCard wide][ItemCard][ItemCard]  (hero row: 1 wide 16:9 + 2 half — site rhythm)
  ┌ Most active competitors (bar, 7 days) ┐ ┌ New & returning clients (list) ┐
  │ Good People ████████ 14              │ │ (logo) Vodafone Egypt → Bigfoot… │
  └──────────────────────────────────────┘ └──────────────────────────────────┘
  ┌ Output by platform (stacked area, 30 days) ┐ ┌ Formats & occasions (share bars) ┐
  LATEST (grid of 8 ItemCards, dense)                                    Open feed →
  Pipeline strip: Vimeo ✓ 06:10 · Instagram ✓ 06:42 · Stories ✓ 07:05 · Web ✓ · LinkedIn ✓ · YouTube ✓
  ```
- **Data:**
  - Tiles: counts from `app.stats_daily` + `app.campaigns` + `app.review_tasks` (open) for the period and market. Deltas are against the previous equal period.
  - "Big launches": items where `is_commercial_work` and `content_type in (tvc_brand_film, digital_film_online_video)` and the competitor tier is pilot or baseline, plus campaigns with ≥ 3 items, ranked by recency × views.
  - "New & returning clients": brands whose first item with that competitor in the period is new, or whose previous one was more than 90 days earlier.
  - Pipeline strip: `app.pipeline_summary(1)`, shown to everyone in a simplified form.
- **Cache tags:** `stats`, `feed`.
- **Empty state:** "Nothing new in {market} this week."
- **Mobile:** tiles sit in a 2-column grid and the charts stack.

### 8.4 `/feed` — Live feed
- **Purpose:** every new item, newest first (FR-W3).
- **Layout:** H1 "Feed" + count ("2,431 items"), then the FilterBar with the Grid/List toggle on the right, then the grid (auto-fill 280, or 240 in dense mode) or the DataTable list. The new-items pill sits at the top.
- **Data:** `app.feed_v`, with `ai_status in (published, review)` by default. A "Show processing" toggle adds pending items. Keyset pagination of 48 per page.
- **Filters** (all URL-synced):
  - market, date, platform (multi), competitor (multi), tier;
  - brand, agency, industry, format, occasion;
  - status (active/removed), AI status, confidence (≥ 0.8 / < 0.8), commercial only (toggle, default on);
  - has campaign.
- **Item drawer** (`/items/[id]`, 560 px):
  - media: the thumbnail, or a key-frame carousel, with an "Open on {platform}" link;
  - caption original (`dir=auto`), then the English translation;
  - summary EN/AR;
  - fields: competitor, brand, agency, campaign (link), format, occasion, country, credits list (role: name links), tags;
  - metrics + "updated {time}";
  - confidence per field with evidence;
  - source facts (published, first seen, platform, external id);
  - actions: Similar items (opens a strip from `app.similar`), Report a correction (analyst+ opens the ReviewCard inline), Copy link.
- **Empty states:**
  - with filters: "No items match these filters." with a "Clear filters" action;
  - no data: "Nothing collected yet. First runs start after setup."
- **Mobile:** single-column cards and a bottom-sheet drawer.

### 8.5 `/items/[id]` — Item detail (full page)
The same content as the drawer, laid out 8 + 4 columns, for deep links from emails, briefs and the API.
- **Right rail:** KeyValue facts plus the campaign card.
- **Below:** "Similar items" (6 cards) and "Same campaign" (strip).

### 8.6 `/campaigns` — Campaigns
- **Purpose:** grouped work per brand × production house × time (FR-W4).
- **Layout:**
  - H1 + FilterBar (market, date by last seen, brand, production house, agency, industry, occasion, platforms, min items, status) + toggle;
  - Grid view: CampaignCards (auto-fill 320).
  - List view: DataTable with columns: key art · Title · Brand · Production house · Agency · Occasion · Country · Dates · Platforms · Items · Confidence.
- **Data:** `app.campaigns_v` (excluding merged), sorted by `last_seen_at desc`.

### 8.7 `/campaigns/[id]` — Campaign detail
```
CAMPAIGN · Ramadan 2026                                        [Compare brand] [Edit (analyst)]
"Together" — Vodafone Egypt × Good People                     (H1)
(brand logo) Vodafone Egypt · Agency: FP7 McCann Cairo · EG · 12 Mar – 4 Apr 2026 · 7 items · ▣▣▣ platforms
┌ Main (8) ─────────────────────────────────────┐ ┌ Rail (4) ─────────────────────┐
│ Hero item (16:9 key art, open at source)      │ │ AI SUMMARY (EN) + AR (rtl)     │
│ ALL CUTS  (grid of ItemCards across platforms)│ │ CREDITS (role → person links)  │
│ TIMELINE  (Timeline component by date)        │ │ CONFIDENCE 0.87 + evidence     │
│                                               │ │ KEY FACTS (KeyValue)           │
└───────────────────────────────────────────────┘ └───────────────────────────────┘
SIMILAR CAMPAIGNS (app.similar on campaign embedding) — 6 CampaignCards
```
- **Analyst actions** (all via `app.split_campaign` / `app.review_resolve`): edit the title or occasion, move items out (split), merge with another campaign.
- **Cache tags:** `campaign:{id}`.

### 8.8 `/competitors` — Competitors list
- **Purpose:** all tracked houses (FR-W5).
- **Layout:**
  - H1 + count (284 + baseline);
  - FilterBar: market, tier, category (13), in-house capability, status, activity (has posts in period); search by name;
  - Grid view: CompetitorCards. List view: DataTable with columns Logo · Name · Markets · Tier · Pilot rank · Categories · Items (period) · Campaigns (period) · Last post · Accounts health (5 platform dots).
  - Default sort: activity in the period, descending. The baseline is pinned first with a "Baseline" pill.

### 8.9 `/competitors/[slug]` — Competitor profile (tabs as URL segments)
**Header:** EntityHeader with:
- logo, name and name_ar;
- markets, tier and pilot rank;
- categories chips;
- links to website and the five platform accounts (PlatformBadges that open the source);
- actions: Compare with…, and for admins only, Edit and Pause.

**Tabs:**

| Tab (path) | Content | Data |
|---|---|---|
| Overview (`/competitors/[slug]`) | KPI tiles (items, commercial works, campaigns, new clients — period); output by platform (stacked area 90 days); formats share; occasions share; top clients (logo list with counts); top agencies; latest 8 items; "vs everyone." mini-compare (items and campaigns vs the baseline) | `app.stats_daily`, `app.feed_v`, `app.campaigns_v` |
| Campaigns (`/campaigns`) | CampaignCards filtered to this house | `app.campaigns_v` |
| Posts (`/posts`) | Feed filtered to the competitor, with platform sub-filter chips (Vimeo, Instagram, Stories, Website, LinkedIn, YouTube) | `app.feed_v` |
| Clients (`/clients`) | Table: brand · industry · first and last work together · campaigns · items · status (new / returning / lapsed > 180 days) | items × organizations |
| Agencies (`/agencies`) | Table: agency · campaigns together · last | items × organizations (agency) |
| People (`/people`) | Credited people on this house's work: name · roles · count · last credit | `app.item_credits` |
| Team (`/team`) | LinkedIn employee snapshot: headcount listed (line chart by week), joined this week / left this week lists (name, title), a roles breakdown (bar). Note: "From public LinkedIn company employee listings; weekly." | `app.employee_snapshots` |
| News (`/news`) | News and award mentions | `app.news_articles` + `news_mentions` |
| Accounts (`/accounts`) | Table per account: platform · handle (link) · status pill · last success · last error · consecutive failures · items · backfill status · next due. Admins see Pause/Resume and Re-scrape buttons. | `app.competitor_accounts` |
| In-house (`/capabilities`) | In-house capabilities as grouped chips (Pre-production / Shoot / Post / Distribution) + categories + notes from the sheet | `app.competitors` |

- **Cache tags:** `competitor:{slug}`.
- **Mobile:** the tabs scroll horizontally and the header compacts.

### 8.10 `/compare` — Compare 2–4 competitors
- **Picker:** up to 4 LogoTiles with "+ Add". The URL is `?c=good-people,bigfoot-films`, plus an "Include everyone." toggle that adds the baseline.
- **Sections:**
  - Output over time: line chart by week, one series per competitor, in stable colour order.
  - Platform mix: 100% ShareBars.
  - Formats and occasions: grouped bars.
  - Top clients: side-by-side lists; shared clients highlighted with the accent-soft row.
  - Industries: a heatmap where rows are competitors and columns are industries.
  - Agencies: overlap.
  - Team size: latest headcount from the snapshots.
  - Table view toggle for all of the above.
- **Empty state:** "Pick at least two competitors."

### 8.11 `/brands` and `/brands/[slug]`
- **List:** DataTable or cards (logo, name, industry, country, production houses worked with (avatars), campaigns, last seen, status pill for unconfirmed). Filters: industry, market, production house, agency, status.
- **Detail:** EntityHeader (BRAND) → KPI tiles → "Production houses they hire" (ranked bar with share), "Agencies" (list), Campaign timeline (by month, CampaignCards), Latest items, News mentions. Analysts get "Merge with…" and "Edit".

### 8.12 `/agencies` and `/agencies/[slug]`
- **List:** like brands, with columns for clients served and production houses hired.
- **Detail:** EntityHeader (AGENCY) → "Production houses they hire" (with counts and last), "Clients" (brands), Campaign timeline, People credited (creative directors, copywriters), News.

### 8.13 `/people` and `/people/[slug]`
- **List:** name (+ AR), primary role, organisations (houses and agencies), credits count, last credit. Filters: role, organisation, market.
- **Detail:** EntityHeader (PERSON, initials avatar, no photo) → credits table (date · campaign/item · role · organisation) → "Works with" (frequent collaborators) → houses timeline. A privacy note appears in a muted line: "Professional credits from public sources only."

### 8.14 `/markets/[market]` — `eg`, `ksa`, `uae`
- **Header:** kicker MARKET, H1 "Saudi Arabia", tabs for the other markets.
- **Sections:**
  - KPI tiles;
  - top competitors by output and by commercial works (bar);
  - top brands by campaigns;
  - industries share;
  - occasions calendar (heatmap by week × occasion);
  - latest big launches;
  - news.
- **Data:** the same views, filtered by `country` (items) or `markets` (competitors).

### 8.15 `/news` — News and awards
- **Layout:** a list grouped by week. Rows show source name, title (links out), date, kind (News / Award pill), mentioned entities (chips linking to competitor, brand, person) and a summary.
- **Filters:** kind, market, competitor, brand, date.
- **Data:** `app.news_articles` + `news_mentions` (weekly SerpAPI, D-09).

### 8.16 `/briefs` and `/briefs/[week]`
- **List:** cards per week (Monday date). Each has a scope switch ALL / EG / KSA / UAE, the title and 3 highlight lines.
- **Detail** (`/briefs/2026-10-12?scope=KSA`): an editorial page, with a 720 px reading column on black.
  ```
  WEEK OF 12 OCT 2026 · KSA                              [ALL|EG|KSA|UAE] [Copy link] [Print]
  Ramadan shoots started early in KSA.                  (Display, reveal gray→white)
  launches                                              (Wordmark label, bold italic)
   • Claim text … [3 sources]                           (each claim cites items: hover shows mini cards)
  most active
  new & returning clients
  agency × production
  team changes
  news
  what changed vs last week
  ```
  - Cited items open the item drawer.
  - Print stylesheet: white background, black text, wordmark at the top.
- **Data:** `app.briefs` (body_md rendered with a safe markdown renderer; highlights with item ids).

### 8.17 `/search` — Search results
- **Layout:**
  - big input (prefilled from `?q=`), with a "Semantic" indicator chip ("Matches by meaning and keywords");
  - type tabs: All · Items · Campaigns · Competitors · Brands · Agencies · People · News;
  - filters: market, date, platform.
  - Results are mixed in the All tab, grouped by type with a "See all n" link per group. Items show as cards, entities as rows.
  - Every item or campaign result has a "Find similar" action.
- **Data:** `app.search(q, embedding, types, filters)`. The query embedding is computed server-side, and the input is debounced.
- **Empty state:** "No matches for '…'. Try fewer words or switch market to All."

### 8.18 `/review` — Review queue (analyst+)
- **Purpose:** fast human decisions (FR-W10).
- **Layout:** a left list (360 px) and the ReviewCard on the right.
  - **Queue tabs:** All · Low confidence · New brands · New agencies · New people · Campaign merges · Account suggestions.
  - **List rows:** thumbnail or icon · reason · competitor · age.
  - **Sort:** priority, then oldest.
- **Actions:**
  - Approve (A), Edit then Save (E → form, ⌘Enter), Reject (R), Snooze (S), Next/Prev (J/K), Merge… (for entities: search existing, pick, confirm).
  - Each action shows an undo toast.
  - The counter in the sidebar updates.
- **Data:** `app.review_tasks` (status open) + the related item or entity. Writes go through `app.review_resolve` only.
- **Empty state:** "Queue is clear. Nice." (the one allowed warm line), plus the last resolved time.
- **Mobile:** list → card, with swipe disabled (buttons only).

### 8.19 `/settings/alerts` (and `/settings/profile`)
- **Alerts:** rule cards for each kind:
  - Daily digest (09:00 Cairo)
  - Instant launch
  - New client for a competitor
  - Weekly brief
  - Failing sources (admin)
  - Budget (admin)

  Each card has an active toggle, filters (market, tiers, competitors, formats) and a recipients chip input (emails; default mohamed.abdelrahman@everyone.film). Saves through `app.admin_upsert_alert_rule` (admins); non-admins can only add or remove themselves.
- **Profile:** name, theme (Dark/Light/System), default market, density. Saved in localStorage plus `app.saved_views` for named views.

### 8.20 `/admin/competitors` (+ `/new`, `/[slug]`)
- **List:** DataTable with Name · Code · Tier · Pilot rank · Markets · Status · Accounts (count/health dots) · Backfill status · Last run. Bulk actions: Pause, Resume, Set tier.
- **New / edit form** (`app.admin_upsert_competitor`):
  - name, name_ar, slug (auto), markets (multi), tier, pilot rank, categories, in-house, website, logo URL;
  - accounts repeater: platform select + URL; the handle is derived live and validated (shows "Will track daily" or "Not tracked — platform out of scope" for TikTok etc.).
  - On save, a dialog says "Onboarding started: accounts are validated, then backfill from 1 Jan 2024 runs. You'll get an email when it's done."
- **Account suggestions:** a review queue subset with Approve / Reject.

### 8.21 `/admin/taxonomies`
- Tabs per taxonomy (industry, format, occasion, category, credit role, in-house).
- A sortable list where each row shows code (read-only after creation), label EN, label AR (`dir=rtl`), active toggle and drag handle.
- "Add term" button. A warning line reads: "Codes are permanent. Labels can change. AI uses the active list from the next batch."

### 8.22 `/admin/pipeline`
- **Top:**
  - status per platform: last run, status, accounts ok/failed, items new, next run;
  - queue depths (ai_extract, embed, media);
  - failing accounts count.
- **Runs table** (`ops.scrape_runs` via `app.pipeline_summary`): workflow · platform · mode · started · duration · status · accounts · items seen/new · cost. Clicking a row opens a drawer with per-account results and errors.
- **Failing accounts list:** each has a Re-scrape button (`app.admin_request_rescrape`) and a Pause button.
- **Backfill progress:** a bar per platform, accounts done / total.
- **Settings card:** auto-publish threshold (slider 0.5–0.95, default 0.80), stories twice daily, daily budget. Saved with `app.admin_set_setting` and audited.

### 8.23 `/admin/costs`
- **KPI tiles:** today, month to date, forecast for the month, cost per new item (30 days), budget remaining today.
- **Charts:**
  - stacked bar by day per provider (Apify, OpenAI, SerpAPI, Firecrawl, fixed fees);
  - by platform;
  - by competitor (top 20 table);
  - by category (scrape, ai_extract, embed, brief, news, fixed).
- **Price book table:** read-only, with an "Edit prices" action for admins.
- **Budget alert setting.**
- **Data:** `app.costs_summary(from, to)`. Answers "What does it cost to run?" in one screen (D-25).

### 8.24 `/admin/users` and `/admin/api-keys`
- **Users:** invited and active members table (email, name, role select, status, last seen). The "Invite" dialog (email + role) calls `app.admin_invite_member` and shows the note "They sign in with Google using this email."
- **API keys:** table (name, prefix `emr_ab12cd`, scopes chips, created by, last used, status) with a "Create key" dialog (name, scopes read/write/admin, rate limit).
  - On create, a CodeBlock shows the secret once, with the warning "Copy it now — it won't be shown again." Revoke needs a confirm.
  - Call log: the last 100 `ops.api_calls` for the selected key.

### 8.25 `/docs/api` — API and MCP docs
- **Layout:** two columns. Left: TOC of endpoints and tools. Right: the content.
- **Sections:**
  - Authentication (Bearer key, scopes)
  - Rate limits
  - Errors
  - REST endpoints, each with method, path, params table, an example request (curl) and an example response in CodeBlocks
  - MCP: server URL `/api/mcp`, a config snippet for Claude/Codex, the tool list with input schemas
- **Source:** `docs/API_SPEC.md`, rendered from MDX in the repo so it stays in sync. Visible to all members.

### 8.26 Global: error and maintenance pages
- **404:** "This page isn't on the radar." with links to Pulse and Search.
- **500:** "Something broke on our side. Retry" with the request id.
- Both use the three-dot mark.

## 9. Accessibility checklist (WCAG 2.2 AA)

- [ ] **Contrast:** text pairs meet the ratios in `docs/DESIGN_STYLE.md` §4.2. The brand gray label is never used on surface-3. Deep green is never used as text on dark.
- [ ] **Focus:** a visible focus ring on every interactive element (`:focus-visible`, 2 px accent with a 2 px offset). Focus is never hidden by sticky bars (`scroll-margin-top` = topbar + filter bar).
- [ ] **Keyboard:** every action can be done by keyboard. There is a logical tab order, a "Skip to content" link first, and dialogs/drawers trap focus and return it to the trigger.
- [ ] **Target size:** at least 24 × 24 CSS px; 36 px default for buttons and 44 px on mobile.
- [ ] **No colour-only meaning:** status pills have text, charts have labels and patterns or direct labels, and confidence shows the number.
- [ ] **Images:** thumbnails get `alt` = "{format} by {competitor} for {brand} on {platform}" (or "Thumbnail of {title}"). Logos get `alt` = organisation name. Decorative scribbles get `aria-hidden`.
- [ ] **Language:** `lang="en"` on `<html>`; `lang="ar"` + `dir="rtl"` (or `dir="auto"`) on Arabic content.
- [ ] **Live regions:** toasts and the new-items pill use `aria-live="polite"`. Review counters update politely.
- [ ] **Tables:** proper `<th scope>`, sortable headers announce their sort state, and a caption or `aria-label` on every table.
- [ ] **Charts:** a "View as table" alternative and a summary sentence above each chart.
- [ ] **Motion:** `prefers-reduced-motion` honoured, and nothing flashes more than 3 times per second.
- [ ] **Reflow:** usable at 320 CSS px width and 400% zoom without horizontal scrolling of the page.
- [ ] **Forms:** visible labels, errors tied with `aria-describedby`, no placeholder-only labels.
- [ ] **Authentication:** Google SSO only, so there are no cognitive tests.

## 10. Content rules

| Thing | Rule | Example |
|---|---|---|
| Absolute date | `d MMM yyyy` | 16 Oct 2026 |
| Date range | `d MMM – d MMM yyyy` (same year) | 12 Mar – 4 Apr 2026 |
| Date + time | `d MMM yyyy, HH:mm` (24 h), Cairo time with "Cairo" suffix in admin views | 16 Oct 2026, 08:12 |
| Relative time | Under 1 min "just now"; under 1 h "12 min ago"; under 24 h "5 h ago"; under 7 d "3 days ago"; otherwise the absolute date. Tooltip shows the absolute date and time. | 5 h ago |
| Week | "Week of 12 Oct 2026" (Monday) | |
| Big numbers | 1,234 → 1.2K; 12,400 → 12.4K; 1,200,000 → 1.2M. One decimal, dropped when .0. Exact value in the tooltip. Money always exact to 2 dp: $1,234.56. | 12.4K views |
| Percent | Integers unless < 10% (one decimal) | 7.5% · 42% |
| Missing value | "—" (em dash), never "N/A", "null" or "0" | — |
| Names | Keep the source spelling and casing of brands and competitors (e.g., "electriclime°", "ARM ARTS"). The baseline is "everyone." in charts and "Everyone Films" in text. | |
| Collaboration | Use "×" between brand and talent/partner, as on the site | Samsung × Wegz |
| Arabic content | Render the original first and the English translation below it, labelled "EN". Never machine-transliterate names; show `name_ar` when known. | |
| Platform names | Vimeo, Instagram, Instagram story, Website, LinkedIn, YouTube | |
| Country | EG, KSA, UAE in chips; Egypt, Saudi Arabia, UAE in headings | |
| Buttons | Verb first, sentence case: "Approve", "Add competitor", "Re-scrape now" | |
| Emails | Subject at most 70 characters, starting with the event: "New TVC: …", "Weekly brief · KSA · 12 Oct" | |

## 11. Do / don't

| Do | Don't |
|---|---|
| Let thumbnails and logos lead every list | Fill cards with text and tiny thumbnails |
| Use the green only for state and action | Use green for decoration, headings or large backgrounds |
| Use hairline borders and surfaces for depth | Use drop shadows, glows or gradients on cards |
| Put titles bottom-left on a scrim or glass chip, as on the site | Put white text directly on a bright image |
| Show confidence and source next to AI values | Hide that a value came from AI |
| Use General Sans Medium for UI and Semibold for headings | Use a heavy roman Bold or other typefaces (Arabic content excepted) |
| Use Bold Italic only for wordmark-style labels on brief pages | Use Bold Italic for buttons or table text |
| Keep copy short and factual | Use exclamation marks, emoji or hype words |
| Render Arabic RTL with the Arabic font | Force Arabic into LTR or a Latin font |
| Keep the wordmark white on dark or black on light, with its period | Recolour, outline or retype the wordmark |
| Use skeletons and optimistic updates | Use full-page spinners or blocking modals for routine actions |
| Make every entity name a link | Make dead-end text that people can't click |
| Include `/items/[id]` deep links in emails and briefs | Link to source platforms only (always link to our page, then to the source) |
| Leave ads and jobs pages out (out of scope) | Add `/ads` or `/jobs` routes |

## 12. Email template

Used by WF-80 (digest, instant launch, new client, budget, failing sources) and WF-50 (weekly brief). It follows `docs/DESIGN_STYLE.md`. Build it with tables for email-client support, not with app CSS.

| Part | Spec |
|---|---|
| Canvas | Outer table width 100%, background `#000000`. Inner table max 600 px, centred, background `#0b0b0b`, 24 px padding. |
| Header | The everyone. wordmark as a hosted **PNG** (white on black, `assets/brand/everyone-wordmark-on-black.png` uploaded to Storage `media/brand/`), height 28 px, `alt="everyone."`. Next to it, the micro-label "MARKET RADAR" in uppercase, 12 px, letter-spacing 0.08em, `#7d7f82`. |
| Type | `font-family: 'General Sans', Arial, Helvetica, sans-serif`. Body 15 px / 22 px, white `#ffffff`. Meta 13 px, `#8e9094`. Arabic content goes in `dir="auto"` blocks with the fallback `'IBM Plex Sans Arabic', Tahoma, Arial`. |
| Accent | Green `#00cd6d` only for links and the single primary button (black text on green, radius 999 px, 12 px × 20 px padding). No other colour fills. |
| Item card | A two-column table row: the thumbnail (Storage URL, 160 × 90, `alt` = item title) on the left; title (white, 16 px), then the competitor · brand · format · date meta line, on the right. The card links to `{APP_URL}/items/[id]`, with a secondary "View at source" link. |
| Sections | Digest: counts row → top launches (max 10 cards) → new clients → footer. Brief: headline → body (Markdown rendered to simple HTML: h2, p, ul, links) → "Open in Market Radar" button. Budget and failing-sources emails: one short table, no images. |
| Footer | 12 px `#7d7f82`: "You get this because of an alert rule in Market Radar. Change it in Settings → Alerts.", plus a link to `/settings/alerts`. No tracking pixels. |
| Plain text | Every email also has a `text/plain` part with the same content: titles, meta and URLs on separate lines. |
| Subject | ≤ 70 characters, starting with the event (§10 content rules), e.g. "New TVC: Vodafone Egypt × Good People". |
| Accessibility | The thumbnails are decorative alongside a text title. Link text must say where it goes; never "click here". White-on-black contrast is 21:1. |
