import type { WorkspaceReview } from '../../packages/domain/src/review-types.ts';
import { slideWordingFields } from '../../packages/domain/src/casting-types.ts';
import registry from '../../packages/templates/registry.json';

export function fitReview(): WorkspaceReview {
  const fields = Object.fromEntries(slideWordingFields.map(key => [key, 'Not provided'])) as WorkspaceReview['slides'][number]['fields'];
  fields.name_or_id = 'Synthetic fixture'; fields.languages_accents = 'Arabic; English';
  return { workspace_id: 'workspace', series_id: 'series', input_fingerprint: 'a'.repeat(64), draft_revision: 1, output_type: 'selection', candidate_slide_count: 1, pending_slide_count: 0, issues: [], can_generate: false, unreviewed_candidate_ids: ['person'],
    template: { key: registry.key, version: registry.version, content_sha256: registry.content_sha256, font_key: registry.font_key },
    cover: { project_name: 'Synthetic casting fixture', client_name: 'Synthetic client', title: 'Cast Selection', output_type: 'selection', logo_asset_id: null, logo_placement: 'cover' },
    slides: [{ kind: 'candidate', role_id: 'role', role_name: 'Father', slot_id: 'slot', slot_label: 'Father 1', assignment_id: 'assignment', workspace_candidate_id: 'pool', candidate_id: 'person', candidate_media_id: null, position: 'option', review_status: 'unreviewed', assignment_row_version: 1, workspace_candidate_row_version: 1, candidate_row_version: 1,
      requirements: { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null }, provisional: false, fields: { ...fields }, source_fields: { ...fields }, frames: [], video_asset_id: null }],
    fit: { status: 'unmeasured', input_fingerprint: null, measured_at: null, overflows: [], error_code: 'FIT_MEASUREMENT_REQUIRED' } };
}
