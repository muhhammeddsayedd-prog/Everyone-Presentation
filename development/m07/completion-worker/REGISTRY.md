# Fresh paired worker registry purpose — disabled for Root review

The paired local artifacts are committed at `e72716e`. This separate controller
is **not armed** (`REGISTRY_ENABLED=False`). Author tests and source inspection
perform no login, credential-helper call, private-file creation, registry copy,
provider GET or deployment. Root explicitly requested review before authentication
or upload; this document adds no human approval gate to the authorized release.

## Exact bindings

- Context/run: `8b559ebe-1b6c-4741-b371-9498c5855976`;165 records; graph `0566342ec367efef328885aac513adeb5a942048ba01c88e1af63e4d636b6730`.
- Native runtime/index: `sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4`.
- Daemon runtime/index: `sha256:2d66eed2c5f584f3f261d2f241062cbb9fa088bbbc32437aed1ce0b6adf2c594`.
- Native manifest SHA256: `a317b0c7398ab12d960271f9d9d8ce98d846ed390a77fc0bb02c50b9b6df9943`.
- Existing worker project `prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6`, team `team_gboXPxTevpCOZuaA8eY9PmR1`.
- Existing private native repository `repo_OpIvBNiZ8vPVROs68HxcMb39W6yz`; daemon repository `repo_4pE99mGA4WLDm9q9wUqA56Qd5p9K`.
- New target tags are `vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/{native,daemon}:completion-8b559ebe`. No old tag/image is overwritten.

The controller consumes the original Recovery-worktree build source/receipts and
Main's existing prepared OCI directories. Keep that original worktree available;
do not relocate its source-sealed build controller/tests or edit completed inputs.
No historical export, registry state function, `main`, consumed claim or AT069
rollback source is executed. Only immutable pure validators, bounded subprocess
capture, streaming file hashes, exact metadata projections, raw-manifest digest
validation and the protected file/DACL helpers are reused.

## Proposed finite commands after Root review

Run from `D:/Everyone/Presentation/Everyone-Presentation-Studio-Recovery` with
Main's existing isolated interpreter:

```powershell
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/completion-worker/test_registry.py
# Root arms only this new registry source after its review.
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/completion-worker/registry.py prepare native
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/completion-worker/registry.py refresh native
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/completion-worker/registry.py copy native
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/completion-worker/registry.py ready native
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/completion-worker/registry.py prepare daemon
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/completion-worker/registry.py refresh daemon
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B development/m07/completion-worker/registry.py copy daemon
```

`prepare` revalidates current/staged source, actual passed build pointers and all
prepared OCI blob bytes. It creates only the new task-owned private configuration
and phase claim; the image closures are not copied/recompressed again. A protected
owner marker binds the new directory to run/source/project/team. Existing
directories must already have that exact marker and safe ACL before reuse.

`refresh` invokes the existing **Vercel CLI65.8.0** command:
`vcr login docker --project <fixed-project> --format json`, with the established
scope/global-config arguments. The CLI owns normal sign-in/session handling and
sends its project-scoped credential directly to the ordinary Docker Desktop
helper. The controller never opens an Auth store, extracts a token, invokes a
manual helper `get`, or places credentials in arguments/output. This normal login
may update the helper's opaque VCR entry; no global credential-store preservation
is claimed. Both exact private repository IDs/ownership are checked before and
afterward, along with a known immutable native-manifest GET. Closed successful
login metadata and its exact claim hash are required before copy admission.

`copy` invokes pinned regctl0.11.7 with only the verified `ocidir://...@sha256:...`
source and the fixed new tag. Normal process return plus two equal independent
index/runtime raw-body digest readbacks and unchanged project/repository metadata
are required for Passed. The16MiB `blobChunk`/`blobMax` configuration retains the
reviewed transport settings; server minima may override it and no TLS fix is
claimed. TLS verification stays enabled.

`ready native` independently GETs the existing native repository and its bounded
images list (`limit=50`, no pagination following). It requires the exact new
runtime manifest, Linux/amd64 and Ready. It does not start a Sandbox or establish
daemon Ready/startup. The daemon has separate registry digest/metadata acceptance;
its deployed runtime acceptance remains Root's subsequent release work.

Every mutating phase has its own exclusive fsynced claim before dispatch. No
automatic outer login/copy retry occurs. Unknown results retain claims. Use
`refresh-readback <kind>` or `readback <kind>` only to reconcile with GETs, never
to resubmit. Successful readback cannot invent an absent original normal-return
marker. CLI authentication maintenance and internal transport retries remain
possible; no exact wire-request count is asserted.

## Private configuration and source pins

Only `Main/.local/completion-worker-registry/8b559ebe-1b6c-4741-b371-9498c5855976/`
is created. The root and Docker-config directory require current-owner/SYSTEM-only
FullControl protected DACLs. Claims/return/config files use the existing strict
protected-file creator. Docker's routing-only `config.json` may instead inherit
the exact two-trustee parent ACL after Docker replaces it; no other file receives
that exception. Its only values are `credsStore:desktop` and empty VCR auth
descriptors. Regctl uses the normal helper internally and imports no Docker certs.

Node24, Docker/Buildx, regctl, Docker Desktop helper, PowerShell, CLI65.8.0 public
chunks, pure helper dependencies, new controller/tests/docs and actual build
receipts/OCI bytes are pinned/revalidated. The child environment drops ambient
provider tokens, DEBUG, process options and arbitrary Docker/regctl configuration.
Raw stdout/stderr stay bounded in RAM. Receipts contain safe metadata, hashes,
result flags and fixed failure codes. No job, database, app/worker configuration
mutation, deployment or production acceptance is supplied by this package.
