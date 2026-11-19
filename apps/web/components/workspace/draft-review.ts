import { projectReviewSlides } from '../../../../packages/domain/src/review.ts';
import { slideWordingFields, type Assignment, type CastingOutput } from '../../../../packages/domain/src/casting-types.ts';
import type { Candidate, CandidateMedia, WorkspaceCandidate } from '../../../../packages/domain/src/candidate-types.ts';
import type { PresentationContext, PresentationScene, ReviewFields, ReviewProjectionInput, ReviewSlide, TemplateIdentity, WorkspaceReview } from '../../../../packages/domain/src/review-types.ts';
import type { Scene, SceneOccurrence } from '../../../../packages/domain/src/scenes-types.ts';
import type { Role, RoleRequirements, Slot } from '../../../../packages/domain/src/specs-types.ts';
import legacyRegistry from '../../../../packages/templates/registry.json';
import completeRegistry from '../../../../packages/templates/versions/1.1.0/registry.json';
import editorialRegistry from '../../../../packages/templates/versions/1.2.0/registry.json';
import slotRegistry from '../../../../packages/templates/versions/1.3.0/registry.json';
import referenceRegistry from '../../../../packages/templates/versions/1.4.0/registry.json';
import captionedRegistry from '../../../../packages/templates/versions/1.4.1/registry.json';

/** Saved workspace records the live preview is projected from. Every value comes from the API; nothing is invented. */
export interface DraftSource {
  workspace: { id: string; logo_asset_id: string | null; logo_placement: 'cover' | 'every_slide'; draft_revision: number };
  project: { name: string; client_name: string | null };
  roles: Role[]; slots: Slot[]; pool: WorkspaceCandidate[]; assignments: Assignment[];
  /** Shared profiles by candidate id. A missing profile pauses the preview rather than inventing facts. */
  candidates: Record<string, Candidate>;
  /** Introductions by candidate id. Only people whose selected material is needed are loaded. */
  media: Record<string, CandidateMedia[]>;
  /** Confirmed scenes in order (templates 1.4.0 and 1.4.1), when the scene API provides them. */
  scenes?: PresentationScene[];
}
/** A scene as the scenes API lists it. `status` may also read 'rejected' (always archived) on newer databases. */
export type ListedScene = Omit<Scene, 'status' | 'occurrences'> & { status: string; occurrences: (Omit<SceneOccurrence, 'status'> & { status: string; archived?: boolean })[] };
const byOrder = (a: { sort_order: number; id: string }, b: { sort_order: number; id: string }) => a.sort_order - b.sort_order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** The scenes a 1.4.0 snapshot captures, from the scenes API, with the rules of `eps.review_presentation_1_4` (m19):
 * - scenes: `status = 'confirmed'` and not archived, ordered by `sort_order, id`;
 * - occurrences: `status = 'confirmed'`, not archived, of an active role of the workspace, ordered by `sort_order, id`;
 * - fields: scene `id → scene_id`, `scene_number`, `title`, `sequence_label`, `setting`; occurrence `id → occurrence_id`,
 *   `role_id`, `display_title`, `setting_override`, `presentation_note`, `deck_placement`, each value as saved (the template
 *   trims). `slot_ids`, `notes`, `requirements`, `source_refs`, `role_name` and row versions are not captured.
 * Lowercase UUID strings compare like Postgres `uuid` values, so the `id` tie-break matches. `activeRoleIds` is the
 * active role list the preview reads; occurrences of any other role are left out, as the snapshot's role join does. */
export function toPresentationScenes(scenes: readonly ListedScene[], activeRoleIds: ReadonlySet<string>): PresentationScene[] {
  return scenes.filter(scene => scene.status === 'confirmed' && !scene.archived).sort(byOrder).map(scene => ({
    scene_id: scene.id, scene_number: scene.scene_number, title: scene.title, sequence_label: scene.sequence_label, setting: scene.setting,
    occurrences: scene.occurrences.filter(item => item.status === 'confirmed' && !item.archived && activeRoleIds.has(item.role_id)).sort(byOrder).map(item => ({
      occurrence_id: item.id, role_id: item.role_id, display_title: item.display_title, setting_override: item.setting_override, presentation_note: item.presentation_note,
      deck_placement: item.deck_placement })) }));
}
/** The series a draft is previewed for: its title, output and pinned template, or the Studio default before one exists. */
export interface DraftContext { output: CastingOutput; title: string; templateVersion: string; coverNote?: string | null }

/** Unsaved panel edits, keyed by record and field. Only these keys are read; anything else is ignored. */
export type DraftOverlay = Readonly<Record<string, unknown>>;
export const draftKey = {
  projectName: 'project:name',
  clientName: 'project:client_name',
  logoPlacement: 'workspace:logo_placement',
  roleName: (id: string) => `role:${id}:name`,
  roleCategory: (id: string) => `role:${id}:category`,
  roleRequirements: (id: string) => `role:${id}:requirements`,
  slotLabel: (id: string) => `slot:${id}:label`,
  availability: (poolId: string) => `pool:${poolId}:availability`,
  material: (poolId: string) => `pool:${poolId}:material`,
  presentationNotes: (assignmentId: string) => `assignment:${assignmentId}:presentation_notes`,
};
export interface DraftMaterial { mediaId: string | null; frames: string[] }

export const TEMPLATE_REGISTRY: Record<string, TemplateIdentity> = Object.fromEntries([legacyRegistry, completeRegistry, editorialRegistry, slotRegistry, referenceRegistry, captionedRegistry]
  .map(row => [row.version, { key: row.key, version: row.version, content_sha256: row.content_sha256, font_key: row.font_key }]));
export const supportedTemplate = (version: string) => Object.hasOwn(TEMPLATE_REGISTRY, version);

const has = (overlay: DraftOverlay, key: string) => Object.hasOwn(overlay, key);
const textOr = (overlay: DraftOverlay, key: string, fallback: string | null) => has(overlay, key) && (typeof overlay[key] === 'string' || overlay[key] === null) ? overlay[key] as string | null : fallback;
/** SQL `coalesce(nullif(btrim(value),''),'Not provided')`, the server's field rule. */
const shown = (value: string | null | undefined) => value?.trim() ? value.trim() : 'Not provided';

function sourceFields(candidate: Candidate, availability: string | null, notes: string | null): ReviewFields {
  const facts = candidate.facts; const languages = [...facts.languages, ...facts.accents].join('; ');
  return { name_or_id: shown(facts.name?.trim() ? facts.name : facts.casting_id), age_or_range: shown(facts.age_or_range), height_measurements: shown(facts.height_measurements),
    languages_accents: languages ? languages : 'Not provided', skills_experience: shown(facts.skills_experience), city: shown(facts.city),
    previous_projects_roles: shown(facts.previous_projects_roles), classification: shown(facts.classification), availability: shown(availability), presentation_notes: shown(notes) };
}

export interface DraftResult { review: Pick<WorkspaceReview, 'cover' | 'slides' | 'output_type' | 'template' | 'candidate_slide_count' | 'pending_slide_count' | 'presentation'>; notes: string[] }

/** 1.4.0 presentation context for the live preview, from the same saved records the server captures: role/slot notes,
 * the series cover note, scenes when provided, and each person's pinned portrait or deliberately empty picture. The
 * portrait's pixel size and hash are only known to the server; the preview draws the image at the same crop focus. */
function draftPresentation(source: DraftSource, context: DraftContext, slides: ReviewSlide[]): PresentationContext {
  const note = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;
  return { cover_note: note(context.coverNote), scenes: source.scenes ?? [], slides: slides.map(slide => {
    const role = source.roles.find(item => item.id === slide.role_id); const slot = source.slots.find(item => item.id === slide.slot_id);
    const pool = slide.kind === 'candidate' ? source.pool.find(item => item.id === slide.workspace_candidate_id) as (WorkspaceCandidate & { portrait_asset_id?: string | null; portrait_source?: 'frame' | 'photo' | null; portrait_crop?: { focal_x?: number; focal_y?: number } | null; media_selection_state?: 'unset' | 'pinned' | 'intentionally_empty' }) | undefined : undefined;
    const state = slide.kind === 'candidate' ? pool?.media_selection_state ?? 'unset' : null;
    const focal = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1000, Math.round(value * 1000))) : fallback;
    const portrait = pool?.portrait_asset_id && pool.portrait_source && state !== 'intentionally_empty'
      ? { asset_id: pool.portrait_asset_id, source: pool.portrait_source, width: 1000, height: 1000, sha256: '0'.repeat(64), focal: [focal(pool.portrait_crop?.focal_x, 500), focal(pool.portrait_crop?.focal_y, 400)] as [number, number] } : null;
    return { role_note: note(role?.presentation_note), slot_note: note(slot?.presentation_note), picture_state: portrait ? 'pinned' : state, portrait };
  }) };
}

/** Projects the working draft exactly as the server review does (role, slot and assignment order; Pending pages;
 * Selection = every active assignment, Shortlist = explicitly included ones), then applies unsaved panel edits.
 * Throws when relationships are inconsistent — the caller keeps the last good preview and says it is paused. */
export function buildDraftReview(source: DraftSource, overlay: DraftOverlay, context: DraftContext): DraftResult {
  const template = TEMPLATE_REGISTRY[context.templateVersion]; if (!template) throw new Error('TEMPLATE_VERSION_UNAVAILABLE');
  const notes: string[] = [];
  const roles = source.roles.map(role => ({ id: role.id, workspace_id: role.workspace_id, name: textOr(overlay, draftKey.roleName(role.id), role.name) ?? '', category: textOr(overlay, draftKey.roleCategory(role.id), role.category),
    sort_order: role.sort_order, archived: role.archived, requirements: has(overlay, draftKey.roleRequirements(role.id)) ? overlay[draftKey.roleRequirements(role.id)] as RoleRequirements : role.requirements }));
  const slots = source.slots.map(slot => ({ id: slot.id, role_id: slot.role_id, label: textOr(overlay, draftKey.slotLabel(slot.id), slot.label) ?? '', sort_order: slot.sort_order, archived: slot.archived }));
  const assignments = source.assignments.map(row => has(overlay, draftKey.presentationNotes(row.id)) ? { ...row, presentation_notes: textOr(overlay, draftKey.presentationNotes(row.id), row.presentation_notes) } : row);
  const included = new Set(assignments.filter(row => !row.archived && (context.output === 'selection' || row.shortlist_included)).map(row => row.workspace_candidate_id));
  const media: ReviewProjectionInput['media'] = [];
  const pool = source.pool.map(row => {
    const material = has(overlay, draftKey.material(row.id)) ? overlay[draftKey.material(row.id)] as DraftMaterial : { mediaId: row.selected_candidate_media_id, frames: row.selected_frame_asset_ids };
    const availability = textOr(overlay, draftKey.availability(row.id), row.availability);
    if (!included.has(row.id) || !material.mediaId) return { ...row, availability, selected_candidate_media_id: material.mediaId, selected_frame_asset_ids: material.frames };
    const introduction = source.media[row.candidate_id]?.find(item => item.id === material.mediaId);
    if (!introduction) { notes.push('frames'); return { ...row, availability, selected_candidate_media_id: null, selected_frame_asset_ids: [] }; }
    if (!media.some(item => item.id === introduction.id)) media.push({ id: introduction.id, candidate_id: introduction.candidate_id, source_asset_id: introduction.source_asset_id,
      frames: introduction.available_frames.map(frame => ({ asset_id: frame.asset_id, source_asset_id: frame.source_asset_id, timestamp_ms: frame.timestamp_ms, width: frame.width, height: frame.height, sha256: '' })) });
    // A frame the server would not capture (not extracted from this introduction) is left out, as generation would.
    const frames = material.frames.filter(id => introduction.available_frames.some(frame => frame.asset_id === id && frame.source_asset_id === introduction.source_asset_id));
    if (frames.length !== material.frames.length) notes.push('frames');
    return { ...row, availability, selected_candidate_media_id: introduction.id, selected_frame_asset_ids: frames };
  });
  const needed = new Set(pool.filter(row => included.has(row.id)).map(row => row.candidate_id));
  const candidates = [...needed].map(id => source.candidates[id]).filter(Boolean);
  if (candidates.length !== needed.size) throw new Error('DRAFT_PROFILE_UNAVAILABLE');
  const slides = projectReviewSlides({ workspace_id: source.workspace.id, output_type: context.output, roles, slots, pool, candidates, assignments, media });
  // Field wording follows the server rule: trimmed supplied facts, then saved slide wording as written.
  for (const slide of slides) {
    if (slide.kind !== 'candidate') continue;
    const row = pool.find(item => item.id === slide.workspace_candidate_id)!; const assignment = assignments.find(item => item.id === slide.assignment_id)!;
    const fields = sourceFields(source.candidates[row.candidate_id], row.availability, assignment.presentation_notes); slide.source_fields = { ...fields };
    for (const key of slideWordingFields) { const wording = assignment.slide_wording[key]; if (typeof wording === 'string') fields[key] = wording; }
    slide.fields = fields;
  }
  const output = context.output;
  const presentation = template.version === '1.4.0' || template.version === '1.4.1' ? { presentation: draftPresentation(source, context, slides) } : {};
  return { notes: [...new Set(notes)], review: { ...presentation, output_type: output, template, slides, candidate_slide_count: slides.filter(slide => slide.kind === 'candidate').length, pending_slide_count: slides.filter(slide => slide.kind === 'pending').length,
    cover: { project_name: textOr(overlay, draftKey.projectName, source.project.name) ?? source.project.name, client_name: textOr(overlay, draftKey.clientName, source.project.client_name), title: context.title, output_type: output,
      logo_asset_id: source.workspace.logo_asset_id, logo_placement: (has(overlay, draftKey.logoPlacement) ? overlay[draftKey.logoPlacement] : source.workspace.logo_placement) as 'cover' | 'every_slide' } } };
}

/** Where a slide sits in the workspace, so the panel and the stage can select each other. */
export type DraftFocus = { kind: 'cover' } | { kind: 'role'; id: string } | { kind: 'slot'; id: string } | { kind: 'assignment'; id: string } | { kind: 'pool'; id: string };
export function focusMatches(slide: ReviewSlide | null, focus: DraftFocus): boolean {
  if (focus.kind === 'cover') return slide === null;
  if (!slide) return false;
  return focus.kind === 'role' ? slide.role_id === focus.id : focus.kind === 'slot' ? slide.slot_id === focus.id
    : focus.kind === 'assignment' ? slide.assignment_id === focus.id : slide.workspace_candidate_id === focus.id;
}
export function focusFor(slide: ReviewSlide | null): DraftFocus {
  if (!slide) return { kind: 'cover' };
  return slide.assignment_id ? { kind: 'assignment', id: slide.assignment_id } : slide.slot_id ? { kind: 'slot', id: slide.slot_id } : slide.role_id ? { kind: 'role', id: slide.role_id } : { kind: 'cover' };
}
