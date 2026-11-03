# Raw authority observer SQL correction

This is a new successor module for a test-observer syntax bug, not a product
function or security change. The consumed raw-authority module remains exact.

`raw-authority.mjs` has the same exports and differs from the frozen predecessor
by exactly two ASCII spaces: between the interpolated numeric sender PID and
`and` in the pin-lock-count query and the lock-wait query. All source function,
clone, barrier, role/claims, timing, authority, rollback and cleanup behavior is
otherwise byte-equal. Existing sibling import specifiers remain unchanged.

- Old module SHA256: `1b7d1743f1c1e7a750d12a26056c3208bbfa024f230386b5296998f02f333896`.
- New module SHA256: `66fc775e5fb5369933117df7c2305134032baa4e6c8a181a525739d1d0890491`.
- The exact two-edit inverse is asserted against the original full byte hash.

`DIAGNOSIS.json` binds the retained 48ed report, actual executed source seal and
two protected failure-file hashes. Its safe message/code/location projection
identifies the terminating 42601 observer error and separates the earlier native
RESOURCE_NOT_FOUND record. No private SQL, claims or transcript values are copied.
The eight first-call and sixteen projection scopes remain evidence from that
run; unfinished focused/authority/final-restore scopes are not promoted.

`test_fix.mjs` reuses only the exact pinned original fake-port setup before its
first test, then executes the actual old and successor case functions. It collects
every fully interpolated pg_locks observer query across both variants and all six
case flows. The real PostgreSQL parser (`pglast`, isolated existing environment)
rejects the old queries and parses all corrected queries. Removing either space
again makes a collected query fail parsing. The fake ports do not execute SQL.

For author worktree resolution only, the successor's three shared-library imports
are rewritten to existing Main file URLs in RAM. Committed module bytes keep the
original specifiers and are ready for normal Main integration. No global patch,
database, Docker, provider, old entry or consumed controller is invoked. Root's
separate continuation will bind this module; this folder starts no proof itself.
