# Configuration and operational defaults

## Current configuration ownership - 2026-11-03

This current section supersedes the dated runtime claims below. Those original
observations, sizing proposals and key-name planning tables remain historical.
Read the [operations runbook](DEPLOYMENT_AND_RUNBOOK.md),
[current worker record](../../tracking/WORKER_CUTOVER_CURRENT_2026-11-02.md)
and [current handoff](../../tracking/HANDOFF.md) before a configuration change.
No credential values were read or added for this update.

| Configuration surface | Owner and accepted boundary | Recovery rule |
| --- | --- | --- |
| Web/API/MCP | Existing Vercel pilot project and stable alias; Ready4gdh serves exact Main514. Root quality passed1030 tests plus types/lint/production guard. | Use normal existing CLI authentication and a fresh guarded purpose; preserve project/team, source/archive/build metadata, environment and two equal alias/direct identities. |
| Canonical business/configuration | Existing central target, history42 and five enabled processing configurations. Actual42 nonce/full76 reason and seven-body preservation are recorded below. | Follow coordinated history and exact raw preimages/attributes; do not reset, seed or replay a consumed migration/claim. Checkpoint retention is not restore acceptance. |
| Worker/native identity | Existing Fxd daemon with retained native3d. The PDF metadata change does not enter the54-module native or91-module daemon graphs; a broader167-file seal can still change. | Keep native/daemon source, manifest, compatibility and image identities distinct. No worker/native build or probe follows from the web source change. |
| OpenAI specs | Production startup explicitly selects bounded streaming:300000ms,32768 output tokens and low reasoning, with the configured evaluated model. | Preserve the frozen job/model/prompt contract and SDK zero-retry/bounded transport; no model or budget change is authorized by this document. |
| OCR and media | Vision receives its own `openAIMediaConfigFromEnv('extraction', env)` configuration; its default is60000ms and media hard maximum70000ms. | Do not pass the300000ms specs profile into OCR/media or widen the media cap. Native image and frozen-model checks remain separate. |
| Secrets and orchestration | Existing server/worker secret stores and n8n credential references; browser gets only reviewed public configuration and acting-user authority. | Configuration owner handles sign-in/consent/rotation. Do not expose tokens, full session objects, private URLs, service keys or environment values in handoffs/logs; do not relink or provision duplicate identities. |
| Operational access | Existing Claude connection and acting-user scope; normal hosted API/MCP validation remains fresh per request. | Do not infer a signed OAuth flow from an owned fixture or relax grant/session/clock checks. Reconcile temporary access through its exact dated cleanup evidence. |

The reviewed seven public build fields are `APP_ENV`, `EPS_RELEASE_MODE`,
`NODE_ENV`, `CENTRAL_ADAPTER_MODE`, `APP_BASE_URL`, `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY`. Their existing values are reused through guarded RAM
input preparation, not copied here or pulled into a new environment. Server-only
OpenAI/n8n/callback credentials stay outside this public set. Actual supported
names and refusal rules live in startup validators and `.env.example`; generic
historical names below are not instructions to create new secrets.

The [schema42 apply](../../tracking/evidence/m07/presentation-generation-compact-release/2026-11-03T13-18-27-651163Z-apply.json)
plus [Root audit](../../tracking/evidence/m07/presentation-generation-compact-release/Root-2244e718-postapply-audit.json)
preserve all76 current row multisets/reasons and non-target metadata. The compact
read projection reuses only immutable body text; it does not cache authorization,
sessions, clocks or current query results. Preflight uses two fresh same-RR
canonical/idle observations and two worker identity GETs after build. Its seven
zero lifecycle counters are dated observations, not a perpetual idle guarantee.
Cached Ready metadata is not a fresh worker heartbeat.

The [actual1030-test quality](../../tracking/evidence/m07/completion-release/2026-11-03T14-14-04.950Z-235ee1b3-pdf-metadata-root-quality.json)
and [Ready web readback](../../tracking/evidence/m07/presentation-pdf-metadata-web-forward-release/2026-11-03T14-44-32-244101Z-b5e29aa2-7f3e-4a7a-8fe2-e1246a0ab705-readback.json)
are separate from [Root's scoped HTTP/UI result](../../tracking/evidence/m07/completion-release/Root-4gdh-production-metadata-and-UI.json).
The latter confirms the13-field PDF metadata read, refreshed Selection and
anonymous401; existing-Claude metadata confirmation is still pending. Full M07
remains false. No capacity/SLA, fresh heartbeat, new full-media download, RTO/RPO
or private production restore claim follows from these configuration records.

AT069's automatic approval rejection remains **blocked by policy**. Do not retry,
use an equivalent/manual transport or substitute a provider action for the
rejected rollback preparation. Narrator/screen-reader, contributor and mobile
remain skipped, not passed. AT060's authorized real200 corpus/workload remains
open; do not reinterpret the historical synthetic measurements as that proof.

## Retained 2026-10-30 configuration and sizing record

Updated2026-10-30 for the implemented local M07 sources and dated evidence. Hosting is deferred. The current runtime facts below take precedence over earlier sizing proposals; none is a production capacity or SLA claim. See the [M07 acceptance matrix](../../tracking/evidence/m07/ACCEPTANCE_MATRIX.md) for verification boundaries.

## Implemented configuration and observations

| Area | Actual implementation / observed scope | Remaining boundary |
| --- | --- | --- |
| Web/API | Configured development origin `http://127.0.0.1:3000`; central mode uses `SUPABASE_URL` and publishable `SUPABASE_PUBLISHABLE_KEY`, plus the acting user's verified identity. Controlled browser fixtures use3100 separately. | Recheck owned processes before use. No public origin or deployment selected. |
| Worker scheduling | `runSpecsWorker` has one serial loop per process, one claimed outbox event at a time; default poll3000ms, recovery30000ms and at most25 recovered jobs per pass. Heartbeats20s and SQL stage leases90s. | A native-call ceiling of two does not create two concurrent scans in this serial worker. No scale/endurance proof. |
| Native diagnostic | A separate bounded-two scheduler processed200 distinct tiny synthetic MP4 hashes:198 successes, two expected terminal failures,199 native requests, six full preparations and one explicit pre-native retry. | [Workload evidence](../../development/m07/WORKLOAD.md) is neither representative video scanning nor deployed worker tuning. |
| Settings and displayed dates | Constrained migration29 is installed locally and canonically. Typed UI/HTTP/MCP operations support versioned timezone/template defaults; expiry stays30days and models remain read-only. Capability timezone now reaches the session and shared display context; UTC storage/frozen PDFs and browser-local expiry editing stay distinct. | [Canonical one-time apply](../../tracking/evidence/cloud-m07-29/2026-10-30T11-52-15-216806Z-3a0afd9f-apply.json) and [independent readback](../../tracking/evidence/cloud-m07-29/2026-10-30T11-52-36-310355Z-f553771a-readback.json) pass. [New owned runtime](../../tracking/evidence/m07/runtime29-transition/2026-10-30-owned-processes-ready.json) is running. [Actual Settings page](../../tracking/evidence/m07/live-app/2026-10-30-settings-sign-in-pending.json) loaded signed out; authenticated values/write proof awaits user sign-in. Controlled timezone/defaults tests remain separate. |
| MCP local mode | `MCP_AUTH_MODE=local` is the default central-mode loopback development/test path; it is disabled in production. Official SDK/core/client2.4.0; Node24.18.0. | Ordinary browser JWT verification is not resource-specific OAuth acceptance. |
| MCP OAuth mode | Explicit `MCP_AUTH_MODE=oauth`, `MCP_RESOURCE_URL`, `MCP_AUTH_ISSUER`, `MCP_AUTH_CLIENT_IDS`; resource URL equals the configured origin plus `/mcp`, issuer is pinned to existing central HTTPS `/auth/v1`. Only `openid` is advertised; issuer-signed `eps_delegation` and fresh session/business capabilities limit authority. | [Auth](../../development/m07/MCP_AUTH.md), [transport](../../development/m07/MCP_TRANSPORT.md) and [consent/setup](../../development/m07/OAUTH_CONSENT_SETUP.md) are implemented/controlled evidence. Live issuer enablement, client registration, issuance hook, refresh and revocation are unverified. |
| Protocols and clients | Controlled SDK tests cover2026-07-28 modern and2025-11-25 legacy. An actual Claude Code2.1.301 smoke exercised five business calls over synthetic ports; original exact protocol revision was not captured. | This is client compatibility, not the full real-service delegated journey. The later deterministic capture fix is not retroactive wire proof. |
| Private delivery | Guest/version/PDF-grant companions recheck parent scope per request; transient Storage capabilities are separate. Shared-media `/media/{id}/content` is a non-range binary companion; candidate `play_media` uses90s signed access. | Do not apply a proposed universal60s signed-link default to the actual90s candidate playback adapter. Delivered/downloaded bytes cannot be recalled. |

After29, the authenticated native-service startup check passed all12 exact operations on2026-10-30T11:53:17Z; it claimed no job and invoked no provider. [The new owned web/worker processes](../../tracking/evidence/m07/runtime29-transition/2026-10-30-owned-processes-ready.json) are now running; serving app identity/ownership is recorded separately from authenticated Settings acceptance. Hook30 passed seven local SQL stages but is neither migrated nor provider-enabled; do not treat installed29 as OAuth activation. Read `.env.example` and the actual startup validators for exact supported names. Do not copy values from private runtime files into documentation. The original generic groups below remain a planning map where their names differ from implemented adapters.

Current scoped quality passes747module cases,80 correctly selected desktop cases, typecheck/lint/build/production guard, with656quality source bytes unchanged: [final scope](../../tracking/evidence/m07/quality/2026-10-30-final-documentation-overlay.json). The older87-case desktop label was overbroad: seven mixed tests also ran320px assertions despite the skip flag. Those receipts remain historical and provide no mobile acceptance; [the final80selection](../../tracking/evidence/m07/quality/2026-10-30-desktop80-final.json) explicitly excludes all seven. Mobile remains an owner-skipped gate.

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

## Earlier sizing proposals — not current runtime settings

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

The earlier workflow proposal of four active scans/two heavy tasks/two PDF renders and the table's two video/one PDF defaults are unmeasured proposals. Neither overrides the actual serial loop above. The200-file diagnostic completed in250775ms with attempt p50/p95 of2429/2835ms, including local Docker overhead; its median/p95 admission delay was123639/235457ms. Almost all eligible calls were probes of0.32s160×90 footage without audio. No real processing cost estimate, SLA, cloud queue latency or production concurrency recommendation follows from those values.

## Data retention

Thirty days applies to guest review links, not reusable candidates, original videos, PDFs or audit history. Do not automatically delete library media on day 30. Reuse existing business retention rules when discovered. Until then archive user-visible records without physically deleting objects referenced by a library profile, workspace, ready version or export. Cleanup may remove verified orphan temporary derivatives according to documented policy and reference checks.

Track immutable asset checksums, sizes, source relationship and storage key. A logical deletion/hide action must not silently break historical PDFs. When a business deletion request genuinely requires removing historical media, the authorized action should leave an honest unavailable-media response and corresponding audit record; do not substitute another person's or newer video's bytes.

## Service targets to establish during pilot

Measure p50/p95 upload completion, draft availability, PDF generation, API action latency, failure/retry and cost. Proposed interactive target: ordinary non-processing actions respond within 1 second server-side at normal load, autosave status resolves within 2 seconds under healthy connectivity. These are starting engineering goals, not measured SLAs. Processing targets must be expressed against file duration/resolution and tested concurrency, not an arbitrary fixed number of seconds for all videos.

Record actual operating limits and thresholds in the environment inventory after M03/M07 tests. Alert on oldest queued job, repeated stage failures, expired leases, backlog growth, render failures, provider authorization/quota errors, storage failures and elevated guest access-denial anomalies. Do not build a billing dashboard solely to display provider usage.
