import referenceRegistry from '../../packages/templates/versions/1.4.0/registry.json';
import captionedRegistry from '../../packages/templates/versions/1.4.1/registry.json';
import type { PictureState, PresentationContext, PresentationScene, ReviewSlide, WorkspaceReview } from '../../packages/domain/src/review-types.ts';
import { slideWordingFields } from '../../packages/domain/src/casting-types.ts';

/** Synthetic template 1.4.0 reviews (no real people): roles with slots of Main/Backup/Option people,
 * optional scenes, notes and presentation portraits. Every identifier is deterministic. */
export const refId = (n: number) => `60000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export interface RefPerson { position: 'main' | 'backup' | 'option'; name?: string; age?: string; height?: string; frame?: boolean; portrait?: 'frame' | 'photo' | null; state?: PictureState; focal?: [number, number] /* thousandths */ }
export interface RefRole { name: string; slots: RefPerson[][]; note?: string | null; slotNotes?: (string | null)[] }
export interface RefScene { title: string; sequence?: string | null; setting?: string | null; occurrences: { role: number; display?: string | null; setting?: string | null; note?: string | null; placement?: 'auto' | 'repeat' | 'hidden' }[] }
export interface RefOptions { scenes?: RefScene[]; output?: 'shortlist' | 'selection'; coverNote?: string | null; logo?: boolean; projectName?: string; template?: typeof referenceTemplate }

const requirements = () => ({ age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null });
const blank = () => Object.fromEntries(slideWordingFields.map(key => [key, 'Not provided'])) as ReviewSlide['fields'];
export const referenceTemplate = { key: referenceRegistry.key, version: referenceRegistry.version, content_sha256: referenceRegistry.content_sha256, font_key: referenceRegistry.font_key };
/** Template 1.4.1: the same pages with name, age and height under each portrait. */
export const captionedTemplate = { key: captionedRegistry.key, version: captionedRegistry.version, content_sha256: captionedRegistry.content_sha256, font_key: captionedRegistry.font_key };

/** Asset identities: frame of person p = refId(5000 + p), its video refId(6000 + p), photo refId(7000 + p), logo refId(9000). */
export function referenceReview(roles: RefRole[], options: RefOptions = {}): WorkspaceReview {
  const slides: ReviewSlide[] = []; const contexts: PresentationContext['slides'] = []; let person = 0;
  roles.forEach((role, r) => {
    const roleId = refId(100 + r);
    (role.slots.length ? role.slots : [[]]).forEach((slot, s) => {
      const slotId = refId(1000 + r * 20 + s); const slotNote = role.slotNotes?.[s] ?? null;
      const base = { role_id: roleId, role_name: role.name, role_category: null, slot_id: slotId, slot_label: `Slot ${s + 1}`, requirements: requirements(), provisional: false };
      if (!slot.length) {
        slides.push({ ...base, kind: 'pending', assignment_id: null, workspace_candidate_id: null, candidate_id: null, candidate_media_id: null, position: null, review_status: null,
          assignment_row_version: null, workspace_candidate_row_version: null, candidate_row_version: null, fields: blank(), source_fields: blank(), frames: [], video_asset_id: null });
        contexts.push({ role_note: role.note ?? null, slot_note: slotNote, picture_state: null, portrait: null });
        return;
      }
      for (const item of slot) {
        const p = ++person; const fields = { ...blank(), name_or_id: item.name ?? `Synthetic Person ${p}`, ...item.age !== undefined ? { age_or_range: item.age } : {}, ...item.height !== undefined ? { height_measurements: item.height } : {} };
        const frame = item.frame === false ? [] : [{ asset_id: refId(5000 + p), source_asset_id: refId(6000 + p), timestamp_ms: 1000, width: 1080, height: 1920, sha256: 'a'.repeat(63) + (p % 10) }];
        slides.push({ ...base, kind: 'candidate', assignment_id: refId(2000 + p), workspace_candidate_id: refId(3000 + p), candidate_id: refId(4000 + p), candidate_media_id: frame.length ? refId(8000 + p) : null,
          position: item.position, review_status: 'reviewed', assignment_row_version: 1, workspace_candidate_row_version: 1, candidate_row_version: 1,
          fields, source_fields: fields, frames: frame, video_asset_id: frame.length ? refId(6000 + p) : null });
        const portrait = item.portrait === 'photo' ? { asset_id: refId(7000 + p), source: 'photo' as const, width: 1200, height: 1600, sha256: 'b'.repeat(63) + (p % 10), focal: item.focal ?? [500, 350] as [number, number] }
          : item.portrait === 'frame' && frame.length ? { asset_id: frame[0].asset_id, source: 'frame' as const, width: 1080, height: 1920, sha256: frame[0].sha256, focal: item.focal ?? [500, 400] as [number, number] } : null;
        contexts.push({ role_note: role.note ?? null, slot_note: slotNote, picture_state: item.state ?? (portrait || frame.length ? 'pinned' : 'unset'), portrait });
      }
    });
  });
  const scenes: PresentationScene[] = (options.scenes ?? []).map((scene, n) => ({ scene_id: refId(10000 + n), scene_number: String(n + 1), title: scene.title, sequence_label: scene.sequence ?? null, setting: scene.setting ?? null,
    occurrences: scene.occurrences.map((item, m) => ({ occurrence_id: refId(11000 + n * 50 + m), role_id: refId(100 + item.role), display_title: item.display ?? null, setting_override: item.setting ?? null, presentation_note: item.note ?? null, deck_placement: item.placement ?? 'auto' })) }));
  const output = options.output ?? 'shortlist'; const candidates = slides.filter(slide => slide.kind === 'candidate');
  return { workspace_id: refId(1), series_id: refId(2), input_fingerprint: 'c'.repeat(64), draft_revision: 1, output_type: output,
    candidate_slide_count: candidates.length, pending_slide_count: slides.length - candidates.length, issues: [], can_generate: false, unreviewed_candidate_ids: [],
    template: options.template ?? referenceTemplate, cover: { project_name: options.projectName ?? 'Synthetic Launch', client_name: 'Synthetic Client', title: 'Cast Shortlist', output_type: output, logo_asset_id: options.logo ? refId(9000) : null, logo_placement: 'cover' },
    slides, fit: { status: 'unmeasured', input_fingerprint: null, measured_at: null, overflows: [], error_code: 'FIT_MEASUREMENT_REQUIRED' },
    presentation: { cover_note: options.coverNote ?? null, scenes, slides: contexts } };
}

/** The Floward reference structure rebuilt with synthetic people (35 pages), used for the visual comparison. */
export function floward(): WorkspaceReview {
  const pair = (backupPicture = false): RefPerson[][] => [[{ position: 'main' }, ...backupPicture ? [{ position: 'backup' } as RefPerson] : []]];
  const options = (n: number, missing = false): RefPerson[][] => [Array.from({ length: n }, (_, i): RefPerson => ({ position: 'option', ...missing && i === 1 ? { frame: false, state: 'intentionally_empty' as const } : {} }))];
  const roles: RefRole[] = [
    { name: 'Delivery Guy', slots: pair() }, { name: 'Saudi Daughter', slots: pair() }, { name: 'Saudi Mother', slots: pair() }, { name: 'Saudi Father', slots: pair() },
    { name: 'Saudi Son', slots: pair(true) }, { name: '2 Featured Female Guests', slots: options(3) },
    { name: '2 Featured Male Guests', slots: [[{ position: 'option' }, { position: 'option', frame: false, state: 'intentionally_empty' }, { position: 'option' }, { position: 'option' }, { position: 'option' }]], note: 'We’ll choose Only One.' },
    { name: 'Date Guy', slots: pair() }, { name: 'Date Girl', slots: pair() }, { name: '2 Featured Waiters', slots: options(2) }, { name: '2 Featured Female Guests', slots: options(3) }, { name: '2 Featured Male Guests', slots: options(3) },
    { name: 'Kuwaiti Father', slots: options(1) }, { name: 'Kuwaiti Son', slots: options(1) },
    { name: 'Car Workers', slots: options(3) }, { name: 'Indian Packaging Worker', slots: options(1) }, { name: '2 Featured Packaging Helper', slots: options(2) },
    { name: 'European Florist', slots: options(1) }, { name: 'Florist Helper', slots: options(1) }, { name: 'Asian Florist Helper', slots: pair() }, { name: 'Indian Florist Helper', slots: options(1) },
    { name: 'Female Indian Web Designer', slots: options(1) }, { name: 'Male Indian Web Designer', slots: options(1) }, { name: 'Web Designer', slots: [[]], note: 'Missing.' }, { name: 'Featured Web Designer', slots: options(1) },
  ];
  const scenes: RefScene[] = [
    { sequence: 'Mother’s Birthday', title: 'Front Door', occurrences: [{ role: 0 }, { role: 1 }, { role: 2 }] },
    { sequence: 'Mother’s Birthday', title: 'Home Gathering', occurrences: [{ role: 1 }, { role: 2 }, { role: 3 }, { role: 4 }, { role: 5 }, { role: 6 }] },
    { title: 'Restaurant Celebration', occurrences: [7, 8, 9, 10, 11].map(role => ({ role })) },
    { title: 'Father’s Day', setting: 'Living Room', occurrences: [{ role: 12 }, { role: 13 }] },
    { title: 'Floward Workshop', setting: 'Car', occurrences: [{ role: 14 }] },
    { title: 'Floward Workshop', setting: 'Packaging', occurrences: [{ role: 15 }, { role: 16 }] },
    { title: 'Floward Workshop', setting: 'Florists', occurrences: [17, 18, 19, 20].map(role => ({ role })) },
    { title: 'Floward Workshop', setting: 'UX Studio', occurrences: [21, 22, 23, 24].map(role => ({ role })) },
  ];
  return referenceReview(roles, { scenes, coverNote: 'Pending Availability.', logo: true, projectName: 'Floward Launch' });
}
