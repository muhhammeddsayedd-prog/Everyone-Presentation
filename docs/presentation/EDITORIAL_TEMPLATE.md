# Everyone Film editorial template 1.2.0

Status: implemented, locally validated and validated on a staging replica of the canonical
catalogue (§D). Release state is recorded in §G and `tracking/HANDOFF.md`. Audit of the prior system:
[development/editorial-template/AUDIT.md](../../development/editorial-template/AUDIT.md).

## A. Template architecture

The application owns presentation design. Claude, the UI, the HTTP API and background
jobs all call the same operations; none of them supply layout. One composer turns
captured data into an explicit deck model, and every output format renders that model.

```text
WorkspaceReview (draft) / RenderSnapshot (saved) / PresentationVersion (viewer)
  └─ composeCastingDeck()            packages/templates/versions/1.2.0/compose-casting.ts
        → Deck { pages[ { layout, number, source_index, elements[ box, text|runs|stack|image|link ] } ] }
        ├─ renderDeckDocument()      html.ts → worker PDF (Chromium), fit measurement
        ├─ renderPageMarkup()        html.ts → in-app preview (Shadow DOM, scaled stage)
        ├─ renderDeckPptx()          pptx.ts → editable PowerPoint (pptxgenjs 4.0.1)
        └─ deckCounts()              → render/validation proofs  ⇄  SQL eps.editorial_deck_counts()
```

| Module | Responsibility |
|---|---|
| `tokens.ts` | Colours, General Sans type scale, measured anatomy, PPTX conversion constants |
| `deck.ts` | Layout IDs and the typed page/element model |
| `layouts.ts` | Pure geometry for all 20 archetypes plus the two casting extensions |
| `compose-casting.ts` | Deterministic casting deck from captured data; ten-field labels; proof counts |
| `html.ts` | Scoped markup/CSS, font faces, source/link allowlists |
| `pptx.ts` | Native PowerPoint objects, crop rectangles, image-size parsing |
| `static-images.ts` | Generated, hash-pinned raster wordmark and placeholder for PPTX |
| `registry.json` | Pins every renderer file, font and static image (`content_sha256`) |

## B. Design-system integration

- Authority: `everyone_template_design_kit/design.md` (v1.0) and `template_tokens.json`.
  Values are copied into `tokens.ts`/`layouts.ts` with their source section noted.
- Canvas 1920×1080, background `#F1F1F1`, ink `#000000`, no cards, borders, shadows or radii.
- **General Sans** (official Fontshare TrueType files, unmodified) for Extralight 200,
  Light 300, Regular 400, Medium 500, Semibold 600 and Bold 700. Its hhea ascent 1010 +
  descent 240 = 1.25 em, so the kit's measured bounds are exact line boxes:
  `line-height: 1.25` and `top` = measured y0. The TrueType build is used because
  Chromium embeds CFF fonts as Type3 glyph procedures; TrueType embeds real subset fonts.
- Licence: ITF Free Font License 2.0 (`apps/web/public/fonts/GeneralSans-LICENSE.txt`). The six
  TTFs and the licence are byte-identical to the official Fontshare archive
  (`Fonts/WEB/fonts`, `License/FFL.txt`); name records are ITF's own (vendor `ITFO`,
  v2.000) and `fsType` is 0. Reading of the licence for each use (not legal advice):
  - Web: §01 permits self-hosting via `@font-face` for the licensee's own websites and
    applications. The app is Everyone's own tool; the font is fixed by the template and is
    never offered as a selectable font to third-party users (§02 forbids that).
  - PDF: §03 permits embedding in documents distributed to any number of recipients,
    provided the font cannot be extracted for independent use. Chromium embeds subset
    TrueType programs only.
  - PowerPoint: the `.pptx` references General Sans by name and embeds no font. Staff
    install it from Fontshare; recipients outside the organisation must obtain their own
    copy (§02, §04). Never attach the font files to a deck.
  - Repository and worker image: storage and internal sharing among the licensee's own
    employees are permitted (§01); giving the files to external contractors or agencies is
    not (§02). **Keep the repository and the worker image registry private and limited to
    Everyone personnel.** Private visibility alone does not establish this: confirm that
    every collaborator is an employee of the licensee.
- Arabic: Geeza Pro is an Apple system font and cannot be bundled. The already pinned
  IBM Plex Sans Arabic (OFL) is the declared fallback; text stays real Unicode with
  `dir`/bidi isolation.
- Reference screenshots and the client logos in the kit show real people and brands. They
  are used only for local visual QA and are **not committed**; repository fixtures are synthetic.

## C. Layout registry

All 20 source archetypes are implemented as geometry functions (`layouts.ts`) and
rendered in `tests/fixtures/editorial-decks.ts`:

| Layout | Data required | Casting workflow |
|---|---|---|
| `cover_floward` | title, date line, optional note, client logo or client name | **Yes** (every deck) |
| `cover_partners` | title, date, client + partner logos | Fixture only |
| `agenda_slash` | ≤ 7 section names | Fixture only |
| `section_divider` | title | **Yes** — when the role category changes |
| `closing_thank_you` | none | **Yes** (every deck) |
| `cast_main_backup` | 1–3 portraits with Main/Backup/Option labels | **Yes** — slot overview when any Main/Backup |
| `cast_group_strip` | 2–3 portraits, no labels | **Yes** — slot overview of Options only |
| `cast_single` | 1 portrait or silhouette, optional note | Fixture (casting uses `cast_pending`) |
| `cast_profile` | portrait or wide audition still + name | Fixture only |
| `cast_ensemble` | up to 12 headshots in rows of 6 | Fixture only |
| `fitting_strip` | 1–5 full-body photos (head/shoe-safe narrowing) | Fixture only |
| `wardrobe_look_row` | 2–5 references | Fixture only |
| `wardrobe_technical_board` | rectangular rows of mixed references | Fixture only |
| `wardrobe_reference_actuals` | 1–3 Mood Board → actuals groups | Fixture only |
| `script_dialogue` | speaker + dialogue units (RTL) | Fixture only |
| `storyboard_two` / `storyboard_one` | numbered 16:9 frames, action, dialogue | Fixture only |
| `key_reference_16x9` / `single_location_reference` | one image | Fixture only |
| `production_mosaic` | rows of objects, optional local notes | Fixture only |
| `cast_detail` (extension) | one assignment: position, 0–3 frames, **all ten fields**, video link | **Yes** — one per included assignment |
| `cast_pending` (extension) | pending slot/role: silhouette, 12 requirement values, note | **Yes** — one per pending slot/role |

Casting deck rules (deterministic, data-only):

1. Cover → for each role in order: a divider when the role category differs from the
   previous role's → for each slot: overview page(s) when it has 2+ included candidates
   (≤ 3 per page, balanced) → one detail page per assignment, or one pending page → THANK YOU!.
2. Main/Backup/Option labels come from `position`; a slot with only Options is an
   unranked group. Two pictures never imply Main/Backup.
3. Candidate frames keep their whole aspect ratio (row or column, whichever gives the
   smaller frame more area). Overview portraits are cover-cropped at focal (0.5, 0.4).
4. Missing images use the source silhouette plus "Image not provided"; missing facts stay
   "Not provided"; pending pages say "Note: Pending." / "Note: Casting requirements pending.".
5. Page numbers are physical indexes, absent on cover and closing.
6. `logo_placement: every_slide` is preserved as an **explicit deviation** from the
   reference (which shows logos on the cover only): the logo sits top-right on numbered pages.

The ten fields are not in the reference shortlist; the `cast_detail` page carries them
in the kit's caption scale (Regular 24 labels, Light 30 values) because one page per
assignment with all ten fields is an application contract.

## D. Versioning

- Key `everyone-casting`, version `1.2.0`, font key `everyone-film-fonts-v1`. Changing any
  pinned file changes `content_sha256`; a later change requires a new version.
- 1.0.0 and 1.1.0 renderers, registries and proof rules are unchanged; saved versions
  keep rendering with their own template. Viewers show retained versions only when the
  saved identity matches a registered renderer.
- Settings → "Default presentation template" applies to **future** series. Existing
  series keep their template; regeneration in a new template creates a new version.
- Migration `20261104210000_m08_editorial_template.sql` registers 1.2.0, adds the
  independent SQL count mirror `eps.editorial_deck_counts(jsonb)` and makes seven
  functions template-aware (settings, review gate, fit request, snapshot data,
  generation and both result validators). It pins the seven preimage hashes read from
  canonical history 42 and asserts the seven postimage hashes in its own readback.
- Migrations 30–42 cannot be replayed on a fresh database by design: they are
  canonical-admission migrations that pin the canonical history list, role OIDs, existing
  role identities and protected-data hashes. Staging is therefore a replica of the
  deployed catalogue: `development/editorial-template/staging/build_staging.py` takes
  read-only canonical dumps (eps/public schema, roles without passwords, postgres
  memberships, history, template rows; no business rows), restores them into a disposable
  Postgres 17.11 container, proves the replica equals canonical (every function body,
  owner, ACL and attribute; tables; policies), applies the migration as `postgres`, and
  requires that exactly the seven declared bodies change with unchanged attributes, that
  the three mirror callers can execute it, and that a one-comment drift is refused.
  `eps.review_target_context` keeps its retained 1.1.0 wording-budget identity
  (AI suggestions only; not a generation gate).

## E. Export architecture

| Target | Implementation | Status |
|---|---|---|
| In-app preview | `EditorialSlide.tsx`: template markup in a Shadow DOM, fixed 1920×1080 stage, single `scale()` | Implemented (draft review, saved version app/PDF modes, guest review) |
| PDF | Worker Chromium print, 1440×810 pt pages, pdf.js validation of every page, text region, image draw and link | Implemented, worker-tested |
| Editable PowerPoint | `GET /api/v1/versions/{id}/pptx/content` (UI) and MCP `download_version_pptx`, built on request from the saved version with the caller's own permissions | Implemented, tested; opened and exported by Microsoft PowerPoint locally |
| Keynote | Import of the `.pptx` | **Not verified** — no macOS/Keynote environment |
| Native `.key` | — | Not provided |

PowerPoint details: 13.333×7.5 in, `/144` inches, `/2` points, exact line spacing,
autofit off, General Sans faces by legacy family names, cover crops as explicit source
rectangles, notes as native text highlight, video links as hyperlinks to the in-app
original-video page. Users need General Sans installed to edit with the intended faces.

MCP: Claude generates versions (`generate_version`), polls (`get_job`/`get_version`) and
downloads the PDF (`download_version_pdf`, signed URL to the stored artifact) exactly as
before; the template is applied by the application. `download_version_pptx`
(`POST /versions/{id}/pptx`) builds the PowerPoint under the acting user's own version and
media access and returns `slide_count`, `size_bytes`, `filename` and `download_url`, the
in-app content route that requires the same signed-in user (`access: signed_in_session`).
No bearer URL, public endpoint, stored copy or privileged credential is created: the web
tier has no privileged storage identity, so a stored-and-signed PowerPoint would need a
new storage write path. The build is synchronous (no export job to poll).

## F. Visual QA

`npx tsx tools/editorial-visual-qa.ts` renders every casting and archetype fixture at
1920×1080 (device scale 1, pinned fonts), writes a PDF and PPTX, and — when the kit's
reference screenshots are present locally — side-by-side and 50 % overlay comparisons
plus measured ink bounds. Output: `.local/editorial-qa/` (git-ignored).

Measured on 4 Nov 2026 against 25 reference pages (half-size screenshots upscaled 2×):
heading ink within 1–2 units in x/y and identical width (same face and size);
subtitle within 1 unit; Main/Backup, missing cast, fitting 1/2/4/5, wardrobe rows,
agenda, script, storyboard, key art and ensemble compositions matched visually. Content
images differ by design (synthetic fixtures). Tolerances: ±4 units geometry, ±8 for
font rasterisation (design.md §14.2).

Cover separator (design.md §6.2): the source draws a stem from baseline to cap height.
The authored `|` is kept and drawn at 718/911 of the title size, raised 0.193 em
(`COVER_SEPARATOR`). Measured against `floward_cast_p001`: gap 18/17, stem 8/10, gap
16/16 units, height 38/38, top within 1. PowerPoint renders any baseline-offset run as
reduced superscript, so the editable `.pptx` keeps the full-size `|`.

Known differences: the `.pptx` cover separator above; Arabic uses IBM Plex Sans Arabic
instead of Geeza Pro; storyboard and script clusters are optically centred rather than
copied per slide.

## G. Production readiness

Verified locally: unit, server, worker (real Chromium + pdf.js), SQL mirror on the staging
replica of the canonical catalogue, browser preview, and PowerPoint round-trip through
Microsoft PowerPoint (Windows). Canonical read-only preflight passed on 4 Nov 2026
(`tracking/evidence/m08/editorial-release/`).

Release order and tools (none of the production steps has been run):

1. Database: `python development/editorial-template/release/release.py apply`, then
   `readback` (two equal readbacks: history 43, template 1.2.0, the seven pinned
   postimage hashes, mirror ACL; `version_hash` unchanged from the preflight). The apply
   was refused in the 4 Nov session by the session's permission policy, before any change.
2. Worker: fresh `node tools/worker-hosting-build.mjs stage` from this source, native and
   daemon images, registry upload, pause, environment hashes, deploy, readiness, native
   pin, resume — the existing worker release procedure (development/m07/worker-*).
3. Web: deploy exact Main; then a producer selects "Everyone Film Editorial 1.2.0" in
   Settings (future series only).
4. Hosted verification: create a 1.2.0 series, measure fit, generate Selection and
   Shortlist, download PDF and PowerPoint, share a guest link and export, through both the
   UI and Claude MCP (`generate_version`, `get_job`, `download_version_pdf`,
   `download_version_pptx`).
5. Keynote import check on macOS.

Rollback: the migration is additive. Web and worker roll back to their previous
deployments (1.0/1.1 paths are unchanged in this source, so the old deployments keep
working against the migrated database). To stop new 1.2.0 series, set the default
template back to 1.1.0 in Settings; existing 1.2.0 versions stay immutable and readable
by the new web only. Never drop the template row or rewrite saved versions.
