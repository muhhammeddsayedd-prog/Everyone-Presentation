import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, candidateEnglishFields, parseCandidateConfirmation, parseCandidateCreate, parseCandidateFacts, parseCandidatePatch,
  parseCandidateSearch, parseDuplicateResolution, parseFrameSelection, parseMediaRepairApply, parseWorkspaceCandidateCreate, parseWorkspaceCandidatePatch,
  type Actor, type Candidate, type CandidateConfirmation, type CandidateCreate, type CandidateFrame, type CandidateMedia,
  type CandidatePatch, type CandidateSearch, type CandidateUploadRow, type DuplicateMatch, type DuplicateResolution, type FrameSelection,
  type LibraryCandidate, type MediaRepairApply, type MediaRepairResult, type MediaRepairSuggestion,
  type MutationContext, type Page, type WorkspaceCandidate, type WorkspaceCandidateAdded, type WorkspaceCandidateCreate, type WorkspaceCandidatePatch } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';
import { candidateListPage, parseCandidateListOptions, type CandidateListOptions } from './candidate-list.ts';

export interface CandidateVersionInput { row_version: number; reason?: string | null }
export interface CandidateSuccess { success: true; affected_ids: string[] }
const invalid = (): never => { throw new DomainError('INVALID_REQUEST', 'Provide bounded resource IDs, row versions and a stable Idempotency-Key.', 400); };
const failed = (): never => { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central candidate data did not match its published contract.', 503); };
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
const isVersion = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const isNullableText = (value: unknown) => value === null || typeof value === 'string';
/** Opaque versioned keyset cursor (base64 JSON); the database validates its content. */
const isCursor = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 1000 && /^[A-Za-z0-9+/=]+$/u.test(value);
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === 'string'); }
function exact(value: unknown, fields: string[], optional: string[] = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key) && !optional.includes(key)) || fields.some(key => !Object.hasOwn(value, key))) failed();
  return value as Record<string, unknown>;
}
function response<T>(parser: () => T): T { try { return parser(); } catch { return failed(); } }
function candidateDto(value: unknown): Candidate {
  const row = exact(value, ['id', 'facts', 'review_status', 'reviewed_at', 'reviewed_by', 'search_match', 'possible_duplicate', 'merged_into_candidate_id', 'archived', 'row_version', 'created_at', 'updated_at']);
  if (!isId(row.id) || !isVersion(row.row_version) || !isDate(row.created_at) || !isDate(row.updated_at)
    || !['unreviewed', 'reviewed'].includes(row.review_status as string) || typeof row.possible_duplicate !== 'boolean' || typeof row.archived !== 'boolean'
    || !(row.merged_into_candidate_id === null || isId(row.merged_into_candidate_id))
    || row.review_status === 'reviewed' && (!isDate(row.reviewed_at) || !isId(row.reviewed_by))
    || row.review_status === 'unreviewed' && (row.reviewed_at !== null || row.reviewed_by !== null)) failed();
  const facts = response(() => parseCandidateFacts(row.facts));
  if (row.search_match !== null) {
    const match = exact(row.search_match, ['matched_filter_fields', 'unknown_filter_fields']);
    if (!strings(match.matched_filter_fields) || !strings(match.unknown_filter_fields)) failed();
  }
  return structuredClone({ ...row, facts }) as unknown as Candidate;
}
const fractionOk = (value: unknown, positive = false) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 && (!positive || value > 0);
function cropOk(value: unknown): boolean {
  if (value === null) return true;
  const crop = exact(value, ['focal_x', 'focal_y']);
  return fractionOk(crop.focal_x) && fractionOk(crop.focal_y);
}
/** Library search row: the profile plus card fields. */
function libraryDto(value: unknown): LibraryCandidate {
  const extras = ['name_ar', 'talent_type', 'tape_count', 'portrait_photo', 'portrait_frame_asset_id', 'processing', 'membership'];
  const row = exact(value, ['id', 'facts', 'review_status', 'reviewed_at', 'reviewed_by', 'search_match', 'possible_duplicate', 'merged_into_candidate_id', 'archived', 'row_version', 'created_at', 'updated_at', ...extras]);
  const base = candidateDto(Object.fromEntries(Object.entries(row).filter(([key]) => !extras.includes(key))));
  if (!isNullableText(row.name_ar) || !(row.talent_type === null || ['talent', 'real_family', 'group'].includes(row.talent_type as string))
    || typeof row.tape_count !== 'number' || !Number.isSafeInteger(row.tape_count) || row.tape_count < 0
    || !(row.portrait_frame_asset_id === null || isId(row.portrait_frame_asset_id)) || typeof row.processing !== 'boolean') failed();
  if (row.portrait_photo !== null) { const photo = exact(row.portrait_photo, ['photo_id', 'asset_id', 'thumb_asset_id']); if (![photo.photo_id, photo.asset_id, photo.thumb_asset_id].every(isId)) failed(); }
  if (row.membership !== null) { const member = exact(row.membership, ['workspace_candidate_id', 'state']); if (!isId(member.workspace_candidate_id) || member.state !== 'in_project') failed(); }
  return { ...base, name_ar: row.name_ar, talent_type: row.talent_type, tape_count: row.tape_count, portrait_photo: structuredClone(row.portrait_photo),
    portrait_frame_asset_id: row.portrait_frame_asset_id, processing: row.processing, membership: structuredClone(row.membership) } as LibraryCandidate;
}
function frameDto(value: unknown, source: string): CandidateFrame {
  const row = exact(value, ['asset_id', 'source_asset_id', 'timestamp_ms', 'width', 'height', 'quality_flags']);
  if (!isId(row.asset_id) || row.source_asset_id !== source || typeof row.timestamp_ms !== 'number' || !Number.isSafeInteger(row.timestamp_ms)
    || row.timestamp_ms < 0 || !isVersion(row.width) || !isVersion(row.height) || !strings(row.quality_flags)) failed();
  return structuredClone(row) as unknown as CandidateFrame;
}
function mediaDto(value: unknown): CandidateMedia {
  const row = exact(value, ['id', 'candidate_id', 'source_asset_id', 'preview_asset_id', 'transcript_asset_id', 'original_transcript', 'languages', 'available_frames', 'selected_frame_asset_ids', 'processing_issues', 'row_version'], ['english_transcript', 'english_transcript_status']);
  response(() => candidateEnglishFields(row));
  if (!isId(row.id) || !isId(row.candidate_id) || !isId(row.source_asset_id) || !isVersion(row.row_version)
    || !(row.preview_asset_id === null || isId(row.preview_asset_id)) || !(row.transcript_asset_id === null || isId(row.transcript_asset_id))
    || !isNullableText(row.original_transcript) || !strings(row.languages) || !Array.isArray(row.available_frames)
    || row.available_frames.length > 100 || !strings(row.selected_frame_asset_ids) || row.selected_frame_asset_ids.length > 3
    || !strings(row.processing_issues) || row.processing_issues.length > 6 || new Set(row.processing_issues).size !== row.processing_issues.length
    || row.processing_issues.some(code => !['NO_AUDIO','TRANSCRIPTION_FAILED','EXTRACTION_FAILED','INSUFFICIENT_FRAMES','FRAME_SELECTION_UNAVAILABLE','ENGLISH_TRANSCRIPT_UNAVAILABLE'].includes(code))) failed();
  const frames = (row.available_frames as unknown[]).map(frame => frameDto(frame, row.source_asset_id as string));
  const selected = row.selected_frame_asset_ids as string[];
  if (new Set(frames.map(frame => frame.asset_id)).size !== frames.length || new Set(selected).size !== selected.length || selected.some(id => !frames.some(frame => frame.asset_id === id))) failed();
  return structuredClone({ ...row, available_frames: frames }) as unknown as CandidateMedia;
}
const POOL_FIELDS = ['id', 'workspace_id', 'candidate_id', 'selected_candidate_media_id', 'selected_frame_asset_ids', 'availability', 'fresh_material_required', 'media_confirmed', 'internal_notes',
  'portrait_asset_id', 'portrait_source', 'portrait_crop', 'media_selection_state', 'row_version'];
function poolDto(value: unknown, extra: string[] = []): WorkspaceCandidate {
  const row = exact(value, [...POOL_FIELDS, ...extra]);
  if (!(row.portrait_asset_id === null || isId(row.portrait_asset_id)) || (row.portrait_asset_id === null) !== (row.portrait_source === null)
    || !(row.portrait_source === null || ['frame', 'photo'].includes(row.portrait_source as string)) || !cropOk(row.portrait_crop)
    || !['unset', 'pinned', 'intentionally_empty'].includes(row.media_selection_state as string)
    || row.media_selection_state === 'intentionally_empty' && row.portrait_asset_id !== null) failed();
  if (!isId(row.id) || !isId(row.workspace_id) || !isId(row.candidate_id) || !isVersion(row.row_version)
    || !(row.selected_candidate_media_id === null || isId(row.selected_candidate_media_id)) || !strings(row.selected_frame_asset_ids)
    || row.selected_frame_asset_ids.length > 3 || new Set(row.selected_frame_asset_ids).size !== row.selected_frame_asset_ids.length
    || row.selected_candidate_media_id === null && row.selected_frame_asset_ids.length > 0
    || !isNullableText(row.availability) || !isNullableText(row.internal_notes)
    || typeof row.fresh_material_required !== 'boolean' || typeof row.media_confirmed !== 'boolean') failed();
  return structuredClone(row) as unknown as WorkspaceCandidate;
}
function addedDto(value: unknown): WorkspaceCandidateAdded {
  const row = poolDto(value, ['already_member']) as WorkspaceCandidateAdded;
  if (typeof row.already_member !== 'boolean') failed();
  return row;
}
function uploadRowDto(value: unknown): CandidateUploadRow & { id: string } {
  const row = exact(value, ['upload_id', 'workspace_id', 'asset_id', 'filename', 'size_bytes', 'mime_type', 'target_candidate_id', 'created_at', 'upload_status', 'state', 'job', 'candidate_id', 'workspace_candidate_id']);
  if (!isId(row.upload_id) || !isId(row.workspace_id) || !isId(row.asset_id) || !isNullableText(row.filename) || !isVersion(row.size_bytes) || typeof row.mime_type !== 'string'
    || !(row.target_candidate_id === null || isId(row.target_candidate_id)) || !isDate(row.created_at)
    || !['open', 'completed', 'cancelled', 'expired'].includes(row.upload_status as string)
    || !['uploading', 'processing', 'ready', 'needs_attention', 'failed', 'cancelled', 'expired'].includes(row.state as string)
    || !(row.candidate_id === null || isId(row.candidate_id)) || !(row.workspace_candidate_id === null || isId(row.workspace_candidate_id))) failed();
  if (row.job !== null) {
    const job = exact(row.job, ['id', 'status', 'stage', 'error_code', 'retryable', 'row_version', 'updated_at']);
    if (!isId(job.id) || !['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'].includes(job.status as string) || typeof job.stage !== 'string'
      || !isNullableText(job.error_code) || typeof job.retryable !== 'boolean' || !isVersion(job.row_version) || !isDate(job.updated_at)) failed();
  }
  return { ...structuredClone(row), id: row.upload_id } as unknown as CandidateUploadRow & { id: string };
}
function repairSuggestionDto(value: unknown): MediaRepairSuggestion {
  const row = exact(value, ['workspace_candidate_id', 'candidate_id', 'row_version', 'reason', 'suggestion']);
  if (!isId(row.workspace_candidate_id) || !isId(row.candidate_id) || !isVersion(row.row_version) || !['default_available', 'no_media_available'].includes(row.reason as string)
    || (row.reason === 'no_media_available') !== (row.suggestion === null)) failed();
  if (row.suggestion !== null) {
    const item = exact(row.suggestion, ['selected_candidate_media_id', 'selected_frame_asset_ids', 'portrait_asset_id', 'portrait_source']);
    if (!(item.selected_candidate_media_id === null || isId(item.selected_candidate_media_id)) || !strings(item.selected_frame_asset_ids) || item.selected_frame_asset_ids.length > 3
      || !(item.portrait_asset_id === null || isId(item.portrait_asset_id)) || !(item.portrait_source === null || ['frame', 'photo'].includes(item.portrait_source as string))) failed();
  }
  return structuredClone(row) as unknown as MediaRepairSuggestion;
}
function repairResultDto(value: unknown): MediaRepairResult {
  const row = exact(value, ['applied', 'skipped']);
  if (!Array.isArray(row.applied) || !Array.isArray(row.skipped) || row.applied.length + row.skipped.length > 100) failed();
  const applied = (row.applied as unknown[]).map(item => poolDto(item));
  const skipped = (row.skipped as unknown[]).map(item => { const entry = exact(item, ['workspace_candidate_id', 'reason'], ['current_row_version']);
    if (!isId(entry.workspace_candidate_id) || !['changed', 'already_chosen', 'no_media_available', 'not_found'].includes(entry.reason as string)
      || entry.current_row_version !== undefined && !isVersion(entry.current_row_version)) failed();
    return structuredClone(entry); });
  return { applied, skipped } as MediaRepairResult;
}
function successDto(value: unknown): CandidateSuccess {
  const row = exact(value, ['success', 'affected_ids']);
  if (row.success !== true || !Array.isArray(row.affected_ids) || !row.affected_ids.every(isId)) failed();
  return structuredClone(row) as unknown as CandidateSuccess;
}
function pageDto<T extends { id: string }>(value: unknown, maximum: number, parser: (value: unknown) => T): { data: T[]; page: Page } {
  const row = exact(value, ['data', 'page']); const page = exact(row.page, ['next_cursor']);
  if (!Array.isArray(row.data) || row.data.length > maximum || !(page.next_cursor === null || typeof page.next_cursor === 'string' && page.next_cursor.length <= 4000)) failed();
  const data = (row.data as unknown[]).map(parser); if (new Set(data.map(item => item.id)).size !== data.length) failed();
  return { data, page: { next_cursor: page.next_cursor as string | null } };
}
function versionInput(value: unknown): CandidateVersionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['row_version','reason'].includes(key)) || !isVersion((value as Record<string, unknown>).row_version)) invalid();
  const input=value as CandidateVersionInput;
  if(Object.hasOwn(input,'reason') && input.reason!==null && (typeof input.reason!=='string'||input.reason.length>10000))invalid();
  return { row_version: input.row_version, ...(Object.hasOwn(input,'reason')?{reason:input.reason?.trim()||null}:{}) };
}

/** User-JWT-only library operations; the database derives capabilities and scope. */
export async function createCentralCandidates(client: SupabaseClient) {
  const identity = await verifyCentralUser(client);
  function actorRequired(actor: Actor) { if (actor?.principal_id !== identity.principal_id) throw new DomainError('ACCESS_DENIED', 'The candidate actor does not match this verified session.', 403); }
  function identifier(value: string): string { if (!isId(value)) invalid(); return value; }
  function contextKey(context: MutationContext | undefined): string {
    const value = context?.idempotencyKey;
    if (typeof value !== 'string' || value.trim().length < 16 || value.length > 200) return invalid();
    return value;
  }
  async function rpc<T>(actor: Actor, name: string, args: Record<string, unknown>, parser: (value: unknown) => T, context?: MutationContext): Promise<T> {
    actorRequired(actor);
    try {
      let query = client.rpc(name, args);
      if (context?.requestId && /^[A-Za-z0-9._:-]{1,128}$/u.test(context.requestId)) query = query.setHeader('X-EPS-Request-ID', context.requestId);
      if (context?.clientType) { if (!['browser', 'api', 'mcp'].includes(context.clientType)) invalid(); query = query.setHeader('X-EPS-Client-Type', context.clientType); }
      const { data, error } = await query;
      if (error) {
        const domainErrors: Record<string, { status: number; message: string }> = {
          MEDIA_REFERENCE_INVALID: { status: 422, message: 'Choose accessible ready media and frames belonging to this candidate source.' },
          DUPLICATE_WORKSPACE_CONFLICT: { status: 409, message: 'Resolve project participation before linking these profiles.' },
          ASSIGNMENT_RETIREMENT_UNAVAILABLE: { status: 503, message: 'Assignment archival must be available before removing this project candidate.' },
        };
        const known = error.code === 'P0001' ? domainErrors[error.message] : undefined;
        if (known) throw new DomainError(error.message, known.message, known.status);
        // An add replayed with an old key after that membership was removed: name the removed row, start a new add.
        if (error.code === 'P0001' && error.message === 'MEMBERSHIP_REMOVED') {
          let removed: unknown; try { removed = (JSON.parse(String(error.details ?? '')) as Record<string, unknown>)?.removed_workspace_candidate_id; } catch { /* never surface raw details */ }
          throw new DomainError('MEMBERSHIP_REMOVED', 'This person was removed from the project after this add. Start a new add (new Idempotency-Key) to bring them back.', 409,
            typeof removed === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(removed) ? { removed_workspace_candidate_id: removed } : {});
        }
        throw centralRpcError(error);
      }
      return response(() => parser(data));
    } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('DEPENDENCY_UNAVAILABLE', 'The central cast library is temporarily unavailable.', 503, {}, true); }
  }
  function mutate<T>(actor: Actor, operation: string, resource: Record<string, unknown>, input: unknown, parser: (value: unknown) => T, context?: MutationContext) {
    actorRequired(actor); const key = contextKey(context);
    return rpc(actor, `eps_${operation}`, { ...resource, p_input: input, p_idempotency_key: key }, parser, context);
  }
  return {
    async searchCandidates(actor: Actor, options: CandidateSearch = {}) {
      const input = parseCandidateSearch(options);
      return rpc(actor, 'eps_search_candidates', { p_search: input }, value => {
        const result = pageDto(value, input.limit ?? 25, libraryDto);
        if (result.data.some(row => row.archived || row.merged_into_candidate_id !== null)) failed(); return result;
      });
    },
    async createCandidate(actor: Actor, input: CandidateCreate, context?: MutationContext) {
      return mutate(actor, 'create_candidate', {}, parseCandidateCreate(input), candidateDto, context);
    },
    async getCandidate(actor: Actor, candidateId: string) {
      return rpc(actor, 'eps_get_candidate', { p_candidate_id: identifier(candidateId) }, value => { const result = candidateDto(value); if (result.id !== candidateId) failed(); return result; });
    },
    async updateCandidate(actor: Actor, candidateId: string, input: CandidatePatch, context?: MutationContext) {
      return mutate(actor, 'update_candidate', { p_candidate_id: identifier(candidateId) }, parseCandidatePatch(input), candidateDto, context);
    },
    async confirmCandidateReviewed(actor: Actor, candidateId: string, input: CandidateConfirmation, context?: MutationContext) {
      return mutate(actor, 'confirm_candidate_reviewed', { p_candidate_id: identifier(candidateId) }, parseCandidateConfirmation(input), candidateDto, context);
    },
    async archiveCandidate(actor: Actor, candidateId: string, input: CandidateVersionInput, context?: MutationContext) {
      return mutate(actor, 'archive_candidate', { p_candidate_id: identifier(candidateId) }, versionInput(input), successDto, context);
    },
    async getCandidateMedia(actor: Actor, candidateId: string, options: CandidateListOptions = {}) {
      actorRequired(actor); identifier(candidateId);
      const position = parseCandidateListOptions(options, { operation: 'candidate_media', principalId: actor.principal_id, candidateId });
      return rpc(actor, 'eps_get_candidate_media', { p_candidate_id: identifier(candidateId) }, value => {
        if (!Array.isArray(value)) failed(); const result = (value as unknown[]).map(mediaDto);
        if (result.some(row => row.candidate_id !== candidateId)) failed();
        return candidateListPage(result, position, row => row.id);
      });
    },
    async updateCandidateFrames(actor: Actor, mediaId: string, input: FrameSelection, context?: MutationContext) {
      return mutate(actor, 'update_candidate_frames', { p_candidate_media_id: identifier(mediaId) }, parseFrameSelection(input), mediaDto, context);
    },
    async findCandidateDuplicates(actor: Actor, candidateId: string, options: CandidateListOptions = {}) {
      actorRequired(actor); identifier(candidateId);
      const position = parseCandidateListOptions(options, { operation: 'duplicate_matches', principalId: actor.principal_id, candidateId });
      return rpc(actor, 'eps_find_candidate_duplicates', { p_candidate_id: identifier(candidateId) }, value => {
        if (!Array.isArray(value)) failed(); const result = (value as unknown[]).map(item => {
          const row = exact(item, ['candidate_id', 'display_name', 'match_reasons']);
          if (!isId(row.candidate_id) || row.candidate_id === candidateId || !isNullableText(row.display_name) || !strings(row.match_reasons)) failed();
          return structuredClone(row) as unknown as DuplicateMatch;
        });
        return candidateListPage(result, position, row => row.candidate_id);
      });
    },
    async resolveCandidateDuplicate(actor: Actor, candidateId: string, input: DuplicateResolution, context?: MutationContext) {
      return mutate(actor, 'resolve_candidate_duplicate', { p_candidate_id: identifier(candidateId) }, parseDuplicateResolution(input), candidateDto, context);
    },
    async listWorkspaceCandidates(actor: Actor, workspaceId: string, options: { cursor?: string; limit?: number } = {}) {
      if (!options || typeof options !== 'object' || Object.keys(options).some(key => !['cursor', 'limit'].includes(key)) || options.cursor !== undefined && !isCursor(options.cursor)
        || options.limit !== undefined && (!isVersion(options.limit) || options.limit > 100)) invalid();
      return rpc(actor, 'eps_list_workspace_candidates', { p_workspace_id: identifier(workspaceId), p_cursor: options.cursor ?? null, p_limit: options.limit ?? 25 }, value => {
        const result = pageDto(value, options.limit ?? 25, item => poolDto(item)); if (result.data.some(row => row.workspace_id !== workspaceId)) failed(); return result;
      });
    },
    async addWorkspaceCandidate(actor: Actor, workspaceId: string, input: WorkspaceCandidateCreate, context?: MutationContext) {
      return mutate(actor, 'add_workspace_candidate', { p_workspace_id: identifier(workspaceId) }, parseWorkspaceCandidateCreate(input), value => { const row = addedDto(value); if (row.workspace_id !== workspaceId || row.candidate_id !== input.candidate_id) failed(); return row; }, context);
    },
    async updateWorkspaceCandidate(actor: Actor, poolId: string, input: WorkspaceCandidatePatch, context?: MutationContext) {
      return mutate(actor, 'update_workspace_candidate', { p_workspace_candidate_id: identifier(poolId) }, parseWorkspaceCandidatePatch(input), value => poolDto(value), context);
    },
    async removeWorkspaceCandidate(actor: Actor, poolId: string, input: CandidateVersionInput, context?: MutationContext) {
      return mutate(actor, 'remove_workspace_candidate', { p_workspace_candidate_id: identifier(poolId) }, versionInput(input), successDto, context);
    },
    /** The caller's candidate video uploads in a project, newest first, with processing state. */
    async listWorkspaceUploads(actor: Actor, workspaceId: string, options: { cursor?: string; limit?: number } = {}) {
      if (!options || typeof options !== 'object' || Object.keys(options).some(key => !['cursor', 'limit'].includes(key)) || options.cursor !== undefined && !isCursor(options.cursor)
        || options.limit !== undefined && (!isVersion(options.limit) || options.limit > 100)) invalid();
      return rpc(actor, 'eps_list_workspace_uploads', { p_workspace_id: identifier(workspaceId), p_cursor: options.cursor ?? null, p_limit: options.limit ?? 25 }, value => {
        const result = pageDto(value, options.limit ?? 25, uploadRowDto); if (result.data.some(row => row.workspace_id !== workspaceId)) failed();
        return { data: result.data.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'id')) as unknown as CandidateUploadRow), page: result.page };
      });
    },
    async suggestMediaRepairs(actor: Actor, workspaceId: string) {
      return rpc(actor, 'eps_suggest_media_repairs', { p_workspace_id: identifier(workspaceId) }, value => {
        const row = exact(value, ['data', 'has_more']); if (!Array.isArray(row.data) || row.data.length > 200 || typeof row.has_more !== 'boolean') failed();
        return { data: (row.data as unknown[]).map(repairSuggestionDto), has_more: row.has_more as boolean };
      });
    },
    async applyMediaRepairs(actor: Actor, workspaceId: string, input: MediaRepairApply, context?: MutationContext) {
      return mutate(actor, 'apply_media_repairs', { p_workspace_id: identifier(workspaceId) }, parseMediaRepairApply(input), value => {
        const result = repairResultDto(value); if (result.applied.some(row => row.workspace_id !== workspaceId)) failed(); return result;
      }, context);
    },
  };
}
export type CentralCandidates = Awaited<ReturnType<typeof createCentralCandidates>>;
