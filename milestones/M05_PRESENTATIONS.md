# M05 — Branded presentation versions, viewer and PDF

**Dependencies:** M04 reviewed casting data; M03 persistent media/worker; M01 branding. **Next:** M06. **Runnable slice:** a real saved Selection or Shortlist viewer and PDF generated from a fixed, validated snapshot.

## Required context

Read baseline/progress/handoff; PRD; technical architecture; presentation template and page contracts; data schema/transactions/access including series/versions/exports; API/OpenAPI and API-to-DB mapping; presentation-manifest JSON schema; PDF workflow; TEST_STRATEGY and RELEASE_EVIDENCE; fixture expected slide order/count. Locate actual design/font/logo assets and record substitutions rather than claiming fidelity.

## Product context

BR-015–BR-026, BR-029, BR-031, BR-036. Selection includes all active assignments; Shortlist explicitly included assignments. One candidate page per included assignment with role/slot/position and all ten fields: name/ID; age/range; height/measurements; languages/accents; skills/experience; city; previous projects/roles; classification; current project availability; presentation notes. Missing = Not provided. Repeated candidate in different slots means repeated pages. No candidates for selected output in a slot means Pending page with its requirements. A no-role workspace uses the same Pending layout with workspace-level requirements-pending context.

App carousel, PDF all available selected frames on the same page; up to three actual frames, fewer allowed. Preserve image aspect/transparency and approved design. Logo cover by default, every-slide optional. Long wording is edited during final review; no silent clipping, missing fields, artificial tiny text or extra candidate pages. Browser and PDF render the same content snapshot.

Working draft is mutable; ready versions and their content are immutable. A series groups workspace/output/audience policy. Guest link routing later follows newest ready within same series. New AI data, library corrections, branding or template changes cannot rewrite an old version.

## Build sequence

1. Use M04's chosen/reused output/audience series and template context. Implement deterministic preflight and manifest builder from a single consistent read of canonical project/client, library facts, project media/availability, requirements, roles/slots, assignments, wording, template and that audience policy. Include exact ordered page list and stable snapshot IDs. No template reads live mutable facts while rendering.
2. Return `input_fingerprint` during review. Require `expected_input_fingerprint` at generation and recompute it during snapshot capture. Include source content hashes/revisions for shared canonical records as well as workspace draft revision. A producer/Claude must refresh if inputs changed since review; don't silently generate unseen new shared data or require a human-only approval.
3. For that already reviewed series/context, allocate version_no transactionally, capture complete immutable manifest, create job/outbox and return 202. Use idempotency to prevent double-click duplicate versions. If output/audience/template changes, select/create correct series and refresh preflight first. Audience policy changes create separate series; no old guest scope widening.
4. Build versioned React/HTML/CSS layouts for cover, candidate and Pending. Use existing Everyone design adapted to required content. Give candidate fields stable measured boxes, graceful 0/1/2/3 frame arrangement and readable fixed typography. Keep original full facts vs selected display wording distinct.
5. Build internal viewer: slide navigation, accessible frame carousel, role/slot navigation, original candidate video playback, saved version selection, pending/generation/failure states. Current draft preview must be labelled; saved version display uses frozen manifest.
6. Implement native worker PDF rendering with pinned template/fonts/Chromium, safe asset retrieval, `document.fonts.ready`/image readiness, print sizing/color and deterministic links. Avoid arbitrary navigation or untrusted HTML. Canonical internal PDF video links use stable authenticated fixed-version media routes; never short-lived storage URLs in the file.
7. Implement canonical PDF lifecycle on `presentation_versions.pdf_asset_id`, integrity checks, page count, checksum, storage metadata and ready transition. Reserve output assets via scoped worker operations and verify upload before finalization. A version becomes ready only once required manifest/viewer/PDF artifacts are valid. The `presentation_exports` table is for M06's link-scoped guest variants and requires a real review link; do not create fake links for internal rendering.
8. Update series latest-ready pointer monotonically. If V3 finishes before V2, pointer stays V3; failed V4 never replaces it. Retry renders the same frozen version input. Editing the draft and generating creates a new version.
9. Build Presentation stage and global presentations index: output/audience selection, generate/progress, ready preview, version history and actual PDF download. Show relevant draft changes since last generation. New material automatically prepares working draft, not a silently published ready version.
10. Prepare guest export interfaces for M06: same content snapshot with a link-scoped access-URL variant. Do not bake future unknown review tokens into the canonical version. M06 supplies parent link/grant authorization without rerunning AI or changing content.

## Data/API work

Implement series creation/list/detail, versions list/generation/detail/download and export status via current contract; worker render/result/asset operations; preview/review fingerprint consistency. Use transaction functions for version allocation, snapshot immutability and monotonic ready pointer. Generated pages reference snapshot IDs, not only live assignments that can later be archived.

Retain source media/template identities used by version and prevent routine cleanup from deleting them. Store PDF checksum/size/page count and output scope. Metadata lifecycle can change from queued/rendering to ready/failed, but captured content cannot be edited under the same version ID.

## Acceptance and visual proof

- Synthetic happy-path Selection is exactly 8 pages and Shortlist exactly 6, in fixture order. Independently calculate page count from assignments/slots rather than asserting a hardcoded generator count.
- Verify one candidate page per assignment, duplicated person per relevant role, missing fields Not provided, empty output slot Pending, Options-only slot not empty, no-role pending fallback.
- For 0/1/2/3 frames, long accepted wording, transparent logo, wide/tall imagery and mixed original names, visually inspect rendered browser and PDF pages. No clipped fields, distorted images, missing font glyphs or extra pages.
- Change shared candidate/client/project between review and generation: input fingerprint conflict requires refresh, even if workspace draft counter did not change. No lost shared updates.
- Generate V1; change profile/media/logo/assignment/wording; generate V2. V1's viewer, PDF, source video and snapshot remain identical; V2 reflects accepted new inputs.
- Deliver V3 before V2; latest-ready stays V3. Fail a new render; prior version still accessible. Duplicate completion and retry do not allocate another version or overwrite artifacts.
- Download an actual PDF and check file validity, exact page count, rendered images/text and functional original-media links for permitted internal user. A Blob-return unit test alone is not UI download proof.
- Unauthorized actor cannot retrieve another project's version or arbitrary media. Browser guest access not yet implemented must remain denied, not implicitly public.

Record actual PDFs/screenshots/manifest comparisons and hashes as evidence in the implementation repo's private test artifacts; do not commit real cast data to public fixtures. The existing prototype PDF renderer is not production verification.

## Handoff and Codex prompt

Update progress with template version, actual renderer/container, migration IDs, manifest/API contracts, tests and demo. M06 receives stable series/version/export primitives and original-media authorization routes.

> Implement M05's deterministic generation from reviewed inputs to frozen viewer and real PDF. Preserve exact inclusion/page/field/design rules, detect stale shared inputs, and prove immutability plus out-of-order render safety. Prepare link-scoped export interfaces for M06 without inventing future guest credentials. Finish with real artifact and download evidence.
