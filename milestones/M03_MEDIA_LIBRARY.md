# M03 — Candidate videos, reusable Cast Library and real processing

**Dependencies:** M02 jobs/outbox/n8n/worker foundation; M01 storage/auth; M00 canonical cast mapping. **Next:** M04.

## Outcome and required context

A producer can upload several candidate videos, get actual transcripts, supplied facts and up to three actual frames, inspect results and reuse profiles from the shared library across projects. A failed file does not stop successful candidates. No UI simulation is counted as processing.

Read baseline/progress/handoff; data schema/security/transactions and central field map; AI_SPECIFICATION; API contract/operation index; candidate-extraction/frame-selection/job schemas; video workflow; SITEMAP_AND_PAGES; template media rules; TEST_STRATEGY/RELEASE_EVIDENCE; CONFIGURATION and runbook. Inspect synthetic fixture source transcripts, but use authorized real introductions for live evaluation.

## Business context

BR-003, BR-007–BR-013, BR-017, BR-019, BR-023, BR-030–BR-034, BR-036. Initial sources are direct multiple uploads and internal historical library. One video represents one candidate. Spoken self-introduction/interview is the factual source; original transcript preserved and English normalized values shown. Never infer age, gender, ethnicity, identity or suitability from images, or fill candidate information using role requirements.

New scanned candidates are immediately reusable as Unreviewed. Producer/designated casting editor can correct reusable facts and confirm Reviewed, including through Claude's delegated operations. Reviewed is not casting approval. Library search uses supplied age/gender/measurements/languages/skills/city/experience/classification and adjustable specs-based filters. Unknown fields are visibly unknown, not silently positive matches.

Possible duplicates require explicit existing/new selection. No automatic identity merge or face recognition. Existing media is reusable unless fresh project material is required. Media selected for a workspace must not change another project's selection or old generated versions. Up to three clear, distinct representative real frames are chosen; fewer are accepted and replaceable. Zero-frame fallback is an honest acknowledged placeholder, never a generated person.

## Work sequence

1. Implement canonical candidate mapping and app-owned candidates/candidate_media/workspace_candidates/media asset extensions as needed. Store source and full reusable values, review status/reviewer/time, recorded age-as-stated context, and selected project material/availability separately. Do not duplicate canonical shared facts.
2. Extend resumable upload sessions for candidate videos and allowed supporting images/docs. Validate purpose/size/type/content before processing. Track each file independently with stable asset ID; session/file names are not candidate identity. Provide resume/cancel/retry and realistic progress.
3. Implement worker preparation: ffprobe checks, safe audio extraction/chunking to provider-supported limits, thumbnail/sample-frame extraction and source metadata. Use bounded subprocess/resource limits and temporary storage cleanup. Preserve original video bytes/identity and timestamp references.
4. Implement n8n video flow on the shared durable stage framework: preparation → original-language transcription → schema-constrained factual extraction/English normalization → frame quality/distinctness selection → validated commit. Independent useful stages can succeed even when audio/transcription fails. Respect lease/fence and producer edits on commit.
5. Build candidate extraction with null missing values, supplied sources and validation. AI selects technical frame candidates from actual sampled timestamps; deterministic extraction produces saved image assets. No model-generated portraits, demographic guesses or automatic casting ranking.
6. Add new profile immediately after valid scanned data/media commit as Unreviewed. If likely duplicate, expose possible matches and actionable resolution. Match using available supplied metadata; do not silently merge solely because names match. Attach source to explicit existing profile or create new idempotently. Plain normal editing handles differing facts; no conflict-management product.
7. Build Candidates stage and shared Cast Library: grid/list, filter suggestions, adjustable filters, unknown handling, pagination, candidate detail side panel, transcript and source video, three-frame picker/reorder/replacement, reusable fact edits with correct authority, add to workspace and fresh-material option.
8. Implement manual candidate creation/edit without video so missing material does not block casting preparation. Missing fact values remain Not provided; uploading can be done later. Keep clear distinction between manual profile and successful AI scan.
9. Pin chosen project candidate media and save new-upload draft change summary. Existing assignments/Shortlist positions are not silently altered. New media appended to a candidate does not automatically replace historical project selections.
10. Expose retry/cancel/delete-or-archive semantics and async navigation protections. An old upload completion must not attach to a different profile/workspace after navigation/reset. Shared assets referenced elsewhere cannot be physically deleted by removing a workspace candidate.

## Operations and contracts

Implement search/create/get/update/confirm candidate, upload sessions, candidate media and frame updates, duplicate resolution, workspace candidate add/update/remove, job read/retry/cancel, scoped playback and worker stage operations. Exact names/parameters are in OPERATION_INDEX/OpenAPI; map them to shared services immediately. Provide upload-session URLs and bytes-transfer instructions for future Claude use without accepting arbitrary fetch URLs or base64 megabytes in normal MCP calls.

The app API remains source of truth for mutation/authorization; n8n invokes validated operations and never independently decides casting positions. A service credential cannot claim a different job/project simply by supplying another ID. Update DTOs and schemas together if discovery adds needed canonical fields.

## Acceptance

- Actual spoken intro produces preserved transcript and correct supplied fields with sources. A missing height/language stays missing; a requested role age does not become candidate age.
- Test English, Arabic and mixed introductions using permitted real material. Record errors/correction rates and model configuration; synthetic transcripts only prove parsing contracts.
- Each saved frame exists as bytes extracted at documented timestamp from the source video. Frames are distinct when footage permits, selected order persists, aspect ratio preserved.
- Silent/short/corrupt cases: usable available media can continue, fewer/zero frames explicit, individual failure/retry does not block other candidates.
- Scan candidate → visible Unreviewed in library → reuse from second authorized project → confirm facts via permitted actor → Reviewed. Contributor denied review; Claude producer allowed.
- Duplicate matching/resolution idempotent; same name alone cannot force merge; resolve existing and new choices tested.
- Add same person to two workspace roles later without profile duplication. New video does not replace selected media in another project.
- Interrupt upload, reload, resume/retry; close browser during server job; worker restart/duplicate/stale callback does not duplicate profile or overwrite confirmation.
- Search uses supplied fields and unknown controls, pagination and scope; guest cannot search the library or fetch private arbitrary assets.
- Exercise batch scheduling/backpressure with 200 synthetic/authorized inputs for control-plane capacity; real-file cost/latency measured separately at M07. Do not call 200 identical mocked requests proof of video throughput.

## Evidence and handoff

Record actual provider job IDs, workflow exports/config versions, media checksums/timestamps, candidate counts before/after duplicate retries, performance/resource observations, schemas/migrations, API tests and UI demos. Separate live service evidence from deterministic tests. M04 needs a reliable candidate/media API and reusable library; update progress and handoff with defects and next exact operation.

## Codex execution prompt

> Implement M03 from uploads to reusable scanned profiles with real source-grounded information and actual video frames. Reuse the durable pipeline; handle partial failures, duplicate choice and media pinning. Respect shared-fact permissions and full Claude parity. Demonstrate live processing and library reuse with evidence; do not substitute sample data for extraction results.
