# Consumed OAuth denial: read-only audit recovery

Root authorized a fixed metadata investigation after the SDK lifecycle's consumed
denials phase did not return normally. This source does not repeat refresh,
logout or a denial call. It does not read token rows, token values, credential
stores, raw Auth payloads, IP addresses or emails.

The existing normal Supabase CLI 2.122.0 session ran one read-only, rollback-only
query against the linked canonical target. Its fixed window is
2026-11-02 09:16:59 UTC through 09:17:03 UTC exclusive. Principal/session comparison
values come only from the protected initial metadata file; only equality booleans
can leave SQL. The private query file is created under this Recovery worktree
with the existing Windows private-file guard. Main, deployed sources and history
were not changed.

The actual receipt is
`tracking/evidence/m07/auth-denial-audit39/2026-11-02T09-30-55-334245Z-audit-metadata.json`.
The query returned normally: history39, read-only true, zero audit entries, no
truncation. This does not establish the original HTTP denial status, error code
or request ID, and does not establish whether optional database audit storage is
enabled. No further token-endpoint request was made.

The exposed connector inventory contained no Supabase connector. Pinned CLI
top-level, `inspect` and `projects` help exposed no Auth-log reader. No custom
management API, new login, connection or secret read was introduced. Official
[Auth audit documentation](https://supabase.com/docs/guides/auth/audit-logs)
describes optional database audit storage; audit action rows are distinct from
an actual HTTP response receipt.

Validation: Python and generated PostgreSQL syntax passed before dispatch. One
Python string-construction syntax error was corrected before any provider query;
it did not dispatch SQL. No native lifecycle entrypoint was run.
