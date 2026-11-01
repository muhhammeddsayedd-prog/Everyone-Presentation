# Project creation39 local SQL proof

Actual run `70b3b36e` passed on 2 November 2026 (Africa/Cairo) in 20,849ms.
The [receipt](../../../tracking/evidence/m07/project-creation39-proof/2026-11-01T22-51-16.947Z-70b3b36e.json)
binds migration39 SHA256 `c17af7708a1886d2129df2dc9e4eb196e6b760862939bd2f5fd3c7c1c687e242`
and exact runner/fixture bytes. There is no cloud or provider operation.

The existing passed `639da33a` synthetic metadata38 backup is verified read-only.
The runner owns Main's shared local SQL lock and creates one UUID-named,
OID/comment/owner-checked database in the already fingerprinted local PG17
container. Restore, three missing support roles, exact marked migration39
functional SQL and every fixture run inside one transaction ending in ROLLBACK.
The canonical migration admission prefix is replaced with an explicit owned-local
predicate; its functional marker bytes are unchanged. No migration-history entry
is added, and the original local database remains on history29.

All restored38 table hashes matched the saved backup. Thirty-two SQL assertions
proved narrow creator ownership/search path, forced RLS, denied direct writes,
genuinely constrained-session role-escalation denial, authorized client listing,
foreign/contributor restrictions, creation without a workspace, planned type,
separate Casting workspace, stable idempotent replay after rename, current
project/client/capability/archival checks and one creation audit/idempotency row.
Every preexisting restored row image remained present and exact.

The transaction rolled back all restored app DDL and new roles. The owned database
was then dropped after exact identity/session checks. Original data, full
catalogue, role OIDs/attributes/memberships matched before/after and the shared lock
was released. Private metadata, raw diagnostics and executed source snapshots
stay in the current-user/SYSTEM-only ignored run directory.

Two earlier failed attempts retain separate receipts with complete cleanup and
original preservation. Run `2e8c92df` exposed pg_dump's retained `row_security=off`
session setting; the harness now reenables RLS after restoring. Run `88b18ee9`
exposed an invalid test assumption: `SET ROLE` uses `session_user`, so an original
admin session is unsuitable for escalation denial. That assertion now temporarily
sets session authorization to `authenticated` and restores it afterward. Neither
failure changed functional migration bytes or required a product permission fix.

```powershell
node --test development/m07/project-creation39-proof/guards.test.mjs
# Only for a new required proof, after coordinating the existing shared SQL lock:
node development/m07/project-creation39-proof/run.mjs 'D:/Everyone/Presentation/Everyone-Presentation-Studio'
```

The two guard tests and focused ESLint passed. The accepted sequential SQL proof
does not establish concurrent-session creation races, the canonical prefix guard,
hosted migration application, real contributor/OAuth/MCP use, UI or production
acceptance. Reuse it while the exact migration bytes remain unchanged.
