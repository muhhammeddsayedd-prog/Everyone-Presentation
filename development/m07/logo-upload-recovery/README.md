# Logo upload recovery

The previous `LogoPanel` catch cancelled a reserved upload even after a successful
PUT followed by an unavailable or lost completion response. A valid open upload
could therefore become cancelled/failed before the user could finish it.

The browser now checkpoints one logical upload in tab storage scoped to the
verified viewer ID and workspace. It stores only file metadata/checksum, upload
and asset IDs, exact request bodies/keys and progress. It never stores file bytes,
bearers, signed URLs or Storage headers. The same request is kept across reloads
and navigation in that tab. Other viewers/workspaces cannot adopt the record;
server session reads still recheck current authority. Closing the tab does not
cancel the server reservation, but tab recovery is not a cross-device ledger.

Check and resume first reads the current upload session. A completed upload is
reconciled through the same idempotent completion request. An open session after
an attempted PUT is checked by completion without another transfer. An open
status or `UPLOAD_INCOMPLETE` does not establish that the original immutable PUT
stored no bytes: the session remains available for diagnosis instead of guessing
and retransmitting. Before a first transfer, a reselected original must match
the captured metadata and checksum. Cancelled/expired sessions cannot resume;
the user may clear that local record and choose a new logo explicitly.

Once verified, selection is independent of transfer/completion. A lost PATCH
response is reconciled against current workspace state; an already-selected
asset needs no second PATCH. Otherwise the exact original body/key is retained.
A changed branding revision surfaces a conflict. The user must reload and choose
to use the verified logo with that displayed branding; another intervening change
still refuses rather than adopting a fresh revision silently. No automatic
cancel runs on error or unmount. Existing destination, credential omission and
redirect restrictions remain in the unchanged `logo-transfer.ts` helper.

Validation uses intercepted browser HTTP and synthetic helper ports only:

```powershell
node node_modules/@playwright/test/cli.js test tests/e2e/logo-upload-recovery-ui.spec.ts
node tools/run-tests.mjs tests/server/logo-upload-recovery.test.ts tests/server/guards.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js apps/web/components/LogoPanel.tsx apps/web/components/WorkspaceView.tsx apps/web/components/logo-upload-recovery.ts tests/server/logo-upload-recovery.test.ts tests/e2e/logo-upload-recovery-ui.spec.ts --max-warnings 0
```

The browser regression was first RED on the actual prior catch: successful PUT
then completion503 produced one cancel where zero was required. The new browser
cases cover completion503, lost completion success, failed/lost selection PATCH,
unknown PUT, reload recovery, concurrent branding changes and closed sessions.
Helper checks include post-PUT unmount and storage failure before dispatch.
These checks do not establish actual Storage/RLS or production logo completion.
No backend permission, migration, worker configuration or deployed source changes
are included. Root owns integration after the active worker release finishes.
