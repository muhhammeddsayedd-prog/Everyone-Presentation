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

This dated internal checkpoint demonstrates app and frozen saved-player English
display. The completed guest workflow is recorded separately below. The version
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
frozen internal companion are demonstrated; the guest flow below is also complete
with its explicit normal-browser and annotation-destination boundary. The historical component call and
local SQL rollback are not substitutes for that live evidence.

Disabling the flag stops new opt-ins; already frozen tagged jobs still need the
compatible worker until drained. Keep the compatible SDK after34 is installed.
Use forward fixes for additive schema issues; never drop the English columns or
rewrite/backfill old Ready content as a rollback. Original source and prior facts/
Reviewed state remain independent of the English display projection.

## 2026-11-01 hosted guest English and link lifecycle

The owner-approved create/test/revoke self-test is completed. The [actual guest
workflow receipt](../../tracking/evidence/m03/english-guest34/2026-11-01-guest-english-workflow.json)
binds series93fb7425-7311-4b69-94cb-61588724c153, Ready version
4f1b81a1-adb7-425b-8223-458d8bd82c28 and the same original video asset. Guest
display matched the frozen248-byte SHA0e81d416e19b6600930cd171083595f6a7604f1cc755654f75732c60f561cecd
with one visible `lang=en` region. Video played to14.730222s of21.856009s without
error. The actual guest PDF export was103,513bytes/SHAa766d65c945c493038994b52d910d8baf6500151a541a9d5856c7a5262969546;
all3 rendered pages matched the canonical PDF's rendered images byte-for-byte.
Its actual annotation destination was extracted privately and opened, serving
the same frozen English; that video reached its21.856009s end without error.

Linkcd4eae15-d516-40c0-8166-28492ba82ab9 was created at00:21:09.330763UTC and
revoked through the Producer UI at00:28:40.704357UTC. The exact
[before](../../tracking/evidence/m03/english-guest34/2026-11-01T00-26-26-547394Z-before-link-metadata.json)
and [after](../../tracking/evidence/m03/english-guest34/2026-11-01T00-29-32-767029Z-after-link-metadata.json)
reads matched that link/series/workspace/Ready pointer; the after read observed
revoked rowversion2. Existing guest view and fresh guest/PDF-destination reloads
were denied afterward, with video and English absent. No bearer URL was shared
to others or persisted. The session-row expiry counts are not authorization
counts; revoked-link access was checked in the actual UI.

Browser scope is the connected normal Chrome Person1 signed-in owner profile,
exercising the guest route/grant identity. No fresh-anonymous-browser acceptance
or native PDF-viewer click is claimed; the actual annotation destination was
loaded privately. Prior old-version/Reviewed preservation was carried forward
without a new heavy comparison. No new language labels or selector, semantic
accuracy expansion, screen-reader completion or mobile acceptance is inferred.
The owner Claude/recovery passes remain preserved; screen reader pending, mobile
skipped and pilot running.

Canonical remains34/English1.0 at this checkpoint. Guarded M07 canonical35 release
and current authenticated API/MCP Summary verification are the next separate
release proof; guest completion does not claim that migration is already applied.
