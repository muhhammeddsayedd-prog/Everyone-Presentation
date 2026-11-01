# Failed first history36 recovery run

Run `0843096a-6482-402a-bbcf-9cf162289b8a` failed after 78,438ms. This is not a
restore pass. Its actual receipt is
`tracking/evidence/m07/recovery36/2026-11-01T03-01-28-673Z-0843096a.json`.
All 129 executed source seals matched before the exact seven new source files
were archived in `source-history/0843096a/source-archive.json`. The original
prepared controller, permanent execution claim and private artifacts remain.
This run must not be replayed.

The first assertion failed at `runtime.mjs:37`: the new role validator required
a JavaScript number, while the actual PostgreSQL role query returned the
canonical decimal-text OID `243387`. A subsequent guarded read-only observation
found the exact run marker, safe attributes, no clients/dependencies and the two
expected membership tuples. Their actual order was bootstrap grantor
`supabase_admin` followed by explicit grantor `postgres`; the validator also
incorrectly depended on the reverse array order. The OID type assertion was the
first failure; membership ordering was a second independently confirmed issue.
Neither requires changing a permission or accepting an additional membership.

Both temporary databases were removed. The same validator assertion interrupted
role cleanup before inherited issuer/consent cleanup, original29/global-role
preservation checks and shared-lock release. Those checks were not reached;
their absence does not prove unrelated data changed. Cleanup is unconfirmed and
the failed-run lock remains until a separate guarded cleanup proves preservation.

A fresh cleanup-only purpose must first observe the three exact owned role
identities and both database absences, compare all preexisting roles/memberships
and original29 row/catalogue/Auth-Storage/profile baselines, then remove only the
dependency-free owned roles under same-transaction rechecks. Independent complete
preservation and role-absence checks must precede release of only the exact
failed-run lock. No old controller or execution claim may be reused.

After verified cleanup, the new recovery purpose can receive a narrow canonical
OID validator and order-independent comparison of the same closed, unique
membership tuples. Regression fixtures must use native PostgreSQL JSON types.
A new source freeze, fresh claim and actual restored-data result remain required.
Cloud pilot data, worker and accepted OAuth/MCP connection are separate; this
local failure provides no cloud restore or production-readiness credit.

## Later reconciliation

The separate cleanup passed at03:19:20.008UTC. Its before/after receipts are
`tracking/evidence/m07/recovery36-cleanup084/2026-11-01-before.json` and
`2026-11-01-after.json` in that directory. Only the three owned roles were
removed; original data/catalogue/profile and the58/94 global baseline matched,
both databases were absent and the exact lock was released. This does not
change the failed084 result. The narrow forward fix passed14 inert tests;
a fresh actual metadata restore remains required.
