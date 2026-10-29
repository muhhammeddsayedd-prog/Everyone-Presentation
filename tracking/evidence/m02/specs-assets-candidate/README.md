# File specs candidate evidence

The reviewed candidate completed one owned-local rollback rehearsal at
`2026-10-29T00-13-09-548Z-6d1ccc32-rollback.json`. Root executed the runner.
The transaction reached its final rollback, the owned backend settled, and the
full before/after catalog, every inspected table count and row digest matched.
Migration history remained at the original ten versions during this rehearsal.

The successful source set is:

| Artifact | SHA256 |
| --- | --- |
| `development/m02/specs-assets-candidate.sql` | `87b1296d96860a0ab1d4ccc6e551bfdc2a3d0d53c2dcd9f82ae7e2f0c149f9da` |
| `tests/db/m02-specs-assets-candidate.sql` | `636c08a295d2fd21e8e904b6b0b9e13be6ac0fe87874e6718a8a13c834eb33b4` |
| `tools/test-m02-specs-assets-candidate.mjs` | `bdb4eaa15ad63752ec5cc03613aabc50eca9e22b86f24ff80dc3a213885e2980` |

The SQL assertions exercised scoped original reservation, dedicated HMAC Ready
completion, forged/scalar-invalid proofs, cancelled/expired sessions, metadata
RLS, requester revocation, lease fencing, opaque exact-object grants, stable
attempt output keys, private preparation promotion, PDF/DOCX-shaped retained
input/evidence, unknown-count provisional slots, safe retirement/replacement of
untouched generated facts, suppressed retirement rollback and preservation of a
manual edit made while processing. The UTF16 projection assertion includes Arabic and a
non-BMP scalar at the 2M-unit scale with a 5-second statement deadline. This is
not a full maximum-size document throughput measurement.

The managed Auth RLS baseline and Storage request context were simulated only
inside the guarded transaction. Synthetic metadata and predetermined test keys
were used. No HTTP object bytes, genuine user JWT, OpenAI/n8n call, worker
process, credential provisioning, multi-backend race or deployed Storage privacy
acceptance is established by this proof. All file readiness flags default off.

Two earlier attempts remain failures:

- `2026-10-29T00-09-06-717Z-71dc41a8-rollback.json`: the file enqueue owner lacked
  EXECUTE on the existing pure UUID parser. The fix added that single grant.
- `2026-10-29T00-10-42-274Z-4077c988-rollback.json`: a final test assertion used
  an ambiguous column name. The fix qualified the assertion's table alias.

Both failed attempts also verified full rollback/backend settlement. Their exact
candidate/assertion/runner sources and seals are archived under
`development/m02/specs-assets-*.source.*`; neither failure is relabeled as a pass.

Root subsequently created additive migration11 from the marked canonical core.
Its persistent local promotion, reconciliation and assertions are separate
evidence. Cloud release, real Storage header/operation/logging probes, real
PDF/DOCX processing, recovery races and future assignment integration retain
their own acceptance gates.
