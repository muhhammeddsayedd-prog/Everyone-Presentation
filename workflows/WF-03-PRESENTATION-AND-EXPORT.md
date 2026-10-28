# WF-03 — Presentation generation and external PDF variants

**Milestones:** M05 fixed versions/internal PDF; M06 link-scoped guest PDF. **Job kinds:** `presentation_render`, `presentation_export`. **Business rules:** BR-015–029, BR-031, BR-035–036 and the PDF amendment in CONTRACT_BASELINE.md.

## A. Capture the fixed presentation version

`generate_version` validates the requested audience-scoped series, expected workspace version/draft revision plus `expected_input_fingerprint` from review, media access and actual text fit. Missing facts, fewer than three frames, zero Main and empty slots are allowed. Overflow is surfaced for wording correction; generation must never silently clip facts or add an unapproved continuation page.

In a short transaction, re-read the render-relevant canonical/project/library data consistently and compare the review fingerprint; stale inputs require refreshed review without a human-only gate. Then allocate a monotonic version number and snapshot all selected facts, requirements, media IDs and immutable checksum inventory, template content hash, branding, template version, presentation wording, output type, audience snapshot and page order. Queue `presentation_render` through the outbox. No provider call occurs in that transaction. All later rendering uses this snapshot, never a live Library query.

### Fixed page rules

- Cover uses captured project/client names and captured logo/template.
- Selection contains every active assignment; Shortlist contains only explicitly included assignments.
- One candidate page per included assignment, repeated for the same person in every relevant slot.
- Empty slot for the chosen output gets one Pending page showing its role/slot requirements.
- All ten agreed fields are visible; missing renders `Not provided`.
- App view is a carousel; PDF arranges up to three selected actual frames together on that one page.
- Internal notes never enter the external projection. Presentation notes are explicit printable content, separate from internal notes.

## B. Render canonical version artifacts

| Stage key | Task | Durable result |
| --- | --- | --- |
| `prepare_presentation` | Validate frozen manifest/schema/asset ownership; load pinned font/template/media artifacts | Render bundle with immutable content hashes |
| `render_presentation` | Native worker renders HTML/CSS preview and PDF using Playwright with pinned viewport/page size/fonts | Canonical PDF, optional preview images, renderer metadata |
| `validate_presentation` | Check page count, dimensions, expected text, no overflow, actual frame placement, logo and PDF links | Validation receipt + checksums |
| `publish_presentation` | Application commits ready metadata and advances latest-ready pointer monotonically | Ready version and latest-ready series pointer |

Canonical internal PDF media links use authenticated fixed-version routes. They cannot embed a review-link token that does not yet exist. This canonical artifact is retained for internal download. The ready version is immutable and does not contain a raw external bearer secret.

Use the same template source for app preview and PDF while explicitly implementing their different frame presentation. Print styles, loaded fonts, image fitting and PDF page dimensions must be deterministic. Visual QA checks the actual rendered PDF, not only DOM screenshots. A malformed PDF or missing font prevents ready publication and leaves the previous ready version active.

Out-of-order completion: if v3 publishes before v2, v2 may become a valid historical ready version but cannot replace v3 as latest. A new render failure does not alter the last successful review content.

## C. Prepare a guest PDF export

A shared PDF needs stable playable video links for the original version without exposing internal authentication or embedding the general latest-version bearer token. Prepare a **link-scoped PDF export variant**:

1. `guest_prepare_pdf_export` derives the current review link from the guest session; internal `prepare_pdf_export` accepts an explicitly managed review link. Both validate live link, enabled PDF downloads, same series and ready fixed version.
2. Reuse an authorized ready `presentation_exports` record for version + link + template + export revision when its grant remains valid. Otherwise queue `presentation_export`. Return the export/job identifiers immediately; UI shows Preparing PDF and polls.
3. Worker claims `render_export`, reads the exact fixed version and creates the PDF variant. No transcription, extraction or cast selection is rerun.
4. The active renderer calls service-only `mint_review_media_grant`, presenting export/job/attempt/lease identifiers. Server creates a random bearer grant, stores only its verifier, and returns the raw token once to the renderer’s memory. It is bound to export, fixed version and parent link. A repeated issuance for an unpublished attempt revokes the superseded grant.
5. Render media links as `/m/:grantToken/versions/:versionId/media/:assetId`. Every referenced asset must belong to that fixed version. The private PDF contains the token; job payloads, manifests, logs and outbox events do not.
6. Validate/upload PDF to a private object, then publish the export as ready through its active lease. The output references the export/PDF/grant IDs only. On failure revoke that attempt’s grant; retry issues a fresh grant and increments export revision as needed.
7. Poll `guest_get_pdf_export`; `guest_download_pdf_export` checks current live link/download flag again before serving the cached PDF. Internal equivalents use authorized link management.

The variant’s content, page order and images are identical to the fixed version; only externally usable playback URLs differ from the canonical internal PDF. Do not overwrite the version’s canonical PDF with one client’s token-bearing copy.

## D. Grant lifecycle

Grant playback checks grant verifier, revoked status, fixed version, referenced asset membership and the parent link’s current viewing permission. It never follows the parent link to the newest version. A v2 PDF always plays v2 media even when the ordinary review link opens v3.

- Parent expiry, revocation or rotation denies playback. Rotation revokes associated prior grants and invalidates their cached export variants.
- Disabling PDF downloads blocks preparing/downloading PDFs, but does **not** revoke video playback in PDFs already downloaded while parent viewing access remains active.
- Extending/shortening parent link expiry propagates expiry to its non-revoked grants, including naturally expired ones. It never clears `revoked_at`. Existing PDF links therefore follow the explicitly updated viewing grant without rerendering.
- Already downloaded PDF/image/video bytes cannot be recalled. Signed media URLs have a documented short validity bound; a proxy/range path is required if each future byte request must be re-authorized immediately.

The `/m/` landing page exchanges/uses the media grant with `play_review_media` and reveals only permitted playback, not Cast Library data or all presentation feedback. Apply token redaction and no-referrer policy there as on review pages.

## E. Acceptance evidence

Validate exact field visibility, fewer frames, one-page candidate fit, repeated candidates, Pending slides, logos cover/every-slide, English text, PDF pagination, fixed manifest reuse and visual fidelity. Test late v2 completion after v3, invalid media, missing font, renderer crash, duplicate completion and cancellation.

For guest export, test a fresh browser without an internal session, video click from downloaded PDF, v3 generation after v2 PDF, two links to the same series with different expiries/download flags, expiry extension, expiry/revoke/rotation, disabled downloads with still-valid old PDF playback, cached ready reuse and failed-attempt grant revocation. No raw token may appear in execution logs or job/outbox rows.
