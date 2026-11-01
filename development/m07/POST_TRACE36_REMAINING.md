# M07 remaining acceptance after trace36 installation

Reconciled from the milestone packet, AT-063–075 definitions, current main
receipts and existing release matrices on 2026-11-01. This is a source-only
acceptance reconciliation, not a new feature decision or a production pass.
No operational command, provider request, upload or database change was made
for this document. The root agent owns the main progress/handoff updates.

## Current checkpoint - 2026-11-01T17:40:08Z: batch filter38 is deployed; live HTTP/auth checks passed

Stable pilot now serves `dpl_CUXVUZkWjkrQPBTv7XqmA9tF3y4o`,285 source files,
SHA4edc5f1a, with actual canonical38 and unchanged worker2uAS. Ready proof:
`tracking/evidence/m07/job-batch-filter38-web/2026-11-01T17-37-06-827794Z-ready.json`.
Direct/stable identity, source/quality/canonical markers, unchanged project/env
metadata and repeat static database checks passed. Isolated build passed; all
928 postmerge tests/0skips plus lint/types passed. Fresh17:36:50 health confirmed
one alive2GiB dub1 worker on the existing digest; no worker/env/OAuth mutation.

Signed-in HTTP passed empty batch filtering, invalid/duplicate query denials,
unchanged24-job unfiltered IDs, project read and safe SOURCE_UNREADABLE read.
Evidence: `tracking/evidence/m07/job-batch-filter38-web/2026-11-01T17-40-08Z-authenticated-HTTP.json`.
All24 saved jobs have null batch IDs; hosted nonzero filtering is not claimed.
The205-job nonzero100/100/5 case passed locally, with authority/rollback/cleanup.
Six public auth/discovery checks passed at17:38:19. Initial Claude authorization,
reconnect and prior authenticated reads remain PASSED. New filtered MCP read is
pending owner response, separately from completed connection acceptance.

Canonical project6da14b82 now reports Live Testing Project; its old Dummy Pilot
Test name remains historical evidence. No rename/owner changes were overwritten.
New succeeded candidate job1f18c48a targets8d1254e8 (not Reviewed25a3c924), so it
does not close the pending owner-upload append check. Read-only specs failure
audit13699983 confirms prepare1/extract3, n8n31868/31869/31870/31872 and exhausted
DEPENDENCY_UNAVAILABLE. Specific OpenAI timeout/network/HTTP cause was not retained;
do not invent it. No retry/mutation occurred. A safe specs diagnostic patch is
being developed in a new isolated worktree, not merged/deployed to the worker.

Next: finish that diagnostic source/test slice, then review its compatible worker
rollout separately. Reconcile new batch/feedback MCP responses and temporary
guest test only as owner replies arrive. Existing full local37 native recovery,
English/Reviewed/Ready versions and original acceptance remain passed. Manual
screen reader pending, mobile skipped, pilot stays running. AT069 policy block
remains ('blocked by policy'), with no retry/manual equivalent/provider action.

## Historical checkpoint - 2026-11-01T17:31:59Z: canonical38 applied; compatible web build next

Official `20261101110939_m07_job_batch_filter.sql` is5869B SHA256
47af16421613320b76abc6e7119da92912859f0334b03b047a98492f75f6ea2d.
Actual apply PASSED with normal return and two equal full reads:
`tracking/evidence/m07/job-batch-filter38-release/2026-11-01T17-28-00-388406Z-apply.json`.
Separate two-static-read readback passed at17:28:42.546410UTC. All74 business
hashes/trace, whole old4 pg_proc, old catalogue/OAuth/RLS/grants/owners and
English/Reviewed/Ready/media/protectedM02 were preserved. Only38 history and the
new five-argument read function changed. No worker/env/OAuth mutation occurred.

The15 core/contract/docs/tests files plus4 branch QA receipts are integrated from
758affc; all24 branch paths matched before the documentation status update.
The376 actual205-proof sources are recoverable before merge from364 checked raw
Git blobs atd369848 plus12 public installed inputs in the retained archive.
Full postmerge quality PASSED928 tests/0skips, lint/typecheck exit0. Exact sparse
web payload285files/3,068,061B/4edc5f1a passed14-family private-value/source scan.
Fresh17:28:55 health showed stable webEUK29 and unchanged worker2uAS with one
alive2GiB dub1 instance. New web operator is Root-enabled with actual native/
SQL/quality pins; source preparation passed. Current web remainsEUK29; compatible
build, deployment Ready, signed-in filter and MCP regression are not yet credited.
Frontend coordination was appended without changing its21396 existing bytes or
layouts. Worker, owner guide/assets and completed Claude connection acceptance
remain preserved. Feedback MCP/guest check and owner upload dependency remain
pending; no new link was created. Pilot stays running, screen reader pending,
mobile skipped; AT069 policy block remains with no retry/provider action.

Next: isolated quality build, exact canonical static admission, source deployment
to the existing stable pilot, then Ready/worker/authenticated filter regressions.

## Historical checkpoint - 2026-11-01T17:25:53Z: 205-job SQL pagination and preservation passed

Fresh bb9cf2bf-f3b9-4d7a-beff-47df65dfe76b PASSED in68,362ms:
`tracking/evidence/m07/job-batch-filter-proof/2026-11-01T17-23-47-142Z-bb9cf2bf.json`
(SHA256 c2020d123b7d54c27a6440b4bf6ede7c9dd1c751ec13b1613f7ad2c1bf62b2c4).
All376 source hashes match. Actual PostgreSQL returned100/100/5 accessible jobs,
exactly205 ordered IDs without omission/duplication/foreign workspace/other-batch
rows. Existing frame/project/capability and synthetic delegated/expired-session
SQL checks passed. Nested37/outer33 rollback, original29 full Auth/Storage/data/
catalogue/profile/global-role preservation, both disposable DB absences and lock
cleanup passed. This is local SQL evidence, not media/provider/HTTP/MCP acceptance.
The earlier197c three-row PASS remains archived/exact; no old claim was replayed.

Two new attempts failed before database creation:787da730 found the owned local
container stopped;625d7c32 found the preceding preflight's unreleased lock. Their
failed receipts stay unchanged. The ordinary owned start preserved the pinned
container/volume/system ID. Root independently confirmed both pairs of test DBs
absent, original29 baseline/catalogue/global roles exact versus prior197c, no
other client and owner PID absent, then preserved/released only that stale lock.
Reconciliation: `2026-11-01T17-23-28-903Z-preflight-lock-reconciliation.json` in
the same evidence folder. The inherited preflight cleanup limitation is recorded;
successful-run cleanup passed separately. No cloud/provider mutation occurred.
The empty official38 authoring file was held outside migrations for ephemeral37
replay and restored0B afterward. It is not applied. Disabled38 release/web source
has passed14/13 overlapping inert checks and independent review; final evidence
binding/review/Root arming remains. Product branch758affc is still unmerged.

Next: fill/review additive production38 from the exact proved function suffix,
apply once with full preservation and independent readback before core merge,
then run postmerge quality, deploy compatible web/SDK and test signed-in filtering.
English/Reviewed/Ready facts and completed local37 native recovery/Claude
connection/reconnect/project/job/workspace-summary acceptance stay passed.
Feedback MCP/temporary guest check awaits replies; no new link created. Preserve
frontend/user files. Pilot stays running; screen reader pending, mobile skipped.
AT069 remains blocked by automatic approval review ('blocked by policy'); no
retry/manual equivalent/provider action. No language labels/selector requested.

## Historical checkpoint - 2026-11-01T17:20:41Z: closing the greater-than-100 batch pagination check

The197c SQL proof remains passed and archived with all376 executed inputs
recoverable (archive894e5dd8). It tested three page rows, not the required
more-than100-job case. A new isolated205-job fixture is being prepared with
interleaved other-batch and inaccessible-workspace rows; no old claim is replayed.
Production38 and compatible web operators are disabled source preparation.
The official38 file is still empty/unapplied. Pilot remains canonical37/webEUK29/
worker2uAS. Existing English, native37 recovery and owner Claude connection/
reconnect/project/get_job/workspace-summary acceptance remain passed. Feedback
MCP and temporary guest-summary checks await owner replies; no link was created.

Next: execute one fresh owned local SQL proof with205 jobs, then review and apply
additive38 before integrating/deploying the isolated API/SDK batch filter. Preserve
Claude frontend changes, Reviewed facts, Ready versions and protectedM02. Manual
screen reader remains pending; mobile skipped; pilot owner-stop-only. AT069 source
preparation remains blocked by automatic approval review with only 'blocked by
policy' given; no retry/manual equivalent/provider action.

## Historical checkpoint - 2026-11-01T11:11:45Z: batch SQL forward proof passed; cloud38 next

Fresh run `197c2009-15e7-49de-8945-f0dfb6f10551` PASSED from11:07:36.550UTC
to11:08:43.310UTC (66,760ms): `tracking/evidence/m07/job-batch-filter-proof/2026-11-01T11-07-36-550Z-197c2009.json`
(SHA256 `bce16d1767f5fae4a89c2f022a10644d9cb60b4375cd16d6164c732c3a700b81`). All376 executed bytes match. Actual34-37 DDL and current
batch candidate331e6d9a/fixture7c099e93 ran inside the nested37 transaction.
Batch filtering/pagination, current frame/requester/project authority and
synthetic broad-business/narrow-delegation/session-expiry SQL checks passed.
Exact full37 catalogue/all-table hashes/history/global roles/session identity
were restored after nested rollback; the unchanged old37 fixture ran, then
outer rollback returned33. Original29 data/full Auth-Storage/catalogue/profile/
settings, preexisting roles/memberships/OIDs, both owned DB absences and lock
cleanup passed. Actual injected and base wire hashes are distinct and recorded.

Cb11 remains FAILED/archived/cleaned at92ca856; its claim was never replayed.
The forward fix changes only the candidate admission aliases plus its builder/
collision regression and the proof's pins/test. The complete functional RPC
suffix and existinga223 port remain byte-exact. The actual archived collision
is RED; corrected AST/wire tests are GREEN (8 draft/11 proof, overlapping source
checks). Runtime, runner, fixture, READMEs and all365 prior sources stayed exact.

This is local PostgreSQL authority/rollback evidence, not native media, actual
HTTP/MCP, signed JWT/provider OAuth/session revocation, hosted or restore proof.
The separately passed full local37 native recovery remains5b6f66b. Completed
owner connection/reconnect/project/job/summary acceptance and English/Reviewed/
old-version evidence remain passed. New feedback tool/guest checks await replies;
no new guest link was created by Codex.

Root's pinned SupabaseCLI2.122.0 CREATED local empty coordinated filename
`supabase/migrations/20261101110939_m07_job_batch_filter.sql`. This is authoring
only: SQL is not filled/applied, canonical history stays37, core20-file source
branch4b1c94d plus alias fix remains unmerged, and webEUK29/worker2uAS stays
the last confirmed pilot deployment. English1.0 and pilot-until-owner-stop hold.

Next: prepare/review additive production38 guard and once-claim/full-preservation
release, apply/independently read back before compatible core/web integration,
then signed-in filter and relevant MCP/auth regressions. Source-only operator
preparation is underway; no provider mutation is credited. Preserve frontend
changes and existing owner upload dependency (expired inbox unreplayed/unread),
AT069 policy block (blocked by policy; no retry/provider action), pending manual
screen reader, skipped mobile, no language labels/selector and open M07 release.

## Historical checkpoint - 2026-11-01T10:54:38Z: batch SQL admission failed; cleanup/archive passed

Alias forward correction is now applied to Main drafts and independently
reviewed:8 draft plus11 proof inert checks passed (overlapping source checks),
with the complete functional RPC suffix unchanged. Root armed the new proof for
a FRESH UUID/claim. Cb11 remains failed/archived/cleaned; no native authority pass
is claimed until the new result. Source runtime/runner/fixture and all365 prior
inputs remain exact; no product merge/cloud38 occurred.

Actual run `cb11a73c-505b-47bb-ae97-ab32a9c1c771` FAILED after54,930ms at
`batch-filter-owned-nested-SQL-proof`: `tracking/evidence/m07/job-batch-filter-proof/2026-11-01T10-48-59-914Z-cb11a73c.json`
(SHA256 `2655108e1626f5a44c4f40c3b4bab2d2b532de12c6ad1cd07d8080c77e996c25`). PostgreSQL reported
`column reference "p.pronamespace" is ambiguous`: the new admission DO declares
a PLpgSQL record p and reuses p as a pg_proc SQL alias. Syntax parsing had not
resolved that ambiguity. No batch fixture/authority/delegation assertion acceptance
was established. Closed diagnostic: `tracking/evidence/m07/job-batch-filter-proof/2026-11-01-cb11-native-diagnostic.json`.

Cleanup PASSED: both disposable DB names absent (unused restore may never have
been created), new33 roles removed, original29 data/full Auth-Storage/catalogue/
profile/settings and preexisting global-role OIDs/attributes/memberships exact,
shared lock released; cloud/provider false. The permanent claim must not replay.
All376 exact failed inputs are recoverable from353 checked raw Git blobs at
5b6f66b plus23 ZIP entries (eleven new proof/draft files and twelve installed
public inputs). Archive: `development/m07/job-batch-filter-proof/source-history/cb11a73c/source-archive.json`
(SHA256 `a1990a7fd82bc144f4df399f20baec4c049ea9e676401e9813e5b13a23636f74`); ZIP SHA256
`c14f2c981344a03f72908c057536d81d2fba2c06aa15d80aea4cc2123e8f28aa`.
No private runtime payloads were copied. Receipt/source/claim remain failed/exact.

Next: forward-fix only the admission record/alias collision in builder/candidate
and add a RED/GREEN collision regression. Preserve currenta223 legacy port and
functional new RPC bytes, independently review, then use a fresh UUID/claim.
Source branch4b1c94d remains isolated;25+6 overlapping focused,7 inert and full
tests/types/affected lint passes do not establish native PostgreSQL acceptance.
No official38, main product merge or hosted filter deployment occurred.

Current37 full native recovery remains PASSED at5b6f66b (7c2a8d9a), with English/
Reviewed/old versions and completed Claude connection/reconnect/reads retained.
Pilot stays canonical37/webEUK29/worker2uAS, English1.0 until owner stop. Feedback
signed-in HTTP/public checks passed; new owner MCP and temporary guest read/revoke
await replies. Codex created no new link. Owner upload inbox remains expired/
unreplayed/unread. AT069 automatic approval source-edit block remains (blocked by
policy; no retry/provider action), screen reader pending, mobile skipped; no
labels/selector. M07/production acceptance is open.

## Historical checkpoint - 2026-11-01T10:30:02Z: full local history37 native recovery passed

Actual new run `7c2a8d9a-10ef-4a26-9c0b-31b8256bff71` PASSED from
10:25:49.755UTC to10:28:23.418UTC (153,663ms): `tracking/evidence/m07/recovery37/2026-11-01T10-25-49-755Z-7c2a8d9a.json`
(SHA256 `32a45739f183308d6d98d6a28fec9e65ba47679c15d4413737d70e75f85f3824`). All365 executed source seals still match. Actual30-37
DDL, real local FFmpeg/native prepare-render-validate-publish and guest-PDF
executors ran. Four referenced filesystem objects (video/manifest/canonicalPDF/
guestPDF),353 internal/lock/template/font source files and the full17,714-field
portable catalogue were restored exactly. Twelve named third-party installation
inputs remain sealed/rechecked but are explicitly excluded from restored sources;
installed dependencies/browser are prerequisites, not restored acceptance.

All populated table hashes, both Ready/interrupted-version English companions
and six pre-backup trace rows/events matched before recovery. English companion
mutation/deletion was refused; a later synthetic library edit preserved frozen
English. Restored Summary/feedback/Auth boundaries, controlled job expiry,
stale-callback denial, outbox fencing and one fresh restored attempt/trace passed.
The actual current native privilege hashes matched508; only the exact owned
trace-table NULL/owner ACL profile was corrected before the unchanged old profile
helper. Restored8-page PDF validated168 text regions,2 video links and3 fonts
(with0 image draws); restored H264 video re-probed at2s/160x90/noaudio.
Tampered and missing-object negatives passed. Both owned DBs and all four
run-owned roles were removed; original29 data/full Auth-Storage/profile/settings,
preexisting global-role OIDs/attributes/memberships and native fixture container
cleanup were exact, and the shared lock was released. Normal child return alone
was not used as acceptance; Root inspected the actual complete receipt and flags.

Before execution, source review caught and fixed a missing SQL keyword separator,
the frozen bundle helper's allowed-root mismatch, scoped vendor source paths,
and the full-mode two-English-row expectation. Actual frozen ownership/path
validators and emitted transaction/PLpgSQL parsing were added. Author, peer and
Root-after-arming each passed13 overlapping inert tests (not39 distinct tests).
The seven new executed files are held exact; old119/145/217/251 sources and
failed histories were preserved. Never replay this permanent execution claim.

Scope is synthetic same-cluster LOCAL metadata plus referenced filesystem/native
PDF/video recovery. Storage HTTP, real Auth/settings/secrets, installed vendor/
browser recovery, deployed/independent-host restore, physical crash, RTO/RPO and
representative media/cost are unverified. Earlier full36 metadata/local33 and
English/Reviewed/old-version/Claude connection acceptance remain passed.

Hosted state is unchanged from release checkpoint `cfd084e`: canonical37, web
`dpl_EUK29uLiGvrPguUv3T7d5KR19RwC`, worker2uAS/English1.0, pilot until owner
stop. Signed-in feedback summary and6 public checks passed; new owner MCP and
temporary guest link/read/revoke are pending owner replies. No link was created by Codex.

Batch-filter source checkpoint4b1c94d is now saved separately (20 product files
plus source-QA/private-scan receipts), with25+6 overlapping focused and7 inert
checks and full tests/types/affected lint passed. Its corrected current M03/M29
permissions cleared independent review. Root armed the NEW6-file SQL proof and
passed10 final inert checks; one fresh owned SQL run is next. Main product merge,
official38 and hosted filtering remain pending. The proof will check synthetic
delegated claims in SQL, with no JWT signature/provider acceptance.

Next independent slice is Request3 batch_id job filtering in the isolated
`Everyone-Presentation-Studio-Batch-Filter` worktree. Review rejected its initial
historical M02-body draft: M03 patches current list/get jobs for cast.read and
requester-owned frame visibility (current list prosrc SHAa2239225). The corrected
composed SQL plus narrow MCP preliminary-gate parity and frame negatives are in
review; no official38, native SQL, main integration or deployment is claimed.
Existing RLS independently protects frame rows; no cross-user exploit was proved.
One broad draft clearance was retracted. The owner upload journey remains pending
with the expired inbox unreplayed/unread. AT069 automatic approval source-edit
block remains (blocked by policy; no retry/provider action), screen reader pending,
mobile skipped. M07/production release remain in progress.

## Historical checkpoint - 2026-11-01T10:15:35Z: canonical37 and web feedback summary deployed

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

Recovery37 source review is clear (13 independent inert passes); Root armed the
new entry flag and is rerunning inert checks before one fresh owned full native
proof. Planned evidence includes four referenced filesystem objects, native
PDF/video, exact English/trace rows and full cleanup; no native37 pass yet.

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

## Historical release boundary - 2026-11-01, 04:29 UTC

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

## Historical release boundary - 2026-11-01, 03:59 UTC

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

## Completed results to carry forward

| Result | Evidence and limit |
| --- | --- |
| Owner Claude connection | [Initial/reconnect/project-read acceptance](../../tracking/evidence/m07/oauth-attempt-trace/2026-10-31-owner-connection-acceptance.json) passed, including request `23c439a1-4869-4228-a3f1-d4a6004ef4f0`. These completed gates need no reenrollment or reconfirmation; later auth-affecting changes still require relevant regression checks under owner-controlled sign-in/consent. Full delegated write/processing and token lifecycle are separate cases. |
| Workspace summary | Canonical35 and compatible web passed; [authenticated HTTP](../../tracking/evidence/m07/workspace-summary35-web/2026-11-01-authenticated-summary-read.json) and [owner-attested MCP](../../tracking/evidence/m07/workspace-summary35-web/2026-11-01-owner-mcp-summary-read.json) agree. The MCP result has no supplied request ID/server correlation; do not invent one. |
| Hosted English workflow | Actual real scan, English-only app display, new immutable saved version and PDF, old-cohort/Reviewed preservation, guest playback/PDF and link revocation passed. [Contract/evidence](../../docs/integrations/ENGLISH_TRANSCRIPT.md), [saved player/PDF](../../tracking/evidence/m03/english-version34/2026-10-31-hosted-saved-player-and-pdf.json), [old-cohort comparison](../../tracking/evidence/m03/english-preservation34/2026-10-31T18-19-53-933196Z-feac4485-c968-4ba5-a92d-c65f909d4f87-compare.json), [guest lifecycle](../../tracking/evidence/m03/english-guest34/2026-11-01-guest-english-workflow.json). Guest English used the normal owner Chrome profile and the privately extracted actual PDF annotation destination; no fresh-anonymous or native-PDF-click claim is added. The temporary link is revoked. |
| Reviewed facts/name investigation | Accepted Arabic name/age and reviewed facts stay intact. The captured original ASR omitted part of the corrected full name; translation fidelity and reviewed-fact preservation were separated. Do not inject corrected facts into a transcript, reopen the rejected historical component receipt, request more language labels, or add a language selector. Broader semantic accuracy is unclaimed. |
| Local recovery | [Owned metadata36 b7](../../tracking/evidence/m07/recovery36-trace-profile/2026-11-01T04-23-15-971Z-b7b41927.json) passed with17,684 exact catalogue fields, all populated table hashes, English/trace preservation, fences and full cleanup. [Prior33 native/media proof](../../tracking/evidence/m07/recovery33/2026-10-31T15-34-37-577Z-9af6774f.json) stays passed separately. Current37 native/filesystem extension is unimplemented; no Storage HTTP, provider Auth/configuration/secrets, deployed/independent restore or RTO/RPO credit. |
| Trace release proof | Actual [7cff lifecycle proof](../../tracking/evidence/m07/job-attempt-observability36-proof/2026-11-01T01-16-10-092Z-7cff5c7d.json) and [bc54 release-gate proof](../../tracking/evidence/m07/job-attempt-observability36-gate-proof/2026-11-01T02-13-22-368Z-bc54b423.json) passed with full rollback, owned-resource cleanup and original29/global-role preservation. Failed207/281 claims, receipts and exact archives remain retained. Local synthetic success does not complete hosted AT-074. |

## Completed paired live audit boundary

The frozen original IMG2850/Reviewed plan remains historical. The actual2852
sidecar explicitly bound the owner's substituted untargeted upload to the
original02:21 baseline, then recorded the actual real-success and67-byte failure
jobs at02:50. Both jobs and the after-preservation checks passed in their scoped
receipt. The subsequently deployed browser/API guidance and owner MCP match
complete the producer-message check. Do not repeat either job or reconstruct
missing provider execution data. No new Reviewed-target or semantic-accuracy
acceptance follows; broader delegated/token/recovery/workload cases below remain.

## Eligible work after the live audits

Keep the milestone's existing order; these are remaining evidence boundaries,
not authority to reset the database or change another agent's frontend files.

| Case | Current boundary | Next finite action / dependency |
| --- | --- | --- |
| AT-063 parity | Current feedback-summary source inventory is88 user operations/88 MCP tools/118 OpenAPI operations; last accepted serving inventory remains87/87/116. This is not all live behavior. | Complete feedback37 SQL/contract/release proof and reconcile the serving mapping after actual deployment. Preserve operator-only exclusions and Claude frontend coordination. |
| AT-064, AT-066, AT-068 full delegated/shared-data journey | Owner connection, hosted core and scoped English/Summary reads pass. A complete real producer Claude file/write/Reviewed/assignment/generation/sharing journey is still unverified. | Use the owner's already working client for documented upload-session/real-byte transfer, async processing, permitted corrections/Reviewed, assignment/Shortlist, saved outputs and review-link lifecycle. Record actual IDs and matching app readbacks. Exercise typed stale/idempotent conflicts and an appropriate retryable nonprotected job; retain existing local replay/retry proofs. Owner retains client configuration/sign-in/consent. Transfer3b4b5c8 plus inbox f3ed127 are committed;29 combined focused tests passed. The recorded03:51 inbox expired04:06; no owner result was received. Actual Write/private handoff/reserve-transfer-complete remains unverified, with no inference of absent MCP operations. Use a fresh preparation if needed. Never give Claude worker/service credentials. |
| AT-065 token/contributor limits | Controlled signed transport, fresh-capability and real-role local tests pass; live refresh/rotation/revocation and an actual contributor denial remain unverified. | Prepare a bounded plan using genuinely authorized test sessions/principals. Preserve the accepted owner grant and existing account permissions; no invented identities, broader grants or account reenrollment. Continue source-only regression preparation if test-session access is unavailable. |
| AT-067 shared compatibility | Guarded canonical35/36 apply/readbacks and local role/RLS/lifecycle proofs passed in their scopes. | Carry exact migration/source/preservation evidence into the complete shared-record app/MCP journey. Do not replay completed apply controllers, reset central records, or mistake query parsing for runtime SQL proof. |
| AT-069 queued replacement / rollback | Healthy04:17 pilot observation passed. Two partial new transport files have9 inert passes/17 no-undef lint errors; automatic approval review blocked final edits before execution, with no retry or provider action. | Preserve blocked files/absent third document and accepted source-only plan. Actual compatible app B, queued-work overlap, fenced replacement and rollback remain unverified; do not work around the policy block. |
| AT-070 current recovery | Owned b7 metadata36 passed04:25: exact17,684 catalogue/all populated-table hashes, English/trace/fencing checks and full cleanup. Native508 and prior33 native/media proofs retain separate acceptance. e3af/d563 stay failed, archived and cleaned. | After feedback37 local functional proof, separately review a future-current37 native/filesystem-byte extension. Storage HTTP, actual provider Auth/settings/secrets, deployed/independent restore and RTO/RPO remain unverified. |
| M07 step7 / AT-060 representative workload | The200-file run used tiny synthetic no-audio media; current production worker is serial. | Measure already permitted representative input with bounded admission, real Storage/n8n/OpenAI/native durations/usage, partial failures, backpressure/restart/resume and resource limits. A small audit pair is not a200-file/endurance or provider-cost result. Start with a bounded measured sample; further scale depends on observed quotas/cost/resources. |
| AT-071–073 accessibility / final UI | Historical keyboard/desktop automation and Claude's reported isolated redesign audit retain their scopes. **AT-072 manual screen reader remains pending; mobile is skipped by the owner.** | Run affected desktop keyboard/contrast/zoom/reduced-motion checks on the final integrated UI. Coordinate any already proposed pinned accessibility tooling with frontend/lock-file ownership. Automated axe or fixture results cannot close the manual screen-reader case. Do not restart waived mobile testing. |
| AT-075, security and final handover | Scope decisions and permission checks stand; no new language option or ingestion connector is required. Full production release remains unverified. | Run applicable final dependency/security/production-fixture-denial and source/schema/workflow compatibility checks, record actual versions/limits/locations and finish the coherent human journey. Retain all failed runs and distinguish current results from historical test counts. |

The bounded AT064 transfer and private-inbox adapters are committed as3b4b5c8
and f3ed127. `PRIVATE_UPLOAD_HANDOFF.md` documents the owner-controlled Write
handoff, consume-once claim, fresh TUS resume and client plaintext-history limit.
The29 combined synthetic tests do not demonstrate live Claude tool availability,
Write, private capability transport, real Storage bytes or MCP completion. The
dated owner inbox preparation remains separate; root and the owner perform the
real journey without reading capabilities into agent output or changing settings.

The frontend's already recorded dependencies2–6 remain separate, finite source
slices in [the contract proposal](frontend-contracts/PROPOSAL.md): feedback
summary, jobs batch filter/summary, optional filtered list totals, atomic move,
and pinned accessibility tooling. Request1 Summary is implemented and deployed. Request2 feedback summary is now
implemented source/local-only with shared signed-in/MCP and guest authority paths;
31 guest regressions,13 contract checks, full typecheck and5 inert SQL checks
passed, including11 focused new tests. Its CLI-created37 migration path is source
preparation, not SQL/cloud acceptance. Finish the owned37 proof before release.
Requests3-6 remain separate; do not bundle source changes into frozen trace36 or
silently merge the complete redesign.

## Reconciled current labels and remaining documentation follow-up

The five current ledgers/documents were reconciled at04:25 with owned metadata36
b7/cleanup, e3af/d563 failure archives,04:17 healthy6pcN/2uAS, pending owner result,
source-only feedback37 and policy-blocked69 boundaries. Other documentation
findings below remain follow-up only; preserve dated historical sections and
frozen source bytes rather than rewriting past outcomes.

- `PROGRESS.md`, `tracking/progress.json`, `tracking/HANDOFF.md`, this document
  and `REMAINING_AFTER_ENGLISH34.md`: current summaries now record canonical36,
  web6pcN/source283, completed scoped paired AT074/actionable guidance, accepted
  English/owner connection and owned metadata36 b7 passed; historical failures and
  their separate cleanup remain retained. Current37 native/media, Storage HTTP and
  deployed/provider recovery remain unverified. Historical
  next actions remain dated. No extra language labels or broad semantic-accuracy
  acceptance were introduced.
- `tracking/evidence/m07/ACCEPTANCE_MATRIX.md` and
  `docs/quality/RELEASE_EVIDENCE.md` have current-overview Ccw/CVDM/canonical33,
  English-off and older86/86/115 labels. Their latest live owner connection
  remains passed. Add a current override for36/web6pcN/source283/worker2uAS/English1.0,
  Summary87/87/116 and the remaining live cases; keep old receipts dated.
- README now has a current04:17 pilot/connection header; its dated evidence stays historical.
  `docs/operations/DEPLOYMENT_AND_RUNBOOK.md`,
  `development/m07/RECOVERY.md`, `API_CLIENT_RUNBOOK.md` and
  other dated supporting documents contain older serving, hosting-deferred,
  signed-out/provider-unconfigured or pre36 next-action wording. The pilot is
  running, owner connection is accepted, local33 recovery is accepted in its
  scope and trace36 is installed. Old29/33 operators and receipts are historical
  artifacts, not instructions to replay against current36.

No part of this reconciliation marks M07 verified. Keep screen-reader acceptance
pending until performed, mobile skipped, the controlled pilot running, completed
English/guest/version/Reviewed/connection/local33 results preserved and the
remaining live evidence explicitly open.
