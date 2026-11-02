# Bounded read-only observation collector

`collect.mjs` reads normal runtime logs through the existing pinned Vercel
65.8.0 CLI and its normal login. It never reads credential stores, supplies
tokens, calls a token endpoint, opens a browser, changes a session or creates a
client. Imports and tests are inert. No live collection has run.

Use it only after root verifies the deployed observation source and the owner
has made the real Claude `get_project` described in [README.md](README.md).
Supply the actual owner-visible result request ID and exact Ready deployment
ID, plus an ISO UTC timestamp with milliseconds before that call. There is no
expiring token handoff to prepare and no current-client interruption.

```text
node development/m07/completion-oauth/collect.mjs preview <dpl_ID> <2026-11-02T00:00:00.000Z> <actual-request-UUID>
node development/m07/completion-oauth/collect.mjs collect <same-dpl_ID> <same-since> <same-actual-request-UUID>
```

Preview performs zero provider reads. Collect performs at most two explicit
normal CLI reads: first the successful project-read receipt selected by request
ID, then its verified-token event selected by the returned route trace ID.
Each uses the fixed pilot web project/scope, supplied exact deployment,
24-hour maximum lookback, 100-record maximum, 30-second timeout and 2-MiB RAM
output limit. There is no follow mode or automatic retry. Only a complete
window containing exactly one correctly bound event passes; truncation,
warnings, omitted intervals, pagination, duplicate/ambiguous events, extra
private fields, wrong deployment/client/project/time or malformed data refuse.
Every selected event must fall inside the provider summary's exact start/end,
even when the summary otherwise declares a complete window. The token event
must be no more than 30 seconds before or one second after its same-trace
completed read; a longer handling interval remains unconfirmed. This bounded
request correlation prevents an arbitrarily old same-trace event from passing.
The CLI can perform its own internal request policy; the wrapper initiates no
retry and does not infer provider absence from an empty or failed query.

Only closed allowlisted event fields leave RAM. The existing project event's
principal UUID is validated and discarded. Platform paths, URLs, request
headers, general log messages, raw stderr and credentials are never persisted.
The receipt records safe owner request/trace IDs, fixed client/project, session
pseudonym, signed times, actual provider log times and four local source seals.
The normal CLI's scope binds the read to the supplied deployment; root must
retain its separate deployed-source/alias proof. This collector does not infer
deployment provenance merely from the current local checkout.

Collection receipts are fresh exclusive files under
`tracking/evidence/m07/completion-oauth/`. Root can use the returned natural
expiry deadline to schedule the owner's second actual Claude read. Collect
that second request separately using the same deployment. After both receipts:

```text
node development/m07/completion-oauth/collect.mjs compare <before-receipt-path> <after-receipt-path>
```

Comparison reads only regular/single-link receipt files inside that evidence
folder. It requires distinct actual result IDs, same client/session pseudonym,
the second successful read strictly after the first token's natural `exp`, and
later signed `iat`/`exp`. Proactive refresh is allowed: the new `iat` need not
postdate the first `exp`. Owner separately attests no re-enrollment/reconnect.

A pass is **renewed operational access through the actual owner-requested
connection**, not raw refresh transport, private refresh-token rotation/storage,
old-expired-bearer denial or targeted-session revoke proof. Those limits remain
explicit `false` fields in the comparison receipt. A changed session or early
read does not pass and cannot be relabeled as the same-session lifecycle.

Six pure synthetic collector tests pass, including privacy projection,
exact-ID joins, exact summary-window and bounded request-correlation checks,
incomplete/ambiguous-window refusal and natural-expiry timing.
Focused ESLint passes. These tests and command preparation are not live OAuth
acceptance. No product source changed after commit `c88f58c`; the fresh 955-test
root quality receipt remains the product validation boundary.

```text
node --test development/m07/completion-oauth/collect.test.mjs
node node_modules/eslint/bin/eslint.js development/m07/completion-oauth/collect.mjs development/m07/completion-oauth/collect.test.mjs --max-warnings 0
```
