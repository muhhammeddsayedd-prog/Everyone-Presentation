# M07 remaining acceptance after trace36 installation

Reconciled from the milestone packet, AT-063–075 definitions, current main
receipts and existing release matrices on 2026-11-01. This is a source-only
acceptance reconciliation, not a new feature decision or a production pass.
No operational command, provider request, upload or database change was made
for this document. The root agent owns the main progress/handoff updates.

## Current release boundary - 2026-11-01, 03:59 UTC

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
| AT-064, AT-066, AT-068 full delegated/shared-data journey | Owner connection, hosted core and scoped English/Summary reads pass. A complete real producer Claude file/write/Reviewed/assignment/generation/sharing journey is still unverified. | Use the owner's already working client for documented upload-session/real-byte transfer, async processing, permitted corrections/Reviewed, assignment/Shortlist, saved outputs and review-link lifecycle. Record actual IDs and matching app readbacks. Exercise typed stale/idempotent conflicts and an appropriate retryable nonprotected job; retain existing local replay/retry proofs. Owner retains client configuration/sign-in/consent. Transfer3b4b5c8 plus inbox f3ed127 are committed;29 combined focused tests passed. Owner inbox prepared03:51/expires04:06 proves source/private-directory preparation only; actual Write/private handoff/reserve-transfer-complete remains unverified. Never give Claude worker/service credentials. |
| AT-065 token/contributor limits | Controlled signed transport, fresh-capability and real-role local tests pass; live refresh/rotation/revocation and an actual contributor denial remain unverified. | Prepare a bounded plan using genuinely authorized test sessions/principals. Preserve the accepted owner grant and existing account permissions; no invented identities, broader grants or account reenrollment. Continue source-only regression preparation if test-session access is unavailable. |
| AT-067 shared compatibility | Guarded canonical35/36 apply/readbacks and local role/RLS/lifecycle proofs passed in their scopes. | Carry exact migration/source/preservation evidence into the complete shared-record app/MCP journey. Do not replay completed apply controllers, reset central records, or mistake query parsing for runtime SQL proof. |
| AT-069 queued replacement / rollback | Compatibility rollout and healthy daemon observation pass; no replacement during queued/running work or compatible deployed rollback is proved. | Prepare one bounded owned job, before/after consumer/lease fencing and graceful drain observations, compatible old/new application source and recovery path. Execute only with current deployment ownership and preserve completed jobs, data and Ready versions. |
| AT-070 current recovery | Local33 remains passed. Original084 failed/separate cleanup passed; fresh c0 and5d failed at restore profile, with full automatic database/3-role/original29/Auth-Storage/global-role preservation and lock cleanup passed. Fresh5d captured13 differences and the new trace owner-ACL/NULL pair. | Native508 proof/cleanup passed03:59 for the exact owner-ACL/NULL pair; no profile exception or restore36 pass is admitted. Review the separate source-only exact adapter, then use a fresh full36 recovery claim. StorageHTTP/deployed/Authconfig/secret/RTO/RPO remain unverified. |
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
