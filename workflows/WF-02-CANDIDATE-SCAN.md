# WF-02 — Candidate scanning and real frames

**Milestone:** M03. **Job kinds:** `candidate_scan`, `frame_extract`. **User entry:** `complete_upload` for candidate video; `extract_candidate_frames` for manual timestamps. **Business rules:** BR-007–013, BR-017, BR-023, BR-030, BR-034–036.

## Input and ownership

One candidate per video; spoken introduction/interview supplies personal facts. Input contains a verified private source video asset, optional workspace/candidate context, batch grouping ID and input/configuration hash. The current user must have upload and relevant workspace/library access. A reused candidate media source is not rescanned merely because it is selected for another role.

Each uploaded video has an independent job. Batch aggregate counts derive from those jobs; one corrupt video never fails the entire batch. After processing a new candidate is immediately reusable as Unreviewed. Possible duplicate suggestions do not automatically merge identity or make face comparisons.

## Stage graph

| Stage key | Work | Output |
| --- | --- | --- |
| `probe_media` | Inspect actual container/codec/duration/dimensions/rotation/audio with ffprobe; validate configured limits and safe decode | Probe metadata and readable/unreadable result |
| `prepare_media` | Normalize playable preview if needed; extract/compress audio; sample a technically diverse pool of actual stills | Preview/audio/frame assets and precise source timestamps |
| `transcribe` | Recorded-file transcription with appropriate Arabic/English hints; chunk only as needed | Original-language transcript, chunk offsets, language metadata when supported |
| `extract_candidate` | Extract only supplied facts with evidence; normalize English; separate project availability | `candidate-extraction.schema.json` result |
| `select_frames` | Deduplicate/score sampled actual stills; optional vision quality assessment | Up to three frame asset IDs matching `frame-selection.schema.json` |
| `apply_candidate` | Validate references and persist media/profile/project-pool linkage through domain service | Candidate ID, candidate_media ID, workspace_candidate ID where relevant, Unreviewed status |

`extract_candidate` and `select_frames` run sequentially in the initial implementation because each job has one active stage lease. Different files run concurrently. Parallel stages would require explicit child jobs and a tested dependency join; do not start two stages under one lease. `apply_candidate` waits for terminal usable results. A failed transcript may still produce usable frames and an incomplete manual profile; distinguish a partial usable scan from a corrupt source. Do not report full transcription success for silent video.

## Native media requirements

Preserve the original file. Normalize only derived preview/audio/frame assets. Honor rotation metadata, avoid stretched images, contain full chosen image unless the user explicitly crops a presentation frame, and retain exact source timestamp for every extracted frame. Use a sandboxed worker with fixed FFmpeg argument construction, bounded duration/memory/output size and no shell interpolation from filenames. Do not allow a video filename to become a command.

Sample enough candidate frames to evaluate diversity without sending an entire video as image payloads. Start with evenly spaced or scene-change candidates, remove near-identical frames, score blur/exposure/visible subject, and select up to three available representatives. Tune the sample count against real video duration and cost. Three copies of one near-identical view do not satisfy the intention; return fewer with an explanation.

Manual frame extraction accepts valid timestamps for the exact source asset and returns actual frame assets. Backend rejects out-of-duration values and unrelated asset IDs. The actor then applies an ordered selection through `update_candidate_frames` (library default) or `update_workspace_candidate` (project-specific chosen media). A global library default update does not rewrite the project’s pinned media.

## Duplicate handling and fact application

The new scan creates an Unreviewed candidate, with possible-match badges from supplied name/ID and relevant metadata. The actor chooses Keep new or Link existing. No automatic identity merge is allowed. A link operation preserves existing confirmed facts, attaches the new source media, rewires only live references and resolves candidate+slot uniqueness atomically. Existing fixed version slides continue to describe their original frozen data.

If existing media was deliberately attached to an existing profile, do not silently replace confirmed reusable facts. Provide the transcript and ordinary profile edit. The producer rejected a dedicated conflicting-facts feature. Keep traceable sources without inventing a reconciliation product.

Uploading new material changes the working pool/draft and records a visible change summary. It must not add candidates to Shortlist, promote Main, replace chosen project media, or change ready generated presentations without an explicit corresponding action.

## Idempotency and reuse

Fingerprint every stage by original asset checksum, stage implementation version, prompt/model version where relevant and dependent result hashes. Retry only a failed stage; reuse valid earlier artifacts. Duplicate completion must return the existing candidate/media IDs. A source identical to an existing asset may reuse stored bytes after authorized scope checks, but identical file bytes are not permission to merge a human identity automatically.

## Acceptance cases

English, Arabic and mixed sources; silent video; poor audio; video with two distinct frames; unsupported/corrupt file; rotated portrait video; duplicate name requiring user choice; repeated same upload completion; retry after provider outage; navigation away/reconnect; cancellation with late callback; more than one video in a batch; a 200-file synthetic sizing run with bounded concurrent tasks; and a real authorized representative sample for accuracy/latency measurements.

No biological attributes are inferred from image appearance. No contact information is promoted into slides. No original video disappears when a derived preview is made.
