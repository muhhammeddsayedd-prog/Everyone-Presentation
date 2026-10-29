import { DomainError } from './types.ts';
import type { Slot } from './specs-types.ts';
import type { ReorderWorkspace } from './role-order.ts';
import { castingRequestMaximumBytes, slideWordingFields, type Assignment, type AssignmentCreate, type AssignmentListOptions, type AssignmentPatch,
  type AssignmentPosition, type AssignmentRemove, type AssignmentRemovalResult, type CastingAuthority, type CastingDraft, type CastingMutationContext,
  type CastingOutput, type CastingTransition, type MainUndo, type MainUndoRecord, type SetSlotMain, type SetSlotMainResult,
  type SlideWording } from './casting-types.ts';

function invalid(): never { throw new DomainError('VALIDATION_FAILED', 'Request does not match the casting operation contract.', 400); }
function stateInvalid(): never { throw new DomainError('ASSIGNMENT_STATE_INVALID', 'Casting relationships are inconsistent. Reload the workspace.', 409); }
function missing(): never { throw new DomainError('RESOURCE_NOT_FOUND', 'Casting resource not found in your accessible project.', 404); }
function object(value: unknown, allowed: readonly string[], required: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![null, Object.prototype].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum = castingRequestMaximumBytes): string {
  if (typeof value !== 'string' || value.length > maximum) invalid();
  for (const char of value as string) { const point = char.codePointAt(0)!; if (point >= 0xd800 && point <= 0xdfff || point < 32 && ![9, 10, 13].includes(point) || point === 127) invalid(); }
  return (value as string).replace(/^[ \t\r\n]+|[ \t\r\n]+$/gu, '');
}
function boundedRequest<T>(value: T): T { if (new TextEncoder().encode(JSON.stringify(value)).byteLength > castingRequestMaximumBytes) invalid(); return value; }
const nullable = (value: unknown): string | null => value === null ? null : text(value) || null;
function id(value: unknown): string { const result = text(value, 200); if (!result) invalid(); return result; }
function revision(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) invalid(); return value as number; }
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') invalid(); return value as boolean; }
function position(value: unknown): AssignmentPosition { if (value !== 'option' && value !== 'main' && value !== 'backup') invalid(); return value; }
function compare(expected: number, actual: number) {
  if (expected !== actual) throw new DomainError('STALE_RESOURCE_VERSION', 'This casting choice changed. Reload it before saving.', 409, { current_row_version: actual });
}
function next(value: number): number { if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) stateInvalid(); return value + 1; }
export function parseSlideWording(value: unknown): SlideWording {
  const input = object(value, slideWordingFields); const result: SlideWording = {};
  for (const key of slideWordingFields) if (Object.hasOwn(input, key)) result[key] = nullable(input[key]);
  return result;
}
export function parseAssignmentCreate(value: unknown): AssignmentCreate {
  const input = object(value, ['slot_id', 'workspace_candidate_id', 'expected_slot_row_version', 'shortlist_included', 'presentation_notes'], ['slot_id', 'workspace_candidate_id', 'expected_slot_row_version']);
  return boundedRequest({ slot_id: id(input.slot_id), workspace_candidate_id: id(input.workspace_candidate_id), expected_slot_row_version: revision(input.expected_slot_row_version),
    ...(Object.hasOwn(input, 'shortlist_included') ? { shortlist_included: boolean(input.shortlist_included) } : {}),
    ...(Object.hasOwn(input, 'presentation_notes') ? { presentation_notes: nullable(input.presentation_notes) } : {}) });
}
export function parseAssignmentPatch(value: unknown): AssignmentPatch {
  const input = object(value, ['row_version', 'position', 'shortlist_included', 'presentation_notes', 'internal_notes', 'slide_wording'], ['row_version']);
  const result: AssignmentPatch = { row_version: revision(input.row_version) };
  if (Object.hasOwn(input, 'position')) { if (input.position !== 'option' && input.position !== 'backup') invalid(); result.position = input.position; }
  if (Object.hasOwn(input, 'shortlist_included')) result.shortlist_included = boolean(input.shortlist_included);
  for (const key of ['presentation_notes', 'internal_notes'] as const) if (Object.hasOwn(input, key)) result[key] = nullable(input[key]);
  if (Object.hasOwn(input, 'slide_wording')) result.slide_wording = parseSlideWording(input.slide_wording);
  return boundedRequest(result);
}
export function parseSetSlotMain(value: unknown): SetSlotMain {
  const input = object(value, ['assignment_id', 'expected_slot_row_version', 'replacement_behavior'], ['assignment_id', 'expected_slot_row_version', 'replacement_behavior']);
  if (input.replacement_behavior !== 'move_previous_to_backup') invalid();
  return boundedRequest({ assignment_id: input.assignment_id === null ? null : id(input.assignment_id), expected_slot_row_version: revision(input.expected_slot_row_version), replacement_behavior: 'move_previous_to_backup' });
}
export function parseMainUndo(value: unknown): MainUndo {
  const input = object(value, ['undo_event_id', 'slot_id', 'expected_slot_row_version', 'restore_assignment_positions'], ['undo_event_id', 'slot_id', 'expected_slot_row_version', 'restore_assignment_positions']);
  if (!Array.isArray(input.restore_assignment_positions) || input.restore_assignment_positions.length < 1 || input.restore_assignment_positions.length > 2) invalid();
  const restore = input.restore_assignment_positions.map(value => { const item = object(value, ['assignment_id', 'position'], ['assignment_id', 'position']); return { assignment_id: id(item.assignment_id), position: position(item.position) }; });
  if (new Set(restore.map(item => item.assignment_id)).size !== restore.length) invalid();
  return boundedRequest({ undo_event_id: id(input.undo_event_id), slot_id: id(input.slot_id), expected_slot_row_version: revision(input.expected_slot_row_version), restore_assignment_positions: restore });
}
export function parseAssignmentRemove(value: unknown): AssignmentRemove {
  const input = object(value, ['row_version', 'reason'], ['row_version']);
  return boundedRequest({ row_version: revision(input.row_version), ...(Object.hasOwn(input, 'reason') ? { reason: nullable(input.reason) } : {}) });
}
export function parseAssignmentListOptions(value: unknown = {}): AssignmentListOptions {
  const input = object(value, ['output_type', 'cursor', 'limit']); const result: AssignmentListOptions = { limit: 25 };
  if (Object.hasOwn(input, 'output_type')) { if (input.output_type !== 'selection' && input.output_type !== 'shortlist') invalid(); result.output_type = input.output_type; }
  if (Object.hasOwn(input, 'cursor')) result.cursor = text(input.cursor, 4000);
  if (Object.hasOwn(input, 'limit')) { result.limit = revision(input.limit); if (result.limit > 100) invalid(); }
  return boundedRequest(result);
}
export function parseCastingMutationContext(value: unknown): CastingMutationContext {
  const input = object(value, ['idempotencyKey', 'requestId', 'clientType'], ['idempotencyKey']);
  const headerValue = (value: unknown) => { id(value); const raw = value as string; if ([...raw].some(char => char.codePointAt(0)! < 32 || char.codePointAt(0) === 127)) invalid(); return raw; };
  const result: CastingMutationContext = { idempotencyKey: headerValue(input.idempotencyKey) };
  if (Object.hasOwn(input, 'requestId')) result.requestId = headerValue(input.requestId);
  if (Object.hasOwn(input, 'clientType')) { if (!['browser', 'api', 'mcp'].includes(input.clientType as string)) invalid(); result.clientType = input.clientType as 'browser' | 'api' | 'mcp'; }
  return boundedRequest(result);
}
/** Full published reorder shape; exact eligible-set checks remain transactional. */
export function parseCastingReorderWorkspace(value: unknown): ReorderWorkspace {
  const input = object(value, ['row_version', 'role_ids', 'slot_ids_by_role', 'assignment_ids_by_slot'], ['row_version']);
  const ids = (value: unknown): string[] => { if (!Array.isArray(value)) invalid(); return value.map(id); };
  const result: ReorderWorkspace = { row_version: revision(input.row_version) };
  if (Object.hasOwn(input, 'role_ids')) result.role_ids = ids(input.role_ids);
  for (const key of ['slot_ids_by_role', 'assignment_ids_by_slot'] as const) if (Object.hasOwn(input, key)) {
    const scopes = input[key];
    if (!scopes || typeof scopes !== 'object' || Array.isArray(scopes) || ![null, Object.prototype].includes(Object.getPrototypeOf(scopes))) invalid();
    const entries = Object.entries(scopes).map(([scope, values]) => [id(scope), ids(values)] as const);
    if (new Set(entries.map(([scope]) => scope)).size !== entries.length) invalid();
    result[key] = Object.fromEntries(entries);
  }
  return boundedRequest(result);
}

function assertState(draft: CastingDraft) {
  const workspace = draft.workspace; const unique = (rows: { id: string }[]) => new Set(rows.map(row => row.id)).size === rows.length;
  if (![workspace.row_version, workspace.draft_revision].every(Number.isSafeInteger) || workspace.row_version < 1 || workspace.draft_revision < 0
    || ![draft.roles, draft.slots, draft.workspace_candidates, draft.assignments].every(unique)
    || draft.roles.some(row => row.workspace_id !== workspace.id)
    || draft.slots.some(row => row.workspace_id !== workspace.id || !draft.roles.some(role => role.id === row.role_id))
    || draft.workspace_candidates.some(row => row.workspace_id !== workspace.id)) stateInvalid();
  const seen = new Set<string>(); const mains = new Set<string>();
  for (const row of draft.assignments) {
    const slot = draft.slots.find(item => item.id === row.slot_id); const pool = draft.workspace_candidates.find(item => item.id === row.workspace_candidate_id);
    if (row.workspace_id !== workspace.id || !slot || !pool || !Number.isSafeInteger(row.row_version) || row.row_version < 1
      || !Number.isSafeInteger(row.sort_order) || row.sort_order < 0 || !['option', 'main', 'backup'].includes(row.position)) stateInvalid();
    if (!row.archived) {
      if (slot.archived || pool.archived || draft.roles.find(role => role.id === slot.role_id)!.archived) stateInvalid();
      const key = JSON.stringify([row.slot_id, row.workspace_candidate_id]); if (seen.has(key) || row.position === 'main' && mains.has(row.slot_id)) stateInvalid();
      seen.add(key); if (row.position === 'main') mains.add(row.slot_id);
    }
  }
}
function authorized(draft: CastingDraft, authority: CastingAuthority, write: boolean): CastingDraft {
  if (!authority?.principal_id) throw new DomainError('AUTH_REQUIRED', 'Sign in to use the casting workspace.', 401);
  if (authority.project_id !== draft.workspace.project_id || !authority.can_read || write && !authority.can_write) missing();
  const capability = write ? 'workspaces.write' : 'workspaces.read';
  if (!authority.capabilities.includes(capability)) throw new DomainError('CAPABILITY_REQUIRED', 'Your account cannot perform this casting operation.', 403, { capability });
  assertState(draft); return structuredClone(draft);
}
function slotFor(draft: CastingDraft, slotId: string) {
  const slot = draft.slots.find(row => row.id === slotId && !row.archived);
  if (!slot || draft.roles.find(role => role.id === slot.role_id)?.archived) missing(); return slot;
}
function activeAssignment(draft: CastingDraft, assignmentId: string) {
  const item = draft.assignments.find(row => row.id === assignmentId && !row.archived); if (!item) missing(); return item;
}
function slotDto(slot: Slot): Slot { return { id: slot.id, role_id: slot.role_id, label: slot.label, sort_order: slot.sort_order, row_version: slot.row_version, archived: slot.archived }; }
function transition<Result>(before: CastingDraft, draft: CastingDraft, result: Result, changed: boolean,
  undo_record: MainUndoRecord | null = null, consume_undo_event_id: string | null = null): CastingTransition<Result> {
  if (changed) { draft.workspace.row_version = next(before.workspace.row_version); draft.workspace.draft_revision = next(before.workspace.draft_revision); }
  assertState(draft);
  return { draft, result: structuredClone(result), changed, expected_versions: { workspace: before.workspace.row_version,
    slots: before.slots.filter(row => draft.slots.find(after => after.id === row.id)!.row_version !== row.row_version).map(row => ({ id: row.id, row_version: row.row_version })),
    assignments: before.assignments.filter(row => draft.assignments.find(after => after.id === row.id)!.row_version !== row.row_version).map(row => ({ id: row.id, row_version: row.row_version })) }, undo_record, consume_undo_event_id };
}
/** The adapter must lock workspace/slot, recheck revisions and enforce unique indexes. */
export function createAssignment(before: CastingDraft, authority: CastingAuthority, workspaceId: string, value: unknown, assignmentId: string): CastingTransition<Assignment> {
  const input = parseAssignmentCreate(value); const draft = authorized(before, authority, true); if (id(workspaceId) !== draft.workspace.id) missing();
  const slot = slotFor(draft, input.slot_id); compare(input.expected_slot_row_version, slot.row_version);
  if (!draft.workspace_candidates.some(row => row.id === input.workspace_candidate_id && !row.archived)) missing();
  const existing = draft.assignments.find(row => !row.archived && row.slot_id === slot.id && row.workspace_candidate_id === input.workspace_candidate_id);
  if (existing) return transition(before, draft, existing, false);
  const allocatedId = id(assignmentId); if (draft.assignments.some(row => row.id === allocatedId)) stateInvalid();
  const orders = draft.assignments.filter(row => !row.archived && row.slot_id === slot.id).map(row => row.sort_order);
  const item: Assignment = { id: allocatedId, workspace_id: draft.workspace.id, slot_id: slot.id, workspace_candidate_id: input.workspace_candidate_id,
    position: 'option', shortlist_included: input.shortlist_included ?? false, presentation_notes: input.presentation_notes ?? null,
    internal_notes: null, slide_wording: {}, sort_order: orders.length ? next(orders.reduce((maximum, order) => Math.max(maximum, order), 0)) : 0, row_version: 1, archived: false };
  draft.assignments.push(item); slot.row_version = next(slot.row_version); return transition(before, draft, item, true);
}
export function updateAssignment(before: CastingDraft, authority: CastingAuthority, assignmentId: string, value: unknown): CastingTransition<Assignment> {
  const input = parseAssignmentPatch(value); const draft = authorized(before, authority, true); const item = activeAssignment(draft, id(assignmentId)); compare(input.row_version, item.row_version);
  if (input.position !== undefined && item.position === 'main') throw new DomainError('MAIN_OPERATION_REQUIRED', 'Use the slot Main operation to clear or replace its Main.', 409);
  const previous = structuredClone(item);
  for (const key of ['position', 'shortlist_included', 'presentation_notes', 'internal_notes'] as const) if (Object.hasOwn(input, key)) Object.assign(item, { [key]: input[key] });
  for (const key of slideWordingFields) if (input.slide_wording && Object.hasOwn(input.slide_wording, key)) {
    const wording = input.slide_wording[key]; if (wording === null) delete item.slide_wording[key]; else item.slide_wording[key] = wording;
  }
  const changed = item.position !== previous.position || item.shortlist_included !== previous.shortlist_included || item.presentation_notes !== previous.presentation_notes
    || item.internal_notes !== previous.internal_notes || slideWordingFields.some(key => item.slide_wording[key] !== previous.slide_wording[key]);
  if (changed) { item.row_version = next(item.row_version); if (item.position !== previous.position) { const slot = slotFor(draft, item.slot_id); slot.row_version = next(slot.row_version); } }
  return transition(before, draft, item, changed);
}
export function setSlotMain(before: CastingDraft, authority: CastingAuthority, slotId: string, value: unknown, eventId: string): CastingTransition<SetSlotMainResult> {
  const input = parseSetSlotMain(value); const draft = authorized(before, authority, true); const slot = slotFor(draft, id(slotId)); compare(input.expected_slot_row_version, slot.row_version);
  const old = draft.assignments.find(row => row.slot_id === slot.id && !row.archived && row.position === 'main');
  const target = input.assignment_id === null ? null : activeAssignment(draft, input.assignment_id); if (target && target.slot_id !== slot.id) missing();
  if ((old?.id ?? null) === (target?.id ?? null)) return transition(before, draft, { slot: slotDto(slot), affected_assignments: [], undo: null }, false);
  const auditId = id(eventId); const changed = [old, target].filter((item): item is Assignment => !!item).sort((a, b) => a.id.localeCompare(b.id));
  const changes = changed.map(item => ({ assignment_id: item.id, previous_position: item.position, resulting_position: item === target ? 'main' as const : 'backup' as const, resulting_row_version: next(item.row_version) }));
  if (old) old.position = 'backup'; if (target) target.position = 'main'; for (const item of changed) item.row_version = next(item.row_version);
  slot.row_version = next(slot.row_version);
  const record: MainUndoRecord = { event_id: auditId, workspace_id: draft.workspace.id, slot_id: slot.id, resulting_slot_row_version: slot.row_version, consumed: false, changes };
  const undo: MainUndo = { undo_event_id: auditId, slot_id: slot.id, expected_slot_row_version: slot.row_version, restore_assignment_positions: changes.map(row => ({ assignment_id: row.assignment_id, position: row.previous_position })) };
  return transition(before, draft, { slot: slotDto(slot), affected_assignments: changed, undo }, true, record);
}
export function undoSlotMain(before: CastingDraft, authority: CastingAuthority, slotId: string, value: unknown, record: MainUndoRecord): CastingTransition<SetSlotMainResult> {
  const input = parseMainUndo(value); const draft = authorized(before, authority, true);
  const wrong = (): never => { throw new DomainError('MAIN_UNDO_INVALID', 'This inverse does not match the recorded slot Main change.', 409); };
  if (input.slot_id !== slotId || record.workspace_id !== draft.workspace.id || record.slot_id !== slotId || record.event_id !== input.undo_event_id
    || record.changes.length < 1 || record.changes.length > 2 || new Set(record.changes.map(row => row.assignment_id)).size !== record.changes.length) wrong();
  if (record.consumed) throw new DomainError('MAIN_UNDO_ALREADY_USED', 'This slot Main change was already undone.', 409);
  const slot = slotFor(draft, id(slotId)); compare(input.expected_slot_row_version, slot.row_version); compare(record.resulting_slot_row_version, slot.row_version);
  if (input.restore_assignment_positions.length !== record.changes.length || record.changes.some(row => !input.restore_assignment_positions.some(item => item.assignment_id === row.assignment_id && item.position === row.previous_position))) wrong();
  const changed = record.changes.map(row => {
    const item = activeAssignment(draft, row.assignment_id); if (item.slot_id !== slot.id) wrong(); compare(row.resulting_row_version, item.row_version);
    if (item.position !== row.resulting_position) wrong(); return item;
  }).sort((a, b) => a.id.localeCompare(b.id));
  for (const item of changed) { item.position = record.changes.find(row => row.assignment_id === item.id)!.previous_position; item.row_version = next(item.row_version); }
  slot.row_version = next(slot.row_version);
  return transition(before, draft, { slot: slotDto(slot), affected_assignments: changed, undo: null }, true, null, record.event_id);
}
export function removeAssignment(before: CastingDraft, authority: CastingAuthority, assignmentId: string, value: unknown): CastingTransition<AssignmentRemovalResult> {
  const input = parseAssignmentRemove(value); const draft = authorized(before, authority, true); const item = activeAssignment(draft, id(assignmentId)); compare(input.row_version, item.row_version);
  item.archived = true; item.row_version = next(item.row_version); const slot = slotFor(draft, item.slot_id); slot.row_version = next(slot.row_version);
  return transition(before, draft, { success: true, affected_ids: [item.id] }, true);
}
/** Derived membership/order only. Pagination belongs to the consistent adapter snapshot. */
export function assignmentsForOutput(before: CastingDraft, authority: CastingAuthority, output: CastingOutput): Assignment[] {
  const draft = authorized(before, authority, false); if (output !== 'selection' && output !== 'shortlist') invalid();
  const roles = [...draft.roles].filter(row => !row.archived).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  return roles.flatMap(role => draft.slots.filter(row => row.role_id === role.id && !row.archived).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    .flatMap(slot => draft.assignments.filter(row => row.slot_id === slot.id && !row.archived && (output === 'selection' || row.shortlist_included))
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))));
}
