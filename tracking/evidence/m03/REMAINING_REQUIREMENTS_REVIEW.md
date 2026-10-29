# Independent M03 requirements review

Initial review against `milestones/M03_MEDIA_LIBRARY.md`, the authoritative
API/MCP operations, PRD and `docs/integrations/AI_SPECIFICATION.md` was recorded on
2026-10-29 before migration 17 reconciliation and runtime activation. The update
below preserves those initial findings while incorporating later receipts and
root-observed app work. This review itself performs no UI/code/cloud mutation.
The first successful app scan is now recorded below. M03 remains in progress:
one integrated Arabic sample does not close the feature and acceptance gaps.

Four implementation requirements still need work before full M03 verification:

1. **Interrupted transfer recovery and realistic progress.**
   The initial review found File/session/hash/retry state only in React memory,
   with whole-file `arrayBuffer()` and a single signed PUT. Root subsequently
   implemented tab-session intent recovery in `candidate-upload-recovery.ts`
   and `WorkspaceCandidatesView.tsx`: metadata is keyed by actor/workspace,
   stable reservation/completion idempotency keys survive reload, reselection
   requires the same file metadata and SHA, an existing upload gets a fresh
   GET/signed URL on retry, and unmount aborts outstanding transfer requests.
   Signed URLs, headers/credentials and video bytes are not persisted. The four
   recovery unit tests passed; an actual interrupted/reloaded transfer remains
   unverified. This is metadata recovery and whole-transfer retry, not TUS byte
   offset resumption. Byte progress and per-file cancellation remain missing.
   Server jobs are durable after completion; M03 work sequence 2 and acceptance 8
   still require evidence for the transfer boundary as well.
2. **Supporting images/documents.** The published upload purpose includes
   `candidate_support`, but `candidate-storage.ts` admits only
   `purpose:'candidate_video'`, and candidate reservation SQL validates only video
   MIME/size. M03 work sequence 2 explicitly includes allowed supporting files.
   Keep them separate from generated source frames and never treat a support
   photo as evidence for demographic or factual inference.
3. **Editable source-backed role filter suggestions.** `CastLibraryView.tsx`
   exposes adjustable supplied-value filters with unknown handling, but has no
   role context/suggestion flow. `suggest_candidate_filters` is published at
   `/roles/{role_id}/candidate-filters` and absent from the current shared adapter,
   HTTP routing and advertised MCP tools. M03 work sequence 7 and AT-022 require
   this; M04 can later add the slot assignment action without blocking this
   source-backed search step.
4. **Chosen-timestamp replacement frame extraction.** Existing sample-frame
   selection/reordering is implemented, but the published async
   `extract_candidate_frames` operation at
   `/candidate-media/{candidate_media_id}/frames/extract` is not handled or
   advertised. The UI can choose only already sampled frames. Wire a bounded
   scoped extraction job, real derivative bytes, stale/cancel/retry protection,
   API/MCP and timestamp replacement UI before claiming complete frame
   replacement parity.

The following are verification/release work rather than those missing features:

- The initial migration 17 readback comparison was unconfirmed. The subsequent
  [read-only reconciliation](../cloud-candidate-pipeline-reconciliation/2026-10-29T10-49-21-239370Z-2aedbfeb.json)
  passed, preserving the failed apply/comparison receipts. It distinguishes exact
  at-apply business preservation from root-attested later UI changes and proves
  fresh catalog/runtime/configuration parity; no DDL was retried. The fixed
  [DB configuration activation](candidate-activation/2026-10-29T10-51-42-058380Z-f2a5e01b-enable.json)
  then passed with `gpt-transcribe` and `gpt-6.1-sol`, and the separately guarded
  [private flag activation](candidate-activation/2026-10-29T10-53-01-501889Z-bad22a89-local-enable.json)
  passed. Root reports the web app and local worker active. These receipts do
  not claim a successful candidate scan or hosted worker deployment.
- Root used the same manual candidate
  `b7341092-50c4-49b4-ad5f-a0ceedddebf1` in two authorized projects with different
  project availability. The [Dummy Test browser proof](reuse/browser/dummy-test.ax.txt)
  and [Dummy Reuse Test browser proof](reuse/browser/dummy-reuse-test.ax.txt), with
  adjacent PNGs, demonstrate manual shared-profile reuse and separate project
  choices. They do not substitute for scanned Unreviewed reuse/review/media proof.
- The first actual video job, `3a535387-bc1a-4e31-9bb4-34369d758238`, failed in
  `prepare_candidate` before OpenAI. The
  [metadata capture](live-capture/2026-10-29T11-01-07-492677+00-00-8b2e0587.json)
  preserves one failed attempt, `SOURCE_UNREADABLE`, zero provider metadata and
  no transcript/extraction/applied media; that source remains uploading/unverified.
  Root/worker diagnosed a mismatch between the declared SHA and the null SHA of
  the unverified source capability. That handoff was subsequently fixed without
  deleting or retrying this terminal job. The same capture verifies the protected
  M02 checkpoint/manual note remained unchanged.
- The [second terminal capture](live-capture/2026-10-29T11-15-15-946342+00-00-ff3f1a88.json)
  preserves job `2c5d4582-44e1-4fe2-b49b-d574cf872680`: preparation produced a Ready
  source, then transcription failed. The original narrow public error projection
  recorded `UNRECOGNIZED`; it is not rewritten as a successful scan. A subsequent
  worker fix projects prepared-chunk metadata into the exact four-field asset
  reference expected by the byte adapter.
- The [third terminal capture](live-capture/2026-10-29T11-23-50-364628+00-00-adda9f4c.json)
  preserves job `237d0b59-4763-4229-ba32-f04fe2f29c79`: a preparation heartbeat
  became unconfirmed during a connect timeout, its lease expired/recovered, and
  preparation then completed; transcription later failed with `PROCESSING_FAILED`.
  The [fixed-job diagnosis](third-job-diagnostic/2026-10-29T11-31-30-898694+00-00-af467f9d.json)
  shows a minted audio READ grant but no committed transcript/provider payload.
  The exact transcription failure cause and whether that attempt invoked OpenAI
  remain unknown. Neither the later probe nor later app success reconstructs it.
- The independently reviewed [pool resilience change](runtime-connection-diagnosis/README.md)
  returns clients only after acknowledged COMMIT, destroys uncertain/aborted
  clients, verifies finite credential expiry on each transaction and retains a
  client for 30 seconds across the 20-second heartbeat gap. TLS, role authority,
  connection limits and the 3-second connect timeout remain unchanged. The
  callback-only retry seam replays the identical event at most 3 times within one
  shared 15-second/lease budget; it repeats no provider/native/asset computation.
  Reviewed diagnostic projection exposes only fixed safe codes and operation
  names. These fixes and deterministic tests do not prove live endurance or the
  retrospective cause of every earlier failure.
- A [single authorized direct transcription probe](transcription-diagnostic/2026-10-29T11-38-08-973Z-1e992dda.json)
  used the cached authorized audio and configured `gpt-transcribe` model through
  the real adapter. It preserved Arabic in one segment and recorded 20 seconds of
  provider usage. It performed no DB/job/lease/n8n mutation; it is service-path
  evidence, separate from the app submission below.
- The fourth app upload, job `55415ff2-e049-468f-a0a1-7240fba350b0`, is the first
  complete live candidate success. The
  [11:44:13.156066Z canonical capture](live-capture/2026-10-29T11-44-13-156066+00-00-8b24096b.json)
  retains all four jobs: three failed, one succeeded. The successful job committed
  all five stages, a Ready private original, the original Arabic transcript and
  private transcript asset, source-grounded extraction and applied candidate/media.
  Four populated fields have exact grounded evidence; seven fields remain unknown.
  The frozen `gpt-6.1-sol` extraction records 1649 tokens; transcription is bound to
  `gpt-transcribe`, with root reporting 20 seconds ASR usage. The capture records
  12 Ready frame references with hashes/source timestamps and three selected,
  zero processing issues, initial Unreviewed status (`reviewed:false`), null
  `age_as_of`, and the protected M02 checkpoint/manual note unchanged. This is
  canonical metadata proof; fresh app playback/frame-byte verification is still
  being recorded separately, and semantic factual quality has no independent
  answer-key pass yet.
- Complete authorized English and mixed introductions in addition to the current
  Arabic sample. Review transcripts/facts/frames against an independent answer
  key and record correction rates. Then demonstrate
  Unreviewed library reuse from the second project, permitted Reviewed change,
  explicit duplicate choices, cross-project media pin preservation and deliberate
  interrupted-transfer/callback/worker recovery rounds through the app. Existing
  manual reuse, SQL fixtures and one successful scan do not establish all of this.
- The 200-intent SQL scheduling test is control-plane/backpressure proof. It does
  not measure 200-video throughput, provider cost or end-to-end latency. M07 owns
  the separate real-file cost/latency and external Claude OAuth release proof.
- The app/native target remains 256MiB while this project's observed effective
  global Storage limit is 50MiB. New admission/session/UI enforcement is now
  environment-configured; actual browser/API rejection should be verified after
  the configured relaunch. This does not lower the retained product target.

Automatic technical frame selection may be entirely deterministic for the first
implementation when quality is adequate: the AI specification explicitly permits
it at line 25. Current exposure/detail/hash heuristics are therefore allowed;
their quality must still be reviewed against actual source frames. Optional
vision is not a new prerequisite. Also, numeric range query parameters are not
an extra invented requirement: the current published age/range and measurement
filter inputs are strings.

Future M04 assignment/Shortlist behavior and saved presentation versions remain
separate boundaries. The current candidate/media/pool services and no-delete
guards preserve those integration points without claiming M04 has been built.

## Non-square-pixel source geometry requires quality follow-up

Actual original-video browser metadata reported display853x480, while the native probe/registered JPEGs are800x480. Source inspection shows sample/display aspect ratio is discarded by parseVideoProbe and frame scaling uses coded iw/ih followed by setsar=1. This is a concrete geometry-risk observation, not an independently measured original SAR or a frame-quality pass. Verify source SAR and normalize display geometry for future derivatives before M03 quality acceptance; preserve all existing immutable frames and pin history. No image pin or old media was changed for this finding.
