# Owned observation search-path correction

The exact `b99606ab` request reproduces a Python State refusal at `check()`'s
OAuth static/reconstructed-envelope comparison. Counts and current hashes agree;
the initial envelope does not. There are 75 differing observation paths: one
intended audit-row hash, five OAuth metadata hashes and 69 catalogue metadata
text/value paths. Database, current/session role and history remain equal.
The protected pure trace and the actual failed/cleaned-up run remain retained.

The audit rollback transaction omitted `SET LOCAL search_path=''` before the
unchanged collector. Other collector transactions include it. Catalogue output
uses `regprocedure`/`regclass` text and expression rendering; PostgreSQL documents
that symbolic OID output depends on visibility in the current search path:
<https://www.postgresql.org/docs/17/datatype-oid.html>. The omitted transaction's
actual GUC value was not captured. No identity/hash condition is relaxed.

This disabled successor adds exactly that one GUC statement. The callback inverse
permits only this change and the new flag. All production State/SQL/fixtures,
diagnostic helper, limits, CLI and environment stay sealed. The controller has
fresh compiled/once/evidence/resource namespaces. Its private parent remains
the old bridge namespace solely to reuse the exact sealed helper; a fresh
independent runtime UUID and exclusive files prevent reuse of an old input,
runtime, marker or claim. No consumed controller is called.

The focused regression executes all three actual direct snapshot expressions
against a fake query port, parses the emitted SQL and checks the GUC before the
snapshot. The original missing-GUC expression is refused, and the corrected
expression passes. It also checks the actual checkpoint and rendered phase
prefix. This is source/SQL-construction proof; no Postgres execution is claimed.

Any actual execution remains a separately reviewed flag-only arming and fresh
compile with one dispatch. All existing metadata negatives, diagnostic-zero
rollback, exact preimage, normal nonce/two-readback, full76/reason preservation,
concurrency and owned-resource/original29/global-role cleanup requirements stay.
