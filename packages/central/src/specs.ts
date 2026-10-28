import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, parseReorderWorkspace, parseResizeSlots, parseRoleCreate, parseRolePatch, parseSlotPatch, parseSpecPatch, parseSpecSubmit,
  type Actor, type MutationContext, type Page, type ResizeSlots, type Role, type RoleCreate,
  type RolePatch, type Slot, type SlotPatch, type Spec, type SpecPatch, type SpecSubmit, type ReorderWorkspace, type Workspace } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';
import { workspaceDto } from './dto.ts';

export interface SpecsListOptions { cursor?: string; limit?: number }
export interface SpecsArchiveInput { row_version: number; reason?: string | null }
export interface SpecsArchiveResult { success: true; affected_ids: string[] }
const JOB_STATUSES = ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'] as const;
export interface SpecsJobAccepted {
  job_id: string; resource_id: string; poll_url: string; status: typeof JOB_STATUSES[number];
}
const manualErrors = new Map<string, { status: number; message: string }>([
  ['SLOT_ALLOCATION_LIMIT_EXCEEDED', { status: 422, message: 'This change needs more new slots than the current operation allows.' }],
  ['SLOT_RETIREMENT_REQUIRED', { status: 409, message: 'Choose the excess slots to archive and review their assignments.' }],
  ['SLOT_RETIREMENT_INVALID', { status: 409, message: 'Choose exactly the excess active slots from this role.' }],
  ['SPECS_STATE_INVALID', { status: 409, message: 'The role or slots changed unexpectedly. Reload before trying again.' }],
  ['ROLE_ORDER_INVALID', { status: 409, message: 'The active role list changed. Reload before reordering roles.' }],
  ['FEATURE_NOT_IMPLEMENTED', { status: 503, message: 'This ordering operation is not available yet. Your saved order has been kept.' }],
  ['ASSIGNMENT_RETIREMENT_UNAVAILABLE', { status: 503, message: 'Slot retirement is unavailable. You can continue editing requirements.' }],
]);
const fail = (): never => { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central specs data did not match its public contract.', 503); };
const invalid = (): never => { throw new DomainError('INVALID_REQUEST', 'Provide bounded resource IDs, page options, row versions and the required Idempotency-Key.', 400); };
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function exact(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== fields.length
    || fields.some(field => !Object.hasOwn(value, field))) return fail();
  return value as Record<string, unknown>;
}
function checkedResponse<T>(parse: () => T): T { try { return parse(); } catch { return fail(); } }
function specDto(value: unknown): Spec {
  const row = exact(value, ['id', 'workspace_id', 'source_asset_id', 'source_text', 'normalized_instructions', 'clarifications', 'row_version', 'processing_job_id']);
  if (!isId(row.id) || !isId(row.workspace_id) || !(row.source_asset_id === null || isId(row.source_asset_id))
    || !(row.processing_job_id === null || isId(row.processing_job_id)) || !(row.source_text === null || typeof row.source_text === 'string')) fail();
  const editable = checkedResponse(() => parseSpecPatch({ row_version: row.row_version,
    normalized_instructions: row.normalized_instructions, clarifications: row.clarifications }));
  return structuredClone({ ...row, ...editable }) as unknown as Spec;
}
function roleDto(value: unknown): Role {
  const row = exact(value, ['id', 'workspace_id', 'name', 'headcount', 'category', 'requirements', 'clarifications', 'sort_order', 'row_version', 'archived']);
  if (!isId(row.id) || !isId(row.workspace_id) || !(row.headcount === null || nonnegative(row.headcount) && row.headcount > 0)
    || !nonnegative(row.sort_order) || typeof row.archived !== 'boolean') fail();
  const editable = checkedResponse(() => parseRolePatch({ row_version: row.row_version, name: row.name,
    category: row.category, requirements: row.requirements, clarifications: row.clarifications }));
  return structuredClone({ ...row, ...editable }) as unknown as Role;
}
function slotDto(value: unknown): Slot {
  const row = exact(value, ['id', 'role_id', 'label', 'sort_order', 'row_version', 'archived']);
  if (!isId(row.id) || !isId(row.role_id) || !nonnegative(row.sort_order) || typeof row.archived !== 'boolean') fail();
  const editable = checkedResponse(() => parseSlotPatch({ row_version: row.row_version, label: row.label }));
  return { ...row, ...editable } as unknown as Slot;
}
function archiveInput(value: unknown): SpecsArchiveInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['row_version', 'reason'].includes(key))) invalid();
  const item = value as Record<string, unknown>;
  if (!Object.hasOwn(item, 'row_version')) invalid();
  const parsed = parseRolePatch({ row_version: item.row_version });
  const reason = item.reason;
  if (Object.hasOwn(item, 'reason') && reason !== null && typeof reason !== 'string') invalid();
  return { row_version: parsed.row_version, ...(Object.hasOwn(item, 'reason') ? { reason: reason as string | null } : {}) };
}
function listOptions(options: SpecsListOptions): { cursor: string | null; limit: number } {
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => !['cursor', 'limit'].includes(key))
    || options.cursor !== undefined && !isId(options.cursor)
    || options.limit !== undefined && (!nonnegative(options.limit) || options.limit < 1 || options.limit > 100)) invalid();
  return { cursor: options.cursor ?? null, limit: options.limit ?? 25 };
}
function pageDto<T extends { id: string; sort_order: number; archived: boolean }>(value: unknown, limit: number,
  parse: (item: unknown) => T, inScope: (item: T) => boolean): { data: T[]; page: Page } {
  const row = exact(value, ['data', 'page']); const page = exact(row.page, ['next_cursor']);
  if (!Array.isArray(row.data) || row.data.length > limit || !(page.next_cursor === null || isId(page.next_cursor))) fail();
  const data = (row.data as unknown[]).map(parse);
  if (new Set(data.map(item => item.id)).size !== data.length || data.some((item, index) =>
    !inScope(item) || item.archived || index > 0 && item.sort_order < data[index - 1].sort_order)
    || page.next_cursor !== null && (data.length !== limit || data.at(-1)?.id !== page.next_cursor)) fail();
  return { data, page: { next_cursor: page.next_cursor as string | null } };
}

/** Curated, verified-user RPC operations. Readiness and durable submission are checked in the same central transaction. */
export async function createCentralSpecs(client: SupabaseClient) {
  const identity = await verifyCentralUser(client);
  function checkActor(actor: Actor) {
    if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The specs actor does not match the verified session.', 403);
  }
  async function rpc(actor: Actor, name: string, args: Record<string, unknown>, context?: MutationContext) {
    checkActor(actor);
    try {
      let request = client.rpc(name, args);
      if (context?.requestId && /^[A-Za-z0-9._:-]{1,128}$/u.test(context.requestId)) request = request.setHeader('X-EPS-Request-ID', context.requestId);
      if (context?.clientType) {
        if (!['browser', 'api', 'mcp'].includes(context.clientType)) invalid();
        request = request.setHeader('X-EPS-Client-Type', context.clientType);
      }
      const { data, error } = await request;
      if (error) {
        if (name === 'eps_submit_specs' && (error.code === 'PGRST202' || error.code === 'P0001' && error.message === 'FEATURE_NOT_IMPLEMENTED')) {
          throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Specs processing is not available yet. You can enter and edit requirements manually.', 503);
        }
        if (name === 'eps_reorder_workspace' && error.code === 'PGRST202') {
          throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Role ordering is not available yet. Your saved order has been kept.', 503);
        }
        const known = error.code === 'P0001' ? manualErrors.get(error.message) : undefined;
        if (known) throw new DomainError(error.message, known.message, known.status);
        throw centralRpcError(error);
      }
      return data;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Central requirements are temporarily unavailable.', 503, {}, true);
    }
  }
  function mutation(actor: Actor, resource: string, context: MutationContext | undefined, requiredKey = false): string | null {
    checkActor(actor);
    if (!isId(resource) || requiredKey && !isId(context?.idempotencyKey)
      || context?.idempotencyKey !== undefined && !isId(context.idempotencyKey)) invalid();
    return context?.idempotencyKey ?? null;
  }
  return {
    async submitSpecs(actor: Actor, workspaceId: string, input: SpecSubmit, context?: MutationContext): Promise<SpecsJobAccepted> {
      const key = mutation(actor, workspaceId, context, true);
      if (!key || key.length < 16) invalid();
      const parsed = parseSpecSubmit(input);
      const result = exact(await rpc(actor, 'eps_submit_specs', { p_workspace_id: workspaceId, p_input: parsed, p_idempotency_key: key }, context),
        ['job_id', 'resource_id', 'poll_url', 'status']);
      if (!isId(result.job_id) || !isId(result.resource_id) || !JOB_STATUSES.includes(result.status as SpecsJobAccepted['status'])) fail();
      let expectedUrl: string;
      try { expectedUrl = `/api/v1/jobs/${encodeURIComponent(result.job_id as string)}`; } catch { return fail(); }
      if (result.poll_url !== expectedUrl) fail();
      return structuredClone(result) as unknown as SpecsJobAccepted;
    },
    async reorderWorkspace(actor: Actor, workspaceId: string, input: ReorderWorkspace, context?: MutationContext): Promise<Workspace> {
      const key = mutation(actor, workspaceId, context); const parsed = parseReorderWorkspace(input);
      const result = workspaceDto(await rpc(actor, 'eps_reorder_workspace', { p_workspace_id: workspaceId, p_input: parsed, p_idempotency_key: key }, context));
      if (result.id !== workspaceId) fail(); return result;
    },
    async getSpecs(actor: Actor, workspaceId: string): Promise<Spec> {
      checkActor(actor); if (!isId(workspaceId)) invalid();
      const result = specDto(await rpc(actor, 'eps_get_specs', { p_workspace_id: workspaceId }));
      if (result.workspace_id !== workspaceId) fail(); return result;
    },
    async updateSpecs(actor: Actor, workspaceId: string, input: SpecPatch, context?: MutationContext): Promise<Spec> {
      const key = mutation(actor, workspaceId, context); const parsed = parseSpecPatch(input);
      const result = specDto(await rpc(actor, 'eps_update_specs', { p_workspace_id: workspaceId, p_input: parsed, p_idempotency_key: key }, context));
      if (result.workspace_id !== workspaceId) fail(); return result;
    },
    async listRoles(actor: Actor, workspaceId: string, options: SpecsListOptions = {}): Promise<{ data: Role[]; page: Page }> {
      checkActor(actor); if (!isId(workspaceId)) invalid(); const parsed = listOptions(options);
      return pageDto(await rpc(actor, 'eps_list_roles', { p_workspace_id: workspaceId, p_cursor: parsed.cursor, p_limit: parsed.limit }),
        parsed.limit, roleDto, role => role.workspace_id === workspaceId);
    },
    async createRole(actor: Actor, workspaceId: string, input: RoleCreate, context?: MutationContext): Promise<Role> {
      const key = mutation(actor, workspaceId, context, true); const parsed = parseRoleCreate(input);
      const result = roleDto(await rpc(actor, 'eps_create_role', { p_workspace_id: workspaceId, p_input: parsed, p_idempotency_key: key }, context));
      if (result.workspace_id !== workspaceId || result.archived) fail(); return result;
    },
    async updateRole(actor: Actor, roleId: string, input: RolePatch, context?: MutationContext): Promise<Role> {
      const key = mutation(actor, roleId, context); const parsed = parseRolePatch(input);
      const result = roleDto(await rpc(actor, 'eps_update_role', { p_role_id: roleId, p_input: parsed, p_idempotency_key: key }, context));
      if (result.id !== roleId || result.archived) fail(); return result;
    },
    async listSlots(actor: Actor, roleId: string, options: SpecsListOptions = {}): Promise<{ data: Slot[]; page: Page }> {
      checkActor(actor); if (!isId(roleId)) invalid(); const parsed = listOptions(options);
      return pageDto(await rpc(actor, 'eps_list_slots', { p_role_id: roleId, p_cursor: parsed.cursor, p_limit: parsed.limit }),
        parsed.limit, slotDto, slot => slot.role_id === roleId);
    },
    async resizeRoleSlots(actor: Actor, roleId: string, input: ResizeSlots, context?: MutationContext): Promise<Role> {
      const key = mutation(actor, roleId, context, true); const validated = parseResizeSlots(input);
      // Preserve absent retire_slot_ids versus explicit [] in the input hash.
      const parsed: ResizeSlots = { row_version: validated.row_version, desired_count: validated.desired_count,
        ...(Object.hasOwn(input, 'retire_slot_ids') ? { retire_slot_ids: validated.retire_slot_ids } : {}) };
      const result = roleDto(await rpc(actor, 'eps_resize_role_slots', { p_role_id: roleId, p_input: parsed, p_idempotency_key: key }, context));
      if (result.id !== roleId || result.archived) fail(); return result;
    },
    async archiveRole(actor: Actor, roleId: string, input: SpecsArchiveInput, context?: MutationContext): Promise<SpecsArchiveResult> {
      const key = mutation(actor, roleId, context, true); const parsed = archiveInput(input);
      const result = exact(await rpc(actor, 'eps_archive_role', { p_role_id: roleId, p_input: parsed, p_idempotency_key: key }, context), ['success', 'affected_ids']);
      if (result.success !== true || !Array.isArray(result.affected_ids) || !result.affected_ids.every(isId)
        || !result.affected_ids.includes(roleId) || new Set(result.affected_ids).size !== result.affected_ids.length) fail();
      return { success: true, affected_ids: [...result.affected_ids as string[]] };
    },
    async updateSlot(actor: Actor, slotId: string, input: SlotPatch, context?: MutationContext): Promise<Slot> {
      const key = mutation(actor, slotId, context); const parsed = parseSlotPatch(input);
      const result = slotDto(await rpc(actor, 'eps_update_slot', { p_slot_id: slotId, p_input: parsed, p_idempotency_key: key }, context));
      if (result.id !== slotId || result.archived) fail(); return result;
    },
  };
}
export type CentralSpecs = Awaited<ReturnType<typeof createCentralSpecs>>;
