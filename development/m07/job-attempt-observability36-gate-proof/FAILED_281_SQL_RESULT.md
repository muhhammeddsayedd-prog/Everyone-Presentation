## 2026-11-01, 01:59 UTC: fresh gate SQL completed; OAuth projection needs narrow delta

Fresh run28122d90 completed the SQL wire and captured all seven gate phases, but
the Python acceptance check refused the normal transition. Only the inherited
OAuth hash and static OAuth hash differed: their envelope includes the newly
created trace-owner role and required EPS USAGE grant. All74 old table hashes,
normalized catalogue, claim ports and English matched; the actual new schema and
expected catalogue delta passed independent pure validation. Whole gate proof
remains FAILED/unaccepted; no fixture or cloud acceptance is inferred.

Both temporary databases/new33 roles were removed, original29 data/full catalogue/
Auth-Storage/profile/global roles stayed exact, and the shared lock released.
The failed receipt, all233 source seals and exact source delta are retained under
source-history/28122d90. The earlier207 archive remains unchanged; no recursive
archive copying or run replay is used. Diagnostic:
`tracking/evidence/m07/job-attempt-observability36-gate-proof/2026-11-01-failed281-diagnostic.json`.

Next: normalize only the exact new trace role/EPS grant in both OAuth envelope
hashes, preserving every other Auth/OAuth field and full atomic claim count.
Schema/delta checks still require the exact new role/grant. Run another fresh
owned normal/negative/recovery/rollback proof before any canonical36 release.
Canonical remains35 and tracing is NOT installed. Passed English/guest/version/
Reviewed and owner MCP/connection results stand; pilot running, screen reader
pending, mobile skipped, frontend preserved and no language labels/selector.
