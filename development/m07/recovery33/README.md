# Owned history33 recovery continuation

## Current result — 2026-10-31

**The synthetic same-cluster local metadata-plus-media rehearsal passed.**
[Full run9af6774f](../../../tracking/evidence/m07/recovery33/2026-10-31T15-34-37-577Z-9af6774f.json)
completed at15:36:37.055 UTC. The preceding
[metadata-only run3b58b18d](../../../tracking/evidence/m07/recovery33/2026-10-31T15-15-01-437Z-3b58b18d.json)
passed independently. These receipts establish local history33 recovery within
the boundaries below; production/disaster recovery remains unverified.

| Evidence | Actual result |
| --- | --- |
| Schema and metadata | The owned source actually executed functional migrations30–33. Restored history has33 migrations. All17,311 raw catalogue fields, captured metadata-row snapshots, function definitions, grants, RLS and constraints match the actual source after exactly12 previously proven dump-profile corrections. |
| Intentional fixture transition | The authored fixture enables `auth.users` RLS. A separate owned-source admission records only false→true, with fixed owner/force-RLS and every other catalogue field exact. RLS remains enabled; restoration compares against that actual source state. This is separate from dump-profile corrections. |
| Objects and source bytes | Four filesystem objects were restored and checked: synthetic original MP4, canonical manifest, canonical PDF and scoped guest PDF.119 source files were backed up/restored; their sealed bytes stayed unchanged during the rehearsal. |
| Native media | All four presentation stages committed: prepare, render, validate and publish; guest export also completed. The restored canonical PDF has8 pages,168 text regions checked,2 video links and3 embedded fonts;0 image draws were checked. The restored video probes as2,000ms,160×90 H.264 at25fps, without audio. This supplies no representative casting/frame/audio quality evidence. |
| Synthetic Auth/resource boundary | The fixture's synthetic client, one ordinary session, one resource binding, authorization and cached consent state survive exact metadata restoration. Before and after, cached consent is `consent_ready`; authenticated/service callers cannot execute the private context, and the coordinator still lacks Auth schema USAGE. Settings row1 and its permitted/denied paths remain exact; unsigned sessions stay inactive. Supabase Auth itself and real provider configuration were not restored. |
| Permissions | Before and after, the acting synthetic user can read the fixed original video and exported PDF; an unauthorized actor and anonymous direct table access are denied. The permitted export hash is identical. |
| Lease/job recovery | One committed outbox lease survives restore. Controlled expiry preserves its ID, produces a new token fence, denies the stale ACK and applies the current ACK. One running job/attempt survives; controlled expiry recovers exactly one job, rejects its stale callback as stale/not-applied, queues bounded retry and preserves the completed version/PDF. No physical process crash was simulated. |
| Corruption and preservation | Both tampered-backup and missing-object cases are refused. Both disposable databases, both new roles and the native fixture container are absent afterward. Original29 data/full catalogue/profile/Settings and every preexisting global role's OID/attributes/memberships are unchanged; the shared SQL lock is released. Protected backup/restored directories are retained. |

Elapsed119,478ms is this rehearsal's duration, not an RTO/RPO or throughput
promise. There were no cloud/provider calls, runtime credential loading, central
business writes, Storage HTTP tests, deployed restore, workflow publication or
worker/API replacement. Local SQL ports and filesystem byte transfer substitute
for service transports. The provider JSON is a synthetic inventory, not restored
provider settings, signing keys, secrets or environment values. Independent-cluster
recovery, real-media/representative cost and endurance, deployed configuration/
workflow/media restore and replacement/rollback require their own release proof.

Earlier full attempts remain failed and preserved:
[04b6](../../../tracking/evidence/m07/recovery33/2026-10-31T15-17-10-503Z-04b6bd23.json)
inherited the authenticated fixture role before private Auth seeding;
[0123432f](../../../tracking/evidence/m07/recovery33/2026-10-31T15-21-36-664Z-0123432f.json)
omitted the legacy synthetic principal GUC required by the retained local Auth
helper; [1cc6](../../../tracking/evidence/m07/recovery33/2026-10-31T15-27-45-057Z-1cc6a8f9.json)
compared the intentional fixture RLS transition against its prefixture snapshot.
Their receipts prove cleanup/original preservation without restore acceptance.
Each permanent claim, prepared controller and prior source bytes remain retained;
the narrow fixes changed no product grants, policies or native session guard.

## Historical implementation and earlier failures

Prepared implementation; a first metadata attempt stopped at preflight before
any clone or new role existed. The generated all-role SQL retained one closing
parenthesis from a removed IN predicate. The failed compiler bytes and run99
artifacts are preserved. A one-character forward fix retains all state checks;
the exact generated role query and static SQL inventory now receive parser
regression coverage. The failed run verified original29 preservation, actual
absence of both task database names and shared lock release. No metadata
restore or native proof is credited to that attempt.

This
new compiler preserves the frozen29 controller and all earlier receipts. It
constructs a new, private controller using source-pinned, once-only substitutions
and emits their exact hashes. It does not execute historical controllers.

The source is a full dump clone of the verified original29 application schema.
The new controller actually executes the functional DDL of migrations30–33 and
records each version only after successful DDL. Migration30's canonical cloud
catalogue/data/OID admission is replaced by an owned local name/marker/OID and
an exact in-transaction catalogue/protected-data preimage. Migrations31–33 retain
their other predecessor/history/column/ACL checks; only target predicates change.
Every functional suffix must remain byte identical to its canonical source.

The existing local29 Auth session subset is preserved. Missing native OAuth
relations are explicitly synthetic prerequisites, without history labels. They
do not restore or run Supabase Auth. A later synthetic fixture supplies a public
client, ordinary session, resource binding, authorization and durable cached
consent. Real-role checks verify that this cached state survives restoration,
private context remains inaccessible, and the coordinator still lacks Auth USAGE.

Metadata mode restores full33 before any media fixture, compares the full raw
Auth/application catalogue, and stops on every unknown dump representation.
The earlier eight source-proven corrections and the additional exact observed
`auth.schema_migrations` owner-default ACL pair remain eligible. The
second metadata attempt8b stopped at that new pair, before migrations30–33.
Native read-only proof at14:30:41 UTC established identical eight privileges,
owner/grantor/grantee OID16504 and grant options for the explicit owner ACL and
NULL/default representation. Its source, result and observation are SHA-pinned.
The correction requires the exact owned clone identity, table owner/RLS/NULL ACL
and role OID; it grants only the existing owner's privileges back to that owner.
All unknown representations still stop for review. Earlier failures and exact
source bytes remain preserved. This is semantic proof, not restoration proof.

Run533 actually executed functional migrations30–33, then stopped on three
additional exact ACL pairs. The full source/restored metadata hashes and those
three pairs are preserved in `retained533-acl-observation.json`. Native read-only
proof at15:08:13 UTC established equality of24 expanded Auth ACL entries and8
owner-default entries, including grantor, grantee and grant options. This is
literal ACL semantic proof; its receipt explicitly claims no actual table restore.
The finite `retained533-profile.mjs` wrapper admits only the observed ACL ordering
for `auth.oauth_clients` / `auth.oauth_authorizations` and the exact explicit-owner
to NULL/default pair for `eps.oauth_consent_claims`. It preserves the prior planner
and rejects unknown pairs. Each emitted correction rechecks the owned clone's
name/marker/OID, exact table owner/RLS/current ACL and bidirectional native ACL
equality. Consent claims additionally binds the newly created role's captured OID
and run marker, with NOLOGIN and its other fixed role attributes checked live.
Postconditions require the exact source ACL representation. No canonical or
original29 table is eligible. Fresh metadata restoration must pass before media.

Run533's later cleanup failure and false normalized-context baseline comparison
remain recorded. Guarded direct role deletion plus independent read-only checks
at15:01:22 UTC preserved the exact original29 native baseline/full catalogue and
all preexisting global roles, removed both owned role OIDs and released the lock.
That cleanup receives no restore acceptance. Its successful source checkpoint and
the later English34 proof's recovery source bytes remain in SHA-named history.

[PostgreSQL17 privileges](https://www.postgresql.org/docs/17/ddl-priv.html)
explains that NULL means built-in defaults and the first GRANT instantiates
them. The [ACL functions](https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-ACLITEM-FUNC-TABLE)
define the native default/expanded representation used by the proof.

Full mode retains the earlier native four-object path: synthetic original MP4,
canonical manifest/PDF and scoped guest PDF, exact bytes, PDF/video validation,
stale outbox ACK and job callback fences, earlier Ready version preservation,
and corruption/missing-object refusal. Auth/client/resource/claim rows are added
to the exact metadata snapshot; all restored Auth/storage function definitions,
ACLs, RLS policies and constraints are compared as well.

Both databases have fresh UUID names, markers and OIDs. New NOLOGIN issuer and
coordinator roles are never adopted if they already exist. They are removed
only after the exact task databases are absent and role identity, memberships
and empty dependencies are checked. Original29 full metadata/data/profile,
Settings row1, prior global role identities/attributes/memberships and the
shared SQL lock must be verified unchanged before completion.

```powershell
node --test development/m07/recovery33/compiler.test.mjs development/m07/recovery33/runtime.test.mjs development/m07/recovery33/retained533-profile.test.mjs development/m07/recovery33/retained533-acl-proof.test.mjs
node development/m07/recovery33/run.mjs prepare metadata
# Root reviews the new manifest/controller and coordinates the shared SQL lock.
node development/m07/recovery33/run.mjs execute RUN_UUID_FROM_PREPARE
# After exact metadata proof and any observed-pair review, prepare a new full run.
node development/m07/recovery33/run.mjs prepare full
node development/m07/recovery33/run.mjs execute NEW_FULL_RUN_UUID
```

Preparation writes protected artifacts but makes zero DB/Docker/provider calls.
Execution verifies the exact prepared controller and every source hash again.
An exclusive permanent execution claim is recorded before the child starts;
failed or uncertain dispatches require a new prepared run and are never replayed.
Receipts live under `tracking/evidence/m07/recovery33`; raw synthetic backups
and diagnostics remain in the user/SYSTEM-protected `.local` run directory.

The provider JSON is a synthetic configuration inventory, backed up as source
bytes. No actual provider setting, signing key, secret, environment variable,
workflow publication, Storage HTTP endpoint, deployment or worker replacement
is restored. Same-cluster synthetic recovery is separate from independent
cluster recovery, real media, RTO/RPO and deployed release acceptance. Those
boundaries remain open even if this local rehearsal passes.
