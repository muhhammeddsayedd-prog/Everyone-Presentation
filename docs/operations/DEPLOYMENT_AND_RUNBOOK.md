# Deployment, recovery and operational runbook

Version 1.0 • Complete during M00–M07 with actual environment names and tested commands.

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

Record the business recovery objectives instead of making unsupported guarantees. Back up schema/data/migration state, workflow definitions/config references, renderer versions/fonts, and private object contents/reference manifests. Prove restore into an isolated environment with an actual candidate/video/ready PDF/export and correct linked-media access. Database and object storage backups are different artifacts.

Prefer rolling application code back to a compatible version or deploying a forward fix after an additive migration. Do not blindly execute destructive down-migrations on shared tables. Keep known-good template versions available for existing manifests. A failed release must not reinterpret old version payloads through a new incompatible schema.

## 7. Access/secret handling and audit

Use least-privilege service identities and scoped callbacks; validate actor/scope server-side. Rotate provider/callback credentials through existing secret management. Revoke guest links and grants transactionally. Download-disable prevents further PDF preparation/download but does not erase downloaded PDFs or revoke otherwise valid view/video access. Link expiry changes propagate to non-revoked grants; revocation/rotation invalidates old access. Never log bearer tokens or include them in analytics/referrers.

Audit actor type/user, operation/resource, request ID, timestamp and safe before/after changes for central updates, profile confirmation, casting positions, version generation, sharing and recovery. Keep audit access restricted. Do not create a second immutable repository of complete private video/transcript payloads inside logs.

## 8. Production acceptance and handover

M07 requires all agreed BR rules covered, zero unresolved critical access/data-loss issues, actual intended Claude client connection, real-service evidence, measured batch behavior, and recovery proof. Retain a concise operator guide for retry, cancel, stale jobs, link revoke/extend, bad asset replacement, template rollout and rollback. State measured limitations honestly (codec support, provider limits, throughput, accessibility/browser scope).

Complete [release evidence](../quality/RELEASE_EVIDENCE.md), PROGRESS.md, tracking/progress.json and HANDOFF.md. A hosted URL with mock AI or a generic API endpoint is not production acceptance.
