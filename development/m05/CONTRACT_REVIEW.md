# M05 contract review and proposed work split

Source review only. No M05 implementation or cloud change was started. Root
requested that implementation wait for the remaining M04 live acceptance.
Hosting remains deferred.

## Contracts to preserve

- `GenerateVersion` keeps all three guards: expected workspace row version,
  expected draft revision and the full shared-content input fingerprint.
- A short canonical transaction captures the exact reviewed series/output/
  audience/template, allocates the version number and queues its render job.
  Later draft/profile/logo changes must not alter that captured version.
- Private `presentation_versions.snapshot` and the closed published manifest
  are separate representations. The current manifest lacks frozen series
  title, template/font keys and selected frame geometry needed by the renderer.
  Capture those in a separately typed immutable render snapshot and derive the
  published manifest; never fill historical values from live records.
- Allocate persistent slide IDs for cover, each assignment and each Pending
  page. Preserve repeated candidate assignments as different slides.
- Selection fixture8 and Shortlist fixture6 include the cover. A no-role
  workspace still has one Pending page plus the cover.
- Canonical render result requires both `manifest_asset_id` and `pdf_asset_id`.
  Their ready bytes, checksums, sizes, scope and exact page count must be
  verified before publication.
- `presentation_exports` and bearer media grants belong to M06. M05 creates
  no fake review link or token-bearing guest export.

## Suggested independent implementation slices

| Owner | Slice | Boundary and proof |
| --- | --- | --- |
| Database | Immutable capture/version allocation, slide/asset references, scoped render callbacks | One generation transaction; stale shared-input and concurrent allocation tests; content immutable after insertion; duplicate callbacks; v3-before-v2 monotonic pointer |
| Native worker | Frozen bundle preparation, real PDF render/validation, scoped output upload | Four WF03 stages, pinned fonts/template/Chromium, OS-only browser environment, verified private assets, exact pages/labels/images/links and actual downloaded PDF |
| Shared service/API/MCP | Typed versions, generation and canonical download/media operations | Existing published operations with acting-user parity, strict request/result schemas, idempotency and truthful queued/rendering/ready/failed lifecycle |
| Root app/integration | Presentation stage/index, fixed-version viewer, accessible carousel, live acceptance | Snapshot-only values; version switcher; available frames; stable source-video links; actual PDF download and old-version preservation after new input |

The database and shared contracts should agree on the private frozen render
snapshot before the worker/viewer are built. They should publish its type and
fixture first so the latter slices can proceed independently.

## Existing components worth reusing

- M04 `review_snapshot_data` supplies deterministic ordered render-safe values
  from one capture. Generation must recompute and compare its fingerprint in
  the capture transaction, with the real successful fit bound to that same
  fingerprint and registered template.
- The frozen `packages/templates/src/render.ts` source and bundled licensed
  fonts provide the first PDF layout. Preserve its registered1.0.0 source; a
  future layout revision needs a separately retained implementation so old
  viewers cannot silently use changed CSS.
- `apps/worker/src/review-fit.ts` already verifies registered font/brand/source
  hashes and measures actual field overflow. Reuse that validation discipline;
  PDF preparation additionally loads and verifies the real pinned images.
  Geometry placeholders are only for M04 measurement, never final artifacts.
- `nativeBrowserEnvironment` prevents Chromium from inheriting worker provider,
  database and dispatch secrets. Keep arbitrary network navigation blocked.
- Existing claim/event/outbox/asset ports can be extended for the new kind with
  narrow version/attempt scope; no service-role fallback is needed.

## Risks to resolve in the first vertical slice

1. **Post-capture source fencing:** presentation render claims/callbacks must
   validate the immutable snapshot and its pinned assets, not recheck the live
   workspace fingerprint as M04 suggestion jobs do. Draft edits during render
   are permitted. Current requester/project authority still needs checking.
2. **Permanent PDF video URLs:** the pack requires authenticated fixed-version
   media routes. Generic library playback is insufficient for a historical
   version. Add a stable internal landing/playback route whose authorization
   checks version membership and retained asset inventory. Never embed a
   short-lived Storage URL, access JWT or future guest token in the PDF.
3. **Two hashes:** define a versioned canonical manifest-content hash separately
   from the SHA of uploaded artifact bytes. PostgreSQL JSONB text and Node JSON
   serialization have different byte representations; do not conflate them.
4. **Pin lifecycle:** old selected video/frame/logo assets must survive source
   archive/default-media changes and cleanup. Rendering retries use the same
   version inventory, with newly reserved attempt outputs rather than overwriting
   a ready PDF.
5. **Units and visual evidence:**1600×900 is the logical CSS canvas. The PDF
   MediaBox is measured in points; validate the actual conversion, page count,
   transparent logos,0/1/2/3 frames and Arabic/Latin glyphs with real artifacts.
6. **App and PDF frames:** the app uses a keyboard-accessible carousel; the PDF
   shows every selected frame together. Both consume the same frozen inventory
   and wording while explicitly implementing their different frame display.

References: `milestones/M05_PRESENTATIONS.md`,
`docs/data/DATABASE_SCHEMA.md` sections4.12–4.13,
`docs/data/TRANSACTION_FUNCTIONS.md` section6,
`docs/experience/PRESENTATION_TEMPLATE.md`,
`workflows/WF-03-PRESENTATION-AND-EXPORT.md`, OpenAPI `GenerateVersion`,
`PresentationVersion`, `VersionSlide`, and the closed presentation manifest/
canonical render-result JSON schemas.
