# Fresh English worker registry path

The completed 4186 native build reached all 27 steps and failed at registry blob
HEAD with 403. That proves registry denial; it does not distinguish expiry from
wrong project scope or missing access. The CLI session and Docker registry
credential are separate. No credential value is opened by these helpers.

Official [VCR authentication](https://vercel.com/docs/container-registry/getting-started)
and [CLI reference](https://vercel.com/docs/container-registry/cli-reference)
document project-scoped OIDC credentials valid for 12 hours. The installed,
checksum-pinned CLI65.8.0 follows that path: POST the chosen project token endpoint,
then send the token directly to `docker login` via stdin using username `oidc`.
The controller supplies exact worker project/team, the existing protected
DOCKER_CONFIG and absolute Docker binary directory. It strips DEBUG, ambient
tokens and target overrides; it never extracts a token or reads helper secrets.

Root reviews/runs:

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-image34/test_refresh.py
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-image34/refresh-vcr.py inspect
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-image34/refresh-vcr.py refresh
node --test development/m03/english-image34/native-ready.test.mjs
node development/m03/english-image34/native-ready.mjs
```

`inspect` GETs only the fixed worker project and native repository. `refresh`
retains a once-only claim before the standard CLI login, accepts only its exact
public success response, then checks unchanged metadata and a read of the known
old native manifest using Docker. The read proves registry read access, not push
permission. On timeout/unknown outcome retain the claim; inspect state before a
new, separately recorded recovery. No automatic repeated mint/login occurs.

The readiness observer performs only two GETs against the existing private native
repository/images, limit50, with bounded stdout/stderr and deadlines. It keeps the
existing runtime-state receipt shape required by native_admission.py, without
querying any historical web deployment. A pagination cursor is discarded, not
saved or followed. Actual new runtime digest Ready/amd64/linux still must appear.

## Cached image continuation

The first build wrapper exited125 before BuildKit because its minimal environment
omitted Windows `ProgramFiles`; Docker therefore could not discover its installed
Buildx plugin. The exact read-only parser reproduction returns the same109-byte
`unknown flag: --builder` error. Adding only ProgramFiles restores Buildx discovery.
The old wrapper, failed receipt and claim remain immutable. V2 imports its frozen
bytes, adds that ordinary system path and validates the installed signed plugin's
SHA/version before claiming. It uses a fresh tag and separate claim directory:

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-image34/test_build_v2.py
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-image34/build-image-v2.py native
node development/m03/english-image34/native-ready.mjs
# Root freezes the actual native manifest into the same4186 source context.
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-image34/build-image-v2.py daemon
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-image34/daemon-proof.py
```

Both modes use exact160files, explicit Docker Desktop Linux pipe, same credential
store and Zstd OCI exporter, a30-minute operation deadline and bounded RAM logs.
They require Docker metadata's index digest to match two raw registry reads; the
Linux/amd64 runtime digest is selected from that actual index. Daemon mode also
requires an uncached completed import of the full production graph under final
UID1000 with network none. The GET-only daemon-proof assembler combines actual
successful build receipts with the matching private daemon runtime Ready metadata
into the exact `ready_image_and_import_gate_observed` admission shape. None of
these results proves deployed polling, native boundary, an English job or app UI.

After refresh/root review, root can perform a fresh-purpose cached build/push and
admit its actual digest. OCI export/standalone transport is an alternative only
if fresh scoped registry evidence warrants it. Earlier upload controllers,
artifacts and claims stay frozen. No build, push, refresh or cloud read has been
performed by the author merely by preparing this source.
