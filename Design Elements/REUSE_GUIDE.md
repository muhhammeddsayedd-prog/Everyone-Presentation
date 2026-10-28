# Reuse the everyone. design system

Use this guide for a new app's visual foundation. The original [brand guide](docs/DESIGN_STYLE.md) explains the measurements; [DESIGN.md](DESIGN.md) contains the full Market Radar specification. Preserve the visual language while defining the destination app's own navigation, permissions, entities and data flows.

## Visual foundation

| Element    | Rule                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas     | True black by default; quiet dark surfaces and hairline borders                                                                                          |
| Accent     | One green, `#00cd6d` in dark mode, for state and action: active navigation, primary action, focus, new items, positive changes and selected filters      |
| Typography | General Sans Medium 500 for Latin UI, Semibold 600 for headings; Bold Italic 700 only for wordmark-style section labels; IBM Plex Sans Arabic for Arabic |
| Logo       | Supplied wordmark with its period; white on dark or black on light; never retype, stretch or recolour it decoratively                                    |
| Density    | Generous outer margins, tight related groups and one clear idea per row                                                                                  |
| Depth      | Borders and surface changes; shadows reserved for floating popovers and dialogs                                                                          |
| Imagery    | Real product content or work thumbnails, scrims under overlaid titles; neutral tiles for third-party logos                                               |
| Copy       | Short, factual and calm; sentence-case action labels; missing values use an em dash                                                                      |
| States     | Loading, empty, error, disabled, focus, hover, pressed and selected states are part of the component                                                     |

Use semantic CSS variables from [tokens.css](assets/brand/tokens.css). [tokens.json](assets/brand/tokens.json) mirrors them in custom grouped JSON; it is not a standard token interchange format or a ready-made Figma import.

## Integrate the files

1. Copy `assets/brand/tokens.css` into the destination app's styles. Import it once from the global stylesheet. Keep its dark defaults, light overrides and reduced-motion block together.
2. Place the supplied logos in the app's public or bundled assets directory. For Next.js, the existing reference uses `/brand/everyone-logotype.svg`.
3. Supply the fonts described in [FONT_SETUP.md](FONT_SETUP.md). The token CSS expects `/fonts/…`; adapt those URLs if the destination app uses a different public path.
4. Set the page background, text colour and font from `--color-bg`, `--color-text-primary` and `--font-sans`. Apply the Arabic stack to Arabic content.
5. Build the required primitives using [COMPONENTS.md](COMPONENTS.md). Use the destination project's existing accessible component infrastructure and dependencies where appropriate.
6. Validate the complete destination experience at the sizes and interaction states it needs. The source screenshot and test references do not verify the destination app.

For plain CSS, a global import can be as small as:

```css
@import './tokens.css';

body {
  margin: var(--space-0);
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  font-weight: var(--weight-medium);
}

:lang(ar) {
  font-family: var(--font-arabic);
  line-height: calc(var(--leading-body) + 0.15);
}
```

The original token file includes a commented Tailwind v4 mapping. The copied [global stylesheet](reference/market-radar/apps/web/app/globals.css) shows the existing project's mapping, including its explicitly temporary system-font placeholder. Adapt it to the destination build setup after checking that project's installed framework versions. This kit installs no dependencies.

## Themes and contrast

Dark is the default. The CSS defines light overrides on `:root[data-theme="light"]`; set `data-theme="light"` on the root element to select them. A theme control, preference persistence and initial theme handling still need implementation in the destination app.

The preserved sources have two integration limits:

- **Primary buttons in light mode:** `--color-accent` becomes dark green `#176e45`, while `--color-text-on-accent` remains black. Combining these as fill and text gives approximately 3.35:1, below the normal-text AA target. Use the intended bright light-theme fill `--color-accent-deep` (`#00b460`) with black text, or white text on the dark-green fill. Check the hover and focus states too. The original files are retained as source snapshots.
- **Charts in light mode:** categorical and sequential series colours are unchanged by the light override. The original categorical contrast claims cover dark backgrounds. Check all series against the destination chart canvas and add labels or patterns as needed.

Brand gray `--color-text-label` is unsuitable for normal text on dark `surface-3`. Use `--color-text-muted` there. Deep green is a fill on dark surfaces, with white text, rather than a dark-theme text colour. Platform colours belong on small badges, not large decorative fills.

## Type, space and layout

| Scale         | Values                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Type          | Display 40–68 px; wordmark labels 32–49; H1 32; H2 24; H3 18; card title 22; body 14 or 16; small 13; micro-label 12; KPI 36 |
| Spacing       | 4 px base: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80                                                                       |
| Radius        | 8 px buttons, inputs, chips and thumbnails; 12 px cards and dialogs; 999 px pills and avatars                                |
| Desktop shell | Sidebar 248 px or 72 collapsed; topbar 64; content maximum 1440; gutter 32                                                   |
| Tablet        | 768–1023 px; collapsed sidebar and smaller grids                                                                             |
| Mobile        | Below 768 px; 16 px side gutter, stacked content and filters in a sheet                                                      |
| Breakpoints   | 375, 640, 768, 1024, 1280, 1536 px                                                                                           |
| Motion        | 120 ms hover/press, 200 ms menus/tabs, 320 ms drawers/media; zero durations with reduced motion                              |

These are the original app's defaults. Keep the visual proportions while choosing the navigation and information density appropriate to the new product. Use tabular numerals for metrics, money, counts and table dates. Keep body copy to about 72 characters per line. The complete line heights and tracking values are in the token files.

The Market Radar mobile topbar specification is 56 px; its general topbar token is 64 px. Treat mobile height as a responsive rule. A table wider than its container may scroll inside that container; the page itself should reflow.

## Components and behaviour

Start with buttons, inputs, chips, badges, tabs, menus, dialogs, drawers, tooltips, tables, pagination, skeletons, empty states and toasts. Add media cards, entity headers, charts and domain-specific review forms only when the new app needs them. See the extracted [component catalogue](COMPONENTS.md) for anatomy and state recipes.

Hover changes the surface or border. Thumbnail media can scale to 1.02 over the slow duration; cards do not lift. Loading page content uses skeletons; button actions may use a spinner. Respect reduced motion without shimmer, scale or reveal. The source app-specific reveal specification is line-by-line, only on login heroes and brief pages; data views need no reveal treatment.

Use the source specifications' lucide-style line icons with 1.5 px strokes and 16/20 px sizing if the destination stack supports them. Platform glyphs and icon packages are not included.

## Accessibility and bilingual content

- Maintain at least 4.5:1 for ordinary text and 3:1 for large text and applicable UI boundaries; validate actual foreground/background pairs.
- Show the accent focus ring on every interactive element. Preserve keyboard access, logical focus order, visible form labels, accessible errors and focus return from dialogs.
- Support 320 CSS px reflow and 400% zoom. Use at least 24 × 24 CSS px targets, with larger touch controls where specified.
- Use `lang="ar"` and `dir="auto"` or `dir="rtl"` for Arabic content. Show the original source text before a labelled translation. Do not transliterate names automatically.
- Give status indicators text labels. Supply chart legends, descriptions and a table alternative. Announce appropriate asynchronous updates politely.
- Keep source, date and confidence visible for AI-derived values; distinguish unavailable data from zero.

The full checklist is in [DESIGN.md](DESIGN.md), section 9. Its Google SSO line is a Market Radar authentication choice; adopt the destination app's own accessible authentication requirements.

## Content and email

The brand name is `everyone.` in brand moments and `Everyone Films` in prose. Preserve supplied organisation names and casing. Start buttons with verbs, explain failures with a next step and use an em dash for unknown values. Format numbers and times for the destination audience; Cairo, EG/KSA/UAE filters and Market Radar alert subjects are source-product choices.

[DESIGN.md](DESIGN.md), section 12, specifies a table-based email: black canvas, centred 600 px content, PNG wordmark, a single green primary action, readable text and a plain-text counterpart. This is a specification, not an implemented email template. Its `#0b0b0b` inner canvas is an email-specific value, separate from the app's `#0b0b0c` surface token. Replace Market Radar subjects, links, alerts and footer copy with the destination app's own.

## Handoff checks

- [ ] The target product's name, navigation, routes, roles, data and empty/error copy are defined.
- [ ] Brand assets and font files are served locally with the necessary licence notices.
- [ ] Dark and light button, text, chart and focus combinations are checked.
- [ ] Keyboard, touch, Arabic, reduced motion, zoom and small-screen flows are checked in the target app.
- [ ] Actual component states and complete user flows pass the destination project's tests.
- [ ] Implemented behaviour is recorded separately from specifications and historical screenshots.
