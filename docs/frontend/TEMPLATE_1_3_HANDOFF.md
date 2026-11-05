# Template 1.3.0 — handoff to the backend owner (Codex)

Owner decision, 2026-11-05: presentations should show only the information that was provided, with two or three people per slide.

The owner chose four rules:
- **Grouping:** one page per slot, with its Main, Option and Backup people side by side (up to three per page, more pages if needed).
- **Facts:** every provided field appears under each portrait. Empty fields are left out, and no "Not provided" text is drawn.
- **Detail pages:** none. The slot page is each person's only page.
- **Open slots:** still shown as "Pending", listing only the requirements that were given.

## What already exists (frontend branch `frontend/presentation-first-p3`)

**`packages/templates/versions/1.3.0/`**
- Copied from 1.2.0. The changes are confined to `compose-casting.ts`, `layouts.ts` (`castGroupDetail`, `factsHeight`, `providedFieldGrid`), `tokens.ts` (`factLabel` and `factValue`) and `deck.ts` (layout `cast_group_detail`, `DeckPage.sources`).
- The 1.2.0 files are unchanged; `node tools/editorial-template-registry.mjs --check` still passes.
- Pinned registry: `content_sha256` `cce5ad15d67b59900d4eb8c6be685c6d1a34c459121e6c55857f262856c0f21e`, font key `everyone-film-fonts-v1` (same fonts as 1.2.0). To regenerate it after any edit: `node tools/editorial-template-registry.mjs --version=1.3.0`.

**Composition rules (deterministic, from the captured review only)**
1. Page order: cover, an optional category divider, then one page per slot, then THANK YOU!.
2. A slot with two or more people becomes `cast_group_detail` pages of up to three, split evenly (4 → 2 + 2).
3. A single person, or a slot whose provided facts cannot fit under the portraits, gets `cast_detail` pages with only the provided fields. Nothing provided is dropped.
4. Open slots and roles become `cast_pending` pages listing only the provided requirements.
5. `DeckPage.sources` lists every captured slide drawn on a page. `source_index` is the first of them.

**`deckCounts(deck).candidate_fields`** counts the candidate fact texts actually drawn on `cast_detail` and `cast_group_detail` pages. It is no longer pages × 10.

**Web**
- `renderRegisteredReviewDocument` routes 1.3.0.
- The draft and server-review stages render it.
- The live stage offers "Everyone Film Editorial 1.3.0 (2–3 people per slide) · preview only".

**Tests**
- `tests/domain/template-slot-pages.test.ts` (5 tests).
- `tests/e2e/live-stage-ui.spec.ts`: the 1.3.0 preview test.

## Needed before 1.3.0 can generate (backend, database and contract)

1. **Contract.** Update `CONTRACT_BASELINE.md` BR-019 ("Show all ten agreed fields"), the `AGENTS.md` invariants ("One candidate slide per included assignment; all ten fields"; "use Not provided and Pending") and `tracking/DECISIONS.md` to the owner's new rule for template 1.3.0. Versions 1.0–1.2 keep their rules.
2. **Database.**
   - Register 1.3.0 wherever template identities are allowed: series creation, settings `template_version`, and version capture.
   - Add a 1.3.0 counterpart of the 1.2.0 deck-count rule (`eps.editorial_deck_counts`, migration `20261104210000_m08_editorial_template.sql`):
     - page count from the slot grouping above;
     - candidate field count equal to the facts drawn;
     - no separate overview pages.
   - Accept the 1.3.0 fit fonts, as the staged 1.2.0 fix (f7693ed8) does.
3. **Worker.**
   - `isEditorialTemplate`, `loadReviewTemplateAssets`, `editorialSnapshotOptions`, `editorialDeck` and `editorialExpectations` for 1.3.0 (import its composer).
   - `presentation-pdf.ts` proof: `candidate_field_count` must come from `deckCounts`.
   - `review-fit.ts`: `editorialStructureMatches` and the `cast_detail` count check, where `cast_detail` pages are no longer one per candidate.
   - Fit attribution: a slot page holds several people with the same field keys. Report overflows with the page's `sources`, or prefix the fit key with the person.
4. **PowerPoint export.** `apps/web/lib/presentation-pptx.ts` routes 1.2.0 only. Add 1.3.0 (`versions/1.3.0/pptx.ts` is a copy and draws the same deck).
5. **Saved versions and guest review.** Once 1.3.0 versions can exist, the saved-version viewer and `GuestReviewView` need 1.3.0 routing. That is frontend work and can be done as soon as the server accepts 1.3.0.
6. **Default.** After a guarded release, the owner switches the Studio default template to 1.3.0 in Settings. Existing series and saved versions keep their template.
