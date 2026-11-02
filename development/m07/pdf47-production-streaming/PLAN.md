# Bounded specs streaming: source audit and implementation boundary

Source-only plan,2026-11-02. No provider/job retry, workflow edit, database
operation, build or deployment is authorized by this file. The independent32k
diagnostic3289384d completed at129,488ms and validated39 roles/96 evidence items/
23 clarifications. Its private output was not applied; factual quality and actual
job acceptance remain unverified. Earlier failures and unknown costs stay intact.

## Current boundaries

| Boundary | Actual source/function | Limit and implication |
| --- | --- | --- |
| Adapter admission | `packages/integrations/src/openai-specs.ts`, `checkedConfig` | Legacy60s default/70s cap,16,384 default/32,768 maximum. Preserve these semantics for existing config and injected receivers. |
| Actual daemon config | `apps/worker/src/runtime-main.ts`, `verifySpecsWorkerStartup` | Currently calls key/model-only `openAISpecsConfigFromEnv`. A separate explicit bounded-stream factory will select low/32,768/300s for specs only. Other provider configs stay unchanged. |
| Input and result validation | `openai-specs.ts`, `validateInput`/`parseResponse` | Source JSON<=2,000,000B,<=10,000 paragraphs; one final structured text<=4,000,000B, then the existing strict schema/evidence validator. No prompt/schema/truncation change. |
| Stage execution | `apps/worker/src/specs-executor.ts`, `executeSpecsStage` | Serialized heartbeat every20s; each gateway request<=15s. Heartbeat failure/stale receipt aborts extraction. No total stage deadline wraps the model. |
| Durable lease | `20261029001520_m02_specs_assets.sql`, claim/`record_job_event` |90s initial lease; each successful heartbeat renews90s. Healthy20s+<=15s callbacks support a130s/300s request without extending the lease or attempt count. A lost heartbeat remains an abort/recovery event. |
| Completion size | Same SQL `record_job_event`, `specs_stage_metadata` | Complete event<=294,912B; result body<=262,144B. Exact existing metadata key set; no new fields.32k is not permission to exceed these limits. |
| Runtime callback | `packages/central/src/specs-runtime-gateway.ts`, `recordEvent`/`execute`/`safeJson` | Direct parameterized PostgreSQL, not web/n8n. Client JSON<=294,912B, depth32/nodes100,000; statement8s/lock2s/query10s/idle transaction10s, pool2. The provider wait is outside the SQL transaction. |
| n8n | `apps/worker/src/n8n-orchestrator.ts`, `route`; `n8n/eps-wf01-specs-stage.json` | Router10s default/30s max, response<=16,384B; workflow execution30s. Only metadata Webhook/Set/Respond. It returns the work order before claim, outbox ACK and actual extraction. No workflow timeout change is needed for the later request. |
| Dispatch/recovery | `apps/worker/src/runtime.ts`, `runSpecsWorkerOnce`/`runSpecsWorker` | Claim/ACK precede execution; stage is awaited serially. Poll3s/recovery30s are scheduling intervals. Another live claimant gets JOB_ALREADY_RUNNING; durable attempt budget remains3. No new SDK/attempt retry path. |
| Hosted lifetime | `runtime-hosted.ts`/`runtime-main.ts` | Production has no pilot timer. Existing stop/disconnect/SIGTERM signals abort the stage. Daemon termination grace300s is an upper shutdown allowance, not a guaranteed additional provider window. |

The metadata contract is deliberately unchanged: actual header request ID can
populate its existing `request_id` field without manufacturing `_request_id` on
the terminal response. No transport/config metadata is appended to the strict
database result envelope. Reviewed source/config and immutable daemon identity
provide release attribution.

## Minimal source change

Keep `extractSpecs`' shared non-stream request builder and final validator. Add an
explicit `bounded_stream` config admission with a300s whole deadline and a
separate production factory; preserve legacy key/model factory and direct
injected receiver behavior. Only actual `EPS_RELEASE_MODE=production` startup
selects the new specs factory; controlled-pilot/direct startup keeps its profile.
The default SDK transport alone converts the built request to stream:true.

Use installed OpenAI7.45.1, canonical Responses POST, SDK retries0, existing header
isolation, one-dispatch enforcement,8MiB raw-byte cap before SDK decoding and
50,000 parsed events. Keep the deadline active through headers and every SSE
read. Ignore deltas; accept only the received terminal object, then run the same
strict final validation. Never emit raw text/events/errors. Cancellation wins;
timeouts/incomplete/cap/protocol failures remain safe structured errors. A header
ID is metadata, not a fabricated SDK response property.

No lease, retry, grant, schema, source/config fingerprint, n8n workflow or generic
provider change is currently required. These are source conclusions, not a fresh
production settings/heartbeat proof. Actual stage completion and persistence
still require the later reviewed release and one separately authorized job action.

The production-only selector uses the exact key/value already admitted by current
`runtime-hosted-config.ts`: `EPS_RELEASE_MODE=production`, alongside
`APP_ENV=production`. The existing normal
[worker environment receipt](../../../tracking/evidence/m07/completion-worker/2026-11-02T02-02-47-144040Z-rollout39-env.json)
passed that public-mode transition, and the retained
[cutover record](../../../tracking/WORKER_CUTOVER_CURRENT_2026-11-02.md) identifies
the still-serving Cp worker as production. No fresh provider/private-env read was
performed. Startup regression covers production versus controlled-pilot/direct
profiles explicitly.

## Provenance and verification plan

The existing native3d stage provenance has54 native modules (graph247992bb) and90
daemon modules (graph062ebf3a). `openai-specs.ts` is daemon reachable and absent
from native; `runtime-main.ts` and integrations index are also daemon paths.
Recompute the final changed-file closure before release. Keep emitter70158 and
all native/shared build inputs unchanged. New daemon source/compatibility identity
must be truthful; existing strict reuse-native equality can preserve3d only if
the complete native graph/build inputs still match.

Regression cases cover legacy config/injected receiver compatibility, exact
evaluated request body, actual SDK SSE/header ID, deadline before/after headers,
byte/event caps, incomplete/refusal/evidence rejection, cancellation, no retry,
privacy and heartbeat continuation/abort. They were held during owned SQL timing
runs; actual RED/GREEN and focused gates are recorded separately after lock
release. No live provider call belongs in these checks.

Official sources consulted2026-11-02:
[Responses SSE guide](https://developers.openai.com/api/docs/guides/streaming-responses)
and [official Node SDK request IDs/retries/timeouts](https://github.com/openai/openai-node#request-ids).
Installed SDK source is authoritative for this pin: `internal/parse.mjs` sends
streaming responses directly to the SSE parser; `client.mjs` skips the buffered
body timeout path for streams; `core/api-promise.mjs` exposes actual header
`request_id` via `.withResponse()`. Hence the whole-stream deadline must be
application-owned. Source hashes remain pinned in the consumed diagnostic
receipts; no SDK or dependency update is proposed.
