# Configuration and operational defaults

Version 1.0 • All values below are proposed initial settings, not measured capacity.

## Configuration principles

Separate public browser configuration, server-only credentials, worker configuration and n8n credential references. Validate required configuration on service startup and fail with a redacted actionable message. The browser never receives a Supabase service-role key, database URL, OpenAI key, n8n credential, callback secret or token-encryption secret. Local fixture mode is explicitly disabled outside development/test.

Use environment-specific keys, callback audiences, webhook URLs and object prefixes. Record non-secret resource identifiers and versions in tracking/ENVIRONMENT_INVENTORY.md. Use the existing business secret manager and rotation process where available. The `.env.example` values are names/empty placeholders, not working credentials or assumptions about the user's actual setup.

## Required configuration groups

| Group | Key names / purpose | Runtime owner |
|---|---|---|
| App | `APP_BASE_URL`, `APP_ENV`, `DEFAULT_TIMEZONE`, `CENTRAL_ADAPTER_MODE` | Web/API and worker as needed |
| Browser | `NEXT_PUBLIC_APP_NAME`; Supabase public URL/key only if discovered auth client needs them | Browser-safe only |
| Database | `SUPABASE_URL`, discovered DB connection or restricted role credentials, schema adapter mapping | API; worker should use service endpoints where possible |
| Storage | `CAST_MEDIA_BUCKET`, `PRESENTATION_BUCKET`, `BRAND_ASSET_BUCKET`, upload policy limits | API/worker |
| Auth | Existing issuer/audience/JWKS/session integration, per-environment callback URLs | API/auth adapter |
| OpenAI | `OPENAI_API_KEY`, extraction/transcription/vision model IDs, prompt/schema versions | Backend/authorized workflow credentials only |
| n8n | Workflow webhook endpoints or IDs, credential references, dispatch/callback authentication | API dispatcher/n8n |
| Worker | `WORKER_BASE_URL`, scoped service auth, resource/time limits, temporary directory | Worker/API |
| Jobs | Per-stage concurrency, lease/heartbeat, retry maximum/backoff, dispatch cadence | Dispatcher/worker/n8n |
| Review | Default expiry 30 days, session lifetime, token entropy, playback authorization mode | API |
| MCP | Public resource URL, issuer/client configuration and scopes from M00/M07 | MCP/auth adapter |
| Telemetry | Existing logging/metrics error collector endpoint, sampling, redaction | All services |

The exact DB auth integration is discovered; do not add both service-role and unrestricted SQL access just for convenience. Grant only the needed app operations and object prefixes. Any service role that bypasses RLS must call validated domain operations and have separate tests for authorization boundaries.

## Initial workload settings

| Setting | Starting default | Why / adjustment |
|---|---|---|
| Specs extraction concurrency | 2 per environment | Begin conservatively; measure provider limits |
| Video processing concurrency | 2 per worker deployment | CPU/memory varies with codecs/duration; tune after real samples |
| PDF render concurrency | 1 per worker | Chromium resource use measured before raising |
| Retry maximum | 3 attempts for retryable stage errors | Validation/user-input errors do not automatically retry |
| Retry backoff | Exponential with jitter, bounded by stage policy and provider Retry-After | Avoid a retry storm |
| Heartbeat / lease | 20 seconds / 90 seconds initial | Long tasks renew; stale attempt fencing required |
| User job polling | 2–5 seconds while active; slower when backgrounded | Realtime optional; polling fallback mandatory |
| Review expiry | 30 days from creation | Confirmed duration; no renewal from generation |
| Private storage link TTL if used | Maximum 60 seconds initial | Bounded revocation window; proxy chosen for stricter request checks |
| Batch size planning | 200 candidate videos | Sizing target; actual upload limits derive from supported files and service/runtime capacity |
| Abandoned upload cleanup | Minimum 48 hours plus active-session/reference check | Proposed ops default; do not delete active uploads or referenced files |

These settings are not a guarantee of throughput or optimal cost. File duration, codec, resolution and file-size limits must be measured with representative uploads. A provider's audio request limit is separate from the original video upload limit; compress/chunk audio as needed while preserving transcript context. Report rejected type/size before expensive processing and keep unrelated files usable.

## Data retention

Thirty days applies to guest review links, not reusable candidates, original videos, PDFs or audit history. Do not automatically delete library media on day 30. Reuse existing business retention rules when discovered. Until then archive user-visible records without physically deleting objects referenced by a library profile, workspace, ready version or export. Cleanup may remove verified orphan temporary derivatives according to documented policy and reference checks.

Track immutable asset checksums, sizes, source relationship and storage key. A logical deletion/hide action must not silently break historical PDFs. When a business deletion request genuinely requires removing historical media, the authorized action should leave an honest unavailable-media response and corresponding audit record; do not substitute another person's or newer video's bytes.

## Service targets to establish during pilot

Measure p50/p95 upload completion, draft availability, PDF generation, API action latency, failure/retry and cost. Proposed interactive target: ordinary non-processing actions respond within 1 second server-side at normal load, autosave status resolves within 2 seconds under healthy connectivity. These are starting engineering goals, not measured SLAs. Processing targets must be expressed against file duration/resolution and tested concurrency, not an arbitrary fixed number of seconds for all videos.

Record actual operating limits and thresholds in the environment inventory after M03/M07 tests. Alert on oldest queued job, repeated stage failures, expired leases, backlog growth, render failures, provider authorization/quota errors, storage failures and elevated guest access-denial anomalies. Do not build a billing dashboard solely to display provider usage.
