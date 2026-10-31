import { createMcpHandler, type AuthInfo } from '@modelcontextprotocol/server';
import { DomainError, type Actor } from '@eps/domain';
import { createStudioMcpServer, requireLocalMcpRequest, type McpServices, type McpToolCompleted } from './mcp.ts';
import { createMcpResourceGate, loadMcpAuthorizationMetadata, mcpMetadataResponse, verifiedMcpIdentity,
  observeMcpAuthorizationStage, mcpAuthorizationErrorCode, type McpAuthorizationTraceOptions, type McpIdentity, type McpSessionCheck } from './mcp-auth.ts';
import type { McpAuthConfig } from './mcp-auth-config.ts';
import { failure, NO_STORE } from './http.ts';

interface Runtime { adapterMode: string; environment: string; baseUrl: string }
export interface McpHttpDependencies {
  config: McpAuthConfig;
  runtime: Runtime;
  fetch?: typeof fetch;
  checkSession?: McpSessionCheck;
  authorizationTrace?: McpAuthorizationTraceOptions;
  localContext(request: Request): Promise<{ actor: Actor; services: McpServices }>;
  oauthContext(request: Request, identity: McpIdentity): Promise<McpServices>;
  onToolCompleted?(identity: McpIdentity, event: McpToolCompleted): void | Promise<void>;
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
export interface McpProjectReadReceipt { event: 'eps.mcp.project_read_succeeded'; entry_point: 'mcp_http';
  operation: 'get_project' | 'list_projects'; success: true; request_id: string; principal_id: string; client_id: string; project_ids: string[] }
/** Project only bounded UUIDs from a completed, contract-validated project read. */
export function mcpProjectReadReceipt(identity: Pick<McpIdentity, 'principalId' | 'clientId'>, event: McpToolCompleted): McpProjectReadReceipt | null {
  if (!['get_project', 'list_projects'].includes(event.operation) || typeof identity.principalId !== 'string' || !UUID.test(identity.principalId)
    || typeof identity.clientId !== 'string' || !UUID.test(identity.clientId)
    || typeof event.result.request_id !== 'string' || !UUID.test(event.result.request_id)) return null;
  const rows = event.operation === 'list_projects' ? event.result.data : [event.result.data];
  if (!Array.isArray(rows)) return null;
  const ids: string[] = [];
  for (const row of rows.slice(0, 100)) {
    if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string' || !UUID.test(row.id)) return null;
    ids.push(row.id);
  }
  return { event: 'eps.mcp.project_read_succeeded', entry_point: 'mcp_http', operation: event.operation as 'get_project' | 'list_projects',
    success: true, request_id: event.result.request_id, principal_id: identity.principalId, client_id: identity.clientId, project_ids: [...new Set(ids)] };
}
function privateResponse(response: Response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(NO_STORE)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Keep an SSE exchange alive until consumed/cancelled; release per-request SDK resources afterward. */
async function closeWithBody(response: Response, close: () => Promise<void>): Promise<Response> {
  if (!response.body) { await close(); return response; }
  const reader = response.body.getReader();
  let closed = false;
  const finish = async () => { if (!closed) { closed = true; await close(); } };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) { controller.close(); await finish(); }
        else controller.enqueue(result.value);
      } catch (error) { controller.error(error); await finish(); }
    },
    async cancel(reason) { try { await reader.cancel(reason); } finally { await finish(); } },
  });
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

/** One fresh actor/service/server composition per HTTP exchange, on either supported protocol era. */
export function createMcpHttpHandler(dependencies: McpHttpDependencies) {
  const gate = dependencies.config.mode === 'oauth' ? createMcpResourceGate(dependencies.config, dependencies) : undefined;
  return async (request: Request): Promise<Response> => {
    const observeBusinessFailure = (error: unknown) => {
      if (dependencies.config.mode !== 'oauth') return;
      const status = error instanceof DomainError ? error.status : 503;
      observeMcpAuthorizationStage(dependencies.authorizationTrace, { stage: 'business_context', result: status === 401 || status === 403 ? 'denied' : 'unavailable',
        status, reason: 'business_context_unavailable', code: mcpAuthorizationErrorCode(error) });
    };
    try {
      let actor: Actor;
      let services: McpServices;
      let authInfo: AuthInfo | undefined;
      let allowedCapabilities: readonly string[] | undefined;
      let onToolCompleted: ((event: McpToolCompleted) => void | Promise<void>) | undefined;
      if (dependencies.config.mode === 'disabled') throw new DomainError('MCP_AUTH_CONFIGURATION_REQUIRED', 'Studio MCP access is not configured in this environment.', 503);
      if (dependencies.config.mode === 'local') {
        requireLocalMcpRequest(request, dependencies.runtime);
        ({ actor, services } = await dependencies.localContext(request));
      } else {
        const result = await gate!(request);
        if (result instanceof Response) return privateResponse(result);
        authInfo = result;
        const identity = verifiedMcpIdentity(result);
        actor = { principal_id: identity.principalId };
        allowedCapabilities = identity.capabilities;
        try { services = await dependencies.oauthContext(request, identity); }
        catch (error) { observeBusinessFailure(error); throw error; }
        if (dependencies.onToolCompleted) onToolCompleted = event => dependencies.onToolCompleted!(identity, event);
      }
      // Every composition must be bound to this same central principal before even protocol discovery.
      let current;
      try { current = await services.studio.getCapabilities(actor); }
      catch (error) { observeBusinessFailure(error); throw error; }
      if (current.principal_id !== actor.principal_id) {
        if (dependencies.config.mode === 'oauth') observeMcpAuthorizationStage(dependencies.authorizationTrace, { stage: 'business_context', result: 'denied',
          status: 403, reason: 'business_principal_mismatch', code: 'ACCESS_DENIED' });
        throw new DomainError('ACCESS_DENIED', 'The business session does not match this delegated identity.', 403);
      }
      if (dependencies.config.mode === 'oauth') {
        observeMcpAuthorizationStage(dependencies.authorizationTrace, { stage: 'business_context', result: 'accepted', status: null });
        observeMcpAuthorizationStage(dependencies.authorizationTrace, { stage: 'authorized', result: 'accepted', status: null });
      }
      const handler = createMcpHandler(context => {
        if (authInfo && context.authInfo !== authInfo) throw new DomainError('AUTH_REQUIRED', 'The request delegation was not preserved.', 401);
        return createStudioMcpServer(actor, services, { ...(allowedCapabilities ? { allowedCapabilities } : {}),
          ...(onToolCompleted ? { onToolCompleted } : {}) });
      }, { legacy: 'stateless', responseMode: 'auto', maxRequestBodySize: 96 * 1024,
        onerror: () => { /* Generic transport logs must not serialize private errors or credentials. */ } });
      try { return privateResponse(await closeWithBody(await handler.fetch(request, authInfo ? { authInfo } : undefined), () => handler.close())); }
      catch (error) { await handler.close(); throw error; }
    } catch (error) { return failure(error); }
  };
}

/** Discovery is public and does not construct a user/business client. */
export async function handleMcpMetadata(request: Request, dependencies: { config: McpAuthConfig; fetch?: typeof fetch }): Promise<Response> {
  try {
    if (dependencies.config.mode !== 'oauth') return Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
    const metadata = await loadMcpAuthorizationMetadata(dependencies.config, dependencies);
    return mcpMetadataResponse(request, dependencies.config, metadata) ?? Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  } catch (error) { return failure(error); }
}
