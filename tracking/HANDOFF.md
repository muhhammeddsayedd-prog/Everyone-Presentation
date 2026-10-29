# Current handoff - Everyone Presentation Studio

Implementation commit `7f4533f400140c8c002fe6b2b51aae09400ab38f`. The final documentation/source archive checkpoint is recorded separately in ignored `dist/SOURCE_CHECKPOINT.json`.

M02 is verified by `tracking/evidence/m02/ACCEPTANCE_MATRIX.md`; M03 is in progress. M01/logo/shared-record release checks remain separate. Hosting is explicitly deferred. Do not restart the requirements interview or select/deploy hosting.

## Current evidence

- Local/canonical history17; exact migration17 SHA4af04b4a3fb050e39aa23958c3f82e304cc7d7a1f450a5d93f7f50bc001bd836. Apply was dispatched once. Bounded read-only reconciliation2aedbfeb distinguishes nine inherited managed-PUBLIC booleans from explicit grants, proves at-apply preservation and records later authorized app writes separately. Failed/unconfirmed receipts remain unchanged.
- M02 text/PDF/DOCX plus scanned two-page English/Arabic PDF passed actual app/native/private Storage/n8n/OpenAI. Scanned OCR6715+extraction2682 tokens; final canonical2e8ab32d passes10 checks. ServiceBearer exact claim replay survived web restart and real2233-token recovery; local official MCP2.4 tests are separate from external Claude OAuth/M07.
- Canonical Dummy Test4b70c8ce-18bd-4a8c-b5a9-bc1156c06463/workspace098d5b48-42a3-475b-b562-735c9eafce80 and owner-authorized Dummy Reuse Testbd14d10f-b1c5-4d6a-8b4d-e5c48208433c/workspacee470aefd-e0f7-480c-bf0d-170cb2cb7069 share existing Dummy Client. Genuine Producer mohamed.abdelrahman@everyone.film has absent-only cast grants; no fake Auth identity.
- Synthetic candidateb7341092-50c4-49b4-ad5f-a0ceedddebf1 is reused by both projects with distinct saved availability. Factual Reviewed was tested and reset after a factual edit. It is not casting approval.
- Real app video job55415ff2-e049-468f-a0a1-7240fba350b0 succeeded all5 stages. Candidate d5e665b3-dc23-4ead-858e-81abbce55743; media26d210e8-f0cc-4f87-b9df-beb3dbca75d8; Ready original20c0ed17-5705-4056-a53d-9898384d4187. Arabic transcript and4grounded populated/7unknown fields retained; extraction1649tokens and actual committed transcription20seconds. Age-as-of staysNULL, profileUnreviewed.12actual timestamped JPEGs load;3selected. Original video loads at19.776s. Shared frame edit did not change project pins and was restored. Public metadata: `tracking/evidence/m03/live-capture/README.md`, `app-transcription-usage.json`, `tracking/evidence/m03/app-media-read/browser-media-success.json`.
- Preserve failed jobs3a535387-bc1a-4e31-9bb4-34369d758238,2c5d4582-44e1-4fe2-b49b-d574cf872680,237d0b59-4763-4229-ba32-f04fe2f29c79. Initial declared-vs-verified hash and strict audio-reference handoffs were fixed. Third job recovered an expired prepare lease then failedPROCESSING_FAILED; cause/billing is still unknown. Direct OpenAI probe1e992dda is service diagnosis only. Do not rewrite failures or invent zero billing from missing stored metadata.
- Preserve protected specs jobb3f90268-147d-41d4-8875-2a6435df1496 and literal note `Manual verification: preserve this instruction while extraction is pending.` Intentional waiting_for_input/INPUT_CHANGED is expected. Never auto-retry or overwrite it to get green status.

## Implementation and runtime

Shared domain/canonical adapters cover manual profiles, global supplied facts, review fingerprints, duplicate choices, source media/frames, independent project availability/pins, strict HTTP and MCP operations. New private job/asset SQL is migration17; no runtime authority beyond the existing11 fixed operations. Actual claims always recheck requester/project/capabilities.

Video/image native work remains a local network-disabled container, image sha256:59b6728cdbf37a54b466239020839936d78ccd10eec2e964f9d1af78cb7cc0ed. PDF raster image sha256:52110c040822f1f1ecfd087518daa7583569c64a641dbdfe6585b5e8b7a98979. FFmpeg5.1.9, current OpenAI SDK7.45.1, extractiongpt-6.1-sol and transcriptiongpt-transcribe are configured. No images were generated/inferred as candidate facts.

WF02gfhxzvSkprS2CI4o/current active version34de9d6c-5d5c-4a7c-92cf-128d824df80f routes five metadata-only stages. WF01 unchanged. n8n MCP had internal errors; existing private management API was the documented fallback. No worker listener/tunnel/hosted server. Native/Docker child has explicit emptyPATH and no provider/DB/n8n credentials.

Candidate DB config, private worker flag and web purpose flag were enabled after reviewed dry-run/readback. Observed global Storage cap50MiB is explicitly enforced and advertised; native/DB target remains256MiB. No provider plan change. Ready reads work with uploads disabled, including larger previously ready media.

Healthy acknowledged COMMIT returns to max2 pool; failure/abort/unknown commit destroys it. Every transaction rechecks identity, finite future role expiry and authority/logging. Idle30s/heartbeat20s, lifetime300s, connect3s, rolelimit4 and TLS/SCRAM stay bounded. Candidate callbacks retry only identical UUID/sequence/payload up to3 sends within15s under lease/cancel guards; no native/provider recomputation. Fixed safe operation diagnostics contain no messages, bodies, private payloads or leases.

Protected ignored configs already exist: `.env.worker.local`, `.env.worker-runtime.local`, `.env.job-service.local`, `.env.candidate-runtime.local`, `.env.pdf-vision.local` plus existing verifier files. Do not print them, rerun preparation/rotate secrets, borrow browser tokens or use a service-role key. Provider file permissions were corrected to owner/SYSTEM without changing bytes. Private real transcripts/frames/AX/PNGs stay under ignored `.local/m03-live-evidence/` and private media caches.

Final current-runtime receipt is `tracking/evidence/m03/final-local-runtime.json`: web launcher38864/server39076 and worker launcher48312/runtime46580 were owned/alive; worker core source bytes predate its launch, and a fresh post-build browser reload shows11 fields/12 loaded frames/3 selected. Latest worker log is `.local/specs-runtime/worker-m03-live-v5.stdout.log`; web log is `.local/specs-runtime/web-m03-final.stdout.log`. Verify ownership freshly on resume; PIDs are checkpoint observations. Final archive/commit/scan identity is in ignored `dist/SOURCE_CHECKPOINT.json`. If stopped, use pinned Node24 and `node tools/dev-central.mjs` with process-only CENTRAL_SPECS_UPLOADS_ENABLED=true, CENTRAL_CANDIDATE_UPLOADS_ENABLED=true, CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES=52428800. Worker: EPS_SPECS_FILES_ENABLED=true, then `node tools/start-specs-worker.mjs`; protected projectors load secrets. Do not start duplicate workers or touch unrelated processes.

## Next exact work

Read `milestones/M03_MEDIA_LIBRARY.md` and `tracking/evidence/m03/REMAINING_REQUIREMENTS_REVIEW.md`. Finish these before marking M03verified:

1. True resumable byte transfer with offset/progress/per-file cancel. Current tab-local actor/workspace intent recovery preserves IDs/hash/idempotency, reselects the original and remints a URL; interrupted PUT restarts from byte0. Do not call that TUS/resumable.
2. Supporting image/document association, separate from generated actual source frames.
3. Editable source-backed role filter suggestions with published API/MCP parity.
4. Chosen-timestamp real frame extraction/replacement via bounded jobs and parity.
5. Broader English/Arabic/mixed answer-key/factual/duplicate/material-append/recovery acceptance and frame-quality review. Original video browser display853x480 versus coded/probe/JPEG800x480 exposes a SAR handling risk: parser drops sample/display aspect ratio then setsar=1. Exact input SAR and corrected future derivative geometry remain unverified. Preserve old immutable media/pins; do not claim quality or exact parity from loaded thumbnails.

Owner authorized introductions in C:\Users\iway\Downloads\Videos. Only one Arabic introduction completed the app path this checkpoint; other material/language coverage remains unverified. Existing-source frame selection/pin preservation is tested; new material appends and full duplicate resolution still need actual app coverage. Future M04 assignments/versioning/guest/PDF and M07 OAuth/restore/production remain separate.

## Checks and packaging

Current npm391/391 and global lint passed with stable595 source hashes in `tracking/evidence/m03/final-offline-checks/2026-10-29T12-02-52-701736Z-02081f4f-npm-lint.json`. Earlier Node operations/tools88 and pinned Python operations132 are retained separately. An earlier reporter-count capture failed while commands passed; read-only reconciliation preserves that receipt/output. Typecheck/scoped reviews and optimized builds are recorded beside source fingerprints. The final current optimized build passed in `tracking/evidence/m03/final-offline-checks/2026-10-29T12-06-48Z-90d41140-build.json`; strict pack325 passed after preserving/fixing a BOM receipt and archived relative-link base. Project skill53/550 integrity passed earlier in this session with unchanged sources. Source ZIP/fixed private-value scan are bound separately in dist/SOURCE_CHECKPOINT.json; none is production acceptance.

Use `.venv-skills\Scripts\python.exe -X utf8`, never PATHpython (prior installer alias incident retained). No recursive cleanup/reset. Keep old source ZIP/checkpoint before repackage; run fixed9-family source/index/ZIP scan after exact archive/index settle. Do not rerun old fixed-release mutators against the now-enabled17/data-bearing state. Future schema changes require fresh additive discovery/proof and the coordinated next migration.
