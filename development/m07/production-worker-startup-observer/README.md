# Production worker startup observer

New data-only purpose; `OBSERVE_ENABLED=False`. It has no provider/auth transport,
credential access, deployment code or worker graph changes. Root's separately
reviewed rollout adapter must check the enabled flag before its normal CLI65.8
read-only observability POST. No historical operator main or claim is invoked.

Import `observe.py` and call `request(scope)`, then `startup(scope,payload,now)`.
Scope contains actual `deployment`, actual `instance` with ID/start milliseconds,
and exact `bindings` keys `source_sha256`, `native_digest`, `daemon_digest`,
`manifest_sha256`. Optional `window` must equal the first600000ms starting at the
instance start; startup refuses until all ten minutes have elapsed. No rolling
or shortened window or historical fixed instance/deployment is substituted.

The adapter proves source056/native46/daemon2d/manifest a317 from current provider
deployment/daemon/environment metadata before and after the observation. These
are labelled `caller_checked_bindings`; log messages do not attest OCI/source
identity. The observer independently requires the fixed worker project plus the
actual deployment/daemon/instance on every returned record. A filter's values
cannot replace absent/conflicting returned identity.

POST `request(scope)` to the exported endpoint using the exported reason header.
The explicit22-field select retains provider identity and timestamp metadata.
Only an empty top-level environment is removed, after exact production target
attributes are proven. Missing/foreign/conflicting identity or production scope,
out-of-window/out-of-order/missing timestamps, truncated records, warning/error
levels, API warnings/errors/excluded intervals and any pagination are refused.
Every record is inspected; none is filtered away to obtain acceptance.

The pinned existing pure `projectRuntimeLogs` helper runs locally with scrubbed
environment and bounded input/output. Startup requires the exact worker_started
authentication/orchestration contract, complete window, zero unbound/truncated/
warning/error events, and no paused/expired/unconfirmed/cleanup/start failure.
Other correctly bound platform records may appear. There is no fixed23-record
gate:23 belongs to a dated historical receipt. Any complete bounded page with
the required records is evaluated by the same rules. Raw messages/cursors/config
are never returned or persisted. No business processing/OIDC refresh/endurance
acceptance follows from startup alone.

```powershell
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/production-worker-startup-observer/test_observe.py
```

Seven synthetic checks pass using the actual pinned local projector. They cover
different complete record counts1/7/23/31, dynamic IDs, all four artifact caller
bindings, disabled entry without stdin access, exact query/window, per-record
identity/attributes/timestamps, API completeness, failure events and required
startup-message bindings. This is local parser/control acceptance only. No new
production deployment/instance has been selected or queried by this purpose.
