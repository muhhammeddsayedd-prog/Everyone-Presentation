# One pin-batch stage diagnostic (default OFF)

This is source-only preparation for **one fresh MCP-large call** using the failed
374 candidate: helper `aa1db8b1…` and DATA `0dba1d40…`, review wrapper
`c6f93795…`, GEN **`41fe515f…`**, and raw capture `afe33691…`. It does not implement
an optimization or accept generation performance. No runtime, private claim,
Docker resource, SQL execution, provider request, or production change has been
made by this purpose. `entry.mjs` is disabled before reading context.

## Why another diagnostic

Actual 374eead8 returned `57014` normally and rolled back its first MCP-large
call (server 8000.699 ms; client 8004.3425 ms). The other seven calls and all later
semantic, lock, authority, and pin-insert tests were unreached. Its current
cancelled stage is **unknown**. The older eeca trace located the *pre-batch* GEN
at its asset-pin statement; that observation cannot identify the new call's
stage. The raw failed receipt SHA is `791d7a1a…`; its safe outcome SHA is
`39751999…`. Admission checks their exact full hashes and all 162 recorded
source seals. Only the known pin-proof entry's exact armed `bfe59d0a…` or closed
`2c8e12d5…` bytes qualify; other changes are rejected, without normalization.

## Finite source changes

Seven new files reuse the frozen eeca seven-file wrapper, which itself seals all
14 d958 source files. No consumed file, controller, claim, or receipt is edited.

`projection.py` applies the **same five generator NOTICE edits** to GEN41fe.
The result is body `b3bc105e6fb7d14194b04db6dbb5e8bbaad8bad9fe237d276cbde751c112b2a3`.
Both bodies remain 68 lines. Applying the reviewed pin-block change to the old
instrumented generator produces the exact same definition; each notice and the
pin block independently invert to its sealed source. The other three
definitions, helper aa1, temporary measurement/catch SQL, session receiver,
fixed marker vocabulary, parser, and custody code remain byte-identical.
Only the stage-map generator hash changes; the same coarse line ranges apply.
Callback edits change two evidence labels, with a byte-exact inverse. Entry
edits change namespace, disabled code, scope text, and the instrumented GEN hash,
also with an exact inverse.

The compiler delegates the frozen eeca compiler as a source library. It creates
fresh artifact/private/output/once paths and `eps.pinstage.*` labels, seals all
new source and the pin candidate files, and binds three compiled artifacts.
Its exclusive protected compile claim is still created before original-target
inspection or Docker setup. No old controller is invoked. The inherited helper
provenance explicitly records that GEN has now changed too; it does not claim
the helper is the only business delta from d958.

## Runtime contract awaiting Root review

The same synthetic 38→39→40 setup, UUID input qualification, fixed actor/JWT,
original configuration, 13 Ready versions/60 pins, non-null audit reason, and
normal transport remain. Actual canonical schema41 does **not** retarget this
owned proof baseline. The measured session is fresh, READ COMMITTED, acting as
the same authenticated MCP user. It calls the real public generator once, with
the same statement and lock timeouts of eight seconds. There is no warming,
eight-call matrix, profiling, function stats, EXPLAIN, or replay of focused cases.

The existing generator SECURITY DEFINER and DATA/helper invoker modes, owners,
ACLs, search paths, RLS, live capability/session/clock checks and late capture /
series guards remain unchanged. Only five prosrc values are qualified in the
clone catalogue comparison. Restoration reinstalls original4107 plus the four
canonical bodies and exact presentation config, then checks the full clone
baseline, original29 data/catalogue/global roles, owned resource absence, and
shared-lock release. Independent same-engine inventories and lock readback are
still required after an admitted actual run.

## Private diagnostic custody

Fixed NOTICE markers are observational overhead, not an inert zero-cost change.
The reviewed parser allows the 14 fixed normal labels plus optional cancellation
within its bounded trace (max 15 records, max 220 bytes/line, max 128 KiB stderr).
It reads stderr only after normal child close. The measurement's
QUERY_CANCELED-only catch retains the existing bounded private stack/message /
SQLSTATE: up to 2 MiB context custody and 16 KiB phase custody. Raw rows/context
are stripped and private custody succeeds **before** any public result is
attached. Public evidence contains only closed codes, allowlisted frames /
line numbers / fixed phases and custody path/hash metadata. It does not contain
SQL, facts, transcripts, tokens, native messages, or arbitrary buffers.

`data_return` marks the boundary before the final DATA JSON expression. Nested
intervals overlap and cannot be added. A normal success means only that the
cancellation did not reproduce under instrumentation; it is not an eight-second
generation acceptance. Unknown stack frames remain unknown. Any native error,
failed sink, malformed/foreign trace, or unexpected result fails closed, with
the original error and cleanup retained privately. No automatic retry follows.

## Source-supported RLS path and limits

The exact captured metadata source is SHA `12df4e56…`; it is private and is not
copied into this purpose. The pin INSERT policy checks allowed kind plus a
queued parent version and `presentation_scope(workspace,true)`. Reading that
parent also applies its SELECT policy and scope check. Scope calls the active
project/business-capability path; delegated MCP capabilities reach
`eps_validate_own_oauth_session`, which validates current client, resource,
session, grant/delegation intersection and clock-based expiry. These are static
conditional source sites, **not measured invocation counts or dominant cost**.
No query plan has been captured by this purpose. Migrations40 reason and41 logo
do not alter this path. Current374 phase remains unknown until fresh evidence.

[Supabase's initPlan guidance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)
can avoid repeated row-independent work per statement. It does not prove that
the whole live authorization result may be retained through an operation.
The actual validator reads `clock_timestamp`, which
[can change within one statement](https://www.postgresql.org/docs/17/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT).
[STABLE query snapshots](https://www.postgresql.org/docs/17/xfunc-volatility.html)
do not establish live-clock equivalence. This diagnostic changes none of those
functions or policies and creates no auth/session/GUC cache.

Later options require separate source review after the new trace: reducing
data-query/DML work with unchanged RLS; immutable claim decoding reused only
within one helper invocation; or an exact same-predicate policy query shape
with explicit caller inventory and fresh late-revocation/expiry rollback proof.
No such change is implemented here, and no speedup is claimed.

## Offline verification

From the Recovery checkout:

```powershell
D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe -X utf8 -B development/m07/presentation-generation-pin-batch-stage-diagnostic/test_wrapper.py
node --test development/m07/presentation-generation-pin-batch-stage-diagnostic/wrapper.test.mjs
node node_modules/eslint/bin/eslint.js development/m07/presentation-generation-pin-batch-stage-diagnostic --max-warnings 0 --no-warn-ignored
```

Tests check exact frozen sources, both inverses/line counts, actual PL/pgSQL
parsing, compiled binding differences and unchanged bounds, once-before-target
ordering, disabled-before-transport, current374/no-historical-phase admission,
exact flag closure, and the reused actual strict-parser/private-custody fake
ports. These are source/parser/fake-port checks; they are not PostgreSQL, timing,
authority-race, or production acceptance. Root alone admits/arms a fresh Main
compile and may authorize its exact command later.
