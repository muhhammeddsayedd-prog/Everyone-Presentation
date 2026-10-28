# Single-attempt specs execution

`executeSpecsStage(lease, gateway, options)` executes one already-claimed
`prepare_document`, `extract_specs` or `apply_specs` attempt. It does not claim
jobs, start a server, load credentials, schedule recovery or grant permissions.
The gateway must authenticate a scoped service separately, bound response sizes
and invoke the central transaction functions. The executor propagates an abort
signal and independently bounds gateway waits to15 seconds, even if the
transport fails to settle. There is
currently no production gateway implementation. Deterministic gateway responses
in tests are separate from PostgreSQL and provider evidence.

The executor snapshots the lease/configuration before asynchronous work. It
validates the returned job, attempt, stage, input hash, source hash and frozen
configuration, then rechecks cancellation and lease expiry before costly work.
Tokens are bounded opaque credentials; their encoding is not an
application assumption. SQL currently generates32 random bytes encoded as64 hex
characters. No token, private input or raw provider error is logged.

The initial implemented source path is pasted text with a null original asset.
Preparation hashes unchanged UTF8/BOM/CRLF text and invokes the separate parser
process. Its completion carries only the documented preparation metadata, with
null file derivatives. The SQL candidate independently reconstructs and stores
the paragraph map privately. No source or derivative asset is manufactured.
File uploads and production output reservation remain unfinished.

Extraction accepts the prepared LF text and exact UTF16 paragraph map from
`get_specs_stage_input`. It reconstructs that map before a provider request and
projects paragraphs to `{index,page,text}` in the adapter's defined order.
Configuration must match `document-preparation.v1`, `spec_extract_v1.0.0` and
result schema `1.0`; the runtime's explicitly selected model must equal the
frozen model. No model default or new provider endpoint is selected here.

The extraction completion schema is `specs-extraction-stage.v1`:
`{result,metadata}`. `result` is the unchanged
[`specs-extraction.schema.json`](../../contracts/json-schema/specs-extraction.schema.json)
payload. `metadata` has the exact
[`SpecsExtractionMetadata`](../../packages/integrations/src/specs-types.ts)
shape, retaining model/prompt/schema/source correlation and usage. This wrapper
is private staging data. Public jobs and event receipts contain scoped result
references, not the full source/evidence/lease. SQL must validate both the
extraction and its trusted metadata before publishing facts.

Apply invokes no model. The `specs-application.v1` callback carries only
`{specs_id,workspace_id}` from the lease-fenced input. The central transaction
loads its saved extraction, checks current authority/source/draft state and
computes roles, slots and summary. The executor cannot supply arbitrary patches
or declare how many facts were saved. The current candidate is initial-source
only; ordinary source replacement still needs immutable internal input retention.

Heartbeats default to20 seconds and serialize with the terminal callback. The
timer is stopped and any pending heartbeat is resolved before completion. An
unknown or stale callback aborts the adapter and emits no competing terminal
event. Cancellation also stops publication. A known provider failure emits one
safe error from the job vocabulary; durable jobs own the retry budget. This
helper never repeats a model request, retries unknown completion or claims that
lost callbacks were delivered. Expired leases require the persistent recovery
operation and an eventual dispatcher/runtime integration.

Twelve tests cover actual isolated text preparation, actual adapter/schema logic
with synthetic provider output, SQL-shaped response/token compatibility,
heartbeats, late/unknown/unresolved callbacks, transport deadlines, expiry during
input reads, safe errors, tampering and caller mutation.
They do not demonstrate service authentication, n8n orchestration, real database
leases or production operation. The separately recorded one real OpenAI
synthetic evaluation did not run this executor or its gateway.
