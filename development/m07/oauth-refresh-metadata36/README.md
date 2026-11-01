# Read-only OAuth refresh metadata proposal

Source prepared on 2026-11-01. Entry is disabled. Authoring and inert tests do
not query Supabase, access credential stores, create a private observation,
refresh tokens, alter consent or change the already accepted Claude connection.

The fixed target is Everyone-Presentation (`pyibofyctwnqpvktepse`), canonical
history exactly 36. The only client is the existing direct Claude Code public
client `f2acafd5-d4b6-4176-b86c-067c57e45ecc`. No second client is created.

The owner Auth UUID is derived in RAM from the SHA-pinned accepted server
receipt for request `23c439a1-4869-4228-a3f1-d4a6004ef4f0`; it is not copied into
this helper or a new personal fixture. Mapping is source grounded: the resource
gate derives principalId from verified JWT sub, requires it to equal the narrow
own-session RPC principal, and that RPC uses auth.uid() and matches
auth.sessions.user_id. The canonical project_memberships.principal_id foreign
key references auth.users(id). The query verifies that FK, its validated state
and exact single-column mapping before any Auth-row query. No auth.users row,
email lookup, user metadata or actor-name heuristic is used.

## What the observation can establish

Auth 2.197 calls the audit logger with action `token_refreshed` and nil traits.
The logger's database payload includes actor identity and action, not a session
or OAuth client binding. Therefore owner audit counts cannot prove that Claude
refreshed. `token_revoked` can also occur during ordinary token rotation; this
helper does not inspect it or use it as grant-revocation evidence.

The same source validates the request client against session.oauth_client_id,
generates the access token and writes session.refreshed_at inside the successful
refresh transaction. NewSession/ApplyGrantParams leave refreshed_at unset. A
retained matching owner/client session with a refresh timestamp later than its
creation is thus a source-founded indication of a committed refresh for that
registered client. It does not identify the exact current Claude process,
prove receipt or storage of rotated tokens, prove rotation/revocation or prove
that a subsequent MCP call used the refreshed token.

The actual public health receipt reports v2.197.0 at
2026-10-30T11:12:13.825Z. This is historical evidence. No fresh provider version
has been read by this preparation. The observer always reports
current_deployed_auth_version_verified:false and labels its inference
accordingly. Equivalent refresh calls were also inspected in public master
commit a7e97d665b9ea03853edb66d014bcde323f7894b; that does not identify the
deployed provider build. A later fixed public-health observation would need its
own safe version-only receipt; this tool does not fetch provider configuration.

## Query and output boundary

One read-only repeatable-read transaction, UTC, empty search path and 10-second
statement timeout first checks exact history, operator, safe selected Auth
columns/types/nullability/no defaults, validated principal FK and enabled exact
client/resource registry. Audit payload is **json**, not jsonb; refreshed_at is
timestamp without time zone and is interpreted explicitly as UTC. Unknown schema
refuses the observation before the aggregate statement.

The query selects only creation/refresh timestamps from up to 101 sessions for
the derived owner and exact client. Output is counts and timestamp ranges only;
over 100 makes every session aggregate null with truncated:true. It never
selects session identifiers, tokens, refresh_tokens rows, HMAC keys/counters,
IP addresses, user agents, emails or whole Auth row payloads.

The separate audit query filters the derived owner and only login/token_refreshed
between the accepted read time and this observation's fixed preparation time
(maximum seven days). It selects action/time only, caps at 501 and discards all
partial aggregates above 500. It never joins audit timestamps to sessions or
claims audit client binding. Empty results do not prove absence, failure or
disabled retention. Postgres audit storage can be disabled independently.

Root may review and arm ENTRY_ENABLED, then invoke the observer once using the
existing linked Supabase CLI 2.122.0 and its normal login. The helper does not
directly read a credential store or extract a password/token. The CLI performs
its normal authentication. There is no token endpoint request or operator retry;
the CLI's internal retry policy is unverified by this observer. The
existing SHA-pinned bounded CLI reader is reused only for environment and query
process capture, never its historical main or mutators. A fresh UUID query is
written with the existing owner/SYSTEM file guard; only closed metadata goes
into a fresh exclusive public receipt. No permanent once claim is required for
these independent read-only observations. Raw CLI output/errors remain in RAM
and are discarded. Source changes or any parser/gate failure yield a generic
unconfirmed result.

Inert tests (no CLI, SQL, private artifacts or provider):

```powershell
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/oauth-refresh-metadata36/test_observer.py
```

## Primary sources

- [Supabase Auth audit logs](https://supabase.com/docs/guides/auth/audit-logs):
  documented event meanings and optional Postgres storage.
- [OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows):
  authorization-code and refresh grants are distinct.
- [Auth 2.197 audit model](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/models/audit_log_entry.go#L102-L170):
  exact payload and optional storage.
- [Refresh client validation](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/tokens/service.go#L273-L288)
  and [audit/generation/refresh timestamp transaction](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/tokens/service.go#L541-L587).
- [Session model and UTC persistence](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/models/sessions.go#L74-L165),
  [new session](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/models/sessions.go#L240-L250)
  and [grant parameters](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/models/refresh_token.go#L114-L139).
- [Initial audit schema](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/migrations/00_init_auth_schema.up.sql#L55-L62),
  [refresh timestamp column](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/migrations/20231027141322_add_session_refresh_columns.up.sql)
  and [OAuth client session FK](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/migrations/20250904133000_add_oauth_client_id_to_session.up.sql).

These are metadata-only research/observation boundaries. Initial authorization,
reconnect and authenticated project-read acceptance stay passed independently.
