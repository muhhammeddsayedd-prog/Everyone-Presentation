# Everyone Presentation Studio - owner OAuth/MCP connection accepted

## Backend continuation checkpoint - 2026-10-31T14:15:03.079210Z

Current work remains M07 backend/release plus eligible M03 validation. Frontend
redesign is isolated in frontend/redesign worktree based93981ca; preserve its files.
tracking/PARALLEL_WORK.md records ownership; no API schema or UI change is planned.
CentralStudio wrong-resource response bug fixed in SDK only:853 root application
tests, lint/types/production guard/build passed. Quality receipt is in
backend-continuation/2026-10-31-response-scope-quality.json. Deployment pending.
M03 evaluator19 synthetic tests passed; no real corpus scored. Private worksheet
.local/m03-semantic-validation/OWNER_LABELS.md is created; independent English/mixed
labels requested, do not fabricate them. Recovery33 compiler/full functional DDL
and cleanup guards are under independent review; no SQL/native restore run yet.
Actual local preflight verifies owned original29, no shared SQL lock/clones/new
issuer/coordinator roles. Operator metadata-only query is under review, unrun.
Preserve passed owner connection acceptance below and all once-only claims; do not
retry protected M02. Pilot stays running; mobile skipped; AT-072 pending.

## Accepted owner connection checkpoint - 2026-10-31T13:41Z

SCOPED OWNER CONNECTION ACCEPTANCE PASSED. Owner confirmed the initial project
read, then re-authenticated under the unchanged client/grant. Native13:36:07
detailsGET returned redirect-only200, claim/finish/final200 with expected f2ac
client and localhost3118, without approvalPOST. The post-reconnect get_project
13:40:13.706 receipt matches owner-visible request23c439a1-4869-4228-a3f1-d4a6004ef4f0,
principal0a79a703-caba-47e5-93d4-42e32197037a, clientf2acafd5-d4b6-4176-b86c-067c57e45ecc
and exact project6da14b82-8458-451f-aa21-28cb6c85bdc5. Owner reports Dummy Pilot Test /
Dummy Client from a single read-only get_project. Complete focused read window
has exactly1receipt with no rejected/warning/excluded events. Independent review
confirms scoped acceptance; final receipt is oauth-attempt-trace/2026-10-31-owner-connection-acceptance.json.

No further connection retry, sign-in, consent, client reconfiguration or deployment
is needed for this defect. Stable pilot remains DeCp/canonical33/workerCVDM;
original local29, protected M02 and credentials/permissions unchanged. Agent
never configured Claude or performed owner sign-in/consent/token exchange.
The earlier503/error and all interim pending receipts remain dated history.

NEXT: this requested OAuth fix is complete. For subsequent authorized development,
review remaining M07 matrix: full delegated write/processing/Reviewed/generation/
sharing/version-preservation journey, live refresh/revocation/contributor limits,
deployed restore/replacement and representative cost/endurance remain unverified.
AT-072/M03 remain pending; mobile skipped; fullM07/production release unverified.
Pilot continues until owner stop. Preserve all once-only claims and frozen
controllers; do not retry protected M02. User guide-table formatting and unrelated
Screenshots/redesign-output remain unstaged. Current turn is evidence/docs only;
no new application tests or production deployment is claimed. Previous845 app
tests/10 collector tests and SQL47/source3/races3 retain their recorded scopes.

## Historical reconnect checkpoint - 2026-10-31T13:37Z

Owner confirmed the initial client-visible Dummy Pilot Test name and exact6da14b82
project ID, closing initial authorization/read proof. Fresh reconnect13:36:07
trace836dc103 has verified browser, claim200, detailsGET200 redirect-only,
finish200/native confirmed redirect and final200, expected f2ac/localhost3118,
with no approvalPOST in complete5-event OAuth window. Owner reports successful
Claude connection. See2026-10-31-reconnect-redirect-only.json. The previous
redirect-only limitation is now verified corrected with an actual native response.

Post-reconnect MCP authentication also passed: two actual requests after the
redirect each have all7stages accepted, no denials. Complete19-event broad
window through13:39:59 supports this; reconnect-mcp-auth-stages.json retains
source/timestamps and explicitly does not claim a project read.

Final authenticated post-reconnect project read remains pending: complete
read window through13:37:10 has0receipts. Owner was asked to read Dummy Pilot Test
again and report returned name/ID. Do not mark connection accepted from a success
page alone. Inspect focused reads since13:36:00Z, pair a later expected client/owner
get_project receipt with owner reply, then close only scoped connection acceptance.
Refresh/revocation/full delegated journey, AT-072/M03 and production remain
unverified; mobile skipped, pilot running until owner stop. No new deployment or
cloud mutation is needed for this evidence-only follow-up. Source checkpoint
90c56ca includes the prior proof/helper; current new evidence/docs need closeout.

## Historical initial server read checkpoint - 2026-10-31T13:30Z

Owner approval13:23:49 passed native decision POST200 redirect, finish200 and
consent200. Subsequent duplicate approval13:23:52 failed claim400/22023
AUTHORIZATION_UNAVAILABLE, final503, without repeating native decision. The
initial flow succeeded: delegated MCP all7stages accepted; list_projects13:25:02
and direct get_project13:26:22 succeeded for Dummy Pilot Test6da14b82 under real
principal0a79/clientf2ac. See owner-approval-server-read.json and owner-get-project.json.
Client callback/token bodies were never inspected; usable signed delegated
MCP access proves issuance reached the server. Owner client-result reply and
reconnect remain pending. Re-authenticate was requested through owner /mcp,
without deleting config or revoking grant. Do not mark connection accepted yet.

Broad13:28 trace saturated100/hasMore:true: never infer absent events from it.
Focused13:29 OAuth16/read2 windows are complete and retained. Focused operator
is ready with10 tests and both actual modes passed. For the pending owner reconnect:
node development/m07/oauth-attempt-trace/read-focused-trace.mjs oauth dpl_DeCpJGbLLEHX3FFNBz5twLFuV8p7 2026-10-31T13:29:00Z
node development/m07/oauth-attempt-trace/read-focused-trace.mjs reads dpl_DeCpJGbLLEHX3FFNBz5twLFuV8p7 2026-10-31T13:29:00Z
Actual complete windows through13:30:32/33 contain no newer events. Owner
project-result reply and reconnect are still pending. No automatic retry initiated.
Source1fbae00 is committed; later live receipts/doc changes need closeout.

## Earlier fresh details checkpoint - 2026-10-31T13:24Z

Owner fresh attempt now passed full authorization_details GET200 at13:22:13.
Claim/finish200 with expected f2ac client/localhost3118. Ordinary pending page
reload13:23:14 returned cached consent_ready200; complete8-event window has one
upstream GET. Screenshot fresh-consent-ready.png and fresh-details-and-reload.json
are in oauth-attempt-trace evidence. Owner was asked to approve and have Claude
read Dummy Pilot Test; that reply, actual read and reconnect are still pending.
No agent sign-in, approval or token operation. Source correction checkpoint1fbae00
is committed; live follow-up evidence since then remains separate.

## Correction deployment - 2026-10-31T13:19Z

Stable pilot https://everyone-presentation-pilot.vercel.app resolves to Ready
dpl_DeCpJGbLLEHX3FFNBz5twLFuV8p7. Canonical history33 applied once; original
local29, workerCVDM, existing client/config, protected M02 and permissions preserved.
Pilot remains running until owner stop. Full M07/production acceptance pending.

Actual failed owner trace e5ee9308 at12:45:40 proves verified browser then503,
before native details. Native metadata confirms direct Claude Code client
f2acafd5-d4b6-4176-b86c-067c57e45ecc, exact http://localhost:3118/callback,
openid/pilot resource and registered callback match. It remained pending/unbound
with no durable claim. No claude.ai hosted callback mismatch is evidenced.

Root cause: coordinator NOLOGIN role lacks Auth schema USAGE; migration32's
postgres operator lacks its grant option. The wrapper auth.uid() prefix fails.
Historical logs did not retain the RPC error; actual identity-free read-only
role-prefix execution reproduced42501, permission denied for schema auth.
Migration33 adds a private existing-postgres-access context bridge, retaining the
unchanged active ordinary-browser guard. Claim/finish identity prefix and own
ledger context change only; all authority, permission and replay predicates stay.
Coordinator Auth USAGE remains false. See development/m07/oauth-attempt-trace/README.md.

Hosted full transaction ROLLBACK then once-only APPLY passed, with two independent
readbacks, all16 old security checks and protected M02 exact. Current845 module
tests/lint/types/prodguard/build,47 SQL assertions/3 source checks/3 actual races
and complete emitted SQL passed. No desktop run this turn. Deployed anonymous
401 checks passed;13:19:33 runtime collector confirmed five closed safe events,
including new MCP-stage traces. No owner fresh successful OAuth/MCP operation yet.

NEXT: one owner fresh connection was requested after trace ingestion verification.
Owner leaves consent open or reports auto-return; do not start/configure/consent
for them. Collect safe logs using:
node development/m07/oauth-consent-fix/read-pilot-trace.mjs collect dpl_DeCpJGbLLEHX3FFNBz5twLFuV8p7 2026-10-31T13:19:00Z
Inspect coordination code/status, provider variant, decisions and MCP stages.
Owner must read Dummy Pilot Test6da14b82-8458-451f-aa21-28cb6c85bdc5 and report
the actual result; pair it with authenticated server read receipt. Then owner
reconnects without grant revocation and repeats read. Both must pass for acceptance.
The localhost callback and Supabase token exchange are outside Vercel. Returned
redirect200 alone cannot prove delivery/exchange. Use safe owner-visible client
errors and bounded provider diagnostics if the failure is beyond the web route.

DO NOT rerun33 apply, rollback helper or old release claims, or clear any claims.
The controller activation changes only APPLY_ENABLED; completed draft is frozen
in source-history. Claims_count0 was the release snapshot, not a future health
invariant once the owner starts a flow. Protected M02 b3f stays untouched.
AT-072 and remaining M03 semantics pending; mobile skipped. Preserve unrelated
Screenshots/redesign-output and the user's unstaged guide-table formatting.
Prior source ZIP is historical; no archive refresh or Git push this turn.
Changed staged snapshot scan:47 paths/47 blobs/798377 bytes,14 fixed private-value
families, zero hits. Final receipt and this closeout metadata are outside that
snapshot. Latest complete owner-window collection13:19-13:21:20 saw zero events;
the fresh retry remains requested, with no owner reply yet.

# Historical checkpoint - consent correction deployed; owner verification pending

## Latest checkpoint - 2026-10-31T11:29:46.965Z

Current stable pilot: https://everyone-presentation-pilot.vercel.app
Web: dpl_CpsHsrG38KcRt2qQzci6CMhD7VSu (Ready, stable alias verified).
Canonical history32 applied once via release_v3.py; protected M02 b3f unchanged.
Worker CVDM and original local29 remain unchanged. Pilot stays running until owner stop.

Reported OAuth error traced to UUID-only selector rejection before any session or
provider call. App correction, both response variants, authoritative binding and
durable duplicate coordination are implemented/deployed. See the appended
2026-10-31 consent decision and development/m07/oauth-consent-fix/README.md.
Eight deployed anonymous checks and signed-in Projects3 passed; screenshot is
tracking/evidence/m07/oauth-consent-fix/2026-10-31-corrected-hosted-projects.png.
Current app validation: baseline830 module tests plus final358-unit run after
MCP observer changes, focused15 MCP checks,35 OAuth checks; lint/types/production
guard/build passed. Eight desktop fixture cases were updated, not run this session.
SQL proof:35 assertions,16 security checks,3 actual local connection races and
full emitted-SQL RED/GREEN; actual whole-wire hosted rollback then apply passed.

NEXT: owner starts a fresh connection in their own Claude setup and leaves the
consent page open (or reports automatic return). Inspect actual provider response
using read-pilot-trace.mjs collect dpl_CpsHsrG38KcRt2qQzci6CMhD7VSu with a fresh
UTC window. No selectors, codes, tokens or cookies belong in evidence. If full
consent appears, verify safe duplicate details before the owner approves. Then
owner asks Claude to read Dummy Pilot Test (6da14b82-8458-451f-aa21-28cb6c85bdc5),
confirm returned project UUID in the authenticated MCP receipt plus owner client
result, and repeat a fresh reconnect to observe redirect-only behavior. Keep
connection acceptance pending until the real operation succeeds. Do not configure
Claude or approve/sign in for the owner. No owner live OAuth/MCP success yet. The fresh-window trace through11:31
contained zero matching events. Full-index snapshot scan passed5333 paths/4679
blobs/916686866 bytes against14 fixed private-value families with zero hits;
this is not an identity/media scan or a new archive claim.

DO NOT replay old release.py/V2/diagnostics or clear claims. Actual prior errors
were HTTP400/42601 from ::jsonbthen before candidate execution; V3 fixes two spaces.
Old failed artifacts stay frozen; the actual V3 apply receipt is
tracking/evidence/m07/oauth-consent-fix/2026-10-31T11-24-21-659878Z-apply.json.
Default-ACL query timeout is historical/unverified; actual exact bridge ACL passed.

AT-072 and broader independent M03 checks remain pending. Mobile skipped; full
production/M07 acceptance unverified. Old source ZIP stays historical. Preserve
unrelated Screenshots/ and redesign-output/. Existing guide table formatting was
already modified and must remain unstaged separately from owned content changes.

## OAuth consent correction started - 2026-10-31T10:45:26.396Z

Owner reports initial connection failure. Exact screenshot text traces to the consent page UUID-only selector rejection before session or provider access. Work in progress: separate opaque Auth selectors from UUID identifiers, inspect actual provider response during owner-controlled fresh attempt, handle both details union members with authoritative client/user/scope/callback binding, coordinate duplicate consuming requests, test and deploy web correction. Initial/reconnect and owner authenticated Dummy Pilot Test MCP read remain pending. Existing M03/AT-072 checks stay pending, mobile skipped, pilot owner-stop-only. No Claude config/sign-in/consent performed by agent.

# Everyone Presentation Studio - hosted core and app-side OAuth configured; owner client pending

## Latest checkpoint - 2026-10-31T03:34:09.035Z

The controlled pilot is live at https://everyone-presentation-pilot.vercel.app.
Web deployment dpl_8HkE7S1VYvSkfff6nWW2sPBdnjvy is Ready and owns the stable alias.
Worker CVDM uses source09/b488, native77eee and daemon971834; one ready/alive
Dublin 2Gi instance was observed. The pilot stays running until owner stop.

Core9 passed with actual specs/video/OpenAI/n8n, frames, recovered saved-v6 PDF,
app downloads, guest version-scoped feedback and PDF-linked original video.
HOSTED_CORE.json SHA459 remains frozen against the original webGPR core proof;
the new web deployment has separate signed-in Projects/Settings/Processing
pagination/Ready-v6 checks. Do not relabel earlier core observations as new runs.

Auth provider3911, public client55c, binding f0a/2fe and web environment fd208
all passed their respective preserving readbacks. Client ID is
f2acafd5-d4b6-4176-b86c-067c57e45ecc, callback http://localhost:3118/callback.
All eleven public readiness checks passed in47cb2edb. No owner consent, token
exchange, refresh, Claude configuration/login or model call was performed.

Owner next action: use [the connection guide](../docs/HOSTED_MCP_CONNECTION.md),
including authServerMetadataUrl at the Studio mirror and scopes=openid, then
run Claude login/get. Current official Claude documentation says offline_access
can be appended from a broader issuer catalog; the documented mirror configuration
is the narrow compatibility recommendation, still unverified in the owner client.
Initial already-consented redirect-only responses remain deliberately rejected;
automatic reconnect for that case is unsupported. Keep this limitation explicit.

Read-only operator/probe compatibility fixes preserve every completed source and
claim: new guard140 accepts only equivalent single-row CLI transports; public
readiness now recognizes global issuer scopes, optional boolean public-JWK ext,
and discards one bounded __cf_bm response cookie only at two fixed provider URLs.
First-party cookies, unknown/private key fields, extra Studio scopes, redirects
and credential forwarding remain denied. Historical failures428/2f7 and old
source bytes remain retained; no app authentication or provider scope was broadened.

Canonical history31 is confirmed; original local29 is unchanged. Protected M02
b3f remains exact waiting_for_input/apply_specs/attempt3/revision7: never retry.
Do not replay completed project, origin, environment, pin, provider, client or
binding claims, or the original unknown canonical31 controller. AT-072 and broader
independent M03 semantics remain pending; mobile is skipped. Complete production
release and owner Claude journey remain unverified. Old source ZIP/checkpoint
is historical, not a current archive. Unrelated Screenshots/redesign-output stay
untouched and unstaged. Final changed-index scan passed: 595 paths, 581 unique blobs, 25,586,720 bytes,
17 fixed credential families and zero hits at the recorded index snapshot.
Staged whitespace passed after an exact-file exception preserves the frozen
canonical query SHA and its recorded trailing spaces; current source rules remain.
Static skill validation passed53/550 with zero errors/warnings. These closeout
metadata/documents join the local source checkpoint; Git HEAD identifies it.
The older source ZIP remains historical. No Git push was performed.


## OAuth binding and web-adapter checkpoint - 2026-10-31T03:14:35.770Z

Provider3911 passed with independent comparator preservation. Public client
f2acafd5-d4b6-4176-b86c-067c57e45ecc created by55c with matching reads and no secret.
Binding f0a apply and separate2fe readback passed; existing capabilities, protected
business data and hook ACLs preserved. Do not replay these writes.

Web7f preflight failed BEFORE claim/API write. The isolated Python guard receives
a successful CLI JSON row array; frozen703 expects a rows envelope at line222.
A read-only web-specific guard adapter is being prepared/reviewed; keep completed
703/provider/client/binding/plan bytes frozen. No web ENV variable was written.
New web source274 files was staged safely at905d285f; it remains undeployed.
Next: reviewed adapter preflight, one web ENV apply, deploy that sparse web source,
run hosted OAuth readiness and signed-in workspace checks. Owner handles Claude.
Known initial already-consented redirect-only reconnect refusal remains explicit
in docs/HOSTED_MCP_CONNECTION.md and the earlier consent setup record.


## OAuth provider checkpoint - 2026-10-31T03:02:24.472Z

The six-field Auth update is applied and confirmed: provider final31 receipt
3911c44e reports command_succeeded, matching independent readbacks and preserved
nonselected returned comparator. No signing-key or callback change was made.
The hook is selected, OAuth enabled, DCR off and hosted consent path configured.
Client final31 inspection is running; no registration/binding/web OAuth mode yet.
Only the NEW final31 family is sealed to actual core459 and plan dea972/guard703.
Preserve all old source/claims and current final consumed source/guide/test bytes.


## Latest continuation - 2026-10-31T02:52Z

Actual HOSTED_CORE.json has all9 passed, SHA4591f101, with15 public metadata
leaves. Current worker is dpl_CVDMpdETNwZYxdEyJ8XM66kSppdQ, native77eee,
daemon971834/source09/b488. One alive/ready Dublin2Gi instance observed in6f235e72;
strict per-record startup binding remains unverified, so no false startup claim.
Manifest96e/f05 and protected-frame0f1/71dd apply/readbacks passed. Protected M02
remains exact historical waiting_for_input; no retry or business mutation.

Existing failed v6 job7ca was retried ONCE through the app: validation and publish
succeeded, n8n31525, totalattempt7 (stage counter), same captured content/assets.
Canonical PDF downloaded via app to Downloads/everyone-selection-v6.pdf, SHA21f5,
109883B; six pages/two frame draws/one video link validated. Guest export341f PDF
also downloaded via app,109915B/F8B120. Page4 annotation matches hosted origin and
fixedv6. Anonymous grant POST200/range206/1024 valid MP4 bytes passed; bare request
401. Browser original video loaded853x480/19.776sec, playedpast10.6sec without error,
then paused. Version5 QA comment/Maybe stayon5 anddonotcopyto6; old5 readable.
The guest browser shares owner's Chrome cookies, explicitly separate from the
independent requests without Supabase Auth/Cookie; no fresh incognito claim.
PDFcover/Pendingpage visually inspected; candidate layout/media has native
validation, not a complete manual visual review. The local inspector's obsolete
post-receipt destroy() error is retained and qualified by successful fresh cleanup.

New final31 OAuth family ONLY is being sealed/reviewed against actual core.
Oldguard2bb/plan325 and completed claim sources remain frozen. Provider/client/
binding/webOAuth are not yet activated. Owner alone configures/logs intoClaude.
AT072 and broader M03 independent semantics pending; mobile skipped; production
acceptance and Claude journey unverified. Pilot runs untilownerstop.


## Active continuation - 2026-10-31T02:40Z

Worker manifest083 adoption passed apply96e and independent readbackf05. New
frame31 inspection stopped without a claim or write: its broad active count
includes only protected historical M02 b3f waiting_for_input/apply_specs/attempt3.
Separate metadata and exact projection readback confirm its original state.
Do not mutate or retry it. A distinct frame-protected31 source family is being
reviewed; original frame31/worker/common/plan/guard sources stay frozen.
New b488 daemon remains undeployed until frame adoption readback.

Existing QA C URL was rotated through the app with expiry/download permissions
unchanged. Old URL/sessions/PDF grants are invalidated by that product operation.
The current URL/session are private in protected ignored guest-http-proof, never
public receipts. Guest version5 comment and Maybe preference appear in owner UI;
independent four-request HTTP check without Supabase Auth or Cookie passed.
This is separate from an incognito browser claim. Latest-v6/PDF/video tests and
hosted-core9/OAuth remain pending. Keep all established acceptance deferrals.

## Earlier checkpoint - 2026-10-31T02:20Z

Canonical31 is **confirmed** by compact controller2e: applya99247a4 and separate
readback222f51dc both passed complete with normal-return marker, exact ACK/history
delta and full selected protected-state preservation. Original884/ea8a unknown
claim remains retained and must never be replayed. Original local29 is unchanged.

The hosted UI processed synthetic brief job `35dcef5a-4717-4cdf-8cef-85f6940d0aec`
successfully (n8n31523, actual OpenAI request metadata). One Pilot Presenter role
and two slots match the written fixture; missing requirements remain empty.
See [provider metadata](evidence/m07/controlled-pilot/2026-10-31-hosted-specs-provider-metadata.json)
and [app assertions](evidence/m07/controlled-pilot/2026-10-31-hosted-specs-app.json).
Hosted video/frame evidence remains valid for old workerHn4/source379, not the
new image. n8n connector metadata reads still fail -32603; direct fixed API
workflow read confirms active b659/no execution-data retention. Execution31515
GET returned404 and is not independently credited as provider status evidence.

The PDF failure cause was reproduced with public synthetic data: current5e
image/two identical frames fails Chromium at4MiB FSIZE, passes render+validation
at96MiB. Worker fix f648/3efb separates five browser families' internal96MiB file
limit from their unchanged protocol-output caps. Bounded max+1 output reads also
close inherited-FD growth before receipt. UID65432, capabilities, network, pids,
scratch and document/video/raster limits are unchanged.

New frozen context **b488b456-d84e-4515-99f9-476b3196cd64**, source
`09b6d4b881594dc7664953409f6e0bdeb925c19bf19fb3a4331787abf09c921f`:
156 source/160 files before manifest, scoped private-value scan0hits/10inputs/
14families. Native runtime **77eee0ee...**, index21664e..., Ready/private per
03b11db9. Baked manifest **083f81c7...**. Daemon runtime **971834e0...**, index
65cb6d..., Ready/private with actual uncached USER1000/network-denied import gate;
see [daemon proof](evidence/m07/controlled-pilot/2026-10-31-file-limits-daemon-image.json).
Not adopted or deployed. Old77/379 contexts, images and claims stay unchanged.

Expanded native smokea23 stopped at review_fit and cleaned every owned resource.
Its new input incorrectly reused a frozen rendering DTO without current-edit
pool IDs/revisions. Actual DTO regression reproduced that precise harness defect.
Only the synthetic fixture adapter was repaired (probe84630e42/test632563d6),
with pre-token DTO validation and closed error-code reporting. No worker/image
change. The corrected [full smoke8f08](evidence/m07/worker-hosting/2026-10-31T02-16-03.712Z-8f08a192-hosted-probe.json) PASSED all nine operations, five pages/40 fields/six frames/five logos/eleven image draws for both PDF variants, ten stable sessions and complete cleanup/lock release. Do not rerun. [Root808 checks](evidence/m07/controlled-pilot/2026-10-31-file-limits-offline-checks.json) passed all six suites (333/9/12/45/237/172), lint/types/production guard. Source stability during commands was not claimed; operator-only tests remain separate.

Next: Parity is sealing the NEW31 forward plan against those actual proofs; obtain its final pin-delta review. Root prepared both NEW empty forward directories with exact Owner/SYSTEM DACLs using Access-section-only writes; operators must only verify those ACLs. Then fresh all-jobs/outbox quiescence,
single plain manifest-hash update plus future-frame pin, independent readbacks,
new daemon deployment/runtime proof, and app retry of saved failed PDF7ca.
Finish guest/PDF/original-video checks, create real HOSTED_CORE9, then activate
hosted OAuth. OAuth draft plan pins actual31 but core/seals remain null/blank.
Owner configures/logs into Claude. AT-072/M03 pending, mobile skipped, pilot until
owner stops it. Never retry protected M02.

## Historical checkpoint - 2026-10-31T01:45Z

Current at 2026-10-31T01:45Z. The corrected packaged worker
`dpl_Hn4fhZBvPXY6o8L3SfsXxpsJw98Q` is deployed with one ready/alive dub1/2Gi
instance. Its native source3790/run77 smoke passed all nine operations and
confirmed cleanup. That synthetic PDF smoke used zero candidate frames and no
logo; it does not establish embedded-image validation. The two forward-only manifest/frame-pin transitions have
independent readbacks; initial28-variable transfer was not repeated.

The owner-authorized upload in **Dummy Pilot Test** completed all five stages:
job `fa8593ca-80c2-4cb3-8bcc-0e357ffbf7f2`, n8n31515. The [provider metadata](evidence/m07/controlled-pilot/2026-10-31-hosted-video-provider-metadata.json)
records actual OpenAI transcription, extraction and vision request IDs. The
[app receipt](evidence/m07/controlled-pilot/2026-10-31-hosted-video-app.json) proves
all12 prepared frames loaded and three were selected. No shared-profile Reviewed
confirmation or broader semantic accuracy acceptance was inferred.

Specs403 was reproduced once inside a forced rollback as42501/jobs: the private
ACK called a generic whole-job DTO despite its owner's narrow column privileges.
Migration31 `20261031010000_m07_specs_submit_ack_projection.sql` changes only the
private invoker ACK projection, with no new grants. It is **not applied to cloud**.
The first local31 run57f failed a readback parser after owned30 commit; run1d76
reached committed31 but its bad-link test fixture violated a retained-source FK.
Both failed receipts remain failed with exact original29 preservation and complete
owned database/role cleanup. Corrected [local31 dc886 proof](evidence/m07/specs-ack31/2026-10-31T01-22-16-662Z-dc886d4e-local-proof.json)
passed RED/GREEN, rollback injections, exact delta and full cleanup. Do not rerun it.

Canonical controller884's dry run247 passed, but [apply ea8a](evidence/m07/specs-ack31/2026-10-31T01-37-38-328593Z-ea8a5943-canonical31-apply.json)
and readbackf88 were unconfirmed. Its permanent claim remains; **never replay884**.
Two [read-only predecessor observations](evidence/m07/specs-ack31/2026-10-31T01-39-59-770242Z-canonical31-predecessor-reconciliation.json)
show exact selected canonical30/OLD ACK state, apart from qualified CLI expiry.
The tail-marker activity query is not a reliable process-absence fence because
Postgres truncates query text; see the qualification receipt. A separate
[read-only request of the same6999662-byte size](evidence/m07/specs-ack31/2026-10-31-readonly-exact-query-size-diagnostic.json)
was rejected HTTP413. This supports the transport-size diagnosis; it does not
recover the original discarded wire response. Parity is preparing a NEW compact
continuation with a distinct claim, complete state comparisons and robust prior
transaction admission. No continuation dispatch is authorized by these old receipts alone.

The hosted Client Selection version6 `0175b902-b26b-4fd3-ae90-0f8281f071df`
rendered six pages/30 fields/two frames/one video link/zero overflow, then failed
validation three times. [Failure metadata](evidence/m07/controlled-pilot/2026-10-31-hosted-selection-failure.json)
retains job `7ca22801-2040-40df-87fc-84a82fffb6c7`; old Ready versions remain.
Do not create further versions or blindly retry. The public synthetic local
Docker diagnostic3b78 failed earlier at render, with complete owned-container
cleanup; it has not reproduced the hosted validation failure. Recovery is adding
a zero-frame control and bounded browser-error flags to that diagnostic only.
Current worker images/source remain frozen.

Next: source-review the NEW compact canonical31 continuation and its activity
fence, then actual read-only admission/dry run before one dispatch/readback.
Process the already entered synthetic brief only after confirmed canonical31.
Resolve the PDF validation failure using the isolated public diagnostic, then
retry the same eligible job through the app. Existing M06 QA C grant is active;
old normal-browser token/session history matches revoked or expired access and
does not supply its current bearer. Preserve access boundaries while testing.
Only then create the actual nine-check HOSTED_CORE receipt and activate hosted
OAuth/MCP. OAuth31 helpers remain inert drafts; no client UUID or binding exists.
Owner configures/signs into Claude. AT-072 and broader M03 remain pending,
mobile skipped, pilot runs until owner stops it. Never retry protected M02.

## Historical runtime packaging checkpoint

The retained7113 resources were independently proven absent and its exact lock
released by [0eb26325](evidence/m07/worker-hosting/2026-10-31T00-19-24.031Z-0eb26325-7113-reconcile.json).
[Full native smoke eb608deb](evidence/m07/worker-hosting/2026-10-31T00-21-46.381Z-eb608deb-hosted-probe.json)
then passed all nine operations, isolation, ten stable resource identities and
cleanup. Prior failures remain failed; do not replay their reconciliation claims.

Worker [environment158e](evidence/m07/controlled-pilot/2026-10-31T00-28-12.936Z-158e4d1e-worker-env-apply.json)
was installed once:28 production variables,12 Sensitive, no management keys.
Future frame pin7846 was applied once by [b4a9ccd1](evidence/m07/controlled-pilot/2026-10-31T00-24-38-413488Z-b4a9ccd1-future-frame-pin-apply.json)
and independently read back by [cb967b64](evidence/m07/controlled-pilot/2026-10-31T00-27-11-940564Z-cb967b64-future-frame-pin-readback.json).
Do not rerun initial environment transfer or that frame apply.

Worker deployment [dpl_9HXjceZRJm93Cy2jPTRrLy8JkKVw](evidence/m07/controlled-pilot/2026-10-31T00-29-45.380Z-worker-deployment.json)
is READY with [one stable ready/alive dub1/2Gi instance](evidence/m07/controlled-pilot/2026-10-31T00-30-00.995Z-ad0b0a88-daemon-runtime.json)
using daemonf391. It is **not a working processor**: a credential-free local run
fails import with missing `ajv`; the [closed cloud-log diagnostic353](evidence/m07/controlled-pilot/2026-10-31T00-37-27.920Z-353a3e0e-daemon-log-shape.json)
also observes loader errors and no startup event. Dependency-stage workspace
`node_modules` and four required public JSON schemas were omitted. Recovery is
fixing both images/context/seal and adding a network-denied USER1000 import gate.
A fresh coherent context/image/smoke and separate forward-only manifest-env and
frame-pin transitions are required before redeploy. Preserve old claims/images;
do not transfer or rotate the28 worker variables again.

The first synthetic hosted specs submission failed with [HTTP403](evidence/m07/controlled-pilot/2026-10-31T00-35-33.565Z-specs-request-logs.json).
[Read-only diagnostics17066](evidence/m07/controlled-pilot/2026-10-31T00-24-52-938012Z-17066fb8-specs-access.json)
find a fresh specs row, valid capabilities/write membership and passing actual
submit-owner scopes, with zero jobs/accepted idempotency records. No permission
repair or repeat submission was performed. Parity is preparing a separately
reviewed rollback-only RPC reproduction to distinguish later SQL permissions
from the web guard. Do not grant capabilities blindly or add a manual role to
bypass the fresh-workspace path.

Hosted OAuth remains disabled until actual core verification. The owner retains
Claude configuration/login; AT-072/M03 stay pending, mobile skipped, hosting
authorized until owner stop. Canonical30/original local29 remain preserved.
Original local worker44164/17764 was stopped and rechecked absent; local web was
retained. Never retry protected M02. Source is uncommitted and outside the old
archive. The following checkpoint is historical.

## Earlier pilot checkpoint - before successful cleanup and deployment

Current checkpoint: 2026-10-31T00:13:20Z. Owner duration remains **keep running
until I stop it**. Studio production acceptance remains unverified; AT-072/M03
pending, mobile skipped, Claude configuration/login remains with the owner.

**Next action is read-only reconciliation of smoke7113cb6d, before another
probe.** [Actual smoke](evidence/m07/worker-hosting/2026-10-31T00-07-06.951Z-7113cb6d-hosted-probe.json) is unconfirmed at
`smoke_document`, code `NATIVE_CLEANUP_UNCONFIRMED`, cleanup false and lock
retained. Current graph boundary/network and plain-document phases passed;
overall native smoke did not. Three observed sessions stayed equal. Absence
flags remain unconfirmed; they do not prove that resources persist. Root's
read-only SDK-path list returned no rows, which alone is not exact resource/
session/snapshot absence proof. Recovery is preparing the bounded read-only
reconciler; no cleanup or subsequent probe is credited yet.

Current graph is **bc774c88 / context7b5324c8**,152 source records/156 prepared
files. [Native image Ready observation](evidence/m07/controlled-pilot/2026-10-31T00-06-50.212Z-0c045445-runtime-state.json)
records digest `7846b45931a0394eafafdca0d0ae2791b8de74ee9a736fd39534e34134d0d16c`.
Actual baked native-manifest SHA is
`ad51dc82c85fb7276b0514623560c5a303985746e52e4a5ad0eb572f16843abb`.
[Code-only daemon image](evidence/m07/controlled-pilot/2026-10-31T00-13-20.469Z-daemon-image.json) is Ready,
runtime digest `f3914fbdaa44fcb361fa2690f9b1cf2a08363652d1b4483a31aeca6ba85d79a3`,
index `5de7afde2daec604a1827e8c54da0c14d692de7b23e0ffb6fa02e9349c3310b3`.
Root emitted the same7b descriptor: one worker/dub1/2Gi/300-second grace.
This is image/descriptor preparation only: **no runtime credentials, daemon
deployment or polling**. Full native pass remains mandatory before private-env
transfer, frame-pin apply or privileged polling. Both images use the same graph.

[Root offline checks](evidence/m07/controlled-pilot/2026-10-31T00-06-44.357Z-current-offline-checks.json) pass800/800 modules
(333/9/12/45/229/172), lint, typecheck and production fixture denial, all exit0.
The receipt explicitly makes no source-stability-during-commands claim and is
separate from native/provider/hosted acceptance. Earlier793 and agent UID227
remain historical;229 worker tests are included in800, not additional. No fresh
comprehensive desktop, new build/global release or root798 claim is made.

Web `dpl_GPRog6HbnXNGpciqRi7TdypUCKM7` remains at
**https://everyone-presentation-pilot.vercel.app**. [Actual signed-in reads](evidence/m07/controlled-pilot/2026-10-30-hosted-core-reads.json)
pass Projects/Settings/Processing for the existing real principal, zero fixtures;
the other six core checks remain pending. [Project apply6b2](evidence/m07/controlled-pilot/2026-10-30T23-53-44-160454Z-6b2ce6c6-dummy-project-apply.json)
created Dummy Pilot Test `6da14b82-8458-451f-aa21-28cb6c85bdc5` under Dummy Client.
[UI receipt](evidence/m07/controlled-pilot/2026-10-30-hosted-dummy-pilot-ui.json)
records workspace `86936940-b48d-497d-b1ff-8e0da0913afa` and no processing job
submitted. Reuse these records; no duplicate project creation or login request.

Root reports the exact owned local worker remains stopped; [23:54:49 receipt](evidence/m07/controlled-pilot/2026-10-30-local-worker-stop.json)
observed launcher44164/child17764 absent, local web unchanged. [Frame inspecta0aef882](evidence/m07/controlled-pilot/2026-10-31T00-11-21-060658Z-a0aef882-future-frame-pin-inspect.json) at00:11:21 passed read-only canonical30,
zero active native jobs/leased dispatches and unchanged old pin. No DML occurred;
reinspect freshly before any later apply, after native/cleanup gates pass.
[Origin applybd7213ed](evidence/m07/controlled-pilot/2026-10-30T21-41-02-972243Z-bd7213ed-future-origin-apply.json)
is complete; do not replay it or rewrite old Ready versions.

Hosted MCP remains disabled. After cleanup reconciliation and complete native
smoke: guarded frame pin/private-env transfer, daemon deploy/runtime proof, then
the six new-workspace core checks and only then hosted OAuth/client/binding/
readiness. See [NEXT_STEPS](../development/m07/controlled-pilot/NEXT_STEPS.md).
Preserve old0dd/2e/49 receipts/contexts, canonical30/original local29, grants,
permanent claims and protected M02 `b3f90268-147d-41d4-8875-2a6435df1496`;
never retry that job. Operator source/Ready images do not prove full acceptance.

## Previous app-side checkpoint (historical)

The following dated checkpoint preserves earlier evidence. Its hosting deferral
and local-only next action are superseded by the controlled pilot above.

M07 remains **in progress; production release unverified**. AT-072 manual screen-reader and broader independently labelled M03 English/mixed semantic checks remain pending, mobile testing stays skipped and hosting/public exposure/deployment stays deferred. The owner will configure and log in Claude Code. Do not create `.mcp.json`, start its login/model calls, copy client credentials, enroll Producer again, seed/reset cloud, repeat completed settings/grants or retry protected M02 job `b3f90268-147d-41d4-8875-2a6435df1496`.

Implementation/evidence commit: **ff6851185102f576c0b8c0b9780e07fca8ad87f7**. Later metadata annotations do not change tested code/SQL/helpers. Static pack validation passed359 checks/1400 local links; the staged76-file private-family check passed with zero hits (10 fixed private inputs/14 families, not a full-source/PII/archive scan).

The prior live Settings handoff is preserved byte-for-byte [here](handoffs/2026-10-30-before-m07-app-oauth.md.txt). It links earlier29/restore/source archive and M06 PDF evidence; dated runtime/provider observations there are superseded below.

## What actually passed

- Canonical **30** was applied once by the reviewed controller and independently read back. Original local remains **29**; only a disposable owned clone committed30 and was forward-fixed/removed. [Release summary](evidence/m07/issuer-release30-executable/2026-10-30-current-release-summary.json) links actual inspect/dry-run/apply/readback. Migration `20261030154824_m07_native_oauth_issuer.sql` SHA `e5fd2121784c8372743f330664508b2a38a25cd622b24cf6765c570ae6f2a785` is frozen. Canonical16613 raw fields changed by42 created/8 changed/0 deleted; old data/Ready/Settings/runtime12/roles and protected M02 preserved, with qualified CLI-managed short-login expiry only.
- The narrow `eps.mcp_custom_access_token_hook` is owned by NOLOGIN/NOINHERIT/NOBYPASSRLS `eps_mcp_issuer_owner`. Only native `supabase_auth_admin` executes it; anon/authenticated/service role cannot. Six read columns on registry/capabilities and no Auth table/column grants. Actual [post30 inspection](evidence/m07/app-oauth/2026-10-30T16-14-01-872234Z-inspect-binding.json) passed8 security checks, found registry empty and Cairo/template1.1.0/Settings revision3.
- [Owned local proof](evidence/m07/issuer-release30-executable/2026-10-30T15-54-37-082Z-36b1483b-local-proof.json): two exact injected failure rollbacks;9 real-role/RLS stages precommit and9 postcommit; committed30 forward-fix;16430 original raw fields/global role identities unchanged; owned clone removed before newly created role, both absent, lock released. Template clone initially refused because existing workers connected; neither worker stopped/reconfigured. Failed attempt and exact8-pair dump-profile planner preserved. This is not real issuance/deployed restore/RTO.
- Retry HTTP/MCP now returns contracted202 JobAccepted instead of a full job rejected by strict MCP validation. UI validates exact ACK/poll URL and retains original intent on unknown/malformed responses; valid ACK then read failure never resubmits. Focused30 module and1 exact desktop checks passed. No real retry/cancel occurred. [Current quality](evidence/m07/quality/2026-10-30T15-37-43-310Z-f3157ddc.json):755 tests, lint/typecheck/production-fixture denial/build pass;657 source inputs exact. Prior80desktop remain historical, not a fresh81-case suite. No mobile selected.

## Provider activation is pending explicit confirmation

The authenticated dashboard has a prepared **unsaved** OAuth Server draft: enabled, `/oauth/consent`, dynamic registration off. The requested action-time confirmation covers saving that draft, one public client `EveryoneStudioLocalM07` with exact `http://localhost:3118/callback`, and selecting private native Postgres hook `pg-functions://postgres/eps/mcp_custom_access_token_hook`. No user reply/approval was received at this checkpoint. Browser-control rules require confirmation when creating delegated security-sensitive access. Screenshot [prepared draft](evidence/m07/app-oauth/2026-10-30-prepared-oauth-server.png) records the exact pending action.

Persisted baseline still OAuth off/no apps/no hooks; existing SiteURL127.0.0.1:3000, browser redirect and signing keys remain unchanged. No actual public client UUID, registry insertion, hook selection or OAuth env config exists yet. MCP remains guarded local mode. Public metadata readiness is not passed; [initial baseline](evidence/m07/app-oauth/2026-10-30T15-35-16-732Z-450717a4-baseline.json) observed404 metadata/401 unauthenticated MCP and is not a configured proof. Signed issuance, gateway `/user`/RPC, refresh/revocation and owner client connection remain unverified.

## Runtime and next exact action

[Post30 owned runtime](evidence/m07/app-oauth/2026-10-30-runtime-after30.json) dates worker44164->17764 and web44336->58208->59556, listener127.0.0.1:3000; two conhost auxiliaries separately counted. Verify freshly before process mutation. Private ownership/logs are `.local/m07-oauth-runtime30/`. Worker config/features unchanged. Web stderr162B at observation is not a pristine-console claim.

1. Receive explicit confirmation for the prepared provider action. Reuse selected Chrome browser1 and existing dashboard tab1091386724 after fresh UI state; don't invent provider IDs or enable public hosting.
2. Save desired OAuth server config; create exactly one actual public client named above, no secret, code/PKCE S256/openid/callback3118. Reconcile unknown outcomes read-only, never duplicate create. Preserve SiteURL/browser callback/signing keys and DCR off.
3. With actual provider UUID, run the reviewed single-dispatch `development/m07/app-oauth/bind-client.py apply UUID` once and then independent `inspect`. Select native Postgres custom access token hook. Independently inspect all8 effective ACL checks after selection; asynchronous dashboard ACL work is not proof. Generic Studio hook delete/replace may regrant PUBLIC/anon/authenticated EXECUTE and is not an automatic rollback.
4. Consume successful actual binding inspection with `configure-local.mjs UUID receipt`; appends only4 public MCP settings to ignored `.env.local` under verified current-user+SYSTEM ACL. Synthetic Windows ACL smoke passed. Restart only freshly verified owned web3, retaining worker. Run `verify-readiness.mjs ready` (no cookies/real tokens/login/consent approval) and verify existing signed-in Studio page.
5. Fill [connection instructions](../development/m07/APP_OAUTH_CONNECTION.md) with actual UUID/proof. User merges project `.mcp.json` themselves with HTTP URL, clientId, callbackPort3118, scopes `openid`; user runs `claude.cmd mcp login everyone-studio`. No client login by agent. Strict redirect-only already-consented path stays fail-closed; `getAuthorizationDetails` can consume/autoapprove and is not passive discovery.

**Never repeat** completed migration30 apply or frozen empty-registry pre/post30 readback after legitimate configuration; use dedicated binding/readiness inspections. Preserve permanent dispatch claims and frozen22-source index. Original local29 has not been promoted. Current restore29 is historical and does not establish new issuer/provider30 restore.

The old exact e4ffcca ZIP/scan in ignored `dist/SOURCE_CHECKPOINT.json` is unchanged; current follow-up is unarchived. Unrelated Screenshots102/redesign-output58 and Git exclusions are preserved. All existing acceptance deferrals remain.
