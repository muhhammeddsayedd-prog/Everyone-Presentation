import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, type Actor, type AudiencePresetCreate, type AudiencePresetPatch, type CompleteUpload, type ListOptions,
  type MediaAsset, type MutationContext, type ProjectPatch, type UploadCompletion, type UploadSession, type UploadSessionCreate,
  type WorkspaceCreate, type WorkspacePatch } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';
import { audienceDto, capabilitiesDto, listDto, projectDto, successDto, workspaceDto } from './dto.ts';
import { createLogoStorageAdapter, type LogoStorageOptions } from './logo-storage.ts';
import { createSpecsStorageAdapter, type SpecsStorageOptions } from './specs-storage.ts';
import { createCandidateStorageAdapter } from './candidate-storage.ts';
import {createCandidateSupportStorageAdapter,type SupportStorageOptions} from './candidate-support-storage.ts';
import { parseWorkspaceSummary, workspaceSummaryId, PRESENTATION_TYPES, parseProjectCreate, type ProjectCreate } from '@eps/domain';
import { clientSummaryDto } from './dto.ts';

export interface CentralStudioOptions {
  logo?: Omit<LogoStorageOptions, 'client' | 'rpc' | 'now' | 'downloadTimeoutMs'>;
  logoRead?: Pick<LogoStorageOptions, 'storageOrigin' | 'brandBucket'>;
  specs?: Omit<SpecsStorageOptions, 'client' | 'rpc' | 'now' | 'downloadTimeoutMs'>;
  specsRead?: Pick<SpecsStorageOptions, 'storageOrigin'>;
  candidate?: { storageOrigin: string; maximumBytes?: number };
  /** Ready reads remain available independently of upload readiness/limits. */
  candidateRead?: { storageOrigin: string };
  support?: Omit<SupportStorageOptions,'client'|'rpc'|'now'|'downloadTimeoutMs'>;
  supportRead?: Pick<SupportStorageOptions,'storageOrigin'>;
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
  if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length < 16 || value.length > 200) || required && value === undefined) invalid('A valid Idempotency-Key is required for this operation.');
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
  throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'This private upload or media operation is not available yet. Existing project data remains available.', 503);
}
function scopedDto<T>(value: unknown, parse: (value: unknown) => T, inScope: (result: T) => boolean): T {
  const result = parse(value);
  if (!inScope(result)) throw new DomainError('CENTRAL_RESPONSE_INVALID', 'The central response did not match the requested resource scope.', 503);
  return result;
}

const generatedMediaPurposes = ['preview_video', 'presentation_pdf', 'presentation_preview', 'presentation_manifest', 'document_text', 'document_page'];

/** Scope RPCs return public metadata alongside private Storage locators. Source
 * adapters must still fetch their own exact record before reading/signing bytes. */
function scopedMediaAsset(value: unknown, requestedId: string): MediaAsset {
  const malformed = (): never => { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'The private media scope response did not match its contract.', 503); };
  const record = (entry: unknown): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry);
  const fields = ['id','purpose','filename','mime_type','size_bytes','sha256','status','duration_ms','width','height','source_asset_id','source_timestamp_ms','created_at'];
  const text = (entry: unknown, maximum: number) => typeof entry === 'string' && entry.length > 0 && entry.length <= maximum && !/[\p{C}]/u.test(entry);
  const number = (entry: unknown, minimum: number) => typeof entry === 'number' && Number.isSafeInteger(entry) && entry >= minimum;
  if (!record(value) || Object.keys(value).length !== 3 || !Object.hasOwn(value,'asset') || !Object.hasOwn(value,'bucket') || !Object.hasOwn(value,'object_key')
    || !text(value.bucket,100) || !text(value.object_key,2000) || !record(value.asset)) return malformed();
  const asset = value.asset;
  if (Object.keys(asset).length !== fields.length || fields.some(field=>!Object.hasOwn(asset,field)) || asset.id !== requestedId
    || typeof asset.purpose !== 'string' || !['client_logo','specs','candidate_video','candidate_support','candidate_frame','audio','transcript', ...generatedMediaPurposes].includes(asset.purpose)
    || !text(asset.filename,255) || !text(asset.mime_type,200) || !number(asset.size_bytes,generatedMediaPurposes.includes(asset.purpose) ? 0 : 1)
    || !(asset.sha256 === null || typeof asset.sha256 === 'string' && /^[a-f0-9]{64}$/u.test(asset.sha256))
    || typeof asset.status !== 'string' || !['uploading','ready','failed','quarantined','archived'].includes(asset.status)
    || !['duration_ms','source_timestamp_ms'].every(field=>asset[field] === null || number(asset[field],0))
    || !['width','height'].every(field=>asset[field] === null || number(asset[field],1))
    || !(asset.source_asset_id === null || text(asset.source_asset_id,200))
    || typeof asset.created_at !== 'string' || !Number.isFinite(Date.parse(asset.created_at))) return malformed();
  return { id: asset.id, purpose: asset.purpose, filename: asset.filename, mime_type: asset.mime_type, size_bytes: asset.size_bytes,
    sha256: asset.sha256, status: asset.status, duration_ms: asset.duration_ms, width: asset.width, height: asset.height,
    source_asset_id: asset.source_asset_id, source_timestamp_ms: asset.source_timestamp_ms, created_at: asset.created_at } as MediaAsset;
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
  const specsOptions = options.specs ?? options.specsRead;
  const specs = specsOptions ? await createSpecsStorageAdapter({ ...specsOptions, client, rpc: {
    reserveUpload: (actor, input, context) => rpc(actor, 'eps_reserve_specs_upload', { p_input: input, p_idempotency_key: key(context, true) }, raw, context),
    getUpload: (actor, uploadId) => rpc(actor, 'eps_get_specs_upload', { p_upload_id: identifier(uploadId) }, raw),
    prepareCompletion: (actor, uploadId, input, context) => rpc(actor, 'eps_prepare_specs_completion', { p_upload_id: identifier(uploadId), p_input: input, p_idempotency_key: key(context, true) }, raw, context),
    finalizeCompletion: (actor, uploadId, input, proof, context) => rpc(actor, 'eps_finalize_specs_completion', { p_upload_id: identifier(uploadId), p_input: input, p_idempotency_key: key(context, true), p_payload: proof.payload, p_mac: proof.mac }, raw, context),
    cancelUpload: (actor, uploadId, context) => rpc(actor, 'eps_cancel_specs_upload', { p_upload_id: identifier(uploadId), p_idempotency_key: key(context, true) }, raw, context),
    getMedia: (actor, assetId) => rpc(actor, 'eps_get_specs_media', { p_asset_id: identifier(assetId) }, raw),
  } }) : undefined;
  const candidateOptions = options.candidate ?? options.candidateRead;
  const candidate = candidateOptions ? await createCandidateStorageAdapter({ ...candidateOptions, uploadsEnabled: options.candidate !== undefined, client, rpc: {
    reserveUpload: (actor,input,context) => rpc(actor,'eps_reserve_candidate_upload',{p_input:input,p_idempotency_key:key(context,true)},raw,context),
    getUpload: (actor,id) => rpc(actor,'eps_get_candidate_upload',{p_upload_id:identifier(id)},raw),
    completeUpload: (actor,id,input,context) => rpc(actor,'eps_complete_candidate_upload',{p_upload_id:identifier(id),p_input:input,p_idempotency_key:key(context,true)},raw,context),
    cancelUpload: (actor,id,context) => rpc(actor,'eps_cancel_candidate_upload',{p_upload_id:identifier(id),p_idempotency_key:key(context,true)},raw,context),
    getMedia: (actor,id) => rpc(actor,'eps_get_candidate_asset',{p_asset_id:identifier(id)},raw),
  }}) : undefined;
  const supportOptions=options.support??options.supportRead;
  const support=supportOptions?await createCandidateSupportStorageAdapter({...supportOptions,uploadsEnabled:options.support!==undefined,client,rpc:{
    reserveUpload:(actor,input,context)=>rpc(actor,'eps_reserve_support_upload',{p_input:input,p_idempotency_key:key(context,true)},raw,context),
    getUpload:(actor,id)=>rpc(actor,'eps_get_support_upload',{p_upload_id:identifier(id)},raw),
    prepareCompletion:(actor,id,input,context)=>rpc(actor,'eps_prepare_support_completion',{p_upload_id:identifier(id),p_input:input,p_idempotency_key:key(context,true)},raw,context),
    finalizeCompletion:(actor,id,input,proof,context)=>rpc(actor,'eps_finalize_support_completion',{p_upload_id:identifier(id),p_input:input,p_idempotency_key:key(context,true),p_payload:proof.payload,p_mac:proof.mac},raw,context),
    cancelUpload:(actor,id,context)=>rpc(actor,'eps_cancel_support_upload',{p_upload_id:identifier(id),p_idempotency_key:key(context,true)},raw,context),
    getMedia:(actor,id)=>rpc(actor,'eps_get_candidate_support_asset',{p_asset_id:identifier(id)},raw),
  }}):undefined;
  async function mediaOrStorageFor(actor: Actor, id: string, media = false, metadata = false) {
    checkActor(actor);
    if (!metadata && !logo && !specs && !candidate && !support) return centralStoragePending();
    const args = media ? { p_asset_id: identifier(id) } : { p_upload_id: identifier(id) };
    // Only a typed not-found selects the next scope probe. Denial or malformed
    // metadata never falls through. Upload routing stays purpose-specific.
    // Preserve the original logo scope probe even without a local logo verifier.
    const adapters = [
      {adapter:logo,operation:media?'eps_get_logo_media':'eps_get_logo_upload'},
      ...(specs ? [{adapter:specs,operation:media?'eps_get_specs_media':'eps_get_specs_upload'}] : []),
      ...(candidate ? [{adapter:candidate,operation:media?'eps_get_candidate_asset':'eps_get_candidate_upload'}] : []),
      ...(support ? [{adapter:support,operation:media?'eps_get_candidate_support_asset':'eps_get_support_upload'}] : []),
    ];
    if (media && (candidate||support)) {
      // Library media is authorized by global cast.read, independently of the
      // originating project's logo/specs scope. Use freshly verified central
      // capabilities solely to order probes; each own RPC still authorizes now.
      const capabilities = await rpc(actor,'eps_get_capabilities',{},capabilitiesDto);
      if (capabilities.principal_id !== identity.principal_id) throw new DomainError('CENTRAL_RESPONSE_INVALID','Central capabilities did not match the verified account.',503);
      if (capabilities.capabilities.includes('cast.read')) {
        const index = adapters.findIndex(entry=>entry.operation==='eps_get_candidate_asset');
        if (index >= 0) adapters.unshift(...adapters.splice(index,1));
        const supportIndex=adapters.findIndex(entry=>entry.operation==='eps_get_candidate_support_asset');
        if(supportIndex>=0)adapters.unshift(...adapters.splice(supportIndex,1));
      }
    }
    for (const entry of adapters) {
      try {
        const scoped = await rpc(actor,entry.operation,args,raw);
        if (media) {
          const asset = scopedMediaAsset(scoped,id); const purpose = asset.purpose;
          if (entry.operation==='eps_get_candidate_asset' && !['candidate_video','candidate_frame','audio','transcript'].includes(purpose)
            || entry.operation==='eps_get_specs_media' && purpose!=='specs'
            || entry.operation==='eps_get_candidate_support_asset'&&purpose!=='candidate_support') throw new DomainError('CENTRAL_RESPONSE_INVALID','The private media scope returned an unexpected purpose.',503);
          if (generatedMediaPurposes.includes(purpose)) {
            if (!metadata) throw new DomainError('CENTRAL_RESPONSE_INVALID','The private media scope returned an unexpected purpose.',503);
            return { kind: 'metadata' as const, asset };
          }
          return { kind: 'storage' as const, adapter: (purpose === 'client_logo' ? logo : purpose === 'specs' ? specs : purpose==='candidate_support'?support:candidate) ?? centralStoragePending() };
        }
        return { kind: 'storage' as const, adapter: entry.adapter ?? centralStoragePending() };
      }
      catch(error) { if (!(error instanceof DomainError&&error.code==='RESOURCE_NOT_FOUND'&&error.status===404))throw error; }
    }
    throw new DomainError('RESOURCE_NOT_FOUND','Private upload or media not found.',404);
  }
  async function storageFor(actor: Actor, id: string, media = false) {
    const result = await mediaOrStorageFor(actor, id, media);
    return result.kind === 'storage' ? result.adapter : centralStoragePending();
  }
  return {
    verifiedIdentity: identity,
    fixtureActors(): { id: string; display_name: string; role: string }[] { return []; },
    resolveFixtureActor(_id: string): Actor { void _id; throw new DomainError('FIXTURE_MODE_FORBIDDEN', 'Development identities are unavailable in central mode.', 503); },
    async getCapabilities(actor: Actor) {
      const result = await rpc(actor, 'eps_get_capabilities', {}, capabilitiesDto);
      if (result.principal_id !== identity.principal_id) throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central capabilities did not match the verified account.', 503);
      const videoMimes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
      const candidateAllowed = candidate?.uploadReady === true && result.capabilities.includes('cast.read') && result.capabilities.includes('cast.upload') && result.capabilities.includes('workspaces.write');
      const supportAllowed=support?.uploadReady===true&&result.capabilities.includes('cast.upload')&&result.capabilities.includes('cast.read')&&result.capabilities.includes('workspaces.write');
      const policy = result.upload_policy; const legacyMaximum = policy.maximum_file_bytes;
      policy.available_purposes = [...new Set(policy.available_purposes.filter(purpose => purpose === 'client_logo' && logo?.uploadReady === true
        || purpose === 'specs' && specs?.uploadReady === true || purpose === 'candidate_video' && candidateAllowed ||purpose==='candidate_support'&&supportAllowed))];
      // The existing M02 RPC advertises its own purposes only. The separately
      // configured M03 adapter can extend discovery; reservation SQL still
      // rechecks the verified user's current authority, config and file limits.
      if (candidateAllowed && !policy.available_purposes.includes('candidate_video')) policy.available_purposes.push('candidate_video');
      if(supportAllowed&&!policy.available_purposes.includes('candidate_support'))policy.available_purposes.push('candidate_support');
      policy.allowed_mime_types = [...new Set([...policy.allowed_mime_types.filter(mime => !videoMimes.includes(mime)), ...(candidateAllowed ? videoMimes : [])])];
      if(supportAllowed)policy.allowed_mime_types=[...new Set([...policy.allowed_mime_types,'image/png','image/jpeg','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])];
      // This is the global envelope across enabled purposes. Their independent
      // adapters retain the 5MiB logo /20MiB document and configured video caps.
      const limits = policy.available_purposes.map(purpose => purpose === 'candidate_video' ? candidate!.maximumBytes
        : purpose==='candidate_support'?support!.maximumBytes:Math.min(legacyMaximum, purpose === 'client_logo' ? 5 * 1024 * 1024 : 20 * 1024 * 1024));
      if (limits.length) policy.maximum_file_bytes = Math.max(...limits);
      return result;
    },
    async listProjects(actor: Actor, options: ListOptions = {}) { return rpc(actor, 'eps_list_projects', listArguments(options), value => listDto(value, projectDto)); },
    async listPresentationTypes(actor: Actor) {
      const grants = await rpc(actor, 'eps_get_capabilities', {}, capabilitiesDto);
      if (!grants.capabilities.includes('projects.read')) throw new DomainError('CAPABILITY_REQUIRED', 'Project read permission is required.', 403);
      return structuredClone(PRESENTATION_TYPES);
    },
    async listClients(actor: Actor, options: ListOptions = {}) { return rpc(actor, 'eps_list_project_clients', listArguments(options), value => listDto(value, clientSummaryDto)); },
    async createProject(actor: Actor, input: ProjectCreate, context?: MutationContext) {
      const parsed = parseProjectCreate(input);
      return rpc(actor, 'eps_create_project', { p_input: parsed, p_idempotency_key: key(context, true) }, value => scopedDto(value, projectDto,
        row => row.name === parsed.name && row.presentation_type === parsed.presentation_type && row.client_id === (parsed.client_id ?? null)), context);
    },
    async getProject(actor: Actor, id: string) { return rpc(actor, 'eps_get_project', { p_project_id: identifier(id) }, value => scopedDto(value, projectDto, row => row.id === id)); },
    async updateProject(actor: Actor, id: string, input: ProjectPatch, context?: MutationContext) {
      strictInput(input, ['row_version', 'name', 'client_name', 'client_logo_asset_id', 'expected_client_row_version'], ['row_version']);
      return rpc(actor, 'eps_update_project', { p_project_id: identifier(id), p_input: input, p_idempotency_key: key(context) }, value => scopedDto(value, projectDto, row => row.id === id), context);
    },
    async listWorkspaces(actor: Actor, options: ListOptions & { project_id?: string } = {}) { return rpc(actor, 'eps_list_workspaces', listArguments(options, true), value => listDto(value, workspaceDto)); },
    async createWorkspace(actor: Actor, input: WorkspaceCreate, context?: MutationContext) {
      strictInput(input, ['project_id', 'initial_output'], ['project_id', 'initial_output']);
      return rpc(actor, 'eps_create_workspace', { p_input: input, p_idempotency_key: key(context, true) }, value => scopedDto(value, workspaceDto, row => row.project_id === input.project_id), context);
    },
    async getWorkspace(actor: Actor, id: string) { return rpc(actor, 'eps_get_workspace', { p_workspace_id: identifier(id) }, value => scopedDto(value, workspaceDto, row => row.id === id)); },
    async getWorkspaceSummary(actor: Actor, id: string) {
      const workspaceId = workspaceSummaryId(id);
      return rpc(actor, 'eps_get_workspace_summary', { p_workspace_id: workspaceId }, value => parseWorkspaceSummary(value, workspaceId));
    },
    async updateWorkspace(actor: Actor, id: string, input: WorkspacePatch, context?: MutationContext) {
      strictInput(input, ['row_version', 'logo_asset_id', 'logo_placement', 'active_output'], ['row_version']);
      return rpc(actor, 'eps_update_workspace', { p_workspace_id: identifier(id), p_input: input, p_idempotency_key: key(context) }, value => scopedDto(value, workspaceDto, row => row.id === id), context);
    },
    async listAudiencePresets(actor: Actor, options: ListOptions = {}) { return rpc(actor, 'eps_list_audience_presets', listArguments(options), value => listDto(value, audienceDto)); },
    async createAudiencePreset(actor: Actor, input: AudiencePresetCreate, context?: MutationContext) {
      strictInput(input, ['key', 'label', 'scope', 'settings'], ['label', 'scope', 'settings']);
      return rpc(actor, 'eps_create_audience_preset', { p_input: input, p_idempotency_key: key(context, true) }, audienceDto, context);
    },
    async updateAudiencePreset(actor: Actor, id: string, input: AudiencePresetPatch, context?: MutationContext) {
      strictInput(input, ['row_version', 'label', 'settings'], ['row_version']);
      return rpc(actor, 'eps_update_audience_preset', { p_preset_id: identifier(id), p_input: input, p_idempotency_key: key(context) }, value => scopedDto(value, audienceDto, row => row.id === id), context);
    },
    async archiveAudiencePreset(actor: Actor, id: string, input: { row_version: number; reason?: string | null }, context?: MutationContext) {
      strictInput(input, ['row_version', 'reason'], ['row_version']);
      return rpc(actor, 'eps_archive_audience_preset', { p_preset_id: identifier(id), p_input: input, p_idempotency_key: key(context, true) }, value => scopedDto(value, successDto, row => row.affected_ids.length === 1 && row.affected_ids[0] === id), context);
    },
    async createUploadSession(actor: Actor, input: UploadSessionCreate, context?: MutationContext): Promise<UploadSession> {
      checkActor(actor);
      strictInput(input, ['workspace_id', 'candidate_id', 'batch_id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256'], ['purpose', 'filename', 'mime_type', 'size_bytes']);
      if (!['client_logo', 'specs', 'candidate_video', 'candidate_support'].includes(input.purpose)) invalid('Provide a supported upload purpose.');
      if (input.purpose === 'client_logo') return logo ? logo.createUploadSession(actor, input, context) : centralStoragePending();
      if (input.purpose === 'specs') {
        if (typeof input.workspace_id !== 'string') invalid('A document requires a workspace identifier.');
        return specs ? specs.createUploadSession(actor, { ...input, purpose: 'specs', workspace_id: input.workspace_id }, context) : centralStoragePending();
      }
      if(input.purpose==='candidate_video') {
        if(typeof input.workspace_id!=='string')invalid('A candidate introduction requires a workspace identifier.');
        return candidate?candidate.createUploadSession(actor,{...input,purpose:'candidate_video',workspace_id:input.workspace_id},context):centralStoragePending();
      }
      if(input.purpose==='candidate_support'){
        if(typeof input.workspace_id!=='string'||typeof input.candidate_id!=='string')invalid('A supporting file requires an explicit candidate and workspace.');
        return support?support.createUploadSession(actor,input,context):centralStoragePending();
      }
      return centralStoragePending();
    },
    async getUploadSession(actor: Actor, id: string): Promise<UploadSession> { return (await storageFor(actor, id)).getUploadSession(actor, id); },
    async completeUpload(actor: Actor, id: string, input: CompleteUpload, context?: MutationContext): Promise<UploadCompletion> { return (await storageFor(actor, id)).completeUpload(actor, id, input, context); },
    async cancelUpload(actor: Actor, id: string, context?: MutationContext): Promise<{ success: true; affected_ids: string[] }> { return (await storageFor(actor, id)).cancelUpload(actor, id, context); },
    async storeUploadedLogo(actor: Actor, _id: string, _bytes: Uint8Array): Promise<{ size_bytes: number; sha256: string }> { void _id; void _bytes; checkActor(actor); return centralStoragePending(); },
    async getMedia(actor: Actor, id: string): Promise<MediaAsset> {
      const result = await mediaOrStorageFor(actor, id, true, true);
      return result.kind === 'metadata' ? result.asset : result.adapter.getMedia(actor, id);
    },
    async getMediaContent(actor: Actor, id: string): Promise<{ bytes: Buffer; mimeType: string }> { return (await storageFor(actor, id, true)).getMediaContent(actor, id); },
    async playMedia(actor:Actor,id:string) { checkActor(actor);return candidate?candidate.playMedia(actor,id):centralStoragePending(); },
  };
}
export type CentralStudio = Awaited<ReturnType<typeof createCentralStudio>>;
