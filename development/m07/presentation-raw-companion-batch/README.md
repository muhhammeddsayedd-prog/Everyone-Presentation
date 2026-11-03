# Raw companion batch candidate (source only)

Actual diagnostic ee38e645 (raw receipt SHA `44e91aa9…`, safe outcome commit
`32ec219`) cancelled at current raw companion body `afe33691…` line35,
called by GEN41fe line64. It had entered capture after returning from the pin
statement. The cancellation stack contained live scope/capability functions.
This establishes the interrupted statement, **not** its dominant component,
per-row call count, total companion cost, or the cost of the later English
capture. Application generation still failed with57014; diagnostic success is
not performance acceptance. Nested intervals are not additive.

## Exact finite candidate

`candidate.py` builds only
`eps.capture_presentation_video_transcripts(uuid)` from sealed build source
`cda17a14…` / body `afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7`.
Three exact replacements, each with an inverse, produce body
**`f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5`**.
Function signature, return type, invoker mode, search path and other definition
attributes remain byte-identical. There is no migration or executing transport.

1. Add two UUID arrays and an inserted-row counter. They hold only each already
   validated `(video_asset_id,candidate_media_id)` pair in original pin order.
2. Replace the loop's two-line INSERT with two ID appends. The complete original
   sorted loop remains: distinct matching source UUID cardinality/casts, exact
   media PK +source-asset predicate, media FOR SHARE, missing/whitespace branch,
   original text and language validation, original hash/value computation, and
   captured count. Validation still precedes **any** raw INSERT. No private text
   or full-media record is copied into a new function-local cache.
3. After the loop, insert the same nine fields from a zipped WITH ORDINALITY pair
   set joined to the exact candidate_media PK/source pair. The held SHARE locks
   prevent other transactions changing/deleting those media rows. Re-reading
   them retains ordinary invoker RLS. The absent-text predicate, nulls, empty
   language array, available text/hash/languages, source row version and
   version.created_at timestamp match the old values. Order is original ordinal;
   no DISTINCT or cross product is introduced. `captured=0` skips INSERT entirely.

The inserted row count must equal the validated count, so a new RLS-visible
subset cannot silently omit a companion. The original final pin-count check,
unchanged English helper invocation, context restore and return follow it.
There is no lower aggregate transcript-byte ceiling, overflow rejection, or text
cache. Two additional UUID arrays grow only with the original loop's finite
video-pin set (two 16-byte identifiers per pin plus normal array overhead),
already derived from the generated version's bounded asset inventory. This is
not a hard process-memory/RSS claim or a new direct-owner row-count limit.

## Fresh authority and observable differences

A fresh `presentation_scope(version.workspace_id,true)` call occurs after the
bulk insert/ROW_COUNT and before the row-count check, including the empty path.
It reuses the entry predicate and existing IMMUTABLE_VERSION error/message.
This deliberately tightens direct legacy/null-English expiry-at-return behavior;
it is not claimed byte-identical at that edge. No authorization result, current
clock, session, grant or GUC is cached. The existing capture-context GUC remains
solely the unchanged INSERT-policy guard and is restored as before.

In the pinned actual metadata, eps_review_owner owns the invoker helper, PUBLIC
execution is revoked, and the sole function-body caller is public GEN. Normal
GEN creates English version1.0, whose unchanged helper entry already makes a
fresh full scope check; direct queued legacy/null-English and empty cases must
still be tested. Generic SNAPSHOT_INVALID503 due to a missing reread row is
**not** classified as a permission denial. Actual revoke/expiry proof must use
causal wait/control evidence plus the fresh scope/native denial.

Batching changes INSERT/constraint/RLS failure timing and READ COMMITTED
statement snapshots. Earlier old-loop rows were tentatively inserted before
later validations; new rows appear together after validation. Operation failure
remains atomic, but exact first-error precedence or concurrent revocation timing
is not claimed identical. No INSERT trigger exists on the raw table in the
pinned metadata; its immutability trigger handles only UPDATE/DELETE. All table
constraints, nine typed columns, RLS policies, owners/grants and source-text
privacy validation remain unchanged. English's four status states and logic
remain entirely in the unchanged helper/policies.

This may reduce raw INSERT statement dispatches while adding one RLS-constrained
PK reread. It does not eliminate per-inserted-row policies or prove fewer live
capability calls. There is no claimed speedup, query plan or under-eight-second
acceptance. No authentication/policy/role relaxation, SECURITY DEFINER addition,
timeout change, or production write is proposed.

## Evidence still required

Source-only five focused checks cover the three inverses, actual PL/pgSQL parse,
unchanged function attributes and original loop/suffix, actual nine-column table
types and trigger/execute facts, zipped ordinal/empty/no-text-cache contracts,
row count +fresh scope ordering, and disabled assembly. The pinned metadata
hash is `12df4e56…`; no private metadata or transcript is copied here.

```powershell
D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe -X utf8 -B development/m07/presentation-raw-companion-batch/test_candidate.py
```

Next requires a separately admitted default-OFF proof: current helperaa1,
GEN41fe, DATA0dba and review wrapper unchanged, substitute only rawafe→f222.
First fresh MCP-large eight-second generation must precede warming or projections.
Retain available old/new snapshot/fingerprint/actual raw+English companion parity,
all four English states, missing/invalid/whitespace/language and association cases,
empty/legacy paths, late fresh-scope expiry/revocation/rollback and full immutable
Ready/pin/source row preservation. Existing incomplete semantic/lock/security
scopes remain open. Restore original4107 +canonical four/config/full clone and
preserve original29/catalogue/global roles/resources/lock. No actual proof run is
authorized by this source package.
