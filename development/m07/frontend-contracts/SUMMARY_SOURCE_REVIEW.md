# Workspace-summary source review

2026-10-31. Reviewed the isolated `Everyone-Presentation-Studio-Backend-Summary` worktree's SQL35, shared summary DTO, central adapter, HTTP/MCP dispatch, schema/parity additions and transactional SQL fixture. This is source/local synthetic verification only; no database, browser, provider or cloud call was performed by this reviewer, and no Summary source was edited.

No confirmed source blocker was found. The SQL checks exact history34 and active current project/workspace authority, reuses the non-bypass review owner and existing RLS, returns an unknown unreviewed count without querying candidate-library rows when `cast.read` is absent, and uses the existing facts/source fingerprint when authorized. Participation, unresolved/unknown-headcount roles, Selection/explicit-Shortlist assignment counts, real open slots and separate audience-series Ready pointers match the coordinated definitions. Ready metadata uses the existing read-mode policy without introducing a cast-read requirement or a bypass. The STABLE function retains the caller statement snapshot across permission/revision/count reads.

The DTO validates exact fields, safe integers, requested workspace, count relationships, finite series budget and deterministic unique series IDs. Signed-in HTTP and MCP enter the same shared operation and actor-scoped RPC. Unknown review issue count stays null. The new exported Next route awaits the operation inside the existing safe error boundary; SQL diagnostics do not escape.

Independent results:

- `node tools/run-tests.mjs tests/domain/workspace-summary.test.ts packages/central/test/workspace-summary.test.ts tests/server/workspace-summary.test.ts`: **10 passed**, including the official MCP client and exported Next API error mapping; provider/RPC responses are synthetic.
- Actual migration SQL: **12 statements parsed** with pglast.
- Actual rollback fixture SQL: **81 statements parsed** with pglast. This is parsing, not transactional execution or an RLS/runtime pass.

At the source-review checkpoint above, the implementation was isolated/unmerged/undeployed. A guarded local transactional fixture and preservation/permission proof, normal quality/parity gates, source reconciliation with main, and its own coherent release/readback remain necessary. Those are not replaced by this review or the completed English rollout evidence. No frontend layout, OAuth configuration, worker graph or migration34 change is included.

## Subsequent merge checkpoint — 2026-10-31

Root committed the English rollout as2acc6ab and integrated Summary source as
ab1c3d5 (original1db430d). The actual merged Summary/MCP/signed-delegation suite
passed31 local synthetic tests/0skips, recorded at18:33:32.149253 UTC in
`tracking/evidence/m07/workspace-summary35/2026-10-31-root-merged-regression.json`.
This subsequent merge does not change the earlier independent review's scope.
SQL35/local transactional execution and hosted Summary deployment have not
occurred; the actual pilot remains canonical34/web5vEM. The owned SQL35 proof is
source preparation only and must earn its separate local runtime/preservation
evidence before release. No live owner-connection acceptance was reopened.
