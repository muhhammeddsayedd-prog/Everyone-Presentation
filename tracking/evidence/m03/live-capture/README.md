# Actual M03 capture checkpoint

These are read-only canonical metadata observations. `result: captured` means the
observer captured the state; it does not mean the candidate pipeline succeeded.
No names, filenames, supplied facts, transcripts, provider bodies or credentials
are included. Protected M02 job/spec/note checks stayed true.

| App job | Retained terminal observation | Outcome |
|---|---|---|
| `3a535387-bc1a-4e31-9bb4-34369d758238` | [First capture](2026-10-29T11-01-07-492677+00-00-8b2e0587.json) | First prepare attempt failed; original remained unverified. |
| `2c5d4582-44e1-4fe2-b49b-d574cf872680` | [Second terminal capture](2026-10-29T11-15-15-946342+00-00-ff3f1a88.json) | Prepared original became Ready; transcription stage failed. The original capture's narrow error allowlist records `UNRECOGNIZED`. |
| `237d0b59-4763-4229-ba32-f04fe2f29c79` | [Third terminal capture](2026-10-29T11-23-50-364628+00-00-adda9f4c.json), [fixed-job diagnosis](../third-job-diagnostic/2026-10-29T11-31-30-898694+00-00-af467f9d.json) | Prepare lease expired/recovered, then preparation completed. Transcription failed with allowlisted `PROCESSING_FAILED`. One transcription audio READ grant was minted; no transcript derivative or transcription payload was committed. |
| `55415ff2-e049-468f-a0a1-7240fba350b0` | [Fourth app capture](2026-10-29T11-44-13-156066+00-00-8b24096b.json), [derived metadata summary](first-success-metadata-summary.json) | All five stages succeeded on one attempt each; five matching outbox deliveries, private transcript, candidate/media and frame references committed. |

The fourth job was observed at **11:44:19.313843 UTC**. Its original is Ready with
the frozen checksum and 19,800ms duration. Twelve registered frames are Ready and
three are selected; their source/job/checksum references and timestamps validate
in the canonical records. The private Arabic transcript is retained, with four
populated and seven unknown extraction fields and four source-grounded evidence
locators. The candidate remains Unreviewed, age-as-of remains unknown and no
processing-issue codes were recorded. These checks establish reference integrity,
not visual frame quality or factual semantic accuracy.

Extraction metadata records `gpt-6.1-sol`, 841 input and 808 output tokens (1,649
total). Transcription records `gpt-transcribe`; null token fields in this fixed
capture do not imply no usage. Root separately attested 20 usage seconds from the
private committed app-job metadata. This is separate from the direct service
probe and does not establish complete project billing.

Two pre-provider handoff defects were fixed: the
[worker asset adapter](../../../../apps/worker/src/candidate-assets.ts) now permits
an unverified original only for initial preparation while verifying the actual
bytes against the declared hash; the
[stage executor](../../../../apps/worker/src/candidate-stage-executor.ts) projects
prepared chunks' seven metadata fields into the exact four-field asset reference
before calling the byte port. These fixes do not establish the third failure's
cause.

The [connection diagnosis and pool fix](../runtime-connection-diagnosis/README.md)
preserves narrow authority, returns clean committed clients for reuse, destroys
failed/uncertain connections and rechecks finite credential expiry. The
[callback helper](../../../../apps/worker/src/candidate-callback.ts) permits at
most three sends of the same event within its bounded deadline and lease. It does
not replay provider/native/asset operations. Their deterministic tests are
separate from later live recovery evidence.

The [local prior-audio seam proof](../prior-audio-seam/2026-10-29T11-34-59-068Z-1d06251b.json)
exercised real SQL grant output, the central mapper, the real worker byte adapter
and the transcription adapter with synthetic bytes/transport, then rolled back.
The [single authorized real transcription probe](../transcription-diagnostic/2026-10-29T11-38-08-973Z-1e992dda.json)
used the same cached authorized audio and configured model through
`transcribeAudio`: one segment, Arabic script preserved, 2,731ms, provider usage
20 seconds. Its normalized transcript remains only in ignored private output.
The probe performed no database, job, lease, n8n or worker mutation and does not
count as app acceptance.

The third failure's exact cause and whether its original attempt invoked OpenAI
remain unknown. A minted audio grant does not prove a Storage GET or provider
request. Current mapper/service probes succeeding cannot retrospectively prove
the failed attempt's behavior. The fourth app job now supplies the successful
canonical pipeline evidence above. Actual app frame/playback checks, semantic
accuracy and English/mixed-source coverage remain separate acceptance evidence
for the integration owner. Earlier failures remain retained.
