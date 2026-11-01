# Snapshot statement boundary failed; cleanup passed

Actual run `e3af2cb6-eac9-4ae2-9e07-f2a8a193ec03` failed at
`populated36-metadata-dump-restore`, before its ACL correction completed.
Receipt: `tracking/evidence/m07/recovery36-trace-profile/2026-11-01T04-04-49-683Z-e3af2cb6.json`.
The private command diagnostic reported PostgreSQL exit3, not a timeout, with
`ERROR: syntax error at or near "commit"`. Root inspected only that diagnostic
and public source; no private dump or candidate payload was published.

The caller passed `snapshotSql()` without a terminating semicolon to `ctx.value`.
The unchanged SQL transport appends a newline and `commit;`, producing an invalid
transaction. Standalone snapshot/correction parsing did not cover this assembled
boundary. The forward fix belongs at this caller; the frozen snapshot query and
all prior138 source files remain unchanged. A regression must parse the actual
BEGIN/body/COMMIT composition and reject the prior bytes before a fresh run.

Automatic cleanup passed: both owned databases and all three new roles removed;
original29 data, full Auth/Storage catalogue, profile/settings and preexisting
global role identities/attributes/memberships remained exact; lock released.
All145 source seals matched before the six new executed sources were archived
under `source-history/e3af2cb6/source-archive.json` (SHA256
`74c1de242465d06834afe1399191b9d27089b2d39922d00d016b95ca56fd5f8a`).
No replay of this run, cloud write, privilege bypass or restore acceptance follows.
