# Independent PDF47 output-budget diagnostic

Source preparation only. `native.mts` and `private_bridge.py` are default off.
This purpose has not prepared real input, created a claim, contacted a provider,
retried a job or written extraction results back. Previous failures, consumed
claims, responses and cost uncertainty remain intact.

The retained streaming run45452578 received HTTP200 and an incomplete terminal
response. Its protected terminal metadata identified `max_output_tokens`, rather
than a local timeout. That is evidence for this separate budget experiment; it
does not establish factual quality or production acceptance.

## Finite request comparison

The actual production `extractSpecs` builder is invoked with an injected,
identity-checked sentinel that throws before any SDK/network operation:

1. Build `B16` with low effort,60s and16,384 output tokens. The native admission
   binds its serialized SHA to the retained `db2b95fd…` request.
2. Build `B32` through the same function with low effort,60s and32,768 output
   tokens, an existing admitted adapter configuration. Replace only its existing
   `max_output_tokens` scalar with16,384. Serialized bytes must equal `B16`.
3. Change only `B32.stream:false` to `true` for the diagnostic wire body. Invert
   that scalar and require exact `B32` bytes. The SDK fetch boundary checks those
   exact wire bytes, one canonical POST and retries0.

Model, prompt, strict schema, input/full219 paragraphs, source hash, store:false
and tools:[] remain identical. The source is still24 pages/12,807 prepared bytes
with input hash `91857023…`. No summarization, truncation or production setting
change is implemented. The adapter default16,384,60s and hard70s cap stay intact.

Only the frozen streaming transport's send/deadline/limit functions are reused
after verifying source SHA `2bd36dea…`; its entry,16k capture/validator, claims and
private files are never invoked. That send function accepts the supplied body
and does not override its budget. Tests exercise the actual SDK with a32k body.

The outer300s bound,8MiB raw-wire cap and50,000 parsed-event cap remain unchanged.
Reaching a cap, timeout or unknown outcome never permits a second call.

## Response custody and scope

Current source seals are checked immediately after transport and before raw
terminal custody. The unchanged received terminal object is stored privately
before production validation, followed by another source check. Validation uses
`extractSpecs` at32k/low/60s with an immediate injected response and requires its
rebuilt non-stream request to equal `B32`. No output is accepted for incomplete,
failed or invalid evidence responses. Only validated output can enter the new
protected `output.json`; no application writeback exists.

Safe receipts contain hashes, static codes, counts, closed timing/event metadata
and actual header request ID separately. No request ID is manufactured on an SSE
terminal response. Source, delta/reasoning text, terminal text, raw errors,
credentials and private paths do not enter public output. Raw response custody
and output use the existing frozen Owner+SYSTEM file guard. Its inherited5MiB
file cap is unchanged; a custody refusal is final. Failure receipts separate
`charge_unknown:true` from `remote_completion_unknown`: a received closed
completed/incomplete/failed terminal status is known even when validation or
custody fails, while transport timeout without a terminal remains unknown.

This is a changed-budget and changed-delivery diagnostic. Exact request-builder
and response-validator reuse are separate from whole production-function,
non-stream transport, factual-quality and production acceptance, all of which
remain false.

## Separate native purpose, still disabled

After Root review, the fixed Main-only entry is:

```powershell
node --import tsx development/m07/pdf47-budget32k-evaluation/native.mts prepare <fresh-UUID>
node --import tsx development/m07/pdf47-budget32k-evaluation/native.mts evaluate <same-UUID>
```

Neither command has been run against real input. The new namespace is
`.local/pdf47-budget32k-evaluation/<UUID>/`, with input schema
`pdf47-budget32k-input.v1` and its own permanent exclusive dispatch claim. The
private bridge subclasses only frozen custody methods; it never invokes the old
constructor, prepare/claim operations or main. Its query is byte-identical to the
previous fixed read-only source query apart from the new schema stamp.

The new entry checks fixed source/SDK7.45.1 ESM entry/loader/reference hashes before
loading only the two existing OpenAI config values in RAM. It checks the normal
root SDK resolution, fixed model, retained16k body and prepared source before
claiming dispatch. The claim survives transport, custody, validation or receipt
failure. No retries, alternate UUID, retrieval, background mode, job/outbox,
callback or application mutation is implemented. Root closes both flags after
any one authorized operation. There is no execution authorization from this file.

## Local verification

The ten Node tests use actual production builders/validators and installed SDK
with synthetic fetch/SSE responses. They cover both byte inverses, additional
drift rejection,32k body/SDK0, unchanged production defaults, caps/deadline,
incomplete/evidence rejection, permanent claims, custody/source ordering,
privacy, loader ordering and disabled refusal. Five Python tests cover exact
read-only SQL, fixed identity/new schema, fake private custody/exclusive claims,
unchanged inherited caps and disabled entry. These are local fixtures, not a
provider, actual ACL or end-to-end proof. No product/build dependency is changed.
