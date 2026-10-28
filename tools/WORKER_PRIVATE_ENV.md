# Private worker configuration

The repository-root `.env.worker.local` is an ignored, local fallback for
`OPENAI_API_KEY`, `OPENAI_EXTRACTION_MODEL`, `N8N_API_KEY` and `N8N_BASE_URL`.
Enter values privately in that file. A nonempty value already set in the server
process takes precedence. Blank fields stay blank; no model is selected for you.
No browser receives this configuration.

`worker-private-env.mjs` only reads and validates configuration when explicitly
called by a private server/worker entry point. Importing it performs no file read,
starts no process and contacts no provider. It does not automatically wire an
extraction pipeline, change a runtime flag or restore the n8n MCP connection.
Provider authentication, model selection and actual workflow execution require
their separate checks. A presence summary establishes only nonempty fields.

The fixed reader accepts at most 16 KiB of UTF8, refuses symlinks, detects file
identity/metadata changes and checks the current owner UID where POSIX exposes
it. It does not verify Windows SID ownership or DACLs, change permissions or
claim an OS secret store. Keep the file private to the intended account. The
loader accepts no filename/path option. Keys have no guessed length/prefix rule;
all selected values must be single-line and NUL-free. `N8N_BASE_URL` must be a
HTTPS tenant origin such as `https://your-instance.app.n8n.cloud`, with no
userinfo, explicit port, non-root path, query or fragment. A root trailing slash
is normalized away.

Returned configuration contains private values. Never print it, hash it into
receipts, expose it through an API or include it in error diagnostics. Use
`workerPrivatePresence` for the four boolean fields when a read-only presence
report is needed. The loader supplies a fixed generic error without the original
exception or source values.

Offline tests use only synthetic source and an injected filesystem:

```powershell
node --test tests/tools/worker-private-env.test.mjs
```

Those tests do not open the actual private file, test credentials or establish
provider/network access. Unknown file fields are ignored; webhook credentials
and workflow callback configuration are outside this four-field loader.

After saving private values, `node tools/inspect_worker_integrations.mjs` performs
only two bounded GETs: OpenAI's model list and one page of existing n8n workflows.
It rejects redirects, limits response size/time, and reports only safe status,
presence and availability booleans/counts. It never logs keys, model configuration
values, workflow nodes/names, provider bodies or source data. A successful read
does not demonstrate model generation, workflow execution or the full pipeline.
It does not modify either provider or choose a model. The documented candidate
used for an availability boolean is currently `gpt-6.1-sol`; its
[official model page](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
lists Structured Outputs. On2026-10-28, the user-selected model passed one real
[synthetic source evaluation](../tracking/evidence/m02/provider-evaluation/README.md)
with the strict result schema and source checks. This establishes one observed
extraction, not representative accuracy or the integrated n8n/worker pipeline.

The request shapes follow [OpenAI's model-list API](https://developers.openai.com/api/reference/resources/models/methods/list)
and [n8n API authentication](https://docs.n8n.io/connect/n8n-api/authentication.md),
checked2026-10-28. The n8n key authenticates management reads through
`X-N8N-API-KEY`; it is separate from workflow credentials, runtime webhook auth
and the MCP connector's connection state. No generated content or workflow is
created by this inspection.
