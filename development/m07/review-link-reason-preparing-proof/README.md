# Fresh external Preparing fixture proof

This new purpose is disabled. It retains the first SQL40 attempt50f795f1 and
its executed sources/controller unchanged. That attempt returned normally with
failure before SQL40: `EXTERNAL_SERIES_REQUIRED`, followed by exact owned
container/volume absence, original data/catalogue/global-role equality and
shared-lock release. The failed source and receipt are not replayed.

The initial inference that its immutable audience snapshot was internal was
incorrect. Exact backup metadata shows external series snapshots. The fixture
actor lacked `presentations.generate`; the existing series UPDATE policy uses
that capability. PostgreSQL applies UPDATE policies to `SELECT FOR SHARE`, as
the [official PG17 policy documentation](https://www.postgresql.org/docs/17/sql-createpolicy.html)
explains. The normal create-link function performs that lock and reports the
same error when the row is invisible. This source-backed explanation remains
an inference until the new owned run captures the actual visibility difference.

The new callback first uses the same acting principal and actual review-owner
role to require plain external visibility1 versus `FOR SHARE` visibility0. It
adds only the existing generation capability to the new synthetic actor, then
requires both counts1. No existing role, RLS policy or original actor is changed.
It selects an active external preset with no active Selection series in that
workspace and calls the normal `eps_create_presentation_series` RPC. Require a
new active external Preparing series, no latest Ready pointer and zero versions.
No old series/audience snapshot/Ready version is rewritten or synthesized.

Reason, trace, old39 acknowledgement, MAC-tamper, boundary and independent race
cases are byte-identical to the first purpose after this setup. SQL40 remains
exact08bf4de8, including all four source/owner/ACL/OID guards. New source IDs,
claims, labels, resource names, private paths and receipt namespace distinguish
the attempt from the retained failed one. The compiler pins that failure's
verified cleanup and exact old compiler/proof/fixture bytes before compilation.

Access cases use fresh links to the retained external Ready series after the
proper synthetic actor qualification. Before mutation, actual anonymous session
and media gateway calls must succeed with the expected asset. Each success is
inside an explicit outer rollback, so ordinary expiry cleanup and any issued
asset capability do not alter old data or escape in output. Only a closed
boolean leaves the helper. After revoke/rotate, the same gateway calls must
return the existing denial and the related synthetic grant must be revoked.
No new export/render, storage access, media fetch, native rebuild or browser
acceptance is claimed. All old Ready snapshots and original grant/session rows
still participate in complete old-row preservation.

The owned network-none PG17 bootstrap, verified synthetic38 restore, exact39
functional application, original shared-cluster read-only observations, private
ACLs, nonce/config restoration and exact cleanup protocol are retained. The
candidate's sole admission adapter still binds only the disposable database,
its different system identifier and fresh run marker; functional SQL is exact.
There is no cloud/provider call or original-cluster write.

Seven pure tests cover immutable lineage/drift rejection, default-off refusal
before target access, new claim/resource ownership, unchanged original cases,
normal Preparing construction/no snapshot DML, actual before/after access SQL,
and the actual SQL/PLpgSQL/JavaScript parse paths. Focused lint passes. These
source results do not claim an executed second proof.

```text
.venv-skills/Scripts/python.exe -X utf8 -B -m unittest discover -s development/m07/review-link-reason-preparing-proof -p test_compiler.py -v
node node_modules/eslint/bin/eslint.js development/m07/review-link-reason-preparing-proof/proof.mjs --max-warnings 0
```

Root/peer review precedes arming only this new callback flag, fresh compilation
and one separately authorized owned runtime UUID. No consumed claim or unknown
result is automatically replayed. Keep every actual outcome and cleanup receipt.
