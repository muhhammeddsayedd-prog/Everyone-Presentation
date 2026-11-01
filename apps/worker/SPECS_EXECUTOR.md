# Single-attempt specs execution

`executeSpecsStage(lease, gateway, options)` executes one already-claimed
`prepare_document`, `extract_specs` or `apply_specs` attempt. It does not claim
jobs, start a server, load credentials, schedule recovery or grant permissions.
The gateway must authenticate a scoped service separately, bound response sizes
and invoke the central transaction functions. The executor propagates an abort
signal and independently bounds gateway waits to15 seconds, even if the
transport fails to settle. There is
an authenticated parameterized PostgreSQL gateway in `@eps/central/specs-runtime`.
The [local worker runtime](RUNTIME.md) verifies its dedicated SCRAM/TLS identity
before polling and requires n8n routing for all three stages. Injected gateway
responses in tests remain separate from real database/provider evidence.

The executor snapshots the lease/configuration before asynchronous work. It
validates the returned job, attempt, stage, input hash, source hash and frozen
configuration, then rechecks cancellation and lease expiry before costly work.
Tokens are bounded opaque credentials; their encoding is not an
application assumption. SQL currently generates32 random bytes encoded as64 hex
characters. No token, private input or raw provider error is logged.

The pasted-text path has a null original asset.
Preparation hashes unchanged UTF8/BOM/CRLF text and invokes the separate parser
process. Its completion carries only the documented preparation metadata, with
null file derivatives. Local migration10 independently reconstructs and stores
the paragraph map privately. No source or derivative asset is manufactured.

File preparation is optional and requires `options.files` from the verified
gateway. `specs-assets.ts` downloads the bound original through an expiring
capability, checks its MIME/size/SHA256, invokes the isolated PDF/DOCX/UTF8 parser,
then reserves an attempt-owned JSON derivative. It uploads immutable bytes,
re-downloads and hashes them, completes the Ready metadata, and stores the exact
private preparation before the refs-only success callback. Ready reservation
replays verify existing bytes and skip the upload. Pre-completion read metadata
may have a null SHA; actual bytes must still match the independently computed
digest. This module does not mint a user JWT or load credentials.

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
extraction and its trusted metadata before publishing facts. File extraction
also binds the actual source asset ID, LF/UTF16 paragraph offsets, and monotonic
PDF pages. DOCX/plain-text paragraph pages are null.

Apply invokes no model. The `specs-application.v1` callback carries only
`{specs_id,workspace_id}` from the lease-fenced input. The central transaction
loads its saved extraction, checks current authority/source/draft state and
computes roles, slots and summary. The executor cannot supply arbitrary patches
or declare how many facts were saved. Immutable per-job inputs and origin pointers
retain prior source/extraction after ordinary correction. Publication checks the
frozen workspace revision. It can archive and replace only the exact untouched
machine generation; manual edits cause the job to wait for input and preserve
the existing facts. An introduced assignments table disables this retirement
path until its integration exists.

Heartbeats default to20 seconds and serialize with the terminal callback. The
timer is stopped and any pending heartbeat is resolved before completion. An
unknown or stale callback aborts the adapter and emits no competing terminal
event. Cancellation also stops publication. A known provider failure emits one
safe error from the job vocabulary; durable jobs own the retry budget. This
helper never repeats a model request, retries unknown completion or claims that
lost callbacks were delivered. Expired leases require the persistent recovery
operation and the persistent dispatcher/runtime integration.

Failures also publish an optional, best-effort operator diagnostic. The hosted
runtime writes `specs_stage_processing_failed` with job, attempt, stage and
correlation IDs, a closed error kind/code, HTTP status (integer100–599 or null)
and an OpenAI `req_` request identifier (at most128 identifier characters after
the prefix, or null). Unknown errors/codes and unsafe metadata use fixed omission
values. The sink receives no exception, prompt, source text, body, headers or
credentials. A sink failure cannot change the durable callback or retry policy.
Public job errors keep their existing generic codes and details.

These diagnostics apply to future worker execution after deployment. They do
not reconstruct the provider reason for an older `DEPENDENCY_UNAVAILABLE` error.
`stage_callback_committed` confirms callback delivery and can describe either a
successful or a failed stage; inspect the job and its correlated diagnostic.

The initial twelve tests covered actual isolated text preparation, actual adapter/schema logic
with synthetic provider output, SQL-shaped response/token compatibility,
heartbeats, late/unknown/unresolved callbacks, transport deadlines, expiry during
input reads, safe errors, tampering and caller mutation.
Those unit tests did not demonstrate service authentication, n8n orchestration
or production operation. Current executor/file tests additionally exercise actual
isolated PDF/DOCX parsing and injected HTTP/storage ports. The worker suite passed
58 tests at the file-runtime preparation checkpoint; those tests make no live
Storage/provider call. The [real pasted app receipt](../../tracking/evidence/m02/live-specs-app/2026-10-28T23-54-07.641799+00-00-database.json)
is separate evidence for the app/n8n/OpenAI path. Live file acceptance needs its
own actual upload and processing receipts.

## Observed local SQL integration

The separate [native proof](../../tracking/evidence/m02/native-executor/2026-10-28T23-00-53-971Z-c26f43c2.json) executes this helper against persisted local10 through a fixed test-only psql transport. It proves exact JS/SQL paragraph/hash projection, stage commits, callback replay, correction/cancellation and actual graceful database restart/reclaim/fencing. Responses are synthetic; no provider key is loaded. The initial jobs are synthetic direct SQL fixtures; correction uses the actual scoped SQL RPC, not HTTP. Concurrent clients have one lease winner; server lock overlap is not proved.

The official local image uses internal loopback TRUST. Its ephemeral narrow LOGIN/OS-nobody path tests SQL role authorization, not credential authentication or a production service identity. HBA, fixtures, test role/defaults/descriptions and full row/catalog baseline are restored. [Logging proof](../../tracking/evidence/m02/native-logging/2026-10-28T22-52-38-127Z-5128e4cc.json) observes public controls but no synthetic private bind marker, including NUL/surrogate rejection. This Docker/psql adapter remains local-test-only. Normal runtime uses the separate authenticated gateway, native worker and WF01.
