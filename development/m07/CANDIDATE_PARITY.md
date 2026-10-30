# M07 candidate operation parity slice

2026-10-30. Implemented and verified with controlled transports and desktop browser fixtures. No cloud, provider, canonical business data, SQL migration, real Claude client or hosted endpoint was exercised by this slice.

The existing candidate-media and duplicate-match HTTP operations now return the published `{request_id,data,page}` envelopes. Their central adapter accepts cursor/limit, defaults to25, permits at most100 and orders by stable media/candidate ID. Cursor scope binds the acting user, candidate and operation. Every page repeats the original user-authorized RPC. Malformed/cross-context cursors, duplicate result identities, foreign resources and lost permissions fail explicitly. Inserting records before a cursor requires refreshing the listing; pagination is a live keyset view, not an immutable snapshot.

The existing SQL functions return arrays. Paging is performed in the central adapter after validating that scoped response. This fixes the external contract without changing released SQL; it does **not** establish database-side bounded reads or large-library capacity.

`update_candidate`, `update_candidate_frames` and `update_workspace_candidate` now advertise and require the same16-200character `idempotency_key` already required by the real central mutation adapter. OpenAPI header contracts, the self-contained MCP input schemas and generated contract/context companions agree. No permission, row-version, mutation or replay SQL rule was weakened.

Shared profile, project material choices and final-review source readers consume all pages. They preserve selected IDs from later pages, pass cancellation and reject incomplete/malformed/cycling responses rather than returning a partial successful list. Existing write-intent and row-version behavior is retained. The UI reader has an explicit100-page guard; exceeding it surfaces a refresh error.

`apps/web/lib/mcp-output-validation.ts` exports `validateMcpSuccess(name,value)`. It validates against the advertised success output schema and produces a safe503 error on invalid/private output. Root owns its integration into the MCP server and the broader acting-user/delegation capability changes.

## Evidence

| Check | Result and boundary |
| --- | --- |
| Original behavioral RED | [Five failing boundary cases](../../tracking/evidence/m07/parity/candidate-boundary-red.txt): missing page/ignored cursor, HTTP query rejection and SDK contract failure. The initial candidate-update fixture also supplied incomplete CandidateFacts; that test-input issue was corrected, not treated as a product defect. |
| Isolated three-key schema RED/GREEN | [Exact02f9287 baseline](../../tracking/evidence/m07/parity/candidate-intent-baseline-red.json) rejects the supplied key as its only schema error and accepts its absence for each of the three otherwise-valid requests. [Current contract](../../tracking/evidence/m07/parity/candidate-intent-current-green.json) accepts the key and rejects absence. Reproduce with `node tools/check-m07-candidate-intents.mjs [exact40characterGitCommit]`. |
| Actual central/HTTP/SDK boundary | [24passing module cases](../../tracking/evidence/m07/parity/candidate-boundary-final24-green.txt). Actual Supabase JS identity verification, central parsers, HTTP handlers, output schemas and official MCP in-memory client run against controlled synthetic RPC bytes. This is not a SQL idempotency/concurrency or live OAuth claim. |
| Desktop UI | [10passing Playwright cases](../../tracking/evidence/m07/parity/candidate-desktop-e2e.txt): shared profile and project choices consume later pages; final review finds its pinned source on page2; existing retirement/Undo behavior stays covered. `EPS_SKIP_MOBILE_TESTS=true` omitted the existing390px review tail. No mobile assertions or responsive screenshot were run. |
| Scoped lint | [Pass](../../tracking/evidence/m07/parity/candidate-lint-green.txt), zero warnings. |
| Static pack | [357checks, zero errors](../../tracking/evidence/m07/parity/pack-strict-green.txt). An earlier run found two new PowerShell-generated JSON receipts encoded UTF16; those own receipts were corrected to UTF8. [Original failure](../../tracking/evidence/m07/parity/pack-strict.txt) remains. |
| Global typecheck | [Recorded run](../../tracking/evidence/m07/parity/candidate-typecheck.txt) failed in the independently changing `mcp-auth.test.ts` header fixture, outside this slice. Root owns the final composed typecheck/build/full suite. No full-suite or production-console pass is inferred here. |

Earlier candidate-boundary green/intermediate/current-integration logs remain historical. Intermediate failures include the incomplete synthetic CandidateFacts fixture, the newly introduced capability-discovery requirement and its missing synthetic upload-policy field. The dedicated schema-check launch initially resolved the root's older AJV; it now explicitly resolves the web workspace's installed AJV. Both launch failure logs remain. These are not suppressed product failures.

The source checkpoint lists exact hashes for this slice. Later root-owned auth/settings/docs changes require their own composed verification; they do not rewrite this checkpoint. Released SQL, historical seals/evidence and unrelated `Screenshots/`/`redesign-output/` files are preserved.
