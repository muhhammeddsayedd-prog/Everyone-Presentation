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
Storage `v1.84.19` and PostgREST `v16.5` run on a private internal network with only
random loopback HTTP ports. Their synthetic credentials are fresh configuration,
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

The Supabase changelog Markdown endpoint returned an unsupported-content-type
response in the browser tool. Current official versioned source was inspected.
