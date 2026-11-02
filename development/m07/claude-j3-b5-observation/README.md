# Actual owner Claude reads across J3 and B5L2

This new default-off helper is file only. It never collects provider logs,
reads credentials/Auth stores, invokes a CLI, starts a listener or changes any
session/business state. The original collectors and J3-to-5sev comparator stay
unchanged. Existing actual observations are read by original path and byte hash;
their deployment fields are never rewritten.

The only admitted pair is the actual `4f3a7c5a-d83f-4e65-9931-306a2db0f101`
read on J3 and `1d370c0f-bf80-4e90-a00d-96c933abe721` read on B5L2. Both
observation files and passed collector-v2 execution receipts are immutable pins.
J3's c88/f947 archive and B5L2's 1c72/05a398 archive must match their complete
308/309 source manifests and normal Ready/alias/direct-read provenance. The
selected product delta is exactly four reviewed diagnostic files plus the two
reviewed archive-focus UI components. Every other archived product byte remains
equal, including verified-token/session/delegation code and the MCP route. The
four original auth/collector seals and actual v2 CLI/query provenance also hold.

The owner explicitly excluded the retained `3b4e...` observation from their
connection statement. It is not used. The finite lookup index preserves the
unconfirmed B5/5sev lookups before the successful J3 match; they prove no broad
historical absence.

`approved-pair.mjs` preserves both owner statements verbatim with ASCII Unicode
escapes. The required closed statement projection is bound to both actual
request IDs, both exact deployment IDs and the existing client/project. It
requires `no_reconnect:true`, `no_sign_in:true`, the exact two statements, and
`statement_source:"owner_explicit_statement"`. Its `recorded_at` is the operator's
recording time, not an invented owner-message timestamp. Do not replace this
with a stronger claim about enrollment, elapsed time or unobserved token storage.

All original request/trace/timestamp/expiry/same-client/same-session constraints
remain. The later read must be after the first observed natural expiry, with
later signed iat/exp and both tokens valid at their respective reads. The result
is narrowly **renewed operational access across this compatible release**. Raw
refresh HTTP, refresh-token rotation/storage, expired-bearer denial, targeted
revocation and full lifecycle remain false.

After Root reviews and authorizes a flag-only arm, `files.mjs` accepts a root
and a closed input under `tracking/evidence/m07/claude-j3-b5-observation/`.
The input has `schema_version:"1.0"`, `before` and `after` each containing
`observation` and `execution` path/SHA256 references, plus `attestation` pointing
to the owner statement projection in that same namespace. No statement or
result artifact is created by this preparation. The file adapter prints the
safe result; it writes no files and performs no network/subprocess operations.

Focused tests read immutable code-only archives/public evidence and build the
owner projection only in RAM. They never persist a result or statement artifact.
They cover the exact actual pair, all six archive deltas, immutable observations
and provenance, exact owner wording/bindings, private-path refusal and default-off
behavior. Original comparator tests remain the historical semantic regressions.

```text
node --test development/m07/claude-j3-b5-observation/compare.test.mjs
node node_modules/eslint/bin/eslint.js development/m07/claude-j3-b5-observation/*.mjs --max-warnings 0
```
