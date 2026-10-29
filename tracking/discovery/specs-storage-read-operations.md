# Specs private Storage read compatibility

Observed 2026-10-29 in the owner-selected canonical project. This concerns the
existing private document boundary; it does not select hosting or establish
uploaded-file acceptance by itself.

The first signed-in PDF upload stored its original bytes and reservation, then
completion failed with HTTP400 / `NoSuchKey` / legacy404. The browser retained
the same upload intent. Read-only inspection found the object metadata, matching
size/eTag, valid business scope and unchanged policy/helper definitions. Actual
authenticated Storage SELECT statistics showed zero rows and no row locking.
Version/archive/delete-marker filters did not explain the failure.

The authenticated dashboard's failed target-file event recorded Storage1.80.2,
role `authenticated`, operation `object.get_authenticated_info` and a metadata
route. The application SDK and bounded request probe used the ordinary object
body path. A gateway/CDN metadata authorization step is an inference; the public
Storage route source defines metadata and body routes separately.

The exact hosted observation is retained in
[the safe operation receipt](../evidence/m02/specs-runtime/2026-10-29-hosted-storage-operation-mismatch.json).
Raw request headers, URLs with tokens and error payloads were not exported.

Official pinned sources:

- [Storage1.80.2 operation names](https://raw.githubusercontent.com/supabase/storage/v1.80.2/src/http/routes/operations.ts)
  define `storage.object.get_authenticated` and legacy
  `object.get_authenticated_info` separately.
- [Body GET routes](https://raw.githubusercontent.com/supabase/storage/v1.80.2/src/http/routes/object/getObject.ts)
  use the body operation and caller RLS for private buckets.
- [Metadata GET routes](https://raw.githubusercontent.com/supabase/storage/v1.80.2/src/http/routes/object/getObjectInfo.ts)
  use the metadata operation and the same caller-RLS lookup for private buckets.
- [Storage log documentation](https://supabase.com/docs/guides/storage/debugging/logs)
  identifies the dashboard Storage category and structured operation diagnostics.

The correction adds only the exact metadata read operation to the three existing
specs SELECT expressions. Existing original ownership/workspace checks and
attempt-scoped capability checks remain required. Listing, signing, public
metadata, HEAD and mutations gain no permission. Historical migration11 remains
unchanged; a new coordinated migration carries the correction.

Local role-policy assertions, preservation snapshots and a guarded cloud
readback are separate evidence from the required real app retry and worker
GET/POST/readback/provider processing. The latter determines whether this change
resolves the observed end-to-end failure.

Verified outcome: the same retained PDF request completed after migration13, followed by the mixed Arabic DOCX. The real worker original GET, private prepared JSON POST/readback and three-stage n8n/OpenAI application passed. Four missing/invalid grant reads were denied. See [actual file evidence](../evidence/m02/live-specs-files/README.md). Worker public-key headers required no change; actual successful file preparation verifies this boundary.
