# Feedback summary37 source checkpoint

Source/local-only vertical slice in progress. No migration, local SQL proof,
cloud/provider call, upload capability or owner inbox was executed/read here.
Root owns actual migration filename creation and all SQL execution/deployment.

The accepted DTO/auth/count rules are in
`docs/integrations/FEEDBACK_SUMMARY.md`; an additive note was appended to the
separate Claude frontend coordination file without changing its previous bytes.
There are no UI or lockfile changes. Internal HTTP/MCP and guest HTTP use the
same strict DTO and Central aggregate ports; fixture guest mode remains refused
by the existing composition rather than introducing a parallel mock service.

Verified so far:12 focused new domain/Central/HTTP/official-MCP tests,31 existing
plus new guest regressions,13 contract tests and full TypeScript check passed.
Seven inert migration-source/SQL/PLpgSQL checks passed; these are not native SQL.
The synthetic SQL fixture parses72 statements but has not been executed.
It exercises >100 stored rows, current votes, replies/deletion/resolution,
exact older version, zero counts, foreign-scope denial, private count exclusion,
direct function denial, guest proof/replay/expiry/revocation/rotation.

Draft issues were proved/fixed locally: persisted preferences use column
`preference` (DTO calls it `value`), and both GET routes must refuse advertised
and streamed bodies. The fixture now supplies the canonical required preference
idempotency keys and explicitly denies a newer queued version through both
authority paths. The proof evaluates the actual compiled SQL transaction and
object-result ports. Contract output preserves each existing byte newline style:
OpenAPI/catalog/runtime JSON CRLF, parity/TS LF. No whole-file style reset.

Root created the official empty local file through Supabase CLI2.122.0:
`supabase/migrations/20261101042702_m07_feedback_summary.sql`. The generator
filled only that existing stub with bytes equal to `candidate.sql.txt`; no SQL
was executed. It requires an explicit existing regular file and cannot invent
a migration filename or overwrite unrelated nonempty bytes. Old36 migrations
remain unchanged.

The SQL adds only a private SECURITY INVOKER aggregate and authenticated public
RPC, with explicit PUBLIC/anon/service-role revocation. The guest branch is
inserted into exactly the known current function bodySHA, preserving its owner,
ACL and other function metadata. No table/RLS/role mutation, anonymous internal
RPC, migration-history edit or service credential is supplied by the feature.
Root checked current official [functions guidance](https://supabase.com/docs/guides/database/functions)
and [changelog](https://supabase.com/changelog) on2026-11-01; default PUBLIC
function execute requires explicit revocation, and table autoexposure does not
justify any direct grant on private EPS data.

The disabled owned proof uses a NEW purpose/claim atop the immutable185
local controller foundation: actual34/35/canonical36/37 plus synthetic fixture
in an exact name/OID/marker-owned source clone savepoint, complete rollback to33,
then inherited original29/Auth-Storage/global-role/database/lock cleanup. It will
emit feedback37-only evidence and will not replay the185 execution or fabricate
its original claim/callback markers. Root reviews and runs it later. Native,
cloud, guest/delegated and release acceptance remain pending until actual proof.
Seven inert proof tests passed, including the complete real BEGIN/body/COMMIT
wire with every PLpgSQL body, compiled-controller syntax, source seals,
disabled entry and synthetic runtime-hook wiring. No proof prepare/execute ran.
