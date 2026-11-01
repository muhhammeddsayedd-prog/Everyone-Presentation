# M07 remaining acceptance after trace36 installation

Reconciled from the milestone packet, AT-063–075 definitions, current main
receipts and existing release matrices on 2026-11-01. This is a source-only
acceptance reconciliation, not a new feature decision or a production pass.
No operational command, provider request, upload or database change was made
for this document. The root agent owns the main progress/handoff updates.

## Current checkpoint - 2026-11-01, 09:50 UTC: SQL37 owned proof passed; bounded Auth metadata observed; cloud37 pending

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
