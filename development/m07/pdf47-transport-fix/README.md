# PDF47 transport diagnostics fix

Product commit `7a55fefd9282312b494e58a57b44da2f5a9204e0` changes only the
Specs error adapter and six deterministic SDK-class regressions. Real installed
SDK7.45.1 timeout/deadline errors now receive `OPENAI_TIMEOUT`; external
cancellation wins, and safe `requestID` survives alongside legacy `request_id`.
Unexpected SDK aborts without an observed cause remain unclassified availability
failures. Raw errors, provider bodies, source text and headers are never copied.

Model, request schema/prompt, output budget, 60s deadline and SDK retries0 are
unchanged. The existing durable job retry vocabulary is unchanged. This fixes
diagnosis; it does not make the failed real document complete or improve model
latency. Job47's three failed extraction attempts and unknown cost remain intact.

The installed TypeScript error/client sources and README are byte-equal to the
official [v7.45.1 SDK source](https://github.com/openai/openai-node/blob/v7.45.1/src/core/error.ts)
and [documentation](https://github.com/openai/openai-node/blob/v7.45.1/README.md).
Their exact source/runtime hashes are in the verification receipt. The SDK's
timeout subclasses inherit Error.name; its error request field is requestID.

The new regression suite first reproduced four failures and two passes, then
passed6/6. Focused adapter/job/worker checks passed40/40. Full **Frontend
worktree** npm tests passed968/968 with zero failure/skip/cancellation; TypeScript,
focused lint and diff checks passed. These are local results, distinct from
Root's later independent Main quality and production acceptance. Protected logs
stay ignored; public evidence contains commands/counts/source hashes only.

The exact serving165 source context056/5339 was verified. The changed module is
in daemon90, outside native54. Both module lists are retained in the dependency
receipt. The existing shared full-source verifier still couples the two images;
a naive daemon-only manifest combination will refuse. The separate provenance
proposal explains this limitation and does not authorize a native rebuild or
weaken that verifier.

No production retry is recommended until the separate source review of request
parameters, output complexity and worker/job budgets identifies a bounded next
step. One public retry action may start multiple durable provider attempts; it
must not be described as one paid request. Any later Root-authorized processing
must preserve all prior attempts/cost uncertainty and have an explicit attempt
budget and stop condition. No retry, cancellation, model call or deployment was
performed by this fix.

```text
node tools/run-tests.mjs tests/integrations/specs-sdk-errors.test.ts
node tools/run-tests.mjs tests/integrations/specs.test.ts tests/integrations/specs-sdk-errors.test.ts tests/integrations/job-errors.test.ts tests/worker/specs-executor.test.ts
npm.cmd test
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js packages/integrations/src/openai-specs.ts tests/integrations/specs-sdk-errors.test.ts --max-warnings 0
```
