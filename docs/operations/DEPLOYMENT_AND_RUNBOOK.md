# Deployment, recovery and operational runbook

Owner update recorded 4 November 2026: [Claude metadata confirmation and AT060 disposition](../../tracking/evidence/m07/completion-release/2026-11-04-owner-PDF-metadata-confirmation.json) reports one successful `get_media` call, request `1337466a-43be-42ed-93fc-a1392b86cf7f`, Ready `presentation_pdf`, 810,902 bytes and SHA-256 `b50806f9abf577d6250889e226973162a243b9b9303bdb1361b3a791456c5dc2`. It matches the retained Selection v2 PDF. The earlier failed read is retained. The owner reports no corpus available and requests AT060 stay open. Full M07 remains false with AT069 historically blocked. Service identities below retain their recorded November 3 observation times; this update adds owner evidence only.

## Current operations checkpoint - 2026-11-03

This section governs current operations. The dated material below is retained
history and planning, not a current claim that hosting is deferred or OAuth is
unavailable. [Current handoff](../../tracking/HANDOFF.md) and the
[M07 matrix](../../tracking/evidence/m07/ACCEPTANCE_MATRIX.md) own milestone status.
Full M07/release acceptance remains false.

- Web deployment `dpl_4gdhR5Le7K9pMnPSNpbHzkNjWjoo` is Ready. The
  [normal readback](../../tracking/evidence/m07/presentation-pdf-metadata-web-forward-release/2026-11-03T14-44-32-244101Z-b5e29aa2-7f3e-4a7a-8fe2-e1246a0ab705-readback.json)
  at14:44:32Z proves two equal stable-alias/direct identities for selected Main
  `514447f5e82d97b18cf45807eebe77287e17044a`. Its
  [Root quality](../../tracking/evidence/m07/completion-release/2026-11-03T14-14-04.950Z-235ee1b3-pdf-metadata-root-quality.json)
  passed1030/1030 plus typecheck, lint and production guard. The source/test delta
  from e259 is exactly the reviewed central metadata fix and focused test.
- [Root HTTP/UI verification](../../tracking/evidence/m07/completion-release/Root-4gdh-production-metadata-and-UI.json)
  passed the supported13-field PDF metadata read, anonymous401 denial and refreshed
  Ready20-page Selection UI. The existing Claude client's metadata read passed;
  neither a new PDF/video download nor another generation is implied.
  [Completed owner artifacts](../../tracking/evidence/m07/completion-release/2026-11-03-owner-generation42-retained-artifacts-outcome.json)
  and [reciprocal app reads](../../tracking/evidence/m07/completion-release/Root-owner42-reciprocal-app-readback.json)
  retain their separate Ready20/17/3 PDF/media/feedback and UI scopes. Do not replay
  those completed operations to repair a metadata-only response.
- Canonical `pyibofyctwnqpvktepse` is history42. The
  [normal compact apply](../../tracking/evidence/m07/presentation-generation-compact-release/2026-11-03T13-18-27-651163Z-apply.json)
  and [Root audit](../../tracking/evidence/m07/presentation-generation-compact-release/Root-2244e718-postapply-audit.json)
  bind the genuine nonce, two equal readbacks, full76 rows including audit reasons,
  exactly seven function bodies and unchanged attributes/OIDs/ACLs, fixed functions,
  roles, policies and dependencies. Protected checkpoints are not restore proof.
- WorkerFxd/ffb4/f814 and retained native3d are unchanged. All five processing
  configurations remain enabled in the accepted checkpoint. The
  [normal resume](../../tracking/evidence/m07/worker-ocr-config-daemon-release/2026-11-03T01-38-19-111153Z-resume.json)
  and current web preflight are deployment/configuration evidence, not a fresh
  heartbeat, native probe, worker rebuild or replacement-under-load proof.

### Change and incident ownership

Use [configuration ownership](CONFIGURATION.md) and the
[current worker cutover record](../../tracking/WORKER_CUTOVER_CURRENT_2026-11-02.md).
Root owns guarded normal CLI changes; runtime actors keep their existing scoped
business permissions. Never copy secrets into docs, source, command output or
another environment. Retain protected raw responses before safe projection.

A permanent claim or unknown provider return is not permission to resubmit.
Preserve the exact purpose, source pins, inputs and first error; reconcile with
bounded read-only observations through the existing normal CLI path. A separately
reviewed forward purpose may complete only its authorized unattempted work.
Do not edit consumed helpers or repair a claim/nonce/normal marker. The original
worker registry-copy return remains UNKNOWN; separate digest/Ready observations
are not a fabricated normal copy return.

The [38 preclaim diagnosis](../../tracking/evidence/m07/final-canonical42-web-forward-release/Root-38c4-preclaim-path-failure.json)
retains its filename rejection and absent deploy claim/submission. The two older
HTTP413 attempts retain their not-applied reconciliations. New b5e29 is a fresh
source/build/release purpose, not a replay or alias repair of those attempts.
For later schema/configuration work, preserve full reasons, all76 current rows,
exact function authority/catalogue scope, native identity and idle counters; do
not weaken comparisons to reuse an older checkpoint.

### Open acceptance boundaries and restricted recovery

Existing-Claude metadata confirmation passed. Final publication and handover evidence
retain their recorded scopes. AT060 remains mandatory and open: the owner reports
no corpus available and requests leaving it open. Synthetic throughput is insufficient.
Narrator/screen-reader, contributor and mobile were skipped, not
passed, and are not to be requested again as new gates.

AT069 rollback-transport preparation was rejected by automatic approval review
with the exact recorded reason **blocked by policy**. Do not retry the rejected
action, use a manual/equivalent transport or perform a provider action as its
substitute. The historical worker plan and partial sources are not an executable
recovery instruction or a replacement/rollback pass. Ordinary accepted forward
releases do not satisfy AT069. See [recovery scopes](../../development/m07/RECOVERY.md).

## Retained 2026-10-30 runbook and requirements

Updated2026-10-30. M07 has implemented local sources and controlled/client/native evidence; production release remains unverified and hosting deferred. This runbook preserves the planned deployment/recovery requirements below. The [M07 matrix](../../tracking/evidence/m07/ACCEPTANCE_MATRIX.md) is the current evidence index; no command in this document independently authorizes provider changes or a shared reset.

## Current local operator checkpoint

- Use the [API/client runbook](../../development/m07/API_CLIENT_RUNBOOK.md) for the actual development origin, upload acquisition/byte transfer/completion, async polling and PDF/media companions. Recheck ownership before restarting the recorded app/worker; do not start duplicate workers or stop a PID from an old handoff alone.
- Auth/resource/consent code exists, with explicit local/disabled/OAuth modes and fresh user/session/delegation checks. Public provider discovery observed Authv2.197.0 and OAuth metadata404 on2026-10-30; that404 does not identify the exact provider flag. No live provider enablement, approved client/issuance hook or full OAuth journey is established. Follow [consent setup](../../development/m07/OAUTH_CONSENT_SETUP.md) while preserving unrelated central login destinations and clients.
- The installed Claude Code compatibility smoke used real Studio SDK transport with synthetic business ports. It performed five calls, one synthetic update and revision-2 readback; its original exact protocol capture remains unverified. See [the source-preserving assessment](../../development/m07/CLAUDE_CODE.md). Do not run that model-call harness as an automatic health check or reinterpret it as real business acceptance.
- Migration29 was applied once locally (b17a0d67; independent f40f96c2 inspect) and once to canonical `pyibofyctwnqpvktepse` ([3a0afd9f apply](../../tracking/evidence/cloud-m07-29/2026-10-30T11-52-15-216806Z-3a0afd9f-apply.json), [f553771a independent readback](../../tracking/evidence/cloud-m07-29/2026-10-30T11-52-36-310355Z-f553771a-readback.json)). Exact history/catalogue/data preservation passed. The earlier refusal and original-profile review remain historical. No OAuth client, hook/provider flag or identity was created by that apply. Old history28 harnesses remain preserved, not rerun against29.
- After29, [the authenticated startup gate](../../tracking/evidence/m06/guest-export-runtime/2026-10-30T11-53-17-871Z-d3a747b7.json) passed all12 exact native-service operations without claiming jobs or invoking providers. [New owned processes are running](../../tracking/evidence/m07/runtime29-transition/2026-10-30-owned-processes-ready.json): worker60408 to8836; web33724 to62080 to53776, with exact ownership/serving proof. [The actual Settings page](../../tracking/evidence/m07/live-app/2026-10-30-settings-sign-in-pending.json) loaded in central mode but signed out, so authenticated Settings values/write acceptance awaits user sign-in. No credentials were extracted, email sent or enrollment repeated. The Supabase connector remains unavailable and the existing Auth dashboard is also signed out; live OAuth configuration was not inspected or changed.
- Settings timezone is now carried through capabilities/session into the requested UI timestamps with Cairo fallback. UTC data/frozen PDFs stay unchanged; expiry editing remains browser local. Controlled UTC/Cairo-midnight and existing DST/lifecycle checks pass.
- The production worker implementation is one serial loop per process. The separate bounded-two synthetic native diagnostic did not change it. [Workload evidence](../../development/m07/WORKLOAD.md) documents drained process restart, partial failures and explicit retry; it is not a deployed worker/API replacement, crash, endurance or provider-cost test.

## 1. Deployment units

The release consists of web/API/MCP code; a media/render worker container with pinned native binaries/fonts; coordinated Supabase migrations/policies/functions; private bucket configuration; versioned n8n workflows; server-side credentials/configuration; and contract/template/schema versions. Deploying only the UI is not a release of the app.

Use existing Everyone hosting and CI/CD when suitable. Define staging isolation, deployment domains, OAuth callbacks and worker connectivity in M00. Do not invent provider account access or claim a domain has been provisioned. Export n8n workflow JSON without credential values and record deployed workflow ID/version per environment.

## 2. Required CI checks

Run type/lint/build checks; JSON-schema/OpenAPI/MCP operation consistency; domain rules; local DB migration replay and permission tests; representative worker media/PDF tests; browser happy/edge journeys; and artifact/manifest version compatibility. Test stale edits, simultaneous Main selection, duplicate callbacks and out-of-order version completion. Run a scheduled or release live-service suite with authorized test resources, rather than spending provider quota on every cosmetic change.

Do not ship stub provider adapters, dev auth, demo fixtures or unrestricted project creation in production mode. Add an executable configuration assertion for these cases. Test app startup fails safely if required credentials/migrations are absent, without logging secrets. Tests need evidence paths and exact commit/config versions; a check box alone is insufficient.

## 3. Migration and release order

1. Inspect migration history and current schema drift. Confirm target environment explicitly using non-secret identifiers.
2. Test additive migration and realistic existing data locally/staging. Save backup/restore evidence under the business process; validate metadata and referenced objects separately.
3. Apply compatible schema/functions/policies according to existing release authorization. Expand before code depends on new fields; delay destructive contraction to a separately planned release if ever needed.
4. Deploy compatible worker/template and n8n workflow versions. Keep running old jobs pinned to compatible schema/prompt/template versions or drain them deliberately.
5. Deploy web/API/MCP and configuration. Verify health, auth, project adapters and scoped worker callbacks.
6. Execute staging/production smoke journey with designated test records: central project, supplied specs/video, library, assignment, generation, PDF, guest review, API/MCP.
7. Record deployment identifiers, migration filenames, workflow versions, live-service test results and recovery instructions in PROGRESS.md and release evidence.

The pack does not authorize destructive resets of shared business data. Follow current environment access/release rules, but do not invent repetitive human-confirmation gates for normal already-authorized development. If an automated permission system blocks a concrete action, record that exact action/reason and complete unaffected work.

## 4. Operational incident table

| Symptom | Inspect | Recovery | Integrity check |
|---|---|---|---|
| Uploaded file never starts | Completion verification, job/outbox transaction, dispatcher lease | Reconcile verified ready uploads lacking job; retry durable outbox | Same asset/job idempotency, no second candidate |
| n8n execution lost/retried | Job state, stage attempt/fence, diagnostic n8n ID | Re-dispatch only uncommitted stage with current lease | Duplicate callback ignored; confirmed data unchanged |
| Provider quota/auth failure | Redacted provider code, configured key/model/limit | Pause affected queue, correct config, retry eligible jobs | No infinite retries/candidate duplication |
| Worker crashes | Resource metrics, temp usage, lease expiry | Restart; reaper requeues current safe stage | Old attempt cannot commit after new fence |
| Some video facts missing | Audio/transcript status, supplied source | Let user correct or replace source; retry only appropriate stage | Never infer missing facts from image |
| Spec extraction overwrites edits | Expected source revision and row_version | Reject stale result; refresh normal draft editing | No hidden overwrite of reviewed corrections |
| PDF generation fails | Template version, missing asset/font, overflow and renderer logs | Fix cause; retry same frozen manifest or generate new version after edits | Prior ready version still available |
| Latest link shows older version | Series pointer update, version order/status | Repair pointer to highest ready permitted version transactionally | No cross-output/audience content |
| PDF video opens wrong candidate/source | Export/grant/version/asset binding | Disable faulty export/grant; regenerate correct access variant | Never replace media under original immutable ID |
| Guest cannot access active link | Expiry/timezone, revoked_at, session, parent grant | Correct allowed expiry/session config; issue new link if revoked | No bypass of disabled/revoked access |
| Unauthorized central/library visibility | Capability mapping and project query scoping | Stop affected route/credential, repair tests and mapping | Verify cross-project and guest isolation |
| Storage object missing after restore | DB metadata vs object backup manifest | Restore matching checksum object; mark unavailable if impossible | Do not silently substitute bytes |

## 5. Jobs, retries and cancellation

Retry only transient failures such as timeouts, quota backoff or temporary network/storage interruption. Unreadable input, unsupported format, denied access and schema-invalid content need action or a documented safe parser retry, not endless repetition. Every retry retains stable input identity and new attempt fencing. Stage completion is idempotent and refuses stale attempts. Outbox delivery is at least once; effects must be deduplicated.

Cancel stops future work and future commits, not necessarily a provider already executing a paid request. Preserve committed usable results where the product already exposed them; cancel is not an undo of a saved profile. Record which stages completed. A failed member of a batch must not block successful candidates from review or generation.

## 6. Backup, restore and rollback

### Completed isolated rehearsal and its limits

The [history28 local rehearsal](../../development/m07/RECOVERY.md) restored metadata into a second disposable database and four exact referenced objects into a fresh filesystem destination: actual synthetic original MP4, canonical manifest/PDF and guest export PDF. It restored52 source entries, including28 migrations and pinned workflow/template/font/renderer sources, and compared functions/owners/grants/RLS/constraints. The restored two-second160×90 H264 MP4 decoded; the canonical PDF validated eight pages/168 text regions/two fixed-video links/three fonts. No candidate frames were selected.

Controlled expiry recovered an outbox and incomplete job under fresh fences; old acknowledgements/callbacks were denied while the earlier Ready version/PDF stayed fixed. Missing/tampered backup objects failed closed. Exact disposable database/container cleanup and unchanged original baseline/lock release were observed. Elapsed103994ms is the local rehearsal duration, not an agreed RTO/RPO. The two databases shared existing roles in one pinned local cluster; objects used filesystem transport instead of Supabase Storage HTTP. Provider secrets, independent-cluster recovery, deployed workflows/configuration and staging services were not restored. This evidence remains history28 even if a later migration is promoted.

A post29 restore follow-up is currently on its second bounded attempt after a type-boundary OID correction. No successful post29 receipt is credited yet; the history28 scoped result above remains the established partial recovery evidence. Rehearsal commands and ownership checks are in `development/m07/RECOVERY.md`. They must not be adapted into a cloud reset. Production backup acceptance still requires the environment/object-store steps below, plus the actual configured schema/workflow/template versions and access/credential restoration procedure.

Record the business recovery objectives instead of making unsupported guarantees. Back up schema/data/migration state, workflow definitions/config references, renderer versions/fonts, and private object contents/reference manifests. Prove restore into an isolated environment with an actual candidate/video/ready PDF/export and correct linked-media access. Database and object storage backups are different artifacts.

Prefer rolling application code back to a compatible version or deploying a forward fix after an additive migration. Do not blindly execute destructive down-migrations on shared tables. Keep known-good template versions available for existing manifests. A failed release must not reinterpret old version payloads through a new incompatible schema.

## 7. Access/secret handling and audit

Use least-privilege service identities and scoped callbacks; validate actor/scope server-side. Rotate provider/callback credentials through existing secret management. Revoke guest links and grants transactionally. Download-disable prevents further PDF preparation/download but does not erase downloaded PDFs or revoke otherwise valid view/video access. Link expiry changes propagate to non-revoked grants; revocation/rotation invalidates old access. Never log bearer tokens or include them in analytics/referrers.

Audit actor type/user, operation/resource, request ID, timestamp and safe before/after changes for central updates, profile confirmation, casting positions, version generation, sharing and recovery. Keep audit access restricted. Do not create a second immutable repository of complete private video/transcript payloads inside logs.

## 8. Production acceptance and handover

M07 requires all agreed BR rules covered, zero unresolved critical access/data-loss issues, actual intended Claude client connection, real-service evidence, measured batch behavior, and recovery proof. Retain a concise operator guide for retry, cancel, stale jobs, link revoke/extend, bad asset replacement, template rollout and rollback. State measured limitations honestly (codec support, provider limits, throughput, accessibility/browser scope).

Complete [release evidence](../quality/RELEASE_EVIDENCE.md), PROGRESS.md, tracking/progress.json and HANDOFF.md. A hosted URL with mock AI or a generic API endpoint is not production acceptance.

AT-072 screen-reader acceptance and broader M03 independently labelled English/mixed semantic evaluation remain pending. Mobile testing is skipped by owner instruction. No current hosting, deployed replacement/rollback, full live delegated journey, endurance or RTO claim is made. [Final scoped quality](../../tracking/evidence/m07/quality/2026-10-30-final-documentation-overlay.json) passes747modules,80desktop cases, typecheck/lint/build/production guard and retains unchanged app/test bytes, with the separate physical-mapping documentation overlay. [The final80desktop selection](../../tracking/evidence/m07/quality/2026-10-30-desktop80-final.json) excludes seven older mixed320px cases that inadvertently ran in the earlier87selection despite the skip flag. The overbroad87label is qualified, its receipts preserved and no mobile acceptance credited. Post29 SQL/filesystem restore now passes its own scoped evidence; authenticated Settings and remaining release gates still require their own results.
