# Current38 Specs metadata audit

Default disabled; author tests never run SQL/provider processing. Fill inputs.json
from inputs.template.json only after actual new ce23 Ready/old absence and normal
50082 resume, plus the normal new synthetic project/workspace. It reuses only
the existing canonical bounded read transport and pure grouping/admission helpers;
no historical observer main, consumed claim or old795 validator is replayed.

Before submitting Specs, Root reviews/arms then runs audit.py before. This captures
protected M02, historical failed136 (job/events/attempts/outbox/stage payloads),
Reviewed25a3 row/media/frame hashes and existing Ready versions/slides/pins/raw and
English transcript/export hashes. No personal facts or source text are published.
The whole paused/current schema is not frozen: only current38 static permissions,
OAuth/control contract is checked against actual resumed state. New project,
workspace, specs, roles, slots, jobs and events may legitimately appear.

After submission run audit.py after <strict-new-job-UUID>. It rejects protected
M02/historical136 IDs, binds the new job to the configured synthetic workspace,
and emits at most100 safe attempts/events/outbox rows per group. n8n attempt refs
remain distinct from the latest job ref. Receipt applied/stale booleans are
projected rather than raw event receipts. OpenAI requested/resolved models,
request/response IDs and validated token usage come only from a stored successful
extract_specs result.metadata; failed extraction may have none. No usage/cost is
inferred. Preservation compares old rows while permitting new unrelated rows.

Entry points after review and Root arming:

```powershell
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/specs-worker38-audit/test_audit.py
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/specs-worker38-audit/audit.py before
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/specs-worker38-audit/audit.py after <new-job-uuid>
```

The new worker separately emits specs_stage_processing_failed with exact job,
attempt, stage, correlation, error_kind, closed code, HTTP status and req_ ID.
This log precedes callback confirmation and does not establish durable failure.
Use the separately reviewed explicit-select runtime API observer transport if
that additional log is needed; bind the returned project/deployment/daemon/instance
and exact job/attempt before publishing its allowlisted metadata. Never print
raw log messages, exceptions, source, prompts, URLs, tokens or provider bodies.
This DB audit makes no claim about having observed that separate runtime event.
