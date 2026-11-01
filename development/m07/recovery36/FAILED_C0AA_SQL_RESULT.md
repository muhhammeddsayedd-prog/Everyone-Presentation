# Catalogue comparison refused; full cleanup passed

Run `c0aa3c0e-42e0-4ddc-a0ea-8f9d3f676d01` failed after86,793ms at
`populated36-metadata-dump-restore`, with `RECOVERY29_UNKNOWN_CATALOGUE_PAIR`.
The actual receipt is
`tracking/evidence/m07/recovery36/2026-11-01T03-24-57-565Z-c0aa3c0e.json`.
All migrations30-36 executed; the populated source was dumped and restored, but
the exact restore-profile comparison refused an unknown catalogue pair. No
current36 restore pass is credited.

Automatic cleanup passed: both owned databases and all three new roles were
removed; original29 data, full Auth/Storage catalogue, profile/settings and
preexisting global role identities/attributes/memberships stayed exact. The
shared lock was released. No cloud/provider operation occurred.

All129 source seals matched before the exact seven new executed files were
archived under `source-history/c0aa3c0e/source-archive.json`. The claim, prepared
controller, private dump and failure evidence remain; this run is not replayed.

The source/restored current36 catalogue pair was not persisted. The profile
planner rejected it before runtime36 saved its source catalogue; the inherited
planner also kept its observed value only in memory. Existing artifacts cannot
justify an ACL/profile exception or identify the actual pair.

The next change captures source catalogue/row hashes and restored catalogue
differences privately before the unchanged profile gate. A fresh run must
provide actual pairs before any adapter is considered. Unknown representations
must remain refused until their exact scope and native semantics are proved.
