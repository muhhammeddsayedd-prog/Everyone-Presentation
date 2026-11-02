# PDF47 extraction budget source trace

Read-only source inspection. No provider call, job retry, n8n operation, database
query or configuration change was made for this trace. These are checked-in
runtime/SQL/workflow facts, not a fresh observation of hosted settings or proof
of why the previous attempts reached their deadline.

| Boundary | Source-backed budget and ordering |
| --- | --- |
| Embedded extraction | `packages/integrations/src/openai-specs.ts:35`:60,000ms default,16,384 output-token default. The explicit config API accepts at most70,000ms/32,768 tokens; `openAISpecsConfigFromEnv` supplies only key/model, so these optional limits are not environment switches. |
| SDK/request | The pinned OpenAI7.45.1 client receives the same timeout and `maxRetries:0`. One nonstreaming Responses request uses `store:false`, `tools:[]` and the complete strict schema. A matching internal abort deadline combines with external cancellation. Current omitted reasoning effort is unchanged; the optional low-effort evaluation is a separate candidate. |
| Stage callback/heartbeat | `apps/worker/src/specs-executor.ts:148`: heartbeat every20s by default, serialized; each gateway operation has its own15s maximum. Unknown/stale callbacks abort processing. This is not an overall15s model-call deadline. |
| Durable stage lease | `supabase/migrations/20261029001520_m02_specs_assets.sql:1117`: at most3 attempts. A claim gets90s; a successful heartbeat extends90s from its current timestamp (`:1202`). A healthy20s heartbeat permits a60s call without assuming lease expiry. |
| Durable retry | `:1272`: only a retryable failure with attempts below3 queues a later attempt; exponential jitter is capped at300s before any larger explicit retry hint. Retryable attempt3 becomes terminal `RETRY_EXHAUSTED`. This is distinct from SDK retries0 and can mean three paid/unknown provider attempts for one job stage. |
| Database callback transport | `packages/central/src/specs-runtime-gateway.ts:243`: SQL statement8s, lock2s, query10s and idle transaction10s. The model request runs outside that SQL transaction. |
| n8n dispatch | `apps/worker/src/n8n-orchestrator.ts:34`:10s router default, configurable up to30s. `n8n/eps-wf01-specs-stage.json` has30s execution timeout, only Webhook/Set/Respond nodes and disabled execution-payload retention. There is no OpenAI node in this workflow. |
| Dispatch versus execution | `apps/worker/src/runtime.ts:66`: await n8n work order first, then durable claim at74, then outbox ACK at80, then stage execution at98. Thus the workflow's30s dispatch timeout does not wrap the later60s embedded model request. |
| Poll/recovery loop | `apps/worker/src/runtime.ts:133`:3s polling and30s recovery scheduling by default. The loop processes work serially; these are scheduling intervals, not extraction deadlines. |
| Native preparation | The fixed native `document` task has30s execution capacity. PDF47 already had retained prepared paragraphs; extraction sends those paragraphs directly and does not run a new native preparation task. |

The available failed-attempt projection did not retain a completed response,
token usage or reasoning-token count. Null HTTP/request IDs and approximately60s
duration do not distinguish remote reasoning, output generation, transport delay
or remote completion after local cancellation. A lease, n8n dispatch timeout and
provider deadline are separate mechanisms; no source-backed reason exists here
to increase any of them or assert that one caused the others.

The minimal SDK error-classification correction was independently checked with
actual pinned SDK timeout/abort/status error classes and no network. It corrects
safe diagnostics, not extraction latency or factual quality. Any one-call
evaluation must keep its own permanent claim, selected settings and accounting
boundary separate from the original three durable attempts and production
acceptance. The source trace does not authorize such a call.
