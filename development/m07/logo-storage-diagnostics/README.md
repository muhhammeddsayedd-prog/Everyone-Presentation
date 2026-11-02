# Logo completion diagnostics

The actual B5 logo attempt reserved successfully (POST uploads201), then failed
completion503 and automatically cancelled200. Canonical readback retained one
reservation/audit/idempotency receipt and a Storage object; the asset is Failed,
the upload Cancelled and the workspace still has no logo. The exact completion
request's bounded function-log read returned zero events. Its underlying Storage
error remains **unobserved**. No new read against the cancelled asset, mint,
upload, completion, cancellation or retry was performed by this investigation.

The retained safe Main observations are:

- `tracking/evidence/m07/completion-release/2026-11-02-cd614803-logo-intake-metadata.json`
- `tracking/evidence/m07/completion-release/2026-11-02-cfd5a9bf-logo-web-timeline.json`
- `tracking/evidence/m07/completion-release/2026-11-02-6db630f0-logo-function-diagnostic.json`

This source change makes a later separately authorized attempt diagnosable. The
existing DomainError.details carries only an internal closed phase, actual wire
HTTP status, numeric legacy body status and recognized official Storage code.
Messages remain static. Raw SDK errors, body/message text, keys, headers, signed
URLs and paths never enter the projection. The existing app request_id envelope
provides correlation. SDK2.118 discards Storage response headers, so no provider
request ID is invented or claimed. No new observer or generic logging path exists.

The [official Storage error documentation](https://supabase.com/docs/guides/storage/debugging/error-codes)
describes legacy errors and their semantic statuses. Current public
[StorageBackendError source](https://github.com/supabase/storage/blob/master/src/internal/errors/storage-error.ts)
separates the outgoing user status from the rendered body status, and the
[code definitions](https://github.com/supabase/storage/blob/master/src/internal/errors/codes.ts)
assign403 to AccessDenied and404 to missing objects. The installed SDK preserves
wire status, body statusCode and code separately. This confirms a mapping gap:
wire400 previously hid body403/404 behind generic503. The narrow fix uses those
two legacy body statuses only for wire400, retaining both values. Another wire
failure, including500, keeps precedence. This supported behavior is distinct
from the unknown cause of the real B5 failure; public source snapshots do not
identify the managed server's version.

Safe phases distinguish reservation, signing an upload URL, completion precheck,
download, streaming, decoding, verification signing and finalization. Cleanup
does not replace an earlier failure. Current scope checks, actor verification,
RLS/grants, byte/pixel bounds, immutable snapshots, receipt verification,
idempotency and automatic cancellation behavior are unchanged. A failed mint
does not silently cancel its already durable reservation.

Four actual installed-SDK fake-HTTP regressions first failed, then all12 logo
tests passed. They cover400/body403/404, wire500 precedence, exclusion of unknown
codes/private messages, failed mint retention, and distinct stream/signer phases.
Final Frontend worktree checks passed974/974 with zero failure/skip/cancellation,
typecheck and focused lint0. The first lint pass found a finally throw; the final
control flow retains its failure and throws after cleanup. The earlier full run
is retained separately; acceptance uses the fresh final run. Independent peer
review and12 tests passed on the exact final product/test hashes.

The final read-only AST audit verified all165 retained code-only source files.
Logo storage changes the packed source but intersects neither the90-module daemon
nor54-module native executable closure. This change alone needs no worker image
rebuild. Runtime's separate shared-verifier identity changes have their own build
requirements. No live image identity, deployment, real Storage behavior, retry or
successful logo journey is established by these local tests.
