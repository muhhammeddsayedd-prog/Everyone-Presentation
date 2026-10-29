Exact sources for failed local rollback receipt ac0fb074 (2026-10-29T08:54Z).
The candidate reached ALTER OWNER without the owner's required temporary CREATE
schema grant. No acceptance was credited; catalogue and data rollback passed.
The current candidate uses the same bounded CREATE/ALTER OWNER/revoke pattern as
the earlier coordinated migrations. This directory preserves the failed bytes.
