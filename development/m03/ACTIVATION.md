# Fixed local candidate activation

These tools are prepared for root-controlled execution. Authoring, compilation
and five offline negative tests do not enable the pipeline. No activation SQL or
private flag mutation was executed while developing them.

`tools/configure-candidate-pipeline.py` accepts a **basename only** from
`tracking/evidence/cloud-candidate-pipeline-reconciliation/`. First run:

```powershell
.\.venv-skills\Scripts\python.exe tools/configure-candidate-pipeline.py --dry-run --receipt <passed-reconciliation-basename.json>
```

The default action is also dry-run. It uses only fixed metadata SELECTs, validates
the exact 17-version history and sealed migration, checks the separately proved
at-apply preservation and attested later UI changes, then takes two identical
fresh snapshots. Configuration must be pristine/disabled with zero active
candidate jobs and zero unexpired open candidate uploads. The captured fresh
state includes current authorized business data; it does not reuse an outdated
empty-library baseline.

After reviewing that successful receipt, root explicitly runs the same command
with `--enable` instead of `--dry-run`. A matching dry-run younger than 15 minutes
and unchanged fresh state are mandatory. The fixed SQL changes only
`eps.candidate_asset_config.enabled`, `transcription_model='gpt-transcribe'` and
`extraction_model='gpt-6.1-sol'`. It independently checks the exact history and
pristine singleton under a row lock. Fresh readback must match the expected
configuration and every other catalog, runtime, business hash/count and setting.
No schema, ACL, identity, native limit, bucket, provider, n8n or credential change
occurs. A dispatched outcome leaves `.local/candidate-runtime/cloud-enable.claim.json`;
an uncertain result blocks a repeat mutator and requires read-only reconciliation.

`tools/configure-candidate-runtime.py` separately accepts the **basename only** of
that passed `*-enable.json` receipt under `tracking/evidence/m03/candidate-activation/`.
Run its `--dry-run --receipt <cloud-enable-basename.json>` before an explicit
`--enable` using the same receipt. It verifies the protected Windows owner/SYSTEM
file, exact native image and model pair, the existing published WF02 journal and
its unchanged dispatch secret, and the cloud enablement proof. Dry-run creates
only a protected local preflight metadata record. Enable replaces just
`EPS_CANDIDATE_MEDIA_ENABLED=false` with `true`, preserving every other private
byte, and records a protected non-retryable claim. It never prints credentials,
starts a worker/listener, calls a provider or changes cloud configuration.

The root must separately configure the server's verified environment upload cap
(`CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES=52428800` for the observed current global
limit) before enabling web uploads/relaunching. The app/native/DB target remains
256MiB. Neither activation helper changes the provider plan or global Storage
setting. Hosting remains deferred.
