# M07 remaining acceptance after trace36 installation

Reconciled from the milestone packet, AT-063–075 definitions, current main
receipts and existing release matrices on 2026-11-01. This is a source-only
acceptance reconciliation, not a new feature decision or a production pass.
No operational command, provider request, upload or database change was made
for this document. The root agent owns the main progress/handoff updates.

## Current release boundary - 2026-11-01, 03:19 UTC

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

## Completed results to carry forward

| Result | Evidence and limit |
| --- | --- |
| Owner Claude connection | [Initial/reconnect/project-read acceptance](../../tracking/evidence/m07/oauth-attempt-trace/2026-10-31-owner-connection-acceptance.json) passed, including request `23c439a1-4869-4228-a3f1-d4a6004ef4f0`. These completed gates need no reenrollment or reconfirmation; later auth-affecting changes still require relevant regression checks under owner-controlled sign-in/consent. Full delegated write/processing and token lifecycle are separate cases. |
| Workspace summary | Canonical35 and compatible web passed; [authenticated HTTP](../../tracking/evidence/m07/workspace-summary35-web/2026-11-01-authenticated-summary-read.json) and [owner-attested MCP](../../tracking/evidence/m07/workspace-summary35-web/2026-11-01-owner-mcp-summary-read.json) agree. The MCP result has no supplied request ID/server correlation; do not invent one. |
| Hosted English workflow | Actual real scan, English-only app display, new immutable saved version and PDF, old-cohort/Reviewed preservation, guest playback/PDF and link revocation passed. [Contract/evidence](../../docs/integrations/ENGLISH_TRANSCRIPT.md), [saved player/PDF](../../tracking/evidence/m03/english-version34/2026-10-31-hosted-saved-player-and-pdf.json), [old-cohort comparison](../../tracking/evidence/m03/english-preservation34/2026-10-31T18-19-53-933196Z-feac4485-c968-4ba5-a92d-c65f909d4f87-compare.json), [guest lifecycle](../../tracking/evidence/m03/english-guest34/2026-11-01-guest-english-workflow.json). Guest English used the normal owner Chrome profile and the privately extracted actual PDF annotation destination; no fresh-anonymous or native-PDF-click claim is added. The temporary link is revoked. |
| Reviewed facts/name investigation | Accepted Arabic name/age and reviewed facts stay intact. The captured original ASR omitted part of the corrected full name; translation fidelity and reviewed-fact preservation were separated. Do not inject corrected facts into a transcript, reopen the rejected historical component receipt, request more language labels, or add a language selector. Broader semantic accuracy is unclaimed. |
| Local recovery | [History33 metadata plus media rehearsal](../../tracking/evidence/m07/recovery33/2026-10-31T15-34-37-577Z-9af6774f.json) passed with its synthetic same-cluster/filesystem-object scope. It is not current36, Storage HTTP, deployed/independent-cluster or real Auth/configuration/secret restoration proof, nor RTO/RPO. |
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
| AT-063 parity | Source contract now reconciles **87 user operations / 87 MCP tools / 116 OpenAPI operations**, including Summary. This is not all live behavior. | Reconcile the final serving UI/domain/HTTP/MCP mapping and private service exclusions after any coordinated source change. Operator-only trace capture is not an ordinary user tool. Preserve shared-file/API coordination with Claude's redesign. |
| AT-064, AT-066, AT-068 full delegated/shared-data journey | Owner connection, hosted core and scoped English/Summary reads pass. A complete real producer Claude file/write/Reviewed/assignment/generation/sharing journey is still unverified. | Use the owner's already working client for documented upload-session/real-byte transfer, async processing, permitted corrections/Reviewed, assignment/Shortlist, saved outputs and review-link lifecycle. Record actual IDs and matching app readbacks. Exercise typed stale/idempotent conflicts and an appropriate retryable nonprotected job; retain existing local replay/retry proofs. Owner retains client configuration/sign-in/consent. The client-local bridge is implemented/source-tested (16 focused tests,3b4b5c8); actual private handoff and reserve-transfer-complete remain unverified. Never give Claude worker/service credentials. |
| AT-065 token/contributor limits | Controlled signed transport, fresh-capability and real-role local tests pass; live refresh/rotation/revocation and an actual contributor denial remain unverified. | Prepare a bounded plan using genuinely authorized test sessions/principals. Preserve the accepted owner grant and existing account permissions; no invented identities, broader grants or account reenrollment. Continue source-only regression preparation if test-session access is unavailable. |
| AT-067 shared compatibility | Guarded canonical35/36 apply/readbacks and local role/RLS/lifecycle proofs passed in their scopes. | Carry exact migration/source/preservation evidence into the complete shared-record app/MCP journey. Do not replay completed apply controllers, reset central records, or mistake query parsing for runtime SQL proof. |
| AT-069 queued replacement / rollback | Compatibility rollout and healthy daemon observation pass; no replacement during queued/running work or compatible deployed rollback is proved. | Prepare one bounded owned job, before/after consumer/lease fencing and graceful drain observations, compatible old/new application source and recovery path. Execute only with current deployment ownership and preserve completed jobs, data and Ready versions. |
| AT-070 current recovery | Local33 rehearsal remains passed. Current36 attempt084 remains failed on native OID type/closed-membership order; its separate03:19 cleanup passed with3 owned roles removed, original29/58 roles94 memberships preserved, both DBs absent and exact lock released. Exact129-source archive retained. | Forward-fix only OID/order handling with native JSON regressions and use a fresh frozen recovery claim; cleanup is not restore acceptance. Storage HTTP, real configuration/Auth/secret and deployed/independent recovery remain separate; no RTO/RPO inference. |
| M07 step7 / AT-060 representative workload | The200-file run used tiny synthetic no-audio media; current production worker is serial. | Measure already permitted representative input with bounded admission, real Storage/n8n/OpenAI/native durations/usage, partial failures, backpressure/restart/resume and resource limits. A small audit pair is not a200-file/endurance or provider-cost result. Start with a bounded measured sample; further scale depends on observed quotas/cost/resources. |
| AT-071–073 accessibility / final UI | Historical keyboard/desktop automation and Claude's reported isolated redesign audit retain their scopes. **AT-072 manual screen reader remains pending; mobile is skipped by the owner.** | Run affected desktop keyboard/contrast/zoom/reduced-motion checks on the final integrated UI. Coordinate any already proposed pinned accessibility tooling with frontend/lock-file ownership. Automated axe or fixture results cannot close the manual screen-reader case. Do not restart waived mobile testing. |
| AT-075, security and final handover | Scope decisions and permission checks stand; no new language option or ingestion connector is required. Full production release remains unverified. | Run applicable final dependency/security/production-fixture-denial and source/schema/workflow compatibility checks, record actual versions/limits/locations and finish the coherent human journey. Retain all failed runs and distinguish current results from historical test counts. |

The bounded AT064 client-local adapter is implemented in
`tools/client-upload-transfer.mts`, documented in `DELEGATED_UPLOAD.md`, and
committed as3b4b5c8 with16 focused inert tests/lint/typecheck passed. It supplies
signed PUT/shared TUS, file/hash identity and safe private checkpoint handling.
The remaining client dependency is its actual private capability handoff and
reserve/real-byte-transfer/complete use through the owner's permitted client,
followed by matching app readback; source tests cannot substitute. No credential
store reads, signed shell arguments or owner configuration changes are authorized
by this documentation. Continue that finite handoff while preserving the accepted
connection; guarded084 cleanup has passed and a fresh metadata rehearsal remains.

The frontend's already recorded dependencies2–6 remain separate, finite source
slices in [the contract proposal](frontend-contracts/PROPOSAL.md): feedback
summary, jobs batch filter/summary, optional filtered list totals, atomic move,
and pinned accessibility tooling. Request1 Summary is now implemented and
deployed. After existing release/client gaps, the next already proposed backend
UI contract slice is the body-free feedback summary with both signed-in/MCP and
guest authority paths. It must receive its own contract,
permission, SQL and release checks; do not bundle it into frozen trace36 or
silently merge the complete redesign.

## Reconciled current labels and remaining documentation follow-up

The five current ledgers/documents were reconciled at03:16 with the actual
web6pcN/scoped AT074 pass and failed084/separately passed cleanup boundary. Other documentation
findings below remain follow-up only; preserve dated historical sections and
frozen source bytes rather than rewriting past outcomes.

- `PROGRESS.md`, `tracking/progress.json`, `tracking/HANDOFF.md`, this document
  and `REMAINING_AFTER_ENGLISH34.md`: current summaries now record canonical36,
  web6pcN/source283, completed scoped paired AT074/actionable guidance, accepted
  English/owner connection and failed084 with separate03:19 cleanup passed; current36 restoration remains unverified. Historical
  next actions remain dated. No extra language labels or broad semantic-accuracy
  acceptance were introduced.
- `tracking/evidence/m07/ACCEPTANCE_MATRIX.md` and
  `docs/quality/RELEASE_EVIDENCE.md` have current-overview Ccw/CVDM/canonical33,
  English-off and older86/86/115 labels. Their latest live owner connection
  remains passed. Add a current override for36/web6pcN/source283/worker2uAS/English1.0,
  Summary87/87/116 and the remaining live cases; keep old receipts dated.
- `README.md`, `docs/operations/DEPLOYMENT_AND_RUNBOOK.md`,
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
