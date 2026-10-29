# Narrow runtime connection diagnosis

The [read-only aggregate snapshot](2026-10-29T11-21-34-698804Z-d2e0a9a4.json)
observed `eps_specs_runtime` at **2026-10-29T11:21:43.044419Z**: connection limit 4,
two database backends, both idle with `Client/ClientRead`. No active query/lock
wait or connection-limit saturation was observed at that instant. This sample
cannot reconstruct the earlier connection timeout or prove lasting availability.
The query returned no SQL text, source, IP address, PID, credential or other user
data and changed no configuration. The active worker was not stopped.

Source inspection found `execute()` always called `client.release(true)`, even
after successful COMMIT. The [official pg Pool
API](https://node-postgres.com/apis/pool#releasing-clients) states that this destroys
the client; returning it normally permits reuse. Thus every heartbeat, poll and
asset operation previously required a fresh frontend connection/authentication.
This is a concrete churn defect and a plausible contributor to the observed
3-second connect failures; the snapshot does not prove their precise network,
pooler or scheduling cause. The existing 10-second idle timeout was also shorter
than the worker's 20-second heartbeat interval.

After root coordination, only the gateway and its focused test were changed:

- A clean flag becomes true only after an acknowledged COMMIT. Clean clients
  return to the bounded pool; failures, aborts, invalid identity and lost COMMIT
  acknowledgement destroy the client exactly once. No unknown SQL write retries
  were added here.
- Every transaction still checks identity, authority and logging before the
  operation. A finite future `rolvaliduntil` predicate now preserves credential
  expiry enforcement when authentication is reused. The [PostgreSQL role
  documentation](https://www.postgresql.org/docs/17/sql-createrole.html) defines
  this as password expiry; the role/expiry itself was not changed.
- Root selected a 30-second idle timeout to bridge the 20-second heartbeat. Pool
  min 0/max 2, lifetime 300 seconds, connect 3 seconds, statement 8 seconds, query
  10 seconds, idle-in-transaction 10 seconds, fixed target, TLS/SCRAM and role
  limit 4 remain.

The focused suite showed RED failures before each change, then **17/17 PASS**.
It uses the actual pinned pg Pool with a synthetic SQL client to prove sequential
reuse, repeated identity verification and destruction after invalidation. Lost
COMMIT and abort tests prove no unsafe return or repeated SQL. The earlier narrow
change passed typecheck/scoped lint; the final 30-second adjustment passes the same
17 tests and scoped lint. Independent review is recorded in the parent handoff. These checks
open no database socket and establish neither live recovery nor endurance.

The existing 3-second cold-connect budget remains a possible later tuning point
only if fresh measurements still justify it. Connection capacity, TLS, ACLs and
role expiry should not be widened to hide that uncertainty. Actual current job
outcomes and callback retry evidence are recorded separately.
