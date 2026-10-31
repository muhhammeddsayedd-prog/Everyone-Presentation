# English transcript projection (v1)

Owner instruction on2026-10-31: scan/transcribe videos regardless of spoken
language and show English only. No app language selector in v1. Further manual
English/mixed-language answer-key collection is not required by the owner. The
prior owner-grounded Arabic name/age confirmation and all accepted evidence stay.
No new semantic-accuracy claim follows from this scope clarification.

## Shared API contract

CandidateMedia adds optional backward-compatible fields:
- `english_transcript: string | null`
- `english_transcript_status: available | not_provided | unavailable | not_captured`

The presentation `VersionTranscriptCompanion` adds an optional group:
- `english_text: string | null`
- `english_status: available | not_provided | unavailable | not_captured`
- `english_sha256: string | null` (SHA256 of captured English text when available)

Missing complete English groups in older API/fixtures mean not_captured. Partial
groups are invalid. New DB projections always emit the complete group. Available
requires nonempty English text; other states have null text/hash. Legacy raw
`original_transcript` / `original_text` fields retain their existing restricted
API meaning for compatibility/provenance and are NEVER a display fallback.

Frontend renders the new English text when available. Otherwise show an English
absence/failure message. This applies to candidate detail, internal review and
saved/guest video transcript companions. Do not add a language selector. Old
Ready versions without an English capture show not_captured; never read current
library text as a substitute for their immutable source snapshot.

## Processing and persistence

Automatic original-language transcription remains private/unchanged. Existing
extract_candidate stage normalizes English using the existing extraction-model
Responses adapter; factual extraction/evidence still uses original segments.
Five stages and n8n routing remain unchanged. New frozen config optional
`english_transcript_version: 1.0` enables candidate-extraction-stage.v2. Missing
legacy flags retain v1 outcomes. Config starts NULL; activation follows coherent
DB/worker/SDK/frontend readiness. New stage payload keeps existing fields plus
`english_transcript:{status,text,source_sha256,metadata,failure_code}`. Status is
available/not_provided/unavailable; source_sha256 hashes exact raw original_text;
metadata is0..64 actual per-chunk MediaProviderMetadata records, task
transcript_english, prompt transcript-english.v1. No guessed aggregate IDs/usage.

Additive34 preserves raw sources/facts/Reviewed state/old Ready snapshots/PDFs.
Future-only immutable English companion capture uses a version cohort marker and
source bindings. Translation failure is explicit; no raw-language fallback.

## Parallel work

Codex owns integrations/worker/domain/central/contracts/SQL/tests and release.
Claude Code owns frontend/UI/UX in the separate frontend/redesign worktree.
This contract note is coordination data, not proof of frontend acknowledgment,
implementation or deployment. Merge/reconcile the backend contract changes before
testing the redesigned transcript views. Current pilot remains running.

### Compatible main patch (2026-10-31)

Claude acknowledged this contract and committed the frontend projection in
`frontend/redesign@8aed642`. Main checkpoint `c6a3f15` adapts only that display
slice; the full redesign remains in its separate worktree. Reconcile component
hunks when merging rather than replacing either complete file.

| Display | Shared fields | Main shared files |
| --- | --- | --- |
| Library introduction | `english_transcript`, `english_transcript_status` | `CandidateDetailView.tsx`, `english-transcript.tsx` |
| Draft review source | Same CandidateMedia pair | `WorkspaceReviewView.tsx`, `english-transcript.tsx` |
| Saved internal, guest and PDF-video playback | Frozen `english_text`, `english_status`, `english_sha256` | `SourceTranscript.tsx`, called by `PresentationVersionView.tsx`, `GuestReviewView.tsx`, `GrantMediaView.tsx` |
| Processing failure | `ENGLISH_TRANSCRIPT_UNAVAILABLE` | `CandidateProcessingIssues.tsx` |

The helper uses the shared domain validators. The Central adapter verifies the
captured English hash on all three saved playback paths; existing version,
video, access and refresh-denial checks stay in place. Candidate and saved
playback language metadata is labelled in English; unknown values use
`Other spoken language`. No transcript, fact or snapshot is rewritten by display.

The retained source-name investigation found that original ASR already omitted
a token from the corrected Reviewed name. Verify source-faithful translation
separately from Reviewed-fact preservation. Do not inject corrected profile facts
into translation or require a faithful translation of erroneous ASR to equal the
corrected profile. The discarded historical English wording cannot be recovered,
so its failed component receipt remains unaccepted. See
`development/m03/english-name-review/README.md` for the bounded evidence.

## Historical local verification checkpoint

Before hosted rollout, owned SQL proof on2026-10-31 passed the actual additive34 validator, future capture, legacy replay and immutable read tests after real30-33 clone upgrades. The34 transaction fully rolled back; original29/global roles and cleanup were verified. Canonical was33 and the English flag was off at that checkpoint. Application881 gates passed. One real normalization request passed English/source/provider/age checks but not the full-name literal comparison, so that historical component receipt remains unaccepted; no broad accuracy claim. The hosted work below is separate evidence.

## Hosted pilot checkpoint — internal app and saved playback

The compatible main UI/SDK is deployed as
`dpl_5vEMBfsnD23cGL3ontWm8AUAErKr` on the existing pilot, with 280 sparse source
files and source SHA
`2d4894b8cde36757cf7ba8bb3518771b494ea189b528de37315613ce3e3e3501`.
Its [Ready/alias readback](../../tracking/evidence/m03/english-web-release34/2026-10-31T16-55-43-885447Z-ready.json)
preceded migration34. The compatible worker
`dpl_2uASsbYobSDwWjMptPjGLcVEdCg3` was separately
[Ready/alive with one 2GiB dub1 instance](../../tracking/evidence/m03/english-worker-release34/2026-10-31T17-49-47-805229Z-ready.json)
while canonical remained 33 and English was disabled.

The additive migration then passed
[apply](../../tracking/evidence/m03/english-release34/2026-10-31T17-52-15-603960Z-apply.json)
and [independent readback](../../tracking/evidence/m03/english-release34/2026-10-31T17-52-41-635035Z-readback.json).
The separate [enable readback](../../tracking/evidence/m03/english-release34/2026-10-31T17-54-57-429822Z-enable-readback.json)
observed canonical 34 with the English opt-in flag 1.0. These receipts preserve the
distinction between deployment, additive migration and activation.

The controlled flagged scan `3cf25d3b-c1ec-4347-af3b-fa48f3f0f5e7` succeeded.
The internal candidate UI displayed 248 English UTF8 bytes. A newly generated
Ready version `4f1b81a1-adb7-425b-8223-458d8bd82c28` in series
`93fb7425-7311-4b69-94cb-61588724c153` captured its frozen English companion.
The [24-check version observer](../../tracking/evidence/m03/english-version34/2026-10-31T18-17-52-411860Z-f022da9a-3e56-45a2-a734-387e7e110c50-capture.json)
passed; its expected SHA is
`0e81d416e19b6600930cd171083595f6a7604f1cc755654f75732c60f561cecd`.
Root's actual internal saved-player DOM proof matched that SHA, byte length and
`lang=en`; the original video played with no media error before being paused.
[Live display notes](../../development/m03/english-version34/LIVE_DISPLAY_NOTES.md)
record the exact successful invocation and retain the initial false capture as
a verification-invocation error.

This checkpoint demonstrates internal app and frozen saved-player English
display. Guest playback/display is still a separate live check here. The version
observer does not itself grant old-cohort preservation, PDF byte validity,
semantic translation accuracy or full M07 acceptance. Those keep their separate
receipts and acceptance boundaries. The pilot stays running; accepted Claude
connection results carry forward, screen-reader acceptance stays pending and
mobile testing stays skipped.

## Pilot release order

The recorded rollout followed the required compatibility order: replace the old
Ccw strict DTO web/SDK before applying34, deploy the compatible worker while
English is disabled, then apply/read back34 and enable the flag separately. The
five-stage n8n flow and existing permissions stay. A tagged real scan and new
frozen internal companion are now demonstrated; finish the separate guest flow
before crediting the whole hosted journey. The historical component call and
local SQL rollback are not substitutes for that live evidence.

Disabling the flag stops new opt-ins; already frozen tagged jobs still need the
compatible worker until drained. Keep the compatible SDK after34 is installed.
Use forward fixes for additive schema issues; never drop the English columns or
rewrite/backfill old Ready content as a rollback. Original source and prior facts/
Reviewed state remain independent of the English display projection.
