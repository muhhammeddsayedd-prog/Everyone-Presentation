# Fresh English34 hosted native smoke preparation

This adapter prepares a new operator for the160-file graph in worker context
`4186fd1e-55c7-4ea5-956e-ad9ad92f64b1`, source
`b3489d64fb1bb207e0a1020fadac3db14490c94ba6d2aedf9c6a358ebb36f181`.
It does not modify or replay the frozen historical tool, release data, receipt or
claim. Preparation and synthetic tests do not call Vercel or start a resource.

The local compiler pins `tools/probe-hosted-native.mjs` to
`84630e42f2e5277fe8865721d00779939802cc73d059bf795cffb9915e5cb3ab`.
It makes bounded, count-one replacements for import relocation, the new release
data/source/context, receipt directory, an exact-image smoke-only admission and a
new permanent image-specific claim. The generated operator retains all original
SDK3.9.1/CLI65.8.0 pins, SDK transport source hashes, token mint bounds, fixture
hashes, source-seal validation, native privilege boundary, network denial,
resource/session ownership, no-snapshot checks, cleanup and lock handling.

The shared `.local/m07-pilot/native-probe.lock.json` continues coordinating all
native probes. Never clear an existing unresolved lock to get past it. A new
image-specific permanent `.local/m07-pilot/native-probe34-<digest>.claim.json`
prevents automatic replay of this fresh smoke purpose. It is created after source
preflight and acquiring that shared lock, before authentication. A failure is
retained. Do not delete the claim to repeat a run.

After the actual new native digest is built and uploaded, the root reviews these
helper bytes and runs the preparation command with the exact digest:

```powershell
node development/m03/native-probe34/compile-native-probe34.mjs "muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:<actual-digest>"
```

This local-only command writes a unique ignored operator plus `execution-plan.json`
under `.local/m03-native-probe34/<uuid>/`. Review the plan, generated operator hash
and paths before root execution. Keep ambient credentials and DEBUG out of logs.
Execution uses the existing operator invocation pattern and fixed SDK/CLI:

```powershell
node --import tsx <generated-operator-path> smoke "muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:<same-actual-digest>"
```

The new exact-image operator admits only `smoke`: one boundary resource plus nine
public synthetic native jobs (plain text, PDF text, PDF raster, video, review fit,
canonical render/validate and guest-variant render/validate). Maximum distinct
named resources10, HTTP calls240, overall time600seconds. SDK retry and possible
auto-resume caveats are unchanged; this does not claim an exact wire/VM count.
Initial/current/cleanup session equality is mandatory. Stop/delete targets must
have the exact observed identity, and final name absence plus snapshot absence
must be verified for every resource before releasing the shared lock.

Actual receipts go under `tracking/evidence/m03/native-probe34/` and retain the
original schema. Added fields are `probe34_admission` (base/release/compiler
hashes, exact image/source/mode) and `permanent_probe34_claim_created:true`.
`admit-native-probe34.mjs` provides a pure validator for the release controller.
It requires the new source/image/release, passed UID/GID65432 boundary and network
proofs, all nine tasks, four substantive presentation proofs, exactly ten named
resources with matching session IDs and complete cleanup/snapshot absence, plus
released shared lock. Its return explicitly gives no real-job/OpenAI/n8n/app,
guest-playback, English transcript or immutable-version acceptance.

Source-only preparation verification:

```powershell
node --test development/m03/native-probe34/native-probe34.test.mjs
```

Five tests exercise compiler drift/seam rejection, unchanged safety code, safe
module import, new-source validation and receipt failure/admission rules. These
are deterministic fixtures, not a hosted smoke result. Root execution remains
pending until an actual image digest and a fresh verified receipt exist.
