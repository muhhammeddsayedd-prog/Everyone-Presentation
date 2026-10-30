import { randomUUID } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { Server, type CallToolResult, type Tool } from '@modelcontextprotocol/server';
import { DomainError, type Actor, type WorkspaceCreate, type WorkspacePatch, type ProjectPatch,
  type UploadSessionCreate, type CompleteUpload, type AudiencePresetCreate, type AudiencePresetPatch } from '@eps/domain';
import type { createCentralStudio } from '@eps/central';
import catalog from '../../../contracts/mcp-tool-catalog.json';
import { handleSpecsRequest, isManualSpecsRoute, type SpecsOperations } from './specs-http';
import { handleJobRequest, type JobOperations } from './job-http';
import { handleCandidatesRequest, isCandidatesRoute, type CandidatesOperations } from './candidates-http';
import { handleCastingRequest, isCastingRoute } from './casting-http';
import { handleReviewRequest, isReviewRoute } from './review-http';
import type { CastingOperations } from '@eps/domain';
import type { ReviewOperations } from '@eps/domain';
import type { PresentationOperations } from '@eps/domain';
import { handlePresentationRequest, isPresentationRoute } from './presentation-http';
import { handleReviewLinkRequest, isReviewLinkRoute } from './guest-http';
import type { ReviewLinkOperations } from '@eps/domain';
import { handleMediaPlaybackRequest, isMediaPlaybackRoute } from './media-http';
import { failure, json, NO_STORE } from './http';
import { validateMcpSuccess } from './mcp-output-validation';
import { mcpCapabilityAllowed } from './mcp-capabilities';
import { handleSettingsRequest, isSettingsRoute } from './settings-http';
import type { SettingsOperations } from '@eps/domain';

const IMPLEMENTED = new Set(['get_capabilities','list_projects','get_project','update_project','list_workspaces','create_workspace',
  'get_workspace','update_workspace','get_specs','submit_specs','update_specs','list_roles','create_role','update_role',
  'archive_role','list_slots','resize_role_slots','update_slot','reorder_workspace','create_upload_session','get_upload_session',
  'complete_upload','cancel_upload','get_media','play_media','list_audience_presets','create_audience_preset','update_audience_preset',
  'archive_audience_preset','list_jobs','get_job','retry_job','cancel_job',
  'search_candidates','create_candidate','get_candidate','update_candidate','confirm_candidate_reviewed','archive_candidate',
  'get_candidate_media','update_candidate_frames','list_duplicate_matches','resolve_duplicate','suggest_candidate_filters','extract_candidate_frames',
  'list_candidate_support','archive_candidate_support',
  'list_workspace_candidates','add_workspace_candidate','update_workspace_candidate','remove_workspace_candidate']);
const CASTING_TOOLS = new Set(['list_assignments','create_assignment','update_assignment','set_slot_main','undo_slot_main','remove_assignment']);
const REVIEW_TOOLS = new Set(['list_presentation_series','create_presentation_series','get_presentation_series','update_presentation_series','get_workspace_review','create_ai_suggestion','get_ai_suggestion','request_workspace_review_fit','get_casting_retirement','undo_casting_retirement']);
const PRESENTATION_TOOLS = new Set(['list_versions', 'generate_version', 'get_version', 'download_version_pdf', 'play_version_media']);
const SHARING_TOOLS = new Set(['list_review_links', 'create_review_link', 'update_review_link', 'revoke_review_link', 'rotate_review_link', 'list_feedback', 'create_comment', 'update_comment', 'set_preference', 'prepare_pdf_export', 'get_pdf_export', 'download_pdf_export']);
const SETTINGS_TOOLS = new Set(['get_settings', 'update_settings']);
const entries = catalog.tools.filter(tool => IMPLEMENTED.has(tool.name) || CASTING_TOOLS.has(tool.name) || REVIEW_TOOLS.has(tool.name) || PRESENTATION_TOOLS.has(tool.name) || SHARING_TOOLS.has(tool.name) || SETTINGS_TOOLS.has(tool.name));
const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
const checks = new Map(entries.map(tool => [tool.name, ajv.compile(tool.inputSchema)]));
export interface McpServices { studio: Awaited<ReturnType<typeof createCentralStudio>>; specs: SpecsOperations; jobs: JobOperations; candidates: CandidatesOperations; casting?: CastingOperations; review?: ReviewOperations; presentation?: PresentationOperations; sharing?: ReviewLinkOperations; settings?: SettingsOperations }
export interface McpAuthority { allowedCapabilities?: readonly string[] }
export function implementedMcpTools(castingEnabled = false, reviewEnabled = false, presentationEnabled = false, sharingEnabled = false, settingsEnabled = false): Tool[] {
  return entries.filter(tool => (castingEnabled || !CASTING_TOOLS.has(tool.name)) && (reviewEnabled || !REVIEW_TOOLS.has(tool.name)) && (presentationEnabled || !PRESENTATION_TOOLS.has(tool.name)) && (sharingEnabled || !SHARING_TOOLS.has(tool.name)) && (settingsEnabled || !SETTINGS_TOOLS.has(tool.name))).map(({ name, description, inputSchema, outputSchema, annotations }) =>
    // JSON-import inference widens literal schema values. The checked-in catalog
    // is validated by AJV here and by the official SDK in protocol tests.
    ({ name, description, inputSchema, outputSchema, annotations }) as unknown as Tool);
}

/** Local development transport only. Browser sessions are not an OAuth authorization
 * server. Hosting/remote MCP stay disabled until M07 verifies resource audiences. */
export function requireLocalMcpRequest(request: Request, config: { adapterMode: string; environment: string; baseUrl: string }) {
  const url = new URL(config.baseUrl);
  if (config.adapterMode !== 'supabase' || !['development','test'].includes(config.environment)
    || url.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname)) {
    throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Remote MCP authorization is pending its release milestone.', 503);
  }
  if (request.headers.get('host') !== url.host || request.headers.has('origin') && request.headers.get('origin') !== url.origin
    || !request.headers.has('origin') && !/^Bearer [^\s]{1,16384}$/iu.test(request.headers.get('authorization') ?? '')) {
    throw new DomainError('ACCESS_DENIED', 'Use the configured local MCP origin and an acting-user session.', 403);
  }
}

function operationRequest(name: string, supplied: unknown) {
  const entry = entries.find(tool => tool.name === name); const check = checks.get(name);
  if (!entry || !check || !check(supplied)) throw new DomainError('VALIDATION_FAILED', 'Tool input does not match an implemented operation.', 400);
  const input = supplied as Record<string, unknown>;
  let path = entry.http.path;
  const parameters = new Set<string>();
  path = path.replace(/\{([^}]+)\}/gu, (_whole, key: string) => {
    const value = input[key]; parameters.add(key);
    if (typeof value !== 'string' || value.length > 200 || /[\\/\p{C}?#%]/u.test(value) || ['.','..'].includes(value)) {
      throw new DomainError('INVALID_REQUEST', 'Provide a bounded resource identifier.', 400);
    }
    return encodeURIComponent(value);
  });
  const url = new URL(`http://127.0.0.1/api/v1${path}`);
  for (const [key,value] of Object.entries(input)) {
    if (!parameters.has(key) && !['body','idempotency_key'].includes(key) && value !== undefined) url.searchParams.set(key, String(value));
  }
  const headers = { 'Content-Type': 'application/json' };
  const request = new Request(url, { method: entry.http.method, headers,
    ...(Object.hasOwn(input,'body') ? { body: JSON.stringify(input.body) } : {}) });
  return { request, segments: path.split('/').filter(Boolean).map(decodeURIComponent), input };
}

/** The actor comes from the verified request, never from a tool argument. These are
 * the same Central/RPC and HTTP-mapping operations used by the signed-in UI. */
export async function invokeMcpTool(name: string, supplied: unknown, actor: Actor, services: McpServices,
  requestId: string = randomUUID()): Promise<CallToolResult> {
  let response: Response;
  try {
    const { request, segments: s, input } = operationRequest(name, supplied);
    const context = { requestId, clientType: 'mcp' as const, idempotencyKey: input.idempotency_key as string | undefined };
    if (isSettingsRoute(s) && services.settings) response = await handleSettingsRequest(request, s, actor, services.settings, context);
    else if (SETTINGS_TOOLS.has(name)) throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Central settings are not available in this server composition.', 503);
    else if (isReviewLinkRoute(s) && services.sharing) response = await handleReviewLinkRequest(request, s, actor, services.sharing, context);
    else if (SHARING_TOOLS.has(name)) throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Guest sharing is not available in this server composition.', 503);
    else if (isPresentationRoute(s) && services.presentation) response = await handlePresentationRequest(request, s, actor, services.presentation, context);
    else if (PRESENTATION_TOOLS.has(name)) throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Fixed presentations are not available in this server composition.', 503);
    else if (isReviewRoute(s) && services.review) response = await handleReviewRequest(request, s, actor, services.review, context);
    else if (REVIEW_TOOLS.has(name)) throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Presentation review is not available in this server composition.', 503);
    else if (isCastingRoute(s) && services.casting) response = await handleCastingRequest(request, s, actor, services.casting, context);
    else if (CASTING_TOOLS.has(name)) throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Casting assignments are not available in this server composition.', 503);
    else if (isManualSpecsRoute(s)) response = await handleSpecsRequest(request, s, actor, services.specs, context);
    else if (s[0] === 'jobs') response = await handleJobRequest(request, s, actor, services.jobs, context);
    else if (isCandidatesRoute(s)) response = await handleCandidatesRequest(request, s, actor, services.candidates, context);
    else if (isMediaPlaybackRoute(s)) response = await handleMediaPlaybackRequest(request, s, actor, services.studio, requestId);
    else {
      const studio = services.studio;
      const list = Object.fromEntries(new URL(request.url).searchParams);
      const options = { ...list, ...(list.limit ? { limit: Number(list.limit) } : {}) };
      const paged = (value: unknown) => Response.json({ request_id: requestId, ...(value as object) }, { headers: NO_STORE });
      switch (name) {
        case 'get_capabilities': response = json(await studio.getCapabilities(actor), requestId); break;
        case 'list_projects': response = paged(await studio.listProjects(actor, options)); break;
        case 'get_project': response = json(await studio.getProject(actor, s[1]), requestId); break;
        case 'update_project': response = json(await studio.updateProject(actor, s[1], input.body as ProjectPatch, context), requestId); break;
        case 'list_workspaces': response = paged(await studio.listWorkspaces(actor, options)); break;
        case 'create_workspace': response = json(await studio.createWorkspace(actor, input.body as WorkspaceCreate, context), requestId, 201); break;
        case 'get_workspace': response = json(await studio.getWorkspace(actor, s[1]), requestId); break;
        case 'update_workspace': response = json(await studio.updateWorkspace(actor, s[1], input.body as WorkspacePatch, context), requestId); break;
        case 'create_upload_session': response = json(await studio.createUploadSession(actor, input.body as UploadSessionCreate, context), requestId, 201); break;
        case 'get_upload_session': response = json(await studio.getUploadSession(actor, s[1]), requestId); break;
        case 'complete_upload': response = json(await studio.completeUpload(actor, s[1], input.body as CompleteUpload, context), requestId); break;
        case 'cancel_upload': response = json(await studio.cancelUpload(actor, s[1], context), requestId); break;
        case 'get_media': response = json(await studio.getMedia(actor, s[1]), requestId); break;
        case 'list_audience_presets': response = paged(await studio.listAudiencePresets(actor, options)); break;
        case 'create_audience_preset': response = json(await studio.createAudiencePreset(actor, input.body as AudiencePresetCreate, context), requestId, 201); break;
        case 'update_audience_preset': response = json(await studio.updateAudiencePreset(actor, s[1], input.body as AudiencePresetPatch, context), requestId); break;
        case 'archive_audience_preset': response = json(await studio.archiveAudiencePreset(actor, s[1], input.body as { row_version: number }, context), requestId); break;
        default: throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'This tool is pending its implementation milestone.', 503);
      }
    }
  } catch (error) { response = failure(error, requestId); }
  let structuredContent: Record<string, unknown>;
  try {
    structuredContent = await response.json() as Record<string, unknown>;
    if (response.ok) structuredContent = validateMcpSuccess(name, structuredContent);
  } catch (error) {
    response = failure(error instanceof DomainError ? error : new DomainError('OPERATION_RESPONSE_INVALID', 'The operation result did not match its published contract.', 503), requestId);
    structuredContent = await response.json() as Record<string, unknown>;
  }
  return { content: [{ type: 'text', text: response.ok ? `${name} completed.` : `${name} could not be completed. Read the structured error.` }],
    structuredContent, ...(response.ok ? {} : { isError: true }) };
}

export function createStudioMcpServer(actor: Actor, services: McpServices, authority: McpAuthority = {}) {
  const server = new Server({ name: 'everyone-presentation-studio', version: '0.1.0' }, { capabilities: { tools: {} } });
  async function currentCapabilities() {
    const current = await services.studio.getCapabilities(actor);
    if (current.principal_id !== actor.principal_id || !Array.isArray(current.capabilities) || current.capabilities.some(value => typeof value !== 'string')) {
      throw new DomainError('CENTRAL_RESPONSE_INVALID', 'The current account authority could not be verified.', 503);
    }
    return new Set(current.capabilities.filter(capability => authority.allowedCapabilities === undefined || authority.allowedCapabilities.includes(capability)));
  }
  server.setRequestHandler('tools/list', async () => {
    const permitted = await currentCapabilities();
    return { tools: implementedMcpTools(Boolean(services.casting), Boolean(services.review), Boolean(services.presentation), Boolean(services.sharing), Boolean(services.settings))
      .filter(tool => mcpCapabilityAllowed(entries.find(entry => entry.name === tool.name)!.capability, permitted)) };
  });
  server.setRequestHandler('tools/call', async request => {
    try {
      const entry = entries.find(tool => tool.name === request.params.name);
      if (entry && !mcpCapabilityAllowed(entry.capability, await currentCapabilities())) {
        throw new DomainError('CAPABILITY_REQUIRED', 'Your current delegation and business account do not permit this operation.', 403, { capability: entry.capability });
      }
    } catch (error) {
      const response = failure(error);
      return { content: [{ type: 'text', text: 'This operation could not be authorized. Read the structured error.' }],
        structuredContent: await response.json() as Record<string, unknown>, isError: true };
    }
    return invokeMcpTool(request.params.name, request.params.arguments ?? {}, actor, services);
  });
  return server;
}
