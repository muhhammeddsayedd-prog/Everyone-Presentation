import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor, type AudiencePresetCreate, type AudiencePresetPatch, type CompleteUpload, type ListOptions,
  type MediaAsset, type MutationContext, type ProjectPatch, type UploadCompletion, type UploadSession, type UploadSessionCreate,
  type WorkspaceCreate, type WorkspacePatch } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';
import { audienceDto, capabilitiesDto, listDto, projectDto, successDto, workspaceDto } from './dto.ts';
import { createLogoStorageAdapter, type LogoStorageOptions } from './logo-storage.ts';

export interface CentralStudioOptions {
  logo?: Omit<LogoStorageOptions, 'client' | 'rpc' | 'now' | 'downloadTimeoutMs'>;
  logoRead?: Pick<LogoStorageOptions, 'storageOrigin' | 'brandBucket'>;
}

function invalid(message: string): never { throw new DomainError('VALIDATION_FAILED', message, 400); }
function strictInput(value: unknown, allowed: string[], required: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Provide a valid operation input object.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(input, key))) invalid('The request does not match the operation contract.');
}
function identifier(value: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) invalid('Provide a valid resource identifier.');
  return value;
}
function key(context?: MutationContext, required = false) {
  const value = context?.idempotencyKey;
  if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > 200) || required && value === undefined) invalid('A valid Idempotency-Key is required for this operation.');
  return value ?? null;
}
function listArguments(options: ListOptions & { project_id?: string }, projectFilter = false) {
  strictInput(options, ['q', 'cursor', 'limit', ...(projectFilter ? ['project_id'] : [])], []);
  if (options.q !== undefined && (typeof options.q !== 'string' || options.q.length > 500)) invalid('Search text must be at most 500 characters.');
  if (options.cursor !== undefined && (typeof options.cursor !== 'string' || options.cursor.length > 2000)) invalid('Provide a valid pagination cursor.');
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100)) invalid('Page size must be between 1 and 100.');
  return { p_q: options.q?.trim() ?? '', p_cursor: options.cursor || null, p_limit: options.limit ?? 25,
    ...(projectFilter ? { p_project_id: options.project_id === undefined ? null : identifier(options.project_id) } : {}) };
}
function centralStoragePending(): never {
  throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Private logo upload and media delivery are not wired to central Storage yet. Existing project data remains available.', 503);
}

/** Verified once for this request; each RPC derives authorization from the same user's JWT. */
export async function createCentralStudio(client: SupabaseClient, options: CentralStudioOptions = {}) {
  const identity = await verifyCentralUser(client);
  function checkActor(actor: Actor) {
    if (!actor || typeof actor.principal_id !== 'string') throw new DomainError('AUTH_REQUIRED', 'Sign in with an authorized business account.', 401);
    if (actor.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The operation actor does not match this verified session.', 403);
  }
  async function rpc<T>(actor: Actor, name: string, args: Record<string, unknown>, parser: (value: unknown) => T, context?: MutationContext): Promise<T> {
    checkActor(actor);
    try {
      let request = client.rpc(name, args);
      if (context?.requestId && /^[A-Za-z0-9._:-]{1,128}$/u.test(context.requestId)) request = request.setHeader('X-EPS-Request-ID', context.requestId);
      if (context?.clientType) {
        if (!['browser', 'api', 'mcp'].includes(context.clientType)) invalid('The declared operation client type is invalid.');
        request = request.setHeader('X-EPS-Client-Type', context.clientType);
      }
      const { data, error } = await request;
      if (error) throw centralRpcError(error);
      return parser(data);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'The central data operation is temporarily unavailable.', 503, {}, true);
    }
  }
  const raw = (value: unknown) => value;
  const logoOptions = options.logo ?? options.logoRead;
  const logo = logoOptions ? await createLogoStorageAdapter({ ...logoOptions, client, rpc: {
    reserveUpload: (actor, input, context) => rpc(actor, 'eps_reserve_logo_upload', { p_input: input, p_idempotency_key: key(context, true) }, raw, context),
    getUpload: (actor, uploadId) => rpc(actor, 'eps_get_logo_upload', { p_upload_id: identifier(uploadId) }, raw),
    prepareCompletion: (actor, uploadId, input, context) => rpc(actor, 'eps_prepare_logo_completion', { p_upload_id: identifier(uploadId), p_input: input, p_idempotency_key: key(context, true) }, raw, context),
    finalizeCompletion: (actor, uploadId, input, proof, context) => rpc(actor, 'eps_finalize_logo_completion', { p_upload_id: identifier(uploadId), p_input: input, p_idempotency_key: key(context, true), p_payload: proof.payload, p_mac: proof.mac }, raw, context),
    cancelUpload: (actor, uploadId, context) => rpc(actor, 'eps_cancel_logo_upload', { p_upload_id: identifier(uploadId), p_idempotency_key: key(context, true) }, raw, context),
    getMedia: (actor, assetId) => rpc(actor, 'eps_get_logo_media', { p_asset_id: identifier(assetId) }, raw),
  } }) : undefined;
  return {
    verifiedIdentity: identity,
    fixtureActors(): { id: string; display_name: string; role: string }[] { return []; },
    resolveFixtureActor(_id: string): Actor { void _id; throw new DomainError('FIXTURE_MODE_FORBIDDEN', 'Development identities are unavailable in central mode.', 503); },
    async getCapabilities(actor: Actor) {
      const result = await rpc(actor, 'eps_get_capabilities', {}, capabilitiesDto);
      if (result.principal_id !== identity.principal_id) throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central capabilities did not match the verified account.', 503);
      result.upload_policy.available_purposes = result.upload_policy.available_purposes.filter(purpose => purpose === 'client_logo' && logo?.uploadReady === true);
      return result;
    },
    async listProjects(actor: Actor, options: ListOptions = {}) { return rpc(actor, 'eps_list_projects', listArguments(options), value => listDto(value, projectDto)); },
    async getProject(actor: Actor, id: string) { return rpc(actor, 'eps_get_project', { p_project_id: identifier(id) }, projectDto); },
    async updateProject(actor: Actor, id: string, input: ProjectPatch, context?: MutationContext) {
      strictInput(input, ['row_version', 'name', 'client_name', 'client_logo_asset_id', 'expected_client_row_version'], ['row_version']);
      return rpc(actor, 'eps_update_project', { p_project_id: identifier(id), p_input: input, p_idempotency_key: key(context) }, projectDto, context);
    },
    async listWorkspaces(actor: Actor, options: ListOptions & { project_id?: string } = {}) { return rpc(actor, 'eps_list_workspaces', listArguments(options, true), value => listDto(value, workspaceDto)); },
    async createWorkspace(actor: Actor, input: WorkspaceCreate, context?: MutationContext) {
      strictInput(input, ['project_id', 'initial_output'], ['project_id', 'initial_output']);
      return rpc(actor, 'eps_create_workspace', { p_input: input, p_idempotency_key: key(context, true) }, workspaceDto, context);
    },
    async getWorkspace(actor: Actor, id: string) { return rpc(actor, 'eps_get_workspace', { p_workspace_id: identifier(id) }, workspaceDto); },
    async updateWorkspace(actor: Actor, id: string, input: WorkspacePatch, context?: MutationContext) {
      strictInput(input, ['row_version', 'logo_asset_id', 'logo_placement', 'active_output'], ['row_version']);
      return rpc(actor, 'eps_update_workspace', { p_workspace_id: identifier(id), p_input: input, p_idempotency_key: key(context) }, workspaceDto, context);
    },
    async listAudiencePresets(actor: Actor, options: ListOptions = {}) { return rpc(actor, 'eps_list_audience_presets', listArguments(options), value => listDto(value, audienceDto)); },
    async createAudiencePreset(actor: Actor, input: AudiencePresetCreate, context?: MutationContext) {
      strictInput(input, ['key', 'label', 'scope', 'settings'], ['label', 'scope', 'settings']);
      return rpc(actor, 'eps_create_audience_preset', { p_input: input, p_idempotency_key: key(context, true) }, audienceDto, context);
    },
    async updateAudiencePreset(actor: Actor, id: string, input: AudiencePresetPatch, context?: MutationContext) {
      strictInput(input, ['row_version', 'label', 'settings'], ['row_version']);
      return rpc(actor, 'eps_update_audience_preset', { p_preset_id: identifier(id), p_input: input, p_idempotency_key: key(context) }, audienceDto, context);
    },
    async archiveAudiencePreset(actor: Actor, id: string, input: { row_version: number; reason?: string | null }, context?: MutationContext) {
      strictInput(input, ['row_version', 'reason'], ['row_version']);
      return rpc(actor, 'eps_archive_audience_preset', { p_preset_id: identifier(id), p_input: input, p_idempotency_key: key(context, true) }, successDto, context);
    },
    async createUploadSession(actor: Actor, input: UploadSessionCreate, context?: MutationContext): Promise<UploadSession> { checkActor(actor); return logo ? logo.createUploadSession(actor, input, context) : centralStoragePending(); },
    async getUploadSession(actor: Actor, id: string): Promise<UploadSession> { checkActor(actor); return logo ? logo.getUploadSession(actor, id) : centralStoragePending(); },
    async completeUpload(actor: Actor, id: string, input: CompleteUpload, context?: MutationContext): Promise<UploadCompletion> { checkActor(actor); return logo ? logo.completeUpload(actor, id, input, context) : centralStoragePending(); },
    async cancelUpload(actor: Actor, id: string, context?: MutationContext): Promise<{ success: true; affected_ids: string[] }> { checkActor(actor); return logo ? logo.cancelUpload(actor, id, context) : centralStoragePending(); },
    async storeUploadedLogo(actor: Actor, _id: string, _bytes: Uint8Array): Promise<{ size_bytes: number; sha256: string }> { void _id; void _bytes; checkActor(actor); return centralStoragePending(); },
    async getMedia(actor: Actor, id: string): Promise<MediaAsset> { checkActor(actor); return logo ? logo.getMedia(actor, id) : centralStoragePending(); },
    async getMediaContent(actor: Actor, id: string): Promise<{ bytes: Buffer; mimeType: string }> { checkActor(actor); return logo ? logo.getMediaContent(actor, id) : centralStoragePending(); },
  };
}
export type CentralStudio = Awaited<ReturnType<typeof createCentralStudio>>;
