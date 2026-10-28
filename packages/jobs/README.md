# Provider-independent job state machine

This package implements the transaction rules for M02's jobs, sequential stage leases, callbacks, outbox dispatch, retries, cancellation and recovery. It contains **no persistence adapter, scheduler, provider transport or production authentication**. Its only repository implementation is a deterministic fixture under `tests/jobs/`, outside the package exports. It does not create another database or claim M02 acceptance.

`createJobService` requires a `JobRepository`, allowlisted definitions, `authorizeJob`, and `authorizeDispatcher`. There is no permissive authorization fallback. Actors come from a trusted authentication adapter; never build their identity or client type from callback JSON. The dispatcher gate validates the service identity, and each resource action checks its current job/workspace scope inside the transaction. Worker actions require `client_type: service`; user retry/cancel accepts browser/API/MCP acting users under the same authorization hook.

The exported entrypoints are:

- `enqueue(actor, input, idempotencyKey)` and `getJob(actor, jobId)`.
- `claimStage(serviceActor, {job_id, stage, input_hash, workflow_execution_id?})`.
- `recordEvent(serviceActor, event)` using the exact `JobEvent`/`JobEventReceipt` fields from the pack.
- `retryJob(actor, jobId, {row_version}, idempotencyKey)` and `cancelJob(...)`.
- `claimOutbox(serviceActor, limit?)`, `acknowledgeOutbox(serviceActor, id, leaseToken)`, and `failOutbox(...)`.
- `recoverExpired(serviceActor, limit?)` for expired processing leases.

`projectJob(record)` produces the exact public OpenAPI `Job` shape. Internal records contain private scoped inputs, stage results, and lease verifiers: never serialize an internal record directly to an HTTP/MCP client.

## Central repository contract

Implement `JobRepository.transaction` in the discovered **central** PostgreSQL migration history. Use parameterized SQL, bounded lock/statement timeouts, detached read snapshots, row locks and `row_version` compare-and-set updates. The transaction callback commits all writes or rolls all of them back. Database constraints must enforce job dedupe, outbox dedupe, `(job_id,attempt_id,event_id)` and `(job_id,attempt_id,sequence)` uniqueness. Lock-aware list operations use bounded `FOR UPDATE SKIP LOCKED` queries with deterministic ordering. Their exact interfaces and comments are in `src/types.ts`.

Job creation inserts the job before its outbox foreign-key row, within the same transaction. The job's frozen input hash includes validated source/configuration references. Definitions must validate their exact input shape and require model/prompt/schema versions where relevant. Source text, transcript bodies, binary payloads and credentials belong outside job metadata. The state machine rejects obvious credential and raw-source keys, but this is supplementary validation: an integration must still parse against its exact input schema.

`JobRecord` adds explicit per-stage attempt counts, immutable completed-stage results, available time and dispatch generation to the logical pack model. Map those fields to coordinated central tables/JSON as appropriate after discovery. No executable DDL or guessed cloud schema is supplied here.

## Result application and immutable source guards

Each configured stage supplies synchronous `validateResult` and transactional `applyResult`. Schema validation alone is insufficient. The application hook must check output reservation ownership, ready asset metadata, source hashes, current expected source/draft row versions and any resource-specific constraints **using the same transaction**. It receives the repository transaction type, so a central adapter can extend it with narrow domain operations.

Check a changed source/draft **before any mutation**, then return `{waiting_for_input:{code:'INPUT_CHANGED'}}`. That preserves validated output for ordinary review without overwriting producer edits. Any thrown application error rolls back domain writes, event insertion, stage completion and next-stage dispatch together. Do not catch a failed database/domain transaction and commit partial work. The package cannot make an external side effect transactional: callbacks and definitions must perform no network/provider/file writes in this hook.

## Lease and callback behavior

One job has one current stage lease. Claims generate a fresh opaque attempt ID and 256-bit random lease token, increment total and per-stage attempt counters, reset transient progress/sequence state, and store only the token digest. Already-completed stages return their saved result with `already_completed:true` and an empty, inactive lease token. No new processing task is created.

Callbacks check trusted service scope, current attempt/stage, active lease, exact input hash and bounded event shape. Identical recorded events return a duplicate receipt without repeating application. Different content under an event ID or another event under the same attempt sequence is rejected. Late/out-of-order events cannot regress state; obsolete/expired/cancelled attempts receive `stale:true` without applying changes. Heartbeats extend the active lease. The event ledger retains metadata, payload digests and receipts; it does not retain raw lease credentials, raw provider errors or complete callback payloads.

Known transient failures use bounded per-stage retry budgets, exponential jitter and a bounded provider `retry_after_seconds` hint. Input/schema failures are terminal for that input. Unknown error codes become a generic nonretryable processing failure. Error text/details from a provider are not persisted verbatim. Exhausted attempts require an intentional corrected/new operation rather than silently resetting a retry budget. Explicit retry supports retryable failures such as exhausted dispatch delivery, reuses the same durable job/source references, and records a new outbox generation. Previously completed stages remain intact.

## Dispatch and recovery

Claim an outbox lease, commit, send the small authenticated request **outside** the transaction, and acknowledge only after the receiving service accepts it. The outbox lease's secret is a dispatcher credential; never include it in the n8n request payload. A dispatcher crash leaves an expired reclaimable lease. Delivery is at least once, so the receiver must reference the same durable job and call the idempotent/fenced stage operations. An acknowledgement from an older dispatch lease cannot mark a newer delivery accepted.

Obsolete/cancelled dispatch rows become Dead with an explicit reason rather than a fabricated successful delivery. Dead current delivery makes a queued job visibly failed/retryable. `recoverExpired` turns expired processing leases into bounded delayed retries or exhausted failure. A cancelled job immediately invalidates future application; cancellation cannot recall already sent provider requests or downloaded bytes.

## Evidence and remaining integration gates

Run `node --test tests/jobs/jobs.test.ts`, the root typecheck, and ESLint on `packages/jobs tests/jobs`. Tests exercise transaction rollback, concurrent claims/dedupe, permission denial, callback replay/order/fencing, heartbeat and crash recovery, per-stage retry budgets, source-change waiting, invalid results, cancellation, outbox recovery and sequential completion. The memory repository serializes and copies state to model commit/rollback; it is **not** evidence of PostgreSQL isolation, RLS, crash-durable storage or multi-host dispatch.

Still required: mapped central migration/repository, actual runtime roles and RLS tests, durable scheduler/dispatcher binding, real n8n accepted-dispatch receipts, scoped worker output reservation, exact extraction schema/provenance and source-version handlers, provider processing, API/UI integration, restart/replay tests against the persistent central adapter, and live-service acceptance. The package remains independent preparation until those gates are met.
