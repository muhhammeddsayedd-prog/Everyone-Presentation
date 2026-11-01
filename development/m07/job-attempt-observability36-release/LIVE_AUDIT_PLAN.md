# Future live AT-074 audit through ordinary app uploads

This is a source-only plan. No upload, app/API/database/provider request or native
decode was performed for this plan. The existing Arabic factual acceptance and
English-only product decision stay unchanged; no labels or language selector.
Root owns actual operations after canonical36 is applied/read back, its capture
trigger is enabled, and the worker is healthy. Canonical35 is the last applied
state at this document's preparation; no hosted36 acceptance is implied.

## Scope and targeting

Use the existing Dummy Pilot Test workspace:

- Project: `6da14b82-8458-451f-aa21-28cb6c85bdc5`.
- Workspace: `86936940-b48d-497d-b1ff-8e0da0913afa`.
- Existing Reviewed candidate: `25a3c924-7b6c-48e3-88ce-c72e72b99c6d`.
- App route: `/projects/6da14b82-8458-451f-aa21-28cb6c85bdc5/casting/86936940-b48d-497d-b1ff-8e0da0913afa/cast`.

Capture the existing Reviewed candidate, legacy media/frames and Ready-version
preservation baseline before creating jobs. For the successful audit, append
the known permitted introduction to this existing person. Do not assert that
an unrelated or unidentified unreviewed profile is the same person. For the
intentional unreadable synthetic source, use the top-level untargeted uploader;
it depicts no person, and candidate creation happens only at final apply.

## Ensure these are new jobs after36

Use a fresh ordinary tab/upload queue, or confirm all old queue intents are
settled before selecting the files. A matching paused queue row resumes its
existing reservation/completion keys. Completed-intent replay returns its old
job and does not provide a new post36 trace.

A fresh selection generates fresh reserve/complete keys; the reservation creates
new asset/upload UUIDs. Scheduling deduplicates by upload intent ID, not content
SHA. Reusing the permitted bytes is therefore compatible with creating one new
job. Confirm actual new upload/asset/job IDs and post36 claim timestamps; a
Succeeded badge alone cannot establish this.

## Successful real introduction

1. Expand **Add a new introduction for this person** on the existing Reviewed
   candidate's project card.
2. Select the permitted `IMG_2850.MP4` from `C:\Users\iway\Downloads\Videos`,
   expected4,316,429bytes. Confirm its existing permitted-source identity in the
   actual operator admission; this plan does not fetch the video.
3. Click Upload once, follow **View processing**, and record its new job ID.
4. Observe actual native/OpenAI/n8n completion. Read the durable attempt metadata
   through the bounded operator path: stage, total/stage attempt, exact actual
   workflow reference, accepted event sequence/type/time and terminal state.
   Do not infer five exact attempts if actual retries occurred.
5. Verify the new introduction exists and English display is available, while
   Reviewed facts/row version, prior source media/frames and old Ready versions
   remain unchanged. Keep current project choices pinned; do not edit facts,
   confirm Reviewed again, select new frames/media, or generate another version
   merely to perform this job audit.

The existing-target apply branch locks/checks the candidate's captured row
version and appends new media; it never updates supplied facts/Reviewed state.
Existing workspace participation keeps selected media, frames, availability and
notes. The workspace draft revision intentionally advances. Concurrent factual
edits may cause `INPUT_CHANGED`; record that actual outcome rather than weakening
the row-version check or treating it as a passed job.

## Intentional failed job

1. Use the top-level **Add introduction videos** uploader with no candidate target.
2. Select `.local/m07-attempt36-live-audit/AT074-intentionally-unreadable.mp4`,
   the prepared67-byte synthetic source. Upload once and follow its new job ID.
3. Expected source path: extension/MIME and positive-size checks accept the file;
   completion checks private Storage size/type and schedules processing without
   decoding bytes. The `ftyp` marker passes the native signature check; ffprobe
   should fail while preparing the video.
4. Confirm the actual failed `prepare_candidate` job, typed `SOURCE_UNREADABLE`,
   `retryable=false`, exact new trace/reference and accepted failed event. The
   producer UI uses **The supplied source could not be read.** No retry is
   expected for that state, and no candidate is created before final apply.

This failure is predicted from source, not demonstrated by the plan. Actual
Storage/ingress rejection would provide no claimed failed-job trace and cannot
close this audit. A valid no-audio fixture ordinarily succeeds with an explicit
`NO_AUDIO`/manual-information outcome; it can diagnose ingestion/native behavior
if needed, but cannot substitute a failed-job trace or real spoken OpenAI result.
Do not inject callbacks, alter workflows/retention, or retry historical jobs.

## Exact source anchors and verification boundary

- `apps/web/components/WorkspaceView.tsx:18,88`: Candidates is the `cast` route.
- `apps/web/components/WorkspaceCandidatesView.tsx:40,60`: untargeted uploader
  versus existing-person append path; current project choices remain explicit.
- `apps/web/components/CandidateResumableUploads.tsx:16,19–24`: paused-row reuse,
  fresh keys, browser checksum, reservation/TUS/completion and new job link.
- `apps/web/lib/candidate-transfer-intent.ts:6–15`: bounded tab recovery and
  exact file metadata matching; no transport credentials or bytes retained.
- `packages/central/src/candidate-storage.ts:104–122`: matching completion details,
  Storage metadata confirmation, no web decode and typed queued job response.
- `supabase/migrations/20261029100500_m03_candidate_pipeline.sql:176–196,449–476`:
  new reservation IDs, per-intent job identity and completed-intent replay.
- The same migration, lines604–640: target row-version lock/facts preserved, new media,
  existing participation choices pinned and intentional draft revision advance.
  English34 modifies extraction/companion projection, preserving these semantics.
- `apps/worker/src/video-native.ts:13–21,75–78`: signature and native ffprobe.
- `apps/worker/src/candidate-stage-executor.ts:247–252`: source decode errors map
  to safe terminal `SOURCE_UNREADABLE` before later provider stages.
- `apps/web/components/processing-view.ts:20,28–29`: fixed producer error wording.

Source checks run with the repository's normal test runner:

```powershell
node tools/run-tests.mjs packages/central/test/candidate-storage.test.ts tests/server/candidate-upload-recovery.test.ts tests/worker/candidate-stage-executor.test.ts
```

All32 tests passed,0skips. These use fake SDK/storage/gateway/provider ports;
they prove deterministic contract behavior, not actual upload, decode, OpenAI,
n8n execution access, current producer UI, or hosted AT-074 completion. The live
successful/failed audit and old-data preservation require their own actual IDs,
observations and receipts. Existing Claude connection acceptance stays passed;
screen reader remains pending, mobile skipped and pilot running until owner stop.
