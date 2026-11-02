# Separate daemon and native source identities

Source implementation only. No image build, registry operation, deployment,
provider request or existing release-controller replay is included. The native
46 artifact and its original source/receipts remain historical rollback evidence.

The hosted daemon verifies three fixed image-baked JSON files in addition to the
unchanged six-field native manifest. `daemon-source.json` seals every file in the
current sparse context. `native-source.json` retains the native artifact's
original complete sparse-context seal. `native-compatibility.json` binds both
full source hashes, the raw native manifest hash and the native dependency/build
graph. Generated files are outside the source inventory; neither the descriptor
nor a manifest contains its own hash. The native supervisor independently keeps
verifying its complete original artifact seal inside the native VM. It does not
load or depend on the daemon compatibility descriptor.

Hosted production and controlled-pilot startup require the existing
`EPS_NATIVE_MANIFEST_SHA256` plus two public digests:
`EPS_DAEMON_SOURCE_SHA256` and `EPS_NATIVE_COMPATIBILITY_SHA256`. These are hashes,
not path/image overrides. Local Docker mode is unchanged. Current private-key
denials, scoped OIDC, fixed native image, deny-all network, no persistence,
dedicated native UID and unknown-cleanup handling remain in place. A cached
configuration refuses changed pins. The safe `hosted_worker_source_identity`
startup event reports daemon full source, native full source, native graph,
manifest and compatibility hashes separately. A future rollout observer/release
receipt must bind those actual values; the old consumed observers are unchanged.

The existing sparse-context emitter uses TypeScript's ordinary in-memory type
erasure and syntax tree, without executing application modules or adding a
loader. It follows static imports/exports and every literal dynamic import or
`require`; missing or computed edges refuse admission. Four fixed native process
roots include the supervisor, boundary, task runner and image identity verifier.
The graph records emitted-JavaScript hashes as a static audit, not as a claim that
these are TSX's runtime output bytes. Exact source bytes, pinned Node/Docker
contracts, full package lock, package manifests and compiler/generator identity
remain authoritative build inputs. External package identities resolve through
the lock's ordinary ancestor `node_modules` search. All non-code inputs enter the
native compatibility comparison, including schemas, templates, fonts, brand
assets and the complete native Docker/tool contract. The daemon and native
dependency stages and Node base must match exactly.

The emitter rederives the complete current graph before accepting a descriptor.
It refuses a wrong native graph, changed native code, lock/build inputs, assets,
dependency contract or descriptor. These verifier edits themselves change the
native executable closure: the first release needs a new native image and a new
daemon image. Reusing native46 for this first change is unsupported. Later
daemon-only changes can retain that new native image only when the complete
native graph, exact native source rows and all native build inputs still match.

The existing commands remain source emitters; none upload or deploy. A later
separately authorized build uses this ordering:

1. `node tools/worker-hosting-build.mjs stage` creates a new owned UUID context,
   both full source seals, and source/graph provenance.
2. Build the new native artifact from that exact context through the normal
   reviewed image build path. The emitter does not itself prove the image build.
3. `node tools/worker-hosting-build.mjs manifest <run> <immutable-native-ref>`
   emits the unchanged public manifest, compatibility descriptor and native
   artifact provenance. It reports all public identity hashes.
4. Build the daemon from that exact context and emit its normal daemon output
   with `node tools/worker-hosting-build.mjs emit <run> <immutable-daemon-ref>`.

For a future daemon-only change, stage a new context and use
`node tools/worker-hosting-build.mjs reuse-native <new-run> <original-native-run>`
instead of building another native artifact. Both arguments must be existing
owned UUID directories under the fixed worker-hosting root. The original native
run must have complete new-format artifact/source provenance, and both graphs
must rederive and match. No arbitrary file, image selector, legacy fallback,
overlay or chained adoption is accepted. Generated outputs are exclusive;
partial/unknown phases require inspection and a new owned run, not replay.

The compatibility tests are offline source/descriptor checks. They establish no
production health, hosted startup, registry availability, native rebuild,
network isolation or new live native-operation acceptance. Those later checks
must bind the actual immutable builds and distinct source identities.
