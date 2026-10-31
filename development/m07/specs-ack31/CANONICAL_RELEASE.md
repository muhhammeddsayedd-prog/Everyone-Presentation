# Canonical31 controller preparation

The [actual disposable-clone proof](../../../tracking/evidence/m07/specs-ack31/2026-10-31T01-22-16-662Z-dc886d4e-local-proof.json)
passed the real-role SQL RED/GREEN checks, DDL/history failure rollbacks, narrow
ACL readbacks, exact original29 preservation and owned database/role cleanup.
Its receipt SHA256 is
`022423cabe5fa8bbb63207714a919d03c61649c3bfc588ddce95d4dc5f46f3fb`.
This is local SQL evidence; canonical31 application and hosted submission
success remain pending.

`canonical-plan.json` binds that actual proof and the reviewed source plan.
`canonical-release.py` checks the fixed central project, exact 31 local source
files with canonical history still30, config/seeds settings, all proof sources,
49 expected function bodies, the private issuer hook, ACK owner/ACL/metadata,
the 12-operation runtime, hosted future origin and the adopted native pin.
No credential loader or CLI call is reached without the passed proof.

The fresh query derives from the sealed issuer30 discovery query, with a new
result alias and nonsecret future-origin/native-pin/whole-Settings fingerprints.
It retains the reviewed credential-column exclusions and managed-Auth counts.
Admission requires no queued/running jobs or leased outbox rows. Root should
finish the current generation and serialize its own business writes through
the short release/readback window. No prior historical data snapshot is used
as the current baseline.

Root entrypoints after independent source review:

```powershell
python -X utf8 development/m07/specs-ack31/canonical-release.py inspect
python -X utf8 development/m07/specs-ack31/canonical-release.py dry-run
python -X utf8 development/m07/specs-ack31/canonical-release.py apply
python -X utf8 development/m07/specs-ack31/canonical-release.py readback
```

Inspect is read-only. Dry-run additionally requires the pinned CLI's actual
pending-migration plan to contain only the coordinated31 filename. Apply takes
an exclusive fsynced claim before its sole dispatch. One transaction locks the
selected data and history, compares a fresh full selected baseline, replaces
only the private ACK body, inserts31 history, checks the permitted delta and
commits. A bound normal-return marker and two independent reads follow.

The only permitted application changes are the ACK source hash and appended
history31. Existing ACLs, role identities, other function metadata, data,
Settings, ready versions, runtime and protected M02 facts must match. The
CLI-managed `cli_login_postgres` expiry may advance monotonically to a bounded
short future deadline; raw before/after values are retained as an explicit
qualification. No other role attribute is normalized.

Unknown dispatch outcomes retain the claim and support readback only. Readback
requires the original claim/baseline and never retries a write. A missing
baseline cannot establish application or preservation. The helper performs no
dispatch retry; the CLI's internal retry behavior is explicitly uncharacterized.
The transaction's history30/predecessor guards refuse another application
after31 exists. Reports distinguish normal return from application established
by independent readback; later OAuth admission also requires normal return.
Overall `passed` requires the claim-bound normal-return marker as well as both
preserving reads. A verified database observation with an unknown process
return remains `unconfirmed` and cannot activate OAuth.

The private directory's Owner/SYSTEM DACL is written only on its successful
creation path. Later invocations read and verify the exact protected owner,
two FullControl rules, child-inheritance flags and absence of other rules;
they never rewrite its ACL or request audit/SACL privileges.

Public receipts contain closed summaries and source pins. Selected baseline
metadata remains in the Owner/SYSTEM-only local claim; raw CLI diagnostics,
credential values and private source/media are not copied to public evidence.
The controller changes no provider settings, client registration, permission
grant, production fixture, worker image or historical release helper.

Thirteen focused pure tests passed, including a genuine local-proof binding RED
and transaction-renderer missing-module RED. SQL and PL/pgSQL parser checks
cover the rendered transaction; those checks do not substitute for root's
canonical execution/readback.
