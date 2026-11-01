# AT069 bounded worker replacement and application rollback plan

Source-only proposal, 2026-11-01. No provider/SQL/CLI command, build, deployment,
private input read or process control was performed for this plan. AT069 remains
unverified. Root reviews the finite operator and performs any later execution.
The [written case](../../docs/quality/TEST_STRATEGY.md) requires replacement
during queued work, graceful interruption/retry, compatible contracts and an
application rollback that preserves completed user data. A restart alone cannot
prove all of that.

## Fixed existing targets and dependencies

| Item | Admitted starting point; reobserve before execution |
| --- | --- |
| Worker | Existing project `prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6`, team `team_gboXPxTevpCOZuaA8eY9PmR1`, daemon `worker`, technical production; `dpl_2uASsbYobSDwWjMptPjGLcVEdCg3`. |
| Resources | Desired one instance in `dub1`, 2048MiB, 300-second termination grace, no scaling override. Actual [02:25 observation](../../tracking/evidence/m07/job-attempt-observability36-release/2026-11-01-worker-health-after36.json) is dated health evidence, not current replacement acceptance. |
| Runtime | Daemon digest `sha256:430d0992ef3280f13fb52ff206d0ae09eedb2fee0831583f868db77d4012f12f`; baked native digest `sha256:795f8f7736594fb51cc0c304d85bae9d29f31861e606eec0c2a83806fff5d3b9`; context4186fd1e/source `b3489d64fb1bb207e0a1020fadac3db14490c94ba6d2aedf9c6a358ebb36f181`. Preserve the baked manifest/source seal together. |
| App rollback anchor A | Existing web project `prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0`, same team, stable alias `everyone-presentation-pilot.vercel.app`; `dpl_6pcN8Qb1XDkBTsiwKVmexKfWUvf7`, source283/SHA `d17a3f4eba0f0dc5a19ed02bc0c717c8b1472ce692fe910118ace3238fbc79ee`. [Ready](../../tracking/evidence/m07/source-unreadable36-web/2026-11-01T03-10-26-362504Z-ready.json) and actual app/API/owner-MCP guidance passed. |
| Data/actor | Canonical36 on `pyibofyctwnqpvktepse`; existing permitted Producer, Dummy Pilot Test project `6da14b82-8458-451f-aa21-28cb6c85bdc5`, workspace `86936940-b48d-497d-b1ff-8e0da0913afa`. No new identity, capability, OAuth client, project, environment transfer or schema change. |

The daemon Dockerfile uses Node24, unprivileged UID1000 and an uncached offline
production-import gate. Current package pins are `@vercel/sandbox`3.9.1,
`@vercel/oidc`4.0.5 and `tsx`4.23.15; an execution must use the versions actually
inside its admitted image, not infer an image change from current checkout files.
Use the [actual2uAS release](../../tracking/evidence/m03/english-worker-release34/2026-10-31T17-49-47-805229Z-ready.json)
and [OCI adapter provenance](../../development/m03/english-oci-adapter34/README.md).
Old33/off/drained release controllers are historical: never replay them against36.

## Supported controls and actual shutdown semantics

The installed CLI65.8.0 source, inspected without running it, defines
`daemons instances restart <instance> --project <existing-worker-project>`:
`commands-routing.js` resolves the project and exact existing instance, then POSTs
`/v1/projects/{project}/daemons/{daemon}/instances/{instance}/restart` with
`retry:{retries:0}`. Its command descriptor says SIGTERM then a new container;
`accepted` is not Ready/completion. An unknown outcome is reconciled read-only,
never submitted again. Instance IDs must come from a fresh bound observation.

The same source supports inspect/list and regional scaling/reset; it exposes no
separate daemon drain/stop command or job-aware admission barrier. Do not invent
one, scale to zero, add a second configured worker, or infer rolling-release
overlap/ordering from web routing controls. Official [daemon management documentation](https://vercel.com/docs/daemons/managing-daemons#deploying-changes-to-a-daemon), checked2026-11-01, now explicitly documents that production replacement starts new instances immediately and SIGTERMs the old instances, with both versions briefly running together. The [shutdown documentation](https://vercel.com/docs/daemons#graceful-shutdown) defines the configurable grace period. These establish the supported overlap/termination behavior; actual timing and instances must still be observed. A distinct deployment B must be observed directly; an instance restart within2uAS is only a restart.

[`runtime-main.ts`](../../apps/worker/src/runtime-main.ts) handles SIGTERM,
SIGINT, parent disconnect and shutdown IPC by aborting polling **and current
execution**. [`runtime.ts`](../../apps/worker/src/runtime.ts) closes the gateway
after execution settles; it ACKs the outbox after a successful stage claim and
before costly execution. This is cancellation followed by durable recovery, not
an application drain that promises to finish in-flight work. SQL leases are90s,
executor heartbeats20s, worker recovery every30s and polling3s; expired review
work is requeued with a2s delay and a maximum three attempts per stage. Actual
timestamps/attempts decide the result; these intervals are not an SLA. The local
launcher's30s kill timeout is not the hosted300s grace. Startup refuses any
outstanding owned native sandbox, so native cleanup must be confirmed separately.

Source dependencies to pin in a new purpose: `runtime{,-main,-hosted}.ts`,
`runtime-hosted-config.ts`, `review-stage-executor.ts`, `native-sandbox.ts`,
`packages/central/src/specs-runtime-gateway.ts`, `packages/jobs/src/attempt-trace.ts`,
the actual34-36 schema/function/ACL projections, lockfile/image/import/manifest
receipts and current CLI tool sources. The already reviewed CLI source hashes
are routing `1314ff6b...a5ba90`, descriptors `f19e025f...b189b` and core
`90710866ef6867967a4d218e708eb7d3b73476571fac19293f020dd7312290c6`.
Additional installed source pins verified2026-11-01 are
`chunks/chunk-QZEZCUUZ.js` client
`d81dab4301ba45c2d3c786bbca5c29a5027e98976118102de7aa8e99b607d23a`,
`chunks/chunk-YIOT5B5Z.js` generic API executor
`36a7d817e495b18babf431a5380e530f3f6ceb262120bafc56b3d9163aaae661`,
and descriptor `chunks/chunk-HTFQFHPR.js`
`e411a285550953d318f9a81cf83352c58d6167e81d18f01cfeccb80e782f7c54`.
Read-only observation can adapt `controlled-pilot/daemon-runtime.mjs`; its frozen
startup-only log classifier needs a new bounded observer for target-job notices.

## Confirmed transport and rollback boundaries

The installed `commands-core.js` `requestRollback()` calls the resolved project/
deployment rollback POST without a retry override. Its client defaults to three
retries; generic `vercel api` also has no per-command zero-retry option. An outer
exclusive claim prevents another helper invocation, but cannot by itself prevent
those internal attempts. In contrast, exact-instance restart supplies
`retry: {retries: 0}` explicitly. The historical
`controlled-pilot/hosted-web-oauth-env-final31.mjs` already documents and pins this
transport distinction; its old environment-mutating operator must not be replayed.

A separate source-reviewed zero-retry seam is required before the rollback phase.
The current proposal is a finite in-memory transform of only the exact rollback
fetch expression, with original source SHA and one-needle assertions, fixed
resolved project/deployment/path guards and `retry: {retries: 0}`. It must retain
the original CLI authentication/session flow and leave installed CLI files and
credential stores untouched. Node24.18's
[documented synchronous module hooks](https://nodejs.org/download/release/v24.18.0/docs/api/module.html#moduleregisterhooksoptions)
can apply that one-file transform at its original URL; this is source preparation,
not an implemented or executed rollback path. Tests must cover ESM and CommonJS
load callbacks. The actual installed Vercel package declares `type: module` and
its core is ESM with CommonJS `createRequire` internals; do not relabel it as a
CommonJS entry. Module-format handling must preserve the returned original format.

Zero client retries is not exactly one wire request: the unchanged authentication
layer can resend once after an eligible DPoP nonce/time challenge. Record one
logical rollback dispatch with zero network/5xx retries; do not disable auth or
promise a wire-count guarantee. Unknown submission remains read-only reconciliation.
The [CLI rollback timeout](https://vercel.com/docs/cli/rollback#timeout) limits only
waiting, not the provider operation. [Instant Rollback](https://vercel.com/docs/instant-rollback)
also disables automatic assignment of production domains afterward; capture that
expected project-setting effect and require an explicit future promotion rather
than assuming the next deploy automatically takes the alias. Environment/build
snapshots can differ, so A/B compatibility and current configuration remain gates.

Root reported a fresh scoped Vercel-plugin deployment read for6pcN returned403
on2026-11-01. Promotion/rollback plugin tools exist, but that connection is not
currently usable for these project operations. The already authorized CLI remains
the fallback; no new owner connection/configuration is required for source work.
No connector or CLI mutation was performed by this document update.

## Proposed finite sequence

1. Prepare a **new disabled** purpose with immutable source/target manifest,
   separate once-only mutation claims and unknown-outcome readbacks. Reuse the
   emitter's one/dub1/2GiB/300s configuration, existing CLI login and environment
   IDs/targets. For worker B prefer the already admitted immutable daemon/native
   pair; a new deployment can test replacement without rebuilding SDK/native
   images. A rebuilt image instead needs its own compatible native source seal,
   uncached import gate and real digest readbacks; never relabel old receipts.
2. Admit a distinct compatible application source/deployment B before the live
   window, retaining current A as rollback anchor. B is **not yet identified**;
   the next independently required backend release may supply it. Identical
   source redeployment is not a different application-version rollback proof.
   Do not choose old282 just to reintroduce its known guidance bug. Require A/B
   domain/SDK/schema36/OpenAPI/MCP compatibility and permission regression gates;
   no migration or worker-environment change belongs in this experiment.
3. Capture current web/worker/deployment-instance/image identity, native-idle,
   canonical36 static/claim-port/English/M02 baseline, every existing Ready
   version/slides/pins/raw-English/PDF metadata, and Reviewed facts/media/frames.
   Confirm no other eligible active/expired jobs or leased outbox work would be
   touched by the worker's **global** `recover(25)`. Unknown claims block the
   experiment; preserve them rather than expire, cancel or reclaim them manually.
4. Create exactly **one new** ordinary `create_ai_suggestion` request in Dummy
   Pilot Test, using one fresh idempotency key and an existing active role's
   current ID/row_version and bounded source name: `contextual_instruction`, field
   `name`, short neutral instruction, no invented facts. Existing `cast.read`,
   `workspaces.write` and workspace/project write scope remain required, with WF05
   and three suggestion stages; it requires no video/native task or new version.
   Never accept/apply the proposal. A request timeout is reconciled by its key;
   do not create another job. If the source/permission contract denies it, stop.
5. Observe only that job's bounded metadata. Dispatch the claimed worker B
   replacement only while the job is actually queued/running; retain provider
   acceptance/instance timestamps and DB observations on both sides. An optional
   exact-instance restart tests the documented SIGTERM path, with its own claim;
   it does not substitute for B deployment. No polling gate, artificial sleep,
   provider delay or forced lease expiry exists today. If the job finishes too
   quickly, record the timing result as inconclusive and stop; do not silently
   create more jobs or call this an in-flight replacement pass.
6. Observe old-instance exit/new-instance startup, actual B deployment/digest,
   desired1/ready1/alive state and unmodified configuration. Follow the original
   job through natural expiry/recovery or valid completion: new immutable
   attempt ID and dispatch generation where recovery occurred; monotonic event
   sequences, stage order, source fingerprint, actual n8n references and terminal
   outcome. Outbox ACK before interruption may already be committed; recovery
   must enqueue new authority rather than replay that ACK/provider request.
   Retain no lease tokens, callback bodies or transcripts. Bound provider logs
   to actual deployment/instance/job/stage/time; absent provenance withholds
   process-attribution claims. Existing local stale-callback tests remain local;
   do not forge a cloud callback to manufacture evidence.
7. While the same job is still queued/running, promote compatible web B and
   verify its actual alias/API/MCP contract, then use the pinned CLI's existing
   rollback path to A (core source resolves deployment to project before POST
   `/v9/projects/{project}/rollback/{deployment}`). First source-review a new
   exact-project/once-claim wrapper; do not run a generic unchecked rollback.
   If timing cannot overlap both operations, keep that portion unverified.
   Verify alias=A, existing session/permissions and job/suggestion readability,
   known unreadable-job guidance/denials and completed data intact. Owner controls
   any sign-in; accepted OAuth/reconnect need no reconfiguration. Keep A serving
   and the replacement worker healthy; do not undo canonical36 or delete data.

## Evidence, limits and stop criteria

Save distinct before, mutation-return/reconciliation, after and application
rollback receipts. Compare the old Ready/Reviewed/M02 cohort exactly, with
allowed new rows confined to the one suggestion/job/outbox/events/attempts and
normal existing audit/claim activity. A changed job total or unchanged old Ready
pointer alone cannot prove data preservation. No new-version/PDF/media-byte,
semantic, restore, representative-workload or exactly-once provider claim follows.

Proposed observation budget:20min, one job, one worker deployment B, at most one
explicit restart and one web B-to-A cycle. On observing a third stage attempt,
refuse further experiment actions and cancel the exact new job through its
existing authorized API if still possible, then observe cancellation/lease
settlement without editing SQL counters. The global poller can claim a retry
before cancellation arrives; this is not an enforceable two-attempt cap. A provider
request completed before cancellation can still be billed; no hard dollar cap
exists in these controls. With one configured2GiB worker,20min is0.667GiB-hours
of baseline reservation; even a second transient2GiB instance for the full window
would add at most0.667GiB-hours **under that observed two-instance ceiling**.
Stop on extra instances, a third model attempt,20min elapsed or unknown cost;
these are operator bounds, not provider billing guarantees or current prices.

On unknown dispatch, no Ready/identity match, native-cleanup uncertainty,
unrelated active work, lost permission, stale/mis-scoped write or preservation
drift: stop admission, retain claims, reconcile read-only and keep known-good A.
Never delete the pilot, scale globally, disable trace, alter scopes/retention,
touch protected M02 or retry old accepted/failed audit jobs. Recover only the
identified replacement/job through existing authority; escalate a concrete
unresolved provider state. Failed recovery rehearsals and their separately
proved cleanup remain separate; this plan grants no restore36 acceptance.

Next source action: prepare and independently review the separate three-file
zero-retry rollback transport/compiler with synthetic module/fake-client tests;
there is no live runner in that slice. Then prepare the canonical36-aware
worker/job/cohort observers and disabled once-only phase controller. Actual
rollback remains blocked by an identified compatible app B and fresh project,
instance, native-idle, backlog, configuration and preservation prerequisites.
No implementation, execution, new resource or acceptance is supplied by this plan.
