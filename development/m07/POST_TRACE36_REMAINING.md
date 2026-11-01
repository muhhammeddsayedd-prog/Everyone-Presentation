# M07 remaining acceptance after trace36 installation

Reconciled from the milestone packet, AT-063–075 definitions, current main
receipts and existing release matrices on 2026-11-01. This is a source-only
acceptance reconciliation, not a new feature decision or a production pass.
No operational command, provider request, upload or database change was made
for this document. The root agent owns the main progress/handoff updates.

## Current release boundary

Canonical history **36** is installed on the existing Everyone-Presentation
project. The [02:19:19 apply](../../tracking/evidence/m07/job-attempt-observability36-release/2026-11-01T02-19-19-577795Z-apply.json)
reports normal return and two matching immediate readbacks. The separate
[02:20:17 readback](../../tracking/evidence/m07/job-attempt-observability36-release/2026-11-01T02-20-17-194633Z-readback.json)
reports `observed_applied`; it does not infer a normal return on its own. Existing
74-table data, normalized old catalogue/Auth/OAuth, nine claim ports, English
configuration and protected M02 state were preserved. The new trace table was
empty at installation, with no historical backfill. The capture trigger is
enabled; the narrowly guarded disable-only recovery entry remains unactivated.

The [02:21:35 preservation baseline](../../tracking/evidence/m07/job-attempt-observability36-live-audit/2026-11-01T02-21-35-394018Z-before.json)
passed. **AT-074 is still partial:** owner selected IMG_2852.MP4 (5,294,727
bytes) and submitted untargeted job `6763e5fa-dc53-4956-8d9b-17bbc437609e`;
root observed UI Completed. The [post-upload source verification](../../tracking/evidence/m07/job-attempt-observability36-proof/2026-11-01-owner-selected2852-source-verification.json)
does not claim a read-only job/provider audit, pre-upload verification or semantic
accuracy. The planned IMG_2850 append to the Reviewed candidate was not performed.
The app file picker now awaits owner selection of the prepared67-byte unreadable
synthetic MP4; its failure job ID/result and the pair's after audit remain unknown.
Do not resubmit the already uploaded real clip or credit the UI badge as a trace.

The stable pilot continues at <https://everyone-presentation-pilot.vercel.app>.
Web6L6v and worker2uAS remain the serving release; trace36 required no web/worker
redeployment, environment or OAuth-client change. Existing account/business
permissions were preserved; the proved scoped trace-owner, schema/table/column,
membership and function-owner permissions were added. The [02:25:35 worker observation](../../tracking/evidence/m07/job-attempt-observability36-release/2026-11-01-worker-health-after36.json)
reports Ready, one alive 2048MiB instance in dub1 and no redeployment. It is a
dated health observation, not a queued-job replacement or clean-startup-log
acceptance. Original local history29 is unchanged. Keep the pilot running until
the owner stops it.

## Completed results to carry forward

| Result | Evidence and limit |
| --- | --- |
| Owner Claude connection | [Initial/reconnect/project-read acceptance](../../tracking/evidence/m07/oauth-attempt-trace/2026-10-31-owner-connection-acceptance.json) passed, including request `23c439a1-4869-4228-a3f1-d4a6004ef4f0`. These completed gates need no reenrollment or reconfirmation; later auth-affecting changes still require relevant regression checks under owner-controlled sign-in/consent. Full delegated write/processing and token lifecycle are separate cases. |
| Workspace summary | Canonical35 and compatible web passed; [authenticated HTTP](../../tracking/evidence/m07/workspace-summary35-web/2026-11-01-authenticated-summary-read.json) and [owner-attested MCP](../../tracking/evidence/m07/workspace-summary35-web/2026-11-01-owner-mcp-summary-read.json) agree. The MCP result has no supplied request ID/server correlation; do not invent one. |
| Hosted English workflow | Actual real scan, English-only app display, new immutable saved version and PDF, old-cohort/Reviewed preservation, guest playback/PDF and link revocation passed. [Contract/evidence](../../docs/integrations/ENGLISH_TRANSCRIPT.md), [saved player/PDF](../../tracking/evidence/m03/english-version34/2026-10-31-hosted-saved-player-and-pdf.json), [old-cohort comparison](../../tracking/evidence/m03/english-preservation34/2026-10-31T18-19-53-933196Z-feac4485-c968-4ba5-a92d-c65f909d4f87-compare.json), [guest lifecycle](../../tracking/evidence/m03/english-guest34/2026-11-01-guest-english-workflow.json). Guest English used the normal owner Chrome profile and the privately extracted actual PDF annotation destination; no fresh-anonymous or native-PDF-click claim is added. The temporary link is revoked. |
| Reviewed facts/name investigation | Accepted Arabic name/age and reviewed facts stay intact. The captured original ASR omitted part of the corrected full name; translation fidelity and reviewed-fact preservation were separated. Do not inject corrected facts into a transcript, reopen the rejected historical component receipt, request more language labels, or add a language selector. Broader semantic accuracy is unclaimed. |
| Local recovery | [History33 metadata plus media rehearsal](../../tracking/evidence/m07/recovery33/2026-10-31T15-34-37-577Z-9af6774f.json) passed with its synthetic same-cluster/filesystem-object scope. It is not current36, Storage HTTP, deployed/independent-cluster or real Auth/configuration/secret restoration proof, nor RTO/RPO. |
| Trace release proof | Actual [7cff lifecycle proof](../../tracking/evidence/m07/job-attempt-observability36-proof/2026-11-01T01-16-10-092Z-7cff5c7d.json) and [bc54 release-gate proof](../../tracking/evidence/m07/job-attempt-observability36-gate-proof/2026-11-01T02-13-22-368Z-bc54b423.json) passed with full rollback, owned-resource cleanup and original29/global-role preservation. Failed207/281 claims, receipts and exact archives remain retained. Local synthetic success does not complete hosted AT-074. |

## Finish the two live audits first

The frozen [original live audit plan](job-attempt-observability36-release/LIVE_AUDIT_PLAN.md)
still describes IMG_2850/Reviewed and is historical for this selection. The
three-file [explicit actual2852 sidecar plan](job-attempt-observability36-live-sidecar/PLAN_CHANGE.md)
preserves the original baseline and binds the actual untargeted IMG_2852 source/job.
Root armed the sidecar after review/eight inert tests; it has not executed and no
input was created. Its source tests do not provide live after-audit acceptance.
Continue with ordinary signed-in app operations and the actual substituted pair:

1. Carry the owner's completed IMG_2852 upload forward without resubmission.
   Bind its actual asset/job/attempt IDs and post-upload verified bytes through
   the sidecar read-only audit. Verify actual native/OpenAI/n8n processing and
   English display; no new semantic/Reviewed-target acceptance follows from UI
   Completed. Preserve existing Reviewed facts/current project media choices.
   Actual retries, if any, determine the attempt count.
2. Upload the prepared unreadable synthetic MP4 without a candidate target.
   Verify an actual failed preparation job, safe typed error and actionable
   producer message. An ingress rejection before a job exists does not provide
   the required failed-job trace. Do not retry the protected M02 job, alter
   workflow retention, fake callbacks or change global configuration.
3. Feed only the two actual new job IDs into the bounded actual2852 sidecar. Verify
   append-only attempt IDs, stage/total counters, exact workflow execution
   references, accepted event sequence/timestamps and terminal outcome; use
   available safe n8n metadata without retaining node payloads. Diagnose the
   failed stage without printing credentials, lease data or transcript bodies.
   Historical missing execution31686 remains historical; do not reconstruct or
   backfill it. Record any fresh lookup gap honestly if it prevents diagnosis.
4. Complete the after comparison for the old Ready cohort, Reviewed row/old
   media/frames, English sources, protected M02 and static release state. Verify
   the producer error in the actual app. The observer covers Ready versions and
   exactly the supplied jobs: `new_ready_versions_observed=false` and
   `other_new_job_absence_checked=false` do not claim absence of queued/failed
   versions or unrelated concurrent jobs.

Close AT-074 only when those actual results and the actionable producer error
are recorded. A permanently unreadable source is not an invitation to repeat
the same job as a retry acceptance test.

## Eligible work after the live audits

Keep the milestone's existing order; these are remaining evidence boundaries,
not authority to reset the database or change another agent's frontend files.

| Case | Current boundary | Next finite action / dependency |
| --- | --- | --- |
| AT-063 parity | Source contract now reconciles **87 user operations / 87 MCP tools / 116 OpenAPI operations**, including Summary. This is not all live behavior. | Reconcile the final serving UI/domain/HTTP/MCP mapping and private service exclusions after any coordinated source change. Operator-only trace capture is not an ordinary user tool. Preserve shared-file/API coordination with Claude's redesign. |
| AT-064, AT-066, AT-068 full delegated/shared-data journey | Owner connection, hosted core and scoped English/Summary reads pass. A complete real producer Claude file/write/Reviewed/assignment/generation/sharing journey is still unverified. | Use the owner's already working client for documented upload-session/real-byte transfer, async processing, permitted corrections/Reviewed, assignment/Shortlist, saved outputs and review-link lifecycle. Record actual IDs and matching app readbacks. Exercise typed stale/idempotent conflicts and an appropriate retryable nonprotected job; retain existing local replay/retry proofs. Owner retains client configuration/sign-in/consent. A missing client byte-transfer bridge is a concrete client dependency, not permission to give Claude worker/service credentials. |
| AT-065 token/contributor limits | Controlled signed transport, fresh-capability and real-role local tests pass; live refresh/rotation/revocation and an actual contributor denial remain unverified. | Prepare a bounded plan using genuinely authorized test sessions/principals. Preserve the accepted owner grant and existing account permissions; no invented identities, broader grants or account reenrollment. Continue source-only regression preparation if test-session access is unavailable. |
| AT-067 shared compatibility | Guarded canonical35/36 apply/readbacks and local role/RLS/lifecycle proofs passed in their scopes. | Carry exact migration/source/preservation evidence into the complete shared-record app/MCP journey. Do not replay completed apply controllers, reset central records, or mistake query parsing for runtime SQL proof. |
| AT-069 queued replacement / rollback | Compatibility rollout and healthy daemon observation pass; no replacement during queued/running work or compatible deployed rollback is proved. | Prepare one bounded owned job, before/after consumer/lease fencing and graceful drain observations, compatible old/new application source and recovery path. Execute only with current deployment ownership and preserve completed jobs, data and Ready versions. |
| AT-070 current recovery | The accepted local33 rehearsal and later migration rollback/cleanup proofs stand. | Prepare a new owned nonproduction rehearsal for current36, English companion data and trace metadata, preserving old proofs. Separately verify referenced object bytes through Storage HTTP and actual workflow/template/Auth/configuration references, then deployed/independent recovery where available. Do not restore secrets speculatively, reset cloud or infer RTO/RPO from elapsed local runtime. |
| M07 step7 / AT-060 representative workload | The200-file run used tiny synthetic no-audio media; current production worker is serial. | Measure already permitted representative input with bounded admission, real Storage/n8n/OpenAI/native durations/usage, partial failures, backpressure/restart/resume and resource limits. A small audit pair is not a200-file/endurance or provider-cost result. Start with a bounded measured sample; further scale depends on observed quotas/cost/resources. |
| AT-071–073 accessibility / final UI | Historical keyboard/desktop automation and Claude's reported isolated redesign audit retain their scopes. **AT-072 manual screen reader remains pending; mobile is skipped by the owner.** | Run affected desktop keyboard/contrast/zoom/reduced-motion checks on the final integrated UI. Coordinate any already proposed pinned accessibility tooling with frontend/lock-file ownership. Automated axe or fixture results cannot close the manual screen-reader case. Do not restart waived mobile testing. |
| AT-075, security and final handover | Scope decisions and permission checks stand; no new language option or ingestion connector is required. Full production release remains unverified. | Run applicable final dependency/security/production-fixture-denial and source/schema/workflow compatibility checks, record actual versions/limits/locations and finish the coherent human journey. Retain all failed runs and distinguish current results from historical test counts. |

The next independent source task for AT-064 is the documented client-byte
transfer gap: server reservation/completion and browser TUS transfer exist,
but a shipped Claude Code local streaming-transfer helper and its private
capability handoff are not demonstrated. Prepare that bounded client-local
adapter and tests against existing upload contracts, with no credential-store
reads, signature-bearing shell arguments, giant base64 payloads or invented
server-local file paths. Its actual use still needs the owner's permitted
client/session and real shared-data readback; source tests cannot substitute.

The frontend's already recorded dependencies2–6 remain separate, finite source
slices in [the contract proposal](frontend-contracts/PROPOSAL.md): feedback
summary, jobs batch filter/summary, optional filtered list totals, atomic move,
and pinned accessibility tooling. Request1 Summary is now implemented and
deployed. After existing release/client gaps, the next already proposed backend
UI contract slice is the body-free feedback summary with both signed-in/MCP and
guest authority paths. It must receive its own contract,
permission, SQL and release checks; do not bundle it into frozen trace36 or
silently merge the complete redesign.

## Stale labels to supersede in current ledgers

These findings describe the files read for this reconciliation. Root may update
their current fields separately; preserve dated historical sections and frozen
source bytes rather than rewriting past outcomes.

- `tracking/progress.json`: the current pilot history/next action still says35
  and apply36; its old `jobs_created_scope` says specs ACK is blocked despite
  the later passed specs core check. The combined M07 release gate still lists
  English rollout as unfinished and labels M03 semantic checks pending. Replace
  current summaries with installed36/live-audit-pending and the accepted English
  scope; do not add more language-label work or claim broad semantic accuracy.
- `tracking/evidence/m07/ACCEPTANCE_MATRIX.md` and
  `docs/quality/RELEASE_EVIDENCE.md` have current-overview Ccw/CVDM/canonical33,
  English-off and older86/86/115 labels. Their latest live owner connection
  remains passed. Add a current override for36/web6L6v/worker2uAS/English1.0,
  Summary87/87/116 and the remaining live cases; keep old receipts dated.
- `README.md`, `docs/operations/DEPLOYMENT_AND_RUNBOOK.md`,
  `development/m07/RECOVERY.md`, `API_CLIENT_RUNBOOK.md` and
  `REMAINING_AFTER_ENGLISH34.md` contain older serving, hosting-deferred,
  signed-out/provider-unconfigured or pre36 next-action wording. The pilot is
  running, owner connection is accepted, local33 recovery is accepted in its
  scope and trace36 is installed. Old29/33 operators and receipts are historical
  artifacts, not instructions to replay against current36.

No part of this reconciliation marks M07 verified. Keep screen-reader acceptance
pending until performed, mobile skipped, the controlled pilot running, completed
English/guest/version/Reviewed/connection/recovery results preserved and the
remaining live evidence explicitly open.
