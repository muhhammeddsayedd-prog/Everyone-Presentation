# Image-aware frame selection, additive21

Canonical21 is now applied and independently verified. The [single apply](../../tracking/evidence/cloud-m03-frame-vision/2026-10-29T18-56-12-908406Z-1de4c13c-apply.json) and [independent readback](../../tracking/evidence/cloud-m03-frame-vision/2026-10-29T18-59-19-587474Z-975447af-readback.json) pass with all existing business/casting/media/pins/Auth/configuration and actual runtime11 unchanged. The protected one-shot claim remains retained; never reapply21. Worker/n8n/live-provider acceptance is separate.

The candidate is
`supabase/migrations/20261029180953_m03_frame_vision_selection.sql`,
SHA256 `bcd12794eccfa590e5d160f62dfd67838c8186376cddda1952f291c50d03bec8`.
It changes exactly three private function bodies and one technical-outcome
CHECK after exact reviewed20. No column, role, permission, key, model, SDK,
native image, saved frame, fact or project pin is changed by the migration.

`candidate_validate_stage` accepts bound image-aware metadata or explicit
manual/no-frame outcomes. It rejects fresh four-key heuristic callbacks.
Already-stored matching historical payloads remain readable, and exact cached
callback acknowledgements return before current validation. Transient provider
failure may become a manual partial only after the third stage attempt.
`get_candidate_stage_input` supplies that bounded partial flag.

`apply_candidate_scan` adds only `FRAME_SELECTION_UNAVAILABLE` when the validated
selection method is `manual_required`. Zero or two clear frames selected by a
successful vision response remain ordinary `INSUFFICIENT_FRAMES`; they do not
receive a fabricated provider-failure warning. The existing CHECK accepts the
four old safe codes plus this fifth code, at most five entries. All existing
rows satisfy the widened finite domain; arbitrary codes remain rejected. No
provider error text, transcript or image payload is exposed publicly.

## Exact evidence

The [final RED/GREEN rollback](../../tracking/evidence/m03/frame-vision-local/2026-10-29T18-35-46-743Z-9826d8e6.json)
proved fresh legacy rejection, matching historical read and cached ACK, metadata
and source fingerprint denials, null usage, empty prepared sample, actual
zero/two-frame application, third-attempt manual application with the public
warning, and bad fifth/max-six code rejection. Only three normalized source
hashes, one CHECK definition and temporary history21 differed. Every other
catalog attribute, permission, business hash, media/pin, Auth metadata and
configuration returned exactly to owned local20 after rollback.

The [authorized local21 promotion](../../tracking/evidence/m03/frame-vision-promotion/2026-10-29T18-41-31-828Z-a531b6a9.json)
matched the full expected21 snapshot and released the shared local lock.
The owned local reference has no runtime LOGIN role; its null runtime state was
preserved. The actual canonical eleven-operation runtime is separately checked
by every canonical release readback. Local fixture metadata is not provider,
native-image, hosted Auth, browser or semantic-quality acceptance.

The earlier [CRLF seam failure](../../tracking/evidence/m03/frame-vision-local/2026-10-29T18-12-56-123Z-067567fa.json)
and [passed two-body candidate](../../tracking/evidence/m03/frame-vision-local/2026-10-29T18-18-09-293Z-d028607b.json)
are historical. Their draft, candidate, fixture, harness and promotion sources
remain under `tracking/evidence/m03/frame-vision-preparation/`. The multiline
SQL anchors now normalize CRLF to LF before the existing exact-one-occurrence
guards. The two-body version lacked a public technical-failure distinction and
was never promoted.

## Dispatch and release controls

The local promoter revalidates the pinned proof, operational sources, exact
approved manifest and every migration immediately before dispatch. It passes an
immutable checksum-verified SQL string to the existing owned-local runner;
the runner never re-reads an unbound migration file. The same transaction checks
the owned system identifier, uses the shared advisory lock, refuses existing
history/replay entries, applies the exact candidate and writes both history
ledgers. Failed readback uses the already validated cached query. Unknown
dispatched outcomes retain the shared lock and are never automatically retried.
Offline tests cover mutation after successful preflight and immutable SQL binding.

`tools/release_m03_frame_vision.py` permits only fixed-target inspect, dry-run,
one apply and independent readback. It seals the reviewed21 manifest, original
twenty migration entries, exact candidate, final SQL proof/local promotion,
publisher contracts and readback/dependency sources before CLI access. Only the
three proven bodies and exact finite CHECK/history delta may differ from actual
canonical before-state. Existing casting choices, sources, jobs, facts, media,
project pins, Auth policies, schema defaults, configuration and runtime authority
must remain unchanged. Seeds and Vault synchronization are excluded.

Apply needs a stable successful dry-run at most fifteen minutes old and exactly
one pending migration. A protected durable claim and retained attempt precede
dispatch; either prevents another apply. Unknown outcomes require the readback
action and exact comparison with the retained before-state. Raw diagnostics stay
under protected ignored paths. No provider/native/n8n execution is part of SQL
release acceptance.

## Worker transition and forward fixes

Coordinate the stable app-write window and verify the owned worker is idle before
stopping only its known processes. Old heuristic callbacks must not race the
new validator. Publish the separately reviewed metadata-only WF02 handler change,
then restart the verified owned worker with the unchanged native image and private
configuration. A new authorized app job is required for actual OpenAI image input,
usage, selected-image hash and independent visual evidence. Old jobs and pins
remain historical. No metadata success alone establishes frame quality or
spoken-fact accuracy.

A precommit transaction failure must leave20 intact; an uncertain dispatched
operation is reconciled read-only, never replayed blindly. After21, new rows may
contain the fifth code: preserve them and the compatible five-code reader. Do
not restore the four-code CHECK, strip outcome history, replace old selections or
drop stored payloads to simplify rollback. Correct defects with a separately
reviewed additive forward migration against exact current state. Function
attributes and permissions stay fenced. A metadata-plus-media restore exercise
and production release remain separate, unverified work. Hosting stays deferred.
