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
