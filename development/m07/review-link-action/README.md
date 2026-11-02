# Review-link action reason compatibility

This isolated Frontend change follows `f486cee` (safe MCP error text). It implements the already advertised optional `ArchiveRequest.reason` for revoke and rotate without changing the catalog, permissions or authentication. It has not been merged into Main, deployed or applied to a database.

`ReviewLinkAction` is `{ row_version: number; reason?: string | null }`. The new direct-import domain parser retains omitted, null, empty and exact string values. `ArchiveRequest` references `NullableText`, which has no `maxLength`. The existing HTTP JSON body limit remains 65,536 UTF-8 bytes; there is no additional 10,000-character reason cap. NUL and unpaired UTF-16 surrogates fail with a closed validation error because PostgreSQL JSONB cannot represent them. Other representable controls and Unicode remain unchanged.

Both HTTP and the verified-user central facade use that parser. Rotation keeps the full action object in the existing credential MAC and RPC input. Its signer uses a narrow canonicalization branch only for a string reason in the existing six-field `rotate_review_link` envelope. All other fields still pass the original presentation serializer. Existing admitted MAC bytes, protocol, key use and AAD remain unchanged. No reason is added to a success response or diagnostic message.

Runtime owns the coordinated SQL40 change: nullable private audit reason, the shared `review_remember` trace fix, and revoke/rotate acceptance plus durable replay/audit handling. This TypeScript change alone does not make the current deployed SQL accept or retain reasons. Do not release the parser as proof of database support.

The separate request-correlation diagnosis found that `createCentralReview`, candidate and presentation facades already forward `X-EPS-Request-ID` and `X-EPS-Client-Type` after verified-actor admission. Candidate mutations use `finish_mutation`; generation uses `presentation_remember`; both capture those headers. The old five-argument `review_remember` writes only actor/action/resource, leaving `api`/null defaults. Runtime's single migration owns that fix. Historical audit rows are not reconstructed.

PostgREST documents transaction-scoped, lowercased request headers in [`request.headers`](https://docs.postgrest.org/en/stable/references/transactions.html#request-headers-cookies-and-jwt-claims). The diagnosis is grounded in the checked-in SQL and facades; no provider request or database query was made here.

## Local verification

The initial new HTTP/MCP regressions failed against the row-version-only parser. A second failure exposed the rotation signer's presentation-control restriction. After the fixes, the five new cases and the surrounding nine-file suite passed: **46 tests, zero failures/skips/cancellations** on Node 24.18.0.

The tests execute the actual Supabase JS client, verified-user facade, domain parser, credential signer, HTTP handler and official MCP client/server against a synthetic network boundary. They prove exact omitted/null/empty/control/Unicode input, a reason over 10,000 characters, an exactly 65,536-byte legal HTTP body, unchanged legacy MAC bytes, independent expected control-string MAC bytes, full-input binding, and denial before RPC for invalid fields/actor/unrepresentable text/oversized bodies. They also retain the old unrelated row-version parser's strict behavior. They do not execute PostgreSQL or establish live audit durability.

```powershell
node tools/run-tests.mjs tests/domain/guest.test.ts tests/server/review-link-action-reason.test.ts tests/server/guest-http.test.ts tests/server/guest-mcp.test.ts tests/server/review-http-mcp.test.ts tests/server/presentation-mcp.test.ts tests/server/mcp-error-projection.test.ts tests/server/mcp-output-validation.test.ts tests/server/m07-candidate-parity.test.ts
npm.cmd run typecheck
node node_modules/eslint/bin/eslint.js apps/web/lib/guest-http.ts packages/domain/src/review-link-action.ts packages/domain/src/guest-types.ts packages/central/src/guest-reviews.ts packages/central/src/review-credentials.ts tests/server/review-link-action-reason.test.ts tests/server/mcp-error-projection.test.ts --max-warnings 0
```

Typecheck, focused ESLint and diff whitespace checks passed. The existing generated `next-env.d.ts` drift and `redesign-output/` remain outside this change.

## Actual worker boundary

The read-only [runtime closure report](runtime-closure.json) verifies all 165 files of the actual packed source `0566342ec367efef328885aac513adeb5a942048ba01c88e1af63e4d636b6730`, then traces static runtime imports and literal dynamic imports from the daemon and fixed native entrypoints without evaluating application modules.

The new parser is imported directly and is absent from the domain barrel. `guest.ts` remains byte-identical to the sealed source. `guest-types.ts` changes types only and emits byte-identical JavaScript. The central review facade and signer are outside both runtime import closures. The resulting executable changed-file intersections are empty for the daemon's 90 modules and native's 54 modules. No native or daemon rebuild was performed for this web/review change.

The packed source file set would contain changed bytes if restaged; this is not a claim that the full source graph hash remains the same. The existing images retain their exact source seal and identities. No package, dependency, lockfile, authentication or production setting changed.
