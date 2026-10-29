# Chosen-timestamp frame extraction

Development design for migration18; no cloud change or activation is implied.

The published `extract_candidate_frames` request stays `{source_asset_id,
timestamps_ms}` with1–10 unique integer milliseconds. The server validates the
selected introduction/source pairing and freezes its current media row version,
source SHA/size/MIME/duration, sorted requested timestamps and reviewed native
image ID. The202 response is JobAccepted, with resource_id equal to the media ID.

`frame_extract` has two stages: `extract_frames` (`native.extract_frames`) and
`apply_frames` (`domain.apply_frames`). The same durable outbox, n8n work-order,
leased callback and11 narrow runtime entrypoints carry these stages. No model or
provider is involved. New private requests/configuration are forced-RLS; full
bounded stage results use existing private candidate_stage_payloads. Public jobs
retain stage-output IDs and final IDs/counts only.

Current active `cast.read`+`cast.upload` grants authorize extraction globally.
The source origin workspace is lineage, not a new membership requirement. The
requester alone can read this frame job under current cast.read; retry/cancel
also retain operations.retry. Execution and retry require current cast.upload.
No ordinary project-job permission is broadened.

Commit locks candidate→media→job, rechecks source/media/candidate state and the
frozen media row version, then appends at most10 newly registered Ready frames.
The total available-frame bound is100. Existing assets/associations/selected
frame IDs, project pins, candidate facts and Reviewed state are untouched.
Changed source/media/access produces waiting_for_input, not an overwrite. Empty
or partial actual-frame results carry explicit unavailable timestamps/warnings.
Choosing replacements still uses the existing explicit frame-selection operation.

The native implementation preserves coded video metadata but calculates JPEG
dimensions from sample/display aspect ratio and decoder autorotation. Output is
square-pixel, longest side≤1280, with only final integer pixel rounding. Each
chosen timestamp decodes its first actual frame at/after that time, preserving
showinfo PTS. Nearby requests can share a physical frame; that frame is stored
once with an explicit requested→actual mapping. The image protocol remains
video-preparation.v1; a new immutable image hash identifies the corrected code.

Source references:

- [FFmpeg aspect-ratio explanation](https://www.ffmpeg.org/faq.html#I-have-a-stretched-video_002c-why-does-scaling-not-fix-it_003f)
- [FFmpeg select/showinfo/scale filters](https://www.ffmpeg.org/ffmpeg-filters.html)

Activation remains separate: disabled DB frame configuration plus
EPS_FRAME_EXTRACTION_ENABLED=false and a separate EPS_FRAME_IMAGE_ID. Root owns
protected environment projection, migration composition/release, n8n publication
and guarded enablement after native/SQL/API proofs. Old image59b and all existing
immutable derivative/pin IDs remain preserved. Updating the candidate-scan image
for future derivatives requires its own reviewed queue-drain/pin update; merely
building this image does not activate it.
