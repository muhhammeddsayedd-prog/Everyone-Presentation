# Domain transactions and database function contracts

## M07 implemented Settings/session transactions

Applied29 adds `public.eps_get_settings()`, `public.eps_update_settings(jsonb,text)` and `public.eps_validate_own_oauth_session(text)`. Settings writes require `settings.manage`, exact rowversion and stable actor-bound idempotency, with authority rechecked after advisory waits and before cached replay; audit/config writes share the constrained transaction. Template defaults affect future series only. Session projection checks the exact managed session/client/resource and intersects issuer-signed atomic grants with current business grants. The three existing shared functions are source-guarded ports, not a competing permission implementation. [Release/proofs](../../development/m07/db/RELEASE.md) and [API mapping](../integrations/API_DB_MAPPING.md) record the physical operation path. No provider hook was enabled by these transactions.


**Purpose:** define the invariants Codex must implement once, then reuse from UI, HTTP API, MCP and authenticated processing callbacks. These are logical operation contracts. Their implementation may be SQL functions plus TypeScript orchestration or an equivalent transaction layer matching the discovered Supabase architecture. Do not create public RPC endpoints automatically from this document.

Read [the baseline](../../CONTRACT_BASELINE.md), [schema](DATABASE_SCHEMA.md), [access controls](SECURITY_AND_ACCESS.md), and the API contracts together. API operation IDs below are the canonical names. An internal SQL helper may use a prefix such as `eps.set_slot_main_tx`, but it must not introduce different business behavior.

## 1. Common transaction protocol

For each mutation:

1. Validate the authenticated actor/client outside the database and derive trusted context. Resolve current capabilities and central project scope inside the operation.
2. Validate the typed request and referenced entity relationships. Never let a request choose its own actor or arbitrary table/object path.
3. Claim the idempotency record when the operation requires it. Canonicalize the request before hashing. Replays of the same request return the existing result; changed payload under the same key returns `409 IDEMPOTENCY_KEY_REUSED`.
4. Begin a database transaction. Set actor context transaction-locally if using a dedicated database role. Lock aggregate records in a consistent order; check submitted `row_version` values after locking.
5. Apply the complete invariant-preserving mutation; increment affected row versions and the workspace `draft_revision` when presentation input changes.
6. Append a safe audit event. For asynchronous work, create the durable job and dispatch outbox event in this same transaction.
7. Commit and return the resulting IDs/versions or a `202` job handle. Dispatch network calls after commit through the outbox worker.

Do not hold a transaction open during OpenAI, n8n, file upload, FFmpeg or PDF rendering. Use bounded lock/statement timeouts appropriate to the discovered environment. On a deadlock/serialization conflict, retry the entire transaction only with the same idempotency identity; do not partly replay side effects.

PostgreSQL row locks serialize concurrent changes to the same selected rows; they do not by themselves express all business uniqueness rules. Combine locks with unique constraints/partial indexes. See [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html), verified 27 October 2026.

### Error codes

| Code | Meaning / response |
|---|---|
| `AUTH_REQUIRED` | No valid principal/session; 401 |
| `CAPABILITY_REQUIRED` | Authenticated but lacks capability/scope; 403 |
| `RESOURCE_NOT_FOUND` | Resource missing or deliberately indistinguishable from inaccessible; 404 |
| `STALE_RESOURCE_VERSION` | Submitted row version no longer current; 409 with safe current version metadata |
| `IDEMPOTENCY_KEY_REUSED` | Same key reused for different canonical request; 409 |
| `INVALID_RELATIONSHIP` | Cross-workspace/series/candidate reference; 422 or non-disclosing 404 |
| `INVALID_TRANSITION` | Job/version/lifecycle transition not permitted; 409 |
| `VALIDATION_FAILED` | Typed input violates schema; 422 |
| `LINK_UNAVAILABLE` | Invalid/expired/revoked external link; consistent unavailable response |
| `RETRYABLE_DEPENDENCY_ERROR` | Temporary provider/storage error; retryable true |

The API error envelope adds `request_id`, human-readable `message`, structured `details`, and `retryable`; never return raw SQL/provider stack traces to users.

## 2. Projects, workspace, and branding

### `create_workspace`

Inputs: canonical project identifier/binding, module `casting`, optional initial output, idempotency key. Required: `projects.read`, `workspaces.write`, actual central project access.

Resolve the canonical project, validate that it exists and can be used, create/reuse its binding, and atomically return the single active Casting workspace. Use the project/module unique constraint to resolve simultaneous creation. Do not create a synthetic central project when lookup fails. The internal initial output does not create a second workspace.

### `update_project`

Inputs: exact editable shared fields, project/client expected versions where applicable. Required: `projects.write` and canonical entity/field permission.

Write through the discovered canonical owner/function. A project edit cannot accidentally rename the client unless the request explicitly includes an authorized client edit. If both writes are in the same database and logically one action, execute atomically. Return current shared values and version metadata. Generated snapshots remain unchanged. If another app owns a restricted write procedure, use it rather than updating underlying columns around it.

### `update_workspace`

Inputs: allowed workspace fields, `logo_asset_id` nullable, `logo_placement` cover/every_slide, expected version. Validate a Ready permitted image asset; preserve aspect ratio via rendering, not destructive data mutation. Pin the selected asset ID. If changing the shared client logo is explicitly part of the action, call the canonical client owner; selecting a project presentation asset alone is not an implicit cross-business logo replacement. Bump draft revision.

## 3. Specifications, roles, and slots

### `submit_specs`

Accept one uploaded Ready document asset or pasted text, expected workspace/spec version, idempotency key. Persist original source, create `specs_extract` job/outbox, and return job ID. A duplicate request must not queue duplicate extraction. Reject unsupported/corrupt source with a repairable file error; do not invent extracted requirements.

### `update_specs`, `create_role`, `update_role`, `update_slot`

Correct working requirements directly under `workspaces.write`. Keep source references and unresolved markers; clearing a marker requires a deliberate correction/confirmation. Preserve role identity across ordinary edits. A role can have several scene references. Do not rebuild all roles from an extraction result after the user has started correcting them: apply against the extraction's expected draft version, or retain the result for ordinary editing.

### `resize_role_slots`

Inputs: role ID, requested positive count (or a clarification state), expected role version, explicit slots to archive if the count is reduced, idempotency key.

Lock role and affected slots. Increasing count creates individual slots with stable ordinals. Reducing count archives explicitly selected excess slots and their active assignments as one transaction; return the archived assignment summary for Undo. Do not silently reassign people into another slot or hard-delete historical sources. Ensure the role's working headcount equals its active slot count when confirmed. A count not supplied in the source may be represented by one provisional slot with Needs clarification; the UI must label that default.

### `archive_role`

Archive the role, its active slots and assignments atomically; keep generated version references. Return enough inverse-operation data for bounded Undo. Undo must check the current relevant row versions and cannot erase intervening edits.

## 4. Uploads, scans, and candidate facts

### `create_upload_session` and `complete_upload`

Reserve server-generated asset ID/object key, permitted scope, file expectations and expiry. The completion operation verifies object existence, actual size/type/checksum or schedules verification, and marks the stored asset Ready when validated. Repeated completion is idempotent.

For candidate videos, completion atomically creates/reuses the per-file scan job and outbox event. For logos or already handled files, completion can return an asset without a job. Do not fake a processing ID to keep response shapes identical. Upload batches share a parent job or batch metadata; one corrupt file does not cancel other files.

### Candidate scan result ingestion

The `complete_job_stage` operation, not the model, controls persistence. Validate the callback's service identity, job/attempt lease, source asset ID/hash, result schema version, and permitted output paths. A new candidate profile is created once as Unreviewed with its media/frames and source transcript. Replayed callbacks return the existing candidate/media IDs.

When a result targets an existing profile, compare the expected profile version. Do not overwrite newer confirmed facts. Retain the new media and report a simple “profile changed during processing” result for ordinary editing; do not build a competing-facts workflow. Null/missing extracted values do not erase confirmed supplied values. Empty/no-speech results still provide usable source media with extraction warnings; they do not guess name, age, gender or skills.

### `create_candidate` and `archive_candidate`

Manual profile creation requires `cast.write`, validates any supplied source assets and creates Unreviewed. It is a usable recovery path when transcription cannot supply facts; it does not require a video to invent missing information. A null supplied casting ID allocates a unique stable display ID. A scan with a colliding supplied ID retains that source value in evidence and uses a provisional generated ID until explicit duplicate resolution. Updates with null casting ID preserve the existing display ID; non-null replacements must be unique.

Archiving a candidate removes it from normal library search without deleting source assets or rewriting existing workspace/version history. Surface its active project usage before archival. It must not silently remove assigned people from ongoing casting work; project removal uses the explicit workspace/assignment operations. The archive operation requires cast editing permission and expected row version.

### `update_candidate` and `confirm_candidate_reviewed`

`update_candidate` requires `cast.write`; confirmation also requires `cast.review`. Input contains candidate ID, expected fact/profile version, explicit fact edits and optional confirmation. Map each field to its canonical or casting-extension owner. Correct-and-confirm can be one transaction, preserving the full field values, source/provenance markers and reviewer metadata. Confirmation stores the deterministic current reusable-fact/source fingerprint; the profile is projected Reviewed only while that hash matches the current canonical-plus-extension values. This catches external canonical edits without a fact-conflict UI. Project availability, casting choices and template changes are excluded from this reusable-fact confirmation hash. Return the updated canonical projection.

Confirmation does not set Main, Shortlist, booking status or client approval. A displayed profile is not implicitly Reviewed merely because a user opened it. Missing fields may remain Not provided at confirmation; Reviewed means the supplied profile information was checked, not that every optional fact exists.

### `update_candidate_frames`

Validate each selected frame asset belongs to the intended source video/candidate, is available, and is an actual extracted frame from the selected source video, including a manually requested timestamp. Keep zero to three ordered frame references. Confirming fewer than three is valid. Do not enforce three by repeating one frame or synthesizing an image. Changing a library default does not repoint existing workspace selections or historical versions.

### `resolve_duplicate`

Inputs: scanned candidate/media, resolution (`keep_new` or `link_existing`), target candidate when attaching, expected versions, idempotency key. Requires `cast.write` for identity changes and project write for affected live assignments.

Never merge automatically. For attaching, retain the source video/transcript/frames under the target identity without replacing confirmed target facts. If the provisional source profile has not been used elsewhere, archive it as an alias with `merged_into_candidate_id`. If it already has workspace relationships, map live workspace candidates to the target identity in a transaction, preserve independent roles, and return a concrete summary of collapsed duplicate assignments.

When the same resolved person would occupy the same slot twice, keep a single assignment. Implementation default: retain the existing target assignment ID; Shortlist inclusion becomes logical OR; position preserves Main if either record was Main, otherwise Backup if either was Backup, otherwise Option. Preserve both notes in the audit/resolution result and allow an explicit resulting presentation note. Do not rewrite immutable version slides or prior guest feedback. Existing chosen project media stays pinned unless the actor explicitly chooses the newly attached source. This is identity resolution, not a general field-conflict interface.

## 5. Project pool and casting assignments

### `add_workspace_candidate`, `update_workspace_candidate`, `remove_workspace_candidate`

Add/reuse one active pool record per workspace/candidate. Select media explicitly or use the current library default at the moment of addition; pin its identity and frames. Save current-project availability here. `fresh_material_required` records the producer's need without deleting reusable historical material.

Removing a pool member with assignments requires an explicit operation that archives those active assignments in the same transaction and returns the effect. It must not silently leave dangling candidate pages. Historical snapshots are unaffected. Project-level media selection does not change the library default.

### `create_assignment`

Inputs: workspace/slot/workspace_candidate IDs, expected slot version, optional `shortlist_included`, idempotency key. Validate same workspace. Upsert/reuse the unique active candidate-slot relationship and return it. New assignments begin Option. In the Shortlist flow, set explicit inclusion true; the assignment automatically appears in Selection because Selection is derived from all active assignments.

### `update_assignment`

Inputs: assignment ID, expected version, allowed notes/wording/shortlist/ordering fields. Changing Main must use the `set_slot_main` transaction, not a bare column update. Backup/Option changes still lock the slot and update its version when position changes. Changing notes cannot grant external viewers access to internal notes; public presentation notes and internal notes are distinct fields.

### `set_slot_main`

Inputs: slot ID, target assignment ID or null to clear, expected slot version, idempotency key. Required: project write.

1. Lock slot, then its affected assignments in deterministic ID order.
2. Recheck expected slot version and assignment scope/activity.
3. If target already Main, return a successful no-op result.
4. If changing Main, demote the old Main to Backup (implementation default), then promote the target.
5. Increment both changed assignment versions, slot version and draft revision; append one audit event.
6. Return target plus previous Main and their resulting versions, with an inverse operation payload and `undo_event_id` referencing the server audit snapshot. Undo verifies the supplied restoration list against that event; it never trusts arbitrary client-authored historical positions.

The partial unique index on active Main per slot is the final integrity boundary. A second concurrent operation with the old slot version returns stale-version conflict instead of silently displacing the first user's new decision. Undo is a new authorized transaction checking the current versions; it is not an unrestricted rollback of someone else's later edits. Clearing Main leaves the old Main as Backup by default and is valid; generation never requires a Main.

### `remove_assignment` and `reorder_workspace`

Removal archives the assignment and updates the slot/workspace revision. Reordering accepts explicit ordered IDs for a bounded scope and rejects foreign, duplicate or omitted required IDs. Preserve order deterministically with ordinal reassignment in one transaction. Shortlist order can use the assignment order in v1; do not accidentally maintain two unsynchronized copies of an assignment.

## 6. Generating an immutable version

### Audience preset operations

`list_audience_presets` returns the permitted choices to authenticated producers. `create_audience_preset`, `update_audience_preset` and `archive_audience_preset` require `settings.manage` and expected row versions where applicable. Reuse the existing settings owner if compatible, otherwise persist `audience_presets`. Capture the selected preset's policy in the series fingerprint/snapshot. A changed policy creates a distinct scoped series; it never changes a historical snapshot or lets an external link reach internal notes.


### `generate_version`

Inputs: series (fixing workspace/output/audience), expected workspace row version, expected draft revision, expected input fingerprint from final review, template version/configuration, idempotency key. Required: `presentations.generate` and project access.

1. Validate the intended inputs and output audience. Missing candidate facts/open slots/zero Main are allowed. Unauthorized project, invalid asset reference, unresolvable template or text that cannot fit without truncation is an actionable technical/editorial issue; never silently discard data.
2. Resolve the fixed series for workspace/output/audience scope. Recompute the final-review input fingerprint and capture all central and app-owned values in the same consistent database snapshot, including selected media/checksums and current logo. Reject a mismatched fingerprint rather than generating newly changed facts the actor did not review. Use canonical row versions or content hashes for central records; do not assume other apps bump this workspace draft counter.
3. Determine slides: cover; ordered slot sections containing all active assignments for Selection or explicitly included assignments for Shortlist; Pending slide for each slot empty in that output. Repeated candidate identities remain separate assignment slides.
4. Validate field visibility and length/layout feasibility. Preserve every agreed field and explicit Not provided rendering semantics.
5. Lock series; allocate its next version number; insert immutable version snapshot and ordered slide snapshots with content hashes.
6. Insert render job and outbox event, then commit. Return `202` with version and job IDs.

The renderer reads this immutable input only. If the user edits meanwhile, the in-flight version renders what was requested and the draft becomes newer. A profile/global logo/default-media edit cannot mutate this version after creation.

### Render completion (`complete_job_stage` for `presentation_render`)

Validate source snapshot hash, template version, expected page count, actual output storage objects and manifest. Mark the version Ready and attach PDF/artifacts in one transaction. Update the series's latest pointer only if the completing version number is higher than the current Ready version number. A failed/partial render remains Failed and never advances external links. Retrying a failed renderer can complete the same frozen version if input is unchanged; an intentional regeneration with changed data creates a new version.

## 7. Review links and feedback

### `create_review_link`, `update_review_link`, `revoke_review_link`

Requires `review_links.manage` for the project/series. Create only for a permitted external series. As required by M06, a valid link may precede its first Ready version; the guest then sees Preparing and current-version data is null. Generate the token server-side; default expiry is now plus 30 days; PDF downloads default enabled. Rotation increments link token generation, invalidates old-generation guest sessions, revokes old PDF grants and advances export revision; it does not change the presentation content. Updates may change expiry/download permission, but cannot silently repoint the link into another output/audience series. Expiry updates propagate to all non-revoked child media grants in the same transaction; do not revive revoked grants. Revocation records a timestamp and stops new scoped authorizations. Download-disable alone leaves valid viewing/media access intact.

Idempotent token creation must survive a lost response. Default implementation: encrypt the one-time token-bearing idempotent response using a server-held key with a short configured replay TTL (24 hours initially); store ciphertext, never a plaintext token. The permanent link record stores only its token digest. After the replay window, an explicit authorized rotation/reissue produces a new token rather than pretending the original can be recovered from a hash.

M06's optional Idempotency-Key on link/comment PATCH and guest identification preserves the same acknowledgement after an uncertain response. Current authorization is checked before cached replay; identical key with different semantic input is rejected. Without that optional header, ordinary row-version semantics remain. Replay encryption uses AES-256-GCM with a random96-bit nonce,128-bit tag and authenticated actor/operation/subject/idempotency context; gateway HMAC uses a distinct32-byte key. These APIs are supported by the pinned [Node24.18 crypto documentation](https://nodejs.org/download/release/v24.18.0/docs/api/crypto.html).

### `prepare_pdf_export`, guest export operations, and `mint_review_media_grant`

Internal `download_version_pdf` serves the immutable canonical PDF under internal authentication. A guest PDF request first authorizes the parent link and its download flag, then resolves a Ready `presentation_exports` variant for the exact viewed version and current export revision. If missing/stale, `guest_prepare_pdf_export` (or authorized internal `prepare_pdf_export`) idempotently creates a `presentation_export` job/outbox and returns 202. The guest can poll `guest_get_pdf_export` and download only a Ready current-authorized variant.

The active export worker calls `mint_review_media_grant` with its authenticated job attempt/lease. The backend verifies export/version/link scope, revokes any failed attempt's orphan grant, creates a random token whose expiry does not exceed the parent link, stores only its digest, and returns the token once. The worker embeds fixed-version `/m/:grantToken/...` URLs and saves the PDF privately. Completion checks page count/content hash against the canonical snapshot, permits only playback-link differences, verifies the parent token generation/export revision is still current, attaches the PDF/grant to the export and marks it Ready. A link rotation during rendering makes that attempt obsolete; revoke its grant and reject publication into the current cache. A lost token issuance response is handled by revoking that orphan grant and minting a replacement for the active attempt; never weaken hash-only storage to recover it.

Every grant playback request rechecks its parent link's current viewing scope/expiry/revocation and that the asset belongs to its fixed version. The download flag controls PDF preparation/download, not playback from previously downloaded PDFs. No candidate-library lookup is exposed. Updating parent expiry propagates the new expiry to all non-revoked grants, including naturally expired ones, without clearing any revoked_at field; old PDFs therefore continue working after an authorized extension. Credential rotation requiring a new token increments the link's export revision and revokes affected old grants; new downloads prepare a fresh variant, while earlier bytes stay unchanged. A failed export never changes the series's latest presentation version.

### `guest_identify`

Resolve the valid review link/session, require non-empty display name for feedback, store optional company, and return the session's safe display data. Do not claim verified identity. Never find the author record by name alone. A new link version does not require retyping the name while the valid scoped browser session remains.

### `create_comment`, `update_comment`, `set_preference`

Verify active link, session, series, Ready version and immutable `version_slide_id`. Guest author must have a name. Guest writes are external visibility only. Updates require that same opaque session or authorized internal moderation capability; another same-named reviewer is not the owner. Preferences target candidate slides and accept only Preferred/Maybe/Not preferred; an explicit clear removes the current preference. Comments can target a candidate/Pending slide. They do not modify casting choices.

All guests of that series can read its external feedback. Always preserve the viewed version ID even if the series pointer changes between opening the page and posting. Internal notes/comments never appear in guest response objects.

## 8. Jobs, leases and durable dispatch

### `claim_job_stage`

Authenticated worker/dispatcher claims a queued job or recoverable expired lease. Atomically increments the monotonic numeric attempt, sets a new `current_attempt_id` UUID, resets its sequence counter, creates a random lease/fencing token, sets Running and an expiry, and returns only permitted input asset references and task instructions. Concurrent claims return one winner. Each job has one active stage lease; run its stages sequentially, with concurrency across separate per-file jobs. A duplicate claim for an already-completed stage returns its persisted result, not a new processing task. Credentials or shared secrets are not persisted in job input.

### `reserve_job_output`, `complete_job_output`, and `get_job_asset_access`

These are service-only operations bound to the current authenticated job/stage/attempt/lease. A worker cannot invent an asset ID and expect a result callback to make it trusted. Reserve each output using an allowlisted asset purpose, parent source reference and deterministic output key. The backend allocates the asset UUID, immutable private storage path and limited upload authorization, recording `producing_job_id`, `producing_attempt_id`, `output_stage` and `output_key`. Duplicate reservations for the same attempt/key return the same reservation.

Completion verifies actual storage existence, type, size/checksum and reserved job ownership before marking an output Ready. Stage results may reference only Ready reserved outputs from the active attempt or explicitly reused verified previous-stage assets. `get_job_asset_access` refreshes short-lived read/write access only for persisted allowed job inputs/outputs; it is never an arbitrary bucket/path signing endpoint. A cancelled/obsolete attempt cannot mint new credentials or publish an asset as current domain data. Orphan bytes remain cleanup candidates after reference checks.

### `record_job_event`

Validate job, current attempt, lease, event ID and bounded schema. Insert append-only event once using unique `(job_id, attempt_id, event_id)` and `(job_id, attempt_id, sequence)`. Duplicate identical event is a no-op; mismatched duplicate is rejected. Progress cannot move a completed stage backward. Compare the callback attempt UUID with `jobs.current_attempt_id`; numeric attempt alone is not the API lease identity. Track the highest applied sequence, record duplicates once, and reject different payloads reusing the same sequence.

### `complete_job_stage` / `fail_job_stage`

Accept results only for the current authenticated lease/attempt and expected input hash. Validate result schema and output asset ownership. Apply domain changes and terminal/current stage state in one transaction. A stale attempt is ignored/rejected with an explicit code and cannot clobber a newer confirmed profile or version. Failure stores a sanitized code, retryability and stage; it does not destroy successfully completed sibling jobs.

### `retry_job` / `cancel_job`

Retry requires an authorized actor, a retryable state/stage and idempotency key. Reuse durable source/output references, enqueue through an outbox event, and clear only the failed stage's transient state. Do not create duplicate profiles. Cancel sets a durable request; workers check it between bounded stages and stop future writes when cancelled. It cannot promise to stop an already sent provider request instantly or erase already generated data.

### Dispatcher and reconciliation

Claim pending outbox rows with a lease; send authenticated n8n requests outside the DB transaction; acknowledge Delivered only after accepted dispatch. Delivery may occur more than once, so intake identifies an existing job rather than creating a duplicate. Expired leases are reclaimable. A scheduled reconciler finds stalled uploads/jobs/outbox events and exposes retryable failures in Processing. Infrastructure retries never change an explicit casting choice.

## 9. Tests required before exposing each operation

Every operation needs one valid case, an unauthorized scope case and relevant invariant/concurrency cases. Concentrate concurrency tests on workspace creation, candidate-slot uniqueness, Main replacement, version-number allocation/latest-ready advancement, callback replay and idempotent token creation. Test transaction failure after intermediate writes to demonstrate atomic rollback. Record implementation-specific function names, migration files and passing test evidence in the milestone progress ledger.

