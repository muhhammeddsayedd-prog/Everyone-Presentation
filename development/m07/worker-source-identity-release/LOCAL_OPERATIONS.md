# Implemented first-release operations

Current 2026-11-02T19:48:34Z: runbbf4b5da passed both local exports, private
registry copies/readbacks/Ready and admitted native9-task/10-resource cleanup.
Build/registry/probe were deliberately armed; consumed claims remain. Production
controller/startup remain disabled; no production SQL/env/worker deployment occurred.
See [artifact admission](../../../tracking/evidence/m07/worker-source-identity-release/bbf4b5da-artifact-admission.json).

The preparation text below is historical.

All five execution flags are false. No source archive, input profile, stage,
image, registry copy, native task, SQL phase or deployment exists for this new
purpose. The code is ready for source review. Root can arm and run the local
build subset independently of the later owned SQL proof and cloud phases.

The only shared implementation entrypoints are the existing sealed OCI
`bounded`, `archive_proof`, `import_gate`, archive validator, private ACL helper,
CLI argument builder, normal CLI response projector and existing native probe.
The old build/registry/probe/rollout mains are never invoked. No monkeypatch,
custom loader, alternate authentication, legacy image or rollback transport is
introduced.

## Inputs and source admission

After final Main product review, use a fresh UUID and a protected immutable
uncompressed Git archive. The selected commit/tree remain unset in the template.
The source object contains commit/tree, archive path/SHA, ordered packed file
rows, full packed-source SHA, both graph SHAs and an actual quality receipt ref.
`build.py` checks the Git archive's commit, exact local Git tree, every selected
archive/Main byte and each corresponding tested Git blob. It admits the actual
quality receipt format and observed test count; a later docs-only commit is
labelled carried forward only when every selected tested byte is equal.

Populate protected Main `.local/worker-source-identity-release/build-inputs.json`
from `build-inputs.template.json`. All paths are Main-scoped. The code-only
`workerContextFiles`, `workerNativeGraph` and `workerDaemonGraph` exports provide
the ordered source inventory and graph hashes; source selection is not staging.
Root's independent library pin check must match the newly merged emitter70158c41.

## Local stage and exports

Only `BUILD_ENABLED` is needed for this subset. Run one action at a time using
the normal Main Python, with no argument containing credentials:

```powershell
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/worker-source-identity-release/build.py stage
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/worker-source-identity-release/build.py native-export
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/worker-source-identity-release/build.py manifest
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/worker-source-identity-release/build.py daemon-export
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/worker-source-identity-release/build.py native-oci
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/worker-source-identity-release/build.py daemon-oci
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/worker-source-identity-release/build.py emit
```

Stage records the actual emitter-created build UUID. Native export uses the
existing pinned Docker/buildx, auth-free Docker config, linux/amd64, bounded1800s
process/output and full OCI archive proof. The native image contains its own
complete artifact source seal. Manifest emission binds the actual native
digest, then daemon export runs with no-cache and the existing final UID1000,
network-free import gate. The generated compatibility descriptor and daemon
source seal are outside the packed-source hash, avoiding circular self-hashes.
Both staged graphs are rederived from actual staged bytes. Daemon build inputs
include Dockerfile.daemon plus full shared non-code hashes; native graph remains
independent of daemon-Docker-only edits under the same emitter.

Each operation has its own permanent exclusive claim and a separate normal
marker. On unknown export outcome, retain all files and use only the corresponding
`native-export-readback` or `daemon-export-readback` action. A valid archive is an
observation; it cannot invent a missing normal build return. No automatic replay.
Build pins exclude later registry/probe/controller flags and the separately
owned SQL proof. They retain every actual local build dependency and selected
product byte. No source/model/runtime/configuration change can use that exclusion.

The context scan reports six actual token/private-key pattern families and zero
hits. It does not claim that ten private inputs were opened or that the old
fourteen-family private-value comparison ran.

## Separate registry and native phases

Registry requires its own reviewed `REGISTRY_ENABLED` arming. The CLI supports
`registry.py prepare|refresh|refresh-readback|copy|readback|ready native|daemon`.
Prepare both kinds, refresh normal CLI/Desktop registry auth once, then copy and
read back each exact OCI digest. Same CLI65.8 saved login, regctl0.11.7, Desktop
credential helper and bounded normal transport are retained. There is no token
extraction. Private configuration uses the existing ACL mechanism. One shared
refresh claim, per-kind copy claims, normal records and two exact remote reads
are required. Unknown readback never repairs a normal marker or resubmits.
Ready is read-only actual private-repository/linux/amd64/digest admission.

With a passed native Ready ref, fill protected `native-inputs.json` from its
template. `native_probe.py prepare` requires its own reviewed `PROBE_ENABLED`
arming and emits only new private release/operator/admission modules and a
public plan. Exact inverse checks bind every change to the frozen existing probe
and admission sources. The only seams are data, image, source count/pins, paths,
default-off smoke admission and a fresh permanent claim. The normal CLI mint,
bounded SDK transport, nine tasks, ten named resources,240HTTP/600s budgets,
UID/network, per-resource session equality and full absence/lock cleanup remain
unchanged. Preparation performs no task or token call. Root runs the returned
operator once through normal tsx, then admits its actual receipt with
`native_probe.py admit` and closed protected `native-receipt-inputs.json` refs
`{receipt,plan,release}`. The pure admission re-reads original public JSON bytes,
preserving frozen JSON property order across the Python/Node boundary.

## Later production gate

Fill the full `inputs.json` only after all actual artifacts and the separately
owned SQL40 proof pass. `controller.py` and `startup.py` remain disabled until
their separate source review. Provider admission verifies the original copy
claims/normal records, full current build/source/probe pins, accepted40 receipt
and a fresh protected76-table checkpoint, including full non-null audit reasons.
Its prepare/pause/env/deploy/ready/pin/resume operations remain separate.
The first10minute window uses actual deployment/instance identity with complete
unpaginated logs and the actual source-identity event; no historical23 count.

The old Cp/native46/056/a317 artifacts stay untouched. Native cleanup evidence
is the exact new probe absence plus the actual daemon boot global-idle assertion;
no independent new client-session inventory is claimed. Future app/provider
acceptance is separate. No AT069 action, equivalent rollback transport or unwind
operation is compiled or exposed here.
