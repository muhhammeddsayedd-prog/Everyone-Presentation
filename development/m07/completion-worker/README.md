# Integrated production source: local paired worker images

This package prepares **local OCI artifacts only**, under the existing root
release authorization. It does not authenticate to VCR, upload an image, change
provider configuration, start polling, call SQL/n8n/OpenAI, or deploy anything.
Ordinary image dependency downloads may use network. Existing images, source
contexts, claims and rollback anchors remain untouched.

Main's unchanged `tools/worker-hosting-build.mjs stage` created context
`8b559ebe-1b6c-4741-b371-9498c5855976` with165 source records and seal
`0566342ec367efef328885aac513adeb5a942048ba01c88e1af63e4d636b6730`.
The context includes the integrated production admission/project source and
pinned `@axe-core/playwright4.14.0` package/lock bytes. Only the worker's pruned
production dependency graph enters its runtime install.

The new controller uses the reviewed historical binary checks, bounded local
subprocess capture, OCI archive verifier and import-log parser as mechanisms.
It never calls an old export/upload entrypoint or consumes an old claim. Each
kind gets a new fsynced exclusive claim, output and success pointer within this
new UUID directory. Unknown dispatch retains the claim; it cannot be replayed.
Raw progress stays bounded in memory; public receipts contain only metadata.

Source/context checks cover exact owner UUID/seal, sorted allowlisted files,
matching live/staged bytes, generated Dockerfiles, the complete context inventory,
and six private-value pattern families. No private credential source is opened;
the pattern check is not an exhaustive secret/PII audit. Children receive only
the fixed Windows runtime paths and a fresh `docker-client/config.json` containing
empty `auths`; provider keys, debug/process options and ambient Docker config are
omitted. Docker/Buildx binaries and the reused source mechanisms are checksum-pinned.

Commands from this worktree:

```powershell
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/completion-worker/test_build.py
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/completion-worker/build.py native
# Only after actual native success: emit its runtime manifest into the SAME context.
# Then run the separate new daemon claim:
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/completion-worker/build.py daemon
```

Linux/amd64 exports retain OCI/Zstd bytes, every blob hash, recursive descriptor
sizes, reachable closure, index digest and the unique runtime manifest. No legacy
Docker archive import or recompression substitutes another image identity. The
daemon forces an uncached final UID1000/network-none production import, proven
from its own completed build instruction. Source seals are rechecked afterward.

Registry upload/Ready, hosted native isolation/cleanup, future pin adoption,
worker startup and real jobs remain separate root-owned release evidence.

## Passed local artifacts — 2 November 2026 (Africa/Cairo)

- Native: runtime/index `sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4`;439.030s;633,842,688-byte OCI tar;21 verified blobs.
- Daemon: runtime/index `sha256:2d66eed2c5f584f3f261d2f241062cbb9fa088bbbc32437aed1ce0b6adf2c594`;61.759s;111,158,784-byte OCI tar;18 verified blobs.
- Same-context native manifest SHA256 `a317b0c7398ab12d960271f9d9d8ce98d846ed390a77fc0bb02c50b9b6df9943`. Daemon's actual uncached step22 completed under UID1000:1000/networknone with exit0.
- Both whole-source graphs were revalidated after export. Native/daemon inventories are169/170 context files;165 source records total1,816,882 bytes.
- `prepare_oci.py` copied both complete verified OCI closures into fresh `native-oci`/`daemon-oci` directories under the same run. No archive conversion, recompression or registry action occurred.
- Main's unchanged emitter wrote the exact daemon-only Build Output tree at `deployment/.vercel/output` under this run, using the new daemon digest.

Actual build/export and OCI-copy receipts are in
`tracking/evidence/m07/completion-worker/`. Tar archives, directories and the
exclusive claims stay in Main's ignored `.local/worker-hosting/8b559ebe-1b6c-4741-b371-9498c5855976/`.

Six inert/source guard tests passed **before native dispatch**, after the initial
missing-controller RED (six errors). Their fixed native-context check deliberately
requires the pre-manifest phase; do not rerun it against the finalized context or
edit the executed test/controller to waive that phase. The later actual daemon
export and both preparation receipts verify the finalized matching manifest,
source graph and OCI closures. Those actual receipts retain their exact scopes;
they provide no hosted/runtime acceptance.
