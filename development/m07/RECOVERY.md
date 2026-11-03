# M07 isolated recovery rehearsal

## Current recovery boundary - 2026-11-03

This section governs current evidence and restrictions. All dated local28/29/38
material and commands below are retained history, not commands to replay against
canonical42 or a different runtime. The [current handoff](../../tracking/HANDOFF.md)
and [operations runbook](../../docs/operations/DEPLOYMENT_AND_RUNBOOK.md) own next
operational actions; this file does not mark full M07 verified.

### Accepted AT070 scope

[Independent synthetic39 restore4c302b36](../../tracking/evidence/m07/independent-recovery39/2026-11-02T01-05-56.716Z-4c302b36.json)
and its [Root admission](../../tracking/evidence/m07/independent-recovery39/Root-admission-4c302b36.json)
passed with distinct PostgreSQL system identifiers,17853 restored catalogue
fields and four actual local Storage/PostgREST HTTP byte/hash roundtrips. The
normal-created synthetic project, membership, intent, audit and idempotency
records were restored. All eight owned resources were absent afterward; the
original local history29 database and existing global roles were preserved.
The retained independent38 proof carries its own scope without being rerun.

This is actual scoped nonproduction recovery acceptance. It is not a restore of
private production data/secrets/configuration, deployed n8n/worker state, current
native3d or schema42; no RTO/RPO is established. Those unclaimed extensions do not
create new acceptance gates beyond the agreed pack. Existing local-cluster,
filesystem-object and later independent-HTTP proofs remain distinct.

### Current production checkpoints are not restore proof

Canonical42's [normal compact apply](../../tracking/evidence/m07/presentation-generation-compact-release/2026-11-03T13-18-27-651163Z-apply.json)
and [Root audit](../../tracking/evidence/m07/presentation-generation-compact-release/Root-2244e718-postapply-audit.json)
prove the genuine nonce/two reads, all76 full row multisets including audit
reasons, exact seven prosrc changes and unchanged attributes/OIDs/ACLs/fixed
functions/non-target catalogue/roles/policies/dependencies. The
[owned compact collector144](../../tracking/evidence/m07/presentation-generation-compact-collector-proof/144d063a-outcome.json)
adds290 source pairs, seven same-RR old/compact state equalities, negative
preimage refusal, diagnostic rollback, normal nonce and owned cleanup. Its clone
rollback and protected before/after checkpoints are not hosted backup restoration.

Current web is Ready4gdh/selectedMain514 with1030-test Root quality; workerFxd and
native3d are unchanged. The [new web readback](../../tracking/evidence/m07/presentation-pdf-metadata-web-forward-release/2026-11-03T14-44-32-244101Z-b5e29aa2-7f3e-4a7a-8fe2-e1246a0ab705-readback.json)
and [scoped metadata/UI proof](../../tracking/evidence/m07/completion-release/Root-4gdh-production-metadata-and-UI.json)
are deployment/read acceptance, not rollback, worker replacement or recovery.
Existing-Claude metadata confirmation and AT060's real200 representative workload
remain open: no authorized representative corpus has been identified; owner
availability reply pending. Narrator,
contributor and mobile remain skipped, not passed. Full M07 remains false.

### No replay or rollback workaround

AT069 rollback-transport source preparation was rejected by automatic approval
review with the exact recorded reason **blocked by policy** and no further
reason. Do not retry the rejected action, use a manual/equivalent transport or
perform a provider operation as its substitute. The retained
[worker replacement plan](WORKER_REPLACEMENT69.md) and partial sources are not an
executable rollback authorization. Later ordinary forward releases and normal
worker resume do not satisfy queued replacement/compatible rollback acceptance.

Consumed run IDs, claims, source pins and first errors stay immutable. Preserve
unknown returns as unknown and reconcile only through the authorized read-only
path before any separately authorized unattempted work. Both HTTP413 attempts
were reconciled not applied; old web38 was refused before deploy claim/submission.
Neither is repaired or replayed by the fresh b5e29 release. Do not remove another
run's shared test-db lock, reset the original local database, or adapt a local
restore command to a cloud target. Protect raw backup/checkpoint/log payloads
with the existing current-user/SYSTEM guard; publish only safe evidence metadata.

## Retained local38,29 and28 recovery history

## Current local38 proof - 2026-11-01

Run639da33a passed actual owned local38 metadata/four-object/native PDF-video
restore and full cleanup in149474ms (20:19:31.495Z-20:22:00.969Z).
[Actual receipt](../../tracking/evidence/m07/recovery38/2026-11-01T20-19-31-495Z-639da33a.json), [Root source/cleanup admission](../../tracking/evidence/m07/recovery38/2026-11-01T20-24-11-582932Z-Root-admission.json).
All385 current source hashes plus2 API provenance hashes match.373 source entries
restore;12 installed descriptors and2 API provenance entries are excluded. The
72-file native graph includes job-filters. Historical37/365 inputs remain separate.
Both temporary databases,trace/new33 roles and test container were removed; full
original29/Auth-Storage/profile/settings/globalroles/sessions/lock preservation
passed. English immutability, authenticated null/empty batch parity, backup
corruption refusals, real native PDF/video and controlled recovery fences passed.
The media engine remains pinned ea6e; no hosted50082/full web/dependency install/
StorageHTTP/independent/secrets/configuration/RTO/RPO restoration is claimed.
The six new recovery38 sources are now armed/executed and held exact. Run claim
639da33a is consumed; never replay its prepare/execute. Prior disabled instructions
describe source preparation. Current handoff governs actual execution status.


## Current history29 proof

[The current bda68ef0 rehearsal](../../tracking/evidence/m07/recovery29/2026-10-30T12-25-42-320Z-bda68ef0.json) restores29migrations,4exact synthetic objects and71critical sources, with all16430raw catalogue fields, Settings/MCP/permissions and stale lease/callback fences. Both owned DBs are actually absent; original29and all existing global role OIDs/attributes/memberships remain unchanged. Elapsed107525ms is not RTO/RPO. [The new guarded controller](recovery29/run.mjs) is separate from the frozen28runner; do not run the historical command below against29. Exact8observed dump-profile corrections apply only inside marked/OID-owned clones; raw observations, semantic/parser proofs, guard fixes and earlier refusals remain under `tracking/evidence/m07/recovery29/`. No StorageHTTP/deployed/secret/independent-cluster restore is established.

## Historical history28 rehearsal - retained


This is an AT-070 **synthetic local PostgreSQL plus filesystem-object** rehearsal.
It does not restore Supabase Storage through HTTP, publish workflows, restore
provider credentials, restart deployed services, or establish production recovery.
Hosting remains deferred.

## Ownership and execution

Run from the repository root with the installed Node24/tsx dependencies:

```powershell
node --test tests/operations/m07-recovery-bundle.test.mjs
node --import tsx tools/test-m07-recovery-local.mjs
```

The runner takes `.local/local-postgres/test-db.lock` exclusively. It verifies
the existing owned container, image, labels, volume, local engine and loopback
binding through `tools/local-postgres.mjs`, requires system identifier
`7701520506262638626`, history28 and an empty local Auth/business/key baseline.
It creates two UUID-named databases through `template1`, using the existing
cluster roles. It never resets, seeds, or adds business rows to `postgres`.

Every disposable database operation checks its exact name, owner, ownership
comment and recorded OID. Cleanup refuses active sessions and drops only those
checked databases. The synthetic FFmpeg container has a run label and pinned
image; cleanup checks its label/image/finished state before removal. The
original local database table-row, function and grant digests must match before
the exact run-owned shared lock is removed. Failure receipts remain preserved.
If ownership, identity or cleanup cannot be proved, the runner leaves a blocker
and never broadens deletion or removes another run's lock.

The artifact directory `.local/m07-recovery/<run-id>/` is restricted to the
current Windows user and SYSTEM before artifact creation. Raw diagnostic output
is retained only if that ACL check succeeds. Metadata dumps and native PDFs can
contain synthetic lease/grant capabilities, so they stay outside source control.
Public receipts expose safe hashes, measurements and booleans only.

## What participates

The source database is restored from the schema-filtered dump of the guarded
empty local baseline. Existing synthetic M04/M05 fixtures supply central
projects, principals, capabilities, library candidates and assignments. An
actual two-second FFmpeg test-pattern MP4 is bound to one candidate reused in
two slots. Layout preflight is explicitly fixture-injected; subsequent native
render and PDF validation run normally.

Actual `executePresentationStage` calls prepare, render, validate and publish an
immutable version using real SQL stage leases, callbacks, output reservations
and output completion. `executePresentationExportStage` mints a real scoped
synthetic grant and renders/validates the guest access variant. SQL ports and an
in-memory/filesystem object transport replace Supabase Storage HTTP. No OpenAI,
n8n endpoint or real personal material participates.

The source metadata dump and its referenced original MP4, canonical manifest,
canonical PDF and guest export PDF are separate backup artifacts. Every asset
has its own ID, bucket/key, exact size and SHA256. Template registry, renderer,
brand/font bytes, migrations and selected workflow source definitions are
separate source entries. Restoring source bytes does not prove deployed workflow
or runtime configuration restoration.

## Acceptance and limits

The runner restores into a second empty disposable database and a fresh
filesystem destination, verifies exact metadata and referenced object bytes,
and compares functions/owners/grants, RLS policies and constraints. It repeats
authorized fixed-video/export reads, unauthorized actor denial and anonymous
direct-table denial, independently parses the restored PDF and probes the
restored MP4. Saved-backup corruption and missing-object checks fail closed.

A committed outbox lease and a separate running presentation stage are backed
up. Controlled timestamps expire them after restore. The outbox is reclaimed
under a fresh token and rejects the old acknowledgement. Job recovery queues
the incomplete stage; the old stage callback returns `stale:true` and
`applied:false`. The earlier ready version and PDF remain unchanged. This is
controlled lease recovery, not an OS crash or power-loss test.

Local elapsed time covers the rehearsal only. It is neither an agreed RTO/RPO,
representative 200-video capacity, real provider processing cost, endurance, nor
staging/production acceptance. The two databases share existing local roles and
one pinned cluster; independent-cluster/secret restoration remains unverified.
AT-068 and deployed portions of AT-069/AT-070 remain open.

## Evidence

The completed local rehearsal is
[`0749c0ee`](../../tracking/evidence/m07/recovery/2026-10-30T10-39-24-955Z-0749c0ee.json):
**Passed**, started `2026-10-30T10:39:24.955Z`, elapsed **103994 ms**.
It restored four referenced objects and 52 source entries with 28 migrations.
The restored canonical PDF validates 8 pages, 168 text regions, two fixed-video
links and three embedded fonts; no candidate images were selected. The original
two-second 160×90 H264 MP4 remains byte-identical and decodes after restoration.
All disposable databases and the synthetic FFmpeg container were removed,
the original local baseline remained identical, and the shared lock was released.
This is a history28 result; do not reinterpret it as a history29 or cloud test.

Receipts are written under `tracking/evidence/m07/recovery/`, including failed
attempts. Protected backup/restored bytes remain under the run's `.local/`
directory for independent inspection. Root tracking documents own the final
milestone status; this file does not declare M07 verified.

Initial pure bundle RED was an absent module. After implementation, seven
focused cases passed: successful exact restoration; missing source object;
checksum mismatch; saved-backup tampering; path traversal/duplicate identities;
ownership mismatch; and modified-manifest file identity. The initial ownership
test was corrected to mutate the actual owner marker rather than selecting a
different run-root pair (which correctly triggered the earlier root guard).

Historical harness refusals are retained: read-only PostgreSQL rejected a
temporary table before any disposable database existed; a DTO envelope assertion
was corrected from `id` to `asset.id`; and the domain rejected a claim key reused
across two jobs until the harness included `job_id`. Those are rehearsal defects,
not new application fixes or production recovery results.

| Historical receipt | Result and scope |
| --- | --- |
| [`e5640356`](../../tracking/evidence/m07/recovery/2026-10-30T10-35-27-351Z-e5640356.json) | Refused before task database creation: temporary-table observer in read-only transaction. Its exact dead-run lock was subsequently released only after verifying no task databases and the unchanged empty local baseline. |
| [`f8f21eba`](../../tracking/evidence/m07/recovery/2026-10-30T10-36-08-619Z-f8f21eba.json) | Actual native presentation/export stages committed; harness DTO assertion failed. Exact task cleanup, original baseline and lock release passed. |
| [`ee3fc9bd`](../../tracking/evidence/m07/recovery/2026-10-30T10-37-59-688Z-ee3fc9bd.json) | Domain correctly refused a stage claim key reused across different jobs. Exact task cleanup, original baseline and lock release passed. |
