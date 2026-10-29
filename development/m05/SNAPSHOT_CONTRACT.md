# M05 immutable capture and API contract

Implementation contract agreed before the first M05 saved version. This is a
typed/local interface checkpoint, not a claim of canonical migration, real PDF
publication or hosted acceptance. Hosting remains deferred.

## Capture and hashes

`generate_version` keeps all three required guards:
`expected_workspace_row_version`, `expected_draft_revision`, and
`expected_input_fingerprint`. Its only optional input is a bounded nullable
`generation_note`. The caller cannot choose an application origin, storage path,
template hash, render snapshot, actor or version number.

The canonical transaction validates current project/write and the
`presentations.generate`, `workspaces.write`, and `cast.read` capabilities,
recomputes the complete reviewed fingerprint, checks successful actual fit for
that same series/template/fingerprint and captures one coherent immutable
snapshot. Missing values, fewer frames, no Main and Pending remain permitted.
Version allocation, snapshot/slides, render job and outbox commit together.
Repeated idempotent intent returns the same version/job.

The private [RenderSnapshot schema](../../contracts/json-schema/presentation-render-snapshot.schema.json)
and [TypeScript contract](../../packages/domain/src/presentation-types.ts) freeze:

- Version/series/workspace/project IDs, version number, exact capture timestamp
  and the three captured input guards.
- Registered template identity, content SHA, font key and six exact font hashes.
- `render_configuration`, including renderer version and application origin
  captured from owner-managed server configuration. The job copies this fixed
  configuration. A request Host/Origin/body never supplies it.
- Audience snapshot and full cover, including captured presentation title,
  project/client display values and logo placement.
- Stable immutable slide IDs/order, cover, accepted ten-field candidate text,
  per-slot Pending requirements, separate role category and selected original
  video/frame metadata. One person in two assignments remains two slides.
- The exact sorted, unique selected asset inventory: content SHA, MIME, size,
  dimensions/duration/source/timestamp and private bucket/object key.

It excludes full reusable facts, original fact fields, transcript, private notes,
credentials and signed/bearer URLs. All displayed wording is already accepted
content. Source-asset references remain pinned after profile/default/project
media changes and ordinary source archive.

`hash_protocol` is `eps-cast-canonical-v1`: UTF-8 SHA256 of recursively sorted
ASCII object keys, preserved array order, safe integer numbers and exact string
values. Preserve PostgreSQL microsecond timestamp strings; do not normalize them
through `Date.toISOString()`. Snapshot, public manifest and inventory have their
own content hashes. An uploaded artifact's actual byte SHA is independently
verified even when canonical JSON serialization makes it equal to its content
hash. The metadata budget is8MiB UTF-8; total slides including the cover are
bounded at1000. Exceeding a technical budget produces a failure, not truncation.

## Public manifest and internal viewer

The [closed public manifest](../../contracts/json-schema/presentation-manifest.schema.json)
is derived once from that snapshot. Its root remains the existing16 fields;
the selected asset inventory exposes only ID/SHA/kind/MIME/size. Private storage
destinations never enter it.

Before any saved M05 version, the initial contract was repaired to include a
required nullable `role_category` on `VersionSlide`, separate from all11
`RoleRequirements` keys. Classification was already required for Pending by
the template specification and is not inferred or hidden in other instructions.
The slide now has15 published fields. This is an initial unsaved-contract repair,
not a rewrite of historical content.

The retained registered1.0.0 renderer/font/registry bytes remain untouched.
New1.1.0 Pending pages show category plus all11 explicitly labelled requirements,
including Not provided for absent values. New series select1.1.0 and must be
reviewed/measured there. A legacy1.0 series cannot silently change its pin or
receive generation credit from its old fit; it gets `TEMPLATE_UPGRADE_REQUIRED`.
`ReviewSlide.role_category` remains optional for legacy1.0 response compatibility;
the1.1 projection always supplies its nullable value.

Internal `PresentationVersion` retains its published metadata/slides and adds
`manifest_asset_id`, `generated_by`, safe `failure_code` and `render_context`.
The latter contains captured cover/template identity and per-slide IDs,
role/slot IDs, provisional/Reviewed state and frame geometry. It is derived only
from the immutable snapshot. The saved viewer needs no mutable library read to
reconstruct its title, fields, requirements or frames. Navigation may separately
read current series/workspace identity; it cannot supply historical content.

Only Ready versions attach both distinct manifest/PDF asset IDs and `ready_at`.
Queued/rendering/failed versions keep those publication fields null. A failed
version retains a safe diagnostic code. Status/artifacts may change; captured
content and slide IDs cannot change under the same version ID.

## Acting-user operations and retained media

| Operation | Canonical RPC or behavior |
| --- | --- |
| `list_versions` | `eps_list_versions(p_series_id,p_options)` with bounded cursor/limit |
| `generate_version` | `eps_generate_version(p_series_id,p_input,p_idempotency_key)`;202 `JobAccepted.resource_id` is the version ID |
| `get_version` | `eps_get_version(p_version_id)` returns the frozen safe projection |
| `download_version_pdf` | Ready canonical PDF,90-second exact-object signed access and fixed safe filename |
| `play_version_media` | POST `/versions/{version_id}/media/{asset_id}/playback`; exact retained original,90-second access, nonnull matching `source_version_id` |
| Image bytes | GET `/versions/{version_id}/media/{asset_id}/content`; retained frame/logo only, bounded streamed size/type/SHA verification |
| PDF bytes | GET `/versions/{version_id}/pdf/content`; Ready canonical PDF with bounded streamed size/type/SHA verification |

Version/list/media/PDF reads require `workspaces.read` and current project read,
without acquiring global Cast Library access. The scoped
`eps_get_version_asset(p_version_id,p_asset_id,p_purpose)` accepts only
`pdf|frame|logo|video` and returns an internal `{asset:MediaAsset,bucket,object_key}`
projection for the actual pinned object. API clients never choose its path.

Storage uses the verified user's existing JWT, current retained-version
authorization and the three exact operations `object.get_authenticated_info`,
`object.get_authenticated`, and `object.sign`. No service-role fallback, listing,
HEAD/upload/write grant or general signer is introduced. Signed destinations
must match the configured private Storage origin and exact authorized object.
Binary companions remain outside MCP; the five semantic JSON version operations
share HTTP/MCP actor, guard, idempotency and error behavior.

Canonical PDF bytes embed stable authenticated
`/presentations/versions/{version_id}/media/{asset_id}` landing URLs built from
the captured trusted application origin. They never embed90-second Storage
URLs. Local127.0.0.1 URLs are local PDF acceptance only, not production hosting.
Guest tokens, exports and media grants remain M06.

## Worker and retry boundary

After capture, stage claims/callbacks bind the immutable version/snapshot/
manifest/inventory/configuration and current requester authority. They do not
compare the now-mutable working draft fingerprint. Later draft edits are
permitted and affect a future capture.

The exact small lease input is `schema_version`, `workspace_id`, `series_id`,
`version_id`, `snapshot_sha256`, `manifest_sha256`, `inventory_sha256`,
`configuration` and `input_hash`. Stage input adds job/attempt/stage, snapshot
and the persisted `prepared`, `rendered`, `validated` predecessor results.
Prepare/render/validate/publish remain separate stages; events contain bounded
metadata and asset references, never image/PDF bytes. Ready advances the series
pointer only monotonically by version number. Final publication requires the
closed render result, both verified assets and independent PDF validation.

An explicit authorized retry of a failed, noncancelled presentation reuses the
same version/snapshot and resets only that stage's automatic retry budget.
The lifetime attempt count remains monotonic. Cancel is terminal; late callbacks
are stale and a new version capture is needed. Presentation Job responses carry
server-derived `can_retry` and `can_cancel`; clients do not infer these actions
from `attempt < 3` or a legacy retryable error. Legacy job response shapes retain
their previous behavior.

The pure `summarizePresentationChanges(currentReview,lastVersion)` supports only
the working-draft section. It compares the exact series/fingerprint and frozen
public values for assignment additions/removals, wording, media, casting/order,
requirements/category, branding and template changes. A fingerprint-only change
has an unspecified shared-source label; no cause is invented. Saved viewing
always consumes frozen version content.

## Evidence boundary

The synthetic typed fixture and focused domain/central/HTTP/MCP/schema tests
exercise these contracts and metadata integrity. Disposable SQL sessions,
actual native PDF bytes/visual inspection, canonical release and the signed-in
download/version-preservation journey have separate evidence. Passing the typed
or transport layer alone does not establish those later acceptances.
