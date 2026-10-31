# Synthetic presentation asset identities

The first owned local Summary35 run (`3304bf06-3195-4782-944b-8b2efc2cc480`)
reached the actual SQL fixture and failed the existing
`media_assets_typed_purpose_check`. The fixture I added omitted
`producing_job_id`, `producing_attempt_id`, `output_stage` and `output_key` for
its four synthetic presentation assets. Existing M05 constraints require those
identities, a `render_presentation` stage and a purpose-matching output key.

The corrected fixture creates its two synthetic jobs before their asset foreign
keys and assigns each manifest/PDF pair the same explicit producing job and
attempt. MIME, bucket, size, SHA and purpose remain unchanged. No production
schema, constraint, SDK or domain rule is changed or weakened.

The new source regression reads the actual M05 constraint branches to derive
their required nonnull columns, checks the fixture's explicit fields and checks
job-before-asset ordering. It was RED for the omitted producing job and GREEN
after correction. Both contract source checks pass. Actual fixture SQL and
PL/pgSQL parse (81 statements, seven PL/pgSQL bodies). These checks do not prove
PostgreSQL execution; a new independently prepared owned run is still required.

Root reports the failed run removed its disposable databases/new roles,
preserved original29 catalogue/data/global roles and released the shared lock.
Its claim and executed bytes remain retained. No private failure stderr was
printed or copied here, and no SQL, provider or process control was performed
for this correction.
