# Private local UploadSession handoff

This client-local parent makes the existing `transferLocalUpload` usable with a
protected file handoff. The original transfer helper and shared TUS code remain
unchanged and are checked against their recorded SHA256 before use. No OAuth
store, browser session, Claude configuration, app credentials or environment
credentials are discovered. This tool neither reserves nor completes uploads,
creates jobs, changes permissions, or calls application/MCP APIs.

The source and tests are separate from acceptance. Synthetic files/fake HTTP and
a Windows ACL test do not demonstrate the owner's Claude tool availability,
private Write, real Storage bytes, MCP completion or processing. Those remain
pending until the real journey succeeds. Existing OAuth/read/reconnect acceptance
stays passed; screen reader acceptance remains pending and mobile is skipped.

## Owner flow

1. Confirm the existing owner Claude session has built-in Write and local command
   execution. Claude Code documents Write creating UTF8 files, but exact tools
   depend on the running session's platform/settings. Do not change settings or
   bypass a denied Write. If the session lacks these tools, record that client
   transport limitation. A hosted MCP server cannot read this local filesystem.
2. With an explicitly permitted local file, run `prepare`. All arguments are
   source metadata, without capabilities. The parent independently streams the
   size/SHA and verifies path, extension, MIME and source identity. It creates a
   new `.local/client-upload-inbox/<UUID>/` under the Main checkout, then applies
   and verifies current-owner/SYSTEM-only Windows DACLs before any session file.
   It returns a nonsecret manifest SHA, nonce, exact handoff path and reservation
   metadata. A session file is not pre-created.
3. In the same accepted Claude connection call existing `create_upload_session`
   using the returned filename/MIME/size/SHA, intended workspace/person scope and
   a stable reservation idempotency key. Keep the returned `UploadSession` in
   that intended client context. The local tool does not independently verify
   the backend workspace binding; the real MCP reservation/completion evidence
   and server permission checks establish it.
4. Use the built-in structured Write tool to create exactly the returned
   `handoff_file`. Write one closed JSON object containing `schema_version: 1.0`,
   `handoff_id`, `nonce`, `manifest_sha256`, `expected_upload_id`,
   `expected_asset_id`, and `session` (the exact returned UploadSession object).
   Use its actual ID/asset ID. Do not put the session in a human-facing message,
   Bash/PowerShell command, heredoc, environment variable, arbitrary log or Git.
   The session file is a new file, avoiding an unnecessary read-before-overwrite.
5. Invoke `transfer` with handoff UUID, manifest SHA and the two nonsecret IDs.
   It verifies the actual file's owner/DACL, every path component, regular-file
   and single-link identity, bounded duplicate-free JSON, nonce/TTL, manifest,
   source identity, reservation IDs, helper pins and existing upload policy.
   An exclusive durable claim precedes network dispatch. It unlinks only the
   known handoff file after reading it into RAM; it never deletes source files.
6. On `result: transferred`, have the same Claude MCP connection call existing
   `complete_upload` with a separate stable completion key and the exact returned
   `completion_body`. This tool does not call it. Verify the real job/results
   afterward; transferred bytes alone are not Completed, Ready or AI success.
   For specs, complete first, then submit using the current spec revision.

Commands, with nonsecret placeholders only:

```text
node --import tsx tools/client-upload-inbox.mts prepare --allowed-root <absolute-approved-folder> --file <absolute-file> --purpose candidate_video --mime video/mp4 --size <bytes> --sha256 <lowercase-SHA256>
node --import tsx tools/client-upload-inbox.mts transfer --handoff-id <UUID> --manifest-sha <prepare-returned-SHA256> --upload-id <reserved-UUID> --asset-id <reserved-UUID>
```

The CLI always uses Main's fixed inbox root and real Windows security adapter.
The exported factory's filesystem/security/fetch seams support controlled tests;
they are trusted dependencies, not CLI flags or alternate production policy.

## Resume and failures

TUS checkpoint callbacks finish synchronous exclusive write plus fsync before
returning. Numbered checkpoints contain only the existing closed upload/asset/
source hash/size/resource ID/confirmed-offset shape. They contain no URL, query,
headers, signature or JWT. The opaque resource ID is validated against the exact
bucket/asset/original filename and UUID version; by itself it grants no upload
authorization. No async durability callback is passed to the shared TUS client.

After an interrupted/unknown-acknowledgement TUS attempt, create a FRESH inbox:

```text
node --import tsx tools/client-upload-inbox.mts prepare --allowed-root <same-folder> --file <same-file> --purpose candidate_video --mime video/mp4 --size <same-bytes> --sha256 <same-SHA256> --resume-from <old-handoff-UUID> --upload-id <same-reserved-UUID> --asset-id <same-reserved-UUID>
```

The parent requires the old exclusive claim, matching original manifest/source
identity and reservation IDs, an unsuccessful or missing terminal result, and
bounded valid monotonic checkpoints. It never reads or reuses the old session
file. A completed successful transfer cannot be resumed this way. Ask the owner
Claude connection for fresh `get_upload_session` instructions for that SAME
reservation and write them into the NEW nonce-bound inbox. Then call transfer
using the NEW manifest/UUID. Existing TUS HEAD determines the current offset,
even when it differs from saved progress. There is no old claim replay or
background/automatic retry. Invalid/missing checkpoints fail closed.

Signed PUT has no resume path or automatic retry. An unknown PUT acknowledgement
requires ordinary upload-session reconciliation through the accepted MCP/API;
do not manufacture completion or blindly repeat a PUT. A failed/consumed inbox
is not resubmitted. Retained nonsecret claims/checkpoints support investigation.

All CLI errors are finite safe envelopes; raw filesystem/HTTP/parser errors,
stacks and provider bodies are not emitted. The handoff body is removed from
our inbox after successful validation and claiming, but this is not secure disk
erasure and JavaScript immutable strings have no guaranteed RAM zeroization.
Unconsumed invalid files remain private for owner correction/removal; no broad
cleanup scans or recursive deletes run.

## Privacy boundary and official support

The temporary scoped UploadSession is already present in the intended MCP
client's context. The protected inbox controls our on-disk artifact and keeps
credentials out of our command arguments, environment, output/checkpoints and
Git. It does not control Claude's tool display, transcript, internal temporary
files or retention. Claude Code documents plaintext local session transcripts;
structured Write inputs and existing MCP results may therefore persist in that
client's session history. No claim of an end-to-end secret channel or history
cleanup is made, and this implementation changes no owner settings.

Checked against official documentation on 2026-11-01:

- [Write behavior and session tool availability](https://code.claude.com/docs/en/tools-reference#write-tool-behavior): Write creates files; owner must confirm actual tools. New files do not need the existing-file read step.
- [Claude Code permissions](https://code.claude.com/docs/en/permissions#read-and-edit): Write can require owner permission; Read-deny also blocks Write. No policy bypass is introduced here.
- [Claude Code retention](https://code.claude.com/docs/en/data-usage#data-retention): local session transcripts are retained as plaintext. Our private DACL does not govern those transcripts.
- [Existing byte-transfer contract](DELEGATED_UPLOAD.md): Node24 file-backed reads, exact signed PUT/TUS scope, source mutation checks, separate reserve/transfer/complete and safe checkpoints.

Focused verification:

```text
node tools/run-tests.mjs tests/operations/client-upload-inbox.test.ts tests/operations/client-upload-transfer.test.ts tests/server/resumable-transfer.test.ts
```

The inbox suite uses synthetic temporary files and fake HTTP. Its Windows ACL
check protects/verifies only a synthetic temporary directory/file. No real
candidate file, session capability, upload, MCP action, provider processing,
owner sign-in/configuration or acceptance is exercised by these tests.
