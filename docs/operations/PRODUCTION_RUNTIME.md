# Production runtime configuration

The web and daemon accept `EPS_RELEASE_MODE=production` with `APP_ENV=production`
and `NODE_ENV=production`. This enables the release runtime; it does not establish
completed release acceptance. Existing `controlled_pilot` deployments remain
compatible with their current staging and duration rules.

Web production requires `CENTRAL_ADAPTER_MODE=supabase`, the canonical Supabase
origin `https://pyibofyctwnqpvktepse.supabase.co`, its publishable key and the explicit
public HTTPS `APP_BASE_URL`. Existing OAuth issuer/client/resource configuration,
private verifier keys, enabled upload features and bounded upload size remain
required by their respective services. Keep the existing origin and OAuth
registration unless an independently required change calls for updating them.
Production cannot use the fixture adapter, test server or local HTTP origin.

The daemon uses the same canonical origin/publishable key, existing scoped
database/provider/n8n configuration, Vercel production OIDC token file, all seven
worker feature flags and `EPS_NATIVE_TRANSPORT=vercel_sandbox`. Its baked native
manifest/hash and source seal must match. Management tokens, service-role keys,
generic database URLs and ambient credential fallbacks remain prohibited.

Remove `EPS_PILOT_EXPIRES_AT` or leave it empty when selecting production; a
nonempty deadline is refused. Production does not schedule pilot expiration.
`EPS_PILOT_OWNER_CONTROLLED` is unnecessary in production and can be removed.
Do not copy privileged worker configuration into the web project.

`npm.cmd start` now validates production mode and launches the installed Next
server in `apps/web`, on `0.0.0.0` and `PORT` (default 3000, integer 1..65535).
It forwards termination/interruption to its owned child and propagates failures.
The dedicated `tools/start-pilot-web.mjs` remains available for pilot mode.
Vercel serves the Next deployment directly and does not invoke this launcher.

For rollout, first test the final source and inspect the actual database history.
Apply only required compatible additive migrations; rebuild the changed daemon
with matching source/native seals, then deploy compatible web/API/MCP source and
configuration. Old jobs and saved versions retain their pins. Preserve the
previous compatible deployments and verify the actual stable alias, instance,
processing and authenticated/guest journeys before recording release completion.
This document performs no deployment, migration, rollback or configuration write.

## Local validation — 2 November 2026 (Africa/Cairo)

- The initial new tests reproduced five failures across runtime/build/worker/native
  admission and ordinary startup. The final focused group passed all 34 cases,
  including existing pilot compatibility and native ownership/cleanup checks.
- `npm.cmd test`, typecheck, lint and `check:production-guard` passed. Extra ESLint
  checks cover both MJS launchers and the new startup tests. Production-only
  `npm.cmd audit --omit=dev --json` reported zero vulnerabilities; the full install
  reported 12 moderate development findings. No lockfile or dependency was changed.
- Both the standard build and an explicit `production`/Vercel-configured build
  passed with synthetic public configuration. A mutation removing the worker's
  production `APP_ENV` restriction was detected, then original bytes were restored.
- The actual ordinary launcher started the built Next app on an owned loopback
  port. HTTP checks observed root307 to Projects, Projects200, unauthenticated
  API401, MCP401 with the configured Host, dev-session403 and dev-logo-probe404.
  Supervisor disconnect exited the launcher and closed its port.
- Earlier startup assertions expected root200, then incorrectly assumed Fetch
  would preserve the configured Host. They failed while all owned ports/processes
  were cleaned up. The passing run used the documented root redirect and Node
  HTTP with an explicit Host; application authorization was unchanged.

These checks use synthetic configuration and no authenticated provider request.
They do not prove a hosted rollout, real OAuth lifecycle, processing or release
completion. The release coordinator owns cloud configuration and final evidence.
