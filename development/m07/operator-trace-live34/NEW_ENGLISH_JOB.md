# Fresh AT-074 input for the actual English scan

Actual app job: `3cf25d3b-c1ec-4347-af3b-fa48f3f0f5e7`, candidate_scan in Dummy Pilot Test workspace `86936940-b48d-497d-b1ff-8e0da0913afa`, appending an introduction to the existing Reviewed candidate. At initial input preparation, upload had completed and the UI showed Supplied fact extraction in progress. Root subsequently observed Completed and the exact controlled observer passed at17:58:54. New media is13614da0-9c0e-40c4-afbf-2c739f463a74/source d9db9907-5e60-4382-b61c-bb2b67709c09. Actual receipt `tracking/evidence/m03/english-name-review/2026-10-31T17-58-54-734417Z-c95c23b3-a8aa-4d11-9602-c9b4f9ef8dbb-controlled-job.json` confirms persisted v2 English and provider/source bindings plus old Reviewed preservation. App/guest/new-version acceptance is separate and not granted here.

The private correlation-input path is:

`.local/m03-english-component/at074-new-english-job-input.json`

The input file has **not** been created: the actual latest n8n execution ID and fresh durable event observation are still needed. Do not invent them, reuse historical31515/31520/31523, request another job or replay the old fixed observer claim. The exact historical reads returned404; their cause remains unknown and AT-074 remains partial.

After root observes completion, obtain only closed job/attempt/workflow-execution/event metadata through its reviewed read-only canonical34 path. Save a payload-free metadata receipt, preserve its actual observation time, and review the evidence binding job3cf25d3b to the execution references. If no durable execution ID is present, keep this check pending; do not search arbitrary retained executions or fetch full node data to guess a match.

`fresh-input.mjs` validates the following closed input and produces bounded read cases. It is inert: no files, credentials, configuration, database or network are accessed. Use real values only after root has reviewed the source receipt; this is a shape description, not a populated plan:

```typescript
{
  schema_version: '1.0',
  purpose: 'at074-controlled-english-job-metadata',
  job_id: '3cf25d3b-c1ec-4347-af3b-fa48f3f0f5e7',
  workspace_id: '86936940-b48d-497d-b1ff-8e0da0913afa',
  kind: 'candidate_scan',
  job_status: 'succeeded' | 'failed' | 'waiting_for_input' | 'cancelled',
  durable_observation: {
    receipt: string, // Payload-free tracking/evidence/m03 or m07 JSON.
    sha256: string, // Exact metadata-receipt bytes, not a transcript/source payload.
    observed_at: string // Actual UTC observation, not this document's time.
  },
  execution_refs: [{execution_id: string, workflow_id: 'gfhxzvSkprS2CI4o', attempt: number}]
}
```

Allow at most2 distinct actual execution references. WF02 is the existing candidate-scan workflow; confirm the durable reference/current workflow binding before a query. If it differs, stop and inspect the evidenced change rather than accepting arbitrary workflows. No credentials, tokens, callback URLs, transcript, stage payloads or raw error text belong in the plan or receipt.

## Fresh durable observation prepared for root review

`observe-fresh-job.py` and `fresh-job-query.sql` prepare one bounded linked-CLI read for this exact succeeded job/media/source tuple. The SQL is read-only/repeatable-read with20-second statement limit, empty search path and UTC. It verifies exact canonical34 history hash, English1.0, approved apply-function source/attributes and protected M02 metadata; it returns the latest persisted workflow execution ID, request UUID, at most100 payload-free event rows with explicit truncation and outbox counts. Source pins include the actual successful controlled-job proof and canonical enable readback. Import/tests do not query. A permanent distinct claim precedes the one allowed query; preserve it, even on failure.

```powershell
python -X utf8 -B development/m07/operator-trace-live34/observe-fresh-job.py
```

Do not execute before root reviews the source. Preparation passed5 pure tests and actual SQL pglast parsing; no child SQL/cloud call occurred. The current schema overwrites `jobs.n8n_execution_id` on each stage claim. `job_events` contains attempt/sequence/stage/type/time but no independent execution-ID column. This read therefore identifies only the persisted latest workflow execution; it does not reconstruct all per-stage n8n execution IDs or fetch event receipts to guess them. Keep this limitation in final AT-074 evidence.

Input validation verifies identities, cardinality, workflow and receipt hash; **it does not independently parse/prove the job-to-execution relationship**. The root must first review that relationship in the actual durable observation. Hash equality alone is not correlation or acceptance. No network runner is admitted by this preparation.

For actual metadata access, prefer the available n8n plugin's `get_execution` with `includeData:false` for those exact IDs. If it fails, save a safe connector classification. The previously root-reviewed `execution-metadata.mjs` exports the bounded `inspectExecution` and closed `metadataProjection` that can be reused in a **fresh** purpose-bound observer after root reviews the actual IDs/input/source pins. Never run its historical CLI main again. A new fallback must retain the existing origin/config loader, ambient-override denial, redirects disabled, no automatic retries,15-second timeout,64KiB body limit, permanent distinct claim and no arbitrary response fields. No new provider job, workflow edit or execution retry is authorized by this input plan.

Pure synthetic input tests:

```powershell
node --test development/m07/operator-trace-live34/fresh-input.test.mjs
```

The final AT-074 correlation still needs actual job/attempt/request/event references, real n8n execution metadata, provider outcome and output asset bindings, plus the separate evidenced failure/operator path. A successful metadata GET alone does not pass it. Preserve the completed owner Claude connection acceptance, pending screen reader and skipped mobile testing.

## Actual durable result and one-GET fallback

Root executed the fresh durable observer once. Actual receipt is `tracking/evidence/m07/operator-trace-live34/2026-10-31T18-09-56-990830Z-fresh-job-durable.json`; its SQL observation time is **2026-10-31T18:09:57.775113+00:00**, not the filename's start time. It confirms succeeded/apply_candidate/attempt5, latest execution31686, six events and five delivered outbox rows with no pending/leased/dead rows. Root's plugin `get_execution` for31686 with `includeData:false` returned `isError` and no structured response. Its exact provider observation time is unavailable; do not manufacture one from this document or receipt time.

The **new** `fresh-execution-metadata.mjs` fallback is prepared for root review and one invocation. It reuses the frozen `inspectExecution` export, validates the actual durable receipt hash and exact31686/WF02/attempt5 tuple, and reads only the fixed protected input path via a pinned Windows owner/SYSTEM ACL reader. That reader runs through the exact existing `.venv-skills/Scripts/python.exe`, with its regular-file identity and binary checksum pinned, never the WindowsApps/PATH shim. `expectedFreshPlan(actualDurableBytes)` produces the exact metadata-only input; root must create that file using the existing `WindowsPrivateFiles` protected creator after source review. No child plan or claim was created. The older WF02 metadata receipt pins the expected configured ID/active state at its own actual observation and explicitly records success/error data retention `none`; the new execution response must itself match that exact workflow ID. This is an older configuration observation, not a fresh read or proof of a particular404 cause. No new workflow-config read, payload logging or activation is performed.

```powershell
node --test development/m07/operator-trace-live34/fresh-execution-metadata.test.mjs
node development/m07/operator-trace-live34/fresh-execution-metadata.mjs
```

The first command now passes6 tests, including every helper/evidence source pin and an actual protected-input bootstrap through the fixed interpreter. That regression captures the metadata plan privately, validates the exact tuple and clears the captured text; it never loads private provider configuration or makes a request. The second creates `at074-execution-31686-metadata.claim.json`, reads the existing private loader without ambient overrides, and makes at most **one** exact metadata-only GET31686. It retains redirects disabled, no retry,15-second deadline,64KiB response bound and closed identity/status/time projection. Non-200 bodies are discarded. Reports contain hashes/status/classifications and safe metadata only. The historical fixed observer and its completed claims remain unchanged. AT-074 remains partial even if this read succeeds; failure-path and per-stage-history limitations remain explicit.

Root's first fallback invocation failed locally before claim creation, private configuration load or HTTP: the protected reader imported the verifier without the verifier's `tools` dependencies on `sys.path`. The exact executed a300 runner and709c reader are preserved under `source-history/` as byte-identical `.txt` files. The root's actual failure receipt is `tracking/evidence/m07/operator-trace-live34/2026-10-31-fresh-bootstrap-failure.json`; the separate source-preservation audit references that same attempt and is not another provider attempt. The corrected reader verifies all three security-source hashes before temporarily adding `ROOT/tools`, verifies the loaded dependency paths and restores the prior `sys.path` in `finally`. The original protected plan is unchanged; no failed claim exists to replay. Root must review the corrected source before its first possible one-GET admission.
