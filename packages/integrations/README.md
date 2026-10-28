# Processing integration adapters

M02 isolated implementation. These modules do not claim central DB, real OpenAI, n8n workflow or end-to-end acceptance. No provider request has been made by the deterministic tests.

`extractSpecs(input, config, transport?, signal?)` takes worker-prepared text paragraphs with stable indexes/pages, exact source asset identity (null for pasted text), persisted job input fingerprint and correlation ID. It calls official `openai@7.45.1` Responses with a strict provider-adapted JSON schema, no tools, `store: false`, bounded timeout/output and SDK retries disabled. `OPENAI_API_KEY` and an explicitly evaluated `OPENAI_EXTRACTION_MODEL` are required; there is no default model or fabricated success. Extraction is server/worker code; never import it into a client component.

The source is serialized in a separate user data envelope; versioned instructions isolate embedded prompt attacks. Every response is checked for completion, refusal, unexpected tool/output types, valid JSON and the full application JSON Schema. Evidence must resolve to supplied paragraphs/pages, source asset and exact quotes when supplied. These checks reject invented citations but do not prove semantic extraction accuracy. Ready data is returned for a fenced domain commit; the adapter never writes profiles, specs, slots or permissions.

Output metadata records requested/resolved model, response/request/correlation IDs, usage, prompt/schema versions and hashes, prepared-source hash and persisted input fingerprint. It contains no key or raw transcript. Provider error bodies/refusal text are not exposed in errors. Jobs own effective retry budgets and should treat configuration/refusal/malformed/incomplete results as actionable failures. Rate-limit/transient errors can retry under that budget.

`N8nDispatcher.dispatch(envelope)` sends only the exact small WF-01 stage-ready envelope to a trusted configured HTTPS production webhook. Configure n8n Header Auth through its credential store for `Authorization: Bearer <N8N_DISPATCH_SECRET>`. The client forbids credentials in URL/query, test webhook URLs and redirects; secret length is at least 32 characters. It sends one attempt with event ID idempotency and bounded timeout. HTTP acceptance means delivery accepted, not stage completion. The n8n workflow must claim the stage and use leased scoped service operations; this module does not provide a bypass.

No workflow is created or published here because connected n8n reads failed. Durable claim/lease/outbox/callback application remains the domain/job runner's responsibility. The extraction input must come from a verified job/asset scope, not directly from an untrusted request. No local fixtures may run against production.

`integrationErrorToJobFailure(error)` is the explicit adapter-to-job error seam. It translates known transient OpenAI/n8n failures into the generic `PROVIDER_RATE_LIMITED`/`DEPENDENCY_UNAVAILABLE` codes accepted by `@eps/jobs`, and extraction/source/refusal failures into terminal generic codes. It respects an adapter's nonretryable classification, forwards only a finite retry hint rounded up from milliseconds to seconds and capped at 300 seconds, and drops raw exception messages, request IDs, statuses and all other provider details. Unknown/configuration/access/quota failures are terminal `PROCESSING_FAILED`; unknown codes never gain retries. The result structurally matches the job Error DTO without a runtime dependency. A runner must handle `PROCESSING_CANCELLED` as control flow before invoking this helper, retaining the existing durable cancellation/fencing rules rather than sending a fabricated failed callback. This helper does not bind the runner, persistence, transport, or workflow.

Run deterministic adapter checks from repository root:

```powershell
npx.cmd tsx --test tests/integrations/*.test.ts
```

Official sources checked 2026-10-28:

- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Responses create TypeScript reference](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create)
- [Official SDK installation](https://developers.openai.com/api/docs/libraries)
- [n8n Webhook production/auth behavior](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook)

The full schema remains `contracts/json-schema/specs-extraction.schema.json`. Provider adaptation removes schema metadata and numeric/string bounds for a conservative supported subset and converts `const` to `enum`; the full original schema is always validated server-side. A configured model's support, account access, quality and quota remain integration gates.
