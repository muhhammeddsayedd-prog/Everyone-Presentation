# First native error preservation after c7e4f2ef

Default-off source proposal. No SQL, Docker, provider or production call has
been dispatched. The failed/consumed122aa/01305 source and c7e4f2ef receipt are exact.

The actual private failure contains final code
LOCKSOURCE41_PROBE_ROLLBACK_UNCONFIRMED and no diagnostic. The retained first
closed request error is holder_request/OWNED_SESSION_FAILED. The frozen session
transport originally attaches stdout/stderr to that Error, but verifyHeld's
finally block throws a second assertion if rollback fails on the ended session.
That second assertion becomes the only private failure file, losing the primary
diagnostic. No native primary SQLSTATE can now be recovered from the retained
files. Oracle query cancellation remains a hypothesis, not the observed cause.

`capture.mjs` is the smallest observation correction: wrap caller-owned sessions
when they are registered, privately save the first Error's original diagnostic
through an injected sink **before rethrowing the identical Error**, and retain
only phase/request hash/validated SQLSTATE/capture status in the public report.
It changes no query, error handling, cleanup, role, permission, timeout, trigger,
assertion or candidate body. A failed private sink is explicit and cannot replace
the original Error. Non-verbose error words never become an invented SQLSTATE.
Future integration requires a new purpose/claims and the existing protected
owned private directory/ACL checks; this pure module supplies no filesystem sink.

The source limits the first failing holder request to begin, lock measurement or
the direct12-relation cohort collector. Lock measurement already catches57014
and returns a normal result; the direct stable collector aggregates all original
predicates in one8s request without an exception boundary. Its broad RLS reads
make a timeout plausible. However the original native diagnostic is unavailable,
so there is no justified semantic collector fix yet. Do not rewrite predicates,
split the snapshot or relax8s based on that inference. A later authorized fresh
purpose can use this adapter to obtain the actual error before choosing a fix.

Six pure capture tests execute the actual frozen verifyHeld with fake sessions. The
first demonstrates the existing mask; the second retains a synthetic primary
diagnostic before the same mask. Others prove identical-error propagation,
once-only/private sink failure and no SQLSTATE guessing or public diagnostic
leak. Node transport Error.code (including EPIPE) is never PostgreSQL evidence;
only the first anchored verbose psql ERROR line can supply a classified code.
Synthetic57014 is a regression input and does not establish c7e4f2ef's cause.

Two additional tests execute the exact pinned ddb76 session receiver with only
its spawn import replaced by a fake child-stream dependency. The substitution is
inverse-proved; real close/error handlers and buffers are unchanged. This proves
receiver logic retains emitted stdout/stderr, including empty buffers on process
failure. It is not a real psql or database observation.

## Cohort-only reproduction source

`entry.mjs` remains EXECUTION_ENABLED=false. `compiler.py` reuses the pinned
owned bootstrap and `tiny_source.py` keeps its exact38→39→40 fixture, source,
fit-metadata and four-body installation prefix, then replaces only the full
measurement/security/extra-case/race tail with one source-cohort observation.
New namespaces/UUIDs/claims/source snapshots/labels preserve the old run.

The new operation installs only lock1ff8 and the four preceding bodies. It
records all counts and a complete fresh row/catalogue/nonnull-reason/Ready state,
then runs the real MCP/eps_review_owner lock helper once at8s and captures the
unchanged actor/timeout plus another identical full state immediately before
the **exact original**12-relation cohort query. No cohort predicate, policy,
permission, trigger, timeout, source function or failure acceptance is changed.
It never runs32 measurements, six generation cases or six association cases.
The candidate four bodies remain unexecuted and full proof remains mandatory.

The existing real lower receiver runs unchanged with only client-side
`-v VERBOSITY=verbose` appended. The private owner+SYSTEM directory and one-shot
claim must already be verified by the existing bootstrap before installing the
first-error sink. The full first diagnostic is written with wx under that
protected context before rethrow; public reports receive only code/provenance,
request hash and capture status. This changes error formatting, not database
execution. [PostgreSQL17 psql variables](https://www.postgresql.org/docs/17/app-psql.html).

Fresh UUIDs, actual project/workspace RPCs and timestamps prevent an honest
cross-run equality claim against c7e4f2ef's historical cryptographic row hashes.
Those old hashes remain retained. The new proof instead preserves the same
fixture recipe/counts/function/controlled-actor contract and asserts **exact
within-run** full state equality immediately before/after diagnosis. This scope
limit is explicit; no historical raw row reconstruction is claimed.

Root and independent source/disabled-plan review must precede any one owned
execution. Failure stops without retry; all exact cleanup/original29/global-role
and successful-daemon absence checks remain inherited. A successful diagnostic
is not performance, source-cohort lock, candidate or release acceptance.
