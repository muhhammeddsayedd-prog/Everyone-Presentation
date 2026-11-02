# Disabled valid-config owned collector proposal

This is a NEW source-only local purpose after the retained ec29f8df failure.
`cases.mjs` has `EXECUTION_ENABLED=false`; canonical READ/APPLY remain false.
No SQL, Docker, provider, native worker or canonical change has been performed by
this purpose. Root reviews the disabled plan before a separately authorized run.

The old ec29 source/controller/claim/receipt remains frozen. It failed normally
at `candidate_asset_config_check`: the restored synthetic singleton has two null
model fields, so enabling it alone is invalid. Restore38 data/catalogue and
cleanup/original29/global-role preservation passed, and the shared lock was
released. Its new collectors/checkpoints/rendered SQL40 were never reached.

## Smallest configuration qualification

`fixture.py` reads only the pinned synthetic639 metadata dump, SHA256
`12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c`.
It requires each of the exact five original COPY-row fingerprints. It derives
complete JSONB preimages, full expected postimages and actual named CHECK
definitions from that immutable dump. It also seals each checked-in source
migration. No current canonical configuration is read or copied.

The setup still touches only the previously declared five singleton tables:

| Table | Assigned fields | Exact values / retained fields |
| --- | --- | --- |
| candidate_asset_config | enabled, transcription_model, extraction_model | true; synthetic-transcription; synthetic-model |
| frame_extraction_config | enabled, native_image_id | true; sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4 |
| specs_pipeline_config | enabled, document_preparation_version, model_version, prompt_version, result_schema_version | true; document-preparation.v1; synthetic-model; specs-v1; 1.0 |
| presentation_processing_config | enabled | already true; every existing renderer/origin/limit field retained |
| review_processing_config | enabled | already true; every existing model/prompt/renderer field retained |

Compared with the failed setup, only the two missing candidate model fields and
four missing specs version fields are added. The frame digest/flags setup is
unchanged. Presentation/review updates are existing no-ops. These are nonsecret
fixture labels, with no provider call or model compatibility claim. The retained
review model is merely an existing synthetic dump value.

The actual `candidate_asset_config_check` requires both model strings nonnull
and length1..200 when enabled. `specs_pipeline_config_check` requires all four
version strings nonnull, with individual trimmed length1..200 checks. The frame
enabled CHECK requires a nonnull sha256 digest with64 lowercase hex characters.
Existing candidate prompt/schema/media/English values, frame implementation,
presentation renderer/origin/byte/page limits, review model regex and singleton
IDs remain unchanged. Full exact names/definitions, original rows, changes and
postimages are recorded in the disabled plan; no constraint is dropped or copied
into an alternative database policy.

The fixture runs as postgres only in owned project39, requiring the exact fresh
system/run and history39. Each whole preimage must match before its update,
exactly one row must be affected, and its whole postimage must match afterward.
Postgres retains all real CHECKs. There are no inserts, schema/role/grant changes,
trigger suppression, production keys or new data identities in this fixture.

This qualification is before the fresh collector baseline. It is explicitly not
canonical configuration acceptance. The same previously reviewed three busy-row
qualification, normal version trigger and five declared config setup tables
remain the only outer clone-preservation exclusions. The new collector then
preserves all76 tables, including every full configuration row, exactly across40.

## Reuse and new ownership

The prior `local.py`, `local-cases.mjs`, `local-compiler.py`, `state.py` and
`release.py` are SHA-pinned and used only as inert libraries. They are not edited
and no old main/claim is replayed. The old local flag remains true in its frozen
historical source; the NEW false wrapper guard runs before any library/test or
target access. Root must arm the new flag separately, before fresh compilation.

The finite compiler replaces only setup configuration, the new guarded wrapper,
purpose/private paths/labels and source provenance in the reused generated
bootstrap. Resource names use `eps-r40f-<fresh run UUID>`; labels use
`eps.reason40fixture.*`; private claims/diagnostics use
`.local/reason40-collector-fixture-validation/<fresh UUID>/`. The normal shared
Main test-db lock, network-none owned PG17 image, verified restore38→39, original29
readbacks and exact owned cleanup remain unchanged. The source-only compiler
entry reports the actual new wrapper flag rather than the old static label.

The public receipt remains in the existing closed
`tracking/evidence/m07/reason40-collector-validation/` family. Therefore the
canonical controller's closed proof admission/provenance is unchanged: it still
requires actual passed normal/negative/76-checkpoint outcomes, cleanup and all
frozen query/library/orchestrator seals. This avoids duplicating a canonical
controller or changing cloud behavior. New wrapper/fixture/compiler seals are
additionally recorded in the new receipt and checked before local target use.

The actual state SQL9b352fb4, checkpoint4737f4ff, qualification9ca76b04,
canonical SQL40 migration08bf4de8, owned target qualifications and frozen
render/negative/nonce/checkpoint comparisons remain byte-exact. Session-local
legacy GUC names used by those frozen libraries do not refer to old claims.

## Required later proof and current validation

A separately approved fresh run must pass the original actual before/after
collectors and full76 checkpoints, deliberate preimage refusal/rollback, one
rendered SQL40 COMMIT nonce, exact old row/catalogue/role/membership/function/
dependency preservation, owned resource absence, original29 equality and shared
lock release. A failure/unknown is retained without automatic replay. No such
outcome is claimed by this proposal.

The four focused pure tests validate exact preimages/minimum missing fields,
real fixture SQL/PLpgSQL parsing, unchanged frozen query hashes, generated Node
syntax, namespace/provenance and default-off refusal before target access:

```powershell
& '<Main>/.venv-skills/Scripts/python.exe' -X utf8 -B -m unittest discover -s development/m07/review-link-reason40-collector-fixture -p test_fixture.py -v
```

They do not execute CHECK constraints, SQL, Docker or provider calls. Actual
constraint execution remains part of the separately authorized local run.
