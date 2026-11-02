# Actual Claude access across the diagnostics release

This additive helper is **default off and file only**. It does not collect logs, invoke a CLI/provider, read authentication stores, start a listener, mutate application/database data or write output files. Original `collect.mjs`, `collect-v2.mjs`, observations and their deployment fields remain unchanged. No actual later observation, owner attestation or renewed-access result exists in this preparation.

The sole admitted ordered release pair is J3 (`dpl_J3hmctcHndRp8zDVAPYfcnjEgpzG`, product `c88f58c`, manifest `f947fb53…`) → normal 5sev (`dpl_5sevM277cLpQZPJV1XkaJxhMLqpe`, product `fdd0aba`, manifest `f68d4357…`). `approved-pair.mjs` pins the full identities, normal Ready readback receipts, immutable source receipts and Git tar archives. Admission hashes the original receipt/archive bytes, walks every regular product file in each tar without extraction, rebuilds each complete sorted manifest and checks all308/309 rows against the original receipt. Normal process return, stable alias/direct-read equality and exact existing project/team/source identities must be proved by the pinned readbacks.

The complete selected-product delta is exactly four independently reviewed diagnostics files:

- New `apps/web/lib/mcp-error-text.ts` and changed `mcp-output-validation.ts` / `mcp.ts`: safe error text and mutation-only reconciliation guidance (`f486cee`, `e44cb03`).
- `packages/central/src/presentation.ts`: presentation-specific safe semantic/database-code projection (`d4df06d` in Recovery).

Each side of every changed file is pinned. Every other selected product file is byte-identical, including auth verification, HTTP/session/delegation code, the MCP route, dependency manifests and lockfile. The changed `mcp.ts` is admitted as an exact reviewed diagnostics delta; it is not described as unchanged. Both archived auth files match the original four-seal observation contract. The original collector, trace reader and collector-v2 current source bytes are separately pinned because development helpers are outside the product archive. This proves compatibility of these exact recorded sources; it does not assert a general compatibility policy or accept a later deployment.

The retained BEFORE observation and its successful collector-v2 execution are fixed by original path and byte hash. The future AFTER observation must come from the owner-supplied actual Claude `get_project` result request ID and the unchanged bounded collector-v2; collection remains a separate Root/owner task. Both passed execution receipts must bind the exact corresponding observation file/hash, two initiated reads, fixed original source seals, CLI65.8 source/help/query grammar, no retries/raw logs and distinct execution IDs. These are source/provenance checks, not independently signed platform receipts.

Comparison validates the unchanged observation schema without rewriting any field. It preserves fixed client/project, request-local exact trace correlation (30seconds before through1second after), canonical timestamps, same session pseudonym/client, unique request IDs, old read before old expiry, later read strictly after old expiry, and strictly later signed `iat`/`exp`. A proactively renewed token is allowed; new `iat` need not follow old expiry. Both observed tokens must still be valid at their read; the new read must follow the recorded5sev Ready readback. Source-seal order equality is preserved from the old comparison. The old comparator still rejects the cross-deployment pair.

An explicit owner statement that **the same existing Claude connection was used without reenrollment between these two reads** is required. The operator may create a closed attestation projection only after receiving that actual statement. Do not infer it from elapsed time, a stable pseudonym, a helper test or silence. No attestation is provided here. Required fields are:

```text
schema_version: "1.0"
scope: "actual_Claude_owner_no_reenrollment_attestation"
statement_source: "owner_explicit_statement"
client_id: fixed existing client UUID
project_id: fixed web project ID
before_request_id / after_request_id: exact owner result request UUIDs
before_deployment_id / after_deployment_id: exact J3 / 5sev IDs
attested_at: canonical UTC timestamp after the later read
no_reenrollment: true
```

Later, after Root authorizes a flag-only arm, the file-only entry accepts a repository root and an input file under `tracking/evidence/m07/claude-cross-release-observation/`. Its closed input has `schema_version:"1.0"`, `before` and `after` each containing `observation` and `execution` `{path,sha256}` references, plus `attestation:{path,sha256}`. Observations/executions must use their original `tracking/evidence/m07/completion-oauth/` names; the attestation stays in the new namespace. All local reads are bounded single regular files with realpath, hardlink and before/after identity checks. Nothing accepts an arbitrary credential/private payload path. Importing pure functions performs no I/O; only the explicit file adapter reads supplied local evidence. Public CLI errors suppress raw parser/filesystem diagnostics.

The narrow result is **renewed operational access by the actual Claude connection across this compatible release**. It leaves expired-bearer HTTP denial, raw HTTP refresh exchange, refresh-token rotation/storage, targeted revocation and full lifecycle flags false. An actual owner request after expiry is still pending. The separate SDK lifecycle proof and its unknown refresh-denial result are not substituted for Claude evidence. This helper does not authorize reenrollment, grant/session changes, provider collection or a new deployment.

Focused verification uses actual immutable code-only archives/public release receipts and synthetic later observations/attestations only in RAM. It produces no actual later-observation or attestation artifact:

```powershell
node --test development/m07/claude-cross-release-observation/compare.test.mjs
node node_modules/eslint/bin/eslint.js development/m07/claude-cross-release-observation/*.mjs
```

Tests cover fixed-pair/manifest/archive/auth drift, malformed provenance/hash/private-path admission, session/client/project/trace/request mismatch, expiry/issued-at/correlation boundaries, required owner attestation, default-off refusal, narrow result flags and unchanged original cross-release refusal. Passing these checks is local source validation only.
