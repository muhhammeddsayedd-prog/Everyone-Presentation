# M07 bounded synthetic native workload

This measures **local native technical workload**, not a representative
200-video scan through Supabase, n8n and OpenAI. No production worker, database,
provider credentials, hosting or real personal media participates. It does not
close AT-060 or AT-068.

## Reproduce within the same authorization

```powershell
node --test tools/m07-workload.test.mjs
node --test tools/m07-workload-acceptance.test.mjs
node --import tsx tools/m07-workload-local.mjs
```

The diagnostic runner requires no already-running `eps-media` containers and
takes its own `.local/m07-workload-native.lock`. It uses the existing reviewed
media image by immutable image ID and the unchanged `prepareVideoIsolated`
implementation. It limits native calls to two, gives each call at most 30 seconds,
stops admission after 14 minutes and reserves one minute for draining/cleanup
within a 15-minute overall budget. This is a workstation diagnostic limit, not a
new product file limit or operating SLA.

The fixture generator creates 200 separate files from one 0.32-second 160×90 H264
FFmpeg `testsrc2` clip with no audio. Distinct legal MP4 `free` boxes give the
files independent hashes. The underlying footage has no representative visual,
codec, duration, orientation or speech diversity. One file is deliberately
truncated and one has an unsupported MIME type. Six valid files request full
native preparation; the other eligible files request actual native probing.

The first consumer child drains 40 files and exits. A new Node process reads the
persisted metadata checkpoint and consumes the remaining files. Completed files
must retain exactly one attempt across that restart. An incomplete running
checkpoint becomes `unconfirmed` and is never automatically replayed. This
demonstration uses a drained restart, not a crash or physical interruption.

One explicit transient failure is injected **before native execution**, then
retried once. Actual native decode/type failures remain terminal while unrelated
successes remain usable. The collector records safe codes, attempt durations,
admission delay, input/attempted bytes, retries and peak in-flight work. It never
serializes arbitrary exception bodies, transcripts, file bytes or credentials.
Protected synthetic files and checkpoints stay in `.local/m07-workload/<run-id>`;
public metadata receipts are under `tracking/evidence/m07/workload/`.

## Observed local result

The [actual native run](../../tracking/evidence/m07/workload/2026-10-30T10-59-36-690Z-6557c962.json)
completed in **250775 ms** on 2026-10-30. The values include local Docker overhead;
they do not establish an operating SLA.

| Measurement | Observed value |
| --- | --- |
| Input files / total bytes | 200 distinct file hashes / 1,420,766 bytes |
| Successful / expected terminal failures | 198 / 2 |
| Actual native requests / full-preparation subset | 199 / 6 |
| Attempts / explicit pre-native retries | 201 / 1 |
| Peak in-flight / fresh drained process restarts | 2 / 1 |
| Attempt duration p50 / p95 / maximum | 2429 / 2835 / 3079 ms |
| Successful attempt duration p50 / p95 | 2430 / 2840 ms |
| Local admission delay p50 / p95 | 123639 / 235457 ms |
| Pending / running / unconfirmed at finish | 0 / 0 / 0 |

The truncated file failed native decoding. The unsupported MIME file was rejected
before native execution. The injected transient attempt made no native call and
succeeded independently on its one retry. Six valid files completed full native
preparation; remaining eligible calls were probes. Child PIDs 52424 and 49284 prove
a fresh consumer process, with no repeated work among the first 40 successes.
Unknown dispatch acknowledgement and completed-stage replay each made zero
executor calls in the separate closed transport control. The seed container was
removed, the workload lock released and a fresh read-only observation found zero
running media containers.

An independent review found that the initial harness classifier needed exact
outcome counts to prevent an unexpected extra failure being hidden among the two
expected failures. Five new assessor tests passed after a missing-module RED.
The current new harness imports that stricter classifier. Its original native-run
bytes remain [preserved](workload-source-history/provenance.json); the original
receipt is not relabelled as a native run of the current harness.

The [offline exact-outcomes overlay](../../tracking/evidence/m07/workload/exact-outcomes-overlay.json)
passes the saved checkpoint through the current classifier: exactly 198 successes,
two expected failures, 199 native requests, six full preparations and the required
restart/retry counters. It verifies all unchanged native/worker source seals and
the preserved original harness. It makes zero new native/provider/DB calls. The
combined pure collector/assessor suite passes 12 tests. Existing upload-metadata
checks remain a separate five-test result. This correction changes result
classification only; it does not change native or production-worker behavior.

## Existing boundaries exercised separately

The runner calls the unchanged `processNextSpecsStage` with injected closed
database/router/executor ports. Unknown dispatch acknowledgement must stop before
the executor; a completed-stage replay must also skip it. This is a real runtime
control-path test with substituted transport, not real Supabase queue or n8n
acceptance and not native throughput evidence.

The dataset also includes a file assembled from a persisted local byte offset
and verified prefix/full checksums. That local append demonstration is explicitly
not a Storage/TUS upload test. The existing application metadata boundaries were
tested separately with:

```powershell
node tools/run-tests.mjs tests/server/candidate-transfer-intent.test.ts tests/server/candidate-upload-recovery.test.ts
```

Those five checks pass: offsets/stable reservation keys survive restoration,
credentials/bytes are excluded, exact reselection metadata is required, unsupported
types are rejected, and malformed/forged/oversize recovery entries fail. They do
not establish real resumable byte transport or AT-055 acceptance.

## Actual runtime defaults

`runSpecsWorker` currently runs **one serial loop per process**, claims one
outbox event, polls every 3000 ms and recovers at most 25 jobs every 30000 ms. Stage
heartbeats default to 20 seconds and SQL leases to 90 seconds. Native media code
allows at most two concurrent calls, but this does not turn the existing serial
production worker into two active scans. The benchmark's two-call diagnostic
scheduler is separate and does not change runtime configuration.

Earlier workflow documentation proposes four active scans/two heavy tasks/two
PDF renders, while CONFIGURATION proposes two video tasks/one PDF render. Those
are unmeasured proposals. The actual serial implementation and the measured
local diagnostic scope govern this evidence. Root operational tracking owns the
final configuration/runbook reconciliation.

## Verification and remaining limits

Seven new focused collector tests passed after an initial missing-module RED:
backpressure, partial failure/retry budget, unknown-outcome fencing, drained
restart without replay, uncertain running checkpoints, deadline admission stop,
and quantile/byte/redaction accounting. Existing worker/native sources and the
earlier recovery28 evidence are unchanged.

Native measurements are recorded by the actual run receipt, including bounded
partial completion if the budget expires. Queue delay means this diagnostic
scheduler's admission delay. No cloud queue, upload network, web/API latency,
real provider duration/cost, representative video capacity, frame-quality result,
endurance, deployed restart or rollback is inferred. No provider cost estimate
is produced from zero provider calls.
