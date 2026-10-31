# Fixed pilot job operator trace

This read-only helper answers which canonical stages ran, which attempts failed,
whether outbox delivery finished, and which scoped audit/request UUIDs remain.
It reads exactly three previously authorized hosted jobs by fixed ID and kind.
Specs and video retain their independently known workspace UUID `86936940…`.
The render's separate workspace `098d5b48-42a3-475b-b562-735c9eafce80` is now
pinned from the actual read-only [three-job observation](../../../tracking/evidence/m07/operator-trace/2026-10-31T14-25-58-545789Z-f91a4e59-job-trace.json).
Every job requires its exact independently observed workspace.
It does not start, retry, cancel or modify any job. The protected M02
job is inspected only through an exact-state boolean.

From the repository root, review the pinned SQL and run the offline checks:

```powershell
python -X utf8 -B -m unittest discover -s development/m07/operator-trace -p "test_*.py"
python -X utf8 -B development/m07/operator-trace/read_trace.py preview
```

The reviewed operator may then run `read_trace.py collect`. It uses the existing
Supabase CLI session, pinned CLI version 2.122.0 and fixed project ref
`pyibofyctwnqpvktepse`; linked-target and canonical33 history checks fail closed.
It dispatches an exclusive owned SQL snapshot under `.local/m07-operator-trace/`
with a UUID directory, owner marker, regular-file/path checks and matching hash
before and after CLI execution. The editable source path is never dispatched.
The snapshot is retained and named in the receipt. The helper does not inspect
or print credentials or acting-user tokens. Raw CLI output
stays bounded in RAM; only a strictly validated closed projection is saved to
`tracking/evidence/m07/operator-trace/`. Any failure prints only
`OPERATOR_TRACE_UNCONFIRMED`. A dispatched collection that fails validation also
saves a closed failure receipt identifying its local phase, with no partial job
data or raw exception. There is no automatic retry.

Job rows retain only UUIDs, closed status/stage/error enums, counts, UTC times
and digit-only n8n execution IDs. Non-UUID correlation IDs are withheld as null.
Audit client type is declared metadata, never proof of the caller's identity or
authority. Events retain attempt UUID, sequence and status, not callback payloads
or causes. Outbox data is aggregate delivery counts. Source SQL SHA256 identifies
the query file; no private input, content or payload digest is collected.

Each job has at most 100 recent events and 50 recent audit entries, ordered into
a timeline. Totals and exact truncation flags expose omissions. A null workflow
ID or request UUID is unavailable correlation, not permission to reconstruct it.
An unknown job error is the fixed `UNCLASSIFIED_ERROR` sentinel. The query's error
JSON access is restricted to mapping the known `code` field into a closed enum.

The original observations remain separate:

- [Video success](../../../tracking/evidence/m07/controlled-pilot/2026-10-31-hosted-video-provider-metadata.json),
  observed 2026-10-31T01:21:02.806909+00:00, job `fa8593ca-80c2-4cb3-8bcc-0e357ffbf7f2`, n8n 31515.
- [Specs success](../../../tracking/evidence/m07/controlled-pilot/2026-10-31-hosted-specs-provider-metadata.json),
  observed 2026-10-31T02:01:51.008061+00:00, job `35dcef5a-4717-4cdf-8cef-85f6940d0aec`, n8n 31523.
- [Earlier render failure](../../../tracking/evidence/m07/controlled-pilot/2026-10-31-hosted-selection-failure.json),
  observed 2026-10-31T01:28:31.724227+00:00, job `7ca22801-2040-40df-87fc-84a82fffb6c7`.
- [Later ready observation](../../../tracking/evidence/m07/controlled-pilot/2026-10-31-hosted-selection-ready.json),
  observed 2026-10-31T02:47:27.415268+00:00, same job after its authorized retry.

A current success does not relabel the historical failure. Retained job events
show failed validations but do not preserve their original error causes after
retry. The earlier failure snapshot records `DEPENDENCY_UNAVAILABLE`; the prior
[file-limit diagnostic](../worker-hosting/NATIVE_FILE_SIZE_LIMITS.md) has its own
bounded evidence. Do not infer a more specific cause from these status events.

AT-074 remains partial. n8n execution 31515 metadata previously returned 404;
workflow save-success/save-error settings are `none`, and the connector currently
returns an internal error. This projection does not restore missing execution
history or prove complete worker/n8n/provider tracing, an actionable producer
error, or full release acceptance. Historical worker/deployment attribution stays
with each source receipt.

The first collector/query assumed all three jobs used the specs/video workspace.
Root's read-only execution returned fewer than three rows and was refused by the
projection guard. This was a query-scope assumption, not a pipeline failure. The
original collector (`6213f0af`) and query (`676610be`) are preserved byte-for-byte
in `source-history/`; their refused observation receives no successful trace
credit. V2 then observed all three fixed jobs and established the render's actual
workspace, without widening the job set. V2 query `ef36e2e8` and collector
`f8e03950` are also frozen in `source-history/`. V3 tightens the render's workspace
to that observation; the V2 receipt remains an observation of its original query.
