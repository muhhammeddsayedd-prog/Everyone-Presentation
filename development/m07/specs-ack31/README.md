# Private Specs acknowledgement projection — migration31 preparation

The [actual disposable-clone proof](../../../tracking/evidence/m07/specs-ack31/2026-10-31T01-22-16-662Z-dc886d4e-local-proof.json) passed the real-role
RED/GREEN checks, catalogue/data preservation and exact owned cleanup.
Canonical migration31 application and hosted submission success remain pending.

The [actual rollback diagnostic](../../../tracking/evidence/m07/controlled-pilot/2026-10-31T00-52-17-615895Z-502fe6c1-specs-submit-repro.json)
reproduced SQLSTATE `42501` on `jobs` through the real public submission RPC
under the existing actor's modeled authenticated claims. Its one RPC was rolled
back internally and externally; selected before/after state matched. The
[earlier hosted request](../../../tracking/evidence/m07/controlled-pilot/2026-10-31T00-35-33.565Z-specs-request-logs.json)
returned HTTP403. Neither result is a successful hosted source submission.

The private `eps.specs_submit_ack` helper currently calls the general Job DTO
only to read job identity, kind, workspace, resource and status. Later DTO
composition references the whole `jobs` row, while this helper's owner has
column grants. The candidate reads the necessary columns directly and joins the
actual Spec, requiring both workspace identities to agree. It retains the
private invoker boundary, existing grants, validation error and four-field
`JobAccepted` response. It changes no general Job DTO or public RPC body.

[candidate.sql](candidate.sql) requires exact history30 and the exact prior
private helper body, owner, ACL and routine metadata. Its suffix changes one
function body and checks the replacement hash and unchanged metadata.
[release-plan.json](release-plan.json) pins the candidate, suffix, old/new body,
readback and tests. The intended coordinated migration is
`supabase/migrations/20261031010000_m07_specs_submit_ack_projection.sql`.
Root completed the history30 forward readbacks before the candidate was promoted
byte for byte to that coordinated migration path. Canonical31 application remains pending; file existence is preparation only.

The new local controller must restore original local29 into its own verified,
UUID/OID/comment/owner-bound disposable database, compose30 there, and run
[tests.sql](tests.sql) in an outer rollback first against the predecessor and
then against31. The fixed `eps.specs_ack31_phase` GUC selects `red` or `green`.
RED requires the actual `42501/jobs` denial. GREEN requires a closed accepted
response, same-key replay, stale-version denial, denied-actor rejection,
invalid relationships and exact source/job/outbox/idempotency counts. Synthetic
Auth/business fixtures and queued jobs remain confined to each rollback. No
worker polls the disposable database and no provider is called.

The controller must compare the complete restored catalogue/data before and
after, allowing only this function's source hash and the appended31 history.
All existing permissions, ready snapshots, protected M02 facts, settings and
global role identities/memberships remain exact. Cleanup requires proof that
the owned database and any newly owned issuer role are absent before releasing
the shared lock. Original local29 is read-only throughout.

Root owns local execution and any later canonical release. Canonical admission
must freshly bind the existing central project, exact history30, source pins
and exclusive release claim, then execute one transaction and independently
read back. Unknown dispatch must stop and read back rather than retry.
[readback.sql](readback.sql) observes the current helper and its existing narrow
privileges; it does not independently establish business-data preservation.
Canonical31 also requires a separate explicit rebase of later OAuth operator
history gates before activation. Historical history30 proofs remain unchanged.
