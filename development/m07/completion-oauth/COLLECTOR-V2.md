# Versioned runtime query repair

This new entry repairs the old collector's quoted bare-message query. The
installed normal Vercel CLI 65.8.0 help explicitly rejects quoted bare words
and allows quotes only for field values. The old collector, its tests and
historical failure receipts remain unchanged.

`commandV2` first calls the frozen original `command()` for exact UUID, event
kind, deployment and bounded lookback admission. It changes only argument 13:
`eps.mcp.project_read_succeeded AND <request UUID>` or
`eps.mcp.verified_token AND <returned trace UUID>`. Both terms are unquoted.
No arbitrary query, credential argument, scope change or new provider transport
is admitted. Original `projectBatch()` and `compare()` exports are reused.

Collection still initiates at most two normal CLI reads, with the existing
fixed project/scope, exact supplied deployment, 24-hour maximum lookback,
100-record limit, 30-second timeout and combined 2-MiB stdout/stderr bound per
child. There is no follow, automatic retry or raw output persistence. Exact
summary windows, no excluded intervals/pagination, unique strict event fields,
request-to-trace join and the original 30-second/1-second correlation hold.

The normal observation JSON deliberately retains the original four
`source_seals` and schema, so frozen `compare()` accepts it. These hashes bind
the reused source and product projection; they do not claim that the old
entrypoint performed the collection. A separate exclusive execution receipt
records the actual new collector SHA256, query schema, CLI65.8 entry/help hashes,
initiated-read count and the exact observation path/SHA256, with
`original_entrypoint_executed: false`. A bounded read/projection failure records
an unconfirmed execution receipt with no raw stdout, stderr or exception text.
An observation whose provenance write fails is not a confirmed complete run.

Root must retain its independent J3/deployed-product binding. This source does
not establish actual-Claude expiry/renewal or token rotation by itself. It
never calls an OAuth endpoint, opens a listener, reads Claude stores or changes
sessions. Importing and the focused tests perform no provider calls.

```text
node development/m07/completion-oauth/collect-v2.mjs preview <dpl_ID> <UTC-since-with-milliseconds> <actual-owner-request-UUID>
node development/m07/completion-oauth/collect-v2.mjs collect <same-dpl_ID> <same-since> <same-request-UUID>
node development/m07/completion-oauth/collect-v2.mjs compare <before-observation> <after-observation>
```

Preview verifies the local CLI/source admission and prints safe metadata only.
`compare` is local receipt processing. Root owns any actual collection after
source review; the source author performed no preview/live collection.

Focused RED reproduced the quoted-query defect (2 pass, 1 fail); initial GREEN
passed all 3 tests. Final tests additionally exercise two exact reads, retained
frozen comparison compatibility, source-drift refusal, first-read failure with
no retry and separate closed provenance. They use synthetic log envelopes and
read only the installed CLI's public help source for the grammar regression.

```text
node --test development/m07/completion-oauth/collect-v2.test.mjs
node node_modules/eslint/bin/eslint.js development/m07/completion-oauth/collect-v2.mjs development/m07/completion-oauth/collect-v2.test.mjs --max-warnings 0
```
