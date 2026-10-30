# Live Settings and provider discovery follow-up

Actual central/browser verification on 2026-10-30, after source checkpoint
e4ffcca. Hosting remains deferred. No provider, hook, OAuth client, public origin,
Auth identity or migration was created by this follow-up.

The first connected Settings tab was still signed out after refresh. The existing
library tab1091386544 had the owner's verified Producer session; ordinary UI
navigation reused it without reading browser cookies, tokens or storage.
The separate Supabase dashboard tab1091386724 was authenticated. The connector
still reported installed:false, so its dashboard supplied read-only discovery.

## Existing Producer capability completion

Fixed read-only inspection found exactly one eligible existing principal and
11 active grants, with settings.manage absent. The owner previously designated
that real account as first Producer and authorized M07. A source-reviewed,
single-dispatch transaction added only that absent capability. It rejects any
existing active or inactive row, pins canonical history29 and observed grants,
locks/rechecks history, grants, verified identity and writable membership, and
measures the single insert and preservation checksum. Independent readback
confirms 12 active grants and unchanged other grants/Ready versions.

`grant_once.py` has already dispatched successfully. **Do not run it again.** Its
ignored exclusive claim is permanent; any uncertain outcome uses readback only.
This is capability completion, not repeated identity enrollment. No synthetic
actor audit entry was invented for the operator's grant transaction.

Safe fixed read-only checks remain available:

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 development/m07/live-settings/run.py discover
.\.venv-skills\Scripts\python.exe -X utf8 development/m07/live-settings/run.py readback
```

The initial read-only query incorrectly used audit_events.operation rather than
action and failed with private diagnostics suppressed. The corrected query and
subsequent UTC-pinned observations are separate from that failed attempt.

## Actual application checks

The browser saved UTC, acknowledged it and survived full reload. Canonical
revision2 retains its one intent key/request hash and browser audit request ID.
An existing Ready version's UTC source timestamp2026-10-29T22:40:07.982933Z displayed
Oct29 10:40PM. Restoring Africa/Cairo through the same app produced revision3 and
a separate stable intent/audit entry. Full reload shows Africa/Cairo; the same
version timestamp displays Oct30 12:40AM. Template1.1.0 and review default30days
remain unchanged. Other-grant and complete Ready-version preservation checksums
match before/after. These MD5 checksums compare database state; they are not
cryptographic authorization or archive identities.

The Processing page initially failed. Its read-only jobs request returned
CENTRAL_RESPONSE_INVALID/request64be858d-4633-4675-bed5-d3b56bd613ab. The central
parser accepted action flags only for presentation_render, while the actual M06
RPC also emits them for presentation_export. The correction accepts complete
typed flags for those two kinds, rejects them on unrelated kinds, and makes the
UI follow the server's export action flags. No job was retried or cancelled.
The protected M02 job remains untouched. A fresh signed-in response contains25
jobs, including four completed exports; Processing now renders successfully and
its timestamps use Africa/Cairo. The earlier empty time-element receipt records
the failure and is not timestamp acceptance.

The consent parser now accepts Supabase's omitted optional client URI/logo
fields, while retaining approved client/name/account/scope and redirect checks.
13 focused consent tests and19 focused job/UI-helper tests pass. Current full
quality passes751 module tests, lint, typecheck, production fixture denial and
build. EPS_TEST_SERVER=true selected isolated.next-e2e for this build; no
Playwright run or server on3100 occurred. Prior80 controlled desktop cases remain
historical evidence; this follow-up adds actual signed-in checks, not a new80-case
run. Manual screen-reader/M03 semantics stay pending; mobile stays skipped.

## Read-only provider findings

Dashboard screenshots in the linked evidence directory show OAuth Server off,
no OAuth apps, no Auth hooks, Site URL http://127.0.0.1:3000 and exactly the existing
http://127.0.0.1:3000/api/auth/callback redirect. JWT Keys shows current ECC P-256,
with the old HS256 key listed as previous; no key value, rotation or revocation
was read or changed. Auth2.197.0, PostgREST14.18 and Postgres17.11.0.003 were
visible in General settings. DCR and authorization-path controls remain
uninspected because the server is off; do not infer their configured values.

The next prepared local client is EveryoneStudioLocalM07, public/no secret,
PKCE S256/openid, exact callback http://localhost:3118/callback for installed
Claude Code2.1.301. Recheck port ownership at authentication time. The app's
explicit nonproduction HTTP-loopback resource is
http://127.0.0.1:3000/mcp; the issuer/JWKS remain existing central HTTPS.
No client UUID has been invented or registered. A coordinated current29 issuer
migration, exact original-profile proof, resource/client binding and narrow hook
registration must precede actual token issuance. Browser-control rules require
action-time confirmation before creating that delegated access; no such action
has been attempted. Hosted Claude and production release remain deferred.

Evidence is under
[live-settings-oauth](../../../tracking/evidence/m07/live-settings-oauth/).
The prior e4ffcca archive/scan remain exact historical artifacts and do not
contain this follow-up.
