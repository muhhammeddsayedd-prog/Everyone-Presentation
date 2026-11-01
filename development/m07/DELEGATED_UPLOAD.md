# Client-local upload transfer for the delegated journey

This helper implements the byte-transfer part of the existing upload contract.
It is source-tested, with synthetic local files and fake HTTP. No real owner
Claude transfer, private handoff, Storage upload, MCP operation or provider job
is demonstrated by these tests. Accepted initial authorization, reconnect and
project reads stay passed. The real AT064/068 journey remains pending.

`tools/client-upload-transfer.mts` imports the existing TUS client unchanged.
It is a client-local process: its file path refers to the machine running that
process, never to the hosted MCP server. It creates no upload reservations,
completions, jobs, retries, candidates or grants and reads no OAuth credential
store, environment credentials, browser session or Claude configuration.

## Contract and bounds

The exported `transferLocalUpload(input,{allowedRoot,fetch?,signal?,onCheckpoint?})`
accepts one closed object with exactly these fields:

| Field | Meaning |
| --- | --- |
| `schema_version` | `1.0` |
| `local_file_path` | Explicit absolute file on the client's machine |
| `purpose` | `client_logo`, `specs`, `candidate_video` or `candidate_support` |
| `mime_type` | Supported purpose-specific MIME matching the local extension |
| `expected_upload_id`, `expected_asset_id` | Exact reserved UUIDs |
| `expected_size_bytes`, `expected_sha256` | Independently obtained local size/SHA256 used for reservation |
| `start_processing` | Explicit completion intent: true for candidate video, false otherwise |
| `session` | Exact private `UploadSession` from the existing MCP/API operation |
| `resume` | Null or the credential-free checkpoint described below |

The caller supplies an explicit approved local root. Paths outside it, UNC/ADS
paths, symlinks/junctions, nonregular or multiply linked files are refused.
The input is cloned before asynchronous work so caller mutation cannot replace
the validated destination. File identity/size/timestamps are compared through
the opened handle and path before/after hashing, Blob creation and HTTP calls.
SHA256 is streamed in1MiB blocks and re-read after transfer. No whole video is
loaded into a JSON/base64 argument. A detected change fails without completion
metadata; this does not lock out every other local process from writing a file.

The finite destination allowlist is this pilot's already verified canonical
Supabase API origin and direct Storage origin. No caller-supplied arbitrary
host or environment override exists. Expired/closed sessions, unknown fields,
Authorization/cookie headers, changed UUIDs, unsupported MIME, oversized files
and destinations outside the exact reserved asset/bucket/path are refused.
Limits stay bounded by returned policy and5MiB logo or support-image/20MiB specs
or support-document/256MiB video ceilings. The helper does not decode media or
assert semantic facts.

Candidate/support sessions use the shared signed TUS implementation: exact
direct Storage endpoint,6MiB chunks, returned metadata, transient `x-signature`,
`x-upsert:false`, verified Location/offsets and HEAD recovery after a lost PATCH
acknowledgement. Logo/specs sessions use one PUT to the exact signed object path
with only the returned Content-Type and x-upsert headers. Both routes omit app
credentials/cookies and forbid redirects. No automatic network retry occurs.
Unknown PUT acknowledgement requires normal upload-session reconciliation;
the helper never manufactures a completed/Ready asset from transferred bytes.

## Private input and resumable progress

The CLI accepts only nonsecret arguments:

```text
node --import tsx tools/client-upload-transfer.mts --allowed-root <approved-absolute-folder> [--checkpoint-fd 3]
```

Input is at most64KiB of UTF8 JSON on a private stdin pipe; interactive TTY input
is refused. Duplicate fields,
invalid JSON and unknown fields are rejected. Never put the session, signature,
signed URL or acting-user token in command arguments, environment variables,
shell heredocs, generic logs, tracking or Git. There is no credential-file
discovery or path to read Claude's OAuth store.

TUS requires a synchronous `onCheckpoint` callback in library use, or a dedicated
writable fd3 descriptor for the CLI. The callback must finish the caller's chosen
checkpoint durability step before returning; async/Promise callbacks are not
supported or awaited by the shared TUS callback contract. The helper checks only
that fd3 exists and is not a directory; it does not prove writability, pipe type,
ownership or privacy. The caller provides and consumes a private pipe (or an
appropriately protected writable destination); a failed write stops transfer.
Stdout is not a checkpoint log. Checkpoint objects contain exactly schema_version,
upload_id, asset_id, size_bytes, sha256, resource_id and confirmed offset.
The resource_id is the canonical opaque identifier alone, with no URL, origin,
query, fragment, signature or JWT. It is decoded/checked against the exact
bucket/asset/object and UUID version before reconstructing the canonical TUS
path. A resource identifier alone does not provide upload authorization.
On resume, the client obtains fresh instructions for the same reservation and
supplies its prior checkpoint; HEAD, rather than the saved offset, determines
the current stored position.

The helper creates no private files and makes no Windows DACL claim for caller
files or pipes. The actual owner/client must provide a reviewed private channel
and protected checkpoint persistence. That handoff has not been demonstrated
in the owner's Claude session; a working stdin function alone does not prove it.
A local integration can launch the process with Node stdio pipes0/1/2/3 and feed
the already-held private session directly, without serializing it into a shell
command. This is an interface description, not an installed Claude bridge.

Stdout contains only a safe failed envelope or transferred upload/asset IDs,
size/SHA, confirmed byte count and the proposed completion body. It contains no
paths, headers, URLs, signatures, provider errors, stack traces or file content.
Exceptions are mapped to a finite `CLIENT_UPLOAD_*` code. Checkpoint identifiers
are emitted only through the separate caller-provided channel. No SDK,
dependency, auth flow, lockfile or app/server contract changes are required.

## Intended owner flow and acceptance still required

1. In the already working Claude session, read current capabilities/project/
   workspace and the permitted local file's type/size/SHA through available,
   authorized local tools. Do not assume the current session has local tools.
2. Call `create_upload_session` using the current grant, intended project/person
   scope and one stable reservation key. Preserve the returned IDs privately.
3. Provide the returned temporary session to this local helper through an
   actually supported private channel. Transfer only that selected local file.
   If the client cannot do this, record the transport limitation; an owner UI
   upload is not a full delegated-byte-transfer pass.
4. On successful transfer, have the same Claude connection call `complete_upload`
   with its separate stable completion key and the returned completion body.
   Candidate processing must be verified by its real job ID/status/results;
   specs are completed first, then submitted with current spec revision.
5. Read actual source-bound results and app state, then continue the ordinary
   review/assignment/generation/PDF/sharing journey under current permissions.
   Preserve request/job/asset IDs without publishing capabilities or payloads.

Nothing here changes the accepted Claude configuration, signs in/consents for
the owner, claims provider success or completes AT064/068. Manual screen reader
acceptance remains pending, mobile skipped, and the pilot stays running.

## Sources and inert verification

Checked on2026-11-01 against the existing app contracts and official sources:

- [Node24 file-backed Blob documentation](https://nodejs.org/docs/latest-v24.x/api/fs.html#fsopenasblobpath-options): stable since24.0.0; Node checks modification state when creating the Blob and before reads, and modified files can fail with DOMException. The observed local Node is24.18.0; current24.x documentation is24.22.2.
- [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads): TUS, direct Storage host and signed-upload support. Protocol details reuse `apps/web/lib/resumable-transfer.ts` and `packages/central/src/tus-upload-session.ts`.
- [Supabase signed upload API](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl): temporary signed upload capability. The exact PUT path/header contract comes from current `logo-storage.ts`, `specs-storage.ts` and their browser callers, not a new SDK call.
- `contracts/openapi.yaml` UploadSession/CompleteUpload, `contracts/mcp-tool-catalog.json`, `docs/integrations/MCP_INTEGRATION.md` section4 and `development/m07/API_CLIENT_RUNBOOK.md` define the separate reserve/transfer/complete boundary. Their historical local-only status prose is not current hosted acceptance.

```powershell
node tools/run-tests.mjs tests/operations/client-upload-transfer.test.ts tests/server/resumable-transfer.test.ts
```

The tests use synthetic temporary files and fake fetch, plus a no-argument local
CLI refusal. They exercise Windows junction refusal, strict input/destination
bindings, caller mutation, changed files, resumed offsets, private-input bounds
and safe output. They perform no real Storage/MCP/provider operation. Private
handoff, real persisted bytes and the completed delegated journey stay pending.
