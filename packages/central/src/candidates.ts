import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError, parseCandidateConfirmation, parseCandidateCreate, parseCandidateFacts, parseCandidatePatch,
  parseCandidateSearch, parseDuplicateResolution, parseFrameSelection, parseWorkspaceCandidateCreate, parseWorkspaceCandidatePatch,
  type Actor, type Candidate, type CandidateConfirmation, type CandidateCreate, type CandidateFrame, type CandidateMedia,
  type CandidatePatch, type CandidateSearch, type DuplicateMatch, type DuplicateResolution, type FrameSelection,
  type MutationContext, type Page, type WorkspaceCandidate, type WorkspaceCandidateCreate, type WorkspaceCandidatePatch } from '@eps/domain';
import { verifyCentralUser } from './client.ts';
import { centralRpcError } from './errors.ts';

export interface CandidateVersionInput { row_version: number; reason?: string | null }
export interface CandidateSuccess { success: true; affected_ids: string[] }
const invalid = (): never => { throw new DomainError('INVALID_REQUEST', 'Provide bounded resource IDs, row versions and a stable Idempotency-Key.', 400); };
const failed = (): never => { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'Central candidate data did not match its published contract.', 503); };
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
const isVersion = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const isNullableText = (value: unknown) => value === null || typeof value === 'string';
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === 'string'); }
function exact(value: unknown, fields: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value, key))) failed();
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
function frameDto(value: unknown, source: string): CandidateFrame {
  const row = exact(value, ['asset_id', 'source_asset_id', 'timestamp_ms', 'width', 'height', 'quality_flags']);
  if (!isId(row.asset_id) || row.source_asset_id !== source || typeof row.timestamp_ms !== 'number' || !Number.isSafeInteger(row.timestamp_ms)
    || row.timestamp_ms < 0 || !isVersion(row.width) || !isVersion(row.height) || !strings(row.quality_flags)) failed();
  return structuredClone(row) as unknown as CandidateFrame;
}
function mediaDto(value: unknown): CandidateMedia {
  const row = exact(value, ['id', 'candidate_id', 'source_asset_id', 'preview_asset_id', 'transcript_asset_id', 'original_transcript', 'languages', 'available_frames', 'selected_frame_asset_ids', 'processing_issues', 'row_version']);
  if (!isId(row.id) || !isId(row.candidate_id) || !isId(row.source_asset_id) || !isVersion(row.row_version)
    || !(row.preview_asset_id === null || isId(row.preview_asset_id)) || !(row.transcript_asset_id === null || isId(row.transcript_asset_id))
    || !isNullableText(row.original_transcript) || !strings(row.languages) || !Array.isArray(row.available_frames)
    || row.available_frames.length > 100 || !strings(row.selected_frame_asset_ids) || row.selected_frame_asset_ids.length > 3
    || !strings(row.processing_issues) || row.processing_issues.length > 5 || new Set(row.processing_issues).size !== row.processing_issues.length
    || row.processing_issues.some(code => !['NO_AUDIO','TRANSCRIPTION_FAILED','EXTRACTION_FAILED','INSUFFICIENT_FRAMES','FRAME_SELECTION_UNAVAILABLE'].includes(code))) failed();
  const frames = (row.available_frames as unknown[]).map(frame => frameDto(frame, row.source_asset_id as string));
  const selected = row.selected_frame_asset_ids as string[];
  if (new Set(frames.map(frame => frame.asset_id)).size !== frames.length || new Set(selected).size !== selected.length || selected.some(id => !frames.some(frame => frame.asset_id === id))) failed();
  return structuredClone({ ...row, available_frames: frames }) as unknown as CandidateMedia;
}
function poolDto(value: unknown): WorkspaceCandidate {
  const row = exact(value, ['id', 'workspace_id', 'candidate_id', 'selected_candidate_media_id', 'selected_frame_asset_ids', 'availability', 'fresh_material_required', 'media_confirmed', 'internal_notes', 'row_version']);
  if (!isId(row.id) || !isId(row.workspace_id) || !isId(row.candidate_id) || !isVersion(row.row_version)
    || !(row.selected_candidate_media_id === null || isId(row.selected_candidate_media_id)) || !strings(row.selected_frame_asset_ids)
    || row.selected_frame_asset_ids.length > 3 || new Set(row.selected_frame_asset_ids).size !== row.selected_frame_asset_ids.length
    || row.selected_candidate_media_id === null && row.selected_frame_asset_ids.length > 0
    || !isNullableText(row.availability) || !isNullableText(row.internal_notes)
    || typeof row.fresh_material_required !== 'boolean' || typeof row.media_confirmed !== 'boolean') failed();
  return structuredClone(row) as unknown as WorkspaceCandidate;
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
        const result = pageDto(value, input.limit ?? 25, candidateDto);
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
    async getCandidateMedia(actor: Actor, candidateId: string) {
      return rpc(actor, 'eps_get_candidate_media', { p_candidate_id: identifier(candidateId) }, value => {
        if (!Array.isArray(value)) failed(); const result = (value as unknown[]).map(mediaDto);
        if (result.some(row => row.candidate_id !== candidateId) || new Set(result.map(row => row.id)).size !== result.length) failed(); return result;
      });
    },
    async updateCandidateFrames(actor: Actor, mediaId: string, input: FrameSelection, context?: MutationContext) {
      return mutate(actor, 'update_candidate_frames', { p_candidate_media_id: identifier(mediaId) }, parseFrameSelection(input), mediaDto, context);
    },
    async findCandidateDuplicates(actor: Actor, candidateId: string) {
      return rpc(actor, 'eps_find_candidate_duplicates', { p_candidate_id: identifier(candidateId) }, value => {
        if (!Array.isArray(value)) failed(); return (value as unknown[]).map(item => {
          const row = exact(item, ['candidate_id', 'display_name', 'match_reasons']);
          if (!isId(row.candidate_id) || row.candidate_id === candidateId || !isNullableText(row.display_name) || !strings(row.match_reasons)) failed();
          return structuredClone(row) as unknown as DuplicateMatch;
        });
      });
    },
    async resolveCandidateDuplicate(actor: Actor, candidateId: string, input: DuplicateResolution, context?: MutationContext) {
      return mutate(actor, 'resolve_candidate_duplicate', { p_candidate_id: identifier(candidateId) }, parseDuplicateResolution(input), candidateDto, context);
    },
    async listWorkspaceCandidates(actor: Actor, workspaceId: string, options: { cursor?: string; limit?: number } = {}) {
      if (!options || typeof options !== 'object' || Object.keys(options).some(key => !['cursor', 'limit'].includes(key)) || options.cursor !== undefined && !isId(options.cursor)
        || options.limit !== undefined && (!isVersion(options.limit) || options.limit > 100)) invalid();
      return rpc(actor, 'eps_list_workspace_candidates', { p_workspace_id: identifier(workspaceId), p_cursor: options.cursor ?? null, p_limit: options.limit ?? 25 }, value => {
        const result = pageDto(value, options.limit ?? 25, poolDto); if (result.data.some(row => row.workspace_id !== workspaceId)) failed(); return result;
      });
    },
    async addWorkspaceCandidate(actor: Actor, workspaceId: string, input: WorkspaceCandidateCreate, context?: MutationContext) {
      return mutate(actor, 'add_workspace_candidate', { p_workspace_id: identifier(workspaceId) }, parseWorkspaceCandidateCreate(input), value => { const row = poolDto(value); if (row.workspace_id !== workspaceId || row.candidate_id !== input.candidate_id) failed(); return row; }, context);
    },
    async updateWorkspaceCandidate(actor: Actor, poolId: string, input: WorkspaceCandidatePatch, context?: MutationContext) {
      return mutate(actor, 'update_workspace_candidate', { p_workspace_candidate_id: identifier(poolId) }, parseWorkspaceCandidatePatch(input), poolDto, context);
    },
    async removeWorkspaceCandidate(actor: Actor, poolId: string, input: CandidateVersionInput, context?: MutationContext) {
      return mutate(actor, 'remove_workspace_candidate', { p_workspace_candidate_id: identifier(poolId) }, versionInput(input), successDto, context);
    },
  };
}
export type CentralCandidates = Awaited<ReturnType<typeof createCentralCandidates>>;
