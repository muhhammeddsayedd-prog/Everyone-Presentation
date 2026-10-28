# Combined pasted-text pipeline candidate

Design snapshot for `specs-pipeline-candidate.sql`, outside root migration history. The frozen submit/stage candidates and all nine applied migrations remain unchanged. Root owns SQL execution, migration creation and application.

## Retained input and provenance

Add private `eps.specs_source_inputs`: one append-only row per new job, containing `job_id`, `workspace_id`, `spec_id`, `source_row_version`, `source_hash`, `input_hash`, original `source_text` and creation time. Hash the exact original UTF8 bytes; preparation alone normalizes line endings. FORCE RLS, explicit scoped SELECT/INSERT and no runtime UPDATE/DELETE/TRUNCATE preserve previous input. No source text enters jobs, outbox, processing acknowledgement/idempotency responses or diagnostics. Existing authorized manual Spec DTOs and their private replay cache retain contractual `source_text`; they are not processing metadata envelopes.

Job/workspace/spec/input-hash foreign keys and checked source hashes bind the retained row to its real durable job. Submission checks the actual stored row after insertion, so a suppressed or altered write cannot leave an accepted job without its input. New jobs, outbox, source state, retained input, audit and public/internal idempotency effects commit together.

Add nullable private `Spec.source_extraction_job_id` and `Role.source_job_id` references. Initial application sets them to its retained input. A later source change preserves these references, the prior `source_extraction`, role `source_role`, languages, instructions, clarifications, roles, slots and assignments. Therefore a preserved paragraph/quote resolves through its origin job to the old retained text, rather than through mutable `Spec.source_text`. Legacy provenance stays null when no origin is known; there is no guessed backfill or revision-manager UI.

## Submission semantics

| Request | New job/input | Source epoch | Spec/workspace revision |
|---|---|---|---|
| Pristine initial text | Yes | Increment | Increment together |
| Exact current text/config, new key | Reuse current job | Preserve | Preserve |
| Different original text | Yes | Increment | Increment together |
| Same original text, changed trusted configuration | Yes | Preserve | Increment together |
| Exact existing idempotency key/body | Original acknowledgement | Preserve current state | Preserve current state |

Every new key requires the current Spec revision except locked pristine initial input. Shape/scalar validation precedes cache lookup; current scope is rechecked after waits. New configuration is a new processing request, not a fabricated text revision. Same-text/config reuse validates current job, retained bytes, epochs and hashes before returning its durable status.

An accepted exact-key/body replay is confirmed before the current enabled-configuration gate, so a lost response remains confirmable after an operator pause. It still requires live workspace authority. A new key remains unavailable while processing is paused and stores no new mutation effects.

Keep actor-idempotency → workspace → Spec → job/outbox lock order. No new API request field selects a source snapshot, requester or provider configuration. Trusted pipeline configuration remains disabled by default and contains version metadata only.

The candidate has a separately marked `LOCAL_REHEARSAL_GUARD` block. A later CLI-created migration can omit only that block and use the intact `CANONICAL_PIPELINE_DDL` section, retaining its nine-version/role/object collision preconditions. Docker/admin/Auth-RLS simulation exists only in the test runner, never this canonical core.

## Stage and application guards

Claims/get-input/publication require the stored requester’s current capability and writable project membership, current Spec processing pointer/source epoch and the exact retained bytes/hash/input fingerprint. Get-input reads retained text, never replacement text from the current Spec under an obsolete hash. A superseded attempt cannot obtain the replacement source; a late successful callback cannot publish it. Existing claim/lease/event sequence/digest/cancellation/retry guards remain.

Initial apply additionally checks the frozen workspace revision and pristine working facts. A changed or nonempty draft enters existing `INPUT_CHANGED`/`waiting_for_input`; source resubmission is supported without silently merging, retiring or deleting working facts. The narrowly reviewed private Auth boolean exception remains the only postgres-owned eligibility function.

Private recovery also moves obsolete queued/running jobs into `waiting_for_input` with existing `INPUT_CHANGED`, without cancellation, new dispatch or retention deletion. Superseded active events cannot extend a lease or retry a failed provider request. Current valid work and normal expiry backoff are preserved. The scheduler/gateway must invoke recovery; this candidate does not deploy that runtime or grant recovery to users.

## Review and proof

New files: `development/m02/specs-pipeline-candidate.sql`, `tests/db/m02-specs-pipeline-candidate.sql`, `tools/test-m02-specs-pipeline-candidate.mjs`. Synthetic fixture namespace is `990000`; the executor integration harness reserves `980000`.

The first proof is one hash-pinned owned-local BEGIN/ROLLBACK, with cloud-shaped Auth-RLS simulation and complete catalog/all-count restoration. Cover initial apply/provenance, replacement and configuration changes, live old leases, stale/cached submissions, permission denial, append-only grants, suppressed snapshot/provenance effects and preservation of old evidence. Persistent races, restart durability, actual Node↔SQL integration, provider/gateway/dispatcher/WF01 acceptance and hosting remain later gates. No execution precedes root review.
