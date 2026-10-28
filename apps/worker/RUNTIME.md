# Local specs worker

`node tools/start-specs-worker.mjs` starts the local Node24 worker. It opens no
HTTP listener, tunnel or public endpoint. Hosting is deferred. Importing the
runtime modules performs no file read, connection, provider request or workflow
publication. Launching is a real operational action, separate from injected tests.

The launcher reads the existing protected provider configuration for
`OPENAI_API_KEY` and the explicitly selected `OPENAI_EXTRACTION_MODEL`. It also
reads the ignored repository-root `.env.worker-runtime.local`, containing exactly:

```
EPS_SPECS_PG_HOST=<reviewed pooler host>
EPS_SPECS_PG_PASSWORD=<dedicated narrow runtime password>
EPS_SPECS_PG_CA_BASE64=<canonical base64 of the trusted PEM CA>
N8N_DISPATCH_URL=<published HTTPS WF01 webhook>
N8N_DISPATCH_SECRET=<dedicated webhook Header Auth secret>
```

Root provisions and reviews those values separately. The runtime file reader
rejects links, unstable files, unexpected fields, missing values and oversized
content. POSIX ownership and owner-only permissions are checked. Windows DACL
protection remains the owner's provisioned boundary; Node metadata does not
attest it. Configuration values never enter stdout, errors, command arguments,
job metadata or browser responses. The child receives an explicit environment
allowlist. It receives no n8n management API key, Supabase service-role key,
ambient database URL or OpenAI endpoint/header override.

The authenticated gateway factory verifies the dedicated database LOGIN and its
narrow authority before polling. The normal runtime uses parameterized PostgreSQL
operations with verified TLS. The separate Docker/psql/TRUST integration proof is
test-only and is never imported here. No user JWT or `SET ROLE` is used.

The serial poller claims one durable outbox row and sends its existing eight-field
`StageReadyEnvelope` to n8n. Every stage requires a real JSON work order from the
configured workflow. The response contains exactly `schema_version`, `event_id`,
`job_id`, `kind`, `stage`, `input_hash`, `correlation_id`, `workflow_execution_id`
and `handler`. Scope must match the sent event. The handler is respectively
`native.prepare_document`, `openai.extract_specs` or `domain.apply_specs`.
The workflow execution ID comes from n8n's actual execution. Generic HTTP200
acknowledgement, missing fields or arbitrary URLs/handlers are rejected.

n8n supports returning a JSON body through its
[Respond to Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook).
This provides outbound request/response orchestration while the worker stays
local. The [execution ID](https://docs.n8n.io/build/code-in-n8n/cookbook/built-in-methods-and-variables-examples/execution.md)
is bound to the stage claim. WF01 receives metadata only, without original text,
provider results, lease credentials or database credentials. Its Header Auth
credential and payload retention settings are configured separately in n8n.

After routing, the worker claims that stage and acknowledges its outbox lease
before costly work. It invokes the actual native parser and strict OpenAI
Responses adapter. Apply uses the durable validated extraction through the
transaction function. Each subsequent stage arrives through a new outbox row
and n8n workflow execution. SQL remains the source of truth for attempts,
backoff, current authority, source epochs and publication guards.

Unknown claims, acknowledgements or callbacks stop costly work and leave
recovery to the durable lease. No immediate provider retry is performed. If a
provider request completed but its result never committed, a later bounded retry
can bill again; this is not an exactly-once provider guarantee. Recovery runs
periodically. A disconnected parent, shutdown IPC message or process signal
aborts polling and current work; the gateway closes after execution settles.
The launcher allows30 seconds before forced process termination. A crash leaves
durable records for subsequent recovery.

Current tests inject the gateway, workflow transport and/or executor. They prove
ordering, strict binding, cancellation/deadlines and no bypass on failed routing.
They make no real provider, database or n8n call. Actual app acceptance requires
the reviewed cloud schema, runtime identity, published WF01, configured worker,
and a source submitted through the signed-in app. The launcher does not enable
pipeline configuration or grant capabilities. File-backed PDF/DOCX and scanned
source acceptance remain separate from the first pasted-text path.
