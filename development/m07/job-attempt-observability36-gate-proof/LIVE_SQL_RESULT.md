# Actual owned release-gate SQL result

The root-operated fresh run `bc54b423-9b7a-480f-981f-207373885349` passed normally, from
2026-11-01T02:13:22.368Z to 2026-11-01T02:15:05.601Z (103233ms).
The actual public receipt is
`tracking/evidence/m07/job-attempt-observability36-gate-proof/2026-11-01T02-13-22-368Z-bc54b423.json`
(SHA256 `b486bc1363c900fff60171bc903b04277d5fd06e7ca441f1996f0528d90390dd`). This note adds no operational execution.

Independent read-only review checked all238 current source seals, the actual
before/after query hashes/source pins, and the exact captured metadata hash.
The runtime hashes serialized capture before its one final file newline; that
exact representation matches. Pure `bridge.validate` revalidation of all seven
captured phases succeeded, and its entire result equals the public receipt.
The actual schema template and all nine unchanged claim/callback/retry ports
validate. Atomic normal/disabled results were:

| Phase | Normal gate | Disabled-only gate |
| --- | --- | --- |
| Before | Not applicable | Not applicable |
| After | true | false |
| PUBLIC execute | false | false |
| Disabled capture trigger | false | true |
| Wrong function body | false | false |
| Unrelated old-jobs metadata | false | false |
| Restored | true | false |

The direct and real existing claim/callback/manual-retry fixtures passed.
All74 existing table hashes, normalized old catalogue, OAuth/English/protected
M02 and unchanged claim ports were preserved. Actual34/35 and candidate36 used
source-pinned functional SQL; history36 was inserted only inside the outer
rollback transaction. DDL/data/catalogue/trace-role rollback restored owned33;
both disposable databases and new33 roles were removed. Original29 data/full
Auth-Storage catalogue/profile and existing global role OIDs/attributes/
memberships remained exact; the shared lock released.

The original7cff185 current seals remain exact. Failed207's229 and failed281's233
archived byte maps/receipt references reconstruct exactly. Their failures remain
historical failures, with no replay or replacement. The forward fix retains
all unrelated OAuth/Auth fields and full atomic claims_count, normalizing only
the separately admitted trace-owner row and EPS schema grant in both hashes.

Canonical remains35/web6L6v/worker2uAS/English1.0 at this checkpoint. This receipt
has cloud/provider/runtime-configuration/business-write flags false. No native
media, Storage HTTP, deployed restore, actual successful/failed upload, live
provider usage or hosted AT074 acceptance is granted by this owned-local proof.
Next: actual-proof admission and guarded canonical36 inspect/apply/readback,
then the fixed before/after observer and two actual ordinary-app job IDs.
