# English companion batch candidate (source only)

Actual9ed4ca6c (raw SHA9ad492f5…, safe outcome3d5c2be) returned57014 while
the English helper was executing its line12 ordered raw-companion query under
scope RLS. Rawf222 line55 called it. This identifies the interrupted statement,
not how many cursor rows or English INSERTs completed or which component cost
most. No English-only duration or new generation acceptance is inferred.

The candidate **retains that exact loop query**, so it may leave the observed
cost unchanged. It tests only a finite DML shape opportunity: one English INSERT
instead of one per validated loop row. It does not claim faster planning, fewer
RLS/capability invocations, under-eight-second feasibility or production parity.

## Exact source change

Baseline body `c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb`
is extracted from the pinned12df metadata's exact English helper, normalized to
LF as the existing source seals are. Only the definition's CREATE spelling is
made replaceable; before/after signatures, integer return, invoker mode and
search path remain exact. Three reversible body edits produce
**`b763cd502ed70c49f7d9d07106397bd6c774a6c00d87322f7e0954f25f1ac4ad`**:

1. Add two UUID arrays and an inserted-row counter. They retain only the validated
   video/media pair per existing ordered raw row, not text or full private rows.
2. Keep the entire raw SELECT loop, media PK/source FOR SHARE and row-version /
   source-hash /not-provided checks. Replace only its three-line INSERT with two
   ID appends. The validation and lock order is unchanged.
3. After the loop, if captured>0, one INSERT SELECT joins the exact immutable raw
   `(version,video,media)` and SHARE-locked media PK/source pairs in original
   ordinal order. Re-read rows remain RLS constrained. All nine values match:
   version/video/media IDs, raw source-row version, media status/text/source hash,
   SHA256 English hash **only** for available, and original version.created_at.

No new status conversion, fabricated translation, lower size cap or text cache
exists. Available/not_provided/unavailable/not_captured semantics remain in the
unchanged media/table constraints and original validation. The existing text
validator's1–200000 character and800000 UTF8 byte limits remain unchanged, as do
the hash formats, raw-source linkage and English metadata constraints. Two UUID
arrays add only identifiers from the original finite video set; no hard process
RSS bound or new direct-owner row-count ceiling is claimed.

GET DIAGNOSTICS must report the same inserted count as the validated captured
count, so new RLS filtering cannot silently drop a companion. Before that check,
a fresh `presentation_scope(version.workspace_id,true)` uses the existing entry
predicate/error and current clock. This intentionally strengthens direct empty
or late-expiry return behavior; exact temporal/error equivalence is not claimed.
The original final current-pin count, capture-context GUC restoration and return
remain byte-identical. The existing GUC is an INSERT context guard, not cached
authorization. No session, grant, capability, clock or permission result is cached.

Batching defers earlier INSERT/policy/constraint failures until after later media
validations and changes READ COMMITTED statement snapshots. The media values
cannot change under the retained SHARE locks, and raw rows are protected by the
existing immutability trigger. No INSERT trigger exists on the English table.
All policies, roles, ACLs, owners, validation functions, clocks and timeouts remain
unchanged. Atomic rollback is retained; exact first-error precedence is not.

## Checks and next proof boundary

Five offline checks verify actual PL/pgSQL parse, three inverses/definition
attributes, exact original loop/lock/validation and suffix, nine fields/four
states/available-only hash, ordinal pairs/empty guard/row count/fresh scope,
actual table types/limits/trigger/owner/PUBLIC revoke, and disabled assembly.
The private metadata dump or transcript payloads are not copied into this folder.

```powershell
D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe -X utf8 -B development/m07/presentation-english-companion-batch/test_candidate.py
```

No database, Docker, provider, migration or proof runtime is present or executed.
After source review, Root may choose a new default-OFF uninstrumented first-call
successor to633: unchanged AA/DATA/wrapper/GEN41fe/rawf222, plus this single English
body. It must add this **sixth** exact pg_proc source/full-authority target and
restore the original English body as well as the prior five/config/full clone.
No first-call, full matrix, semantic, English-state, legacy/zero/expiry/revocation,
immutable-version or production scope is accepted by these source tests.
