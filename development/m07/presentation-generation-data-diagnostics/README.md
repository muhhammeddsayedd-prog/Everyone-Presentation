# First native error preservation after c7e4f2ef

Source proposal only. No runner, entry, SQL, Docker, provider or production call
exists here. The failed/consumed122aa/01305 source and c7e4f2ef receipt are exact.

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

Four pure tests execute the actual frozen verifyHeld with fake sessions. The
first demonstrates the existing mask; the second retains a synthetic primary
diagnostic before the same mask. Others prove identical-error propagation,
once-only/private sink failure and no SQLSTATE guessing or public diagnostic
leak. Synthetic57014 is a regression input and does not establish c7e4f2ef's cause.
