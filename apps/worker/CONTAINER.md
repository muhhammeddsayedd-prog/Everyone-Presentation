# Local document parser container

This is a one-shot Linux parser boundary around the existing fixed stdin/stdout
protocol. It is separate from worker hosting, service authentication, output
storage, durable stage callbacks and n8n orchestration. The library's default
process adapter has not been replaced by a container service.

The base is the locally inspected official Node24.18.0-bookworm-slim
linux/amd64 image, pinned to
`node@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d`.
The source-only build context contains an explicit list of root lock/manifest,
six workspace manifests, six parser modules and the Dockerfile/ignore file.
The harness constructs a regular-file tar from that list; it never submits the
checkout directory, follows source symlinks or reads private configuration.
`.dockerignore` also starts by denying everything. No `.env`, host dependency
directory, media, secret, DB configuration or worker executor source is copied.

The dependency stage uses the exact lock and
`npm ci --omit=dev --workspace @eps/worker --include-workspace-root=false`.
The final stage copies installed production dependencies and parser modules,
not the rest of the workspace. Build-time public dependency downloads require
network access; runtime parsing does not. The retained local image is a build
artifact, not a hosted deployment or reviewed full worker image.

Run from the repository root with the already available local Docker daemon:

```powershell
node tools/test-document-container.mjs
```

The harness supplies no target/file/image overrides. It builds a source-labelled
local image with a full run-UUID tag, then creates separate uniquely labelled
containers. It first requires the fixed local Docker Desktop Linux pipe/context
on Windows, or the standard local Unix socket/default context on Linux. Remote
host/context/TLS overrides are rejected; every daemon operation explicitly pins
that local endpoint. It rechecks context metadata at the end. Runtime limits are:

- UID/GID 1000, read-only root filesystem, no host bind/volume mounts.
- `--network none`, all Linux capabilities dropped, no new privileges.
- 512 MiB memory and equal memory+swap (no additional swap allowance), one CPU,
  a 64-PID limit and 16 MiB `/tmp` tmpfs with noexec/nosuid/nodev.
- Node permissions limited to parser source/dependencies, no ordinary file writes
  or child creation; native addons remain necessary for PDF dependencies.
- A fixed internal 30s `timeout` supervisor plus the host deadline, 256 MiB V8
  old-space and bounded stdout 24 MiB/stderr 64 KiB.
- Docker log driver `none`; parser outputs stay in test-runner memory.

Actual Docker inspection must match those settings and the created image ID,
run nonce and ownership/source labels before execution and before removal.
Cleanup removes only verified containers created in that run. It neither prunes
images/volumes nor enumerates/deletes unrelated containers. The image remains
for review/reproduction. A failed ownership check preserves the target and
records its opaque ID for reconciliation.

Synthetic UTF8/Arabic/BOM, genuine PDF and DOCX bytes enter through stdin only.
The runner checks original hashes, text/evidence offsets and real extraction,
plus corrupt-PDF and legacy-format rejection and owned-container deadline termination.
The 1ms deadline case proves supervisor cleanup mechanics; it is not a claim
that a malicious source consumed 30s or that resource endurance was measured.
Receipts under `tracking/evidence/m02/document-container/` contain source/image
hashes, inspected limits and outcomes, never fixture text or parser payloads.
Build/parser failure details are suppressed rather than serialized.

The [2026-10-28 pinned-endpoint run](../../tracking/evidence/m02/document-container/2026-10-28T20-25-30-385Z-181a29f5.json)
passed all seven cases and removed its seven ownership-verified containers.
The [three synthetic targeting-override checks](../../tracking/evidence/m02/document-container/2026-10-28T20-25-50-772Z-preflight-negatives.json)
passed without contacting a Docker daemon. Earlier receipts remain, including
the two failed DOCX tests caused by the harness treating a `Uint8Array` as a
base64-encoding `Buffer`; that test encoding was corrected before acceptance.

These runtime settings are supplied by the harness: running the image manually
without them does not reproduce this boundary. Container configuration is not
proof against a kernel escape, native-code vulnerability or every resource
attack. No provider request, service key, DB operation, workflow, hosting,
representative-source evaluation or complete M02 acceptance is implied.

Primary references: [official Node Docker best practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
and [Node24.18.0 permissions](https://github.com/nodejs/node/blob/v24.18.0/doc/api/permissions.md),
checked 2026-10-28. They support nonroot/resource-conscious container use; the
actual configuration and parser outcomes require the local receipts above.
