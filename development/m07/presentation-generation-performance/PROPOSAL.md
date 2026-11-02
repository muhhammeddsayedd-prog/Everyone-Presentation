# Source-only proposal after e37e

The helper-only candidate improves locking but cannot meet the unchanged8s
MCP-large generation bound: locking alone takes3.097–3.224s and the one review
projection takes6.474–6.593s. This proposes eliminating repeated **data** reads
inside the existing projection and frozen-version capture. No authority result,
session, capability or RLS decision is cached. No implementation, SQL, provider
call or new benchmark is included in this proposal.

## Observed boundary and source provenance

Actual owned-local receipt:
`tracking/evidence/m07/presentation-lock-source-edge-proof/2026-11-02T13-55-48.201Z-e37e2690.json`,
SHA `bfff1bd13c18a0afdcb65e97cfe2257c38e1e1d113a109d8152a5035fb0f499e`.
Source/arm `b11825b`, evidence `15bbe09` remain immutable.

| Candidate profile | Lock samples | Review samples | Whole generation |
|---|---:|---:|---:|
| API control |0.202–0.206s|0.144–0.182s|0.786s passed|
| API large |0.823–0.925s|1.609–1.724s|5.637s passed|
| MCP control |0.657–0.690s|0.490–0.504s|2.516s passed|
| MCP large |3.097–3.224s|6.474–6.593s|57014 at8.000s|

All32 candidate component samples returned normally. Recorded old/new review,
snapshot and hash contract values compare equal in24/24 offline pairs. The
candidate security/cohort/race and final preservation phases were not reached;
these are not complete acceptance results. Hash-only time excludes the recorded
snapshot preparation time. No production query plan or internal phase timing
has been captured, so downstream cost attribution remains an inference.

The latest actual function capture used here is the read-only canonical39
capture (whole-file SHA `012cbc0b4435fc0cc97093a721a56e5d556c76b2907517b0aee4cc5e8d208ec0`).
Its bodies remain private. The matching public migration sources and frozen
synthetic38 metadata (SHA `12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c`)
supply reproducible source reasoning. This is not a fresh live catalogue read.

| Proposed body | Pinned preceding body SHA256 |
|---|---|
|`eps.review_snapshot_data(uuid,uuid,text)`|`4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7`|
|`eps.review_snapshot(uuid,uuid,text)`|`f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb`|
|`public.eps_generate_version(uuid,jsonb,text)`|`b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08`|
|`eps.capture_presentation_video_transcripts(uuid)`|`ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187`|

The first three match the actual capture. The fourth is the exact guarded34
port in frozen38; no later application migration through39 changes it. A future
canonical migration must bind the then-current accepted40 catalogue and receipts.

## Exact duplication found

`eps_generate_version` calls `eps_get_workspace_review` once, which calls
`review_snapshot` once, which calls `review_snapshot_data` once. There is no
second complete review projection to remove. Fit/template decoration belongs
to `eps_get_workspace_review` and must stay in that path.

The current19 assignments reuse11 pools/candidates/media and33 frame IDs.
The projection repeatedly selects pool, candidate, media, original asset and
each selected frame inside the assignment loop. Its frame query also checks the
exact media/frame link. Repeated source lookups therefore exceed distinct source
rows. Role/slot/assignment order, Pending slots and error precedence are encoded
in those loops (`20261029202629_m04_review_series_processing.sql:158`).
The final fingerprint queries also reread the active roles and slots already
visited by those loops. Their field lists and ordering must remain exact when
reusing the already-read rows.

Generation reads the same44 selected assets for inventory and again for the pin
loop (`20261029215218_m05_immutable_presentation_versions.sql:207,221`). The
second read only supplies metadata already fixed by the source row locks.

Raw companion capture iterates11 video pins and queries this version's persisted
candidate slides once for each video. That repeats slide RLS and parent-version
scope reads. English capture subsequently rereads each media row, but its row
version/source-digest checks are meaningful and should remain in the first patch
(`20261030030717_m06_frozen_video_source_transcripts.sql:77` and
`20261031143711_m03_english_transcript_projection.sql:154`).

Policy source confirms each relevant read still invokes workspace/project scope
and business-capability checks, including MCP delegation/session intersection.
The policy/index capture does not establish an executed plan or per-node cost.
RLS is evaluated as part of row access; moving to a definer bypass, changing
policies or caching authorization is outside this proposal. [PostgreSQL17 row
security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## Recommended smallest coherent patch

1. **Reuse successful exact-key source rows inside `review_snapshot_data`.**
   Keep its existing role/slot/assignment loops, early size checks and every
   field/fingerprint/issue construction line. On a repeated pool/candidate/media/
   video/frame lookup, reuse a typed record loaded by that exact original RLS
   query in this invocation. Keys include all lookup inputs: pool+workspace,
   media+candidate, and frame+media+source-asset. Do not cache absence or denial.
   Frame keys must not become a cross product. Each assignment still calculates
   its own availability, presentation notes, wording, Reviewed result and issues.
   Use a bounded private data map (recommended4MiB); when it would exceed the
   budget, execute the unchanged lookup instead of rejecting or skipping data.
   This retains early error/budget ordering and avoids an unbounded eager scan.
   Preserve `FOUND` behavior explicitly when a lookup is satisfied from a record.
   Retain already-visited role/slot records for the final fingerprint projections
   under the same bound, with the original end queries as fallback. Keep their
   exact field lists and role/slot ordering, including roles without active slots.

   This is row materialization within one existing STABLE query snapshot, not a
   cross-query or transaction cache. Do not change volatility, role, owner,
   search_path, grants or RLS. PostgreSQL uses the calling query's snapshot for
   STABLE reads; VOLATILE outer operations still obtain fresh snapshots for their
   commands. [PostgreSQL17 volatility/snapshot rules](https://www.postgresql.org/docs/17/xfunc-volatility.html).

2. **Retain a final user-review authority check.** In `review_snapshot`, collect
   the one data projection, then repeat its existing `review_require` and
   `cast.read` checks before returning it. This prevents earlier row reads from
   extending an expired MCP access window during rendering. It adds no permission
   and caches no decision. It does not promise a new MVCC snapshot inside a
   STABLE function; current-clock expiry is checked again. Service/AI callers
   that already call `review_snapshot_data` directly keep their own existing
   job/actor checks and do not acquire a new interactive-user requirement.

3. **Capture asset metadata once in generation.** Use the original inventory
   predicate and cardinality check to obtain the selected source records once.
   Derive exactly the same sorted public inventory from them and reuse the
   private records for the pin insertion loop. Keep filename/created_at needed
   by pins private; never merge a full row into snapshot/manifest/output. Keep
   all pin INSERT policies and current scope checks. FOR SHARE holds these source
   rows through the transaction, so their data cannot change between the two
   formerly separate reads. No client-supplied captured rows or request GUC is
   accepted. [PostgreSQL17 row locks](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS).

4. **Read slide/media associations once per new version.** In raw companion
   capture, after the same version/scope/empty-capture guards, load only this
   version's persisted candidate slide association text once when video pins
   exist. Per pin, derive and cast its distinct media IDs from that private
   projection and apply the original cardinality==1 check in the same pin order.
   Keep per-pin media SELECT FOR SHARE, transcript validation, INSERT policies,
   final count check, English helper call and context restoration unchanged.
   Do not cast unrelated/malformed groups eagerly or substitute client review
   JSON for persisted slides; preserve validation/error order. No-video cases
   skip this materialization. New version/slides are uncommitted and immutable
   in this operation, so another transaction cannot change their association
   data between reads.

No public signature, existing OID/owner/config/ACL, output shape, constraint,
candidate lock body1ff8, timeout or authority helper/policy changes. The four
body edits above share the existing projection rules; they do not fork a second
renderer/fingerprint implementation. No speedup is promised before measurement.

Independent source review also identified a redundant assignment rejoin in the
lock candidate's post-pool-lock selected CTE: the already-captured pool IDs can
describe that set under the composite workspace FKs and generation's workspace
fence. Defer that change here. It adds another lock-body comparison without
addressing the expensive review/downstream reads by itself; body1ff8 stays fixed.

## Required preservation and next evidence

Keep all ten fields, all active Selection assignments, explicit Shortlist,
Main/Option/Backup distinctions, active/archive behavior, missing information,
Pending/fewer frames, precise frame pairs, Reviewed fingerprint comparison,
role category, source transcript and all English states. Preserve exact fit/
template checks and fresh source fingerprint comparison; no stale measured
review is trusted solely because its workspace revision matches.

Root review precedes implementation. After that, pure finite-diff/parser checks
must bind these bodies and unchanged attributes. A fresh owned local purpose
must compare the helper-only baseline against this patch on the same bounded
fixture. Baseline API-large generation can supply the normalized reference even
though baseline MCP-large exceeds8s; the same principal/visible source cohort
must be verified before comparing API/MCP projections. Never raise8s to obtain a
baseline result. Reuse historical original-lock cancellation evidence rather
than replay a consumed controller.

The new candidate must complete **all** API/MCP profiles and then the previously
unreached candidate security,12-table cohort/edge, fact/media/frame/pool races,
authority revocation and full preservation gates. Include expiry between first
and repeated source use, cache-budget fallback, absent/mismatched sources,
archived referenced pools, no-video versions, ambiguous associations and every
English state. Compare complete review/fingerprint/normalized version/pin/raw/
English companion projections, old Ready bytes, post40 nonnull reason and the
original29 data/catalogue/global roles. Actual cleanup/normal status remain
mandatory. No implementation or new run is authorized by this document.

A larger fused lock-and-project interface could remove more duplicate reads,
but would add private interfaces and split current projection code. It is not
the first change. Replacing fresh projection with a stored fit snapshot based
only on draft revision, policy/initPlan rewrites, global authority caches and
timeout increases are also excluded.
