# Local API and MCP transports

The central browser, direct acting-user API and local `/mcp` adapter share the
same Central domain/RPC operations. The implementation filters the design MCP
catalog to implemented operations and validates their self-contained schemas.
Future tools and private service callbacks are not advertised. It returns the
same request/data/error envelopes as HTTP, including scoped permission errors,
row versions, durable job identifiers and pagination.

The official MCP TypeScript server/client2.4.0 was checked against the official
[release](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v2.4.0)
and [serving documentation](https://ts.sdk.modelcontextprotocol.io/v2/).
It supports the2026-07-28 specification and the SDK's stateless legacy fallback.
Deterministic tests exercise both an actual SDK client/server connection and its
Streamable HTTP handler. These tests use synthetic operation ports; they do not
establish external Claude OAuth or deployed-client acceptance.

`/mcp` is enabled only for a loopback central development/test app. It accepts the
existing signed-in same-origin browser session or a verified acting-user bearer
token. The server derives the principal from that request. Tool arguments cannot
set an actor, role or credential. The adapter never substitutes service-role
authority. A browser session is not an interoperable OAuth authorization server;
remote OAuth, protected-resource metadata, audience/issuer checks and actual
Claude client refresh/revocation acceptance remain M07. Hosting stays deferred.

## Private service callbacks

`POST /api/v1/internal/jobs/{claim,events,complete,fail}` and the three output/access
routes are a separate service boundary. They require a dedicated bearer secret
and current database stage lease. Browser cookies, Origin-bearing requests,
acting-user tokens and unknown routes are rejected before opening the private
runtime. The same restricted SCRAM/TLS PG adapter supplies only fixed operations;
it has no direct table/Auth authority or arbitrary SQL/URL operation.

The local service is disabled unless its protected configuration is available.
`tools/provision-job-service-local.ps1` creates `.env.job-service.local` once with
two independent random32-byte secrets and owner+SYSTEM-only permissions. It does
not print credentials or replace an existing file. `tools/dev-central.mjs` loads
those three fields and only the three existing narrow PG fields. OpenAI/n8n
management credentials are excluded from this loader. Never paste these files in
chat, tracking artifacts or API/tool arguments.

Claims require a stable `Idempotency-Key`. Migration14 atomically stores an
AES256-PGP-encrypted response under the service/key intent; the encryption key is
not persisted in the database. Same-key replay returns the active lease across
web-process restarts while rechecking requester permissions, source and attempt.
Expiry/cancellation/new attempts deny replay. Ciphertext expires at the original
lease boundary and is scrubbed in bounded later claims; hash tombstones prevent
intent-key reuse. A later heartbeat does not extend that claim-response cache.

For events/complete/fail, use `event_id` as `Idempotency-Key`; the database's exact
event payload/sequence/fence validation supplies durable replay. `events` accepts
heartbeat/progress, `complete` accepts succeeded, and `fail` accepts failed. The
result schema dispatches validation; arbitrary table patches are unavailable.
Output keys are immutable within a job attempt. Original/derivative transfer
grants are exact-object, current-lease scoped and short lived; credentials remain
in private headers. This local facade is not a hosting decision.

`node --import tsx tools/check-specs-files-runtime.mjs` with the documented file
mode checks credential authentication, TLS and effective ACLs without claiming
jobs, reading source or contacting OpenAI/n8n/Storage. Its effective function
count is observed, with ten base specs functions and an optional eleventh claim
replay function. Earlier constant-ten receipts describe the base count and are
retained as historical evidence.

## Candidate stages

Migration17 routes `candidate_scan` through the same restricted runtime functions
and executor groups. It adds no direct runtime table access or extra runtime
EXECUTE operations: a configured file-mode runtime still has exactly eleven
operations including encrypted claim replay. The gateway accepts that known
catalog with candidate uploads disabled; its candidate asset port is exposed
only when the validated candidate flag is enabled.

Stages run in this order: `prepare_candidate`, `transcribe_candidate`,
`extract_candidate`, `select_frames`, `apply_candidate`. Private stage payloads
retain transcript/evidence, while public job completion metadata contains opaque
stage output IDs. Native preparation verifies original bytes before marking the
video ready. Missing audio, exhausted provider processing or insufficient frames
can produce a partial candidate with safe `processing_issues`; raw provider
errors remain private. Final apply checks the current lease, requester, source
and target row version, and preserves existing reviewed facts and project media
choices.

Original videos use `eps-candidate-assets`; job derivatives use
`eps-candidate-outputs`. Both buckets are private. Exact-object transfer
capabilities expire within sixty seconds and derive from the active stage lease.
The native/database video ceiling is 256 MiB, but admission must also honor the
currently measured Storage/API ceiling; a database limit does not prove that the
hosted Storage service accepts that size. SQL control-plane fixtures and the
200-item scheduling exercise do not prove native/provider throughput or real
media accuracy.
