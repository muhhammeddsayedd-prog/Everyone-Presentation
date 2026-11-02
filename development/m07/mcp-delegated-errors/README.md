# MCP delegated-operation error diagnosis

This isolated Frontend change starts from `6709c70`. The three reported tool
definitions and their MCP/HTTP/central mapping files match deployed product
`c88f58c`; the later unrelated catalog Page fix is not needed for these cases.
Main and its active temporary OAuth source/deployment pins were not changed.

The confirmed diagnostic defect was the error fallback: `content[].text` only
said to read the structured error. A client displaying text could not see the
safe error code, repair message or request ID. Both operation failures and the
pre-service current-capability/delegation check used this opaque fallback.

Error text now contains a bounded JSON projection of the existing public error
envelope: request ID, code, message, retryability, and only allowlisted numeric
current revisions from details. The separate structuredContent contract stays
unchanged. Raw internal exceptions still use the existing closed error; failed
success payloads never cross the output guard. Post-result validation failure
now warns that a mutation may already be applied and asks the caller to read
saved state and retain the same idempotency key for the same intent.

## Confirmed contract discrepancy; no silent contract change

`revoke_review_link` and `rotate_review_link` advertise ArchiveRequest, which
allows optional `reason`. `parseGuestRowVersion`, the HTTP handler and the
central facade accept only `row_version`. Both canonical RPCs also explicitly
reject all other input fields. Thus an advertised reason is rejected before
the mutation; omitting it can succeed.

The current review audit stores request hashes, not a durable reason field.
MutationContext has no alternative reason channel. Accepting and dropping the
reason would lose the caller's data and remove it from replay binding. This
patch preserves the advertised schema and does not ignore, remove or invent
storage for reason. Durable additive support needs a separately reviewed SQL
change, including the later rotation credential-MAC wrapper. Runtime's isolated
design review owns that follow-up; no migration or provider write ran here.

## Generation and committed candidate limits

- Generation's SQL acknowledgement, central DTO, HTTP envelope and published
  JobAccepted schema agree. No concrete success-output drift was found.
- get_capabilities reports current business grants. tools/list and tools/call
  additionally intersect signed delegation. A business presentations.generate
  grant and can_generate review do not prove that an existing JWT permits it.
  The new official-SDK regression demonstrates CAPABILITY_REQUIRED before the
  generator runs. No permission, registry, token or reconnect change is made.
- The M05 migration already blocks old templates in generation, review and fit,
  and selects the current template for new series. An old-template explanation
  requires actual series evidence; no existing series is upgraded automatically.
- Candidate pool DTO/schema fields agree. A committed mutation followed by DTO,
  output-validation or transport failure remains possible. The regression
  deliberately reproduces committed state plus invalid output, proves that the
  private extra output is withheld, reconciles by readback, and reuses the same
  key without another commit. It does not identify the historical live cause.

The reported failed calls have no supplied safe request IDs or complete actual
generation bodies. Their exact live denial/return path remains unconfirmed until
the canonical audit or a future visible error can correlate it. Do not infer a
new database render from an attempted tool call, or retry with a new intent key.

## Focused local verification

The initial five cases were RED against the generic fallback, then GREEN after the
projection fix. A sixth case covers a central DTO rejection after commit. They cover delegation/precondition/input errors, a committed
mutation with rejected output and same-key reconciliation, and private internal
exception suppression. The official SDK/HTTP/output/presentation/sharing/authority
selection passed **34/34**, with zero failures/skips. Root typecheck and focused
ESLint passed. Initial test-harness import and fixture type assertions were
corrected without changing product behavior. The final commands were:

```text
node tools/run-tests.mjs tests/server/mcp-error-projection.test.ts tests/server/mcp.test.ts tests/server/mcp-http.test.ts tests/server/m07-mcp-authority.test.ts tests/server/mcp-output-validation.test.ts tests/server/presentation-mcp.test.ts tests/server/guest-mcp.test.ts
npm.cmd run typecheck
node node_modules/eslint/bin/eslint.js apps/web/lib/mcp.ts apps/web/lib/mcp-error-text.ts apps/web/lib/mcp-output-validation.ts tests/server/mcp-error-projection.test.ts --max-warnings 0
```

These are deterministic local results, not live delegated/provider acceptance.
The existing next-env generated drift and untracked redesign output remain
excluded and preserved. Root owns any later Main integration, quality seal and
deployment after its current owned OAuth session is cleaned up.

## Follow-up: read and mutation error guidance

A separate follow-up after `c2f1906` corrects the original output guard's advice scope. The validator now returns the generic `OPERATION_RESPONSE_INVALID` message for every invalid success. Only the mutation-aware MCP text formatter appends reconciliation guidance, for that code and the existing `CENTRAL_RESPONSE_INVALID` and `DEPENDENCY_UNAVAILABLE` codes. Read operations receive no mutation or same-key directive. Guidance is emitted once.

Three added regressions failed against the preceding source and then passed: generic validation for reads/writes, an actual SDK read with malformed private output, and a controlled non-JSON success response exercising the real JSON-parse fallback for both GET and mutation calls. Private failed bytes remain suppressed. The eight-file focused selection passed **42/42**, with zero failures/skips/cancellations; typecheck, focused ESLint and diff checks passed. These are local synthetic-boundary results, with no live/provider/SQL acceptance claim.

The follow-up changes only the two web error modules and their focused tests/documentation. It does not change the prior reason parser/MAC implementation, auth, route, permissions, dependency/lock files or worker sources. Main and deployment remain untouched.
