# M05 immutable versions and canonical rendering

Implementation authorized after M04 commit `c12eb53bc2fe20b6e455f6020e788b8801710ef1`.
Canonical and owned local history is23. Hosting remains deferred. Root owns
cloud release and activation; this lane owns additive SQL and isolated proof.
No previous migration, source seal, retained evidence or user record is edited.

## Sources and interfaces

The M05 packet, PRD, architecture, page/template contracts, database schema,
transaction/access contracts, API/OpenAPI mapping, manifest/render schemas,
WF03, test strategy, release evidence and happy-path fixture govern this work.
`packages/domain/src/presentation-types.ts` is the agreed DTO source. The API
lane owns strict parsers, public contracts and fixtures; the native lane owns
PDF work and existing11-port transport integration.

Private `RenderSnapshot` freezes version/series/workspace/project IDs, version
number, UTC capture string, all3 generation guards, template identity plus6
font hashes, trusted render configuration, audience, cover, stable ordered
slides and exact unique source inventory. Private asset entries include fixed
bucket/object key, checksum/size/MIME, geometry, duration, source and timestamp.
No transcripts, full reusable facts, internal notes, credentials or signed URLs
enter this snapshot. The accepted10 displayed fields are retained literally.

The closed published manifest remains16 root keys and5 asset
keys; root approved an explicit nullable role_category as the15th slide key
before the first saved version. Versioned template1.1 displays all11 Pending
requirements and the separate role category, without changing retained1.0 bytes.
Safe internal version context supplies frozen title/template/frames;
private asset paths never enter public DTOs. Immutable slide IDs include the
cover. Selection fixture is8 pages and Shortlist6; the no-role case is2.

Hashes use existing `eps.cast_canonical`, sorted closed ASCII keys, UTF8 SHA256,
protocol `eps-cast-canonical-v1`. Preserve timestamp strings, including PostgreSQL
fractional precision. Snapshot, manifest-content and inventory hashes are
distinct. Actual uploaded manifest/PDF byte checksums remain separately named.

Public RPCs are `eps_generate_version(p_series_id,p_input,p_idempotency_key)`,
`eps_list_versions(p_series_id,p_options)`, `eps_get_version(p_version_id)` and
`eps_get_version_asset(p_version_id,p_asset_id,p_purpose)` where purpose is
pdf/frame/logo/video. Generation requires current workspaces.write,
presentations.generate, cast.read and project write. Fixed-version reads use
workspaces.read plus current project read, without library access.

## Database slices

1. Reuse existing constrained owner roles. Add version/slide/source-pin tables
   with FORCE RLS, private immutable snapshot/manifest/hash columns, append-only
   content and lifecycle-only service updates. Add protected disabled processing
   configuration. Its initial trusted origin is `http://127.0.0.1:3000`, renderer
   `everyone-casting-pdf-v1`; capture both into snapshot and job input. No caller
   URL/Host parameter can select the origin.
2. Generation checks all3 guards under workspace/series and canonical source
   locks; recompute the exact review plus its successful native fit. Source
   SHARE NOWAIT locks avoid inversion with profile/media writers. Allocate the
   series number, capture source pins/slides/content, enqueue job/outbox and
   remember the idempotent acknowledgment atomically. No provider work occurs
   inside the transaction. No workspace draft counter is changed by capture.
3. Protect every referenced source's physical identity/checksum metadata and
   deletion. Library correction, source archive/default changes and assignment
   retirement remain permitted. Historical access follows the version inventory,
   never a live pool/default/profile join. Output manifest and PDF references
   retain validated artifacts. Out-of-band loss of object bytes is a real
   integrity/restore failure, not something a database FK can repair.
4. Extend existing job/outbox/event constraints and the existing11 runtime ports
   for `presentation_render` with prepare_presentation, render_presentation,
   validate_presentation and publish_presentation. Claims/callbacks/recovery
   compare captured version/snapshot/manifest/inventory and current requester
   authority; they NEVER compare the current workspace fingerprint after capture.
5. Render reserves both `presentation_manifest` and `presentation_pdf` in the
   private `eps-presentation-outputs` bucket using attempt-specific UUID paths.
   Scope asset access to exact retained inputs, verified predecessor outputs or
   active reservations. Existing purposes/buckets/operations keep their behavior.
6. Publish requires the closed canonical9-key result, current lease, both Ready
   outputs, exact immutable manifest, verified PDF checksum/page count and the
   persisted validation proof. Attach both artifact IDs once, then advance the
   latest-ready pointer only when its version number increases. Ready content,
   source pins and artifact attachment cannot be overwritten by retry/late work.
7. Cancel/failure/retry update lifecycle only; cancellation cannot publish and
   retry never allocates another version. A presentation-only explicit retry
   budget refresh is root-approved; legacy job semantics stay unchanged.

No presentation_exports, review links or guest media grants are created in M05.
Permanent PDF video targets are fixed-version authenticated app routes derived
from frozen trusted origin; public manifests remain URL-free.

## Runtime payload agreement

Lease.input has9 keys: schema_version,workspace_id,series_id,version_id,
snapshot_sha256,manifest_sha256,inventory_sha256,configuration,input_hash.
Persisted jobs.input has the first8. Stage getInput adds job_id,attempt_id,stage,
snapshot,prepared,rendered,validated:16 flat keys total. Missing predecessor
payloads are null; later stages consume exact persisted predecessors.

Prepared is the agreed9-key technical receipt. Rendered is8 keys with2 verified
asset refs and a16-key renderer proof including ordered link_targets_sha256.
Validated is8 keys with the3 frozen hashes and9-key independent PDF proof.
Publish uses the existing canonical9-key result schema. No text/path/token
diagnostics are recorded as stage proof.

Limits: snapshot/manifest8MiB, PDF64MiB,1000 total pages including cover.
The frame/source buckets are eps-brand-assets,eps-candidate-assets and
eps-candidate-outputs. Output parent/time and image/video geometry metadata are
null. Actual PDF point dimensions are recorded, with at most0.5pt tolerance
around1200x675 and identical geometry across pages; no proof values are rounded.

## Planned evidence

- Owner-independent actual-role RLS, direct RPC null/type/scope denial, same-key
  acknowledgment and conflicting-key tests; all source/private data stays local.
- Stale profile/client/project/source change between review and capture rejects
  without allocating a version, even if workspace counters remain unchanged.
- Actual two-principal source-lock and concurrent version allocation races.
- CaptureV1, change draft/source/default/logo/assignments, then completeV1 and
  generateV2: private/publicV1 content and source identities remain byte-stable.
- Out-of-orderV3-beforeV2 publication, failedV4, duplicate stage callbacks,
  cancellation/late callbacks, retry same snapshot, immutable Ready artifacts.
- Scoped output reservation/verification and historical source access after
  archive; wrong version/job/attempt/source/output path and unauthorized reads
  deny. Retention rejects source identity mutation/deletion.
- Exact compact catalog/business/Auth/runtime/config before/expected/rollback
  proof, guarded local promotion, then a separately reviewed root-only cloud
  release. Existing proof history remains retained.

SQL-injected synthetic artifact receipts prove domain behavior only. Real
native PDF bytes, downloaded app files, visual pages, links and live n8n/worker
evidence are owned by the other lanes and root before M05 can be verified.
