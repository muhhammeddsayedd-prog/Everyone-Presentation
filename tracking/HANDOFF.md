# Current Codex handoff

Updated after actual cloud9 readback (2026-10-28T19:31:14Z), the one real
synthetic OpenAI evaluation (19:31:30Z), and subsequent API/advisor observations.
M00 is verified; M01/M02 remain in_progress; M03-M07 remain not_started.
This current section supersedes the dated historical checkpoints below.

## Latest local code and owner direction

The owner chose **continue local container testing; choose hosting later**.
No hosted worker has been selected or deployed. Code commit da77ab4 and
`tracking/evidence/m02/provider-validation/checkpoint.json` supersede the old
170-test pending-rerun statement below:188 module tests, build/typecheck,
production denial,15 offline configuration tests and325 strict pack checks pass.
The retained prefer-const lint failure is fixed; full lint and12 focused executor
tests reran successfully. Historical19 browser cases/c2df325 were not rerun here.

The verified-user submit facade returns202 only after a durable RPC acceptance;
missing/disabled backend stays503. Native execution snapshots scoped input,
rechecks source/hash/config/lease, bounds gateway waits, serializes heartbeats
and stops after unknown/late callbacks. Gateway/provider test doubles remain
separate from real services. No source form or authenticated gateway is wired.

`tracking/evidence/m02/specs-submit-candidate/2026-10-28T20-10-13-695Z-350ca6d9-rollback.json`
passes exact initial source/job/outbox/receipt atomicity with9 suppressed writes
and complete catalog/count rollback. The stage/application candidate now passes its separate local rollback-only
Auth-RLS simulation and initial three-stage assertions. Nine
applied migrations stay unchanged; no10/cloud promotion has occurred. Retain
original source/evidence and support ordinary source replacement later through
immutable internal inputs; do not turn the current partial503 into a product rule.

Next exact action: finish stage-kernel rollback proof, then persistent local
races/recovery and integrated source/executor/dispatcher/WF01 tests. Container
proofs only demonstrate one-shot native parsing and resource configuration;
consult their final receipt for target pinning, failures and cleanup scope.

The final local parser proof is
`tracking/evidence/m02/document-container/2026-10-28T20-25-30-385Z-181a29f5.json`
(seven cases), with three targeting-override rejection checks in
`2026-10-28T20-25-50-772Z-preflight-negatives.json` in the same directory.
Commit4440d31 pins the base image,16-file source tar, local Docker endpoint,
nonroot/read-only/none-network and measured resource configuration. All seven
owned containers were removed; images and the earlier harness failures remain.
The1ms case proves cleanup mechanics, not a sustained adversarial workload.
This is separate from the native executor/provider and persistent SQL proof.

The initial SQL stage/apply rehearsal now passes at20:46:58Z:
`tracking/evidence/m02/specs-stages-candidate/2026-10-28T20-46-58-625Z-a863a766-rollback.json`.
It reached final rollback; owned backend settled; full catalog/all counts,
including managed Auth fixture RLS/ACLs, restored. Keep every earlier failed
attempt as failed. Candidate/proof commit74ae183 binds final candidate35214cb1/assertions1ac2fff7/runner4fb9ca57
remain outside applied history/manifest. Nine versions still apply. No
persistent/concurrent/restart/native/provider/gateway/WF01 result follows from
this one-transaction proof. Next: coordinated persistent LOCAL composition,
cross-runtime hash/parity, races/recovery and retained replacement-source inputs,
then source form/service/output/dispatcher/WF01 integration. Hosting is deferred.

## Current database and actual local proof

Nine immutable migrations are applied locally/cloud. Latest9 is
`20261028184145_m02_role_order.sql`, SHA256
`14f96c7e635fe46cb11393a881bca26068d696c32f5e454df8655299702b1efa`.
Apply: `tracking/evidence/cloud-role-order/2026-10-28T19-23-27-369394Z-bc35d553-apply.json`.
Independent latest readback:
`tracking/evidence/cloud-role-order/2026-10-28T19-31-14-242836Z-dc97d5dc-readback.json`.
It verifies 32 public RPCs/60 routines/19 forced-RLS tables, preserved prior
catalog/base counts and workspace/spec/role/slot/preferences hashes. The cloud
still has one pristine Spec, zero roles/slots and empty queues. Role-only order
is applied; slot/assignment ordering is unsupported. Advisors report 33 WARN:
32 curated definers plus unresolved Auth leaked-password protection. Anonymous
new-RPC401/42501 proves lookup/denial, not authenticated reorder acceptance.

Nine-version local receipts all passed with strict cleanup:

- Full DB25 stages/three pairs: `development/local-db/receipts/2026-10-28T19-03-28-322Z-test-db-summary-499067f3.json`.
- Jobs29 stages/six pairs/restart/fencing: `tracking/evidence/m02/local/2026-10-28T19-05-03-586Z-35d591fb.json`.
- Manual24 stages/four pairs: `tracking/evidence/m02/specs-local/2026-10-28T19-06-45-233Z-5698a461.json`.
- Role order23 stages/four sampled blocker pairs: `tracking/evidence/m02/role-order-local/2026-10-28T19-02-20-589Z-b9d09e55.json`.
- Eleven replay cases: `tracking/evidence/m01/replay-scope/2026-10-28T19-09-29-124Z-fixed.json`.

Keep older8 backfill/driver failures and successful already-applied rerun distinct.
Never reset/relabel history. Local suites share an owned lock/runtime at
127.0.0.1:55433; coordinate any DB execution with its assigned owner.

## Actual provider evidence and limits

`tracking/evidence/m02/provider-access/2026-10-28T19-07-58-393Z-presence.json`
records all four private fields present without values/digests/provider calls.
`tracking/evidence/m02/provider-access/2026-10-28T19-08-27-697Z-read-only-access.json`
records both APIs HTTP200 and selected-model availability. These supersede the
older blank-field observation; never overwrite or expose private configuration.

`tracking/evidence/m02/provider-evaluation/2026-10-28T19-31-30-526Z-0cfe7e61.json`
records exactly one actual synthetic OpenAI extraction: requested/resolved model
`gpt-6.1-sol`,1413 input/1575 output/2988 total tokens, retries0, response storage
disabled. Three roles/five slots/source evidence/null assertions passed through
pure domain projection. No DB apply, cloud business write or n8n call occurred;
one sample is not representative quality/quota/capacity or pipeline acceptance.

`tracking/evidence/m02/provider-access/2026-10-28T19-32-50-135Z-n8n-discovery.json`
records one personal project with name unrecorded and unrelated inactive W05
Workspace Language Presentation. No Studio WF-01 was identified or run, no
workflow modified and no Drive connector/credential reused. MCP still-32603,
including a later SDK-reference attempt; API discovery is a separate working
fallback. Management API keys are not dispatch/callback credentials.

## Code validation and next exact action

Historical c2df325 passed 159 module tests/19 controlled browser cases/15 offline
configuration tests plus lint/typecheck/build/production fixture denial:
`tracking/evidence/m02/extended-validation/`. Keep this checkpoint historical.
Root's later provider-validation checkpoint actually passed 170 modules
(80 unit/server+5 contracts+12 jobs+15 integrations+22 worker+36 central), lint
and typecheck: `tracking/evidence/m02/provider-validation/`. It preceded the
latest submit facade changes; a broader post-facade rerun is pending. Do not
claim an unrun later checkpoint or a newer browser/build result. Browser
fixtures and actual SQL proofs remain separate from hosted acceptance.

The verified-user submit SDK/HTTP facade now exists with injected tests, while
its actual source persistence/configuration RPC is still a candidate/unapplied
path and unavailable backend returns503. No source form is connected. Next:
finish source/text persistence with real versions and an actual job/outbox in
one transaction, then authenticated service claim/events/typed atomic apply,
scoped outputs, actual dispatcher/worker host and Studio WF-01. Direct pasted
text has a null original asset and exact UTF8 hash; real files require real IDs.
Preserve original evidence/manual edits and deny publication after requester
write authority is revoked as the adopted conservative default. No fake Auth
user, service-role fallback, source asset or queued job is permitted.
Callbacks touching drafts lock workspace?spec?job?roles/slots?outbox; job-only
operations stay job?outbox. Recheck scope after waits; separate RPCs are not one
transaction. Parser heap/deadline/pipes are not an OS/RSS/CPU/egress sandbox.

The owner closed review tabs; hosted signed-in project/logo/Storage acceptance
remains unrun. Preserve existing enrollment, keys and four grants. Verify the
old30061 dev process ownership before a current-serving claim. Fonts/template,
representative media, Claude/OAuth, PDF/guest, restore and deployment remain
later gates. Do not regenerate context while current candidates are evolving.

## Historical checkpoint after manual8 and code c2df325

The following prior text is dated history; its8-only and blank-provider state
has been superseded by the current evidence above.


Updated after the 2026-10-28T18:21Z independent cloud readback. M00 is verified;
M01/M02 remain in progress. The production app is incomplete. This section
supersedes the historical checkpoint below; do not redo completed setup.

Eight immutable migrations are now applied locally and in canonical cloud
`pyibofyctwnqpvktepse`. Migration8 is
`20261028172320_m02_manual_specs_draft.sql`, SHA256
`8ab866a49cb2e01eabf3b83076fe4519a60255263d0a1a170ef3ba9718a2349c`.
All earlier migration bytes remain unchanged. Latest receipt:
`tracking/evidence/cloud-manual-specs/2026-10-28T18-21-07-451865Z-b7e8cd80-readback.json`.
It verifies 31 public RPCs/58 distinct routine contracts/19 forced-RLS app tables,
exact source/argument/result/ACL/column/policy/role/initializer boundaries, preserved
business/Storage counts and unchanged workspace-version/branding digest. One
pristine Spec was backfilled; roles/slots/queue remain empty. No source, identity,
grant, service login or provider was fabricated. Fresh advisors report 32 WARN:
31 curated definer RPCs plus unresolved Auth leaked-password configuration.

Manual specs/role/slot SDK, HTTP and editor are connected. Original multilingual
wording and unchanged arrays survive ordinary edits; unknown headcount remains
null with one provisional slot; reductions require explicit retired slot IDs.
Uncertain create retries retain the same key/body, stale edits require explicit
reload, and archive-in-flight fields are protected. Assignment retirement/Undo
still fails closed until its later adapter. No automatic extraction is faked.

Latest manual editor checkpoint:139 module tests, lint/typecheck/build, seven
controlled browser journeys,20 tool tests and18 offline release tests pass.
Logs/screenshots: `tracking/evidence/m02/manual-validation/`. Controlled browser
tests use synthetic API responses, no real Auth/Storage/provider, traces off and
320/768/1024/1440 layouts. Existing Node color warnings remain recorded. Actual
anonymous new-RPC request returns401/42501; schema lookup resolves without an
explicit notification. This is not authenticated hosted editor acceptance.

Fresh8 local proofs: M01
`development/local-db/receipts/2026-10-28T18-07-49-870Z-test-db-summary-68140882.json`
(24 stages/three backend pairs/both cleanups); queue
`tracking/evidence/m02/local/2026-10-28T18-08-57-532Z-7930ab51.json`
(28 stages/six pairs/graceful same-volume restart/fencing); manual
`tracking/evidence/m02/specs-local/2026-10-28T18-07-04-016Z-0fdcf864.json`
(23 stages/column denials/four sampled blockers); replay
`tracking/evidence/m01/replay-scope/2026-10-28T18-10-19-748Z-fixed.json`
(11 cases). Strict cleanup passed. The initial7-to8 application/backfill receipt
`tracking/evidence/m02/specs-local/2026-10-28T18-02-35-594Z-b35f9f60.json` stays
overall FAILED due to the later harness parser error. Only the driver changed;
the successful rerun truthfully says already-applied8/backfill=false. Never reset
history or relabel the failed suite. Guarded `test:db:specs` joins the existing
three shared-lock local suites; historical7-only helpers now fail closed by design.

Current implementation assignments: root commits the manual8/editor baseline;
foundation_ui owns subsequent role-only reorder domain/SDK/HTTP/SpecsView;
foundation_domain owns its SQL candidate outside root migrations/manifest;
discovery_review owns ProcessingView/StudioApp/scoped CSS and controlled tests.
Inspect their current files/status before editing or committing. Role ordering
is already contracted by PUT workspace order; exact active-ID permutation and
ordinary concurrency rules apply. No SQL9 application is implied here.

Next exact action: finish/review/rehearse role ordering and Processing UI, then
implement scoped source/text submission, stage leases/events, typed atomic draft
commit, output reservations, service identity and actual dispatcher/worker/WF-01.
Keep job-to-outbox lock order and post-wait authorization. Do not represent a
JobRepository transaction as separate RPCs. Late results must preserve edits.
Fresh18:16Z n8n discovery still returned MCP-32603; recent bounded env checks found
no OpenAI model/key or worker/service/n8n runtime configuration. Source processing,
real provider/worker, representative media, missing fonts/template, hosting,
intended Claude clients and restore remain gates. M03-M07 have not started.

The owner closed review tabs; none were reopened or sign-in emails sent. Full
hosted UI/Storage probe remains unrun. Keep real enrollment and four grants as-is;
do not recreate keys or restore removed grants. Process session30061 was the
central dev server at3000; verify its current ownership before a serving claim.
Private env/verifier/enrollment remain ignored. Preserve the bounded scanner's
historical receipt and exact inherited-design-contact exception; no new identity
copy/key is exempt. Preserve prior ZIPs before a new development source snapshot.

## Newer code checkpoint after manual8

`c2df325` adds Processing list/detail, exact role-only order controls/SDK/HTTP and
the separate document parser process. Actual checks pass 159 module tests,
19 controlled browser cases,15 injected private-config/inspection tests,
lint/typecheck/build and production fixture denial. Evidence is retained at
`tracking/evidence/m02/extended-validation/`. Source/provider fixtures and actual
SQL/local proof remain distinct from real hosted acceptance. Existing19 browser
responses are intercepted; no real Auth/Storage/provider is exercised.

The owner requested a file for private keys. Root created ignored
`.env.worker.local` with empty OPENAI_API_KEY/OPENAI_EXTRACTION_MODEL/N8N_API_KEY/
N8N_BASE_URL fields and confirmed Git exclusion. No real value was printed.
`tools/worker-private-env.mjs` reads only that fixed bounded file when invoked;
the provider inspector only lists model/workflow metadata and does not configure
or execute them. The latest actual presence check found all four fields blank.
Do not overwrite the file if the owner fills it or infer that this repairs MCP.

Role ordering already exists in OpenAPI. Candidate rollback passed at 18:38Z,
but persistent migration9 `20261028184145_m02_role_order.sql` is NOT yet claimed
applied. Domain agent owns current9 local race/regression/cleanup; discovery owns
new sealed9 release helper/readback; root owns all cloud execution. Old8 helper/
proof bytes remain immutable and should fail closed when history advances.
Never run DB clients while domain owns the shared restart/test window. UI agent
is inspecting the exact next source-submit/service-auth/stage contracts read-only.

The parser is bounded by two children,256MiB V8 old space,30s maximum deadline,
pipe/paragraph limits and a scrubbed environment. Node permissions/native addons
are not an OS sandbox or RSS/CPU/egress boundary. Actual cloud-backed worker,
source submit, lease callbacks/atomic result apply and service identity are still
pending. All current user grants remain the original four M01 capabilities.

## Historical checkpoint before manual8 release

The remainder records the earlier seven-version checkpoint and is historical.

## Authority and canonical state

The owner chose the initially empty `Everyone-Presentation` Supabase project (`pyibofyctwnqpvktepse`, eu-west-1) as canonical and authorized the complete milestone build. Requirements are confirmed. No re-interview or routine permission question is needed. Never reset/seed the linked cloud root, invent Auth users or rerun completed enrollment to restore revoked grants.

Seven immutable migrations are applied locally and in cloud. Preserve their bytes:

1. `20261028010943_m01_canonical_foundation.sql`
2. `20261028013324_m01_identity_role_inheritance.sql`
3. `20261028013655_m01_workspace_scope_alias.sql`
4. `20261028024205_m01_private_logo_boundary.sql`
5. `20261028072515_m01_logo_upload_capability.sql`
6. `20261028162702_m01_replay_scope_refresh.sql` ? SHA256 `82a4f2ec03efc0787aa58e5f1e68ab626e5dddb5e4c645444103456757bf4251`
7. `20261028162800_m02_jobs_outbox.sql` ? SHA256 `f619b3dfb9d964ab5902d04941b8cd59b44e9da36f1ab3f7b10bd45298ff4013`

The coordinated sixth/seventh release passed exact dry-run, apply and fresh readback. Latest receipt: `tracking/evidence/cloud-processing-foundation/2026-10-28T16-56-29-737639Z-6e03dbf9-readback.json`. It binds32 routines including22 authenticated public RPCs,16 forced-RLS app relations, function signatures/named arguments/returns/source, owners/ACLs, policy hashes and narrow role inheritance. The shared idempotency helper remains SECURITY INVOKER/VOLATILE. No service login, credential, provider, workflow or identity was created by this release.

Existing business/storage counts stayed unchanged: one Auth user, client, project, workspace, media/upload record and Storage object, four active capabilities and prior setup/runtime records. The three new queue tables are empty. These aggregate admin counts do not prove Ready state, exact image bytes, a full user-JWT journey or overwrite protection. An optional later scoped metadata CLI query timed out; no Ready result was recorded or invented.

Fresh security advisors report23 WARN findings:22 intentional authenticated-definer RPC findings and one unresolved `auth_leaked_password_protection` Auth configuration item. No Auth or billing setting changed. Supabase documents that feature as Pro-and-above; entitlement/password policy must be resolved before production. See `tracking/evidence/cloud-processing-foundation/RELEASE_REVIEW.md`. Earlier18-warning/zero-business observations remain historical.

## Account, workspace and runtime

Real Producer enrollment is completed. Four M01 capabilities (`projects.read/write`, `workspaces.read/write`) and write membership to owner-requested Dummy Test/Dummy Client were actually read back. The fixed test project is `4b70c8ce-18bd-4a8c-b5a9-bc1156c06463`; client is `f4a9937c-f575-4975-bdea-fb83b85e48c3`. Do not recreate them or automatically restore removed membership. Future feature capability rollout must respect current scope and the original Producer authorization; no settings/admin grant is implied by this checkpoint.

The owner reports successful sign-in and seeing Dummy Test, then closed all review tabs. Connected Chrome Person1 was still signed out on the agent's last refresh. The agent opened no review tabs or requested another email after the closure. Do not repeatedly ask the owner to sign in while independent work can continue. A verified connected session is still needed for the full M01 browser/Storage acceptance journey.

The owned central development process was started in unified session30061 at `http://127.0.0.1:3000/projects` through `tools/dev-central.mjs`. It loads the existing protected verifier, with `CENTRAL_LOGO_UPLOADS_ENABLED=true` and `EPS_CENTRAL_LOGO_PROBE_ENABLED=true` in that child only. `.env.local` was unchanged. Standard launcher defaults uploads/probe off. The verifier's protected `.local` phase/key files must not be printed, recreated or deleted; the older provisioning helper seals a historical migration set and is not a reason to regenerate the key.

The guarded `/dev/central-logo-probe` is implemented but NEVER executed against a signed-in hosted session. It accepts only the fixed project's authorized workspace UUID, uses normal cookie identity and scoped RPCs, and targets only newly reserved unselected probe assets. It reports sanitized IDs/status/hash/dimensions only. Unsafe token mint is tested before object existence; forbidden overwrite uses distinct bytes and before/after integrity reads. Do not export cookies/tokens/HAR/traces or substitute admin/GUC impersonation for real user HTTP acceptance.

`npm.cmd run dev` is the separately labelled synthetic adapter. Fixture browser tests own3100 and separate `.next-e2e`; central serving uses `.next`. Build while central is running with `EPS_TEST_SERVER=true`. Known extension hydration warnings and Node NO_COLOR/FORCE_COLOR warnings remain distinct from app errors. Never claim zero runtime warnings.

## Code and actual evidence

Local code commits this session: `0ec0433` (post-lock M01 scope recheck), `0ef61f9` (neutral specs/slot planning), `269a35e` (jobs/outbox, scoped HTTP, release guard). There is no remote/push/deployment.

- Root module suite:120 tests passed (50 unit/domain/server,3 contracts,12 jobs,14 integrations,10 actual synthetic document parsers,31 central SDK tests). Lint, typecheck and separate-output build passed. Four synthetic browser/HTTP journeys passed with traces off. Logs: `tracking/evidence/m02/validation/`.
- Operational Python suites:20 existing tool tests plus6 new processing-release recovery tests passed. Tests block real subprocess execution and cover lost responses, partial application, failed readback, count drift and refusal to blindly retry applied/partial history.
- Full local M01 regression:23 stages, three actual backend race pairs, both strict cleanups passed: `development/local-db/receipts/2026-10-28T16-44-39-449Z-test-db-summary-fcaee673.json`.
- M01 scope regression: baseline reproduced10 cached-response disclosures and one already-protected reserve path. Fixed11 cases passed current-scope denial after exact sampled advisory waits/distinct backends, legitimate closed-state replay controls and cleanup: `tracking/evidence/m01/replay-scope/2026-10-28T16-38-40-784Z-fixed.json`. Initial two harness failures and earlier baseline proof are retained. The fixture directly seeds synthetic replay caches; no cloud Auth/Storage transfer is proved.
- M02 durable foundation:27 stages, six backend pairs, both cancellation/dispatch orderings, graceful same-volume PostgreSQL restart, committed-lease persistence, controlled expiry/reclaim and old-token rejection, strict cleanup passed: `tracking/evidence/m02/local/2026-10-28T16-43-07-185Z-63e90f8d.json`.

Use `npm.cmd run test:db`, `npm.cmd run test:db:m02`, and `npm.cmd run test:db:replay-scope` for their distinct guarded local suites. They share an exclusive test lock, reject unexpected state, preserve unrelated rows and cannot target cloud. Owned Docker PostgreSQL17.6 is fingerprinted at127.0.0.1:55433; cloud is17.11. Local Auth/Storage catalogs are explicitly simulated, not hosted HTTP services. Never use root Supabase reset/seed/start.

## M02 implementation boundary and next action

`packages/central/src/jobs.ts` is now exported and wired to `/api/v1/jobs`, job detail/retry/cancel. API origin/session/input/concurrency/idempotency rules are shared; fixtures return honest503 for unavailable durable processing. Actual anonymous401/foreign-origin403/no-store checks passed. Authenticated HTTP and Processing UI are not demonstrated by those negative checks.

`packages/domain/src/specs.ts` and shared neutral types preserve original evidence and source language, unresolved markers, stable explicit slot IDs/order, provisional unknown counts and assignment before-images. Reductions require explicit affected slots. A configurable allocation budget fails before allocation without truncating facts. These are pure plans, not persistent transactions or provider results.

A reviewed manual specs persistence candidate is being rehearsed OUTSIDE root migrations: `development/m02/specs-draft-candidate.sql` and `tests/db/m02-specs-draft-candidate.sql`. It provides manual specs/role/slot CRUD, stable empty specs backfill+initializer and coupled row versions/draft/audit effects. It has no source submit/setter or fake job. Suppressed child writes must fail atomically; ArchiveRequest nullable reason parity is covered. Assignment retirement/Undo remains an explicit later integration gate. Check the latest candidate receipt before claiming any execution; do not promote automatically from static review.

Next: finish the guarded single-transaction candidate/fixture rollback with a predating workspace backfill case, verify exact catalog/row restoration, then connect real specs source submission, source/spec FKs, stage claim/heartbeat/event/fence validation, typed atomic result apply, output reservations and scoped service identity. A `JobRepository.transaction` must never be represented as separate RPC calls. Keep job?outbox lock ordering and fresh authorization after blocking waits.

Actual n8n project discovery still returns MCP-32603. Fresh process/project-env presence checks found no OpenAI model/key, n8n webhook/secret or worker/service runtime configuration. Do not fabricate provider calls/workflow exports or select another orchestrator. Worker document parsing is a tested library, not an isolated HTTP service. Real OpenAI/n8n/worker processing, representative authorized specs/video, native FFmpeg/PDF, six missing fonts/approved template, hosting, intended Claude clients, restore and production release remain unverified. M03?M07 have not started.

## Source hygiene

Private verifier/enrollment files, `.env.local`, Supabase `.temp`, private traces and generated output remain ignored. Preserve original supplied manifests and prior source archives under `dist/checkpoints/`. `python tools/package_pack.py --check` inspects eligible source; generated source ZIP is a snapshot, never a production deployment.

`tools/check_enrollment_source.py` scans known private key encodings and the setup identity without printing them. Preserve its historical fixed-path receipt when retaining a new checkpoint. One exact unchanged supplied `Design Elements/DESIGN.md` contains the original business contact and is narrowly exempt; no new identity copy or key is exempt. Do not claim that the contact is globally absent.

## Direct pasted-text preparation follow-up

The c2df325 worker checkpoint remains historical17/17. The follow-up adds `preparePastedText(text)` and explicit `{sourceKind: pasted_text, text, sourceAssetId: null}` input to the bounded process/storage port; direct text retains its original UTF8 hash and LF paragraph map. Real file calls still require a verified source asset ID. The document-preparation JSON schema permits a null original only for direct text; output reservation parent was already nullable. Five new synthetic/offline tests bring the worker suite to22/22, with no provider, service callback, actual document Storage or source-submit execution implied. Public submit remains503.

Next source/lease slice: persist original text and source version plus an actual job/outbox atomically under the real acting user; freeze the post-submit source/workspace versions in unchanged jobs input v1. `SpecSubmit.row_version` is the current Spec version and may be omitted only for a locked pristine initial record. Add authenticated service claim/event/typed-result operations using an execute-only service DB bridge, never a fake Auth user/service-role fallback. Use workspace?spec?job?roles/slots?outbox locks for callbacks that touch drafts; existing job-only operations stay job?outbox. Preserve manual edits with source/workspace version checks and waiting_for_input; deny publication after requester write authority is revoked as the adopted conservative default. The final apply_specs result schema remains deferred to that actual stage implementation; no broad unused schema was added here.
