# AT-074 retained execution metadata access

The official n8n plugin was tried first with `includeData:false` for the exact
historical failed render execution31520/WF03 and successful scan31515/WF02.
Both requests returned connector internal errors. The safe observation is
`tracking/evidence/m07/operator-trace-live34/2026-10-31T17-02-23.709Z-connector-metadata.json`.
No node data, workflow edit, execution, retry or private credential access occurred.

The root reviewed and executed the exact fallback `execution-metadata.mjs` once
at17:04:52 UTC. Both fixed execution reads returned HTTP404, with zero metadata
records. Actual safe receipt:
`tracking/evidence/m07/operator-trace-live34/2026-10-31T17-04-52.565Z-direct-metadata.json`.
This establishes that these exact historical executions could not be retrieved
through that metadata-only request. It does not identify a retention, deletion
or permission cause. No such cause is inferred from the404 status.

The fallback reuses the source-pinned existing `.env.worker.local` loader with ambient
credential/base-URL overrides disabled, then makes exactly two GET requests to
the configured Cloud instance. It never contacts OpenAI or modifies n8n. Requests
are restricted to those two retained execution IDs with `includeData=false`,
redirects disabled,15-second deadlines and a64KiB response bound. A permanent
local claim prevents automatic replay. Unexpected node/workflow/custom payload
groups, response identity mismatch or unsafe metadata fail closed; raw bodies,
errors, credentials, URL and tracing fields never enter receipts.

The official [Executions API reference](https://docs.n8n.io/connect/n8n-api/executions/)
documents the metadata-only GET flag. This preparation does not assume the
configured instance has retained either execution. A404 is recorded as not
found; it does not prove a particular retention/credential cause. The historical
failed render job later succeeded after its separately authorized recovery.
Metadata alone cannot reconstruct its original detailed failure cause.

The following historical invocation was completed once. Its permanent claim is
retained; **do not replay it**:

```powershell
node development/m07/operator-trace-live34/execution-metadata.mjs
```

Four pure synthetic tests (no config read or network):

```powershell
node --test development/m07/operator-trace-live34/execution-metadata.test.mjs
```

AT-074 remains partial until the actual new English job and an evidenced failed
real-service job have the required complete correlation. This helper never
grants acceptance merely because metadata or an endpoint is reachable.

Next concrete action: after the controlled English scan exists, obtain its actual
job/attempt and workflow execution IDs from the durable authenticated workflow
path. Prepare a fresh purpose-bound metadata observer for those exact IDs; do not
substitute one of these missing historical executions or request node payloads.
No new provider job, workflow change, retry, sign-in or consent is part of this
access check. The passed owner Claude connection remains unchanged.
