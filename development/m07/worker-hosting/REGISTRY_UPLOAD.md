# Native image upload checkpoint

The patched native source remains `0ddf519a...` in the frozen `2e551bb2...`
context. Docker completed the build. Its three upload attempts failed with
transport/TLS, HTTP502 and DNS errors. No Sandbox or worker was started by these
attempts. [Build observation](../../../tracking/evidence/m07/worker-hosting/2026-10-30-native-build-upload-failure.json).

The local OCI index is
`sha256:5a41cf3c8801b2891d378b3f7caef44c3fb7af184ceb89e7f4e44c3d865ac697`.
Its Linux amd64 manifest is
`sha256:70cf59a0862c939392049977cf1ac2bcc513ad3de4ebdaf7dfce289463278148`.
The image has16 zstd layers; the largest is353,068,623 compressed bytes.
The full export is633,582,592 bytes. This is local build evidence, not registry
readiness or working native processing.

## Standalone uploader

Root downloaded official regctl0.11.7 Windows amd64 into ignored project tooling.
The13,152,768-byte release has SHA256
`70f195ff4923082340738c796880864f66a296e6c5d3296bf743310653ad761f`.
[Official release](https://github.com/regclient/regclient/releases/tag/v0.11.7).

[Offline preparation](prepare-upload-oci.py) copies only validated OCI metadata
and blobs into a fresh owned directory. Actual execution verified all22 blob
hashes and recursive descriptor sizes, including the original index/attestation
closure. It never decompresses/recompresses image layers or uses the legacy
Docker manifest. Legacy Docker-tar import can change the image digest; the
standalone controller therefore uses an explicit OCI-directory digest.

[Upload controller](upload-native-oci.mjs) pins both the release binary and the
existing Docker credential helper. It uses the same fixed private VCR repository
and tag, with no platform filter or conversion. Success requires the remote tag
digest to equal the original index. A separate Vercel metadata read and eligible
runtime-manifest Ready state are still required before a Sandbox probe.

The first authenticated standalone attempt reached its15-minute deadline.
[Closed receipt](../../../tracking/evidence/m07/worker-hosting/2026-10-30T22-34-48.865Z-6527957a-oci-transfer.json).
The subsequent authenticated tag read returned404. Root then started the same
immutable copy with a30-minute operation deadline; its result is pending at this
checkpoint. This deadline bounds an upload operation, not the owner-controlled
pilot's duration. Reconcile current processes and registry state before another
copy. No business job or paid native resource is retried by image upload.

Root subsequently stopped that second standalone uploader after verifying its
executable, parent and exact creation times. The parent remained alive to perform
the final digest read and write an
[unconfirmed receipt](../../../tracking/evidence/m07/worker-hosting/2026-10-30T22-58-46.855Z-fa3fe3a1-oci-transfer.json).
No app, worker, business job or unrelated process was stopped.

The current attempt uses an isolated per-host regctl configuration with
`blobChunk:16777216` and `blobMax:16777216`. Both settings are needed: positive
`blobMax` skips the initial monolithic upload for larger blobs, while `blobChunk`
sets the PATCH chunk size. The server may advertise a larger minimum. Completion
uses an empty PUT with the whole original blob digest. TLS, credentials, layer
bytes and the index remain unchanged. This is a transport recovery attempt;
neither a VCR-specific120-second limit nor successful chunk behavior is claimed.
[Pinned implementation](https://github.com/regclient/regclient/blob/v0.11.7/scheme/reg/blob.go#L214-L244).

## Credential-store discovery

Docker Desktop selected its credential store even with the separate protected
`DOCKER_CONFIG`. The config contains an empty VCR auth entry plus `credsStore`;
the token is not stored as an inline auth value there. Global Docker config-file
preservation does not prove credential-store preservation.

An empty child PATH initially prevented regctl from finding the helper. The
corrected child PATH contains only the existing Docker resources/bin directory.
Its `docker-credential-desktop.exe` has a valid Docker Inc signature and SHA256
`2856e226b29ae2a9c67dd2419adbd527c03c34a84fc82454856b61f555c2b3b5`.
Regctl calls the helper internally; root does not directly extract its secrets.
The isolated public regctl config enables Docker credentials and disables
Docker certificate import. No token enters arguments, source, the app or
metadata receipts. Raw diagnostics are not persisted by the upload controller.
