# Failed release-gate SQL proof 207731a6 ? retained

The fresh local run started2026-11-01T01:42:48.715UTC and failed at01:44:10.369UTC.
The exact PostgreSQL diagnostic was `type "jsonbas" does not exist`: the atomic
postcondition builder concatenated `::jsonb` and `as value` without whitespace.
Both local fixed-GUC and production-literal forms have this source boundary.
Independent AST inspection found the sibling `jsonband` cast/AND fusion in the
same failed builder. SQL parsing alone accepted the unknown type names; no
gate/fixture PASS is credited.

The permanent claim, private wire/diagnostic and public failed receipt remain.
All229 source seals matched at archival time. The44 inputs beyond the prior185
are preserved byte-for-byte in source-history/207731a6/source-archive.json using
base64; the original185 remain unchanged and pinned by the passed7cff receipt.

Rollback and cleanup passed: both owned databases/new33 roles removed, original29
full data/catalogue/Auth-Storage/profile and all preexisting global roles exact,
shared lock released. No cloud, provider, runtime config or canonical business
write occurred. Canonical remains35; tracing is NOT installed on the pilot.
Do not replay this run or edit its claim. Fix only the new query boundary, add
cast/alias AST regressions, preserve this archive, then prepare a fresh source-
pinned run/UUID and reprove the actual gate and cleanup before any cloud release.
