# One-query daemon log diagnosis

`daemon-log-shape.mjs` is a root-executed, read-only diagnostic for the existing
`ad0b0a88` daemon observation. It pins that public receipt, the reviewed observer,
and the six installed CLI 65.8.0 source files. Its only CLI invocation repeats
the receipt's exact deployment, instance and original ten-minute window.

```powershell
node development/m07/controlled-pilot/daemon-log-shape.mjs
```

The command has a 30-second deadline, 1 MiB stdout limit, 32 KiB discarded stderr
limit, 100 log-record limit and no helper retry. CLI HTTP retries remain possible.
The original receipt remains unchanged. The new receipt includes only fixed
key/type inventories, fixed identity-match counts, timestamp-shape counts,
allowlisted Node error-code/pattern counts, and exact known JSON event counts.
Unknown key names, message text, arbitrary attributes and raw log hashes are
never persisted. Messages are inspected only in process memory. Failures emit a
fixed error code.

Every result retains `startup_verified: false`. Even an exact startup JSON
message counted in an unbound record supplies diagnosis only. The diagnostic
does not mutate provider configuration, restart a daemon, invoke application
jobs, or establish worker readiness. Root separately observed a missing `ajv`
dependency in the actual local daemon image; a matching cloud error count would
corroborate that cause, and would not prove the replacement image functional.

Author validation used four synthetic pure tests after an actual missing-module
RED, plus scoped ESLint, syntax and whitespace checks. No CLI, provider, real log,
credential or image execution was performed by the author.
