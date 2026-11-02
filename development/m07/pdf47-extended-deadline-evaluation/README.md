# Independent extended-deadline evaluation

Default off. No provider request, private preparation, job retry, callback or
writeback has run from this purpose. Root reserved a single later 120-second
diagnostic; execution awaits Root's source review. The consumed 60-second run,
its permanent claim, failures and unknown costs remain immutable.

This is a separate diagnostic of the retained PDF47 input, not a production
timeout change. The production adapter still defaults to 60 seconds and refuses
configuration above its existing 70-second cap. It keeps the same exact model,
low effort, 16,384 output tokens, prompt, full schema, paragraphs, store:false,
tools:[] and stream:false. No facts, quotes, clarification or validation rules
are removed. Only the separate transport's overall deadline becomes 120 seconds.

## Finite request and validation comparison

Let B(x) be the checked-in `extractSpecs` request for retained input x with the
existing 60-second configuration, explicit low effort and 16,384-token limit.
The following is implemented rather than maintaining a second prompt/schema:

1. Invoke `extractSpecs` with an injected transport that clones B(x), then throws
   one identity-checked `IntegrationError` sentinel. No SDK or network transport
   is constructed on this branch. An invalid input fails before the claim.
2. Keep `J = JSON.stringify(B(x))` privately in RAM. After the permanent claim
   and predispatch receipt, call the actual pinned SDK once with `JSON.parse(J)`.
   The fetch boundary requires one POST to the canonical Responses URL and
   asserts its serialized body is exactly J. SDK retries are zero, redirects
   refuse, and a 120-second AbortController bounds fetch and body parsing.
3. Persist the received response in protected `response.json` before validation.
   Call the production `extractSpecs` again with an injected immediate response
   transport. Assert its rebuilt request and the captured request both serialize
   to J, then return the same SDK response object. This preserves the SDK's
   nonenumerable request ID and reuses the unchanged production response,
   Unicode, source identity, role-key, schema and paragraph/page/quote validation.
4. Persist validated `output.json` separately. Recheck source seals before
   validation. Public success records request-byte equality and validation reuse
   separately from the extended transport. It explicitly denies whole-production-
   function, factual-quality, n8n/job and production acceptance.

The HTTP deadline and dispatch are therefore outside the production function;
production request construction and response validation are reused. This is not
an assertion that the production function completed under its normal deadline.
Nor does a successful metadata GET establish why inference exceeded 60 seconds.
No response exists yet for this new purpose.

## Custody and replay

`private_bridge.py` copies the prior bounded read-only source query exactly,
except for the new input schema stamp. It binds the same failed job, ready
original asset/hash, retained input fingerprint, 24 mapped pages, 219 paragraphs,
12,807 prepared bytes and exact configured model. It uses the same pinned normal
Supabase CLI reader and Win32 current-owner plus SYSTEM guard. It adds no SQL
mutation or Auth query. Python receives only an OS environment whitelist, never
the provider key.

All files are exclusive in the new Main namespace
`.local/pdf47-extended-deadline-evaluation/<run>/`: source.sql, input.json,
dispatch.claim.json, response.json and output.json. Protected response custody
can retain a rejected/incomplete result without accepting it or exposing text.
The existing fixed worker-private environment loader is used only in RAM and
only its API key/model fields reach the SDK configuration. No credential cache,
arbitrary file path, input URL or alternate provider origin is accepted.

The normal root SDK7.45.1 entry, client, errors, response promise/resource,
loader, production builder/prompt/schema/errors and new purpose sources are
sealed. The fixed loader's regular file, actual path and hash are verified
before it is dynamically imported or invoked; source drift stops before any
credential read. Preclaim and postresponse seals remain mandatory.
Production pins are fixed rather than merely recording drift. Safe
receipts include settings, hashes, static result/error codes, filtered provider
IDs/status, usage and role/evidence/clarification counts. Text, raw errors,
headers, keys and arbitrary model identifiers remain private or omitted.

One claim is permanent on every timeout, unknown response, validation failure,
source drift, custody failure or receipt error. Result receipt writing is
attempted once; a failure does not submit another provider request. Neither a
second dispatch nor a different UUID is automatic. Raw reasoning-token counts
are unobserved; charges and prior remote completion are not inferred. No result
is applied to specs, roles, jobs, outbox or immutable versions.

Both new entry flags must stay false until Root reviews. The CLI only runs from
the canonical Main checkout after the source is taken there. Expected future
commands, not executed by this preparation:

```
node --import tsx development/m07/pdf47-extended-deadline-evaluation/evaluate.mts prepare <fresh-run-UUID>
node --import tsx development/m07/pdf47-extended-deadline-evaluation/evaluate.mts evaluate <same-run-UUID>
```

The public evidence directory must exist first. Root owns arming, the exact run
UUID and dispatch. No old claim or input path can satisfy this new purpose.

## Offline checks

```
node tools/run-tests.mjs development/m07/pdf47-extended-deadline-evaluation/evaluate.test.mts
D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe -X utf8 -B -m unittest discover -s development/m07/pdf47-extended-deadline-evaluation -p test_*.py
node node_modules/typescript/bin/tsc --noEmit -p development/m07/pdf47-extended-deadline-evaluation/tsconfig.json
node node_modules/eslint/bin/eslint.js development/m07/pdf47-extended-deadline-evaluation/evaluate.mts development/m07/pdf47-extended-deadline-evaluation/transport.mts development/m07/pdf47-extended-deadline-evaluation/evaluate.test.mts
```

Tests use actual SDK classes with injected synthetic fetches and mocked time,
and fake private-file guards in temporary directories. They do not query a
provider/database, read real private input/configuration or exercise native ACLs.
These source-only helpers are outside the worker/native executable graph; no
existing product source, manifest, dependency or lockfile is changed.
