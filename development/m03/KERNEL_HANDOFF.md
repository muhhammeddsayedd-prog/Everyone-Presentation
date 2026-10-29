# Candidate pipeline checkpoint

The corrected additive migration is
`supabase/migrations/20261029100500_m03_candidate_pipeline.sql`, SHA256
`4af04b4a3fb050e39aa23958c3f82e304cc7d7a1f450a5d93f7f50bc001bd836`.
It is persisted on the owned local PostgreSQL instance with reviewed history17.
The initial local checkpoint preceded cloud17. The later cloud reconciliation
below records its actual release state; runtime enablement and hosting are
separate actions.

Evidence:

- Full composed rollback, including seven behavioral markers and authenticated/
  anon private-helper EXECUTE denials:
  `tracking/evidence/m03/kernel-local/2026-10-29T10-17-45-307Z-cfce26d3.json`.
- Composed migration without fixtures, catalog/data rollback:
  `tracking/evidence/m03/kernel-catalog/2026-10-29T10-20-30-781Z-5b008cdd.json`.
- Authorized local promotion preserving existing business data and the exact
  catalog delta:
  `tracking/evidence/m03/kernel-promotion/2026-10-29T10-22-38-271Z-7d5268d8.json`.
- Persisted17 regression: prior M02 PDF/DOCX, truthful `pdf_vision`, then all seven
  M03 synthetic state/permission cases in separate rolled-back transactions:
  `tracking/evidence/m03/persisted17-compatibility/2026-10-29T10-28-10-943Z-72e8dd12.json`.

The original pending17 with the overly broad wildcard grant was never persisted.
Its exact bytes, preparation receipt and builder remain under
`development/m03/kernel-before-private-grant-fix/`. The corrected migration uses
five explicit public upload RPC signatures. Internal helpers remain unavailable
to authenticated/anon except the explicitly scoped Storage predicates.

`tools/release_candidate_pipeline.py` provides root-operated dry-run/apply/
readback through the existing authorized CLI. Its pins include local proofs,
the exact comparator/bridge/readback, reviewed manifest and prior runtime
validator. It checks fresh unrestricted snapshots, the actual NOINHERIT runtime
role, three inherited groups, managed incoming edge, private logging, expiry and
the exact eleven runtime functions. Existing row fingerprints and catalog leaves
are preserved except the reviewed additive delta. The local snapshot has no
`eps_specs_runtime` LOGIN; it does not prove live credential authentication.

All SQL evidence above uses synthetic metadata. It does not prove Storage HTTP,
native media preparation, transcription/fact accuracy, n8n delivery or actual
200-video throughput. Representative real media, supporting attachment
association, interrupted/resumable uploads and actual app acceptance remain
separate checks. The candidate configuration remains disabled by default.

## Cloud17 read-only reconciliation, 29 October 2026

Root applied17 once: CLI exit0 and history17. Its first comparison stopped on
nine effective EXECUTE booleans for three new roles and three pre-existing
managed Storage operation predicates. The cloud already granted PUBLIC EXECUTE
on these functions; the local Storage simulation did not. Existing PUBLIC ACLs,
function sources and existing-role privileges remained exact. No SQL or grant
change was made to reconcile this metadata difference.

The failed apply receipt remains unchanged:
`tracking/evidence/cloud-candidate-pipeline/2026-10-29T10-32-13-540642Z-e50f546a-apply.json`.
The first read-only refresh also remains unchanged; its strict business equality
check stopped because root had used the signed-in app to add the manual candidate
to the project. Root subsequently saved project choices and attested both app
operations before pausing mutations for the final refresh.

Final actual read-only PASS at 10:49:21 UTC:
`tracking/evidence/cloud-candidate-pipeline-reconciliation/2026-10-29T10-49-21-239370Z-2aedbfeb.json`,
SHA256 `245ab7685fdf1d8f8966ade441c957f0ea20da68c3d405d75f4b34b8d3a0dab6`.
It proves full preservation at apply and an unchanged current deployment catalog,
runtime11 and disabled configuration. Current business drift is recorded
separately: workspace participation0→1, audit52→54, idempotency45→47 and workspace
count2 with changed fingerprint. This is owner-attested table-level post-release
drift, not a claim that every current business row remains unchanged or a
row-level proof of the UI changes.

`tools/reconcile_candidate_pipeline.py` is a bounded read-only helper for this
specific release and these recorded post-release app operations. It has no
migration retry, flag flip or cloud write path. Its three Node boundary tests and
four Python orchestration/drift tests passed; an independent agent reviewed both
the managed-PUBLIC exception and the current-deployment comparison. Later app
changes or activation require their own current acceptance evidence.

## Fixed live metadata capture

`tools/capture-m03-live.py` and `tools/sql/m03-live-readback.sql` observe only
candidate_scan jobs in the authorized test workspace/project, bounded to64 jobs.
The capture guard requires reviewed history17. SQL and harness seals are recorded
per receipt. Six offline privacy/bounds tests passed; an owned-local seven-job
synthetic projection exercised success, partial, waiting and cancellation shapes
and rolled back exactly. Those local fixtures do not count as live processing.

The first actual read-only capture is
`tracking/evidence/m03/live-capture/2026-10-29T11-01-07-492677+00-00-8b2e0587.json`.
Its observer result is `captured`; the actual job
`3a535387-bc1a-4e31-9bb4-34369d758238` failed first-attempt `prepare_candidate`
with `SOURCE_UNREADABLE`. The first outbox delivery and failed callback are
retained. No preparation, provider metadata, transcript, facts or media were
committed. The original remains unverified with uploading status; no Ready/SHA/
duration success is inferred. Protected M02 job/spec/note checkpoints matched.

Capture receipts contain IDs, hashes, technical counts/booleans and constrained
enum/model/version identifiers. They exclude filenames, names, supplied facts,
original transcript text, provider bodies and raw diagnostics. Database metadata
retains only the last n8n execution ID, and native image identity comes from the
separate activation/launch evidence. Capture does not establish semantic accuracy,
media-byte verification or complete provider billing. Failed cases remain in
later captures rather than being replaced by a successful run.
