# Canonical36 release and future-attempt audit

Source preparation only. Canonical36 is **unapplied**. `APPLY_ENABLED` and
`RECOVERY_ENABLED` start false. The owned7cff SQL proof passed with full cleanup;
the separate new catalogue/schema/atomic-query proof must also pass before root
can enable this operator. No author/reviewer network, CLI, SQL, provider,
deployment, credential or process-control action occurs through these tests.

`20261101012057_m07_job_attempt_observability.sql` changes only the proved
candidate's admission/header. All functional bytes from CREATE ROLE through its
last comment match candidate SHA `dc4eec586a3ae0fc9722a70ca6229742971eb21279916c32ab47cea4a802ed3b`.
The production header requires exact35 history, absent trace objects/role,
the exact current Summary body and unchanged protected M02 source identity.
No old job, source, candidate, Ready version, workflow, hook, auth or processing
configuration is changed or backfilled. Historical31686 stays unreconstructed.

## Evidence and separate freezes

The original SQL pass is run7cff5c7d with receipt SHA
`fc7742e874e0c10f11312f798a991c884515db507377a571a831f8f6586c0b51`.
Its185 executed source seals and cleanup remain exact. Query core `state.py`,
`schema_gate.py`, `catalogue_delta.py`, `proposal.py` and this migration are the
separately frozen213-input query closure used by the new owned gate proof.
The entrypoint/flags, this README, live observer and public admission reference
are a later release freeze; they do not alter or replay either owned proof.

Root creates `admission.json` from `admission.template.json` only after the new
actual gate run and cleanup pass. It names that actual immutable receipt and
SHA. The entrypoint reads its admitted schema template and claim-port metadata
from the receipt itself; it never accepts a hand-authored or unit-test schema
as provider evidence. It requires normal/negative/disable/restoration checks,
production history36 parity, full cleanup and current source equality.

## Metadata and permissions

Inspection targets only `pyibofyctwnqpvktepse` through the existing linked CLI
2.122.0, explicit project ref/workdir and hash-checked bounded reader. Windows
private files reuse the verified current-user/SYSTEM-only helper. No environment
file, service-role credential, private video, transcript or model payload is
opened or logged. Receipts contain metadata, row counts and server-side hashes.

Both preflight observations must match before a fresh protected plan is saved.
It requires history35, English1.0/helper security, the known protected M02
identity/integrity, no other active jobs or leased outbox work, current Summary
and review-owner rights, all74 old table hashes, full OAuth metadata, exact
current claim/replay/callback/retry-port bodies/ACLs and zero unsupported legacy
metadata rows. The latter query returns aggregate counts only. All seven job
kinds keep their existing claim functions and manual retry semantics.

The managed CLI expiry exception remains exactly OID17603/name
`cli_login_postgres`/`rolvaliduntil` only. Its safe attributes and finite future
validity within ten minutes are checked independently; this is an admission
bound, not a provider TTL guarantee. No expiry, credential or role is altered.

The old catalogue fingerprint excludes only the exact new identity closure.
The new FK adds two RI triggers on existing `eps.jobs`; its user trigger and
FK can change `jobs.relhastriggers`. Only that flag and the named new role's
direct EPS USAGE ACL are normalized, with separate exact delta checks. Every
old jobs trigger remains fingerprinted. New table/types/indexes/constraints/
attrs/policy/function/role/memberships and all four FK RI triggers receive a
closed gate. Unknown grants, PUBLIC function execution, wrong bodies or extra
privileges refuse installation. PG17's finite local/cloud creator-membership
variants are explicit. No broad jobs/schema/trigger exclusion is used.

## One apply, then readback

After actual owned gate proof and root source review, finalize enablement and
all source/admission bytes **before** inspection. Do not change them after a
plan or claim exists. The joint release freeze includes `live_observer.py`, its
tests and audit plan: root arms both the apply flag and observer `ENTRY_ENABLED`
before that freeze, leaving recovery disabled. The observer's separate actual
passed apply plus Ready readback requirement prevents it from running early on35.
Root commands are documented here, not executed by the
author and not an additional owner approval request:

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B -m unittest discover -s development/m07/job-attempt-observability36-release -p "test_*.py"
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/job-attempt-observability36-release/release.py inspect
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/job-attempt-observability36-release/release.py apply
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/job-attempt-observability36-release/release.py readback
```

Apply retains an exclusive claim before dispatch. One repeatable-read
transaction locks history and all74 old business tables, rechecks the exact
snapshot, runs the unchanged functional DDL, inserts normal history36 and checks
the full expected delta **before commit**. The scalar predicate is required
`IS TRUE` via `IF (...) IS NOT TRUE THEN RAISE`, so NULL never admits a commit.
Only the new empty trace, narrow new role/grants/function/trigger/FK and history
row are permitted. Old74 data, full OAuth, English, M02, old catalogue and old
permissions stay exact inside that transaction and immediate two readbacks.

Timeout, output overflow, missing normal return or mismatched readback is
unconfirmed. Keep the claim; use readback only and never replay apply. Known
fixed failure-stage codes are allowlisted; raw CLI output and arbitrary errors
are not persisted. A later `observed_applied` readback can confirm static current
installation while jobs, feedback, memberships and OAuth claim counts move. It
does not invent an original normal-return PASS. Ten configuration tables,
schema/RLS/roles, static OAuth, source ports, English and M02 stay bound. No old
capability or membership rows are restored to make a web check pass.

## Bounded forward fix

If a confirmed new capture invariant blocks a legitimate claim, the reviewed
recovery path can disable only `capture_job_stage_attempt` on `eps.jobs` under
its own exclusive claim. It requires exact36 history, expected trigger/function/
role/schema/source and current acting integration metadata. It locks and
preserves the current full snapshot, then verifies only that user trigger's
mode changed O→D before commit; all FK RI triggers remain O. Active blocked
jobs may exist during this recovery, so it preserves them rather than requiring
their removal. There is no DROP, reset, fake callback, old-history rollback,
job retry or re-enable operation. Disabling capture explicitly leaves future
trace acceptance pending.

Root enables `RECOVERY_ENABLED` only for that reviewed concrete recovery, then
uses `disable-capture` once. An uncertain return is reconciled with the separate
`readback-disable`; it never repeats the disable action or infers a return.

## Real acceptance remains separate

Follow [the live audit plan](LIVE_AUDIT_PLAN.md): one successful authorized
nonprotected job and one clearly synthetic corrupt-video failure through the
normal scoped upload/worker path, then a bounded metadata audit of the actual
two IDs. No artificial callback, global setting change or node-payload retention
is needed. Preserve Reviewed facts and old Ready/raw/English/PDF hashes; those
live checks are separate from local fixtures and source tests. Claude's initial
authorization/reconnect/project-read and later Summary read stay accepted.
Pilot stays running, screen-reader acceptance pending, mobile testing skipped.
