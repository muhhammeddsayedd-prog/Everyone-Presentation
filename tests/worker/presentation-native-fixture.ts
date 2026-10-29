import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import type { RenderSnapshot } from '../../packages/domain/src/presentation-types.ts';
import { slideWordingFields } from '../../packages/domain/src/casting-types.ts';
import registry from '../../packages/templates/versions/1.1.0/registry.json';

const id = (n: number) => `a5050000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
/** Synthetic geometric images only. No cast, private media or network fixture. */
export function nativePresentation(frameCounts = [0, 1, 2, 3], logo = true, pending: 'role' | 'no_role' | null = null) {
  const images = new Map<string, Uint8Array>();
  const snapshot: RenderSnapshot = {
    schema_version: '1.0', hash_protocol: 'eps-cast-canonical-v1', version_id: id(1), series_id: id(2), workspace_id: id(3), project_id: id(4), version_no: 1,
    created_at: '2026-10-29T21:00:00.000000Z', input_workspace_row_version: 1, input_draft_revision: 1, input_fingerprint: 'a'.repeat(64),
    template: { key: registry.key, version: registry.version, content_sha256: registry.content_sha256, font_key: registry.font_key, font_hashes: Object.fromEntries(registry.fonts.map(font => [font.path, font.sha256])) },
    render_configuration: { renderer_version: 'everyone-casting-pdf-v1', application_origin: 'http://127.0.0.1:3000' },
    audience_snapshot: { id: id(5), key: 'internal', label: 'Internal', scope: 'internal', settings: {}, archived: false, row_version: 1 },
    cover: { project_name: 'Synthetic casting', client_name: 'Synthetic client', title: 'Cast Selection', output_type: 'selection', logo_asset_id: logo ? id(6) : null, logo_placement: 'every_slide' },
    slides: [{ id: id(7), version_id: id(1), order: 0, kind: 'cover', assignment_id: null, candidate_id: null, role_label: null, role_category: null, slot_label: null, position: null, fields: null, requirements: null, frame_asset_ids: [], video_asset_id: null, logo_asset_id: logo ? id(6) : null, role_id: null, slot_id: null, candidate_media_id: null, provisional: false, review_status: null, frames: [] }], asset_inventory: [],
  };
  if (logo) {
    const canvas = createCanvas(200, 100); const ctx = canvas.getContext('2d'); ctx.fillStyle = '#00bd68'; ctx.fillRect(20, 20, 160, 60);
    const bytes = canvas.toBuffer('image/png'); images.set(id(6), bytes);
    snapshot.asset_inventory.push({ asset_id: id(6), sha256: hash(bytes), asset_kind: 'client_logo', mime_type: 'image/png', byte_size: bytes.length, bucket: 'eps-brand-assets', object_key: `assets/${id(6)}/original.png`, width: 200, height: 100, duration_ms: null, source_asset_id: null, timestamp_ms: null });
  }
  for (const [index, count] of frameCounts.entries()) {
    const fields = Object.fromEntries(slideWordingFields.map(field => [field, 'Not provided'])) as NonNullable<RenderSnapshot['slides'][number]['fields']>;
    fields.name_or_id = index === 1 ? 'مريم حسن / Maya' : `Synthetic person ${index + 1}`;
    fields.skills_experience = 'Theatre and movement; comfortable with dialogue.';
    const video = id(20 + index); const videoSha = String(index + 1).repeat(64);
    snapshot.asset_inventory.push({ asset_id: video, sha256: videoSha, asset_kind: 'candidate_video', mime_type: 'video/mp4', byte_size: 1024, bucket: 'eps-candidate-assets', object_key: `assets/${video}/original.mp4`, width: 800, height: 480, duration_ms: 20000, source_asset_id: null, timestamp_ms: null });
    const frames = Array.from({ length: count }, (_value, n) => {
      const asset = id(100 + index * 3 + n); const [width, height] = [[640, 360], [360, 640], [800, 480]][n];
      const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d'); ctx.fillStyle = ['#fe5242', '#2364e9', '#f5c326'][n]; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#fff'; ctx.fillRect(width / 3, height / 4, width / 3, height / 2);
      const bytes = canvas.toBuffer('image/jpeg'); images.set(asset, bytes); const sha256 = hash(bytes); const timestamp_ms = 1000 * (n + 1);
      snapshot.asset_inventory.push({ asset_id: asset, sha256, asset_kind: 'candidate_frame', mime_type: 'image/jpeg', byte_size: bytes.length, bucket: 'eps-candidate-outputs', object_key: `jobs/${id(900)}/attempts/${id(901)}/${asset}.jpg`, width, height, duration_ms: null, source_asset_id: video, timestamp_ms });
      return { asset_id: asset, source_asset_id: video, timestamp_ms, width, height, sha256 };
    });
    snapshot.slides.push({ id: id(300 + index), version_id: snapshot.version_id, order: index + 1, kind: 'candidate', assignment_id: id(400 + index), candidate_id: id(500 + index), role_label: `Role ${index + 1}`, role_category: 'Performer', slot_label: `Slot ${index + 1}`, position: 'option', fields, requirements: { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null }, frame_asset_ids: frames.map(frame => frame.asset_id), video_asset_id: video, logo_asset_id: logo ? id(6) : null, role_id: id(600 + index), slot_id: id(700 + index), candidate_media_id: id(800 + index), provisional: false, review_status: 'unreviewed', frames });
  }
  if (pending) snapshot.slides.push({ id: id(990), version_id: snapshot.version_id, order: snapshot.slides.length, kind: 'pending', assignment_id: null, candidate_id: null, role_label: pending === 'role' ? 'Waiter' : 'Requirements pending', role_category: pending === 'role' ? 'Featured' : null, slot_label: pending === 'role' ? 'Waiter 1' : 'Pending', position: null, fields: null,
    requirements: { age_range: pending === 'role' ? '20-35' : null, gender_requirement: null, appearance_performance: pending === 'role' ? 'Natural delivery\nQuiet physicality' : null, languages: pending === 'role' ? ['Arabic', 'English'] : [], accents: [], skills: pending === 'role' ? ['Movement', 'Dialogue'] : [], scene_references: [], shoot_dates: [], location: pending === 'role' ? 'Cairo' : null, availability_requirements: null, other_instructions: null },
    frame_asset_ids: [], video_asset_id: null, logo_asset_id: logo ? id(6) : null, role_id: pending === 'role' ? id(991) : null, slot_id: pending === 'role' ? id(992) : null, candidate_media_id: null, provisional: false, review_status: null, frames: [] });
  snapshot.asset_inventory.sort((left, right) => left.asset_id.localeCompare(right.asset_id));
  return { snapshot, images };
}
