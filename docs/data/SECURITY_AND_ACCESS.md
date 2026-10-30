# Access, authorization, and data boundaries

## M07 current shared permission boundary

The applied29 boundary constrains remembered Studio client/delegation JWTs through `eps.mcp_token_permits_capability` in the shared `eps.has_capability` gate, plus current user/client/session/resource and active capability grants. A delegated token cannot bypass its restriction by calling a public business RPC directly. Normal browser/unrelated-client behavior is preserved. MCP separately verifies signature/issuer/exact audience/approved client and current session. [Auth contract](../../development/m07/MCP_AUTH.md), [local issuer candidate](../../development/m07/oauth-hook/README.md) and [applied readback](../../tracking/evidence/cloud-m07-29/2026-10-30T11-52-36-310355Z-f553771a-readback.json) have separate scopes. Provider OAuth, client registration, hook activation and live revocation remain unverified. Retain disabled registry rows rather than deleting remembered client identities.


**Implementation contract, 27 October 2026.** This is part of the app design, not evidence of a completed security review or a configured Supabase project. Read [the baseline](../../CONTRACT_BASELINE.md) and [schema](DATABASE_SCHEMA.md). M00 maps these capabilities to the existing business identity and project-access system.

## 1. One authorization model for every client

The web UI, HTTP API and MCP tools invoke the same domain operations. An operation receives a server-validated actor context: canonical principal identity, authenticated client type, capability grants, project scope where applicable, and request ID. A request body cannot choose its own actor, role or project authorization.

Claude has full operation parity with the user it represents. If that user may confirm a profile, assign a Main, generate, download or manage a review link, Claude can do it through the same operation. No extra human approval flag is added because the client is an AI agent. An audit field identifies the client for traceability. Service workers are different: they execute constrained processing jobs and do not inherit a producer's arbitrary interactive powers.

Central project access and app capabilities are separate checks. A designated casting editor may have global library editing privileges but still lack access to a particular business project. A central administrator is not automatically a casting producer merely because their role label contains “admin.” Resolve actual grants, not label guesses.

## 2. Capability matrix

The following are implementation defaults to map to existing roles. They express behavior, not a request to create a second employee account database.

| Operation | Required capability | Required scope | Guest access |
|---|---|---|---|
| List/open available business projects | `projects.read` | Canonical project permission | No |
| Edit shared project/client details | `projects.write` | Canonical field/entity write permission | No |
| Open Casting workspace | `workspaces.read` | Project read | No |
| Correct specs, roles, slots; organize project work | `workspaces.write` | Project write | No |
| Search/reuse historical library | `cast.read` | Approved internal casting library user | No |
| Upload files | Purpose-specific: candidate media `cast.upload`; specs `workspaces.write`; shared client logo canonical project/client write | Authorized project or approved library intake | No |
| Correct reusable candidate facts | `cast.write` | Producer/designated casting editor | No |
| Mark profile Reviewed | `cast.review` | Producer/designated casting editor | No |
| Choose candidate's project media/availability | `workspaces.write` and `cast.read` | Project write; permitted candidate | No |
| Assign, shortlist, Main/Backup/Option, slide wording | `workspaces.write` | Project write | No |
| Generate version/PDF | `presentations.generate` | Project write | No |
| Create/extend/revoke review links | `review_links.manage` | Project write and series access | No |
| View shared version/media | Valid unexpired link/session | One external series, permitted pinned version | Yes |
| Read external comments/preferences | Valid link/session | Same series/version | Yes, all external reviewers see each other's feedback |
| Add/edit own comment/preference | Named valid guest session | Own session + visible version slide | Yes |
| Read internal notes | `workspaces.read` | Project read | Never |
| Download shared PDF | Valid link/session and downloads enabled | Viewed version belongs to series | Yes |
| Inspect processing | `operations.read` | Accessible jobs/projects | No |
| Retry/cancel processing | `operations.retry` | Authorized job/project | No |
| Manage app presets/settings | `settings.manage` | Business app settings scope | No |

Authorization should return UI capabilities with resource projections so the app can show useful controls. Hiding a button is not enforcement; every operation rechecks the applicable permissions server-side. A contributor may prepare project work without being allowed to change shared cast facts or mark a profile Reviewed.

## 3. Database access architecture

Use `eps` as a private schema, with no direct `anon` or `authenticated` grants on its tables. The application server is the normal entry point. RLS remains enabled on app tables as a second boundary; a private schema alone does not make a broadly privileged runtime safe.

**Preferred implementation after M00:** a non-owner, non-`BYPASSRLS` application database role, with explicit narrow grants. The server validates the user's credential before setting transaction-local trusted actor context. RLS helper functions resolve that context against the canonical permission adapter. Keep request context local to a transaction so connection-pool reuse cannot leak one actor into another request. Never accept context-setting SQL or principal IDs directly from browser/MCP request data.

If the existing ecosystem uses user-scoped Supabase RPC instead of a direct database connection, expose only curated wrappers in its existing API schema and keep `eps` internal. Wrappers derive identity from verified auth context, recheck scope, and use the same transaction contracts. M00 records which integration is implemented; do not silently switch to a service-role bypass for convenience.

The service callback runtime uses a separate database role with **no direct table DML** and execute-only access to narrow job/output functions. Those functions run with a constrained owner, fixed safe `search_path`, explicit execute grants, and service identity plus current job/stage/attempt/lease validation. They enforce exact input/output/workspace scope before changing rows. This is the deliberate service path; user RLS alone is not claimed to authorize background callbacks. Do not expose these functions as general SQL or MCP tools. The normal user runtime cannot forge this service context.

Where the reference's FORCE ROW LEVEL SECURITY is retained, function ownership alone is not an authorization mechanism. Use a dedicated non-login function-owner role with grants limited to required app objects and explicit service-policy predicates derived only inside validated job operations. Establish and clear transaction-local service scope through trusted function code; the externally callable surface must never accept arbitrary scope-setting SQL. Test the actual service role/definer/policy combination can complete its own leased job and is denied cross-job writes. Do not resolve a policy failure by giving a general runtime unrestricted owner/BYPASSRLS access.

A narrowly scoped backend credential may be necessary for worker callbacks or storage signing. Keep it server-side and confined to functions that authenticate the caller and validate exact resource ownership. A service key is not evidence that a guest or user may access all records. Do not pass database owner credentials, Supabase service credentials, OpenAI keys, n8n secrets, or token encryption keys to frontend bundles or MCP clients.

### Database helpers

Implement the following logical checks against the discovered identity model:

- `current_actor_principal()` — validated request identity; null without trusted context.
- `has_capability(principal, capability)` — current centrally backed grant.
- `can_access_project(principal, project_binding, action)` — validates the binding's actual canonical record and project access.
- `can_access_workspace(principal, workspace, action)` — combines project permission and capability.
- `can_access_candidate(principal, candidate, action)` — approved library access plus edit/review grant where required.
- `can_access_asset(principal, asset, action)` — follows a permitted workspace/library relation, never merely matches the uploader's name.
- `validate_review_session(session, series, version)` — server-only link/session checks; never made into a blanket `anon` table policy.

Use schema-qualified objects and a fixed safe `search_path` for privileged functions. Default to invoker security when possible. Any `SECURITY DEFINER` function needs explicit authorization, a constrained owner and explicit execute grants; revoke default public execution. Supabase documents the distinction between object grants and RLS, and recommends making the exposed API surface explicit: [Securing your API](https://supabase.com/docs/guides/api/securing-your-api) and [Database functions](https://supabase.com/docs/guides/database/functions), verified 27 October 2026.

### Policy families

| Tables | Read policy | Write policy |
|---|---|---|
| `integration_bindings` | Resolve only permitted canonical entity; server integration metadata not wholesale client output | Integration adapter only after central existence validation |
| `workspaces`, `specs`, `roles`, `slots`, `workspace_candidates`, `assignments` | Authorized project read | Authorized project mutation through invariants |
| `candidates`, `candidate_media` | Approved library user; only allowed fact projection | Casting editor/reviewer capability; scan service restricted to created/expected record |
| `media_assets` | Authorized library/project/version asset relation | Upload reservation owner or scoped worker output; object key immutable |
| `audience_presets` | Permitted producer preset list | `settings.manage`; changes affect future series only |
| `presentation_series`, `presentation_versions`, `version_slides` | Authorized project access | Generation operations only; snapshot content append-only |
| `review_links`, `guest_sessions`, `review_media_grants`, `presentation_exports` | Link manager/server projection; digests never sent to clients | Link/session operations only |
| `feedback_comments`, `feedback_preferences` | Internal project users; guest API external-only projection | Named guest's own response or authorized internal actor |
| `jobs`, `job_events` | Authorized project/operations scope | Job operations and current authenticated attempt only |
| `outbox_events`, `idempotency_records` | Runtime/operations only | Dedicated transaction/dispatch functions |
| `audit_events` | Restricted operations/project audit projection | Append via trusted operations; no ordinary update/delete |

RLS tests run using the actual non-owner runtime roles. Tests that connect only as database owner or service role do not prove row isolation. Supabase's [RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) describes database-enforced row policies; use it to verify the deployed role/grant behavior, not merely that `ENABLE ROW LEVEL SECURITY` appears in a migration.

## 4. Guest review boundary

The external URL `/r/:token` is a bearer capability, not an authenticated client account. Anyone with its valid token can view its allowed content. It grants access to one external presentation series and the media/PDF explicitly referenced by its versions; it grants no Cast Library, central project browsing, original specs, internal notes, other series, or candidate contact details.

Generate at least 256 bits of randomness for review and session tokens. Store a digest, compare safely, and return a generic unavailable response for invalid, expired or revoked links. Set the default expiry to 30 days at creation; an authorized manager can change expiry or revoke. Advancing to a new version does not extend expiry.

Exchange the URL token for a short-lived secure session where feasible. Redact path/query tokens from logs and error trackers, use a restrictive referrer policy, avoid third-party analytics on review pages, and do not cache personalized review responses in a shared public cache. Cookies carrying sessions are Secure and HttpOnly; apply SameSite/CSRF protections to state-changing browser requests. The URL remains shareable because opening it establishes the scoped session again while valid.

View works before identity entry. Before the first comment or preference, collect a display name and optional company. Remember the name for convenience. The session's opaque identity, not that name, determines whose feedback can be edited. All valid guest sessions for the same series see all external feedback. Internal comments/notes must be filtered at the query/projection level, not merely hidden in CSS.

M06's canonical guest gateway accepts credential digests only together with an independent backend HMAC over the exact operation, canonical input, issued-at millisecond timestamp and single-use nonce. A database token digest by itself is therefore insufficient to authorize a request. The proof key is distinct from the AES-GCM creation-replay key; neither reaches browser, MCP, worker job payloads or public receipts. Proofs allow at most30 seconds of future skew and60 seconds of age; nonce replay is rejected. The narrow public wrapper grants no anonymous table access and delegates to private constrained functions.

Browser exchange uses scoped HttpOnly SameSite=Strict cookies and returns no raw session value. A public guest-session context selects the matching cookie, preventing another link tab from silently changing the first tab's author. Browser writes validate the exact configured Host and Origin. Explicit API credential headers may omit Origin; supplied foreign Origin is denied. The app applies bounded global/credential request windows and returns Retry-After on429; database controls remain independent.

Each guest byte request mints a transient60-second asset capability, retains only its digest, and sends the raw capability only to private Storage in a dedicated header. Storage policy repeats session/grant, parent link, generation, expiry, fixed-version and asset membership checks for every request. The application proxies a single validated byte range; it never exposes the Storage capability or signed URL. Previously delivered bytes remain outside revocation's reach.

The viewer requests an exact version ID when sending feedback. The server verifies that the viewed version belongs to the link's series, is Ready, and contains the target slide. A newest-version change during an open review does not reattach the guest's comment to a different version. Show an update banner and let the reviewer open the new version.

## 5. Media and PDF access

Use private storage buckets. The server authorizes an asset's relationship to a workspace/library/version before issuing temporary access. Large uploads should use resumable upload sessions and server-selected object keys. The client cannot select another workspace's path or overwrite a frozen source object.

Recommended logical buckets are `eps-source`, `eps-derived`, and `eps-presentations`, subject to reuse of compatible existing private buckets in M00. Paths use non-personal identifiers, for example `assets/<asset_uuid>/original.ext`; original filenames remain metadata. Buckets do not need to be public for a bearer presentation link to work.

Canonical internal PDFs use authenticated fixed-version playback routes. External PDF downloads use a separate `presentation_exports` variant cached by version, review link, template version and export revision. Its facts/images/order remain exactly the frozen version content; only playback URLs are scoped to the share grant.

An active export worker mints a one-time `review_media_grants` token from the backend and embeds `/m/:grantToken/versions/:versionId/media/:assetId`. The server stores only the token digest, its parent review link and fixed version; the private PDF necessarily contains the capability URL. Every media request checks the grant, current parent viewing scope/expiry/revocation, version membership and included asset. The general `/r/:token` review URL continues to open the newest Ready version, while this PDF media URL always resolves its original version. Internal exports never become anonymously accessible by accident.

Do not embed short-lived Storage signed URLs in permanent PDFs. Failed external export attempts revoke their orphan grants; retries obtain a new one. Cached PDF downloads require a valid current link and grant. Editing a link expiry updates all non-revoked child-grant expiries in the same transaction; naturally expired grants may become usable again after an extension, but revoked grants are never revived. This preserves existing PDFs without a refresh solely for expiry changes. Disabling downloads blocks PDF preparation/download, while previously downloaded PDF media can still play as long as viewing access remains valid. A link manager can regenerate the scoped export without editing the immutable presentation.

For an external viewer, prefer an app-authorized range-capable media route or very short-lived signed access. Every new playback/download authorization checks the current link. Token rotation invalidates old-generation sessions and explicitly revokes old PDF grants; unchanged expiry cannot keep an old session authorized after rotation. A signed URL already issued remains usable until its own expiry; revoking the app link stops new authorizations but cannot recall bytes already downloaded. Supabase documents private buckets and signed URL lifetimes in [Serving assets](https://supabase.com/docs/guides/storage/serving/downloads), verified 27 October 2026. Keep this behavior accurate in operator docs without presenting revoked-link access as instant recall of downloaded files.

When downloads are disabled on a link, hide the PDF button and reject its PDF endpoint. This controls the app's download feature; it is not a promise that screenshots or already obtained material can be erased.

## 6. Workflow and AI boundaries

n8n/worker requests authenticate as service identities, with replay protection and scoped job/attempt credentials. A valid shared secret by itself is insufficient if the callback can name any candidate, workspace, object path or version. Match every result against the persisted job inputs, allowed outputs, current attempt UUID and source checksums. Worker-only output reservation/completion and asset-access operations allocate scoped output IDs/paths and refresh credentials; they cannot sign arbitrary caller-selected storage paths.

Uploaded documents, transcripts, filenames and user notes are data. AI extraction prompts instruct the model to ignore embedded instructions that ask it to change workflow, disclose secrets or call unrelated tools. Extraction outputs are schema-validated and applied by domain operations, not executed as SQL, shell commands, HTML or autonomous approvals. OpenAI output never grants permissions or marks a profile Reviewed by itself.

The media worker receives approved asset references, fixed processing instructions and bounded resource limits. Do not interpolate filenames into shell command strings. Invoke FFmpeg/ffprobe with argument arrays, generated safe paths and time/memory limits. Escape/sanitize user text in HTML/PDF templates. Disallow remote URL fetching from arbitrary uploaded content unless an operation explicitly implements an allowed source; v1 has no external-source connectors.

## 7. Operational visibility without unnecessary exposure

Log request IDs, job IDs, stages, durations, size/count metrics and sanitized error codes. Do not log review/session bearer tokens, auth headers, full candidate transcripts by default, provider keys, raw database URLs, or complete request bodies containing personal data. Maintain audit events for edits/confirmations/generation/link changes, with actor and client identifiers.

Service credential rotation must be rehearsed in staging. A rotation plan identifies web, worker, n8n credentials and callback verification overlap without breaking active jobs. Permission removal is checked against current central grants for sensitive operations; do not depend on a stale client-side role label indefinitely.

## 8. Minimum access acceptance suite

- User without central project access cannot guess a workspace ID to read or mutate it.
- Contributor can upload/prepare but cannot confirm Reviewed or edit reusable facts without the explicit capability.
- Producer and Claude acting for that producer obtain the same allow/deny result for every operation.
- Anonymous requests cannot query private `eps` tables or list private storage objects.
- Library access does not grant access to every project where a candidate previously appeared.
- External version payload contains exactly the intended presentation data and no internal notes or live candidate record dump.
- Two guests with the same display name cannot edit each other's responses; both can see external feedback.
- Expired/revoked links reject new viewer, media and PDF authorizations; download-disabled links reject PDF access.
- Cross-series version/slide/asset IDs in a valid guest request are rejected.
- Stale/replayed worker callbacks cannot write to another job or overwrite a confirmed profile.
- RLS and function tests run as real runtime roles, including one deliberately unauthorized role.
- Logs and generated PDF links are checked for leaked long-lived secrets and temporary Storage URLs.

