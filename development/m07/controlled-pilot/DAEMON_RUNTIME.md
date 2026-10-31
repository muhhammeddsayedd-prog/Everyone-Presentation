# Bounded daemon runtime observation

`daemon-runtime.mjs` is a new root-executed, read-only operator. Importing is
inert. The author has used only pure synthetic fixtures and source checks; no
daemon, deployment, credentials, provider logs or private input was accessed.

After the actual reviewed worker deployment exists, root supplies its real ID:

```powershell
node development/m07/controlled-pilot/daemon-runtime.mjs $actualWorkerDeploymentId
```

The ID must come from an actual worker deployment receipt. The operator does
not invent one or deploy/start/stop/restart/scale anything. It fixes team
`team_gboXPxTevpCOZuaA8eY9PmR1`, project
`prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6`, daemon `worker` and technical production
environment. This is the existing owner-controlled staging pilot, not Studio
production acceptance.

It uses the existing isolated CLI65.8.0 `vc.js` and explicit protected global
configuration directory. The CLI entry, daemon/log command source and JSONL
encoder/query metadata modules are hash-pinned before authenticated calls.
Each child receives a minimal system environment, native CLI delegation is
disabled, and no token/PG/OpenAI/n8n/application environment is passed in.
The CLI itself uses its existing authorized login; this helper does not open
credential/configuration files or copy tokens.

At most four CLI commands run within120seconds, each with a30-second parent
deadline: a daemon inspection, at most two instance-specific log queries and
an independent second inspection. stdout is bounded to1MiB and stderr to32KiB
per command. Parent timeout/unknown output produces a generic unconfirmed
receipt; it never retries a command or publishes raw diagnostics. The pinned
CLI may internally retry read requests, so logical command count is not an
exact HTTP request count. Observability log search may use HTTP POST for its
read-only query; no provider configuration or resource mutation is requested.

The daemon context must identify the fixed project/team/production environment
and the supplied deployment ID. Only bounded state, counts, dub1 configuration,
2GiB memory,300-second termination grace, fixed daemon-image references/digests,
instance IDs, alive flags and timestamps are projected. Raw command, liveness
probe headers, environment, actor data, suggested commands and extra config
remain in memory and are discarded.

Log queries use the actual deployment and observed instance IDs, a fixed ten
minute window ending at operator start, at most100 records, JSONL and no
follow/continuation. The fixed query covers top-level or attribute daemon
identity and production scope. Per-record identities, deployment and timestamps
are independently checked. Only exact fixed JSON events are classified:
`specs_worker_started` with `narrow_database_login`/`n8n_required`,
`hosted_worker_unconfirmed`, `hosted_worker_paused` with
`NATIVE_CLEANUP_UNCONFIRMED`, and `hosted_worker_pilot_expired`. Raw messages,
attributes, warning messages, continuation cursors and hashes of them are
never persisted. Unknown messages receive a count, never a copied value.

Selected startup evidence requires stable deployment/image/instance/start
identity across both inspections, one ready/alive current instance with matching
resolved image, and an exact bound startup event in a complete query window.
Gaps, pagination, warnings, truncated/unbound records or a fixed failure event
withhold that evidence. Heartbeat timestamps may advance; they do not replace
instance identity. An empty log window means startup was not observed in this
window, not that the worker never started. Newly started events after the
window end require a later separate read-only observation.

The result is `observed`, not an application PASS. The startup event follows
`verifyStartup` in the reviewed worker source, but by itself does not prove
subsequent polling, Daemon OIDC refresh, native task completion, n8n/OpenAI work,
restart/retry recovery, private-media/core/OAuth flow or endurance. Runtime
image/source graph binding also depends on the separately reviewed build and
deployment receipts. No job retry or DB action is part of this operator.

Primary/source grounding:

- [Vercel Daemon management](https://vercel.com/docs/daemons/managing-daemons)
- [Vercel CLI logs](https://vercel.com/docs/cli/logs)
- Installed official65.8.0 `commands-routing.js`: daemon inspect context,
  production scope, instance fields and instance-ID grammar.
- Installed official65.8.0 `commands-deployments.js` and JSONL/query chunks:
  runtime log records, summary/gaps/pagination and fixed search flags.
- `apps/worker/src/runtime-main.ts`: exact structured startup event emitted
  after startup verification; `runtime-hosted.ts`: exact fixed failure events.

Tests: `node --test development/m07/controlled-pilot/daemon-runtime.test.mjs`.
Pure fixture tests establish metadata/privacy/binding/bounds behavior only.
Root owns actual operator execution and subsequent business acceptance.
