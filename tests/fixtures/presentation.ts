import registry from '../../packages/templates/versions/1.1.0/registry.json';
import type { FrozenAsset, FrozenSlide, RenderSnapshot, PresentationVersion } from '../../packages/domain/src/presentation-types.ts';
import { manifestFromSnapshot, renderContextFromSnapshot } from '../../packages/domain/src/presentation.ts';
import type { RoleRequirements } from '../../packages/domain/src/specs-types.ts';
import { slideWordingFields } from '../../packages/domain/src/casting-types.ts';
import type { ReviewFields } from '../../packages/domain/src/review-types.ts';

/** Synthetic IDs/text only. Native tests replace placeholder byte metadata
 * with the checksums of their actual locally generated synthetic files. */
export const presentationId = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export function presentationRequirements(): RoleRequirements {
  return { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [],
    scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null };
}
export function presentationFixture(options: { frames?: 0 | 1 | 2 | 3; logo?: boolean } = {}): RenderSnapshot {
  const id = presentationId; const version = id(1); const video = id(10); const logo = options.logo ? id(30) : null;
  const empty: FrozenSlide = { id: id(2), version_id: version, order: 0, kind: 'cover', assignment_id: null, candidate_id: null,
    role_label: null, role_category: null, slot_label: null, position: null, fields: null, requirements: null, frame_asset_ids: [], video_asset_id: null,
    logo_asset_id: logo, role_id: null, slot_id: null, candidate_media_id: null, provisional: false, review_status: null, frames: [] };
  const frames = Array.from({ length: options.frames ?? 2 }, (_, n) => ({ asset_id: id(20 + n), source_asset_id: video,
    timestamp_ms: 1000 + n * 1000, width: 800, height: 450, sha256: String(n + 1).repeat(64) }));
  const assets: FrozenAsset[] = [{ asset_id: video, sha256: 'a'.repeat(64), asset_kind: 'candidate_video', mime_type: 'video/mp4', byte_size: 1000,
    bucket: 'eps-source', object_key: `assets/${video}/original.mp4`, width: 800, height: 450, duration_ms: 10000, source_asset_id: null, timestamp_ms: null },
  ...frames.map(frame => ({ asset_id: frame.asset_id, sha256: frame.sha256, asset_kind: 'candidate_frame' as const, mime_type: 'image/jpeg', byte_size: 100,
    bucket: 'eps-derived', object_key: `assets/${frame.asset_id}/frame.jpg`, width: frame.width, height: frame.height, duration_ms: null,
    source_asset_id: frame.source_asset_id, timestamp_ms: frame.timestamp_ms }))];
  if (logo) assets.push({ asset_id: logo, sha256: 'b'.repeat(64), asset_kind: 'client_logo', mime_type: 'image/png', byte_size: 100,
    bucket: 'eps-source', object_key: `assets/${logo}/original.png`, width: 600, height: 200, duration_ms: null, source_asset_id: null, timestamp_ms: null });
  return { schema_version: '1.0', hash_protocol: 'eps-cast-canonical-v1', version_id: version, series_id: id(3), workspace_id: id(4), project_id: id(5),
    version_no: 1, created_at: '2026-10-29T21:00:00.123456+00:00', input_workspace_row_version: 3, input_draft_revision: 2, input_fingerprint: 'c'.repeat(64),
    template: { key: registry.key, version: registry.version, content_sha256: registry.content_sha256, font_key: registry.font_key,
      font_hashes: Object.fromEntries(registry.fonts.map(font => [font.path, font.sha256])) },
    render_configuration: { renderer_version: 'everyone-casting-pdf-v1', application_origin: 'http://127.0.0.1:3000' },
    audience_snapshot: { id: id(6), key: 'synthetic-internal', label: 'Synthetic internal', scope: 'internal', settings: {}, archived: false, row_version: 1 },
    cover: { project_name: 'Synthetic Project', client_name: 'Synthetic Client', title: 'Synthetic Selection', output_type: 'selection', logo_asset_id: logo, logo_placement: 'cover' },
    slides: [empty, { ...structuredClone(empty), id: id(7), order: 1, kind: 'candidate', assignment_id: id(8), candidate_id: id(9),
      role_label: 'Synthetic Role', role_category: 'Synthetic category', slot_label: 'Synthetic Slot1', position: 'option',
      fields: Object.fromEntries(slideWordingFields.map(key => [key, key === 'name_or_id' ? 'Synthetic Candidate' : 'Not provided'])) as ReviewFields,
      requirements: presentationRequirements(), frame_asset_ids: frames.map(frame => frame.asset_id), video_asset_id: video, logo_asset_id: null,
      role_id: id(40), slot_id: id(41), candidate_media_id: id(42), review_status: 'unreviewed', frames },
    { ...structuredClone(empty), id: id(43), order: 2, kind: 'pending', role_label: 'Synthetic Role', role_category: 'Synthetic category', slot_label: 'Synthetic Slot2',
      role_id: id(40), slot_id: id(44), requirements: presentationRequirements(), provisional: true, logo_asset_id: null }],
    asset_inventory: assets.sort((a, b) => a.asset_id.localeCompare(b.asset_id)) };
}
export function presentationVersionFixture(snapshot = presentationFixture()): PresentationVersion {
  return { id: snapshot.version_id, series_id: snapshot.series_id, version_no: snapshot.version_no, status: 'queued',
    input_draft_revision: snapshot.input_draft_revision, input_fingerprint: snapshot.input_fingerprint, template_version: snapshot.template.version,
    manifest_hash: 'd'.repeat(64), slides: manifestFromSnapshot(snapshot).slides, pdf_asset_id: null, manifest_asset_id: null,
    created_at: snapshot.created_at, ready_at: null, generation_job_id: presentationId(50), generated_by: presentationId(51), failure_code: null,
    render_context: renderContextFromSnapshot(snapshot) };
}
