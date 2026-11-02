# One independent PDF47 streaming diagnostic

Source preparation only. Both `EVALUATION_ENABLED` and `BRIDGE_ENABLED` are false.
No retained-source read, private preparation, inference, job retry, callback or
writeback has run from this purpose. The three original job failures, consumed
60-second and 120-second evaluations, claims and unknown costs remain unchanged.

The diagnostic has one outer **300-second maximum** across headers and the whole
SSE iteration, SDK retries0, one canonical Responses POST, at most8MiB of raw
response bytes before SDK decoding and50,000 parsed events. It does not change
the production adapter's60-second default or existing70-second cap. A timeout,
limit, custody failure or unknown result never authorizes another request.

## Exact request boundary

The pinned prior transport module (`1d66e829…`) supplies only its pure request
capture and production-response validation functions. Its file hash is verified
before dynamic import; its consumed send function and entrypoints are never run.

Let `J` be the exact production-built, explicit-low request captured by throwing
the identity-checked sentinel before transport. The native caller binds its hash
to `db2b95fd…`, the actual retained120s request, and the fixed input hash to
`91857023…`. The immutable prior public result is also pinned by path and full
SHA256. This binds the same full219 paragraphs/24 pages/12,807 prepared text bytes.

Parse `J`, change its existing `stream:false` scalar to `true`, then serialize
`K`. Inverting that one scalar must reproduce `J` byte-for-byte. The actual SDK
fetch boundary requires its body to equal `K` exactly. Model, low effort, prompt,
strict schema, input, store:false, tools:[], stream body order and16,384 output
tokens remain otherwise unchanged. No summaries, truncation, batching or new
model is introduced.

This is a changed-delivery diagnostic. Exact non-stream transport acceptance,
whole production-function acceptance, factual quality and production acceptance
remain false. Request construction and response validation reuse are recorded
separately.

## Observations and private custody

Only relative header/created/in-progress/first-visible-output/terminal timings,
closed event counters, wire/output-text byte counts, safe HTTP status and the
actual `x-request-id` header are public. Unknown event types are counted as
`other`; their names and contents are not serialized. Delta/reasoning text,
headers, raw errors, URLs, credentials and private source never enter receipts
or console output. Counts/timings are not a model-reasoning diagnosis.

The first completed/incomplete/failed terminal event's response object is kept
unchanged, persisted to protected `response.json` **before** production validation,
then supplied to the original non-stream request's production response/evidence
validator by an immediate injected transport. Only a validated result is saved
as protected `output.json`. Incomplete, failed or invalid terminal objects stay
private and cannot be accepted. Partial stream content is never written back.

An SSE terminal response usually lacks the SDK's nonenumerable `_request_id`.
No such property is manufactured: the real header ID is recorded separately,
while the production validator's actual request ID may remain null.

SDK7.45.1's buffered-body timeout path skips streaming. This helper therefore
keeps its independent deadline active until terminal receipt, races every pending
header/event read, and aborts/cancels remaining stream work without waiting for
unbounded cleanup. Early cancellation wins. Aborting a local request does not
prove remote completion stopped or that no cost was incurred.

## Native operation, still disabled

After Root review, a fresh run UUID uses `evaluate.mts prepare <UUID>` followed by
`evaluate.mts evaluate <UUID>` via the normal Node24/tsx installation. Only the
Main path is admitted. The new protected namespace is
`.local/pdf47-streaming-evaluation/<UUID>/`; all file names are closed. Existing
bounded normal SupabaseCLI reader/target and Win32 Owner+SYSTEM file protection
are reused. Preparation performs only the exact fixed read-only source query.
The verified existing RAM-only private-config loader supplies only the API key
and configured extraction model to this SDK client; no credentials enter argv.

All fixed sources/SDK entry/stream parser/loader/reference hashes are checked
before private config loading. A permanent exclusive claim precedes the one POST.
Public dispatch/result receipts are exclusive writes. Source seals are rechecked
immediately after transport and before sending raw data to the private bridge.
Raw terminal custody must succeed before validation, with another source check.
A missing receipt
or result does not permit replay, even with the same UUID. No automatic300s
follow-up, retrieval, background mode, store change, job/outbox or cleanup mutation
is implemented. Root closes both flags after the one reviewed operation.

## Source validation

`evaluate.test.mts` uses the actual pinned SDK with injected synthetic SSE/fetch
ports: finite body inverse, header delay, exact outer300s mock clock, stalled body,
byte/event caps, API/SSE failures, terminal/validation privacy, private custody,
exclusive dispatch, loader ordering and disabled refusal. Python checks parse
the read-only SQL and use fake private guards in a temporary test directory.
They do not access real private input or invoke a provider/DB/ACL operation.

Official sources: [streaming Responses](https://developers.openai.com/api/docs/guides/streaming-responses),
[typed SSE events](https://developers.openai.com/api/reference/resources/responses/streaming-events)
and [Structured Outputs streaming](https://developers.openai.com/api/docs/guides/structured-outputs#streaming).
