# Inert temporary same-client OAuth helper

This source is for one new owner-authorized operator SDK session under the
existing public OAuth client. It is separate from the actual Claude connection
observer. No account/client registration, credential-store read, provider call,
authorization flow or listener was started. Both live entry flags remain false.
The worker release mutation fence remains in force.

`DESIGN.md` records the intended acceptance and unresolved deployed compatibility.
Implemented modules are independently reviewable:

- `core.mjs`: actual official MCP2.4 PKCE/code/refresh primitives; fixed issuer,
  client/callback/resource; real JOSE verification; new-session baseline/current
  admission; raw bounded rotation response before SDK fallback; no automatic
  retry; exact local logout; invalidated refresh only after the owned session is
  absent; closed evidence and full unrelated-session metadata preservation from
  original pre-authorization through pre-logout and post-logout snapshots. HTTP,
  permanent claims, persistence and normal markers are explicit required ports.
  There is no default global fetch or credential provider.
- `private_store.py`: immutable protected token generations, exclusive permanent
  code/refresh/logout/denial claims and read-only `inspect`. Current-owner/SYSTEM
  ACLs apply at first file creation, are checked again, and files are fsynced
  before normal markers. Consumed/unknown claims never become retryable.
  Generation3 preserves an unexpected successful post-logout refresh privately;
  that outcome cannot produce a denial acceptance marker.
- `owner_callback.mjs`: the localhost3118 adapter is **disabled** before any
  claim, private access or socket. Its reviewed future path binds both loopback
  families, refuses port conflicts, accepts the one state/issuer-bound callback,
  consumes it before invoking the code handler, and closes only its own servers.
  No token/code/authorization URL is printed. Browser readiness exposes only
  fixed `http://localhost:3118/start`.
- `metadata_reader.py`: the metadata port is **disabled** before any auth/private
  read. Its future fixed read-only query uses normal Supabase CLI2.122 existing
  auth and a protected new SQL file, never an old operator entry/claim, arbitrary
  query or service/admin token. It selects only the admitted owner's session
  UUID/client/created/not-after fields plus a query timestamp. Token tables,
  emails and auth credential columns are excluded.

The private Python bridges can return confidential data through captured stdio
to a future Node adapter. Never invoke their `read`/enabled query actions through
a tool that forwards stdout to chat or public logs. Errors are closed codes;
raw provider/CLI diagnostics are not returned. Existing public publishable key
input must be separately protected/admitted when the gateway adapter is wired;
no service-role, management credential or browser/Claude token may replace it.

The source currently supplies these inert adapters and primitives, not a live
phase coordinator or a release acceptance result. Root must review and bind a
private run's source pins, exact registration/owner/public-key inputs, fresh
metadata/JWKS and durable phase wiring before any later arming. A normal grant
return marker alone is not the complete refresh/logout proof: require signed
same-session/later-token binding, matched successful MCP reads, actual natural
expiry denial, both invalidated refresh/MCP denials, independent owned-session
absence and unrelated-session/access preservation. No live coordinator is
silently activated by importing these files or by running the offline tests.

Refresh requires the actual previous access token before its claim/dispatch;
replacement presence alone cannot establish token change. Unrelated session
id/client/created/not-after fields must remain exact, including every original
pre-authorization row. Extra independently created sessions are permitted;
loss or changed metadata makes preservation unconfirmed.

Current inventory admission allows only a complete bounded1024-row result and
requires the query timestamp within30 seconds before owned-session dispatch
(with1 second future clock tolerance). Historical pre-authorization inventory
stays a baseline. Natural expiry uses signed claims and actual wall time. To
reload an expired owned bearer for expiry/refresh, JOSE must first verify its
signature and fail specifically on `exp`; no claim or wall clock is altered.
The new token must verify normally and retain the exact owned session. A later
deployment with different signing keys or a slower metadata path must stop for
fresh admission rather than skip these checks.

Offline tests use synthetic signed JWTs, in-memory fake HTTP and synthetic local
private files. Actual first-write Windows ACL verification, fsync/immutable file
behavior and cleanup were exercised. No real credentials were used. These
checks establish local behavior only; genuine owner consent/provider/Claude
acceptance remains unperformed by this purpose.

```powershell
node --test development/m07/temporary-oauth-lifecycle/core.test.mjs development/m07/temporary-oauth-lifecycle/owner_callback.test.mjs
.venv-skills/Scripts/python.exe -X utf8 -B -m unittest discover -s development/m07/temporary-oauth-lifecycle -p "test_*.py"
```
