# Cache-free scalar delegated-capability candidate

Source only, default OFF. No SQL, benchmark, migration, controller, provider,
grant, role or transport is present or executed. Actual generation still fails
at8s; f540's English line12 stack does not identify dominant authorization cost.
This candidate has no measured speed, invocation count or database parity claim.

## Exact existing function boundary

The pinned12df metadata supplies actual source for existing
`eps.mcp_token_permits_capability(text)` body5eb6c127 and unchanged public
`eps_validate_own_oauth_session(text)` body9fe44acc. The public validator returns
the same five-key DTO consumed by the web MCP boundary. It is not replaced or
altered. No Auth helper, RLS policy, owner, ACL, function mode, search_path,
permission list or database object is added or changed outside the one existing
scalar permission function. Its signature and full definition attributes remain
exact; source review must precede any future owned database parity proof.

The existing scalar path invokes that DTO validator, aggregates/sorts every
active delegated capability, builds inactive and active JSON objects, then reads
only active plus one requested capability. This candidate copies the exact
validator checks inside the existing permission function and returns a scalar.
It retains a second live grant query after the outer has_capability grant check;
the earlier result is never reused. No authority/session/clock result is cached.

## Initialization and validation order

Two reversible edits add an outer block label and replace only the old validator
call/result projection with a nested block. The original outer claims/cid
declaration and ordinary-browser/unrelated-OAuth bypass remain byte-identical.
After that bypass, the resource argument reads explicitly from the original
outer claims via its label. Fresh validator claims/principal/session/client and
now_epoch initialize in the same order at the original validator-call point.
The clock is never hoisted before the bypass or reused across calls.

Every original guard remains in order: principal/session/client, strict
authenticated/nonanonymous claims, resource/audience, numeric JWT exp/iat/nbf
types/bounds and current clock, openid scope, exact four-key delegation/version,
resource and canonical client text binding, whole capability-array length/types/
whitelist, current enabled resource and exact own live Auth session/scopes/
not_after. Original resource/session SQL and its separate clock_timestamp are
unchanged. Only ten inactive DTO returns become false; object construction and
the final capability aggregate/sort/projection are removed. Unused old JSON
declarations are retained to keep declaration/initializer differences finite.

At the original grant-read point, a fresh EXISTS uses the same principal/active/
delegated-membership predicate and requested capability. For a NULL request,
the extra predicate is `(p_capability IS NULL OR g.capability=p_capability)`, so
the original base grant predicate still executes before a valid NULL returns
SQL NULL. No early NULL return skips validation or this live query. Invalid
delegated sessions return false; the unchanged ordinary bypass returns true.
The NULL path intentionally does not substitute a constant-false keyed lookup.

The declaration-only `permitted` boolean is not a cross-call/statement cache.
The existing STABLE classification remains unchanged. Its SELECTs retain the
calling query's start snapshot; a repeated query is not a claim to see another
transaction's grant commit in the middle of that command. The original
clock_timestamp evaluations retain their actual clock positions. This preserves
the existing snapshot/time boundary rather than promising stronger visibility.
See [PostgreSQL17 volatility and snapshots](https://www.postgresql.org/docs/17/xfunc-volatility.html).

The existing SECURITY DEFINER owner is already the same on both old scalar and
validator functions, so the nested block adds no new execution identity. Existing
own-session RLS, inherited authenticated capability policy and narrow column
grants still apply. The public DTO path remains untouched.
Empty search_path, qualified relations and restricted execution/ownership follow
the existing boundary described in [Supabase function security](https://supabase.com/docs/guides/database/functions).

## Source checks and limits

Six offline checks parse complete PL/pgSQL and SQL, prove two exact body edits
and their inverse plus unchanged definition attributes, compare all literal
validator guards/resource/session queries, verify post-bypass initializer/clock
order and final grant-query-before-NULL order, reject the original DTO shape and
an early-NULL mutation, and bind readable before/after/diff bytes. They check
existing owner/RLS/column grants and default-OFF refusal before source assembly.
They execute no database policy, actual clock-expiry race or provider request.

Existing PKs already cover session id, exact resource/client, and principal/
capability lookups. Sorting at most13 distinct current capabilities is not
itself a demonstrated hotspot; repeated RLS invocation counts and actual plans
are unmeasured. This source change removes DTO work, not fresh authorization.

No canonical release or performance acceptance follows. A future separately
reviewed owned proof must compare actual old/new boolean/NULL outcomes, existing
invalid claims and resource/session/grant revocation/expiry behavior, full
metadata/roles/data preservation and cleanup before this candidate can be used.
All prior generation candidates, failures and consumed purpose bytes remain
unchanged. The final production candidate graph and hash manifest remain open.
