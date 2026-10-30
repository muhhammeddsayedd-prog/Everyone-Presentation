# Claude / MCP integration and operation parity

**Status:** an official SDK2.4.0 local adapter, guarded Streamable HTTP composition, delegated resource-verification implementation and controlled protocol evidence exist.86 tools reconcile with the API/source inventory. No configured OAuth issuer, actual intended Claude client journey or public deployment is claimed. The complete internal tool catalog is `contracts/mcp-tool-catalog.json`; [the matrix](IMPLEMENTATION_PARITY.md) and [client runbook](../../development/m07/API_CLIENT_RUNBOOK.md) distinguish implemented sources from live acceptance.

## 1. Product commitment

Claude must be able to complete the same casting task as the acting user: find an existing project, update authorized project/client/logo fields, submit specs, inspect extraction, correct roles, upload candidate media, reuse the library, inspect transcript/frames, resolve duplicates, confirm reusable facts, assign candidates, set Main/Backup/Option, explicitly include Shortlist candidates, review warnings, generate both outputs, obtain PDFs, manage review links, and inspect feedback/jobs.

There is no app-imposed “human must click this” rule for Reviewed, generation, casting decisions or share-link creation when Claude’s acting user has permission. Client-side confirmation policies may still be configured by the user’s chosen Claude client; the app must not misrepresent those client policies as product authorization requirements. The app cannot grant Claude more central database/project authority than that user has.

A remote agent needs meaningful API results rather than instructions to “open the modal.” Every write returns identifiers, updated state and machine-readable issues. Every asynchronous action returns durable job IDs and a polling route/tool. Presentation preview resources include slide count, labels, missing/overflow issues and authorized preview images/media references, so Claude can inspect what it generated.

## 2. Server and authorization

Default: authenticated remote MCP endpoint at `/mcp`, using Streamable HTTP and a maintained official MCP SDK compatible with target Claude clients. The MCP specification defines Streamable HTTP and stdio bindings; choose remote HTTP for the hosted shared app and add a local stdio wrapper only if an actual client need arises. [MCP transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports), checked 2026-10-27.

Treat the MCP endpoint as a protected resource. Discover/reuse a suitable authorization server; verify issuer, audience/resource, expiry and scopes. Publish protected-resource metadata and support the OAuth client flow required by the chosen client/SDK. Do not assume existing Supabase browser login automatically provides an interoperable MCP authorization server. Verify that during M00 and finish client acceptance in M07. [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), checked 2026-10-27.

The precise protocol version/SDK version is a release choice to record, not an invented deployed capability. Current and older protocol eras differ; rely on a tested SDK rather than hand-writing an old handshake from memory. Test the actual configured Claude connection, token refresh/revocation and expired login paths.

The implemented central-issuer adapter advertises only `openid` for OAuth identity. Business delegation uses the separate issuer-signed `eps_delegation` claim described in [MCP_AUTH.md](../../development/m07/MCP_AUTH.md), intersected with fresh current business capabilities. The earlier proposed `studio:*` vocabulary is not implemented provider support. Compound capability metadata is interpreted explicitly; each tool still checks actual project/library/purpose scope in the shared operation. A service-role token is never the Claude user identity. Client/delegation, acting principal, operation/resource correlation and private audit remain separate from ordinary source/tool content; credentials and payloads must not enter generic logs.

## 3. Tool catalog mechanics

Each catalog entry includes name, description, OpenAPI operationId, HTTP mapping, capability, input/output JSON Schema and annotations. Tool schemas are self-contained through local `$defs`; resolve/compile these through the chosen SDK and verify actual provider/client schema support. Do not advertise an unimplemented tool. At release, the implemented catalog and API operation inventory must reconcile automatically.

Inputs contain path/query parameters at top level and request body under `body`. State-changing creates use `idempotency_key`. The transport adapter maps this to the HTTP header or passes it directly to the shared service. Output uses the same request/data/error semantics as HTTP; return structured content and concise human-readable context. Do not return gigantic base64 media strings as tool text.

Annotations are hints, not permission enforcement. Whether a tool is marked read-only does not replace authorization. Destructive-looking operations in this v1 are recoverable archive/remove/revoke operations, with historical content retained as required; no arbitrary hard-delete tool is needed.

The catalog intentionally excludes service-only callbacks and the anonymous review API. Claude operates as an authorized internal user and can read external feedback using internal operations. It does not impersonate an external reviewer’s self-declared name to bypass attribution.

## 4. File transfer without false capability claims

A remote MCP server cannot read an arbitrary path on Claude’s desktop. `create_upload_session` returns a scoped upload destination, protocol, required headers, asset ID and expiry. An agent/client that can access the file uploads bytes via the documented transfer method, then calls `complete_upload`. Large videos use resumable direct-to-storage transfers, not JSON tool payloads.

For clients without arbitrary HTTP/file transfer, provide an upload UI handoff for the already-created session or a supported client attachment-to-upload bridge. This is a client transport limitation, not an extra business approval. To claim “Claude completes uploads end to end” in production acceptance, demonstrate a real supported byte-transfer route in the intended Claude client. A successful tool call creating an upload session is insufficient evidence.

Do not add unrestricted `fetch_url` or arbitrary server filesystem-path tools as a shortcut. If later adding URL ingestion, scope allowed sources, validate destinations and content, and implement its own contract; external Drive/social connectors remain outside v1.

Media reading tools return authorized, short-lived playback/preview resources. Where a client cannot view video, supply the actual transcript, timestamps and extracted-frame previews. Do not tell the user Claude watched video if it only read a transcript.

## 5. Example complete agent task

The following is an operation sequence, not a fake executed transcript:

1. `get_capabilities`, `list_projects`, `get_project`; resolve the real project ID.
2. `create_workspace` or `get_workspace`; load the current workspace version.
3. Create a specs upload session, transfer bytes, complete it, then `submit_specs`; poll `get_job` until succeeded or a recoverable issue appears.
4. `get_specs`, `list_roles`, `list_slots`; correct requirements with ordinary typed updates where the user supplied enough information. Preserve unclear fields otherwise.
5. `search_candidates` using adjustable supplied-attribute filters; add reused candidates with `add_workspace_candidate`.
6. For new videos create/complete upload sessions; poll individual jobs; read `get_candidate`, `get_candidate_media`, `list_duplicate_matches`. Use `resolve_duplicate` only with the intended identity choice.
7. Apply confirmed reusable corrections, choose actual frames and call `confirm_candidate_reviewed` under the acting user’s permission. Missing facts may remain explicitly absent.
8. Create assignments as Option; use `set_slot_main` and explicit `shortlist_included` updates; keep slots independent.
9. Choose output/audience and create/reuse its audience-scoped series. Call `get_workspace_review` with that `series_id`; repair genuine overflow/invalid media and preserve allowed Pending slots. AI wording suggestions may be requested and applied through normal assignment updates. Re-read review after changes to get the current input fingerprint.
10. `generate_version` with the reviewed workspace versions and expected input fingerprint; poll render job, inspect fixed version and PDF.
11. Create or manage permitted review links. For a guest-ready PDF, prepare the link-scoped PDF export and poll its job; use the cached fixed-version export when ready.
12. Return the relevant app/review/download URLs and a plain-language account of unresolved missing information. Never assert final cast booking from the Reviewed flag or a Preferred response.

## 6. Failure and recovery behavior

- 409 stale version: fetch current entity, reconcile the intended change with current state, retry with its version. Never retry a stale whole-record payload blindly.
- Network timeout after create/generate: replay the same idempotency key before considering a new action.
- Missing facts: proceed with null/Not provided and Pending behavior; no invented values.
- Source extraction failed: inspect job error, preserve usable frames/transcript if available, retry eligible stage or enter known facts manually.
- Capability denied: return the actual missing capability/scope. Do not request a service credential or call a hidden worker route.
- Expired upload session: resume/create a transfer session according to Storage rules; ensure the eventual completed asset ID is the one linked to the intended job.
- Revoked review link: do not generate a fresh link merely to avoid the revocation. Managing a new link is an intentional user-level action.

## 7. M07 acceptance evidence

Maintain an operation parity report linking every relevant UI control, operationId and MCP tool name. Test at least one complete Casting journey through actual Claude/API tooling, plus an internal browser journey against the same data. Include existing project, logo, specs, new upload, library reuse, duplicate resolution, fewer frames, manual correction, Reviewed, repeated candidate across slots, one Main replacement, explicit Shortlist, Pending slot, both outputs, fixed PDF, review link management and feedback inspection.

Test scope failures with a different authorized project, read-only contributor and guest token. Test an interrupted upload and interrupted asynchronous generation. Confirm the actual connected client can transfer the required file types; record any unsupported client-specific route as a release limitation rather than claiming full parity.

No API/MCP endpoint is production-ready merely because its OpenAPI/catalog file parses. Completion requires deployed transport/auth, real service execution, tests, operator documentation and the complete demonstrated task.
