# Owner-executed native Sandbox probe

`tools/probe-hosted-native.mjs` is a new operator helper, outside the frozen worker image graph. Its author has run only pure tests and syntax checks. It has not minted a token, accessed private CLI configuration, created a Sandbox or called a provider.

The helper admits only the private worker project's `muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:…` reference. It pins team/project IDs, CLI65.8.0 and the patched SDK3.9.1/Zod4.6.7, verifies the complete frozen `0ddf519a…` context, and reads the actual VM's complete source seal before INIT. A historical image from the same repository is refused. The separate web manifest graph is not resealed or used by this worker proof.

After source review, the root operator runs the boundary mode with the actual Ready VCR digest:

```powershell
node --import tsx tools/probe-hosted-native.mjs boundary muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:<actual-digest>
```

Only this CLI invocation sets `VERCEL_CLI_USE_NATIVE_BINARY=0`, the supported65.8.0 opt-out. This keeps the thirty-second token-mint deadline on the Node process itself; no global preference is changed. SDK command-output reads also receive the overall abort signal. `sdk_http_calls` counts actual SDK raw-fetch attempts, including SDK retries, under the240-call cap. One CLI mint command is a logical command count, not a single-wire request claim: CLI network/5xx retries and authentication maintenance may add requests.

The helper privately invokes the fixed local CLI with the authorized fixed global configuration to POST the project's OIDC-token endpoint. The token remains in process memory and a temporary process-only environment value, with the original environment restored afterward. No token goes into arguments, files, receipts, stdout, the image or VM. The response and expected team/project/development claims are checked before SDK use. The authenticated mint channel supplies provenance; local signature verification is explicitly not claimed. Vercel's documented development-token lifetime is twelve hours and the endpoint accepts no requested TTL; the actual bounded TTL is recorded. The helper itself has a ten-minute operation budget, not a claim that it minted a ten-minute token.

Boundary mode attempts one distinct named Sandbox with explicit deny-all egress, no persistence/snapshots/mounts/ports/credentials and one vCPU/2048MB. This is a named-resource bound, not a wire-request or VM-session count. It verifies immutable metadata/session ownership, reads the image's patched source seal, runs the fixed INIT before uploading any input, reads the root-private boundary proof, confirms the image's default control UID0 and attempts fixed DNS/direct-IP connections from UID1000. These attempted connections must fail while the effective provider policy is deny-all. Their failure alone does not independently attribute every network error to the firewall.

INIT requires the image's private bounded tmpfs, dropped native privileges, complete ordinary-filesystem writable/ownership inventory and ten actual write denials. The helper never weakens these checks if the platform does not support them. It records a closed failure phase/code and generated ownership/session identity. No raw SDK error, stderr, private environment or payload is written to the receipt.

Once boundary behavior is understood, the operator can run the separate `smoke` mode using the same digest. It attempts at most ten distinct named resources serially: one boundary Sandbox and nine actual frozen-transport tasks covering plain text/PDF extraction, Poppler raster, a one-second synthetic FFmpeg video, Chromium fit, canonical PDF render/validation and synthetic guest-link export render/validation. Trusted, hash-pinned test generators supply geometric/text fixtures only; the generated MP4 and PDF bytes remain in memory/private VM files. The fake export grant is synthetic and does not prove a real shared-video grant or hosted access flow. No OpenAI, n8n, database, Storage job, real media or Claude client is invoked.

Every attempted name is recorded before create. Cleanup requires observed exact identity, the same session, owned stop/delete, successful empty-list plus exact-name GET404, and an empty snapshot listing. The outer helper does not replay unknown native work. Final observations share a thirty-second cleanup deadline. Unknown identity, snapshot or cleanup retains `.local/m07-pilot/native-probe.lock.json`; do not remove that lock or rerun merely because a command failed. The root operator must reconcile the recorded exact resource first. The helper refuses earlier outstanding native/probe resources without adopting or deleting them.

## SDK transport qualification

Installed SDK3.9.1 wraps its supplied fetch with a default maximum of two retries
(three retry-loop attempts) on network,429 and5xx failures. Supplying a custom
fetch alone does not disable that wrapper. Each create retry sends the same
project/name/body. The [official name contract](https://vercel.com/docs/sandbox/sdk-reference#sandboxcreate)
and [named-Sandbox announcement](https://vercel.com/changelog/vercel-sandboxes-now-allow-unique-customizable-names)
make the name unique within its project; this supports the distinct named-resource
bound. The exact duplicate-create status and successful HTTP idempotent replay
are not independently proven here.

Native/probe commands are non-detached. `Session.runCommand()` selects `wait:true`,
whose command POST explicitly uses `retry:{retries:0}`. This differs from create,
file I/O and fixed-session stop/delete requests, which can inherit the default
retry policy. Detached commands are not used. The public installed source files
below are hashed before token mint; unknown source bytes fail closed:

| SDK3.9.1 public source | SHA256 |
| --- | --- |
| `api-client/base-client.js` | `ce90630c640f0edbb52b1504c2c4c9c5868850106bee05ec53d7cb8d529fdf63` |
| `api-client/with-retry.js` | `4fd9fd7acfb64eed38b65ef92326bc6710767a097cb253e4f44bd68ab089866d` |
| `api-client/api-client.js` | `b1de5c164fe5360a34bfd51c653df63abd37c9cb4d53280d072c751d3cfd5da1` |
| `session.js` | `bf6aee3451ab7622076ec18351462ea71d2db968d4f9e61fd49508e8c468a20c` |
| `sandbox.js` | `314e2889e186c979ce32f381b1a77a8caea32fa246424baddd1c929f7d88b866` |

`Sandbox.withResume()` can attempt a new session after an explicit stopped,
stopping or snapshotting response. The SDK client does not suppress this path
merely because persistence is false. Thus uniqueness of a name is not a proof of
one VM session. The probe records initial, current and cleanup session IDs and
only accepts a passing result when all match. A changed session fails ownership
reconciliation and retains the lock; it is not accepted as equivalent work.
An unknown create can be safely cleaned after exact owned identity is observed,
but lacks successful initial-session evidence and cannot pass the probe.

The frozen launcher verifies its bounded tmpfs before parsing untrusted native
input, including after a possible resume; `persistent:false` disables automatic
snapshots. These remain source facts until actual boundary/native receipts exist.
The qualification changes only this external operator, tests and documentation.
Both image graphs remain frozen at0dd/2e. Previous helper/test/doc bytes are kept
under `tracking/evidence/m07/worker-hosting/source-history/`.

Metadata receipts are additive under `tracking/evidence/m07/worker-hosting/`. These prove only the phases that actually ran. A local project OIDC probe does not prove Daemon token-file refresh, privileged worker polling, real provider orchestration, hosted core/OAuth/MCP, representative-video performance, cost/endurance or production acceptance.

## INIT-only diagnosis

The owner's first boundary run reached the exact image source seal and failed
`boundary_init`; its receipt is
`tracking/evidence/m07/worker-hosting/2026-10-30T23-17-13.787Z-38605be2-hosted-probe.json`.
It recorded same-session owned cleanup, snapshot absence and released lock. That
failure is preserved; it does not establish which internal INIT step failed.

After independent source review, root can run the separate diagnostic mode:

```powershell
node --import tsx tools/probe-hosted-native.mjs diagnose muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:70cf59a0862c939392049977cf1ac2bcc513ad3de4ebdaf7dfce289463278148
```

This mode uses one distinct named resource, a180-second total operation budget,
at most80 raw SDK fetch attempts, one90-second non-detached diagnostic command
and the unchanged30-second independent cleanup/session fences. It uploads no
document, video, fixture, private input or worker/provider configuration.

The new external `native-init-diagnostic.mjs` module emits a fixed trusted Node
program, pinned before token mint. Inside the credential-free VM, it repeats
the original source verification, nonrecursive `/eps-work` mkdir, both exact
tmpfs mounts, fixed-directory lstat/chown/chmod operations, scratch checks,
bounded UID1000 native-boundary command and final boundary-proof write. Mutation
stops at the first failure. Remaining steps are marked skipped; before/after
fixed-path lstat/statfs observations continue read-only. This diagnoses the
original checks and does not weaken or replace them in either image.

Only closed metadata is accepted: root UID/GID, Caps/NNP fields selected from
`/proc/self/status`, fixed-path ownership/mode/type/filesystem-size metadata,
exact step names, status/exit/signal fields, and allowlisted error codes. A
bounded command stderr buffer is classified in VM memory into those codes;
raw stderr, environment files, arbitrary error text, payloads and file contents
are never returned or persisted. The optional successful native-boundary proof
must satisfy its original closed schema. Unexpected fields, paths, statuses or
inconsistent failure ordering reject the diagnostic response before publication.

A valid diagnostic result is labeled `diagnosed`, including when it identifies
a failed INIT step. It is never labeled native-boundary acceptance. Stable
initial/current/cleanup sessions, actual owned deletion and snapshot absence
remain required; uncertainty retains the lock. No frozen0dd/2e source, runtime,
image or configuration is changed by authoring this external mode. Its author
has executed only offline tests and syntax checks; root owns the actual run.

## UID1000 boundary diagnosis

The first diagnostic receipt,
`tracking/evidence/m07/worker-hosting/2026-10-30T23-23-09.770Z-c675c2dd-hosted-probe.json`,
observed successful source/mkdir/mount/hardening/scratch steps and failed at
`native_boundary` with exit1. Root UID0/capabilities and512/384MiB tmpfs were
observed; the failing child condition remained unknown. Its successful owned
cleanup and original source bytes are preserved.

After peer source review, the targeted second diagnostic is:

```powershell
node --import tsx tools/probe-hosted-native.mjs diagnose-boundary muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:70cf59a0862c939392049977cf1ac2bcc513ad3de4ebdaf7dfce289463278148
```

It repeats setup only through scratch validation in one new owned Sandbox.
The original opaque boundary command and final boundary write are explicitly
skipped, with a distinct setup-only protocol. Then a fixed trusted diagnostic
child uses the original CPU20/NPROC64/FD256/core0 and UID1000/GID1000, cleared
groups/capabilities and NNP arguments. A startup marker distinguishes Node
startup failure from later identity, filesystem-audit or denial-check failure.

The child imports the frozen exported `auditNativeFilesystem`, preserving its
traversal, checks and limit. Injected I/O only observes the same lstat/access/
readdir operations and retains first-failure path/category/ownership/mode
metadata. An absolute OS path is published only within a500-character,
40-component ASCII allowlist; otherwise it is null. No file contents, arbitrary
messages, stderr, environment, process command lines or names are published.
The exact ten denial attempts run only after earlier gates pass and remove only
their own unexpected successful random probe file before reporting failure.

Root-side `/proc/*/status` parsing publishes aggregate visible UID1000 process/
thread counts, examined entries and a truncation/uncertainty flag only. It reads
at most4096 visible status entries. This is a namespace observation, not a claim
to know host-global NPROC accounting. A bounded stderr buffer is classified into
allowlisted startup codes such as EAGAIN and discarded inside the VM. The outer
closed validator runs before any detail reaches the receipt.

The same180-second/80-fetch budget, no-input/no-provider-configuration boundary,
SDK retry qualification and stable-session/owned-cleanup fences apply. The
Sandbox lifetime is capped at180seconds, the setup command90seconds and the
deep command60seconds (its child30seconds). Result `diagnosed` remains distinct
from native acceptance. No runtime/image/context change follows from a guessed
cause; actual closed diagnosis evidence must identify it first.

Sources: [project OIDC token endpoint](https://vercel.com/docs/rest-api/projects/generate-a-project-oidc-token), [OIDC claim/lifetime reference](https://vercel.com/docs/oidc/reference), [Sandbox SDK](https://vercel.com/docs/sandbox/sdk-reference).
