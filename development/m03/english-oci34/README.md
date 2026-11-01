# Separate OCI export and standalone transport

Root confirmed that the completed V2 build failed during registry blob HEAD TLS
negotiation. No HTTP rejection, expired credentials or upload-size/chunk limit was
proved. This is a distinct transport attempt using the previously successful
regctl configuration, not a claim that 16-MiB chunking fixes TLS. Original failed
controllers, claims and receipts remain intact.

The author ran only synthetic archive/command tests and local vendor CLI help.
No real export, upload, credential refresh, cloud query or deployment was run.
`oci.py` and `export.py` are frozen independently so root can export while the
separate `transfer.py` is completed/reviewed. Tests/docs are outside that export
execution closure. No previous V2 success pointer is created or modified.

Root commands, in order:

```powershell
$env:DEBUG=$null
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-oci34/test_oci.py
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-oci34/export.py native
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-oci34/transfer.py copy native
```

The local exporter binds run4186/sourceb348 and all160 exact source files. It
uses the existing pinned Docker/Buildx with the ProgramFiles discovery correction
and an OCI tar destination; no push is requested. Every tar entry, blob SHA256,
recursive descriptor size, index, runtime config and linux/amd64 selection is
checked before explicit copying. External descriptor URLs, links, traversal,
legacy Docker manifests and unreachable blobs are refused. Index and runtime
digests come from the actual new export, not an earlier failed image.

`layers_recompressed:false` means the verifier/uploader does not transform bytes
**after** that OCI export. The Docker OCI exporter itself explicitly uses
force-compression with zstd level3; it can produce different compressed layers,
attestations and digests from an earlier Docker build. No cross-export digest
equality is assumed.

The standalone copier uses checksum-pinned regctl0.11.7 and the existing Docker
Desktop helper through the isolated DOCKER_CONFIG. It opens no credential store,
passes no token, and creates a new public-only regctl config with both
`blobChunk:16777216` and `blobMax:16777216`. Positive blobMax bypasses large
monolithic sends; blobChunk sets PATCH size, subject to server minimums. TLS stays
enabled; Docker certificate import stays disabled as in the historical config.

Export and copy each have a separate permanent claim. The copy invokes regctl
once with an explicit `ocidir://...@<index-digest>`, without platform conversion.
Two independent remote raw-index **and raw-runtime** reads must hash to the exact
exported digests. Only a normally completed zero-exit export, complete recursive
closure, normal zero-exit copy and both matching readbacks produce a passed
transfer receipt and `.local/m03-english-oci34/native-build.success.json` pointer.
The pure `oci.load_success(kind)` delegate rechecks receipt hashes, retained
claims/process proof and execution-source bindings before the pipeline accepts it.

If upload returns but a read fails, `transfer.py readback native` performs only
read-only reconciliation; never repeat `copy` or overwrite its claim. Timeout or
nonzero copy remains unconfirmed even if some remote bytes exist. Metadata-only
heartbeats and a closed TLS/DNS/HTTP/timeout error code preserve diagnostic stage
without saving raw error lines, URLs, headers or credentials.

Keep the native context without a baked native manifest until its transfer is
confirmed. Root can then emit the manifest using the actual native runtime
digest, and use the same independent operations for the daemon:

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-oci34/export.py daemon
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-oci34/transfer.py copy daemon
```

Daemon export uses no cache so its existing final UID1000/network-none import
executes and is recorded as uncached. Both image tags are
`english34-oci-4186fd1e` in their existing private native/daemon repositories.
Actual daemon receipts preserve the baked manifest hash and import gate. Separate
Ready metadata, native smoke, manifest/pin adoption, daemon deployment and real
English job/app/guest/version proof are still required. No registry Ready,
Sandbox operation, worker processing or English acceptance is claimed here.
