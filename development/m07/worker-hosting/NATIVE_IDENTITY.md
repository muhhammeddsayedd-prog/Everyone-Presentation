# Dedicated native identity correction

The actual credential-free diagnostic
`tracking/evidence/m07/worker-hosting/2026-10-30T23-29-19.047Z-7fa2e7d9-hosted-probe.json`
observed UID/GID1000 with zero effective/bounding capabilities and NNP enabled.
The filesystem audit then rejected `/run/vercel/share`, a provider-managed
UID/GID1000 directory with mode0750. Setup/tmpfs checks and owned cleanup passed.
This identifies a UID collision; it is not successful native acceptance.

Native parsing/rendering now has fixed UID/GID65432 (`eps-native`). The new
`native-identity.mjs` shares its strict identity predicate, setpriv arguments and
closed boundary-proof check across launcher, boundary and task scripts. The
daemon remains UID1000 and the image's trusted control process remains root.
Local Docker transports keep their existing identities. No provider bridge
ownership, mode or audit exclusion is introduced.

The native Dockerfile reserves the new identity after dependency/APT/Chromium
layers. Before creating an account, it requires both numeric and named passwd/
group lookups to report absence, and completes a bounded ordinary-image path
inventory rejecting either UID65432 or GID65432 ownership. Kernel proc/sys/dev
trees are excluded; unreadable directories, unknown lookup failures and budget
exhaustion fail the build. No partial inventory is accepted.

The account is system, locked, nologin, no-home and no-log-init, with HOME `/tmp`.
[Upstream shadow's useradd](https://github.com/shadow-maint/shadow/blob/master/src/useradd.c)
suppresses mailbox creation for system accounts. A second complete ownership
scan after account creation independently rejects any new native-owned mailbox,
home or other image path. No guessed spool deletion or permission repair is used.
Actual image build/readback remains the proof of those account semantics.

At runtime, all ordinary filesystem ownership/write checks, zero capabilities,
NNP, cleared supplementary groups, CPU/NPROC/FD/output limits, bounded tmpfs and
the ten write denials remain enforced. The fixture reproducing bridge0750 now
passes only while the dedicated native identity cannot write; a writable bridge
or dedicated-native-owned path still fails. A UID1000 proof is rejected.

The coherent replacement graph overlays exactly these paths onto the preserved
patched0dd/2e context and retains its original dependency graph:

- `apps/worker/src/native-identity.mjs` (new)
- `apps/worker/src/native-sandbox-launch.mjs`
- `apps/worker/src/native-sandbox-boundary.mjs`
- `apps/worker/src/native-sandbox-task.mjs`
- `apps/worker/Dockerfile.native-sandbox`

The dedicated staging operator is owned separately. Neither the old150-file
graph, its image or historical receipts is edited. Old probe/diagnostic helpers
remain explicitly pinned to their original0dd/UID1000 graph until a distinct
reviewed current probe is prepared for the new source seal. The author has run
only local tests/source checks; root owns builds, provider operations and the
new actual boundary/native proof. No private media, provider jobs, real-service
acceptance or cost/endurance claim follows from these tests.
