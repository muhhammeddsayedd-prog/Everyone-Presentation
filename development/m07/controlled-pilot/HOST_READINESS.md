# Controlled pilot: public preflight and future version origin

Prepared 2026-10-30. The bounded hosting pilot is authorized; final Studio
production acceptance remains unverified. AT-072 and broader M03 semantic checks
remain pending, and mobile testing stays skipped.

## Fixed target and current evidence

The root's [web configuration receipt](../../../tracking/evidence/m07/controlled-pilot/2026-10-30T20-31-58-027Z-15649709-web-configure.json)
reserves **https://everyone-presentation-pilot.vercel.app** for project
`prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0`, team
`team_gboXPxTevpCOZuaA8eY9PmR1`. It verifies Next.js, `apps/web`, Node24 and
outside-workspace files. That receipt explicitly performed no deployment and
transmitted no private configuration. A reserved, verified domain is not a
serving application or a working cloud worker. A later independent
[runtime observation](../../../tracking/evidence/m07/controlled-pilot/2026-10-30T21-37-26.661Z-ce710faa-runtime-state.json)
confirms web deployment `dpl_GPRog6HbnXNGpciqRi7TdypUCKM7` is Ready and assigned
to that stable host. The native repository was private and empty at that observation.

The [public probe](public-host-probe.mjs) pins this host, project/team and the
exact configuration-receipt hash. It accepts no target/credential arguments and
does not read environment files. Importing it performs no request. Its seven
[unit cases](public-host-probe.test.mjs) use synthetic responses only; they are
not host, identity, database or provider evidence.

## Run only after the root reports a deployed app

From the repository root, the operator can run:

```powershell
node development/m07/controlled-pilot/public-host-probe.mjs
```

The root ran it against the real host: the latest
[receipt](../../../tracking/evidence/m07/controlled-pilot/2026-10-30T21-11-56-083Z-c9280f97-public-host.json)
passes all six checks. An earlier five-check receipt retained a wrong root200
expectation; the implemented root correctly redirects to Projects. It makes six
GET requests with credentials omitted, no Cookie/Authorization/Origin headers,
no query selectors, manual redirects, eight-second request deadlines and bounded
response bodies. It never calls consent, sign-in, a valid guest selector, a
token endpoint or a model. It never approves or consumes an existing consent.

| Read | Expected observation |
| --- | --- |
| `/` | HTTP307, exact same-origin `/projects` destination, no redirect follow. |
| `/projects` | HTTP200, Studio title, nosniff and no Set-Cookie. |
| `/api/session` | HTTP200, closed central signed-out DTO with no actor or fixture actors, private/no-store. |
| `/api/v1/projects` | HTTP401/AUTH_REQUIRED, private/no-store. |
| `/api/v1/settings` | HTTP401/AUTH_REQUIRED, private/no-store. |
| `/api/dev/session` | HTTP403/ACCESS_DENIED, private/no-store; development identity access is denied. |

An unexpected response or deployment-protection redirect fails without following
it. Only statuses, fixed paths, validation booleans and bounded UUID request IDs
are published. Raw bodies, headers, cookies, redirect destinations and transport
diagnostics are omitted. The new immutable receipt is written under
`tracking/evidence/m07/controlled-pilot/`; it proves only public admission.
Resolve deployment protection through the root's reviewed project/domain setup,
without putting a bypass credential in a URL or client configuration.

## Change the application origin for future captures

The [M05 migration](../../../supabase/migrations/20261029215218_m05_immutable_presentation_versions.sql)
defines `eps.presentation_processing_config.application_origin`. Generation
copies it into `snapshot.render_configuration` and the durable render-job input.
The [native PDF adapter](../../../apps/worker/src/presentation-pdf.ts) uses that
captured origin for original-media links. Existing snapshots and PDF bytes must
remain frozen; their old loopback hyperlinks are not converted by hosting.

[FUTURE_VERSION_ORIGIN.sql](FUTURE_VERSION_ORIGIN.sql) is reviewable, fixed DML for
the root to execute after the host is ready and before a new generation. It is
not a migration, has not been executed, and has no automatic dispatcher here.
The root must bind the established operator connection to canonical project
`pyibofyctwnqpvktepse`; database/user names alone do not prove that target.

The SQL requires the exact ordered30 history and an unchanged single old-origin
configuration row. It refuses unexpected config triggers or active presentation
jobs, locks the relevant configuration/version/media rows, and updates exactly
one `application_origin` from `http://127.0.0.1:3000` to the fixed pilot origin.
All other configuration columns must match their fresh baseline. The root must
quiesce generation/processing for this short change; it does not cancel jobs.

Before/after checks preserve all version/snapshot, slide and pin fingerprints,
Ready asset checksum metadata, and the protected M02 job's public state plus
its manual instruction/spec revision hash. No raw snapshot/spec text is emitted.
There is no Auth/key-table read, credential hash, client/resource registry
assumption, DDL, job retry, Ready backfill or PDF regeneration. These are scoped
metadata checks, not fresh Storage-byte verification or a full database backup.

Use [FUTURE_VERSION_ORIGIN_READBACK.sql](FUTURE_VERSION_ORIGIN_READBACK.sql) for a
separate read-only observation and to reconcile any unknown commit outcome.
Compare its protected metadata with the update receipt. Do not blindly repeat
the update: an already changed origin deliberately refuses another write. Do
not reuse the frozen issuer30 empty-registry readback after intentional bindings.

## Hosted core acceptance remains a separate root journey

After public admission, use the existing permitted Producer in the normal app.
Keep account/session/grant URLs private; record safe IDs, timestamps, statuses
and hashes. Verify the actual hosted session, central project/workspace reads,
Settings read/write/reload, and denial of fixture identities. Then exercise
authorized upload/processing through the deployed worker, existing n8n and
OpenAI, durable job polling and saved results. No synthetic identity substitutes
for that journey.

Before generating, verify the origin update/readback. Generate a new captured
version and confirm the captured pilot origin, Ready state, PDF page/content and
original-media links, including a PDF above Vercel's buffered-response limit.
Existing versions, Reviewed facts and protected M02 must retain their earlier
state. Any failure remains a bounded pilot finding; do not lower limits or
rewrite historical snapshots to make the check pass.

Hosted OAuth/MCP follows working core services: validate public discovery and
the exact HTTPS resource, real client/callback/issuer bindings and live signed
claims/session/current permissions. The owner configures and logs into Claude.
Public preflight, local fixtures and metadata-only SQL do not establish that
delegated journey, provider invocation, refresh/revocation, restore or final
production readiness.
