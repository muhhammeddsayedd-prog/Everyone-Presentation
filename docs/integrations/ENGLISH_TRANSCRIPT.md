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

At that guest checkpoint canonical remained34/English1.0. The subsequent M07
release is recorded below; guest completion alone did not establish it.

## 2026-11-01 canonical35 preservation checkpoint

The guarded M07 Summary migration35 is now applied. Root's one
[apply](../../tracking/evidence/m07/workspace-summary35-release/2026-11-01T00-57-22-943495Z-apply.json)
observed normal return plus two matching independent readbacks at00:57:22.944741UTC;
the separate [readback](../../tracking/evidence/m07/workspace-summary35-release/2026-11-01T00-57-45-216113Z-readback.json)
observed canonical35 at00:57:45.216887UTC. All74 existing table count/hash
projections and full OAuth state stayed exact, including English1.0, old frozen
companions/versions, Reviewed facts and protected M02 state. Original local29 and
the completed local33 recovery proof are unchanged.

The preceding preflight comparison falsely treated Supabase's rotating temporary
CLI role expiry as catalogue drift. Commit29079b2 normalizes only
`rolvaliduntil` for exact role OID17603/name `cli_login_postgres` and independently
requires safe attributes plus finite0<TTL<=600seconds. It changes no role or
product permission. Atomic apply still preserves all74 tables/full OAuth; the
later web gate binds schema/RLS/grants/owners/static OAuth/ten control-plane
configs while permitting ordinary business, per-user authority and claim-count
changes to take effect.

At that00:57UTC checkpoint the web remained5vEM/worker2uAS/English1.0 and Summary's
web/read proof was still pending. The subsequent deployment is recorded below.

## 2026-11-01 Summary-compatible web release

The [provider source-build Ready/readback](../../tracking/evidence/m07/workspace-summary35-web/2026-11-01T01-03-59-685059Z-ready.json)
now confirms web `dpl_6L6vS8FnaGDckcYq8Xm4QxHGc74b` on the stable alias, source282
SHA13209ba54d3e47a5f794ee6a4956fef8096c421e4691bd979b177e545afb831c.
Project settings/link, environment IDs/targets and canonical35/static OAuth
contract were preserved. No private environment transfer or worker/OAuth
configuration change occurred. The isolated local build was quality proof;
the hosted artifact came from the provider's source build.

The [actual signed-in Summary HTTP read](../../tracking/evidence/m07/workspace-summary35-web/2026-11-01-authenticated-summary-read.json)
passed with requestd28d95bc-24ed-4e52-88be-0bf65a74bcb3. Unexpected query input was
rejected with `VALIDATION_FAILED`, request4865d0ef-3c44-4ee5-b878-9da04002b59d.
Six public GET and four Summary/MCP denial/metadata checks passed separately.
At this deployment checkpoint the new Summary MCP read was pending; the app English
regression now passed at01:10:51UTC with the same248-byte saved hash and Reviewed
state preserved (see `2026-11-01-authenticated-app-english-regression.json` in the same evidence folder);
the earlier accepted Claude initial/reconnect/project read remains passed.

Worker2uAS is still Ready with one alive2048MiB dub1 instance at01:06:22.753UTC.
The initial health verifier omitted `sha256:` from its expected digest and
incorrectly reported failure. Its original receipt and separate correction are
retained; the worker state was correct and no new request/restart was needed.
English1.0, actual scan/frozen saved version/guest revocation and old-cohort proof
carry forward. At that deployment checkpoint AT-074's source candidate had19+8
test passes; the later actual local SQL result is recorded below. No labels or selector;
screen reader pending, mobile skipped and pilot running until owner stop.

## 2026-11-01 local attempt-trace and owner MCP follow-up

The [actual owned-local attempt36 proof](../../tracking/evidence/m07/job-attempt-observability36-proof/2026-11-01T01-16-10-092Z-7cff5c7d.json)
passed in83.977seconds, ending01:17:34.069UTC. Direct-trigger and real generation/
claim-replay/callback/manual-retry/stale-attempt fixtures passed. Independent
review matched all185 source seals and confirmed full34/35/36 rollback to owned33,
ephemeral34/35 history/no36 history, trace role rollback, both databases/new roles
absent, original29/Auth-Storage/profile/global roles exact and lock released.
This is synthetic PostgreSQL proof with no cloud/provider or hosted36 release.
Canonical35/web6L6v/worker2uAS/English1.0 and all English evidence are unchanged.

The [owner-reported Summary MCP read](../../tracking/evidence/m07/workspace-summary35-web/2026-11-01-owner-mcp-summary-read.json)
matches the complete HTTP snapshot: workspace rowversion9/draft8, clarification1,
candidates2/unreviewed1/open slot1, Selection1/Shortlist1, Ready series93fb7425/
version1 and null review issues. No MCP request ID was supplied; this is client
attestation without verified server correlation. Prior initial/reconnect/project
read acceptance and actual01:10 app English regression stay passed. Next is the
separate guarded attempt-trace release proposal and real successful/failed
nonprotected operator audit; AT-074 remains partial. Screen reader pending,
mobile skipped, no labels/selector, frontend preserved and pilot running.
