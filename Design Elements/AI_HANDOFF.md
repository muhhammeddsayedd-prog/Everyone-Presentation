# Handoff prompt for another app

Copy the prompt below into the target project's development session. Fill in the target-app brief before implementation, or let the agent inspect an existing target project for those requirements. The folder can be used with another framework; it does not require the Market Radar backend.

```text
Use the attached "Design Elements" folder as the design reference for this app.

Target app:
- Name and purpose: [fill in]
- Intended users and their main tasks: [fill in]
- Requested pages, routes and features: [fill in]
- Existing repository/framework: [fill in, or inspect the current project]
- Real data sources and data contracts: [fill in, or inspect existing contracts]
- Authentication, roles and permissions: [fill in, or inspect existing rules]
- Required themes and supported languages: [fill in]
- Delivery scope and acceptance criteria: [fill in]

Read the target project's own operating rules first. Then read the kit's
README.md, REUSE_GUIDE.md, FONT_SETUP.md, ASSET_CATALOG.md and COMPONENTS.md.
Use DESIGN.md and docs/DESIGN_STYLE.md as the original brand and UI references.
Use assets/brand/tokens.css as the canonical token source and tokens.json as
its grouped mirror. Preserve the exact original reference files; make
target-owned adaptations where the new app needs them.

Preserve the everyone. design language: a black stage by default, quiet type,
hairline borders, clear density and hierarchy, an intentional spacing scale,
and green reserved for meaningful state and action. Use the supplied semantic
tokens. Respect the documented status and chart-color exceptions. Avoid
decorative accents, card glows, arbitrary shadows and invented artwork.
Show real thumbnails or logos when they help the user's task. Use honest empty,
loading and error states when real data is absent.

Use General Sans Medium for Latin UI, Semibold for headings, and Bold Italic
only for the specified section-label role. Use IBM Plex Sans Arabic for Arabic.
The six font binaries and their license texts are missing from this kit:
follow FONT_SETUP.md to obtain and integrate them, or use an explicit fallback
and report typography as pending. Do not hot-link the original website.
Preserve the supplied everyone. artwork and its period. Follow ASSET_CATALOG.md
for SVG currentColor behavior and the square PNG canvas.

Adapt the design to this app's actual routes, terminology, workflows and data.
The Market Radar screen list, entities, API paths, AI-confidence values, Cairo
time examples, Google sign-in, Supabase roles, n8n workflows and email routes
describe that source app. They are not requirements for this target app.
Use this target app's approved backend, authentication and role model. Confirm
consequential missing requirements together; do not invent a business workflow
from the reference screens. Keep reversible presentation choices consistent
with the supplied design.

Treat COMPONENTS.md and the original component tables as design specifications.
The archived implementation under reference/market-radar/apps/web is a branded
placeholder with system fonts. It is not a completed component library or app
shell. Build only the components and screens needed for the requested target
scope, using the target stack. Follow its established tests and tooling.

If a light theme is required, validate each actual color pairing. The original
light tokens set --color-accent to #176e45 but retain black
--color-text-on-accent; using that pair for normal button text gives about
3.35:1 contrast. Use white text on the dark accent, or the light theme's bright
--color-accent-deep fill with black text, as appropriate. Keep text/link and
button-fill roles distinct in target-owned tokens. Chart colors also need
review on light surfaces. Token inclusion is not accessibility acceptance.

Make every requested flow usable with keyboard, visible focus, correct labels,
dialog focus behavior and touch targets. Support Arabic and mixed-direction
content with the proper language, direction and font. Respect reduced motion,
provide text with status colors, and provide accessible alternatives for
charts. Keep motion limited to the documented purposes. Test reflow, overflow,
loading, errors and empty states at the target's required viewports.

Verify the requested app flows with the target project's appropriate checks.
Inspect the rendered interface where permitted and use accessibility tools
when available. Distinguish source review, unit tests, browser checks and any
live integration checks in the handoff. The historical screenshots in
reference/screenshots are placeholder references only; do not claim current
acceptance from them. Report missing fonts, assets, data or verification
honestly, and record any justified design adaptation in the target project.
```

Project-specific design skills are optional supplementary guidance in the target project. This folder does not install them, start a new app, or authorize deployments, paid services or external actions.
