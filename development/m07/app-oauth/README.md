# App-side local OAuth controls

These operator helpers do not configure or log in Claude Code. Hosting remains
deferred; the local resource is http://127.0.0.1:3000/mcp and native client callback
is separately registered as http://localhost:3118/callback. The actual client UUID
must come from the provider registration, never from a fixture.

The current pre-activation baseline is recorded under
[app-oauth evidence](../../../tracking/evidence/m07/app-oauth/). The initial
public probe observed central/app discovery404 and unauthenticated MCP401 while
OAuth was disabled. That is baseline evidence, not configured readiness.

- `verify-readiness.mjs baseline|ready` contacts fixed local/public central URLs
  only. Ready mode checks actual protected-resource and authorization metadata,
  public signing key metadata, unauthenticated/synthetic-invalid bearer challenges,
  wrong Host denial, malformed selector and CSRF denial, and the consent HTML.
  It never sends cookies or real credentials, creates an authorization request,
  calls valid authorization details, approves consent, exchanges a token or
  starts a client login. A401 precedes protocol initialization and proves no
  authenticated business operation.
- `bind-client.py inspect` performs a fixed read-only registry/history/Settings
  projection. `apply` is root/operator-only after coordinated issuer30 and one
  real public-client registration. It renders only the validated UUID/history,
  pins the exact issuer function body/owner/private execution boundary, refuses
  any existing registry entry, and inserts one enabled resource/client tuple.
  Existing disabled/remembered rows are never removed or reactivated. It
  preserves Ready versions, Settings and business capability grants. The
  ignored exclusive dispatch claim is permanent; uncertain application means
  read-only inspect, never blind repeat.
- `configure-local.mjs` consumes the independently read-back real binding and
  appends only four public MCP settings to ignored apps/web/.env.local. It
  validates the canonical project and source-bound readback, refuses conflicting
  existing values and preserves every original configuration byte. It writes
  no client secret or Claude configuration. File configuration alone is not
  runtime readiness; the root must restart the owned web process and run the
  public ready probes.

Provider OAuth enablement, the single public app and native hook selection are
separate authenticated dashboard actions. Their actual readback and effective
database privileges must be verified. Keep the existing Site URL, ordinary
login callback, signing key, business permissions and unrelated clients intact.

Do not use a generic Studio delete/replace-hook action as an automatic rollback:
its current upstream implementation can grant execution back to PUBLIC/anon/
authenticated. Keep fail-closed app/resource disabling separate; any hook
removal requires a reviewed coordinated function/ACL forward fix and readback.

Signed JWT issuance, hosted gateway/PostgREST acceptance, refresh/revocation and
the actual Claude client connection remain distinct from public readiness.
The owner performs client configuration/login. AT-072 and broader independent
M03 checks stay pending, mobile stays skipped and production release remains
unverified.
