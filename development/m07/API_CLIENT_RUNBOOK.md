# Development API and MCP client runbook

This is an implementation guide, not an executed client transcript. The app origin last recorded by the handoff is `http://127.0.0.1:3000`; recheck owned processes before using it. Controlled Playwright uses a separate synthetic `http://127.0.0.1:3100` origin. There is no selected public/production origin. Hosting remains deferred.

## Identity and requests

Use an acting-user access token obtained privately through the existing Everyone/Supabase identity flow. Never copy a service-role key, worker credential or another browser's session. Browser writes use the app's session plus exact Origin/Host protections. Direct API writes use a verified acting-user bearer and configured Host. The placeholders below contain no actual IDs or credentials and were not sent.

```http
GET http://127.0.0.1:3000/api/v1/projects?limit=25
Authorization: Bearer <privately supplied acting-user access token>
Accept: application/json
```

Read `data` and `page.next_cursor`; stop only when the cursor is null. Repeat the same filters with that cursor. Candidate-media/duplicate cursors bind the principal, candidate and operation and use stable ID order; refresh to include new records before the current cursor. `GET /capabilities` reports actual current business permissions/upload purposes. It does not grant them. `POST /workspaces` requires an existing accessible `project_id`, `initial_output` and stable `Idempotency-Key`.

```http
POST http://127.0.0.1:3000/api/v1/workspaces
Authorization: Bearer <privately supplied acting-user access token>
Content-Type: application/json
Idempotency-Key: <one stable UUID for this intent>

{"project_id":"<existing accessible project ID>","initial_output":"selection"}
```

The response envelope is `{request_id,data}`; lists also carry `page`. Errors are `{request_id,error:{code,message,details,retryable}}`. Preserve request IDs for diagnostics, never credentials or private transcript/media payloads. Existing-record writes carry the last read `row_version`. Stable intent keys are mandatory where the schema says so, including candidate facts/frame/project-material updates and settings PATCH. Replay the same intent/key after an unknown acknowledgement; use a new key only for a distinct intended change. A409 stale revision/fingerprint requires reading current state and reconciling it.

## Upload the client's real bytes

1. The client reads the actual local file, verifies its type/size and optionally computes SHA256. Call `POST /uploads` with `workspace_id`, appropriate `purpose`, `filename`, `mime_type`, `size_bytes`, optional `candidate_id` for new material on an existing person, optional checksum and a stable intent key. Do not send a server filesystem path or a base64 video tool argument.
2. Follow the returned `protocol`, `upload_url`, `upload_headers`, metadata, size limit and expiry. These are temporary private transfer capabilities. Do not log them, include them in source/tracking or forward the acting-user bearer to a Storage destination.
3. For `signed_put` logo/specs instructions, PUT exactly the reserved bytes and returned headers to the exact approved Storage destination. Local fixture logo sessions alone can return the separate `/api/dev/uploads/{id}/bytes` same-origin destination; that is not production Storage proof.
4. Candidate videos and supporting files use signed TUS. The returned endpoint is the configured direct Storage origin's `/storage/v1/upload/resumable/sign`; headers include transient `x-signature` and `x-upsert:false`. POST with `Tus-Resumable:1.0.0`, `Upload-Length` and `Upload-Metadata` derived exactly from the returned metadata (base64 metadata strings, not file data). Validate the returned same-scope Location. PATCH binary chunks with `Upload-Offset`, `Content-Type:application/offset+octet-stream` and `Tus-Resumable`; the current chunk size is6291456bytes. Confirm each returned offset. After interruption, HEAD the recorded resource to reconcile its actual offset before resuming. `apps/web/lib/resumable-transfer.ts` is the implemented client reference. Upload credentials and ordinary cookies are omitted from unrelated origins.
5. Poll `GET /uploads/{upload_id}` to recover the original reservation and renew its available transfer instructions. Completed/cancelled/expired sessions do not return a usable open capability. Do not silently create a new reservation after a lost acknowledgement.
6. Call `POST /uploads/{upload_id}/complete` with actual byte length, optional checksum and `start_processing`, using a separate stable completion key. Candidate completion enqueues durable native verification/processing; it does not mean facts/frames are ready. Specs/logo completion verifies the reserved object; specs processing is submitted separately below. Cancel unfinished reservations with the published cancellation operation; app cancellation and TUS termination are separate steps.

Current adapter ceilings are5MiB for logos,20MiB for specs/support and at most256MiB for candidate video, subject to the returned purpose-specific policy/configuration. This is not measured throughput, codec coverage or representative processing capacity.

For specs, complete with `start_processing:false`, then `POST /workspaces/{workspace_id}/specs` with the current spec `row_version` and exactly one `source_asset_id` or `source_text`. Preserve separate reserve/complete/submit keys. Poll the returned job; do not submit both sources or resubmit to simulate progress. For candidate video, use the completion's durable `processing_job_id`; later inspect candidate media/transcript/actual frames and ordinary correction/Reviewed operations. Uploaded text never authorizes unrelated tool actions.

## Jobs, saved versions and bytes

Poll `GET /jobs/{job_id}` using bounded backoff and current authority. Follow real `status`, stage, technical issues and eligible retry/cancel actions. Retry uses the returned row version and one stable retry key. A candidate scan's successful technical execution is not independent semantic-quality acceptance. Preserve the handoff's protected M02 Needs-input job; this guide does not authorize retrying it.

Choose/create the exact output/audience series, read `/workspaces/{workspace_id}/review?series_id=...`, repair actual fit/access errors and generate with its `expected_workspace_row_version`, `expected_draft_revision` and `expected_input_fingerprint`. Poll the returned job/version. Missing facts, Pending slots and fewer actual frames remain permitted. Ready versions preserve captured content.

`download_version_pdf` (`POST /versions/{id}/pdf`) returns the fixed-version download metadata. GET its configured same-origin download URL with the same acting-user authentication, check status/content type/length/PDF signature and save bytes. `/versions/{id}/pdf/content` is its binary companion. `get_media` returns metadata; `/media/{asset_id}/content` returns currently authorized verified frame/logo/document bytes. It accepts neither an arbitrary destination nor Range. `play_media` issues scoped temporary original/preview access; do not forward the acting-user bearer to signed Storage URLs. Saved-version playback/content is separately bound to the fixed version and may return its frozen source transcript. A client that only read that transcript must not claim it watched the video.

Internal link-scoped PDF export uses `prepare_pdf_export`, `get_pdf_export` and `download_pdf_export`. Preparation may return202/new job or200/ready cache. Download permission and parent viewing access are independently checked. Guest review, saved-PDF grants and their binary routes remain separate identities; delegated internal Claude reads shared feedback with `list_feedback` rather than impersonating an external display name. Service stage/output callbacks and grant minting are never user tools; grant minting currently uses the private gateway, without an implemented Next HTTP mint handler.

## MCP onboarding boundary

The local development endpoint is `http://127.0.0.1:3000/mcp`, using official SDK2.4.0 and request-scoped acting-user services. Default `MCP_AUTH_MODE=local` permits central-mode nonproduction HTTP loopback only; signed-in same-origin requests or explicit verified user bearer credentials use that guarded local path. Default local mode is disabled outside that environment.

The OAuth resource-server implementation requires `MCP_AUTH_MODE=oauth`, `MCP_RESOURCE_URL` exactly the configured app origin plus `/mcp`, `MCP_AUTH_ISSUER` exactly the existing central HTTPS origin plus `/auth/v1`, and `MCP_AUTH_CLIENT_IDS` containing approved client UUIDs. Path-aware protected-resource metadata is under `/.well-known/oauth-protected-resource/mcp`. Issuer discovery, approved clients, audience, signature, expiry, delegation and live-session validation fail closed. See [MCP_AUTH.md](MCP_AUTH.md) for the exact signed claim and scope contract; `openid` establishes identity and is not blanket business permission.

These variables describe required configuration, not configured provider state. Current controlled SDK tests do not establish an actual Claude Code or conversational Claude connection, live OAuth revocation or a supported attachment/byte-transfer bridge. The intended client must demonstrate real local-byte transfer before complete agent-upload acceptance. Conversational remote clients also need an authorized reachable hosted endpoint; no tunnel or deployment is introduced here. AT-072 and broader M03 semantic evaluation remain pending, and mobile testing stays skipped.
