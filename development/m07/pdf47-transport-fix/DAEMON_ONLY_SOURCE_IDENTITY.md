# Source-only independent daemon/native provenance

The PDF47 fix changes `openai-specs.ts` in daemon90, with no intersection in
native54. The serving full165 native source context056/5339 and image46 remain
valid historical artifacts. The current daemon configuration nevertheless
verifies its entire filesystem against the native artifact source hash, so a
new daemon165 source cannot simply be combined with that old native manifest.
No packaging/configuration change or deployment has run.

## Recommended correction

Represent and verify two identities explicitly, without a custom module loader
or an alternate execution overlay:

1. **Daemon full source identity.** An image-baked strict daemon source descriptor
   binds the new full sparse source manifest. Startup validates all listed files,
   including the actual changed Specs module, against the new daemon identity.
   It must not claim that the daemon source remains056.
2. **Native artifact identity.** Keep the native manifest's image digest, native
   source hash, protocol and region bound to that artifact's original exported
   source/build provenance. Its `source_sha256` continues to mean the native
   artifact source, not the current daemon source. Native startup inside the
   microVM still verifies the full source seal baked into that native image.
3. **Exact compatibility identity.** A separate image-baked, fixed-schema
   descriptor binds that native artifact's complete source manifest and the
   exact native runtime dependency closure/build-input records. The daemon
   checks each native dependency it actually uses against those records. Require
   identical entrypoints, resolved module set and source/emitted-code hashes,
   every literal dynamic import, package manifests/lock/dependency resolution,
   native Dockerfile/base/tool installation contract, schemas/templates/fonts
   and other native runtime assets. Unknown imports or an incomplete record
   refuse. The descriptor is not a caller-supplied compatibility declaration.
4. Bind all three descriptors to the normal immutable source/build/release
   records. There is no arbitrary image/path/configuration option, env preload,
   source override, network lookup, ignored changed field or silent fallback.
   Missing/mismatched provenance stops before worker polling or native work.

The smallest implementation should adapt the existing shared configuration and
source verification routines plus the current build-manifest emitter and their
focused tests. Keep the public native manifest shape and all existing process,
UID/filesystem/network/configuration checks where possible. Do not duplicate the
native admission implementation in a daemon-only bootstrap merely to avoid a
build. Actual file ownership/diff is a later Root-reviewed source slice.

## Consequence for this first correction

`native-sandbox.ts` and `native-source-seal.ts` are both in the measured native54
closure. Correcting their provenance semantics is a legitimate native dependency
change. Therefore the first release containing this shared verifier correction
requires a new native build as well as a new daemon build. This is justified by
those actual verifier dependency changes, not by the PDF47 module or by a full165
packaging hash alone. Do not make an artificial native edit to trigger a rebuild.

Recompute the closure across **all** proposed code/build/asset changes before
choosing the images to build. Module count alone is insufficient: a changed
reachable module matters even when the set still has54 entries. Preserve image46
and its original manifests as the rollback/provenance anchor until a reviewed
new native artifact exists. No new native image is implied by this proposal.

After this correction, a later daemon-only patch may retain its already verified
native image only when its entire native dependency/build-input identity remains
exact. The daemon's new full source identity and the retained native artifact's
older full source identity can truthfully differ. Both remain visible; neither
is relabelled as the other.

## Source and local verification before a release

- Reuse the current code-only private-family scan and exact native source/build
  provenance. Never copy runtime secrets/configuration into either context.
- Pure negatives cover wrong artifact/source hashes, altered native dependency
  or lock/build input, unknown modules, changed entrypoints, arbitrary paths,
  missing/extra descriptor keys and a daemon source falsely labelled as native.
- Verify the actual emitted daemon entry and native entry closures independently.
  Run normal native configuration/source-seal tests and the six Specs SDK-error
  regressions with no provider calls.
- A later owned local build/operation proof must exercise the complete unchanged
  native admission and actual source identities. Reuse no consumed build/deploy
  purpose or claim; new artifact identities need a new finite release purpose.

Root reviews the design before implementation. No native rebuild, environment
write, provider processing or production retry is authorized by this document.
