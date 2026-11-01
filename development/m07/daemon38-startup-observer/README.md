# Explicit-select startup readback

Default disabled; source/inert checks run no provider query. The held daemon
operator and every claim remain unchanged. This extension subclasses its Ports
and overrides startup only. Original normal create return, full paused38/source
gates, health freshness, exact ce23 deployment and two old-free inventories remain
required by the unchanged readback orchestration.

Actual bounded RAM diagnosis found every logs-runtime record missing daemonName
and daemonInstanceId. The pinned CLI runtimeSource.select omits both fields; its
separate daemon-tail selects them. Actual records also carry environment="" with
exact target/production attributes. One exact expected startup event was observed
but could not earn bound startup credit from that lossy payload. No raw message,
credential or exception was printed/persisted.

The new read uses the existing pinned fetchEventsPage API contract through normal
CLI65.8 api POST /v1/observability/events. This POST performs a log read, never a
provider mutation. It retains exact owner/project scope, new G6CV deployment,
source daemon, worker and exact dmni_01m6ca4s3fygy6yrdyp0qr6zv7 instance filters.
Its selected fields are runtimeSource.select plus the two existing daemon-tail
identity fields. The fixed window is the first600000ms beginning at that exact
current instance's provider start time; execution requires the entire window to
be historical. No rolling window or old-deployment identity is substituted.

Each returned record must itself carry exact project/deployment/source and actual
daemon/instance identity at top level or attributes, with no contradictory value.
Missing IDs refuse; query filters never supply them. The only normalization drops
an observed empty environment field after exact target/production attributes are
verified. No identity or event is created. The validated API pagination/gap fields
become a typed summary for the unchanged frozen projector. Has-more, cursor,
excluded interval, error, warning, truncation, wrong binding/window or failure
event refuses startup. Only safe closed counts and source/request hashes survive.

CLI input is fixed JSON in stdin; normal scoped CLI owns authentication. Source
never reads its stores or transfers environment values. stdout/stderr stay in RAM
under1MiB/32KiB caps and a30-second deadline. Unknown results stay unconfirmed; no
daemon/provider/SQL mutation or automatic recovery is available here.

```powershell
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/daemon38-startup-observer/test_observe.py
# Root reviews/arms only after peer review; then performs readback once:
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/daemon38-startup-observer/observe.py
```

A Passed receipt is still daemon startup/Ready evidence, not a real Specs job.
Root's separate admitted pin/resume and controlled Specs processing follow.
