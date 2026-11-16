import { DomainError } from './types.ts';
import type { SourceReference } from './specs-types.ts';
import type {
  RoleOccurrence, Scene, SceneConfirm, SceneConfirmResult, SceneCreate, SceneDeckPlacement, SceneOccurrence, SceneOccurrenceLink,
  SceneOccurrencePatch, SceneOrder, ScenePatch, SceneRejectResult, SceneReorder, SceneRequirements, SceneStatus, SceneVersionInput,
} from './scenes-types.ts';
export type * from './scenes-types.ts';

/** Bounds shared by the OpenAPI contract, the central RPCs and the UI. Lengths count characters (code points), like SQL length(). */
export const SCENE_LIMITS = Object.freeze({
  title: 300, scene_number: 40, sequence_label: 300, setting: 300, notes: 4000, requirement_items: 50, requirement_item: 500,
  display_title: 300, setting_override: 300, presentation_note: 500, slot_ids: 1000, scene_ids: 1000, occurrences: 200,
  role_occurrences: 500, source_refs: 100, confirmed_ids: 10000,
});
const STATUSES: readonly SceneStatus[] = ['proposed', 'confirmed'];
const PLACEMENTS: readonly SceneDeckPlacement[] = ['auto', 'repeat', 'hidden'];
const referenceFields = ['asset_id', 'page', 'paragraph', 'segment_index', 'start_ms', 'end_ms', 'quote'];

const invalid = (): never => { throw new DomainError('VALIDATION_FAILED', 'Request does not match the scene operation contract.', 400); };
function object(value: unknown, allowed: readonly string[], required: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some(key => !allowed.includes(key))
    || required.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}
function exact(value: unknown, fields: readonly string[]): Record<string, unknown> {
  const item = object(value, fields, fields);
  if (Object.keys(item).length !== fields.length) invalid();
  return item;
}
const characters = (value: string) => [...value].length;
function bounded(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || characters(value) < 1 || characters(value) > maximum) invalid();
  return value as string;
}
function title(value: unknown): string { const result = bounded(value, SCENE_LIMITS.title); if (!result.trim()) invalid(); return result; }
function nullable(value: unknown, maximum: number): string | null { return value === null ? null : bounded(value, maximum); }
function id(value: unknown): string { if (typeof value !== 'string' || value.length < 1 || value.length > 200) invalid(); return value as string; }
function integer(value: unknown, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) invalid();
  return value as number;
}
function ids(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum) invalid();
  const result = (value as unknown[]).map(id);
  if (new Set(result).size !== result.length) invalid();
  return result;
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid();
  return value as T;
}
export function parseSceneRequirements(value: unknown): SceneRequirements {
  const item = exact(value, ['items']);
  if (!Array.isArray(item.items) || item.items.length > SCENE_LIMITS.requirement_items) invalid();
  return { items: (item.items as unknown[]).map(entry => bounded(entry, SCENE_LIMITS.requirement_item)) };
}
function sourceReference(value: unknown): SourceReference {
  const item = exact(value, referenceFields);
  const coordinate = (key: string, minimum: number) => item[key] === null ? null : integer(item[key], minimum);
  if (!(item.quote === null || typeof item.quote === 'string')) invalid();
  return { asset_id: item.asset_id === null ? null : id(item.asset_id), page: coordinate('page', 1), paragraph: coordinate('paragraph', 0),
    segment_index: coordinate('segment_index', 0), start_ms: coordinate('start_ms', 0), end_ms: coordinate('end_ms', 0), quote: item.quote as string | null };
}
function sourceReferences(value: unknown): SourceReference[] {
  if (!Array.isArray(value) || value.length > SCENE_LIMITS.source_refs) invalid();
  return (value as unknown[]).map(sourceReference);
}
type SceneTextKey = 'scene_number' | 'sequence_label' | 'setting' | 'notes';
const SCENE_TEXT: readonly SceneTextKey[] = ['scene_number', 'sequence_label', 'setting', 'notes'];
function sceneText(key: SceneTextKey, value: unknown): string | null {
  // Notes may be cleared to null; an empty string is not a value (send null).
  return nullable(value, SCENE_LIMITS[key]);
}
type OccurrenceTextKey = 'display_title' | 'setting_override' | 'presentation_note';
const OCCURRENCE_TEXT: readonly OccurrenceTextKey[] = ['display_title', 'setting_override', 'presentation_note'];

/** Create input. Only title is required; status is always 'confirmed' and the scene is appended last. */
export function parseSceneCreate(value: unknown): SceneCreate {
  const item = object(value, ['title', ...SCENE_TEXT, 'requirements'], ['title']);
  const result: SceneCreate = { title: title(item.title) };
  for (const key of SCENE_TEXT) if (Object.hasOwn(item, key)) result[key] = sceneText(key, item[key]);
  if (Object.hasOwn(item, 'requirements')) result.requirements = parseSceneRequirements(item.requirements);
  return result;
}
/** Revision-fenced partial update; at least one field besides row_version. */
export function parseScenePatch(value: unknown): ScenePatch {
  const item = object(value, ['row_version', 'title', ...SCENE_TEXT, 'requirements'], ['row_version']);
  if (Object.keys(item).length < 2) invalid();
  const result: ScenePatch = { row_version: integer(item.row_version, 1) };
  if (Object.hasOwn(item, 'title')) result.title = title(item.title);
  for (const key of SCENE_TEXT) if (Object.hasOwn(item, key)) result[key] = sceneText(key, item[key]);
  if (Object.hasOwn(item, 'requirements')) result.requirements = parseSceneRequirements(item.requirements);
  return result;
}
/** The complete active scene set in its new order, fenced by the workspace row_version. */
export function parseSceneReorder(value: unknown): SceneReorder {
  const item = object(value, ['row_version', 'scene_ids'], ['row_version', 'scene_ids']);
  return { row_version: integer(item.row_version, 1), scene_ids: ids(item.scene_ids, SCENE_LIMITS.scene_ids) };
}
/** Archive a scene or unlink an occurrence. */
export function parseSceneVersion(value: unknown): SceneVersionInput {
  const item = object(value, ['row_version'], ['row_version']);
  return { row_version: integer(item.row_version, 1) };
}
function occurrenceFields(item: Record<string, unknown>, result: Partial<SceneOccurrenceLink>) {
  if (Object.hasOwn(item, 'slot_ids')) result.slot_ids = ids(item.slot_ids, SCENE_LIMITS.slot_ids);
  for (const key of OCCURRENCE_TEXT) if (Object.hasOwn(item, key)) result[key] = nullable(item[key], SCENE_LIMITS[key]);
  if (Object.hasOwn(item, 'deck_placement')) result.deck_placement = oneOf(item.deck_placement, PLACEMENTS);
}
/** Link a role explicitly by id (never by name). slot_ids [] or omitted = every active slot of the role. */
export function parseSceneOccurrenceLink(value: unknown): SceneOccurrenceLink {
  const item = object(value, ['role_id', 'slot_ids', ...OCCURRENCE_TEXT, 'deck_placement'], ['role_id']);
  const result: SceneOccurrenceLink = { role_id: id(item.role_id) };
  occurrenceFields(item, result);
  return result;
}
export function parseSceneOccurrencePatch(value: unknown): SceneOccurrencePatch {
  const item = object(value, ['row_version', 'slot_ids', ...OCCURRENCE_TEXT, 'deck_placement'], ['row_version']);
  if (Object.keys(item).length < 2) invalid();
  const result: SceneOccurrencePatch = { row_version: integer(item.row_version, 1) };
  occurrenceFields(item, result);
  return result;
}
/** Confirm or reject extracted proposals. Both lists omitted = every active proposal in the workspace. */
export function parseSceneConfirm(value: unknown): SceneConfirm {
  const item = object(value, ['row_version', 'scene_ids', 'occurrence_ids'], ['row_version']);
  const result: SceneConfirm = { row_version: integer(item.row_version, 1) };
  if (Object.hasOwn(item, 'scene_ids')) result.scene_ids = ids(item.scene_ids, SCENE_LIMITS.scene_ids);
  if (Object.hasOwn(item, 'occurrence_ids')) result.occurrence_ids = ids(item.occurrence_ids, SCENE_LIMITS.scene_ids);
  return result;
}

// Response DTOs. These throw VALIDATION_FAILED; central callers map that to CENTRAL_RESPONSE_INVALID.
export function parseSceneOccurrence(value: unknown): SceneOccurrence {
  const row = exact(value, ['id', 'scene_id', 'role_id', 'role_name', 'slot_ids', ...OCCURRENCE_TEXT, 'deck_placement', 'status',
    'source_refs', 'sort_order', 'row_version', 'proposal_stale']);
  if (typeof row.role_name !== 'string' || typeof row.proposal_stale !== 'boolean') invalid();
  return { id: id(row.id), scene_id: id(row.scene_id), role_id: id(row.role_id), role_name: row.role_name as string,
    slot_ids: ids(row.slot_ids, SCENE_LIMITS.slot_ids), display_title: nullable(row.display_title, SCENE_LIMITS.display_title),
    setting_override: nullable(row.setting_override, SCENE_LIMITS.setting_override),
    presentation_note: nullable(row.presentation_note, SCENE_LIMITS.presentation_note), deck_placement: oneOf(row.deck_placement, PLACEMENTS),
    status: oneOf(row.status, STATUSES), source_refs: sourceReferences(row.source_refs), sort_order: integer(row.sort_order, 0),
    row_version: integer(row.row_version, 1), proposal_stale: row.proposal_stale as boolean };
}
export function parseScene(value: unknown): Scene {
  const row = exact(value, ['id', 'workspace_id', 'scene_number', 'title', 'sequence_label', 'setting', 'notes', 'requirements',
    'source_refs', 'status', 'sort_order', 'row_version', 'archived', 'occurrences']);
  if (typeof row.archived !== 'boolean' || !Array.isArray(row.occurrences) || row.occurrences.length > SCENE_LIMITS.occurrences) invalid();
  const sceneId = id(row.id);
  const occurrences = (row.occurrences as unknown[]).map(parseSceneOccurrence);
  if (occurrences.some((item, index) => item.scene_id !== sceneId || index > 0 && item.sort_order < occurrences[index - 1].sort_order)
    || new Set(occurrences.map(item => item.id)).size !== occurrences.length
    || new Set(occurrences.map(item => item.role_id)).size !== occurrences.length) invalid();
  return { id: sceneId, workspace_id: id(row.workspace_id), scene_number: nullable(row.scene_number, SCENE_LIMITS.scene_number),
    title: title(row.title), sequence_label: nullable(row.sequence_label, SCENE_LIMITS.sequence_label),
    setting: nullable(row.setting, SCENE_LIMITS.setting), notes: nullable(row.notes, SCENE_LIMITS.notes),
    requirements: parseSceneRequirements(row.requirements), source_refs: sourceReferences(row.source_refs), status: oneOf(row.status, STATUSES),
    sort_order: integer(row.sort_order, 0), row_version: integer(row.row_version, 1), archived: row.archived as boolean, occurrences };
}
export function parseRoleOccurrence(value: unknown): RoleOccurrence {
  const row = exact(value, ['occurrence_id', 'scene_id', 'scene_number', 'scene_title', 'setting', 'scene_position', 'scene_status', 'status']);
  return { occurrence_id: id(row.occurrence_id), scene_id: id(row.scene_id), scene_number: nullable(row.scene_number, SCENE_LIMITS.scene_number),
    scene_title: title(row.scene_title), setting: nullable(row.setting, SCENE_LIMITS.setting), scene_position: integer(row.scene_position, 1),
    scene_status: oneOf(row.scene_status, STATUSES), status: oneOf(row.status, STATUSES) };
}
export function parseSceneOrder(value: unknown): SceneOrder {
  const row = exact(value, ['workspace_id', 'row_version', 'scene_ids']);
  return { workspace_id: id(row.workspace_id), row_version: integer(row.row_version, 1), scene_ids: ids(row.scene_ids, SCENE_LIMITS.scene_ids) };
}
export function parseSceneConfirmResult(value: unknown): SceneConfirmResult {
  const row = exact(value, ['workspace_id', 'row_version', 'confirmed_scene_ids', 'confirmed_occurrence_ids', 'skipped_occurrence_ids']);
  return { workspace_id: id(row.workspace_id), row_version: integer(row.row_version, 1),
    confirmed_scene_ids: ids(row.confirmed_scene_ids, SCENE_LIMITS.confirmed_ids),
    confirmed_occurrence_ids: ids(row.confirmed_occurrence_ids, SCENE_LIMITS.confirmed_ids),
    skipped_occurrence_ids: ids(row.skipped_occurrence_ids, SCENE_LIMITS.confirmed_ids) };
}
export function parseSceneRejectResult(value: unknown): SceneRejectResult {
  const row = exact(value, ['workspace_id', 'row_version', 'rejected_scene_ids', 'rejected_occurrence_ids', 'skipped_scene_ids']);
  return { workspace_id: id(row.workspace_id), row_version: integer(row.row_version, 1),
    rejected_scene_ids: ids(row.rejected_scene_ids, SCENE_LIMITS.confirmed_ids),
    rejected_occurrence_ids: ids(row.rejected_occurrence_ids, SCENE_LIMITS.confirmed_ids),
    skipped_scene_ids: ids(row.skipped_scene_ids, SCENE_LIMITS.confirmed_ids) };
}

export type SceneAppearance = string | number | { scene_number?: string | null; scene_position: number };
/** "Appears in Scene 4" / "Appears in Scenes 1, 3 and 5". Uses scene_number when present, else the 1-based position.
 * Returns '' when the role is not linked to any scene. Repeated labels are listed once, in the given order. */
export function formatSceneAppearance(items: readonly SceneAppearance[]): string {
  const labels = [...new Set(items.map(item => typeof item === 'object' && item !== null
    ? (item.scene_number?.trim() || String(item.scene_position)) : String(item).trim()).filter(Boolean))];
  if (!labels.length) return '';
  if (labels.length === 1) return `Appears in Scene ${labels[0]}`;
  return `Appears in Scenes ${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}
