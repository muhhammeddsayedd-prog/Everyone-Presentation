# Presentation rendering audit — before Everyone Film editorial template 1.2.0

Date: 2026-11-04. Branch: `feature/editorial-template-1.2.0` from `main` 08753797.
Scope: everything that decides how a casting presentation looks, from the frozen
database snapshot to the in-app preview, PDF, guest export and MCP/API access.

## 1. Current architecture

```text
Workspace (roles, slots, assignments, candidates, frames, logo)
  └─ projectReviewSlides()            packages/domain/src/review.ts
       └─ WorkspaceReview (draft)     packages/domain/src/review-types.ts
            ├─ review fit job         apps/worker/src/review-fit.ts  (Chromium, measures overflow)
            └─ generate_version (SQL) supabase/migrations/*m05*, *m07_generation_data_reuse*
                 └─ RenderSnapshot (frozen JSON, cover + one slide per assignment/pending slot)
                      ├─ PDF render + validate  apps/worker/src/presentation-pdf.ts
                      │                         + presentation-pdf-inspect-process.mjs (pdf.js)
                      ├─ render proof checks    SQL (render result acceptance)
                      └─ guest export PDF       apps/worker/src/presentation-export-executor.ts
Template = HTML string renderer   packages/templates/{src,versions/1.1.0}/render.ts
           pinned by registry     packages/templates/{,versions/1.1.0/}registry.json
           registered in DB       eps.presentation_templates (key, version, content_sha256, font_hashes)
           selected by Settings   eps.app_settings.template_version → new series
```

Entry points that generate or export, all ending in the same SQL operations and worker:

| Entry | Path |
|---|---|
| Web UI | `WorkspaceReviewView` → `/api/v1/...` → `packages/central` → SQL |
| HTTP API | `apps/web/lib/presentation-http.ts`, `[...segments]` router |
| MCP (Claude) | `apps/web/lib/mcp.ts`: `generate_version`, `get_version`, `download_version_pdf`, `prepare_pdf_export`, … |
| Background | DB jobs/outbox → n8n Cloud → worker stage executors |

## 2. Where the presentation design is controlled today

The design is code-owned, not Claude-owned: Claude only calls the same
operations as a user. But the design is defined in **four separate places** that must
agree:

1. **Template renderer** (`packages/templates/versions/1.1.0/render.ts`): dark `#080909`,
   green `#01bd68`, IBM Plex Sans (declared substitute for General Sans), 1600×900, a cover,
   a left frame column and a 2×5 grid of ten fields.
2. **Worker validation** (`review-fit.ts`, `presentation-pdf.ts`,
   `presentation-stage-executor.ts`, `presentation-pdf-inspect-process.mjs`): hardcodes 1600×900,
   1200×675 pt, `.eps-*` selectors, exactly 10 `data-fit-field` per candidate page,
   pages = slides + 1, logo boxes 220×100 / 120×50, IBM Plex font file names.
3. **SQL acceptance** (latest bodies in `m05`, `m06`, `m07_settings`, `m07_generation_data_reuse`):
   generation only for template `1.1.0`; settings accept only `1.1.0`; fit requests
   only for `1.1.0`; render/export proofs require 1600×900 px, 1200×675 pt,
   `candidate_field_count = candidates × 10`, `text_regions_checked = 3 + 23c + 27p`.
4. **Web viewers** (`PresentationVersionView`, `WorkspaceReviewView`, `GuestReviewView`):
   a **separate React re-implementation** of the slide (`saved-casting-slide` CSS),
   not the template renderer. Preview and PDF only match by convention.

`apps/worker/src/native-source-seal.ts` also allowlists the exact template/font/brand
files the sealed native sandbox may load.

## 3. Weaknesses

- Preview ≠ PDF source: the React views duplicate the layout, so a template change
  needs parallel UI work and can drift.
- Template-specific constants are spread across TS and SQL with no shared definition;
  adding any version touches ~10 files plus SQL function bodies.
- The single-file renderer is a large HTML string; there is no layout model, so no second
  export format (PowerPoint) can reuse it.
- No PowerPoint/Keynote export exists.
- Typography is a declared substitute (IBM Plex Sans for General Sans).

## 4. Functional requirements that must be preserved

- Immutable saved versions: the snapshot pins template key/version/content hash/font hashes;
  `registered.ts` keeps 1.0.0 and 1.1.0 renderers byte-for-byte. Old PDFs never change.
- One candidate slide per included assignment with **all ten fields**; every pending slot
  or role is explicit (AGENTS.md invariant). No fabricated facts or images.
- Selection = all active assignments; Shortlist = `shortlist_included`. Main/Backup/Option
  come from `position` data, never inferred from count.
- All selected frames (0–3) appear together in the PDF, at their actual aspect ratio;
  app view keeps a frame carousel.
- Original introduction link per candidate slide (fixed-version URL; guest exports get a
  link-scoped grant URL that never enters the snapshot).
- Client logo on cover, optionally on every slide (`logo_placement`).
- Review fit: measured overflow must be repaired before generation; PDF generation fails
  explicitly on overflow, missing/swapped/mislabelled images, font load failure,
  external requests or validation mismatch.
- Arabic and mixed-direction text with `dir="auto"`.
- Permissions/RLS unchanged; Claude uses only its acting user's capabilities.

## 5. Modules to replace or extend

| Module | Change |
|---|---|
| `packages/templates/versions/1.2.0/*` | **New**: tokens, layout geometry, deck model, casting composer, HTML renderer, PPTX renderer, registry |
| `packages/templates/src/registered.ts` | Register 1.2.0 next to 1.0.0/1.1.0 |
| `apps/worker/src/review-fit.ts`, `presentation-pdf.ts`, `presentation-stage-executor.ts`, `presentation-pdf-inspect-process.mjs`, `native-source-seal.ts` | Make template-specific constants come from the registry/composer for 1.2.0; keep 1.0/1.1 paths unchanged |
| SQL (new additive migration) | Register 1.2.0 row; allow it in settings/generation/fit; template-aware proof checks and page count |
| Web viewers + Settings | Render 1.2.0 slides with the template's own HTML in a fixed 1920×1080 scaled stage; offer 1.2.0 in Settings |
| API/MCP | Add editable PowerPoint download for a saved version (same permissions as the PDF download) |

## 6. Data model

No new business tables. The frozen `RenderSnapshot` already holds everything the new
design needs (cover, ordered slides with role/slot/position/fields/frames with
width/height, video, logo). The editorial deck (cover, category dividers, slot overview
pages, candidate pages, closing) is a **pure deterministic function of the snapshot and
the template version**, so old snapshots remain reproducible and new pages require no
new stored state. The only DB change is template registration and template-aware
acceptance checks.

## 7. Compatibility risks

- SQL proof/page-count checks must mirror the composer exactly; a mismatch makes every
  1.2.0 render fail closed (safe, but blocking). Mitigated with a shared count rule
  tested from both sides.
- Ten fields at the new type scale have different capacity than 1.1.0; the existing fit
  workflow reports overflow for the new template so content can be shortened.
- General Sans is licensed under the ITF Free Font License 2.0 (self-hosting in our own
  app and PDF embedding allowed; no modification/subsetting/format conversion, no
  public redistribution). The repository must stay private.
- Geeza Pro is an Apple system font and cannot be bundled; Arabic uses the already
  pinned IBM Plex Sans Arabic as a declared fallback.
- Production release needs the repository's guarded canonical DB release, worker rebuild
  with a refreshed source seal and a web deployment — outside this branch.

## 8. Recommended architecture (implemented on this branch)

```text
RenderSnapshot / WorkspaceReview
  └─ composeCastingDeck()  → EditorialDeck { pages[ { layout, elements[ box, text|image|link ] } ] }
        ├─ renderDeckHtml()   → worker PDF (Chromium) + in-app preview (same markup + CSS)
        ├─ renderDeckPptx()   → editable .pptx (native text/image objects, /144 in, /2 pt)
        └─ deckExpectations() → fit/PDF validation counts (TS) ⇄ SQL acceptance rule
```

Layout geometry for all 20 design-kit archetypes lives in one module of pure functions
(`layouts.ts`). Every format reads the same boxes, so preview, PDF and PowerPoint cannot
drift apart.
