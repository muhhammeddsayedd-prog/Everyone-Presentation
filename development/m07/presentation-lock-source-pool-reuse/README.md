# Pool-ID reuse in the lock helper

Source-only, default off. No migration, query, benchmark, provider or production
retry is included. The four-body reuse candidate remains unexecuted. This is
one finite replacement in lock1ff8, not an assertion that it fixes the observed
query cancellation.

Actual754fcf15 first helper measurement returned query_canceled handler code57014
at8000.099ms and stopped before the original cohort query. The exception was
handled inside the existing observation helper, so no verbose psql ERROR or
private first-native file existed. This does not establish the lost c7e4f2ef
primary cause. Both failed runs and exact cleanup evidence remain retained.

## Smallest proposed edit

The existing helper already locks active assignments, captures v_pool_ids using
the original pool/active-assignment predicate, then locks those pool rows. Its
next selected CTE joins assignments again to rediscover the same pool set.
Replace only these two lines:

```sql
from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id
where a.workspace_id=p_workspace and a.archived_at is null
```

with:

```sql
from eps.workspace_candidates p
where p.workspace_id=p_workspace and p.id=any(v_pool_ids)
```

Keep DISTINCT/materialized and the exact four selected fields. All12 table
locks, order, NOWAIT, exception conversion and entry/footer scope checks stay
byte-exact. All downstream candidate/media/asset/exact-frame-pair arrays remain
byte-exact. Mutable selected fields are still read only **after** pool locks.
The data query still applies the real pool SELECT policy; no authority result,
MCP session, capability or RLS decision is cached or bypassed.

## Equivalence and its necessary preconditions

In the pinned metadata, the only production function caller is exact B20
public.eps_generate_version. It obtains the workspace FOR UPDATE before calling
the helper. Current assignment/pool lifecycle operations must respect that
workspace fence for membership changes; updates of already-captured pool fields
also conflict with their existing FOR SHARE row locks. Independent source review
of those mutation routes supplements the tests; no arbitrary concurrent owner
SQL write is treated as an application operation.

The validated composite FK `(assignments.workspace_id,workspace_candidate_id)`
references `(workspace_candidates.workspace_id,id)`. Thus an active assignment
referencing a pool in this workspace necessarily belongs to the same workspace.
The original DISTINCT join set equals the captured ID set. Existing active
assignments were locked before capture; the generation workspace fence prevents
new assignment/pool membership phantoms; pool fields are locked before reuse.
Empty sets and duplicate assignment references therefore produce the same data.
No archive, Shortlist, position, role or slot filter is added: archived pools
still referenced by active assignments remain included exactly as before.

These conditions are real. An invalid cross-workspace FK relation breaks the
equivalence, and an unfenced phantom insert between capture and selection can
make the original join see a different pool. The pure tests include both
counterexamples; they are not passing application cases. No unconditional
standalone-helper concurrency equivalence is claimed. Future live admission
must bind the then-current function/caller/constraint identities, not assume
that historical source still matches.

Entry/footer authority and every later row policy remain unchanged. A current
permission/session expiry cannot become a successful helper return through this
data reuse. Revocation/error precedence under actual execution still requires
the planned tests; fewer repeated row-policy evaluations are not a permission
cache. No speedup or native cause is claimed from source reasoning.

Seven pure checks pass: exact finite inverse, signature/attributes/PLpgSQL,
all12 locks and footer, post-lock field timing, pinned caller/fences/FKs,
2592 small valid relation cases and invalid-FK/unfenced-phantom counterexamples,
plus default-off/no-transport checks. They do not resolve database runtime,
performance or concurrency. See TEST_PLAN.md before any new owned execution.
