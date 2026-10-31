# Protected M02 frame continuation

The original frame31 inspection correctly refused an active count of one. That
row is the unchanged protected M02 job. This separate operator leaves the old
frame sources and completed worker adoption `96e255e2`/`f05de2c3` unchanged.

The source-pinned read-only baseline is
`2026-10-31-frame-protected31-baseline.json`: exact job
`b3f90268-147d-41d4-8875-2a6435df1496`, `specs_extract`, `waiting_for_input`,
`apply_specs`, attempt3/revision7, selected-row digest `7b875c1f`, unchanged
protected spec digest `2344eaa9` and retained manual instruction.

The new SQL admits only that exact digest/spec-bound historical row. It records
total active jobs1, protected matching jobs1 and other queued/running/waiting
jobs0, with leased outbox0. A changed/missing protected row, changed spec or any
other active job refuses the update. Every job/outbox, Settings, candidate/media,
Ready-version and protected M02 fingerprint is compared before/after under the
same locks. The only DML remains one future `native_image_id` update. No job is
rewritten, retried, cancelled or made runnable.

Root prepares the existing new folder
`.local/m07-pilot/future-frame-protected31` with exact protected current-owner
and SYSTEM FullControl using DACL-only access-section operations. The operator
only verifies that ACL; it never creates private directories or writes ACLs.

After independent source review, root runs the commands separately and examines
each closed receipt:

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/controlled-pilot/future-frame-protected31.py inspect
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/controlled-pilot/future-frame-protected31.py apply
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/controlled-pilot/future-frame-protected31.py readback
```

This family has its own permanent claim and return marker. Unknown dispatches
permit readback only; never replay apply or remove claims. Passing requires the
original baseline, claim-bound process return and two preserving readbacks.
The existing actual canonical31/native/import proofs remain required. No actual
frame adoption, deployment, hosted core or OAuth acceptance follows from these
source-only checks. Mobile remains skipped; AT072/M03 acceptance remains pending.
