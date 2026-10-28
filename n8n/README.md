# WF01 specs stage routing

`eps-wf01-specs-stage.json` is the reviewed four-node workflow create/import payload.
Root created and published dedicated workflow `Nu4bvU634yTLnRy1` on the existing
n8n Cloud instance. The final scalar-validation correction was PUT, explicitly
published and read back at 2026-10-28T23:38:01Z. Actual webhook executions
31253/31254/31255 returned bound work orders for all three stages; missing auth
returned403, malformed envelopes and an object-valued stage returned400.
These were metadata-only probes, with no database claim or OpenAI call.
The export contains a real credential reference supplied by root, never its value:
`httpHeaderAuth` / `DgZ83IpyrbinQ9gW` / `Everyone Presentation Studio WF01 local dispatch`.
Root owns credential provisioning and all hosted writes.

Regenerate locally with `node tools/build-specs-wf01.mjs --build`. Run the five
offline tests with `node --test tests/tools/specs-wf01.test.mjs`. Neither command
reads private configuration or calls a provider. Only the explicit `--inspect`
mode uses the approved fixed private-file loader and two bounded metadata GETs.

The production webhook path is `eps-wf01-specs-stage-v1`. Header Auth must check
`Authorization: Bearer <dedicated dispatch secret>` through its credential.
No secret, source text, file contents, result, stage lease or arbitrary URL enters
the exported parameters or response. All execution-data saving settings are off;
the mapper removes inbound headers and other webhook fields from its output.

The closed eight-field `StageReadyEnvelope` is mapped to exactly nine work-order
fields: `schema_version`, `event_id`, `job_id`, `kind`, `stage`, `input_hash`,
`correlation_id`, `workflow_execution_id` and `handler`. The actual `$execution.id`
supplies the execution identity. The three handlers are `native.prepare_document`,
`openai.extract_specs` and `domain.apply_specs`. The native orchestrator consumes
this response; n8n does not receive source/provider payloads or commit app facts.
Duplicate webhook deliveries can produce separate n8n executions; durable database
leases, outbox and idempotency remain responsible for business effects.

Valid metadata returns HTTP200 JSON. Invalid metadata returns a sanitized400.
Expression/node failures route to an explicit sanitized500 responder. A malformed
request never gets an invented accepted job. The workflow makes no downstream
network calls and needs no node-level network retries.

## Schema provenance and current access limits

Root observed MCP project search and SDK-reference calls failing with `-32603`.
The read-only fallback observed settings200 without a usable version and node
types401; the management key does not grant an editor session. Receipt:
`tracking/evidence/m02/n8n-wf01/2026-10-28T23-31-32-581Z-a99a4761-metadata-failure.json`.
The earlier inspection failed before HTTP-status instrumentation and remains in
tool history. No cookie/session extraction or alternate authentication was used.

Parameter shapes were checked against seven files from official n8n commit
`0b04add5b381f59a013d7a27c5680a7f7c8966be`. URLs, SHA256 values and chosen supported
versions are in `eps-wf01-source-reference.json`: Webhook2.1, Edit Fields3.4 and
Respond to Webhook1.4. The public API accepted/read back this exact graph and the
three handler routes ran on the hosted instance. The editor/MCP validator and
instance version remain unavailable; the sanitized500 error branch has not been
forced live. Receipts are under `tracking/evidence/m02/n8n-wf01/`.

Primary references: [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/),
[Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/),
and the pinned source links in the provenance file.

## Root publication and readback

1. Confirm the dedicated path has no unrelated owner. Create a new inactive draft
   from the four-field API payload; do not reuse W05, its Drive credential or any
   other existing workflow. Check actual node support before activation.
2. Read back the complete draft. Verify all four node names/types/versions, exact
   connection branches, the Header Auth reference, `responseNode`, the mapper's
   closed output, both response paths and every disabled execution-saving flag.
   Root must resolve any live schema rejection; do not silently change auth or
   response shape to make an import pass.
3. Validate through MCP if it becomes available. Otherwise record the missing
   validator explicitly and test the reviewed dedicated workflow through its
   production webhook after authorized publication. Check all three stage
   envelopes against the strict native `validateSpecsWorkOrder` contract, actual
   execution IDs, extra/invalid-field400 rejection and unauthenticated denial.
   Inspect error wiring separately; offline graph checks are not a hosted500 test.
4. Configure the returned production HTTPS webhook URL and its dedicated secret
   only in private runtime configuration. Keep `webhook-test` URLs out of the
   runtime. Read back publication state/settings again and retain sanitized
   execution/status evidence without bodies or headers.
5. Prove the actual app/DB/native/OpenAI path separately. A valid work order proves
   orchestration routing; it does not prove extraction, persisted roles, file
   preparation, cancellation or recovery.
