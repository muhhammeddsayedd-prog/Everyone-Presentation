import { DomainError } from './types.ts';
import type {
  ExtractedRole, Role, RoleCreate, RolePatch, RoleRequirements, Slot, SlotAssignment, SlotPatch,
  SlotResizePlan, SourceReference, SpecPatch, SpecSubmit, SpecsAllocationOptions, SpecsClarification, SpecsDraft,
  SpecsExtractionCommit, WorkingRole, WorkingSlot,
} from './specs-types.ts';
export type * from './specs-types.ts';

const nullableFields = ['age_range', 'gender_requirement', 'appearance_performance', 'location',
  'availability_requirements', 'other_instructions'] as const;
const arrayFields = ['languages', 'accents', 'skills', 'scene_references', 'shoot_dates'] as const;
const referenceFields = ['asset_id', 'page', 'paragraph', 'segment_index', 'start_ms', 'end_ms', 'quote'];
const invalid = (): never => { throw new DomainError('VALIDATION_FAILED', 'Request does not match the specs operation contract.', 400); };
function object(value: unknown, allowed: readonly string[], required: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some(key => !allowed.includes(key))
    || required.some(key => !Object.hasOwn(value, key))) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string { if (typeof value !== 'string') invalid(); return value as string; }
function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
function id(value: unknown): string { const result = text(value); if (result.length < 1 || result.length > 200) invalid(); return result; }
function integer(value: unknown, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) invalid();
  return value as number;
}
function count(value: unknown): number | null { return value === null ? null : integer(value, 1); }
function strings(value: unknown): string[] { if (!Array.isArray(value)) invalid(); return (value as unknown[]).map(text); }
function reference(value: unknown): SourceReference | null {
  if (value === null) return null;
  const item = object(value, referenceFields, referenceFields);
  const coordinate = (key: string, minimum: number) => item[key] === null ? null : integer(item[key], minimum);
  return { asset_id: item.asset_id === null ? null : id(item.asset_id), page: coordinate('page', 1),
    paragraph: coordinate('paragraph', 0), segment_index: coordinate('segment_index', 0),
    start_ms: coordinate('start_ms', 0), end_ms: coordinate('end_ms', 0), quote: nullableText(item.quote) };
}
function clarifications(value: unknown): SpecsClarification[] {
  if (!Array.isArray(value)) invalid();
  return (value as unknown[]).map(entry => {
    const item = object(entry, ['field_path', 'reason', 'source', 'resolved'], ['field_path', 'reason', 'source', 'resolved']);
    if (typeof item.resolved !== 'boolean') invalid();
    return { field_path: text(item.field_path), reason: text(item.reason), source: reference(item.source), resolved: item.resolved as boolean };
  });
}
export function parseRoleRequirements(value: unknown): RoleRequirements {
  const item = object(value, [...nullableFields, ...arrayFields], [...nullableFields, ...arrayFields]);
  return { age_range: nullableText(item.age_range), gender_requirement: nullableText(item.gender_requirement),
    appearance_performance: nullableText(item.appearance_performance), languages: strings(item.languages),
    accents: strings(item.accents), skills: strings(item.skills), scene_references: strings(item.scene_references),
    shoot_dates: strings(item.shoot_dates), location: nullableText(item.location),
    availability_requirements: nullableText(item.availability_requirements), other_instructions: nullableText(item.other_instructions) };
}
export function parseSpecSubmit(value: unknown): SpecSubmit {
  const item = object(value, ['source_asset_id', 'source_text', 'row_version']);
  if (Object.hasOwn(item, 'source_asset_id') === Object.hasOwn(item, 'source_text')) invalid();
  const result: SpecSubmit = Object.hasOwn(item, 'source_asset_id')
    ? { source_asset_id: id(item.source_asset_id) } : { source_text: text(item.source_text) };
  if (result.source_text !== undefined && !result.source_text.trim()) {
    throw new DomainError('SPECS_SOURCE_REQUIRED', 'Provide readable source text or a Ready specs document.');
  }
  if (result.source_text !== undefined) for (const character of result.source_text) {
    const point = character.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff || point < 32 && ![9, 10, 13].includes(point)) invalid();
  }
  if (Object.hasOwn(item, 'row_version')) result.row_version = integer(item.row_version, 1);
  return result;
}
export function parseRoleCreate(value: unknown): RoleCreate {
  const item = object(value, ['name', 'headcount', 'category', 'requirements'], ['name', 'headcount', 'requirements']);
  const result: RoleCreate = { name: text(item.name), headcount: count(item.headcount), requirements: parseRoleRequirements(item.requirements) };
  if (Object.hasOwn(item, 'category')) result.category = nullableText(item.category);
  return result;
}
export function parseRolePatch(value: unknown): RolePatch {
  const item = object(value, ['row_version', 'name', 'category', 'requirements', 'clarifications'], ['row_version']);
  const result: RolePatch = { row_version: integer(item.row_version, 1) };
  if (Object.hasOwn(item, 'name')) result.name = text(item.name);
  if (Object.hasOwn(item, 'category')) result.category = nullableText(item.category);
  if (Object.hasOwn(item, 'requirements')) result.requirements = parseRoleRequirements(item.requirements);
  if (Object.hasOwn(item, 'clarifications')) result.clarifications = clarifications(item.clarifications);
  return result;
}
export function parseSpecPatch(value: unknown): SpecPatch {
  const item = object(value, ['row_version', 'normalized_instructions', 'clarifications'], ['row_version']);
  const result: SpecPatch = { row_version: integer(item.row_version, 1) };
  if (Object.hasOwn(item, 'normalized_instructions')) result.normalized_instructions = nullableText(item.normalized_instructions);
  if (Object.hasOwn(item, 'clarifications')) result.clarifications = clarifications(item.clarifications);
  return result;
}
export function parseSlotPatch(value: unknown): SlotPatch {
  const item = object(value, ['row_version', 'label'], ['row_version', 'label']);
  return { row_version: integer(item.row_version, 1), label: text(item.label) };
}
export function parseResizeSlots(value: unknown): { row_version: number; desired_count: number; retire_slot_ids: string[] } {
  const item = object(value, ['row_version', 'desired_count', 'retire_slot_ids'], ['row_version', 'desired_count']);
  const retire = Object.hasOwn(item, 'retire_slot_ids') ? strings(item.retire_slot_ids).map(id) : [];
  if (new Set(retire).size !== retire.length) invalid();
  return { row_version: integer(item.row_version, 1), desired_count: integer(item.desired_count, 1), retire_slot_ids: retire };
}

function compareVersion(expected: number, actual: number): void {
  integer(expected, 1);
  if (expected !== actual) throw new DomainError('STALE_RESOURCE_VERSION', 'The draft changed. Reload it before applying this change.', 409,
    { current_row_version: actual });
}
function next(value: number): number { return integer(value + 1, 1); }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function markerKey(item: SpecsClarification): string {
  const ref = item.source;
  return JSON.stringify([item.field_path, item.reason, ref && referenceFields.map(key => ref[key as keyof SourceReference])]);
}
/** Omitted markers remain; an exact marker's resolved flag is an explicit confirmation. */
function mergeClarifications(current: SpecsClarification[], updates?: SpecsClarification[]): SpecsClarification[] {
  if (!updates) return structuredClone(current);
  const pending = new Map<string, SpecsClarification>();
  for (const update of updates) { const key = markerKey(update); if (pending.has(key)) invalid(); pending.set(key, update); }
  const result = current.map(item => { const key = markerKey(item); const update = pending.get(key); pending.delete(key); return update ?? item; });
  return structuredClone([...result, ...pending.values()]);
}
const unresolved = (field_path: string, reason: string): SpecsClarification => ({ field_path, reason, source: null, resolved: false });
function roleClarifications(role: Pick<ExtractedRole, 'name' | 'headcount' | 'clarifications'>): SpecsClarification[] {
  const result = role.clarifications.map(item => ({ ...structuredClone(item), resolved: false }));
  if (role.headcount === null && !result.some(item => item.field_path === 'headcount')) {
    result.push(unresolved('headcount', 'Headcount is not known. The single slot is provisional.'));
  }
  if (!role.name && !result.some(item => item.field_path === 'name')) result.push(unresolved('name', 'Role name is not provided.'));
  return result;
}
function allocate(allocateId: () => string, used: Set<string>): string {
  const value = id(allocateId());
  if (used.has(value)) throw new DomainError('SPECS_STATE_INVALID', 'A generated record identity is already in use.', 409);
  used.add(value); return value;
}
function checkAllocation(counts: number[], options: SpecsAllocationOptions): void {
  const maximum = options.maximum_new_slots ?? 1000;
  if (!Number.isSafeInteger(maximum) || maximum < 0) {
    throw new DomainError('CONFIGURATION_INVALID', 'The specs slot-allocation budget must be a nonnegative safe integer.', 503);
  }
  let requested = 0;
  for (const count of counts) {
    integer(count, 0);
    if (count > maximum - requested) {
      throw new DomainError('SLOT_ALLOCATION_LIMIT_EXCEEDED', 'This operation exceeds the configured new-slot transaction budget.', 422,
        { maximum_new_slots: maximum });
    }
    requested += count;
  }
}
const compareSlots = (a: WorkingSlot, b: WorkingSlot) => a.sort_order - b.sort_order || a.ordinal - b.ordinal || a.id.localeCompare(b.id);
function makeSlot(role: WorkingRole, ordinal: number, sortOrder: number, allocateId: () => string, used: Set<string>): WorkingSlot {
  return { id: allocate(allocateId, used), workspace_id: role.workspace_id, role_id: role.id,
    label: `${role.name || 'Slot'} ${ordinal}`, ordinal, sort_order: sortOrder, row_version: 1,
    archived: false, provisional: role.headcount === null };
}
function makeRole(workspaceId: string, input: RoleCreate, sortOrder: number, source: ExtractedRole | null,
  allocateId: () => string, used: Set<string>): { role: WorkingRole; slots: WorkingSlot[] } {
  const role: WorkingRole = { id: allocate(allocateId, used), workspace_id: workspaceId, name: input.name,
    headcount: input.headcount, category: input.category ?? null, requirements: structuredClone(input.requirements),
    clarifications: roleClarifications(source ?? { ...input, clarifications: [] }), sort_order: sortOrder,
    row_version: 1, archived: false, source: source ? freeze(structuredClone(source)) : null };
  const slots: WorkingSlot[] = [];
  for (let index = 0; index < (role.headcount ?? 1); index++) slots.push(makeSlot(role, index + 1, index, allocateId, used));
  return { role, slots };
}
export function createEmptySpecsDraft(input: { id: string; workspace_id: string; draft_revision: number }): SpecsDraft {
  return { spec: { id: id(input.id), workspace_id: id(input.workspace_id), source_asset_id: null,
    source_text: null, normalized_instructions: null, clarifications: [], row_version: 1, processing_job_id: null },
    roles: [], slots: [], draft_revision: integer(input.draft_revision, 0), source_extraction: null };
}

/**
 * Pure initial draft commit, after the existing extraction/source validator.
 * The persistence adapter must lock/recheck these versions AND the live job lease/input hash
 * inside its transaction. This function does not authorize actors or complete a job.
 */
export function commitSpecsExtraction(current: SpecsDraft, input: SpecsExtractionCommit, allocateId: () => string,
  options: SpecsAllocationOptions = {}): SpecsDraft {
  compareVersion(input.expected_spec_row_version, current.spec.row_version);
  integer(input.expected_draft_revision, 0);
  if (input.expected_draft_revision !== current.draft_revision) {
    throw new DomainError('STALE_RESOURCE_VERSION', 'Requirements changed while extraction was running.', 409,
      { current_draft_revision: current.draft_revision });
  }
  if (current.roles.length || current.slots.length) {
    throw new DomainError('SPECS_DRAFT_NOT_EMPTY', 'Existing roles must be corrected through ordinary editing.', 409);
  }
  if (input.source_asset_id !== input.extraction.source_asset_id) {
    throw new DomainError('SPECS_SOURCE_MISMATCH', 'The extraction does not belong to this source.', 409);
  }
  if (input.source_asset_id === null && (input.source_text === null || !input.source_text.trim())) {
    throw new DomainError('SPECS_SOURCE_REQUIRED', 'Keep the original source text or document with these requirements.');
  }
  const roleInputs = input.extraction.roles.map(source => parseRoleCreate({ name: source.name ?? '', headcount: source.headcount,
    category: source.category, requirements: source.requirements }));
  checkAllocation(roleInputs.map(role => role.headcount ?? 1), options);
  const used = new Set([current.spec.id, current.spec.workspace_id]);
  const result: SpecsDraft = { spec: { ...structuredClone(current.spec), source_asset_id: input.source_asset_id,
    source_text: input.source_text, normalized_instructions: input.extraction.general_instructions,
    clarifications: input.extraction.clarifications.map(item => ({ ...structuredClone(item), resolved: false })),
    row_version: next(current.spec.row_version), processing_job_id: null }, roles: [], slots: [],
    draft_revision: next(current.draft_revision), source_extraction: freeze(structuredClone(input.extraction)) };
  input.extraction.roles.forEach((source, index) => {
    const created = makeRole(current.spec.workspace_id, roleInputs[index], index, source, allocateId, used);
    result.roles.push(created.role); result.slots.push(...created.slots);
  });
  return result;
}

export function addManualRole(current: SpecsDraft, value: unknown, allocateId: () => string, options: SpecsAllocationOptions = {}): SpecsDraft {
  const input = parseRoleCreate(value);
  checkAllocation([input.headcount ?? 1], options);
  const used = new Set([current.spec.id, current.spec.workspace_id, ...current.roles.map(role => role.id), ...current.slots.map(slot => slot.id)]);
  const sortOrder = current.roles.reduce((maximum, role) => Math.max(maximum, role.sort_order), -1) + 1;
  const created = makeRole(current.spec.workspace_id, input, sortOrder, null, allocateId, used);
  return { ...current, roles: [...current.roles, created.role], slots: [...current.slots, ...created.slots], draft_revision: next(current.draft_revision) };
}
function activeRole(current: SpecsDraft, roleId: string): WorkingRole {
  const result = current.roles.find(role => role.id === roleId && !role.archived);
  if (!result) throw new DomainError('RESOURCE_NOT_FOUND', 'Active role not found.', 404);
  return result;
}
export function editRole(current: SpecsDraft, roleId: string, value: unknown): SpecsDraft {
  const input = parseRolePatch(value); const role = activeRole(current, roleId); compareVersion(input.row_version, role.row_version);
  const changed: WorkingRole = { ...role, ...input, clarifications: mergeClarifications(role.clarifications, input.clarifications),
    row_version: next(role.row_version) };
  return { ...current, roles: current.roles.map(item => item.id === roleId ? changed : item), draft_revision: next(current.draft_revision) };
}
export function editSpecs(current: SpecsDraft, value: unknown): SpecsDraft {
  const input = parseSpecPatch(value); compareVersion(input.row_version, current.spec.row_version);
  return { ...current, spec: { ...current.spec, ...input, clarifications: mergeClarifications(current.spec.clarifications, input.clarifications),
    row_version: next(current.spec.row_version) }, draft_revision: next(current.draft_revision) };
}
export function editSlot(current: SpecsDraft, slotId: string, value: unknown): SpecsDraft {
  const input = parseSlotPatch(value); const slot = current.slots.find(item => item.id === slotId && !item.archived);
  if (!slot) throw new DomainError('RESOURCE_NOT_FOUND', 'Active slot not found.', 404);
  activeRole(current, slot.role_id); compareVersion(input.row_version, slot.row_version);
  return { ...current, slots: current.slots.map(item => item.id === slotId ? { ...item, label: input.label, row_version: next(item.row_version) } : item),
    draft_revision: next(current.draft_revision) };
}

/**
 * No I/O or deletion: produces a reviewable transaction plan with before-images.
 * Caller supplies ALL current role slots (including archived) and their assignments,
 * then locks/rechecks the parent, child versions AND assignment membership before applying
 * atomically, advancing workspace draft_revision and emitting its draft-change event.
 * Existing generated snapshots are deliberately outside this operation.
 */
export function planRoleSlotsResize<Assignment extends SlotAssignment>(role: WorkingRole, slots: WorkingSlot[], assignments: Assignment[],
  value: unknown, allocateId: () => string, options: SpecsAllocationOptions = {}): SlotResizePlan<Assignment> {
  const input = parseResizeSlots(value); compareVersion(input.row_version, role.row_version);
  const stateInvalid = (): never => { throw new DomainError('SPECS_STATE_INVALID', 'Role slots and assignments do not form a consistent current state.', 409); };
  if (role.archived) stateInvalid();
  const ids = new Set<string>(); const ordinals = new Set<number>();
  for (const slot of slots) {
    if (ids.has(slot.id) || slot.role_id !== role.id || slot.workspace_id !== role.workspace_id
      || !Number.isSafeInteger(slot.ordinal) || slot.ordinal < 1 || !Number.isSafeInteger(slot.sort_order) || slot.sort_order < 0
      || !Number.isSafeInteger(slot.row_version) || slot.row_version < 1) stateInvalid();
    ids.add(slot.id);
    if (!slot.archived) { if (ordinals.has(slot.ordinal)) stateInvalid(); ordinals.add(slot.ordinal); }
  }
  const active = slots.filter(slot => !slot.archived).sort(compareSlots);
  if (active.length !== (role.headcount ?? 1) || active.some(slot => slot.provisional !== (role.headcount === null))) stateInvalid();
  const assignmentIds = new Set<string>();
  for (const assignment of assignments) {
    const slot = slots.find(item => item.id === assignment.slot_id);
    if (assignmentIds.has(assignment.id) || !slot || (!assignment.archived && slot.archived)
      || !Number.isSafeInteger(assignment.row_version) || assignment.row_version < 1) stateInvalid();
    assignmentIds.add(assignment.id);
  }
  const excess = Math.max(0, active.length - input.desired_count);
  if (excess && input.retire_slot_ids.length === 0) {
    throw new DomainError('SLOT_RETIREMENT_REQUIRED', 'Choose the excess slots to archive and review their assignments.', 409,
      { required_retirements: excess, affected_slots: active.map(slot => ({ slot_id: slot.id,
        assignment_ids: assignments.filter(item => item.slot_id === slot.id && !item.archived).map(item => item.id) })) });
  }
  if (input.retire_slot_ids.length !== excess || input.retire_slot_ids.some(slotId => !active.some(slot => slot.id === slotId))) {
    throw new DomainError('SLOT_RETIREMENT_INVALID', 'Retire exactly the selected excess active slots from this role.', 409);
  }
  checkAllocation([Math.max(0, input.desired_count - active.length)], options);
  const retired = new Set(input.retire_slot_ids);
  const retirements = active.filter(slot => retired.has(slot.id)).map(slot => ({ slot: structuredClone(slot),
    assignments: structuredClone(assignments.filter(item => item.slot_id === slot.id && !item.archived)) }));
  const changedRole: WorkingRole = { ...role, headcount: input.desired_count, row_version: next(role.row_version),
    clarifications: role.clarifications.map(item => item.field_path === 'headcount' ? { ...structuredClone(item), resolved: true } : structuredClone(item)) };
  const changedSlots = slots.map(slot => retired.has(slot.id) ? { ...structuredClone(slot), archived: true, row_version: next(slot.row_version) }
    : !slot.archived && slot.provisional ? { ...structuredClone(slot), provisional: false, row_version: next(slot.row_version) } : structuredClone(slot));
  const creates: WorkingSlot[] = [];
  const used = new Set([role.id, role.workspace_id, ...ids, ...assignmentIds]);
  let ordinal = slots.reduce((maximum, slot) => Math.max(maximum, slot.ordinal), 0);
  let sortOrder = slots.reduce((maximum, slot) => Math.max(maximum, slot.sort_order), -1);
  for (let index = active.length; index < input.desired_count; index++) {
    ordinal = next(ordinal); sortOrder = next(sortOrder);
    creates.push(makeSlot(changedRole, ordinal, sortOrder, allocateId, used));
  }
  return { role: changedRole, slots: [...changedSlots, ...creates].sort(compareSlots), creates,
    assignments: assignments.map(item => retired.has(item.slot_id) && !item.archived
      ? { ...structuredClone(item), archived: true, row_version: next(item.row_version) } : structuredClone(item)), retirements,
    expected_versions: { role: { id: role.id, row_version: role.row_version },
      slots: slots.map(slot => ({ id: slot.id, row_version: slot.row_version })),
      assignments: assignments.map(item => ({ id: item.id, row_version: item.row_version })) } };
}

export function roleToDto(role: WorkingRole): Role {
  return structuredClone({ id: role.id, workspace_id: role.workspace_id, name: role.name, headcount: role.headcount,
    category: role.category, requirements: role.requirements, clarifications: role.clarifications,
    sort_order: role.sort_order, row_version: role.row_version, archived: role.archived });
}
export function slotToDto(slot: WorkingSlot): Slot {
  return { id: slot.id, role_id: slot.role_id, label: slot.label, sort_order: slot.sort_order, row_version: slot.row_version, archived: slot.archived };
}
