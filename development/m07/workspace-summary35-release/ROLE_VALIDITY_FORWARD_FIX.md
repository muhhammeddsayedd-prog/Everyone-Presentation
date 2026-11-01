# Confirmed preflight drift and narrow forward fix

Root's first canonical35 inspect failed before any plan, apply claim or
migration dispatch. A bounded read-only drilldown identified exactly catalogue
group `role`, key `role:17603`, field `rolvaliduntil`. The public evidence is
`2026-11-01-cli-role-validity-drift.json`, SHA256 `389ac7e3...f61f125`.
It records `cli_login_postgres`, LOGIN true and superuser/create-role/create-db/
bypass-RLS false. Two CLI requests refreshed its expiry approximately five
minutes ahead. Other business and permission gates stayed stable. No expiry,
password, role attribute, membership or Auth setting was changed by this fix.

Before editing, the exact failed root-enabled operator (`3a3c9e26...48b4670`),
original disabled operator (`8d8da522...a103edc`) and old catalogue union
(`1861074e...3923d6`) were saved and hash-verified under `source-history/` as
nonexecuting `.txt` files. The diagnostic generator now reads that pinned old
union directly. It cannot silently switch to the forward-fixed projection.
The failure and root's existing diagnostic snapshots remain retained.

Only `rolvaliduntil` for the conjunction OID 17603 **and** exact name
`cli_login_postgres` is replaced by a null marker in the catalogue digest.
Every other role, role field, grant and membership remains compared. Every full
snapshot independently requires that exact role with the observed safe flags
and a finite future expiry no more than ten minutes after PostgreSQL's statement
clock. Ten minutes is this operator's admission bound, not a provider guarantee.
The actual current/session identity in the diagnostic evidence is postgres;
this code does not require the CLI login role as session_user.

RED/GREEN checks use the two actual five-minute observations, then reject
expired, infinite, missing or over-ten-minute expiry, changed identity/name and
unsafe privileges. The existing full catalogue comparison still rejects other
role or privilege drift. Fresh live inspection remains root's next step.

## Static schema gate for a later web deployment

Normal app usage may create jobs, versions and OAuth claim rows between database
release and web deployment. Full `read_state()` still contains and exactly
compares all 69 EPS and five canonical row digests, job drain and the full OAuth hash
inside apply and its immediate readback. Those guards were not replaced.

The additional `oauth_static_sha256` hashes the same normalized OAuth metadata
with **only** its known top-level `claims_count` omitted. `static_schema` retains
database/operator, exact history, normalized catalogue/RLS/global-role metadata,
new RPC/body/ACL, cast fingerprint ACL, owner safety, English flags/security,
protected M02 metadata/integrity and that static OAuth hash. It excludes data,
drain, the full dynamic OAuth hash and the CLI expiry-admission clock. Static
reads still fail closed if the independent CLI validity check fails.

The static projection also binds counts/hashes for exactly ten control-plane
tables: app_settings, candidate_asset_config, candidate_support_config,
frame_extraction_config, presentation_processing_config, presentation_templates,
review_gateway_config, review_processing_config, specs_asset_config and
specs_pipeline_config. No row values leave PostgreSQL. Such configuration drift
may block web deployment for review. Per-user capability grants and project/client
memberships remain live: normal authority changes take effect and are not
restored or frozen across a long web build. Fresh actor permission and HTTP/MCP
smoke checks verify current authority. Full atomic apply still preserves all
69+5 authority/business tables exactly.

`read_static_state()` / `static_schema_sql()` expose that metadata projection for
the web gate by scanning only those ten configuration tables, not all 69
business tables or active jobs.
Apply receipts now record `static_schema_before` and verified
`static_schema_after`, in addition to the unchanged full snapshots. A later web
gate must bind an actual passed apply receipt to this live static metadata.
An unconfirmed apply with successful readback is still unconfirmed; metadata
fields do not invent a normal-return marker.

All operator bytes and root's enablement flag must be finalized before the new
inspect/plan. No existing plan or apply claim existed at this correction. This
author performed source changes, parsing and inert tests only; no provider,
database, CLI, role, credential or deployment action was performed.
