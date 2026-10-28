# n8n Cloud workflow specification

**Deliverable status:** executable workflow definitions must be built and exported during their owning milestones. The files here are precise implementation instructions, not fabricated n8n exports tied to unknown credential IDs. Existing n8n Cloud is the required orchestration environment.

## Service boundary

The app’s domain service and Supabase hold durable job truth, permissions, versions and casting rules. n8n coordinates stages. A native worker runs FFmpeg/ffprobe, document conversion, frame extraction, OpenAI SDK adapters and browser-based PDF rendering. Worker tasks may be asynchronous; n8n never needs to hold a video or a PDF as a giant JSON/base64 item.

The Execute Command node is unavailable on n8n Cloud, so shell/media rendering belongs in the separate worker. [Official n8n Execute Command documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executecommand), checked 2026-10-27. Use authenticated production webhooks; n8n distinguishes test and production URLs. [Official n8n Webhook documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook), checked 2026-10-27.

## Workflow inventory

| ID | Source spec | Trigger | Owning milestone |
| --- | --- | --- | --- |
| WF-01 | `WF-01-SPECS.md` | `specs_extract` job ready for stage | M02 |
| WF-02 | `WF-02-CANDIDATE-SCAN.md` | `candidate_scan` / `frame_extract` job ready for stage | M03 |
| WF-03 | `WF-03-PRESENTATION-AND-EXPORT.md` | `presentation_render` / `presentation_export` job ready for stage | M05/M06 |
| WF-04 | `WF-04-RECOVERY-AND-MAINTENANCE.md` | Dispatch schedule, failed/expired lease, operational retry | M02 foundation, complete M07 |
| WF-05 | `WF-05-CONTEXTUAL-AI.md` | `ai_suggestion` job ready for stage | M04 |

Each workflow export must include its contract version, node version compatibility, environment-variable/credential references, test payload and README. Store redacted exports in `n8n/workflows/`; never commit credential secrets or live webhook signing keys. Credentials belong in n8n’s credential store and server/worker secret management. Shared service identity is distinct from a user/Claude token.

## Durable dispatch pattern

1. A user/API operation validates permission and commits a job plus an `outbox_events` row in the same transaction. This includes initial upload completion, generation, export preparation and retry.
2. A dispatcher claims a bounded number of pending outbox rows with leases. It posts small event envelopes to authenticated n8n production webhook URLs. An application scheduler/worker process owns this dispatch so a lost initial n8n trigger is recoverable.
3. n8n validates the route/event shape and calls `claim_job_stage`. The backend checks allowed next stage, active lease, job input fingerprint and cancellation state. A duplicate trigger returns already-in-progress/completed status, without repeating work.
4. n8n submits a typed worker task using storage references and scoped access. Worker HTTP returns accepted task ID quickly; computation continues outside request timeouts. Do not block the UI or n8n webhook response waiting for an entire batch.
5. Worker/processing adapter sends authenticated heartbeat/progress/completion to the application’s internal callback. The backend validates result schema and active stage lease, commits durable result references and the next-stage outbox event. n8n receives the next ready event and continues its stage graph.
6. Application UI/API/MCP reads only the durable job state, independently of n8n execution retention. n8n execution IDs are diagnostics, not user-visible source of truth.

A chosen implementation may use an n8n Wait/resume step, provided wake-up identity/authentication and crash recovery are demonstrated. The short event-driven stage pattern above is the default because it keeps retries and replay independent of one long workflow execution.

## Common event envelope

```json
{
  "event_id": "opaque-outbox-event-id",
  "event_type": "job.stage_ready",
  "contract_version": "1.0",
  "job_id": "opaque-job-id",
  "kind": "candidate_scan",
  "stage": "probe_media",
  "input_hash": "sha256-of-canonical-input-and-configuration",
  "correlation_id": "opaque-request-id"
}
```

No source bytes, reviewer token, grant token, credentials or full transcript belong in this envelope. The backend resolves authorized input when the service claims the job. Allowlist callback destinations in service configuration; an uploaded document cannot supply a callback URL.

Stage lease response includes job/stage/attempt ID, lease token, expiry and permitted input references. The lease token is a credential and must be masked in node execution data. Completion contains `event_id`, `job_id`, `attempt_id`, `lease_token`, `stage`, monotonically increasing `sequence`, `input_hash`, `result_schema` and typed result. `contracts/json-schema/job-event.schema.json` defines the envelope. Each kind’s schema validates the actual result. File results carry storage asset IDs and checksums, not raw byte payloads. The worker calls `reserve_job_output` for each derivative using its current lease, expected type/size and source reference; the server allocates an immutable object key and scoped upload session. After transfer, `complete_job_output` verifies bytes and marks the asset ready. Only ready assets reserved for that job/stage may appear in completion. `get_job_asset_access` refreshes short-lived input/output access only for allowlisted assets belonging to the current lease. It is not an arbitrary Storage signer.

## Concurrency and retry defaults

Initial defaults are tunable implementation choices: 4 active candidate scans, 2 media-heavy worker tasks and 2 PDF renders per worker deployment, bounded further by actual OpenAI/account/hosting quotas. These are starting values for load testing, not guaranteed capacity. Dispatch 200-file batches gradually; each file has its own job and stage progress.

Transient provider/network failures: up to 3 attempts at a stage with exponential backoff and jitter, honoring provider retry hints. Input corruption, unsupported type and schema/domain validation failures are terminal for that input until corrected. Do not multiply retries independently in SDK, HTTP client, n8n node and backend; the application owns the effective retry budget and records attempt counts.

Cancellation stops future stages immediately and invalidates active result application. Best-effort cancellation of the provider/worker saves resources where supported. A late successful response to a cancelled/stale attempt may be retained as a temporary orphan for cleanup, but cannot alter the current profile/workspace/version.

## Required workflow evidence

For each workflow, provide a local/staging execution with correlation IDs, redacted execution result, database job transitions, produced artifact IDs, cost/usage metadata when applicable, one retry/replay demonstration and the corresponding UI result. A workflow JSON import success is not end-to-end validation. Do not mark a production integration completed when it ran only mocked service calls.
