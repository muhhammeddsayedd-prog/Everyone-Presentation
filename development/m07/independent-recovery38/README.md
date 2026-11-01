# Independent local recovery of schema 38 and Storage objects

This new rehearsal consumes the passed `639da33a` bundle read-only. It creates a
new labelled Docker network, database volume, object volume and three containers.
The PostgreSQL system identifier must differ from the original local cluster.
No pilot, cloud API, provider, existing object store or unrelated container is
modified. AT069 is outside this runner.

The runner restores the synthetic role attributes and named memberships, all
metadata, the 373 saved sources and four referenced objects. It compares every
saved table hash and the prior full catalogue (ACL ordering is normalized without
removing entries or privileges), then restores the four object byte streams over
real Supabase Storage HTTP. It reads them back with exact size/SHA256 checks,
rejects anonymous/public reads and calls the restored fixed-version video and
PDF-export RPCs through PostgREST. Other actors and private-table access are denied.
Saved presentation data and every non-Storage table must remain unchanged.

All runtime credentials are newly generated synthetic credentials. They and raw
diagnostics remain in a current-user/SYSTEM-only private run directory. Public
receipts include safe hashes, IDs, statuses and cleanup flags. Failed attempts
retain separate receipts; automatic retries do not occur. Exact resource IDs,
names and run/workspace/purpose labels are required before removal. The original
local database is read before/after under its shared lock.

Pinned locally installed image digests are recorded in `run.mjs`; no pull occurs.
Storage `v1.84.19` and PostgREST `v16.5` run on a private internal network without
published host ports. A bounded Node HTTP client runs inside the owned Storage
container, admits only the exact run's Storage/PostgREST origins, and receives
request bodies and synthetic credentials through stdin, never command arguments.
Docker's internal-only bridge accepted the earlier publish configuration but
created no host binding; the failed `a2d9833a` receipt is preserved. This transport
uses real HTTP while retaining network isolation. Their synthetic credentials are fresh configuration,
not a restored production secret/configuration backup. Storage's own schema
migrations may be required for this later API version; application metadata and
non-Storage rows must still remain exact. No full web/worker deployment, actual
owner OAuth, provider processing, RTO/RPO, cloud failover or AT069 is established.

From this isolated worktree:

```powershell
& 'C:/Program Files/nodejs/node.exe' --test development/m07/independent-recovery38/guards.test.mjs
& 'C:/Program Files/nodejs/node.exe' development/m07/independent-recovery38/run.mjs execute 'D:/Everyone/Presentation/Everyone-Presentation-Studio'
```

The source root must have the original passed bundle and private ownership marker.
This file is not evidence that the actual rehearsal has passed. Read the receipt
under `tracking/evidence/m07/independent-recovery38/` and its cleanup flags.

Official references inspected for these versions:

- [Storage v1.84.19 configuration](https://github.com/supabase/storage/blob/v1.84.19/src/config.ts)
- [Private Storage downloads](https://supabase.com/docs/guides/storage/serving/downloads)
- [PostgREST 16 configuration](https://docs.postgrest.org/en/stable/references/configuration.html)
- [Docker internal-network published-port behavior](https://github.com/moby/moby/discussions/53256)
- [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/)

The Supabase changelog Markdown endpoint returned an unsupported-content-type
response in the browser tool. Current official versioned source was inspected.

## Retained continuation results — 2 November 2026 (Africa/Cairo)

**Current scoped result: passed.** Run `9d5de638` completed at
`2026-11-01T22:42:51.624Z` in74,424ms. The
[receipt](../../../tracking/evidence/m07/independent-recovery38/2026-11-01T22-41-37.200Z-9d5de638.json)
records a distinct PostgreSQL17 cluster,373 source files, exact restored table
data and17,729 catalogue fields before API startup. All four referenced objects
passed actual Storage HTTP upload/download, exact bytes/SHA256, and anonymous/public
denial. PostgREST returned200 for the saved Ready version, fixed original video,
canonical PDF and guest-export PDF; each media reference matches its restored
bucket/key/size/hash. The restricted actor was denied400 (`CAPABILITY_REQUIRED`);
anonymous private-table access was denied404.

The restored synthetic `auth.uid()` reads the legacy `request.jwt.claim.sub`,
while PostgREST16 supplies verified JSON claims. A separate private
`recovery_http.restore_claims` **SECURITY INVOKER** pre-request adapter copies
only the verified authenticated subject after matching the current request role.
Actual SQL checks deny role drift/missing subject and clear the anonymous subject.
Every restored Auth/application function remains unchanged. This is fresh
synthetic runtime configuration, not recovery of the owner's Auth/provider setup.

Storage1.84.19 performed its own schema migration:924 Storage catalogue fields
changed, within the explicit Storage-only allowlist. All restored non-Storage
catalogue fields, saved versions and non-Storage table hashes remained exact.
The original backup and controller source seals were reverified. All six owned
resources (three containers, two volumes and one network) were removed after
exact-ID/name/ownership checks; original local DB/catalogue/global-role identities
and the shared lock were preserved. The elapsed time is not RTO/RPO. No cloud,
pilot, provider, real-user authentication, full web/worker/configuration restore,
deployed rollback or AT069 acceptance is claimed.

Seven guard cases, focused ESLint10.13.0 and Node syntax checks pass. The two added
guard groups have retained RED/GREEN history; their seven-case total includes the
original five cases and must not be added to those earlier counts.

Checkpoint `a438781` preserves the unfinished source and its five original failed
receipts. New run `0e4293ab` restored a distinct PostgreSQL17 cluster, exact table
data and 17,729 catalogue fields, then restored all four actual Storage objects
over HTTP with exact bytes/hashes and anonymous/public denials. Its fixed-version
PostgREST read returned400, so the overall result is **failed**, not independent
recovery acceptance. All owned resources were absent afterward; original database,
catalogue/global roles and shared-lock preservation passed. Private API error
capture is bounded to that run's protected diagnostic directory.
Run `93365cce` retained the same boundary and identified `AUTH_REQUIRED` from the
legacy Auth prerequisite. After the separate runtime adapter, `0f9361e9` passed
the authorized video/export RPCs but stopped when the internal URL guard rejected
the bounded private-table probe. The final guard permits only that exact
`select=id&limit=1` query. All three continuation failures preserve their separate
receipts and complete cleanup/original-preservation flags.

The original consumed `639da33a` preparation/execution has not been replayed. Its
saved bundle is a read-only input to each separately owned continuation run.
