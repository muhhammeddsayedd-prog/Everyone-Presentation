# Effective upload capacity discovery

Read-only observation **2026-10-29T10:19:22.133067Z**, target
`pyibofyctwnqpvktepse`: the project's global Storage setting is **50MiB =
52,428,800 bytes**. The [metadata receipt](2026-10-29T10-19-15-592917Z-e9cd1c8e.json)
records the fixed CLI invocation, source hash, unchanged repository-config check
and exact observed value. It does not identify the current billing plan.

The candidate application/native limits and prepared candidate bucket constraint
are **256MiB = 268,435,456 bytes**. A 256MiB bucket constraint does not establish
that the hosted service accepts that size. Supabase's [current limits
documentation](https://supabase.com/docs/guides/storage/uploads/file-limits)
states that the global setting takes precedence over bucket settings. It also
states that Free projects cannot exceed 50MB while Pro and above support larger
global values. The observed 50MiB setting alone cannot distinguish a Free project
from a paid project configured with that same setting. The [Management API
reference](https://supabase.com/docs/reference/api/v1-get-storage-config) identifies
`fileSizeLimit` as the read-only configuration field.

Therefore the current environment cannot honestly promise a successful 256MiB
upload. The effective limit is the minimum of global Storage, bucket and app/native
limits; current global Storage bounds it to at most 50MiB. Existing 4–6MB test
videos are below this limit; this check is metadata evidence and performs no
upload or native/provider processing.

The subsequent implementation retains 256MiB as the app/native target and
requires server-only `CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES` whenever candidate
uploads are enabled. There is no universal 50MiB default. The verified environment
value bounds new upload reservations/completion and signed-upload minting;
capabilities, upload-session DTOs and the session/UI expose that same effective
maximum through the shared HTTP/MCP service. Ready media larger than a later
decreased upload limit remains readable/playable. The focused SDK/server/MCP
suite passed 27 tests, including oversize rejection before any RPC/signing call
and larger Ready playback; typecheck and scoped ESLint passed. This is deterministic
code proof; root records the actual configured relaunch and browser acceptance.
Raising the
effective limit to 256MiB requires verifying the actual plan's capability and a
separately authorized global-setting change; this discovery neither changes a
plan nor reduces the written product requirement.

`tools/discover-storage-upload-limit.py` uses the existing authorized CLI login
and `config pull --dry-run` in a fresh ignored task directory. Its deliberately
distinct 1B local comparison value makes the remote setting visible without a
remote write. It retains only the allowlisted limit, suppresses raw diagnostics
and checks that the repository config/project link remain byte-identical.
No credential is extracted/created, raw config saved, bucket changed, plan
upgraded or config pushed. The CLI's broader fetched configuration is discarded
from memory after selecting this field.
