import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor } from '../../domain/src/types.ts';
import type { Slot } from '../../domain/src/specs-types.ts';
import { parseAssignmentCreate, parseAssignmentListOptions, parseAssignmentPatch, parseAssignmentRemove,
  parseCastingMutationContext, parseCastingReorderWorkspace, parseMainUndo, parseSetSlotMain, parseSlideWording } from '../../domain/src/casting.ts';
import { castingRequestMaximumBytes, type Assignment, type CastingMutationContext, type CastingOperations, type SetSlotMainResult } from '../../domain/src/casting-types.ts';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';
import { workspaceDto } from './dto.ts';

function failed(): never { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central casting data did not match its published contract.', 503); }
function invalid(): never { throw new DomainError('VALIDATION_FAILED', 'Provide valid casting resource identifiers and operation metadata.', 400); }
function missing(): never { throw new DomainError('RESOURCE_NOT_FOUND', 'The casting resource is not in the requested project scope.', 404); }
const version = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const ordinal = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function text(value: unknown, maximum = castingRequestMaximumBytes): value is string {
  if (typeof value !== 'string' || value.length > maximum) return false;
  for (const char of value) { const point = char.codePointAt(0)!; if (point >= 0xd800 && point <= 0xdfff || point < 32 && ![9, 10, 13].includes(point) || point === 127) return false; }
  return true;
}
const isId = (value: unknown): value is string => text(value, 200) && value.length > 0 && value.trim() === value;
function identifier(value: unknown): string { if (!isId(value)) invalid(); return value; }
function exact(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![null, Object.prototype].includes(Object.getPrototypeOf(value))
    || Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value, key))) failed();
  return value as Record<string, unknown>;
}
function checked<T>(parse: () => T): T { try { return parse(); } catch { return failed(); } }
function assignmentDto(value: unknown): Assignment {
  const row = exact(value, ['id', 'workspace_id', 'slot_id', 'workspace_candidate_id', 'position', 'shortlist_included', 'presentation_notes', 'internal_notes', 'slide_wording', 'sort_order', 'row_version', 'archived']);
  if (![row.id, row.workspace_id, row.slot_id, row.workspace_candidate_id].every(isId) || !version(row.row_version) || !ordinal(row.sort_order)
    || row.position !== 'option' && row.position !== 'main' && row.position !== 'backup'
    || typeof row.shortlist_included !== 'boolean' || typeof row.archived !== 'boolean'
    || !(row.presentation_notes === null || text(row.presentation_notes)) || !(row.internal_notes === null || text(row.internal_notes))) failed();
  const wording = checked(() => parseSlideWording(row.slide_wording));
  return structuredClone({ ...row, slide_wording: wording }) as unknown as Assignment;
}
function slotDto(value: unknown): Slot {
  const row = exact(value, ['id', 'role_id', 'label', 'sort_order', 'row_version', 'archived']);
  if (!isId(row.id) || !isId(row.role_id) || !text(row.label) || !ordinal(row.sort_order) || !version(row.row_version) || typeof row.archived !== 'boolean') failed();
  return structuredClone(row) as unknown as Slot;
}
interface CastingContext { workspace_id: string; slot_id: string; role_id: string; workspace_candidate_id: string | null }
function contextDto(value: unknown, kind: 'assignment' | 'slot', resourceId: string): CastingContext {
  const row = exact(value, ['workspace_id', 'slot_id', 'role_id', 'workspace_candidate_id']);
  if (!isId(row.workspace_id) || !isId(row.slot_id) || !isId(row.role_id)
    || (kind === 'assignment' ? !isId(row.workspace_candidate_id) : row.workspace_candidate_id !== null || row.slot_id !== resourceId)) failed();
  return structuredClone(row) as unknown as CastingContext;
}
function mainDto(value: unknown, parent: CastingContext): SetSlotMainResult {
  const row = exact(value, ['slot', 'affected_assignments', 'undo']); const slot = slotDto(row.slot);
  if (slot.id !== parent.slot_id || slot.role_id !== parent.role_id || slot.archived || !Array.isArray(row.affected_assignments) || row.affected_assignments.length > 2) failed();
  const affected = row.affected_assignments.map(assignmentDto);
  if (new Set(affected.map(item => item.id)).size !== affected.length || affected.some(item => item.workspace_id !== parent.workspace_id || item.slot_id !== parent.slot_id || item.archived)
    || affected.filter(item => item.position === 'main').length > 1) failed();
  const undo = row.undo === null ? null : checked(() => parseMainUndo(row.undo));
  if (undo && (undo.slot_id !== slot.id || undo.expected_slot_row_version !== slot.row_version || undo.restore_assignment_positions.length !== affected.length
    || undo.restore_assignment_positions.some(item => !affected.some(changed => changed.id === item.assignment_id)))) failed();
  return { slot, affected_assignments: affected, undo };
}
const businessErrors: Record<string, string> = {
  MAIN_OPERATION_REQUIRED: 'Use the slot Main operation to clear or replace its Main.',
  MAIN_UNDO_INVALID: 'This inverse does not match the recorded slot Main change.',
  MAIN_UNDO_ALREADY_USED: 'This slot Main change was already undone.',
  ASSIGNMENT_STATE_INVALID: 'Casting relationships changed unexpectedly. Reload the workspace.',
  ROLE_ORDER_INVALID: 'Use every eligible resource exactly once in its current ordering scope.',
};

/** Request-scoped verified-user RPC facade. No JWT export or service-role fallback.
 * Parent reads bind DTOs; locked SQL remains authoritative for permissions/replay. */
export async function createCentralCasting(client: SupabaseClient): Promise<CastingOperations> {
  const identity = await verifyCentralUser(client);
  function actorRequired(actor: Actor) {
    if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The casting actor does not match the verified session.', 403);
  }
  function mutationContext(value: unknown): CastingMutationContext {
    if (!value || typeof value !== 'object' || typeof (value as Record<string, unknown>).idempotencyKey !== 'string'
      || !(value as { idempotencyKey: string }).idempotencyKey.trim()) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'A stable Idempotency-Key is required for this operation.', 400);
    const context = parseCastingMutationContext(value);
    if (context.requestId && !/^[A-Za-z0-9._:-]{1,128}$/u.test(context.requestId)) invalid(); return context;
  }
  async function rpc(actor: Actor, name: string, args: Record<string, unknown>, context?: CastingMutationContext): Promise<unknown> {
    actorRequired(actor);
    try {
      let request = client.rpc(name, args);
      if (context?.requestId) request = request.setHeader('X-EPS-Request-ID', context.requestId);
      if (context?.clientType) request = request.setHeader('X-EPS-Client-Type', context.clientType);
      const { data, error } = await request;
      if (error) {
        if (error.code === 'P0001' && typeof error.message === 'string' && Object.hasOwn(businessErrors, error.message)) throw new DomainError(error.message, businessErrors[error.message], 409);
        throw centralRpcError(error);
      }
      return data;
    } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Central casting is temporarily unavailable.', 503, {}, true); }
  }
  async function parent(actor: Actor, kind: 'assignment' | 'slot', resourceId: string, context: CastingMutationContext) {
    return contextDto(await rpc(actor, 'eps_get_casting_context', { p_resource_type: kind, p_resource_id: resourceId }, context), kind, resourceId);
  }
  function boundAssignment(value: unknown, scope: CastingContext, assignmentId?: string) {
    const row = assignmentDto(value);
    if (row.workspace_id !== scope.workspace_id || row.slot_id !== scope.slot_id || row.archived
      || assignmentId !== undefined && row.id !== assignmentId || scope.workspace_candidate_id !== null && row.workspace_candidate_id !== scope.workspace_candidate_id) failed(); return row;
  }
  const api: CastingOperations = {
    async listAssignments(actor, workspaceId, options = {}) {
      actorRequired(actor); identifier(workspaceId); const input = parseAssignmentListOptions(options);
      const limit = input.limit ?? 25;
      const row = exact(await rpc(actor, 'eps_list_assignments', { p_workspace_id: workspaceId, p_output_type: input.output_type ?? null, p_cursor: input.cursor ?? null, p_limit: limit }), ['data', 'page']);
      const page = exact(row.page, ['next_cursor']);
      if (!Array.isArray(row.data) || row.data.length > limit || !(page.next_cursor === null || text(page.next_cursor, 4000) && page.next_cursor.length > 0)
        || page.next_cursor !== null && row.data.length !== limit) failed();
      const data = row.data.map(assignmentDto);
      if (new Set(data.map(item => item.id)).size !== data.length || data.some(item => item.workspace_id !== workspaceId || item.archived || input.output_type === 'shortlist' && !item.shortlist_included)
        || new Set(data.map(item => JSON.stringify([item.slot_id, item.workspace_candidate_id]))).size !== data.length
        || new Set(data.filter(item => item.position === 'main').map(item => item.slot_id)).size !== data.filter(item => item.position === 'main').length) failed();
      return { data, page: { next_cursor: page.next_cursor as string | null } };
    },
    async createAssignment(actor, workspaceId, supplied, metadata) {
      actorRequired(actor); identifier(workspaceId); const input = parseAssignmentCreate(supplied); const context = mutationContext(metadata);
      const scope = await parent(actor, 'slot', input.slot_id, context); if (scope.workspace_id !== workspaceId) missing();
      const row = boundAssignment(await rpc(actor, 'eps_create_assignment', { p_workspace_id: workspaceId, p_input: input, p_idempotency_key: context.idempotencyKey }, context), scope);
      if (row.workspace_candidate_id !== input.workspace_candidate_id) failed(); return row;
    },
    async updateAssignment(actor, assignmentId, supplied, metadata) {
      actorRequired(actor); identifier(assignmentId); const input = parseAssignmentPatch(supplied); const context = mutationContext(metadata); const scope = await parent(actor, 'assignment', assignmentId, context);
      const row = boundAssignment(await rpc(actor, 'eps_update_assignment', { p_assignment_id: assignmentId, p_input: input, p_idempotency_key: context.idempotencyKey }, context), scope, assignmentId);
      if (row.row_version < input.row_version || row.row_version > input.row_version + 1) failed(); return row;
    },
    async setSlotMain(actor, slotId, supplied, metadata) {
      actorRequired(actor); identifier(slotId); const input = parseSetSlotMain(supplied); const context = mutationContext(metadata); const scope = await parent(actor, 'slot', slotId, context);
      if (input.assignment_id !== null) { const target = await parent(actor, 'assignment', input.assignment_id, context); if (target.workspace_id !== scope.workspace_id || target.slot_id !== slotId || target.role_id !== scope.role_id) missing(); }
      const row = mainDto(await rpc(actor, 'eps_set_slot_main', { p_slot_id: slotId, p_input: input, p_idempotency_key: context.idempotencyKey }, context), scope);
      if (!row.affected_assignments.length) { if (row.undo !== null || row.slot.row_version !== input.expected_slot_row_version) failed(); }
      else if (!row.undo || row.slot.row_version !== input.expected_slot_row_version + 1
        || input.assignment_id === null && (row.affected_assignments.length !== 1 || row.affected_assignments.some(item => item.position !== 'backup'))
        || input.assignment_id !== null && (!row.affected_assignments.some(item => item.id === input.assignment_id && item.position === 'main') || row.affected_assignments.some(item => item.id !== input.assignment_id && item.position !== 'backup'))) failed();
      return row;
    },
    async undoSlotMain(actor, slotId, supplied, metadata) {
      actorRequired(actor); identifier(slotId); const input = parseMainUndo(supplied); const context = mutationContext(metadata); if (input.slot_id !== slotId) invalid();
      const scope = await parent(actor, 'slot', slotId, context);
      const row = mainDto(await rpc(actor, 'eps_undo_slot_main', { p_slot_id: slotId, p_input: input, p_idempotency_key: context.idempotencyKey }, context), scope);
      if (row.undo !== null || row.slot.row_version !== input.expected_slot_row_version + 1 || row.affected_assignments.length !== input.restore_assignment_positions.length
        || input.restore_assignment_positions.some(item => !row.affected_assignments.some(changed => changed.id === item.assignment_id && changed.position === item.position))) failed(); return row;
    },
    async removeAssignment(actor, assignmentId, supplied, metadata) {
      actorRequired(actor); identifier(assignmentId); const input = parseAssignmentRemove(supplied); const context = mutationContext(metadata); await parent(actor, 'assignment', assignmentId, context);
      const row = exact(await rpc(actor, 'eps_remove_assignment', { p_assignment_id: assignmentId, p_input: input, p_idempotency_key: context.idempotencyKey }, context), ['success', 'affected_ids']);
      if (row.success !== true || !Array.isArray(row.affected_ids) || row.affected_ids.length !== 1 || row.affected_ids[0] !== assignmentId) failed();
      return { success: true, affected_ids: [assignmentId] };
    },
    async reorderWorkspace(actor, workspaceId, supplied, metadata) {
      actorRequired(actor); identifier(workspaceId); const input = parseCastingReorderWorkspace(supplied); const context = mutationContext(metadata);
      const response = await rpc(actor, 'eps_reorder_workspace', { p_workspace_id: workspaceId, p_input: input, p_idempotency_key: context.idempotencyKey }, context);
      const value = checked(() => workspaceDto(response));
      if (value.id !== workspaceId) failed(); return value;
    },
  };
  return api;
}
export type CentralCasting = Awaited<ReturnType<typeof createCentralCasting>>;
