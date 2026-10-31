# Owner-executed native Sandbox probe

`tools/probe-hosted-native.mjs` is a new operator helper, outside the frozen worker image graph. Its author has run only pure tests and syntax checks. It has not minted a token, accessed private CLI configuration, created a Sandbox or called a provider.

The helper admits only the private worker project's `muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:…` reference. It pins team/project IDs, CLI65.8.0 and the patched SDK3.9.1/Zod4.6.7, verifies the complete frozen `0ddf519a…` context, and reads the actual VM's complete source seal before INIT. A historical image from the same repository is refused. The separate web manifest graph is not resealed or used by this worker proof.

After source review, the root operator runs the boundary mode with the actual Ready VCR digest:

```powershell
node --import tsx tools/probe-hosted-native.mjs boundary muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:<actual-digest>
```

Only this CLI invocation sets `VERCEL_CLI_USE_NATIVE_BINARY=0`, the supported65.8.0 opt-out. This keeps the thirty-second token-mint deadline on the Node process itself; no global preference is changed. SDK command-output reads also receive the overall abort signal. HTTP counts in receipts describe SDK calls; the single CLI mint command is counted separately.

The helper privately invokes the fixed local CLI with the authorized fixed global configuration to POST the project's OIDC-token endpoint. The token remains in process memory and a temporary process-only environment value, with the original environment restored afterward. No token goes into arguments, files, receipts, stdout, the image or VM. The response and expected team/project/development claims are checked before SDK use. The authenticated mint channel supplies provenance; local signature verification is explicitly not claimed. Vercel's documented development-token lifetime is twelve hours and the endpoint accepts no requested TTL; the actual bounded TTL is recorded. The helper itself has a ten-minute operation budget, not a claim that it minted a ten-minute token.

Boundary mode creates at most one VM with explicit deny-all egress, no persistence/snapshots/mounts/ports/credentials and one vCPU/2048MB. It verifies immutable metadata/session ownership, reads the image's patched source seal, runs the fixed INIT before uploading any input, reads the root-private boundary proof, confirms the image's default control UID0 and attempts fixed DNS/direct-IP connections from UID1000. These attempted connections must fail while the effective provider policy is deny-all. Their failure alone does not independently attribute every network error to the firewall.

INIT requires the image's private bounded tmpfs, dropped native privileges, complete ordinary-filesystem writable/ownership inventory and ten actual write denials. The helper never weakens these checks if the platform does not support them. It records a closed failure phase/code and generated ownership/session identity. No raw SDK error, stderr, private environment or payload is written to the receipt.

Once boundary behavior is understood, the operator can run the separate `smoke` mode using the same digest. It creates at most ten serial VMs total: one boundary VM and nine actual frozen-transport tasks covering plain text/PDF extraction, Poppler raster, a one-second synthetic FFmpeg video, Chromium fit, canonical PDF render/validation and synthetic guest-link export render/validation. Trusted, hash-pinned test generators supply geometric/text fixtures only; the generated MP4 and PDF bytes remain in memory/private VM files. The fake export grant is synthetic and does not prove a real shared-video grant or hosted access flow. No OpenAI, n8n, database, Storage job, real media or Claude client is invoked.

Every attempted VM name is recorded before create. Cleanup requires observed exact identity, the same session, owned stop/delete, successful empty-list plus exact-name GET404, and an empty snapshot listing. Lost replies are observed without replaying native work. Final observations share a thirty-second cleanup deadline. Unknown identity, snapshot or cleanup retains `.local/m07-pilot/native-probe.lock.json`; do not remove that lock or rerun merely because a command failed. The root operator must reconcile the recorded exact resource first. The helper refuses earlier outstanding native/probe resources without adopting or deleting them.

Metadata receipts are additive under `tracking/evidence/m07/worker-hosting/`. These prove only the phases that actually ran. A local project OIDC probe does not prove Daemon token-file refresh, privileged worker polling, real provider orchestration, hosted core/OAuth/MCP, representative-video performance, cost/endurance or production acceptance.

Sources: [project OIDC token endpoint](https://vercel.com/docs/rest-api/projects/generate-a-project-oidc-token), [OIDC claim/lifetime reference](https://vercel.com/docs/oidc/reference), [Sandbox SDK](https://vercel.com/docs/sandbox/sdk-reference).
