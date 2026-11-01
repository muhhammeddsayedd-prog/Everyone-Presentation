# Remaining M07 work after the English-output rollout

## Current checkpoint - 2026-11-01T10:15:35Z: canonical37 and web feedback summary deployed

Canonical migration37 applied to `pyibofyctwnqpvktepse` with its normal-return
marker and two equal full readbacks; separate independent readback also passed.
Evidence: `tracking/evidence/m07/feedback-summary37-release/2026-11-01T10-02-00-079274Z-apply.json` and `tracking/evidence/m07/feedback-summary37-release/2026-11-01T10-02-27-793801Z-readback.json`. All74 business-table hashes, trace rows,
English/Ready/Reviewed/media/protectedM02 state, old catalogue, OAuth, permissions
and guest metadata were preserved. The only changes are history37, two exact
functions and the checksum-bound guest operation body. The251 executed release
inputs are held exact; never replay its permanent apply claim.

The stable pilot now serves `dpl_EUK29uLiGvrPguUv3T7d5KR19RwC` from284 exact
source files, SHA256 `1af3032799946cedb4b86b061c32d8def260bd1aa09ae1c7625cac9ea1af34dd`.
Isolated npm/Next build passed with zero generated source deltas, then ordinary
Vercel CLI source deployment and Ready/direct/stable-alias checks passed. Project
settings, environment IDs/targets and canonical37 static contract stayed exact:
`tracking/evidence/m07/feedback-summary37-web/2026-11-01T10-14-01-892380Z-ready.json`. An earlier readback while BUILDING was unconfirmed; it did not trigger
a second deployment. Web6pcN remains the rollback anchor; no rollback was run.
Worker2uAS remains unchanged; `tracking/evidence/m07/controlled-pilot/2026-11-01T10-10-36-471547Z-worker-health37.json` observed one healthy2GiB dub1 instance.
No worker restart/replacement, secret transfer, OAuth configuration or frontend
redesign merge occurred. English1.0 stays enabled and pilot runs until owner stop.

Actual signed-in browser GET returned saved English version4f1b81a1, all3 slides
and zero totals; request `3d65df33-2eea-48e4-a6f7-f0f7bfdbd5f5`:
`tracking/evidence/m07/feedback-summary37-web/2026-11-01T10-14-22-596098Z-authenticated-summary.json`. A limit query was refused as INVALID_REQUEST, request0b6c2756,
with no partial counts: `tracking/evidence/m07/feedback-summary37-web/2026-11-01T10-14-50-245943Z-authenticated-input-denial.json`. Six fixed-origin public denial/discovery
checks passed: `tracking/evidence/m07/feedback-summary37-web/2026-11-01T10-14-33-792Z-public-regression.json`. Its synthetic version UUID was not looked up; its
wording does not prove database absence. These reads do not prove hosted nonzero
counts, live guest success, hosted88-tool discovery or the new owner MCP call.
The source inventory is88 operations/88 tools/118 OpenAPI routes; actual new MCP
read and temporary guest-link creation/test/revocation are pending owner replies.
Existing initial/reconnect/project/job/summary acceptance remains PASSED.

Production-only locked dependency audit also passed with zero reported vulnerabilities: `tracking/evidence/m07/feedback-summary37-web/2026-11-01T10-15-53-031507Z-production-dependency-audit.json`; no automatic fixes or dependency changes.

Next: complete those new feedback reads as replies arrive; independently prepare
the disabled full local recovery37 native/filesystem proof, and implement the
requested list_jobs batch_id filter in isolated backend worktree (no cloud38 yet).
The expired04:06 upload inbox remains unreplayed and its capability file unread;
owner journey evidence is pending, not proof that no reservation was made. Keep
full36 metadata recovery and historical local33 native recovery passed separately.
AT069 source-edit automatic approval remains rejected (blocked by policy), with
no retry/manual equivalent/provider action;17 targeted lint errors remain.
AT072 screen reader pending, mobile skipped; no language labels or selector.
Full delegated/contributor/token lifecycle/representative workload/independent
restore and final production acceptance remain open; M07 stays in progress.

## Historical checkpoint - 2026-11-01, 09:50 UTC: SQL37 owned proof passed; bounded Auth metadata observed; cloud37 pending

Actual owned SQL37 run `e109a4d1-b3e8-4caf-98d8-773251359e91` PASSED from
09:45:45.482UTC to 09:46:54.994UTC (69,512ms). Receipt:
`tracking/evidence/m07/feedback-summary37-proof/2026-11-01T09-45-45-482Z-e109a4d1.json`
(SHA256 `3a98d0dabac723e8c599f200a30e6849596b41281c0828868a64a313d008b1b9`).
All 217 executed source seals match and are frozen. Actual Postgres executed
34-37 functional DDL and the synthetic 72-statement count/authority fixture,
then rolled back DDL/data/catalogue/roles and ephemeral history to source33.
Both owned databases were removed; original29 data/full Auth-Storage catalogue,
profile/settings and global-role identities/attributes/memberships remained
exact, new33 roles were removed and the shared lock was released. The receipt's
`native_executed:false` means no FFmpeg/native-media work; Postgres SQL did run.
No cloud37, hosted feedback-summary, provider, media-byte or restore acceptance
comes from this SQL proof. Prior b7 full36 metadata and local33 media recovery
remain passed in their separate scopes, with all failed archives retained.

Before execution, review found the fixture's three preference calls omitted the
required idempotency-key argument. Root fixed their arity with stable synthetic
keys, added actual canonical-signature regression and explicit internal/guest
non-Ready assertions, and changed the wire test to exercise the actual compiled
`sql()` port. Two unit regressions were RED before correction and all seven proof
tests then passed. Earlier syntax/structure review had missed the arity error;
its broad fixture-readiness acceptance was retracted. Latest focused checks are
7 Python SQL/source checks,7 inert proof tests and12 focused API/SDK/MCP tests
(overlapping scopes, not an additive live count). Root also completed full
`npm test`, `npm run lint` and `npm run typecheck`, each exit0; no aggregate test
count is claimed from truncated output. This does not resolve the separate
AT069 targeted-file lint errors or its automatic policy block.

A separate ACTUAL read-only Auth observation returned bounded limited metadata:
`tracking/evidence/m07/oauth-refresh-metadata36/2026-11-01T09-47-58-887145Z-9042fd51-4d70-42d6-9b51-86cd72cfd147.json`
(observed09:47:59.895351UTC; SHA256
`0c4d80173e26b805d4fae274eda54a8c0d406daf714c3477be3621523c2ac535`).
Exact six-column Auth schema/history36/principal-FK/client gates passed. For the
known accepted owner/client, two retained sessions included one refresh timestamp
after creation; latest refresh09:33:21.062735UTC. Audit login/refreshed counts were
both zero in the bounded window; their absence cause is unknown and audit rows
are not client-bound. This is a source-founded retained-client-session timestamp
inference, not proof of the exact current Claude process, token receipt/storage,
rotation, revocation, subsequent MCP use or current deployed Auth version. The
v2.197.0 health evidence is historical. No direct helper credential-store read,
Auth mutation, grant/config change or token-endpoint call occurred; normal
Supabase CLI authentication was used. Operator retry was disabled; CLI internal
retry policy was not verified. The three executed observer files are held exact.

Canonical37 and the compatible web are NOT applied/deployed yet; a new disabled
release proposal is being prepared. Current pilot remains canonical36,
web `dpl_6pcN8Qb1XDkBTsiwKVmexKfWUvf7`, worker
`dpl_2uASsbYobSDwWjMptPjGLcVEdCg3`, English1.0 enabled. Source inventory is
88 user operations/88 tools/118 OpenAPI operations; serving last accepted
inventory stays87/87/116. No frontend redesign merge, environment transfer,
restart or replacement is claimed by this checkpoint.

Next: complete guarded canonical37/web release preparation and live summary
acceptance, while continuing independent owner-controlled delegated-upload
proof. Never replay the expired04:06 inbox or inspect its capabilities. Keep
completed initial authorization/reconnect/authenticated reads, English/app/guest/
PDF/oldversions/Reviewed and local33 proofs passed. AT069 remains policy-blocked
with2 partial files/9 inert passes/17 targeted no-undef errors and no retry or
provider action. Full delegated journey, contributor denial, full refresh/
rotation/revocation/current-process use, representative workload and future
native/filesystem extension remain open. AT072 screen reader pending, mobile
skipped, frontend changes preserved, no new labels/selector, pilot until owner stop.

## Historical checkpoint - 2026-11-01, 04:29 UTC: owned metadata36 passed; SQL37 and owner journey pending

Owned full metadata36 recovery now PASSED. Fresh run
`b7b41927-ff04-4b9d-8d27-f90dff822453` started 04:23:15.971UTC and ended
04:25:02.093UTC (106,122ms):
`tracking/evidence/m07/recovery36-trace-profile/2026-11-01T04-23-15-971Z-b7b41927.json`
(SHA256 `9a1a12fbf1989e278aa05d6656a42d83f024e5620f9322152661f581dc58a5c8`).
All 145 executed source seals matched and are permanently frozen. The exact
native508-proved owner-ACL profile plus unchanged old 12 corrections restored
17,684 portable catalogue fields and all populated table hashes. English
companions/frozen-English equality, trace rows/events, Summary and synthetic Auth,
controlled expiry/new trace, stale callback denial, outbox lease fencing and the
checksum negative passed. Both owned databases and all three owned roles were removed;
all nine cleanup/original29/full Auth-Storage/profile/global-role/lock checks passed.

Two intervening failures remain failed, archived and unreplayed. e3af (101,044ms)
failed before correction because the snapshot caller omitted its semicolon
before the frozen transport's COMMIT. d563 (138,073ms) passed catalogue/data,
Auth and Summary, then its English assertion failed because the frozen parser
accepts object lines and discarded a top-level array. Each 145-source/six-file
archive and full automatic cleanup pass is retained in
`development/m07/recovery36-trace-profile/source-history/e3af2cb6/source-archive.json`
and `source-history/d5634756/source-archive.json`; see `FAILED_E3AF_STATEMENT.md`
and `FAILED_D563_ARRAY.md` in that purpose. The forward fixes changed only the
new caller boundary and exact restore-English query envelope; all old 138 bytes,
permission checks, generic parser and original content/immutability assertions
remain unchanged. Author, root and independent peer each passed the overlapping
10 inert tests; these are not 30 distinct tests or the native recovery result.

This is synthetic, same-cluster LOCAL METADATA recovery, not object-byte/native
media, Storage HTTP, provider Auth/settings/secrets, deployed/independent restore,
physical-crash or RTO/RPO acceptance. Native508 privilege proof and prior33's
native PDF/video plus four filesystem-object recovery stay passed in their scopes.
The next native/filesystem extension is source-proposed only and should target
future current37 after its local functional proof; no such purpose is implemented.

Fresh 04:17:19.997448UTC read-only provider evidence confirms web6pcN/source283 at
the stable alias and unchanged worker2uAS, one alive 2048 MiB instance in dub1:
`tracking/evidence/m07/controlled-pilot/2026-11-01T04-17-19-997448Z-worker-web-health.json`.
No deployment, restart or environment transfer accompanied it. Root corrected
README's current header to this pilot/accepted-connection boundary while retaining
dated history; that header is not broad production acceptance.

The 03:51 owner inbox expired at 04:06:12.601UTC and no owner result was received.
Actual private Write, reservation/byte transfer/completion/processing remain
unverified; do not infer that no MCP operation occurred or inspect capabilities.
Never replay that expired/consumed inbox. The owner retains configuration,
sign-in/consent and the already accepted initial/reconnect/project/get_job results.

Feedback summary37 is implemented SOURCE/LOCAL ONLY, with 11 focused new tests,
31 existing-plus-new guest regressions,13 contract tests, full typecheck and 5 inert
SQL/source checks passed (overlapping scopes, not an additive live count). Its
official CLI2.122.0-created path is
`supabase/migrations/20261101042702_m07_feedback_summary.sql`; source filling and
owned SQL proof are next, with no native SQL/cloud/deployment acceptance yet.
See `docs/integrations/FEEDBACK_SUMMARY.md` and `development/m07/feedback-summary37/README.md`.
Current source inventory is 88 user operations/88 tools/118 OpenAPI operations;
the serving pilot's last accepted inventory remains87/87/116.

AT069 remains blocked SOURCE preparation: two partial rollback-transport files
have 9 inert passes and 17 unresolved ESLint no-undef errors. Automatic approval
review rejected the final import/test/third-document edit before execution with
`blocked by policy` and no further reason. No retry/manual equivalent or provider
operation followed; `ROLLBACK_TRANSPORT.md` is absent. The accepted source-only
plan is `development/m07/WORKER_REPLACEMENT69.md`; no replacement/rollback pass.

Next: finish reviewed owned SQL37 proof before a guarded canonical37/web rollout,
continue independent owner handoff evidence, and retain the native-media extension
as a separate pending proof. M07 stays in progress; manual screen reader pending,
mobile skipped, frontend changes preserved, no labels/selector, pilot until owner stop.

## Historical checkpoint - 2026-11-01, 03:59 UTC: native ACL proof passed; full36 restore and owner upload pending

Committed transfer helper3b4b5c8 and private-inbox f3ed127 provide client-local
signed PUT/TUS and protected nonce/manifest/source-ID handoff. The combined29
focused tests passed (13 inbox,11 unchanged transfer,5 TUS), with targeted
lint/typecheck and independent contract/security reviews; Windows DACL tests
used only synthetic temporary directories/files. The staged-index scan found
zero hits for its fixed14 private-value families, not a full-repository/PII
assurance. Evidence: `tracking/evidence/m07/client-upload-inbox/2026-11-01-local-verification.json` and `tracking/evidence/m07/client-upload-inbox/2026-11-01-staged-private-scan.json`.
Claude's local plaintext tool/session history remains outside inbox DACL control;
no end-to-end secret channel, owner-setting change or transcript cleanup is claimed.

Root prepared a permitted IMG_2850 source inbox at03:51 with expiry
04:06:12.601UTC. The public receipt `tracking/evidence/m07/client-upload-inbox/2026-11-01-owner-inbox-prepare.json`
confirms private-directory verification and source binding only: no handoff
session file, MCP reservation/Storage transfer/completion, candidate or job was
created by preparation. Actual owner Write and full delegated processing remain
pending. Do not read the private capability file or replay an expired/consumed
inbox; use a fresh reviewed preparation if required. No current-validity claim
is made from this dated preparation receipt.

Two fresh current36 metadata rehearsals FAILED at the exact restore-profile
comparison, while automatic cleanup/preservation passed in both:
`tracking/evidence/m07/recovery36/2026-11-01T03-24-57-565Z-c0aa3c0e.json` (86,793ms) and `tracking/evidence/m07/recovery36/2026-11-01T03-34-12-941Z-5d8d863a.json` (109,775ms).
Both owned databases and all three owned roles were removed; original29 data,
full Auth/Storage catalogue/profile/settings and existing global-role identities,
attributes/memberships stayed exact, and the shared lock was released. Exact129
source seals and seven new executed files are archived for each failure; old
claims/controllers/dumps remain and are never replayed. c0 did not capture the
unknown pair. The fresh5d capture recorded13 catalogue differences; its new
trace-table pair is explicit owner-only ACL versus NULL (`tracking/evidence/m07/recovery36/2026-11-01-trace-table-acl-pair.json`).
Original084 remains failed with its separate03:19 cleanup pass; prior local33
recovery stays passed. The5d owner-only table ACL versus NULL native privilege
pair is now proved narrowly, while no restore-profile exception is yet admitted.

Actual native-only run `508198d5-0460-4057-bda3-8aeb1fc8cd66` PASSED with138
source seals (prior129 unchanged plus9 new/public inputs). It started
03:57:54.599UTC and finished03:59:40.821UTC (106,222ms); the filename timestamp
is its start, not its finish. Receipt: `tracking/evidence/m07/recovery36-trace-acl-native/2026-11-01T03-57-54-599Z-508198d5.json`.
Across61 actual roles plus PUBLIC,496 table/3472 column/124 schema matrix rows,
including grant options, had zero symmetric differences. The temporary owner
GRANT rolled back to raw NULL and the full catalogue stayed exact. Both owned
databases/all3 owned roles were removed, original29 rows/full Auth-Storage
catalogue/profile/settings and preexisting global-role identities/attributes/
memberships stayed exact, and the shared lock was released.

This is native privilege proof ONLY, not restore36/StorageHTTP/deployed/Auth-
configuration or RTO/RPO acceptance. A separate exact one-table adapter is being
prepared source-only with its own gate disabled; no functional database change
or restore pass follows from preparation. Next: review that bounded adapter and
perform a fresh full metadata rehearsal under a new claim. Continue the owner
private handoff independently; tests/preparation are not a delegated upload pass.

Web6pcN/source283/canonical36/English1.0 and worker2uAS remain the recorded pilot.
Scoped AT074 success/failure audit plus actionable app/API and owner get_job
acceptance (b3fcdeb) remain passed with no invented server-log correlation;
terminal n8n404 cause stays unproved. M07 stays in progress; screen reader pending,
mobile skipped, Claude frontend preserved, no labels/selector, pilot until owner stop.

## Historical checkpoint - 2026-11-01, 03:19 UTC: scoped AT074 and failed084 cleanup passed; fresh recovery pending

The stable pilot now serves web `dpl_6pcN8Qb1XDkBTsiwKVmexKfWUvf7`, source283/SHA
`d17a3f4eba0f0dc5a19ed02bc0c717c8b1472ce692fe910118ace3238fbc79ee`. The03:10:26 provider source-build Ready/readback
matched the stable alias and preserved canonical36/static contract, existing
project/environment IDs and targets. No worker, environment or OAuth change
accompanied this release. Source283 includes two safe error-copy changes plus
the already merged attempt-trace parser; the exact282-to283 delta is recorded,
not a claim that only two files were deployed. Ready: `tracking/evidence/m07/source-unreadable36-web/2026-11-01T03-10-26-362504Z-ready.json`;
source delta: `tracking/evidence/m07/source-unreadable36-web/2026-11-01T03-01-14-354524Z-source-delta.json`. Local Windows build was quality proof only;
Vercel built the original sealed source on Linux, with no prebuilt acceptance.

The03:11 signed-in API and actual failed-job page show replacement/manual-entry
guidance for SOURCE_UNREADABLE, retry=false, one Cancel and no Retry button.
API request `19c428d3-2b60-4039-8615-a9f397d2b074` is recorded in `tracking/evidence/m07/source-unreadable36-web/2026-11-01-authenticated-api-app-guidance.json`.
The owner then reported the same existing MCP get_job result, request
`dbe872d6-856a-4d4b-bd0d-b8daf9dc586b`, matching that API/app; server-log
correlation was not verified. Evidence: `tracking/evidence/m07/source-unreadable36-web/2026-11-01-owner-mcp-job-guidance.json`.
Six no-credential host probes and four job/MCP denial/metadata checks passed:
`tracking/evidence/m07/controlled-pilot/2026-11-01T03-12-32-119Z-c3c453d1-public-host.json` and `tracking/evidence/m07/source-unreadable36-web/2026-11-01-public-job-mcp-regression.json`. These public checks are not a new OAuth lifecycle
or full delegated-journey acceptance.

The actual02:50 paired audit plus deployed actionable app/API/owner-MCP guidance
now pass the scoped AT074 success/failure check: successful untargeted IMG2852
job6763 has five accepted stages/refs31693-31697 and source-bound OpenAI/English
records; unreadable67-byte job3fde failed preparation with SOURCE_UNREADABLE,
ref31703 and no OpenAI records. Old10 Ready versions/57slides/42pins/raw-English,
9PDF metadata, Reviewed row/2old media/24frames and protected M02/static state
were preserved in the bounded audit (`tracking/evidence/m07/job-attempt-observability36-live-sidecar/2026-11-01T02-50-02-687228Z-8829fa59-3c1c-46dc-b20b-32649645c275.json`). No semantic-accuracy,
Reviewed-target append, all-jobs absence or re-fetch of every old object byte is
claimed. Fresh terminal n8n metadata404 absence cause remains unproved; durable
stage diagnosis stands and no payload-retention configuration was changed.

Current36 owned recovery attempt084 remains FAILED after78,438ms: safeRole
expected a numeric OID but PostgreSQL returned decimal text; the same legal
membership tuples arrived in the opposite order. Its original failure receipt,
cleanup-unconfirmed state at failure, claim/artifacts and129-source/seven-new-file
archive remain historical and were not replayed or rewritten. Receipt:
`tracking/evidence/m07/recovery36/2026-11-01T03-01-28-673Z-0843096a.json`;
cause: `development/m07/recovery36/FAILED_084_SQL_RESULT.md`;
archive: `development/m07/recovery36/source-history/0843096a/source-archive.json`.

The separate guarded cleanup now PASSED at03:19:20.008UTC after its03:17:58
before observation. All three exact owned roles were removed; original29 rows,
functions/profile/full Auth-Storage/catalogue and58 existing roles/94 memberships
were preserved, both temporary databases are absent, and only the exact failed084
lock was released. Root independently checked the lock absent. Before/after:
`tracking/evidence/m07/recovery36-cleanup084/2026-11-01-before.json` and `tracking/evidence/m07/recovery36-cleanup084/2026-11-01-after.json`.
This cleanup provides no current36 restore credit, cloud restore acceptance or
RTO/RPO result. Next: the narrow OID/closed-membership comparison fix with native
JSON regression, then a fresh source freeze/claim and owned metadata rehearsal.

The client-local transfer helper source3b4b5c8 passed16 focused inert tests,
lint/typecheck and review; actual private Claude handoff/reserve-transfer-complete
remains unverified. Prior local33 recovery and completed English/guest/PDF,
Summary and owner initial/reconnect/project reads remain passed in their scopes.
M07 stays in progress; manual AT072 stays pending, mobile skipped, Claude's
frontend preserved, no labels/selector and pilot/worker2uAS running until owner stop.
Next: narrow native-JSON OID/membership comparison fix and fresh recovery freeze/claim;
remaining delegated/token/replacement/representative-workload checks stay open.

## Historical checkpoint ? 2026-11-01, 02:41 UTC: canonical36 installed; live audit pending

Canonical36 was applied once at02:19 with a normal return marker and two
matching immediate readbacks, followed by the separate02:20 readback. All74
existing table hashes, normalized old catalogue/Auth/OAuth, nine claim ports,
English1.0 and protected M02 stayed exact. The new operator-only trace table was
empty at installation; capture is enabled, no backfill occurred, and the guarded
disable-only recovery was not activated. Existing account/business permissions
were preserved; scoped new trace-owner permissions were added. No web/worker,
environment or OAuth-client change accompanied this database release.

Evidence: `tracking/evidence/m07/job-attempt-observability36-release/2026-11-01T02-19-19-577795Z-apply.json` and
`tracking/evidence/m07/job-attempt-observability36-release/2026-11-01T02-20-17-194633Z-readback.json`.
The02:21 before-audit baseline passed (`tracking/evidence/m07/job-attempt-observability36-live-audit/2026-11-01T02-21-35-394018Z-before.json`), recording10 Ready
versions/57 slides/42 pins/3 raw and1 English companions,9 ready exports,
62 referenced assets and2 Reviewed-media/24-frame rows. This is a baseline,
not after-preservation or completed AT074 acceptance.

Owner selected and uploaded IMG_2852.MP4 (5,294,727 bytes) as an untargeted scan,
job `6763e5fa-dc53-4956-8d9b-17bbc437609e`. Root observed UI Completed; the actual file was
verified after upload in `tracking/evidence/m07/job-attempt-observability36-proof/2026-11-01-owner-selected2852-source-verification.json`. No read-only after audit,
provider/attempt trace or new semantic-accuracy acceptance is credited. The
original IMG_2850/Reviewed append was not performed. The app file picker now
awaits owner selection of the prepared67-byte unreadable synthetic MP4; no
failure job ID or failed-job result is known yet. Do not resubmit the real clip.

The three-file actual2852 sidecar explicitly preserves that substitution and
the original baseline. Root armed it after review/eight inert tests; it has not
executed and no input was created. It remains separate from frozen original
observer/apply and238-source proof bytes. Next: obtain the actual failure job
ID and actionable app error, then perform the bounded sidecar after audit of
both actual jobs and old Ready/Reviewed/M02 state. AT074 and M07 remain partial.

Web6L6v and worker2uAS continue on the stable pilot. The02:25 worker observation
(`tracking/evidence/m07/job-attempt-observability36-release/2026-11-01-worker-health-after36.json`) reports Ready, one alive2048MiB dub1 instance and
no redeployment; startup logs/queued replacement are not thereby accepted.
The no-credential public-host checks passed (`tracking/evidence/m07/controlled-pilot/2026-11-01T02-25-29-965Z-08711e9f-public-host.json`), not new
signed-in/OAuth/processing acceptance. Hosted specs ACK/extraction core already
passed; the former ACK block is historical, with its unknown original claim retained.

Completed controlled English/guest/PDF/revocation/Reviewed/old-version proofs,
Summary HTTP and owner-attested MCP read, initial/reconnect/project-read owner
acceptance and local33 recovery stay passed in their recorded scopes. No more
language labels or selector are required; broader semantic accuracy is unclaimed.
Manual screen reader remains pending, mobile stays skipped, Claude frontend is
preserved and the pilot stays running until the owner stops it. While file
selection waits, the next independent backend source task is the AT064 client
streaming-transfer/private capability handoff, with no Claude credential-store
reads or owner configuration/sign-in/consent changes.

Earlier dated snapshots below retain their then-current results and next actions;
they do not override this checkpoint. See `development/m07/POST_TRACE36_REMAINING.md`.

## Historical pre-release snapshots (02:15 UTC and earlier)

Reviewed against `milestones/M07_API_MCP_RELEASE.md`, the AT-063–075 definitions
in `docs/quality/TEST_STRATEGY.md`, the release runbook and the current M07 matrix.
This is an execution order for remaining evidence, not a new product scope or a
claim of full production readiness. Canonical35 is applied/read back as of
2026-11-01T00:57:45.216887UTC. Summary web6L6v/source282-13209b is Ready on the
stable alias; worker2uAS/English1.0 remain running. Signed-in Summary HTTP read
and query rejection passed. Actual01:10 app English regression passed; the owner
reports the new Summary MCP read matches HTTP, without MCP request ID/server
correlation. Actual local attempt36 proof7cff passed with all185 source seals and
rollback/preservation/cleanup independently checked; no cloud36 release yet.

Current gate checkpoint (2026-11-01T02:15:05.601UTC): fresh owned release-gate
proofbc54 passed, all238 current seals and seven captured phases/schema/nine
claim ports independently validated. All74 preservation, transaction-only36,
rollback to33, both-database/new-role cleanup and original29/Auth-Storage/global
role/shared-lock preservation passed. Failed207/281 archives and original185
sources remain intact. See
`development/m07/job-attempt-observability36-gate-proof/LIVE_SQL_RESULT.md`.
Canonical36 is still unapplied; the next operation is guarded inspect/apply/
readback, followed by the before-baseline and two actual scoped upload jobs.
This local gate pass does not close hosted AT074.

| Order / case | Current evidence boundary | Concrete next action and dependency |
| --- | --- | --- |
| 1. English rollout / AT-068 | Controlled scan/internal/frozen version/PDF/old-cohort proof and approved guest create/test/revoke passed with normal-owner-profile/actual-annotation-destination boundaries. Canonical35/all74 preservation, web6L6v Ready, signed-in HTTP and01:10 app English regression passed. Owner Summary MCP result matches HTTP without server request correlation. | Carry completed English and owner connection evidence forward; continue remaining live M07 work. No pending guest approval/active self-test link, labels or selector. |
| 2. Operator correlation / AT-074 | Historical31686 GET404/currentWF02 save:none remain recorded without proved absence cause. Actual7cff direct/real-routine proof and freshbc54 release-gate proof passed:238 exact current seals, seven phase gates, schema/nine ports, all74 preservation, rollback and full cleanup independently validated. Failed207/281 archives and original185 sources are intact. Canonical is still35; no hosted36 acceptance. | Admit actualbc54 proof and perform separately guarded canonical36 inspect/apply/readback once. After Ready36, capture the old Ready/Reviewed/M02 baseline, then create/audit the two ordinary-app real-success and prepared unreadable-failure jobs with actual IDs. Never enable payload retention, reconstruct old stage IDs or retry old jobs for tracing. |
| 3. Full delegated workflow / AT-064,066,068 | Owner initial authorization, duplicate details, redirect-only reconnect and authenticated Dummy Pilot Test reads passed. Controlled signed lifecycle/permission/idempotency tests remain separate from a complete real delegated journey. | Owner's already working Claude client performs the remaining ordinary operations against shared persisted pilot data: real byte transfer, processing/review, changes/Reviewed, assignment/Shortlist, generation/PDF and link lifecycle. Record real IDs plus app readback and typed stale/idempotent/retry behavior. Do not re-open connection acceptance or configure/sign in/consent for the owner. |
| 4. Token and contributor boundaries / AT-065 | Current production code and controlled signed transport/SQL tests enforce scopes. Live refresh/rotation/revocation and a real contributor's denied operations remain unverified. | Use authorized test sessions/principals and a reviewed bounded lifecycle plan. Preserve the owner's accepted grant/session and current account permissions. Do not invent cloud identities, weaken checks or turn existing sign-in access into a new broad grant. Source-only test preparation can proceed while real session/identity access is unavailable. |
| 5. Queued-job replacement / AT-069 |04:17 health passed. Two partial transport files have9 inert passes and17 no-undef errors; final edits were policy-rejected before execution with no retry/provider action. | Keep the policy block and existing source plan recorded. No queued-work replacement or application rollback is accepted; compatible app B and reviewed execution prerequisites remain. |
| 6. Recovery / AT-070 | Owned metadata36 b7 passed04:25 with17,684 exact catalogue fields, all populated table hashes, English/trace/fences and full cleanup. Prior33 native/media and508 privilege proofs stay passed separately. | Complete local functional37 proof, then separately review a future-current37 native/filesystem-media extension. No Storage HTTP/provider Auth/configuration/secrets/deployed/independent/RTO/RPO acceptance. |
| 7. Representative sizing and cost / AT-060,M07 step7 | The200-file native diagnostic used tiny synthetic no-audio footage. Actual production worker is serial; it does not inherit the diagnostic's two-call scheduler. | Use already permitted representative footage with a bounded admission limit, actual provider usage, durable queue/attempt timing, partial failures/backpressure and resource measurements. Report measured durations/cost and dataset limitations. Do not infer a200-real-video or endurance pass from the synthetic diagnostic. |
| 8. Final parity/security/accessibility/scope / AT-063,067,071–073,075 | Existing parity and access regression evidence remains; focused English rendering changes add no operation or selector. Manual screen-reader acceptance is not performed; mobile is skipped by the owner. | Reconcile release source/schema/workflows and run affected regression/security checks. Preserve shared-file coordination with Claude's redesign. Keep AT-072 pending until actually performed and mobile skipped. Publish production readiness only after the required live/recovery evidence exists. |

The source-name investigation does not need new labels: the captured original
ASR lacks a token from the previously corrected Reviewed full name. Its faithful
translation cannot use that corrected-name literal comparison as a semantic
gate. The failed historical component receipt stays unaccepted because its
English wording was discarded. The controlled scan and saved-version proofs now verify source-bound English
and Reviewed-fact preservation separately; the display retains source uncertainty
and does not inject the corrected Reviewed name into translation. Existing Arabic
name/age acceptance remains passed. No further English/mixed language labels are
a dependency, and broader semantic accuracy is not claimed.

Workspace-summary source is merged asab1c3d5, guarded by66956b7, with corrected
fixturec8e4fae. The fresh ef4cb6c2 owned local SQL proof actually passed at
18:48:18.228UTC: actual30-33 then34/35/fixtures, complete rollback to owned33,
both databases/new roles removed, original29/Auth-Storage catalogue/data/global
roles exact and shared lock released. Earlier3304 failed only the synthetic
asset-provenance fixture and remains preserved with verified cleanup; no replay.
The successful107-input harness/source/fixture/history bytes are frozen. See
`development/m07/workspace-summary35-proof/LIVE_SQL_RESULT.md` and actual receipt
`tracking/evidence/m07/workspace-summary35-proof/2026-10-31T18-47-07-800Z-ef4cb6c2.json`.

Canonical35 is applied and Summary-compatible web6L6v is Ready; actual pilot
is web6L6v/worker2uAS/canonical35/English1.0. Root inspect passed00:56:24UTC;
the one apply passed00:57:22UTC with normal return and two matching independent
readbacks, followed by the separate00:57:45UTC readback. All74 existing table
projections/full OAuth/Reviewed/old Ready/English/protected M02 stayed exact.
The approved guest create/test/revoke is
completed and the self-test link is revoked; no pending approval remains. Its
actual normal-profile and privately extracted annotation-destination boundaries
are in `tracking/evidence/m03/english-guest34/2026-11-01-guest-english-workflow.json`.
The initial preflight false positive was only the rotating temporary expiry of
managed CLI role OID17603/name `cli_login_postgres`. Commit29079b2 omits exactly
that `rolvaliduntil` comparison field while independently enforcing finite
0<TTL<=600seconds and safe role attributes; no role or permission mutation.
Full atomic preservation remains74 tables/full OAuth; later live static gates
freeze schema/owners/RLS/grants/static OAuth/ten configs, allowing legitimate
business and per-user authority changes. Actual release evidence is in
`tracking/evidence/m07/workspace-summary35-release/2026-11-01T00-57-22-943495Z-apply.json`
and `2026-11-01T00-57-45-216113Z-readback.json` in that same directory.
The provider source-build Ready receipt is
`tracking/evidence/m07/workspace-summary35-web/2026-11-01T01-03-59-685059Z-ready.json`.
It proves original source282/SHA13209b, stable alias and unchanged environment/
project/static-contract metadata. Actual signed-in Summary HTTP read d28d95bc
and unexpected-query rejection4865d0ef passed; six public GETs/four Summary/MCP
denial/metadata checks passed. The owner-reported new Summary MCP read matches
HTTP with no supplied MCP request ID or verified server correlation; signed-in
app navigation/English display passed at01:10:51UTC, preserving Reviewed and
explicit legacy absence. Worker health01:06:22 confirms one alive2GiB dub1 instance;
the original false-negative digest-prefix verifier receipt/correction are both
retained, no worker failure or extra health request.
The owner MCP receipt is
`tracking/evidence/m07/workspace-summary35-web/2026-11-01-owner-mcp-summary-read.json`.
Actual local attempt36 proof7cff passed at01:17:34.069UTC: both fixtures, full
34/35/36 rollback to33/no36 history, original29/Auth-Storage/profile/global roles
exact, both databases/new roles absent and shared lock released. Actual receipt:
`tracking/evidence/m07/job-attempt-observability36-proof/2026-11-01T01-16-10-092Z-7cff5c7d.json`.
Next: review guarded additive attempt-trace release proposal before any canonical
dispatch, then real successful/failed nonprotected operator audit. Local synthetic
SQL grants no hosted AT-074 acceptance.
Continue eligible safe
observability/full-journey checks without enabling node payload retention or
inventing per-stage history. Claude frontend, owner connection and local33
recovery passes stay preserved; screen reader pending/mobile skipped/no labels.
Settings de276c7 is regression-only: the existing helper already catches errors;
no product fix is claimed. LocalSQL35 success does not close full production or
deployed/independent restore acceptance.

## 2026-11-01, 01:44 UTC: new local gate proof failed safely; pilot unchanged

Fresh release-gate run207731a6 failed with PostgreSQL `type "jsonbas" does not
exist`: a missing space fused a JSONB cast and SELECT alias. Independent AST
inspection also found the sibling `jsonband` cast/AND boundary in that same new
builder. Parse-only tests accepted these unknown type names. No gate/fixture PASS
is credited. Failed receipt:
`tracking/evidence/m07/job-attempt-observability36-gate-proof/2026-11-01T01-42-48-715Z-207731a6.json`.

Full rollback/cleanup passed: both owned databases/new33 roles removed, original29
full data/catalogue/Auth-Storage/profile/global roles unchanged, shared lock
released. All229 executed source seals matched when archived;44 new sources are
saved byte-exact as base64 under the proof's source-history/207731a6, and prior185
remain unchanged. The permanent claim/private diagnostic/wire stay retained;
this run will not be replayed. See FAILED_207_SQL_RESULT.md in that proof folder.

The earlier7cff real claim/callback/retry SQL proof and owner-reported Summary MCP
read stay passed. Canonical is STILL35; trace36 is NOT installed. Web6L6v,
worker2uAS and English1.0/Reviewed/old-version/guest-revocation proofs stand.
Next: narrow JSONB/alias/keyword fix plus semantic AST regression, a fresh owned
gate proof with normal/negative/recovery/cleanup acceptance, then separately
guarded36 release and new live job audits. Screen reader pending, mobile skipped,
frontend preserved, no language labels/selector, pilot until owner stop.

## 2026-11-01, 01:59 UTC: fresh gate SQL completed; OAuth projection needs narrow delta

Fresh run28122d90 completed the SQL wire and captured all seven gate phases, but
the Python acceptance check refused the normal transition. Only the inherited
OAuth hash and static OAuth hash differed: their envelope includes the newly
created trace-owner role and required EPS USAGE grant. All74 old table hashes,
normalized catalogue, claim ports and English matched; the actual new schema and
expected catalogue delta passed independent pure validation. Whole gate proof
remains FAILED/unaccepted; no fixture or cloud acceptance is inferred.

Both temporary databases/new33 roles were removed, original29 data/full catalogue/
Auth-Storage/profile/global roles stayed exact, and the shared lock released.
The failed receipt, all233 source seals and exact source delta are retained under
source-history/28122d90. The earlier207 archive remains unchanged; no recursive
archive copying or run replay is used. Diagnostic:
`tracking/evidence/m07/job-attempt-observability36-gate-proof/2026-11-01-failed281-diagnostic.json`.

Next: normalize only the exact new trace role/EPS grant in both OAuth envelope
hashes, preserving every other Auth/OAuth field and full atomic claim count.
Schema/delta checks still require the exact new role/grant. Run another fresh
owned normal/negative/recovery/rollback proof before any canonical36 release.
Canonical remains35 and tracing is NOT installed. Passed English/guest/version/
Reviewed and owner MCP/connection results stand; pilot running, screen reader
pending, mobile skipped, frontend preserved and no language labels/selector.
