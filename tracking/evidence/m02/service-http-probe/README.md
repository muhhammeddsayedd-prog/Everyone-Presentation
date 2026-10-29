# Actual local job-service HTTP acceptance

Root created isolated job `1515e047-9108-4069-a951-71aeec9fc554` through the
signed-in app in the separate Dummy Reuse Test workspace. The worker was stopped
before enqueue; no new Auth identity was created. The protected original job
`b3f90268-147d-41d4-8875-2a6435df1496` was never a probe target.

The first attempt was setup only: a schema-valid textual event ID was rejected
by the real narrow runtime, which requires UUIDs. Its partial/expired receipts
and [executed source](../../../../development/m02/service-http-probe-before-uuid-fix/probe-job-service-http.mjs)
remain retained. It receives no callback/restart acceptance credit.

A fresh probe identity and stable claim key acquired the next allowed attempt.
[Phase1](2026-10-29T09-23-14-759Z-1c4f9f3d-phase1.json) passed wrong dedicated
credential denial, exact same-key lease replay, changed-body rejection, wrong
lease denial, different nonexistent-job denial, heartbeat and duplicate handling.
Root restarted the verified owned web process. [Phase2](2026-10-29T09-24-08-943Z-1c4f9f3d-phase2.json)
replayed the exact original lease before its original09:24:40expiry. A deliberate
[retryable failure](2026-10-29T09-24-11-240Z-1c4f9f3d-fail.json) then queued
recovery. This tool made no provider, n8n, direct SQL or Auth-token call.

Root resumed the actual owned worker. [Canonical recovery proof](2026-10-29T09-30-49Z-real-recovery.json)
records all three completed stages, n8n execution31291, actual OpenAI2233tokens,
one stored heartbeat, one deliberate failure and successful later outbox
delivery. Unknown fields and Arabic original survived; the protected older
manual correction still waits intentionally. The screenshot/AX under `browser/`
show the recovered app state.

Raw lease state is authenticated-encrypted under ignored `.local/`, using the
existing private claim encryption key. The probe reads only dedicated service
configuration through `tools/private-job-service-env.mjs`; it never exports a
user JWT, service-role credential or database/provider key. Offline tests verify
the fixed isolated-target restrictions and encrypted-state tamper rejection.
