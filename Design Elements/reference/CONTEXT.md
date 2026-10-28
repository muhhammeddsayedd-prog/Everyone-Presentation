# Source context

This folder is a snapshot of design material from **everyone. Market Radar**, prepared on 23 October 2026. File-level origins and checksums are listed in [manifest.json](../manifest.json). The export uses local files and does not remeasure the public brand website.

## Original references

[DESIGN.md](../DESIGN.md) and [docs/DESIGN_STYLE.md](../docs/DESIGN_STYLE.md) are exact copies. Their inline code paths and product references remain as written. References to schemas, n8n workflows, API contracts, environment variables, cache tags, routes, permissions and milestones describe Market Radar. These operational dependencies are not required to reuse the visual system and are not included in this kit.

The destination project's own decisions govern product functionality. Use [REUSE_GUIDE.md](../REUSE_GUIDE.md) for portable visual guidance. Within the original Market Radar references, the more specific app specification takes precedence over general website observations. For example, use the app's line-by-line reveal specification rather than the brand guide's description of the website's word-by-word reveal.

## Existing implementation

The copied source under `market-radar/apps/web/` renders a wordmark, product heading and internal footer. It uses system fonts explicitly until the brand fonts are supplied. The stylesheet mirror matches the canonical tokens.

The component and Playwright files are exact test-source references. They retain their original imports, configuration assumptions and product assertions. The copied files are a partial UI source snapshot, not a standalone installable Next.js project. No server handlers, credentials, backend code, dependency tree or lockfile are included. Run and adapt these tests only within a suitable destination project.

## Historical screenshots

The five `screenshots/web-*.png` files come from the M00 repository-bootstrap evidence folder. They show the placeholder at desktop, laptop, tablet and mobile sizes. They are historical references from 17 October 2026, not screenshots of the full specified product or new browser checks for this export.

## Optional design guidance

Market Radar uses project-local design skills alongside its own design system. They are not installed by this kit, and this kit includes no executable skill helpers. Recorded upstream pins are provenance references:

| Guidance                                           | Upstream source                              | Recorded commit                            |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| Taste, adapted as `design-taste-frontend`          | `Leonxlnx/taste-skill`, `skills/taste-skill` | `f624f37a8c650b9cc550253104925efe4c8de246` |
| Frontend engineering and related delivery guidance | `addyosmani/agent-skills`                    | `aeac41d4d005999432bb7312f7ff06383a91d59d` |
| React and composition guidance                     | `vercel-labs/agent-skills`                   | `063bee94c3f4df8453406c830b0a7df0f2860278` |

The source repository records these in `SKILLS_SETUP.md`, `SKILLS_LOCK.json` and `.agents/PROJECT_SKILL_RULES.md`. No upstream guidance or licence is represented as being redistributed here. Any later skill installation needs its own dependency/provenance review.

For a destination agent, keep the brand tokens, fonts, hairlines, micro-labels, density, 8/12 px radii, semantic states and reduced motion authoritative. Supplementary guidance should help composition, accessible states and visual review. It should not replace these with a new marketing direction, new font choices, decorative media quotas or invented data.
