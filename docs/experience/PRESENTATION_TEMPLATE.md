# Design system and presentation template contract

**Status:** implementation specification. The real production template assets and fonts are discovery inputs; none are claimed to have been implemented or approved by this document. Preserve the supplied Everyone presentation references and the agreed content behavior. Where this document supplies dimensions or interaction defaults, they are build defaults to validate against those references.

## 1. Two related visual surfaces

The internal application is a production workspace. Generated presentations are client-facing documents. Use Everyone's recognizable visual language in both without copying dense application controls onto slides.

| Surface | Direction | Intended use |
| --- | --- | --- |
| Internal app | Dark navigation/chrome, calm panels, restrained green actions, generous content spacing | Producers compare candidates, inspect source information, organize work. |
| Guest review | Light presentation canvas with compact surrounding review controls; mobile-friendly | Agency/client reviewers inspect cast and record opinions. |
| Generated PDF | Clean, consistent slide layouts, readable English labels, no app navigation or processing diagnostics | A portable version of the exact generated content. |

The existing HTML prototype is a UX reference. Its local canvas PDF, synthetic candidate illustrations, simulated scanning, sample project creation, and localStorage model are not production architecture. The earlier `DESIGN.md` references were a broader Everyone app style guide, not an exact specification for these casting slides. During M00, collect the real deck/template references and record the selected template version. The user's later one-candidate-per-slide and ten-field requirements govern the adaptation of older comparative layouts.

## 2. Proposed application tokens

These defaults make implementation concrete while preserving room for template measurement in discovery.

| Token | Initial value / behavior | Notes |
| --- | --- | --- |
| Brand green | `#00CD6D` | Accent/action identity, never sole status indicator. |
| App background | Near-black neutral | Measure final text/background contrast. |
| Panel surfaces | Two restrained dark neutral levels | Avoid decorative gradients that compete with portraits. |
| Presentation canvas | Warm white or reference-matched white | Keep print output consistent with approved template. |
| Primary English font | General Sans if licensed assets are supplied; otherwise approved fallback | Bundle fonts for deterministic worker rendering. |
| Source Arabic font | IBM Plex Sans Arabic if supplied/approved | Source transcript support; presentation English by default. |
| Border radius | Modest and consistent across controls | Slides follow the actual template geometry. |
| Spacing scale | 4, 8, 12, 16, 24, 32, 48 px | Product UI default, not a slide-design constraint. |
| Status styling | Icon + readable label + tone | Unreviewed, Pending, error, and success remain distinguishable without color. |
| Motion | Short, optional, reduced-motion aware | No automatic portrait carousel or distracting progress loops. |

Avoid using green as a substitute for selection semantics: Main, Reviewed, Preferred, and Shortlisted mean different things even if they share a positive color. The text label is authoritative.

## 3. Reusable UI components

Build components around stable domain concepts: project picker, source uploader, role card, slot section, candidate card, candidate inspector, profile-fact editor, media player, frame picker, assignment controls, slide wording editor, requirement clarification badge, job row, version switcher, review-link drawer, guest preference group, comment thread, and save-status indicator.

Each component needs loading, empty, populated, permission-limited, validation, stale-write, and network-failure states where applicable. A skeleton is not a permanent empty state. A disabled control includes the reason when the actor needs to understand it. Hide privileged actions when merely revealing their existence adds no value; never rely on hiding for actual authorization.

Actions that affect different scopes must be visually distinct:

- **Edit profile facts:** reusable information, saved to the shared library/canonical record.
- **Edit project availability:** this project's relationship with the candidate.
- **Edit casting choice:** one role/slot assignment.
- **Edit slide wording:** presentation display text for the assignment.
- **Generate version:** immutable captured output.

## 4. Accessibility and responsive behavior

Adopt **WCAG 2.2 AA as the application target**, then validate complete producer and guest flows. W3C defines testable criteria covering keyboard use, text alternatives, contrast, focus, dragging alternatives, target size, and status messages. Do not claim conformance from automated scans alone. Source: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/), checked 27 October 2026.

Implementation requirements:

- Complete keyboard operation for project selection, uploads, facts, assignments, ordering, generation, comments, and preference controls.
- Visible focus that is not hidden behind sticky headers/footers; logical focus return after closing a drawer or modal.
- An explicit button-based alternative to dragging candidates or frames.
- Accessible control names matching visible labels; grouped choice semantics for Option/Main/Backup and guest preferences.
- Carousel buttons with frame number and total; no automatic advance. Arrow keys must not interfere with typing in a comment box.
- Readable inline error text linked to its field; nonintrusive live announcements for save/upload completion and errors.
- Source transcripts available alongside spoken introductions. Preserve Arabic runs with correct direction and mark source language where known. Do not claim that an unverified automatic transcript is a reviewed caption track.
- Actual frame alt text describes its purpose, such as “Selected frame 2 of 3 for CAST-DEMO-001,” without guessing identity traits from appearance.
- Respect browser zoom, text resizing, reduced motion, and high-contrast needs. Test the guest viewer on a narrow mobile viewport and with the on-screen keyboard open.
- Color contrast measured against actual computed colors, including disabled text, badges, green buttons, focus rings, and light PDF preview panels.

Internal desktop layout can optimize for role boards and comparison, but mobile must support reading, reviewing, commenting, and basic corrections. Replace a wide board with role/slot selection rather than forcing whole-page horizontal scrolling. Candidate facts should reflow outside the slide canvas when necessary; the fixed slide remains available as the fidelity preview.

## 5. Template family and design ownership

The first template family has three layouts:

1. **Cover** — project/client, output title, version context where approved, Everyone identity, optional client logo.
2. **Candidate** — one assignment, actual frames, role/slot context, position, ten fields, video link preview.
3. **Pending** — role/slot, requirements, clear pending state.

Do not add a freeform editor, custom slide types, or an arbitrary template marketplace. Treat the template as a versioned implementation asset. Its identifier and version are stored in every generated snapshot. A future template change affects new generations only.

Initial engineering default is a **16:9 landscape master**. Confirm the real reference's ratio in M00 before finalizing layouts. If the approved reference uses a different ratio, record the adaptation and update the render fixtures. A logical 1600 × 900 canvas is a useful implementation starting point; it is not evidence of the original deck's dimensions.

### Required final template deliverables

- Approved source/reference links or provided local assets.
- Font files and licensing/source record suitable for app and server rendering.
- Logo rules, background colors, text styles, safe areas, portrait sizing/cropping policy.
- Cover, candidate, and Pending HTML/CSS/components.
- Representative long/short/missing-data fixtures and reference screenshots.
- Explicit layout-overflow checks and print settings.
- Stable snapshot input contract and asset manifest.

## 6. Candidate slide content contract

Exactly one candidate slide represents one active assignment in the selected output. The same candidate assigned to two roles produces two slides. Candidate identity must never be treated as the slide's unique key; use the captured assignment identity as well.

### All ten fields are always present

| Order | Visible English label | Source | Missing rendering |
| --- | --- | --- | --- |
| 1 | Name / Casting ID | Reusable supplied name, with casting ID fallback | Available casting ID; if neither is supplied in a synthetic preview, Not provided. |
| 2 | Age / Age range | Supplied age or stated range; do not infer | Not provided |
| 3 | Height / Measurements | Supplied measurements with units | Not provided |
| 4 | Languages / Accents | Supplied languages and accents | Not provided |
| 5 | Skills / Experience | Reusable facts or accepted assignment wording | Not provided |
| 6 | City / Location | Supplied usual location | Not provided |
| 7 | Previous projects / Roles | Recorded prior work or accepted display wording | Not provided |
| 8 | Cast category | Supplied/recorded classification | Not provided |
| 9 | Project availability | Workspace candidate availability for this project | Not provided |
| 10 | Presentation notes | Assignment's presentation-specific notes/wording | Not provided |

Stated gender is a library-search field, not an extra agreed PDF field. Source transcript, phone/email, internal production notes, audit information, AI confidence, and processing diagnostics must not be added automatically to the external candidate page. Availability is never inferred from a candidate's old project record.

Use a consistent role/slot heading and position badge outside the ten-field block. If no Main is chosen, Option slides still render normally. Do not replace them with Pending simply because the producer has not made a final decision.

### Portrait layout

In the app, the candidate's slide contains an accessible carousel of the selected views. In the PDF, **all available selected views appear together on the candidate's single page**. Three views are the target, not a requirement to fabricate missing images.

| Frame count | Required behavior |
| --- | --- |
| 3 | Show three distinct selected actual frames in the saved order. |
| 2 | Show two frames with a balanced layout; do not duplicate one into a third cell. |
| 1 | Show the actual available frame with a sensible single-image layout. |
| 0 | Implementation fallback: honest “Image not provided” placeholder, flagged in review. No generated portrait. |

The user explicitly accepted fewer than three frames; the zero-frame placeholder is a practical nonblocking implementation default. The final-review screen must make it visible so the actor can confirm the available material or replace the video. Confirming “no usable frames” is not a successful three-frame extraction result.

Use containment or an actor-confirmed crop that preserves the relevant subject; do not automatically crop out faces or misrepresent a selected view. Store the crop and frame timestamps in the version snapshot. Video sampling must retain actual source pixels, with only agreed resizing/encoding. No beauty retouching, identity inference, or synthesized views.

### Candidate text fitting

Design the normal page for ten readable fields, with enough room for short multi-line experience and notes. The layout must prefer clear hierarchy and consistent font sizes over packing arbitrary prose into every page.

Final review measures actual rendered fit using the template and fonts. Character counts may offer early hints but are not a reliable final fit test. When content overflows, identify the field and provide **Edit slide wording** and optional **Suggest shorter wording**. Keep the full original fact in the library. The actor or authorized Claude operation chooses the wording to use.

Do not silently clip text, omit a field, convert missing text into an empty label, reduce to unreadably small fonts, or spill into an unplanned second candidate page. The one-slide rule is part of the product contract. A technical overflow requires a wording/layout repair before a ready PDF can be claimed.

## 7. Cover and Pending slides

### Cover

Show the selected output title **Cast Selection** or **Cast Shortlist**, project/campaign name, and client name. Use the original Everyone template identity. Include the client's uploaded logo when present. Version number and generated date can be small supporting metadata if the approved template supports them. Do not use placeholder business names in a real project to disguise missing central data.

### Pending slot

Each slot with zero included assignments for the selected output gets exactly one Pending page. In Selection, this means no active assigned candidates. In Shortlist, this also includes a slot that has assigned candidates but none explicitly shortlisted.

Show role/slot name, clear **Pending** heading, and the requirements relevant to that slot: classification, scenes/settings, age range, gender requirement, appearance/performance, languages/accents/skills, shoot dates/location/availability, and instructions. Missing requirements remain **Not provided**. Do not borrow another role's requirements to fill gaps.

If no roles have yet been entered, the nonblocking implementation default is a cover plus a single **Casting requirements pending** page. This page is a workspace-level fallback, not a fictional role or candidate record. It disappears from new generations once actual roles/slots exist. Record this default in the decision log if the implementation adopts it.

## 8. Page ordering and counting

Order is deterministic:

1. Cover.
2. Roles by saved role order.
3. Each role's slots by saved slot order.
4. Included assignments in each slot by saved assignment order, or one Pending page if none.

Position labels do not implicitly reorder slides. A user's explicit reorder is saved and captured. Role/slot headings can be included on every candidate/Pending page; separate section-divider pages are not required in v1 and must not unexpectedly inflate the page count.

For a workspace with at least one slot:

`page_count = 1 cover + included_assignment_count + number_of_empty_slots_in_selected_output`

The synthetic main fixture intentionally repeats a person across roles. Its Selection has **8 pages** and its Shortlist has **6 pages**, as detailed in `fixtures/casting-happy-path.json`. Compare the ordered slide manifest, not just the final count; the same count can conceal an omitted candidate and a duplicated Pending page.

## 9. Logo contract

Upload, persist, and select a logo from the Project step. Support transparent PNG/WebP and JPEG as documented by the upload contract. Validate actual content type and decodeability. Do not trust filename extension alone.

Placement values are **cover** and **every_slide**. Preserve original aspect ratio with a bounded logo region. Small artwork can be scaled only within acceptable quality; never stretch it to fill a portrait slot. Check a dark, white, transparent, very wide, and very tall test logo against the selected template.

Replacing or removing the working logo affects future generations. Every ready version keeps its original selected logo asset, placement, and template version. If an upload is replaced or the user switches project before it finishes, its late result must not attach to the wrong project.

## 10. Snapshot and PDF fidelity

The generated snapshot must be sufficient to render the same content without consulting mutable candidate facts. Final preflight is bound to a selected presentation series, output/audience policy, and template and returns an `input_fingerprint`. Generation recomputes that fingerprint while capturing the immutable manifest in one consistent snapshot; stale central facts or a changed output/audience/template require refreshed review rather than silent capture of unreviewed changes. This generation fingerprint is separate from the candidate's reusable-facts confirmation fingerprint; a template or project-availability change does not invalidate the candidate's Reviewed status. Capture at least project/client display values; selected output; audience scope; role/slot requirements/order; included assignments and positions; resolved ten-field strings; actual selected frame/media references and crops/order; logo and placement; template version; generated metadata; and an asset manifest.

The app viewer and PDF renderer consume the same captured content contract. Their frame arrangement differs intentionally, but names, facts, slots, position, inclusion, notes, and logo selection must match. Use actual rendered snapshots for visual regression; do not compare only generated JSON.

Ready requires that assets and PDF exist, manifest checks pass, and the final file can be opened. Verify page count, page dimensions, fonts/text rendering, image orientation, external video links, overflow, and reproducible slide order. The production renderer must generate selectable/searchable text where the chosen PDF stack supports it; the raster PDF in the old prototype is not the quality target.

The canonical internal PDF uses authenticated stable version-media URLs. Guest delivery prepares a review-link-scoped PDF export of the same frozen slide content; only its access URLs vary. A separate hashed media grant binds each external preview to the original version/media and its parent review link, enabling fresh-browser playback without an internal login while that parent viewing access is valid. Cache by version + review link + template; do not run AI again. The download UI shows Preparing PDF until this variant is ready. A bare short-lived storage URL embedded into a long-lived PDF is not accepted. A general latest-version review link must not cause old PDF previews to play replacement material. Expiry, revocation, or rotation invalidates playback; disabling new downloads alone does not. Intentional expiry extension updates non-revoked grants, including those whose prior time naturally elapsed; separately revoked grants remain revoked.

## 11. Visual quality checklist

Validate all three page types at the actual output size and in a mobile guest viewport. Inspect real rendered pages for:

- Repeated candidate across different roles, distinct slot labels and positions.
- All ten fields visible when every field has a value and when most are missing.
- Three/two/one/zero frames with no duplication or hidden subject.
- Long names, long role names, mixed-script source names transliterated only from supplied/accepted spelling, and lengthy experience.
- Cover-only and every-slide logos, transparency, extreme aspect ratios, and failed replacement retaining the old valid asset.
- Pending slides with long requirements and no invented headcount/availability.
- No internal notes or processing metadata in external viewer/PDF.
- App carousel versus PDF all-frame arrangement.
- Historical version stability after editing profile facts, frames, logo, role requirements, or display wording.

An attractive sample screenshot does not satisfy these tests. Keep the fixtures and rendered evidence alongside the implementation, with the chosen template version and fonts recorded.
