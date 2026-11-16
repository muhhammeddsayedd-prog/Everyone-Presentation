import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, parseRoleOccurrence, parseScene, parseSceneConfirm, parseSceneConfirmResult, parseSceneCreate, parseSceneRejectResult,
  parseSceneOccurrenceLink, parseSceneOccurrencePatch, parseSceneOrder, parseScenePatch, parseSceneReorder, parseSceneVersion,
  SCENE_LIMITS, type Actor, type MutationContext, type Page, type RoleOccurrence, type Scene, type SceneArchiveResult, type SceneConfirm,
  type SceneConfirmResult, type SceneRejectResult, type SceneCreate, type SceneOccurrenceLink, type SceneOccurrencePatch, type SceneOrder, type ScenePatch,
  type SceneReorder, type SceneVersionInput } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';

export interface ScenesListOptions { cursor?: string; limit?: number }
const sceneErrors = new Map<string, { status: number; message: string }>([
  ['SCENE_ORDER_INVALID', { status: 409, message: 'The active scene list changed. Reload before reordering scenes.' }],
  ['SCENE_OCCURRENCE_EXISTS', { status: 409, message: 'This role is already linked to this scene.' }],
  ['SCENE_OCCURRENCE_INVALID', { status: 409, message: 'The role or its slots changed. Reload the scene before linking it again.' }],
]);
const fail = (): never => { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central scene data did not match its public contract.', 503); };
const invalid = (): never => { throw new DomainError('INVALID_REQUEST', 'Provide bounded resource IDs and supported page options.', 400); };
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
function exact(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== fields.length
    || fields.some(field => !Object.hasOwn(value, field))) return fail();
  return value as Record<string, unknown>;
}
function checked<T>(parse: () => T): T { try { return parse(); } catch { return fail(); } }
const scene = (value: unknown) => checked(() => parseScene(value));
function listOptions(options: ScenesListOptions): { cursor: string | null; limit: number } {
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => !['cursor', 'limit'].includes(key))
    || options.cursor !== undefined && !isId(options.cursor)
    || options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 100)) invalid();
  return { cursor: options.cursor ?? null, limit: options.limit ?? 25 };
}

/** Verified-user RPCs for structured scenes (owner eps_specs_owner). Every mutation requires an Idempotency-Key and marks the
 * workspace draft as having unpublished changes in the same central transaction. Scene changes never touch roles, slots,
 * assignments or candidates; occurrences reference a role explicitly by id. */
export async function createCentralScenes(client: SupabaseClient) {
  const identity = await verifyCentralUser(client);
  function checkActor(actor: Actor) {
    if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The scene actor does not match the verified session.', 403);
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
        if (error.code === 'PGRST202') throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Scenes are not available yet. Roles and casting are unchanged.', 503);
        const known = error.code === 'P0001' ? sceneErrors.get(error.message) : undefined;
        if (known) throw new DomainError(error.message, known.message, known.status);
        throw centralRpcError(error);
      }
      return data as unknown;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Central scenes are temporarily unavailable.', 503, {}, true);
    }
  }
  function key(actor: Actor, resource: string, context: MutationContext | undefined): string {
    checkActor(actor);
    if (!isId(resource)) invalid();
    const value = context?.idempotencyKey;
    if (typeof value !== 'string' || value.trim().length < 16 || value.length > 200) {
      throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Provide a stable Idempotency-Key between 16 and 200 characters.', 400);
    }
    return value;
  }
  function owned(result: Scene, workspaceId?: string, sceneId?: string): Scene {
    if (result.archived || workspaceId !== undefined && result.workspace_id !== workspaceId || sceneId !== undefined && result.id !== sceneId) fail();
    return result;
  }
  return {
    /** Active scenes in order (cursor = last scene id). */
    async listScenes(actor: Actor, workspaceId: string, options: ScenesListOptions = {}): Promise<{ data: Scene[]; page: Page }> {
      checkActor(actor); if (!isId(workspaceId)) invalid(); const parsed = listOptions(options);
      const row = exact(await rpc(actor, 'eps_list_scenes', { p_workspace_id: workspaceId, p_cursor: parsed.cursor, p_limit: parsed.limit }), ['data', 'page']);
      const page = exact(row.page, ['next_cursor']);
      if (!Array.isArray(row.data) || row.data.length > parsed.limit || !(page.next_cursor === null || isId(page.next_cursor))) fail();
      const data = (row.data as unknown[]).map(scene);
      if (new Set(data.map(item => item.id)).size !== data.length || data.some((item, index) => item.workspace_id !== workspaceId || item.archived
        || index > 0 && item.sort_order < data[index - 1].sort_order)
        || page.next_cursor !== null && (data.length !== parsed.limit || data.at(-1)?.id !== page.next_cursor)) fail();
      return { data, page: { next_cursor: page.next_cursor as string | null } };
    },
    async createScene(actor: Actor, workspaceId: string, input: SceneCreate, context?: MutationContext): Promise<Scene> {
      const idempotency = key(actor, workspaceId, context); const parsed = parseSceneCreate(input);
      const result = owned(scene(await rpc(actor, 'eps_create_scene', { p_workspace_id: workspaceId, p_input: parsed, p_idempotency_key: idempotency }, context)), workspaceId);
      if (result.status !== 'confirmed') fail(); return result;
    },
    async updateScene(actor: Actor, sceneId: string, input: ScenePatch, context?: MutationContext): Promise<Scene> {
      const idempotency = key(actor, sceneId, context); const parsed = parseScenePatch(input);
      return owned(scene(await rpc(actor, 'eps_update_scene', { p_scene_id: sceneId, p_input: parsed, p_idempotency_key: idempotency }, context)), undefined, sceneId);
    },
    async reorderScenes(actor: Actor, workspaceId: string, input: SceneReorder, context?: MutationContext): Promise<SceneOrder> {
      const idempotency = key(actor, workspaceId, context); const parsed = parseSceneReorder(input);
      const value = await rpc(actor, 'eps_reorder_scenes', { p_workspace_id: workspaceId, p_input: parsed, p_idempotency_key: idempotency }, context);
      const result = checked(() => parseSceneOrder(value));
      if (result.workspace_id !== workspaceId || result.row_version < parsed.row_version
        || result.scene_ids.length !== parsed.scene_ids.length || result.scene_ids.some((item, index) => item !== parsed.scene_ids[index])) fail();
      return result;
    },
    async archiveScene(actor: Actor, sceneId: string, input: SceneVersionInput, context?: MutationContext): Promise<SceneArchiveResult> {
      const idempotency = key(actor, sceneId, context); const parsed = parseSceneVersion(input);
      const result = exact(await rpc(actor, 'eps_archive_scene', { p_scene_id: sceneId, p_input: parsed, p_idempotency_key: idempotency }, context), ['success', 'affected_ids']);
      if (result.success !== true || !Array.isArray(result.affected_ids) || !result.affected_ids.every(isId)
        || !result.affected_ids.includes(sceneId) || new Set(result.affected_ids).size !== result.affected_ids.length) fail();
      return { success: true, affected_ids: [...result.affected_ids as string[]] };
    },
    async linkSceneOccurrence(actor: Actor, sceneId: string, input: SceneOccurrenceLink, context?: MutationContext): Promise<Scene> {
      const idempotency = key(actor, sceneId, context); const parsed = parseSceneOccurrenceLink(input);
      const result = owned(scene(await rpc(actor, 'eps_link_scene_occurrence', { p_scene_id: sceneId, p_input: parsed, p_idempotency_key: idempotency }, context)), undefined, sceneId);
      if (!result.occurrences.some(item => item.role_id === parsed.role_id)) fail(); return result;
    },
    async updateSceneOccurrence(actor: Actor, occurrenceId: string, input: SceneOccurrencePatch, context?: MutationContext): Promise<Scene> {
      const idempotency = key(actor, occurrenceId, context); const parsed = parseSceneOccurrencePatch(input);
      const result = owned(scene(await rpc(actor, 'eps_update_scene_occurrence', { p_occurrence_id: occurrenceId, p_input: parsed, p_idempotency_key: idempotency }, context)));
      if (!result.occurrences.some(item => item.id === occurrenceId)) fail(); return result;
    },
    async unlinkSceneOccurrence(actor: Actor, occurrenceId: string, input: SceneVersionInput, context?: MutationContext): Promise<Scene> {
      const idempotency = key(actor, occurrenceId, context); const parsed = parseSceneVersion(input);
      const result = owned(scene(await rpc(actor, 'eps_unlink_scene_occurrence', { p_occurrence_id: occurrenceId, p_input: parsed, p_idempotency_key: idempotency }, context)));
      if (result.occurrences.some(item => item.id === occurrenceId)) fail(); return result;
    },
    /** Every active occurrence of one role, in active scene order (unpaged, at most 500). */
    async listRoleOccurrences(actor: Actor, roleId: string): Promise<{ data: RoleOccurrence[]; page: { next_cursor: null } }> {
      checkActor(actor); if (!isId(roleId)) invalid();
      const row = exact(await rpc(actor, 'eps_list_role_occurrences', { p_role_id: roleId }), ['role_id', 'data']);
      if (row.role_id !== roleId || !Array.isArray(row.data) || row.data.length > SCENE_LIMITS.role_occurrences) fail();
      const data = (row.data as unknown[]).map(item => checked(() => parseRoleOccurrence(item)));
      if (new Set(data.map(item => item.occurrence_id)).size !== data.length || new Set(data.map(item => item.scene_id)).size !== data.length
        || data.some((item, index) => index > 0 && item.scene_position <= data[index - 1].scene_position)) fail();
      return { data, page: { next_cursor: null } };
    },
    async confirmSceneProposals(actor: Actor, workspaceId: string, input: SceneConfirm, context?: MutationContext): Promise<SceneConfirmResult> {
      const idempotency = key(actor, workspaceId, context); const parsed = parseSceneConfirm(input);
      const value = await rpc(actor, 'eps_confirm_scene_proposals', { p_workspace_id: workspaceId, p_input: parsed, p_idempotency_key: idempotency }, context);
      const result = checked(() => parseSceneConfirmResult(value));
      if (result.workspace_id !== workspaceId || result.row_version < parsed.row_version
        || result.skipped_occurrence_ids.some(item => result.confirmed_occurrence_ids.includes(item))) fail();
      return result;
    },
    /** Reject proposals; confirmed rows are untouched. Rejecting a scene rejects its proposed links; a proposed scene
     * holding a confirmed link is not rejected and comes back in skipped_scene_ids. */
    async rejectSceneProposals(actor: Actor, workspaceId: string, input: SceneConfirm, context?: MutationContext): Promise<SceneRejectResult> {
      const idempotency = key(actor, workspaceId, context); const parsed = parseSceneConfirm(input);
      const value = await rpc(actor, 'eps_reject_scene_proposals', { p_workspace_id: workspaceId, p_input: parsed, p_idempotency_key: idempotency }, context);
      const result = checked(() => parseSceneRejectResult(value));
      if (result.workspace_id !== workspaceId || result.row_version < parsed.row_version
        || result.skipped_scene_ids.some(item => result.rejected_scene_ids.includes(item))) fail();
      return result;
    },
  };
}
export type CentralScenes = Awaited<ReturnType<typeof createCentralScenes>>;
