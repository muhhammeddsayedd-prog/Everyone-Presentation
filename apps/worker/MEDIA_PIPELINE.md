# Candidate media worker

M03 reuses the authenticated database job/outbox worker and adds five n8n-routed
stages: `prepare_candidate`, `transcribe_candidate`, `extract_candidate`,
`select_frames`, `apply_candidate`. Native decoding stays on the local worker;
n8n receives only IDs, fingerprints and execution metadata. Hosting is deferred.

`candidate-stage-executor.ts` executes one already-claimed, fenced stage and
renews its lease. It sends full results to the private callback. The database
stores those in `candidate_stage_payloads`; public job history contains references
only. It must never store source text, grants or provider payloads in outbox data.
`candidate-assets.ts` uses the narrow gateway's `candidateFiles` port: exact
candidate buckets and object prefixes, scoped grants, no redirects, explicit
MIME/size limits, body SHA verification, immutable uploads, and a readback before
marking a derivative Ready. A later stage may read an earlier producing attempt's
asset within the same authorized job; writing always uses the active attempt.

The runtime is opt-in with `EPS_CANDIDATE_MEDIA_ENABLED=true`. Its scrubbed child
environment needs `EPS_MEDIA_IMAGE_ID`, `OPENAI_TRANSCRIPTION_MODEL`, existing
OpenAI extraction configuration, public Storage configuration, and independent
`N8N_CANDIDATE_DISPATCH_URL` / `N8N_CANDIDATE_DISPATCH_SECRET`. Candidate and specs
webhook secrets must differ. The normal worker never receives the management API
key. Startup checks require the candidate file port; disabled mode does not claim
candidate stages. No direct-provider bypass exists when n8n fails.

Build the source-only native image using `node tools/build-media-container.mjs`.
Only the five named public media source files enter the build context. The official
Node24.18.0 bookworm base is digest-pinned; the observed Debian package is
`ffmpeg=7:5.1.9-0+deb12u1`. Record the returned immutable image ID in the private
runtime configuration. Runtime execution is nonroot, read-only, network-disabled,
with no host bind mounts, a 384MiB temporary filesystem, 2GiB memory including swap,
two CPUs, 64 PIDs, no capabilities, no new privileges and no container logs. A fixed
185-second supervisor bounds native work. The adapter verifies ownership and
resource settings before execution and removal; it never prunes unrelated Docker
objects. No hosted service or public endpoint is created.

The Windows adapter invokes the observed signed Docker Inc executable by its
absolute path, with the fixed local Linux named pipe and project-local empty CLI
configuration. Worker and native children explicitly use an empty `PATH` because
this Windows runtime inherited the parent search path when it was omitted. The
native child receives system/temp fields only, without worker credentials or
ambient Docker configuration.

Input limits are conservative starting bounds, not measured capacity: 256MiB,
30 minutes, 4096 pixels per dimension, 120fps, at most two native containers.
MP4/QuickTime and Matroska/WebM are checked by magic bytes and ffprobe; playlists,
network protocols and arbitrary paths/commands are unsupported. The original is
retained. Audio is mono16kHz MP3 at32kbit/s, at most120 seconds per chunk with two
seconds overlap. Empty/silent chunks do not bill transcription requests. The
original-language transcript retains every returned chunk; the combined display
removes only exact multiword overlap. Evidence timestamps are true chunk bounds,
never invented word alignment.

The versioned candidate prompt accepts only the transcript, rejects source
instructions, distinguishes questions from affirmed answers, preserves negation,
keeps missing values null/empty, and separates project availability. Every
populated fact needs an exact quote and matching source segment/bounds. English
values do not replace original speech. JSON validity and exact evidence resolution
do not independently establish semantic accuracy; real source review remains a
separate acceptance gate. The model is required configuration, with requested and
returned identities recorded when the endpoint supplies them.

Up to12 actual JPEGs are sampled; FFmpeg `showinfo` supplies their source PTS.
Rotation is honored, images retain aspect ratio and are not enlarged. Technical
luminance/detail/difference-hash checks select up to three distinct actual frames;
there is no appearance-based demographic or suitability classifier. Fewer/zero
frames remain explicit. `timestampsMs` permits bounded manual replacements from
the same source; saved times are actual decoded PTS, which can be after a requested
time when the next real frame begins later.

Provider retries belong to durable jobs. A retryable transcription failure first
records failure; only the backend's exhausted-attempt flag allows the final manual
partial result. Nonretryable allowlisted failures may become explicit manual
partial results immediately. Partial results retain real frames and source access
and carry `TRANSCRIPTION_FAILED` / the safe provider code, never full AI success.
Cancellation or stale heartbeats abort without a competing terminal callback.

Offline adapter/schema/lease tests use synthetic injections. The explicit native
proof command is `node --import tsx tools/test-video-container.mjs` with the built
`EPS_MEDIA_IMAGE_ID` in the process environment. Its seven cases cover real decode,
audio, probe-only mode, manual actual timestamps, invalid timestamps, silent/short
source, portrait/no-audio source and corrupt input; receipts are under
`tracking/evidence/m03/media-container/`. Synthetic lavfi footage proves native
behavior only. Authorized personal media, transcripts and frame bytes stay outside
source control. Real English/Arabic/mixed provider and application acceptance are
separate from these tests.

Current API support was checked against the installed OpenAI SDK7.45.1 and the
[official file-transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text),
which recommends `gpt-transcribe` for original-language recorded speech and documents
the25MB endpoint limit. The worker uses smaller compressed chunks. The SDK controls
multipart boundary headers; inherited OpenAI custom headers and organization/project
settings are cleared. Structured extraction uses the existing strict
[Responses schema contract](https://developers.openai.com/api/docs/guides/structured-outputs).
[n8n Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook)
and [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook)
support the authenticated production metadata work-order route. These references
describe APIs; live acceptance depends on the corresponding local/cloud receipts.
