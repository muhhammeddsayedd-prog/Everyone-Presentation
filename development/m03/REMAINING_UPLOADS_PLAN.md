# Remaining uploads implementation contract

Root owns integration, OpenAPI/MCP catalogs and migration composition/release.
This slice owns the disjoint upload helpers/UI, shared upload DTO, candidate
storage adapter and `remaining-uploads.sql`. Migration17 stays immutable. No
cloud/provisioning/hosting or old release helper is run by this slice.

Agreed DTO:

- UploadSession protocol accepts signed_put or tus. Existing required fields
  remain. A TUS response additionally requires upload_metadata with exactly
  bucketName/objectName/contentType/cacheControl, and chunk_size6291456.
- The signed TUS endpoint is `/storage/v1/upload/resumable/sign` on the verified
  direct Storage hostname. Headers carry x-signature and x-upsert:false, never
  an acting JWT or service key. GET session renews a scoped two-hour signature.
- Persist only actor/workspace/intent/file identity, stable idempotency keys and
  a credential-free relative TUS resource locator/confirmed offset. Verify its
  base64url bucket/object/version against the fresh server session before HEAD
  or PATCH. No signed URL/token/headers or file bytes enter sessionStorage.
- Completion requires actual Storage length/type then native video validation;
  support completion additionally requires bounded bytes/hash/content validation
  and a new purpose-isolated signed verification proof.

Supporting files require explicit existing/manual candidate_id at reservation.
There is no pending identity, automatic filename association, new-person creation,
AI processing or frame selection from support images. PNG/JPEG/WebP5MiB;
PDF/DOCX/UTF-8 text20MiB; both also obey the current environment cap.

CandidateSupport fields: id,row_version,candidate_id,asset MediaAsset,created_at.
List: GET /candidates/{id}/supporting-files, global cast.read. Archive association:
POST /candidate-support/{id}/archive with row_version, cast.read+cast.write. Bytes
and historical references remain; no physical delete. Reserve/finalize require
cast.read+cast.upload and writable origin workspace. Root owns published parity.

New central factory: createCandidateSupportStorageAdapter. New public support
RPCs reserve/get/prepare/finalize/cancel upload, list/archive support, and get
support asset. Root integrates purpose-specific storage probing. A new private
support verifier key is provisioned only by root after local proof/review; no
document, logo or n8n key is reused. Default support configuration is disabled.

Primary sources checked on29October2026:

- https://supabase.com/docs/guides/storage/uploads/resumable-uploads : direct
  Storage hostname,6MiB chunks,24-hour resource expiry and signed x-signature.
- https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl
  : signed upload token lifetime2hours.
- https://raw.githubusercontent.com/supabase/storage/master/src/http/routes/tus/index.ts
  : signed routes, allowed headers, HEAD/PATCH/DELETE, finished-upload termination
  disabled.
- https://raw.githubusercontent.com/supabase/storage/master/src/http/routes/tus/lifecycle.ts
  : /sign suffix, signature verification on requests, base64url resource locator.
- https://tus.io/protocols/resumable-upload :1.0.0 creation,HEAD offsets,PATCH
  acknowledgement/409 protection,expiration andtermination semantics.

Acceptance remains split: deterministic interruption/lost-ACK/reload/security and
SQL race/fence tests first; root subsequently verifies actual signed TUS/CORS and
support uploads in the app. A source/parser/unit pass is not live Storage proof.

Implemented local handoff (29 October 2026):

- `apps/web/components/CandidateResumableUploads.tsx`: independent files, at most
  two active transfers, bulk Upload/resume, per-file Pause/Cancel, confirmed byte
  progress, tab reload recovery and same-file SHA verification. It consumes the
  session's `storageOrigin`; missing or foreign origin fails before credential
  forwarding. Completion and cancellation use stable separate idempotency keys.
- `apps/web/lib/resumable-transfer.ts`: TUS1.0 POST, HEAD, six-MiB PATCH and
  unfinished DELETE; redirects/credentials/caching/referrer are disabled. It
  supports both official resource version separators (`/` and `-$v-`), checks
  exact object scope and confirmed offsets, bounds each HTTP request at120s,
  and leaves uncertain writes for a fresh HEAD on explicit Resume.
- `candidate-transfer-intent.ts` serializes only a closed set of file metadata,
  IDs, stable keys and credential-free relative locator/offset. Credentials,
  headers, signed URLs and bytes are discarded; restoration rejects extra keys.
- `SupportingFiles.tsx`: paged list, private content read, versioned archive and
  explicit candidate upload. `workspaceId` is optional for list/read-only use.
  `onDirtyChange` includes active transfer/archive operations.
- Central storage modules retain Ready reads with uploads disabled. Video
  completion confirms actual Storage info first, then queues native verification;
  it never downloads or marks a video Ready in the handler. Support completion
  streams bounded original bytes, validates SHA/type/format and signs its separate
  candidate-bound proof before the short final transaction.
- `remaining-uploads.sql` defaults support off. New forced-RLS upload/config/key/
  association tables, isolated NOLOGIN owners, private verification helpers and
  exact public RPC grants provide atomic Ready+association, replay/expiry/cancel
  fences, archive and known retained original reads. The independent metadata-only
  pending-video info policy preserves the prior Storage guard expression.
- Explicit `link_existing` calls private `eps.support_move_after_merge` only from
  the cast owner after the existing source/target checks. It moves Ready support
  associations once, increments their versions and audits them. Upload proof scope
  and original bytes remain unchanged. The exact reviewed17
  `eps.cast_link_duplicate(uuid,jsonb,text)` prosrc SHA is guarded as
  `77ed6422c08d43c55829719bb729474faaf3077691c334691063d95a84e20952` before one
  hook insertion; original candidate-media/workspace choice logic is retained.

Public RPCs for root integration:

```
eps_reserve_support_upload(p_input,p_idempotency_key)
eps_get_support_upload(p_upload_id)
eps_prepare_support_completion(p_upload_id,p_input,p_idempotency_key)
eps_finalize_support_completion(p_upload_id,p_input,p_idempotency_key,p_payload,p_mac)
eps_cancel_support_upload(p_upload_id,p_idempotency_key)
eps_get_candidate_support_asset(p_asset_id)
eps_list_candidate_support(p_candidate_id,p_cursor default null,p_limit default25)
eps_archive_candidate_support(p_support_id,p_input,p_idempotency_key)
```

List default25/max100 returns `{data,page:{next_cursor}}`. CandidateSupport is
`{id,row_version,candidate_id,asset,created_at}`. The SQL archive RPC takes
`{row_version}` and returns the private acknowledgement `{ok:true}`. The Central
adapter validates that exact acknowledgement and returns the published HTTP/MCP
`Success` value `{success:true,affected_ids:[candidate_support_id]}`. The strict
`CandidateSupportArchive` request schema accepts only `row_version`; `reason`
and asset-deletion fields are rejected before the service is called. This is an
additive M03 association operation, not a change to generic archive requests.
CompleteUpload must set `start_processing:false` for support;
support never creates a job. No attach endpoint exists: reservation requires
`candidate_id` and `workspace_id` and current cast.read+cast.upload+workspace write.

Private root provisioning, after review/release only:

- `.env.support-runtime.local` has exactly
  `CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED=false`,
  `EPS_SUPPORT_VERIFIER_KEY_ID=eps-candidate-support-local-20261029-v1` and
  `EPS_SUPPORT_VERIFIER_KEY_HEX=<new independent32-bytehex>`; protected owner/SYSTEM
  ACL. No existing secret is reused or copied into tracking.
- The corresponding key belongs only to `eps.support_verification_keys`, purpose
  `candidate_support`, raw32-byte secret. Match the server key ID; enforce
  not_before/not_after/revocation. Root owns the reviewed private provisioning
  transport; this fragment contains no key material.
- SQL `eps.candidate_support_config.uploads_enabled` and the matching web flag
  both start false. Current effective upload cap is passed as maximumBytes;
  images remain capped5MiB, documents20MiB even if the environment supports more.
- `SupportStorageOptions.verifyDocument` is
  `verifyCandidateSupportOriginal(bytes,mime,{sourceAssetId,purpose:'candidate_support'})`.
  `signReceipt` calls `signSupportReceipt` with fixed version/audience/purpose,
  current integer issued/expires seconds (max120), separate key ID and private raw
  key. Never expose proof/key through API/MCP or browser storage.

Evidence: final support-only owned-local17 rollback
`tracking/evidence/m03/support-local/2026-10-29T13-29-01-939Z-2aa1867c.json` passed
with exact rollback/source stability. It covers positive text/images, one
association per upload, paged/cross-candidate cursors, original-hash/identity
retention during explicit merge, permission/private-helper/key isolation,
idempotency replay, cancellation, expiry, revoked keys and a trigger that alters
verified dimensions (the whole attempted completion rolls back). SQL fixture
receipts are synthetic state proof; real image/document byte admission is covered
separately by SDK/Sharp tests. The current25 focused tests, full typecheck and
scoped ESLint passed; hashes are in `support-local/implementation-summary.json`.

Root still needs the combined migration rehearsal/release, protected key
provisioning, current app build/integration, and real signed TUS/CORS acceptance.
For that app check use an authorized synthetic13–20MiB valid video: pause after
one confirmed6MiB chunk, resume from that nonzero HEAD offset, then reload/reselect
and resume again. Verify per-file cancellation cannot attach/queue late bytes and
support images/documents attach only to the explicitly chosen existing profile.
Keep actual hosted Storage proof distinct from the deterministic transport tests.
