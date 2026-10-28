# everyone. Design Elements

A portable design reference for building other everyone. apps and internal systems. Copy this entire folder into the destination project. It contains the existing Market Radar design system, brand assets, design tokens and source references, plus instructions for adapting them.

Prepared on **23 October 2026, Africa/Cairo**. Original brand measurements were recorded on **17 October 2026**; this export does not refresh the public website research.

## Start here

1. Read [REUSE_GUIDE.md](REUSE_GUIDE.md) for the reusable visual system and integration steps.
2. Read [FONT_SETUP.md](FONT_SETUP.md). The six specified font binaries are **not included** in the source repository.
3. Use [ASSET_CATALOG.md](ASSET_CATALOG.md) to find the logos, CSS and JSON tokens.
4. Read [COMPONENTS.md](COMPONENTS.md) for component specifications and [DESIGN.md](DESIGN.md) for full layouts, interaction, accessibility, screen and email specifications.
5. Give [AI_HANDOFF.md](AI_HANDOFF.md) to a development agent along with the destination app's requirements.

## Contents

| Location                                           | What it contains                                                | How to use it                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [DESIGN.md](DESIGN.md)                             | Exact original UI specification, including Market Radar screens | Reuse visual and interaction rules; adapt product routes, entities and integrations |
| [docs/DESIGN_STYLE.md](docs/DESIGN_STYLE.md)       | Exact original brand research and style guide                   | Brand, logo, tone, typography, imagery and contrast rationale                       |
| [assets/brand/](assets/brand/)                     | Three logo assets and two token files                           | Copy assets into the destination app's asset pipeline                               |
| [REUSE_GUIDE.md](REUSE_GUIDE.md)                   | Portable implementation guidance                                | Start a new app without inheriting Market Radar's backend or domain                 |
| [COMPONENTS.md](COMPONENTS.md)                     | Extracted component catalogue                                   | Build the components needed by the destination app                                  |
| [reference/market-radar/](reference/market-radar/) | Existing placeholder UI source, styles and test source          | Inspect the original implementation; this is a partial source snapshot              |
| [reference/screenshots/](reference/screenshots/)   | Five historical M00 placeholder screenshots                     | Visual reference for the existing placeholder only                                  |
| [reference/CONTEXT.md](reference/CONTEXT.md)       | Source boundaries and optional design skill provenance          | Understand what was copied and what remains project-specific                        |
| [manifest.json](manifest.json)                     | File inventory, source paths and SHA-256 checksums              | Verify the exported snapshot                                                        |
| [verify.mjs](verify.mjs)                           | Dependency-free local verifier                                  | Run `node verify.mjs` from this folder                                              |

## What is ready to reuse

The brand assets and CSS/JSON tokens are included. The design documents specify colours, typography, spacing, radii, elevation, focus, layout, charts, component states, responsive behaviour, RTL, content and email patterns.

The full component library, app shell, theme toggle and Market Radar screens are **specifications**, not implemented components. The copied application source renders the existing branded placeholder with system fonts. Its test files are source references, not newly executed browser acceptance.

Font binaries and licence texts, platform glyphs, generated favicons and editable Figma files are absent. [FONT_SETUP.md](FONT_SETUP.md) and [ASSET_CATALOG.md](ASSET_CATALOG.md) identify what still needs supplying.

## Snapshot and verification

Original design documents, assets, UI source and screenshots are copied without moving or modifying the originals. References inside those original documents to `docs/DATA_SCHEMA.md`, workflows, routes, environment variables or repository paths describe Market Radar; those dependencies are not bundled. Use the standalone guides for another app.

Run this from the copied folder:

```powershell
node .\verify.mjs
```

The verifier checks file hashes, the complete file inventory, CSS/JSON token parity, the app stylesheet mirror and local links in the new guides. It does not run the reference app, download fonts, install dependencies or establish visual/accessibility acceptance in another app.

After intentional changes in a destination project, treat its files as an adapted design system. This export's checksums describe the original snapshot. Refresh an export by reviewing and recopying its listed sources, updating the guides and regenerating the manifest; do not overwrite destination changes without review.
