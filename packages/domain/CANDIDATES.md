# Candidate library domain and persistence

`candidate-types.ts` follows the existing CandidateFacts/Candidate/CandidateMedia/
WorkspaceCandidate OpenAPI DTOs. `candidates.ts` validates typed boundaries and
implements provider-independent fact review, explicit duplicate planning,
unknown-aware supplied-field search, and project media pinning.

Reusable facts have one canonical owner: `eps.candidates`. There was no existing
cast/person record owner in the approved empty business database. Manual profiles
start Unreviewed. Empty scalar input normalizes to null; empty language/accent
arrays remain unknown. Generated casting IDs never become a person's name. A
scan's supplied colliding ID remains source metadata and can suggest an explicit
existing/new choice. No face recognition or automatic identity merge exists.

Review fingerprints include the current full supplied facts and relevant source
provenance. Fact changes invalidate confirmation; merely changing a project's
availability, media choice, frames or notes does not. `age_as_of` records the
observation date of stated age, without manufacturing a birth date or silently
advancing age. A scan with an unknown recording date keeps `age_as_of` null;
its upload date is not substituted for the date the age statement applied.
Search currently compares supplied text/arrays; it does not claim
numerical range/measurement projections. Unknown structured-filter fields are
listed separately and cannot bypass a free-text query or a known mismatch.

`eps.candidate_media` retains original recordings/transcripts and actual frame
asset references. Workspace choices live in `eps.workspace_candidates`; removing
a project pool row archives participation and cannot physically delete a shared
profile/source. Changing one project's chosen media leaves another project's
choice intact. Ready presentation snapshots are a later independent boundary.

`CandidateMedia.processing_issues` reports only the fixed codes `NO_AUDIO`,
`TRANSCRIPTION_FAILED`, `EXTRACTION_FAILED`, and `INSUFFICIENT_FRAMES`, derived
from validated private stage results. A partial technical failure can preserve
useful frames and the original transcript without inventing facts or claiming
the extraction succeeded. Raw provider errors remain private. Retained ID reads
remain available after archive/merge; library search remains active-only.

The forward lifecycle fragment also handles both profiles already participating
in the same project: the existing participation keeps its selected media/frames;
the provisional participation is retained as archived history and its recordings
are explicitly re-keyed to the chosen profile. Optional archive/remove reasons
are stored once as private audit context, outside reusable personal facts.

`createCentralCandidates` in `@eps/central` uses the verified acting user's JWT and
curated RPCs, rejects cross-user actors, validates response shape and keeps
resource IDs/optimistic versions/idempotency/trace metadata explicit. HTTP and
local MCP use those same operations. The public API/MCP names for duplicates are
`list_duplicate_matches` and `resolve_duplicate`; internal adapter methods are
`findCandidateDuplicates` and `resolveCandidateDuplicate`.

Migration `20261029090724_m03_candidate_library.sql` is immutable. The exact
local14 rollback and local15 promotion receipts are under
`tracking/evidence/m03/`. Its first cloud apply succeeded but the comparison
failed because the hosted managed Storage catalog has eleven existing columns
absent in the local SQL fixture. The failed helper/receipt remain retained;
`tools/reconcile_candidate_library.py` proves the bounded inherited ACL difference
and performs a fresh read-only catalog/history check. It does not reapply DDL.

Video byte verification, real OpenAI quality, workflow callbacks, resumable
upload/reload and UI acceptance must be evidenced separately. The local domain
tests and SDK/mock-HTTP tests do not establish those claims.

The video application/native target remains 256MiB. A separately verified
environment Storage limit can be lower: the canonical project's global setting
was observed at 50MiB on 2026-10-29T10:19:22Z. Enabled web uploads require explicit
server-only `CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES`; this value clamps advertised
capabilities and upload-session limits and rejects oversize uploads before
reserving or signing. It does not change database/native bounds or prevent
reading existing larger Ready media. See the read-only
[capacity evidence](../../tracking/evidence/m03/storage-limit-discovery/README.md).
