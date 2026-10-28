# WF-04 — Recovery, dispatch and maintenance

**Milestones:** foundation in M02; release hardening in M07. This workflow prevents lost triggers, duplicate results and permanently stuck processing. Supabase owns the durable state; n8n execution retention is not the job ledger.

## Dispatch loop

A server/worker scheduled process scans eligible pending `outbox_events` with a bounded batch and transactional lease. It delivers small authenticated envelopes to n8n and records acknowledgment. The delivery is at-least-once, so the destination must be idempotent. An HTTP acknowledgment means accepted orchestration, not completed business work.

Retry delivery with increasing delay and jitter; do not remove the outbox row before durable acknowledgment. If the dispatcher crashes after delivery but before recording acknowledgment, the duplicate replay must claim the same completed/running stage and do no extra work. Expose delivery failures and oldest pending age to operators.

## Lease recovery

Workers send progress/heartbeat with current job attempt and sequence. A recovery scan detects expired leases, checks durable result state, and either requeues the incomplete stage or records terminal failure after the retry budget. It never automatically applies an unverified output merely because an object exists in Storage.

Use monotonic attempt/lease identities. A late callback from an expired attempt returns a stale receipt and cannot change current state. Cancellation invalidates the lease and prevents subsequent stages. A retry starts from the first failed/incomplete stage with still-valid inputs; earlier outputs whose checksums/configuration fingerprints match are reused.

## Error classification

| Class | Examples | Recovery |
| --- | --- | --- |
| Transient | Network timeout, provider 429/5xx, temporary worker capacity | Bounded retry; honor retry hints |
| Input | Corrupt video, unreadable document, invalid timestamp | Waiting/manual replacement, no repeated provider calls |
| Permission | User/project scope removed, link revoked | Deny access/application; operator diagnoses intended permissions |
| Contract | Unknown stage/schema, wrong source asset, malformed output | Fail closed; preserve source; fix implementation or manual data |
| Concurrency | Source/profile edited during processing, outdated generation snapshot | Preserve current data; refresh or explicitly retry the intended operation |

`operations.retry` allows the same authorized user/Claude to retry eligible jobs. It does not allow changing a job’s project or input to circumvent access. Operations UI should show stage, safe error message, retryability and correlation ID, not raw provider secrets.

## Cleanup and retention

Use documented environment-specific retention settings rather than inventing a business retention period. Originals, reusable library media and generated versions are business assets; do not delete them as “temporary” merely because a job finished. Retention decisions must account for references from version slides, active PDF exports and library reuse.

Safe cleanup candidates include incomplete expired upload objects, unreferenced derived temporary artifacts, failed-render partial PDFs, revoked unreferenced attempt grants and expired encrypted idempotency response payloads. Confirm zero business references and any configured grace period before deletion. Delete objects through the Storage API; do not treat Storage metadata row deletion as file deletion. Run cleanup as a narrowly scoped service job and audit affected IDs/counts.

Expire guest sessions at the shorter of their own TTL and live parent access; recheck current parent grant on access. Expiry checks are request-time enforcement, not dependent on a daily cleanup having run. Link expiry updates propagate to non-revoked media grants as specified in WF-03. Revocation never requires waiting for a scheduled workflow to become effective for new issuance.

## Operational alerts and evidence

Track queued age, running stage age, expired leases, attempt counts, failed-stage proportions, render failure, callback authentication failure, cost/usage anomalies and storage growth. Initial alert thresholds are deployment settings derived from measured stage behavior; do not invent a latency SLA before representative videos are tested.

Required drills: n8n unreachable during enqueue; worker stops mid-video; server restarts after commit before webhook; duplicate delivery; callback replay; active job cancelled; source updated mid-stage; provider rate limit; rendering finished but upload validation failed. For each drill show job state, retained usable data, bounded repeat billing and successful recovery or clear terminal repair instruction.
