import { createRemoteJWKSet, customFetch, errors, jwtVerify, type JWTPayload } from 'jose';
import { bearerAuthChallengeResponse, getOAuthProtectedResourceMetadataUrl, oauthMetadataResponse, OAuthError, OAuthErrorCode, requireBearerAuth,
  type AuthInfo, type OAuthMetadata } from '@modelcontextprotocol/server';
import { DomainError } from '@eps/domain';
import type { McpOAuthConfig } from './mcp-auth-config.ts';
import { MCP_ATOMIC_CAPABILITIES, mcpCapabilityAllowed } from './mcp-capabilities.ts';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache', Expires: '0', 'X-Content-Type-Options': 'nosniff' };
export interface McpIdentity {
  readonly principalId: string;
  readonly sessionId: string;
  readonly clientId: string;
  readonly capabilities: readonly string[];
}
export interface McpSessionCheckInput {
  /** Secret, request-local input for a narrow user-scoped validation operation; never log it. */
  readonly accessToken: string;
  readonly principalId: string;
  readonly sessionId: string;
  readonly clientId: string;
  readonly resourceUrl: string;
}
export interface McpSessionState {
  readonly active: boolean;
  readonly principalId: string | null;
  readonly sessionId: string | null;
  readonly clientId: string | null;
  readonly capabilities: readonly string[];
}
/** Must check the actual session/client, not merely JWT/getUser validity. */
export type McpSessionCheck = (input: McpSessionCheckInput) => Promise<McpSessionState>;
export interface McpAuthorizationStageTrace {
  event: 'eps.mcp.authorization_stage'; trace_id: string;
  stage: 'boundary' | 'bearer' | 'jwt' | 'delegation' | 'session' | 'business_context' | 'authorized';
  result: 'accepted' | 'denied' | 'unavailable'; status: number | null;
  reason?: 'origin_mismatch' | 'credentials_in_query' | 'missing_bearer' | 'malformed_bearer' | 'jwt_expired' | 'jwt_claim_invalid'
    | 'jwt_invalid' | 'signature_invalid' | 'key_not_found' | 'algorithm_unsupported' | 'key_service_unavailable' | 'delegation_invalid'
    | 'session_validator_missing' | 'session_check_unavailable' | 'session_inactive' | 'session_identity_mismatch' | 'session_capabilities_invalid'
    | 'required_scope_missing' | 'sdk_rejected' | 'business_context_unavailable' | 'business_principal_mismatch' | 'configuration_unavailable';
  code?: 'ERR_JWT_EXPIRED' | 'ERR_JWT_CLAIM_VALIDATION_FAILED' | 'ERR_JWT_INVALID' | 'ERR_JWS_INVALID'
    | 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' | 'ERR_JWKS_NO_MATCHING_KEY' | 'ERR_JOSE_NOT_SUPPORTED'
    | 'MCP_SESSION_VALIDATION_UNAVAILABLE' | 'ACCESS_DENIED' | 'AUTH_REQUIRED' | 'CAPABILITY_REQUIRED' | 'MCP_AUTH_CONFIGURATION_REQUIRED';
}
export interface McpAuthorizationTraceOptions { traceId: string; log(value: McpAuthorizationStageTrace): void }
type StageObservation = Omit<McpAuthorizationStageTrace, 'event' | 'trace_id'>;
/** The caller supplies fixed enums only; no request, identity or provider payload enters this projection. */
export function observeMcpAuthorizationStage(options: McpAuthorizationTraceOptions | undefined, value: StageObservation): void {
  if (!options || !UUID.test(options.traceId)) return;
  try {
    options.log({ event: 'eps.mcp.authorization_stage', trace_id: options.traceId, stage: value.stage, result: value.result,
      status: typeof value.status === 'number' && Number.isInteger(value.status) && value.status >= 100 && value.status <= 599 ? value.status : null,
      ...(value.reason ? { reason: value.reason } : {}), ...(value.code ? { code: value.code } : {}) });
  } catch { /* Observation cannot change authorization or expose the thrown error. */ }
}
export function mcpAuthorizationErrorCode(error: unknown): McpAuthorizationStageTrace['code'] {
  if (error instanceof DomainError) {
    switch (error.code) {
      case 'MCP_SESSION_VALIDATION_UNAVAILABLE': case 'ACCESS_DENIED': case 'AUTH_REQUIRED': case 'CAPABILITY_REQUIRED': case 'MCP_AUTH_CONFIGURATION_REQUIRED': return error.code;
    }
  }
}
interface ResourceDependencies { fetch?: typeof fetch; checkSession?: McpSessionCheck; authorizationTrace?: McpAuthorizationTraceOptions }
const identities = new WeakMap<AuthInfo, McpIdentity>();
const validatedMetadata = new WeakSet<OAuthMetadata>();
function invalidToken(): never { throw new OAuthError(OAuthErrorCode.InvalidToken, 'The access token is not valid for this Studio resource.'); }
function unavailable(): never { throw new OAuthError(OAuthErrorCode.ServerError, 'Studio authorization is temporarily unavailable.'); }
function metadataUnavailable(): never {
  throw new DomainError('MCP_AUTH_METADATA_UNAVAILABLE', 'The configured authorization server has not supplied valid Studio discovery metadata.', 503, {}, true);
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function capabilities(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 64 && value.every(item => typeof item === 'string' && MCP_ATOMIC_CAPABILITIES.has(item)) && new Set(value).size === value.length;
}
function privateResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status === 500 ? 503 : response.status, statusText: response.statusText, headers });
}
function rejected(status: number, code: string, message: string): Response {
  return Response.json({ error: code, error_description: message }, { status, headers: PRIVATE_HEADERS });
}
function boundary(request: Request, config: McpOAuthConfig): Response | undefined {
  const resource = new URL(config.resourceUrl);
  if (request.headers.get('host') !== resource.host || request.headers.has('origin') && request.headers.get('origin') !== resource.origin) {
    return rejected(403, 'access_denied', 'Use the configured Studio resource origin.');
  }
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some(key => ['access_token', 'token', 'authorization'].includes(key.toLowerCase()))) {
    return rejected(400, 'invalid_request', 'Send credentials only in the Authorization header.');
  }
}
/** Bounded requests to fixed configuration-derived public endpoints, never token/header-selected URLs. */
async function publicJson(url: string, fetcher: typeof fetch, suppliedSignal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(5000);
  const response = await fetcher(url, { method: 'GET', redirect: 'error', cache: 'no-store',
    signal: suppliedSignal ? AbortSignal.any([timeout, suppliedSignal]) : timeout, headers: { Accept: 'application/json' } });
  if (response.status !== 200 || response.redirected || response.url && response.url !== url
    || !response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('Public authorization metadata is unavailable.');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Public authorization metadata is unavailable.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > 64 * 1024) { await reader.cancel(); throw new Error('Public authorization metadata exceeds its limit.'); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': 'application/json' } });
}

/** Fetch only the known Supabase discovery location and project only validated endpoints/features. */
export async function loadMcpAuthorizationMetadata(config: McpOAuthConfig, dependencies: Pick<ResourceDependencies, 'fetch'> = {}): Promise<OAuthMetadata> {
  try {
    const value: unknown = await (await publicJson(config.discoveryUrl, dependencies.fetch ?? fetch)).json();
    if (!record(value) || value.issuer !== config.issuer || value.authorization_endpoint !== config.authorizationEndpoint
      || value.token_endpoint !== config.tokenEndpoint || value.jwks_uri !== config.jwksUrl
      || !Array.isArray(value.response_types_supported) || !value.response_types_supported.includes('code')
      || !Array.isArray(value.code_challenge_methods_supported) || !value.code_challenge_methods_supported.includes('S256')
      || !Array.isArray(value.scopes_supported) || !value.scopes_supported.includes('openid')) return metadataUnavailable();
    // Registration is deliberately not advertised until that actual provider path and policy are reviewed.
    const metadata: OAuthMetadata = { issuer: config.issuer, authorization_endpoint: config.authorizationEndpoint, token_endpoint: config.tokenEndpoint,
      jwks_uri: config.jwksUrl, response_types_supported: ['code'], code_challenge_methods_supported: ['S256'],
      scopes_supported: config.scopesSupported.slice(),
      ...(Array.isArray(value.grant_types_supported) ? { grant_types_supported: ['authorization_code', 'refresh_token'].filter(grant => (value.grant_types_supported as unknown[]).includes(grant)) } : {}),
      ...(Array.isArray(value.token_endpoint_auth_methods_supported) ? { token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'].filter(method => (value.token_endpoint_auth_methods_supported as unknown[]).includes(method)) } : {}) };
    validatedMetadata.add(metadata);
    return metadata;
  } catch { return metadataUnavailable(); }
}

/** Public metadata only. The supplied AS metadata must come from loadMcpAuthorizationMetadata. */
export function mcpMetadataResponse(request: Request, config: McpOAuthConfig, metadata: OAuthMetadata): Response | undefined {
  const path = new URL(request.url).pathname;
  const metadataPath = new URL(getOAuthProtectedResourceMetadataUrl(new URL(config.resourceUrl))).pathname;
  if (![metadataPath, '/.well-known/oauth-authorization-server'].includes(path)) return undefined;
  const denied = boundary(request, config); if (denied) return denied;
  if (!validatedMetadata.has(metadata) || metadata.issuer !== config.issuer || metadata.authorization_endpoint !== config.authorizationEndpoint
    || metadata.token_endpoint !== config.tokenEndpoint || metadata.jwks_uri !== config.jwksUrl) return rejected(503, 'server_error', 'Studio discovery metadata is unavailable.');
  const response = oauthMetadataResponse(request, { oauthMetadata: metadata, resourceServerUrl: new URL(config.resourceUrl),
    scopesSupported: [...config.scopesSupported], resourceName: 'Everyone Presentation Studio' });
  return response ? privateResponse(response) : undefined;
}

function delegation(payload: JWTPayload, config: McpOAuthConfig) {
  const value = payload.eps_delegation;
  if (payload.iss !== config.issuer || payload.aud !== config.resourceUrl || typeof payload.sub !== 'string' || !UUID.test(payload.sub)
    || payload.role !== 'authenticated' || payload.is_anonymous !== false || typeof payload.client_id !== 'string'
    || !config.approvedClientIds.includes(payload.client_id) || typeof payload.session_id !== 'string' || !UUID.test(payload.session_id)
    || !Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat) || payload.iat! > Date.now() / 1000 || payload.exp! <= payload.iat! || !record(value)
    || Object.keys(value).sort().join(',') !== 'capabilities,client_id,resource,v' || value.v !== 1
    || value.resource !== config.resourceUrl || value.client_id !== payload.client_id || !capabilities(value.capabilities)) return invalidToken();
  if (typeof payload.scope !== 'string' || payload.scope.length > 256 || !/^[a-zA-Z0-9:._-]+(?: [a-zA-Z0-9:._-]+)*$/u.test(payload.scope)) return invalidToken();
  return { principalId: payload.sub, sessionId: payload.session_id, clientId: payload.client_id,
    delegatedCapabilities: value.capabilities, scopes: payload.scope.split(' ') };
}

/** This resource-server adapter never turns an ordinary upstream/browser token into delegation. */
export function createMcpResourceGate(config: McpOAuthConfig, dependencies: ResourceDependencies = {}) {
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl), { timeoutDuration: 5000, cacheMaxAge: 5 * 60_000,
    [customFetch]: (url, options) => {
      if (url !== config.jwksUrl) throw new Error('Unapproved key destination.');
      return publicJson(config.jwksUrl, dependencies.fetch ?? fetch, options.signal);
    } });
  return async (request: Request): Promise<AuthInfo | Response> => {
    const observe = (value: StageObservation) => observeMcpAuthorizationStage(dependencies.authorizationTrace, value);
    const denied = boundary(request, config);
    if (denied) { observe({ stage: 'boundary', result: 'denied', status: denied.status,
      reason: denied.status === 403 ? 'origin_mismatch' : 'credentials_in_query' }); return denied; }
    observe({ stage: 'boundary', result: 'accepted', status: null });
    const authorization = request.headers.get('authorization');
    // SDK parsing is intentionally general. This app rejects duplicate/combined/header-smuggling forms first.
    if (authorization && (!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/iu.test(authorization) || authorization.length > 16_384)) {
      const response = privateResponse(bearerAuthChallengeResponse(new OAuthError(OAuthErrorCode.InvalidToken, 'Use one resource-specific bearer credential.'), {
        requiredScopes: [...config.scopesSupported], resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(config.resourceUrl)) }));
      observe({ stage: 'bearer', result: 'denied', status: response.status, reason: 'malformed_bearer' }); return response;
    }
    if (authorization) observe({ stage: 'bearer', result: 'accepted', status: null });
    // This closure is request-local even when callers reuse the gate and its cached JWKS concurrently.
    let verifierSucceeded = false;
    let requiredScopesPresent = false;
    const gate = requireBearerAuth({ expectedResource: new URL(config.resourceUrl), requiredScopes: [...config.scopesSupported],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(config.resourceUrl)), verifier: {
      async verifyAccessToken(token): Promise<AuthInfo> {
        let payload: JWTPayload;
        try {
          ({ payload } = await jwtVerify(token, jwks, { algorithms: ['ES256', 'RS256'], issuer: config.issuer,
            audience: config.resourceUrl, requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat', 'client_id', 'session_id'] }));
        } catch (error) {
          const rejectedJwt = (reason: McpAuthorizationStageTrace['reason'], code: McpAuthorizationStageTrace['code']) => {
            observe({ stage: 'jwt', result: 'denied', status: 401, reason, code }); return invalidToken();
          };
          if (error instanceof errors.JWTExpired) return rejectedJwt('jwt_expired', 'ERR_JWT_EXPIRED');
          if (error instanceof errors.JWTClaimValidationFailed) return rejectedJwt('jwt_claim_invalid', 'ERR_JWT_CLAIM_VALIDATION_FAILED');
          if (error instanceof errors.JWTInvalid) return rejectedJwt('jwt_invalid', 'ERR_JWT_INVALID');
          if (error instanceof errors.JWSInvalid) return rejectedJwt('jwt_invalid', 'ERR_JWS_INVALID');
          if (error instanceof errors.JWSSignatureVerificationFailed) return rejectedJwt('signature_invalid', 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED');
          if (error instanceof errors.JWKSNoMatchingKey) return rejectedJwt('key_not_found', 'ERR_JWKS_NO_MATCHING_KEY');
          if (error instanceof errors.JOSENotSupported) return rejectedJwt('algorithm_unsupported', 'ERR_JOSE_NOT_SUPPORTED');
          observe({ stage: 'jwt', result: 'unavailable', status: 503, reason: 'key_service_unavailable' });
          return unavailable();
        }
        observe({ stage: 'jwt', result: 'accepted', status: null });
        let identity: ReturnType<typeof delegation>;
        try { identity = delegation(payload, config); }
        catch (error) { observe({ stage: 'delegation', result: 'denied', status: 401, reason: 'delegation_invalid' }); throw error; }
        observe({ stage: 'delegation', result: 'accepted', status: null });
        if (!dependencies.checkSession) { observe({ stage: 'session', result: 'unavailable', status: 503, reason: 'session_validator_missing' }); return unavailable(); }
        let state: McpSessionState;
        try { state = await dependencies.checkSession({ accessToken: token, principalId: identity.principalId,
          sessionId: identity.sessionId, clientId: identity.clientId, resourceUrl: config.resourceUrl }); }
        catch (error) { observe({ stage: 'session', result: 'unavailable', status: 503, reason: 'session_check_unavailable', code: mcpAuthorizationErrorCode(error) }); return unavailable(); }
        if (!state || state.active !== true || state.principalId !== identity.principalId || state.sessionId !== identity.sessionId
          || state.clientId !== identity.clientId) {
          observe({ stage: 'session', result: 'denied', status: 401, reason: !state || state.active !== true ? 'session_inactive' : 'session_identity_mismatch' }); return invalidToken();
        }
        if (!capabilities(state.capabilities)) { observe({ stage: 'session', result: 'unavailable', status: 503, reason: 'session_capabilities_invalid' }); return unavailable(); }
        observe({ stage: 'session', result: 'accepted', status: null });
        const effective = identity.delegatedCapabilities.filter(capability => state.capabilities.includes(capability));
        verifierSucceeded = true;
        requiredScopesPresent = config.scopesSupported.every(scope => identity.scopes.includes(scope));
        return { token, clientId: identity.clientId, scopes: identity.scopes, expiresAt: payload.exp, resource: new URL(config.resourceUrl),
          extra: { principalId: identity.principalId, sessionId: identity.sessionId, clientId: identity.clientId, capabilities: Object.freeze(effective) } };
      }
    } });
    const result = await gate(request);
    if (result instanceof Response) {
      const response = privateResponse(result);
      if (!authorization || verifierSucceeded) observe({ stage: 'bearer', result: response.status === 503 ? 'unavailable' : 'denied', status: response.status,
        reason: !authorization ? 'missing_bearer' : !requiredScopesPresent ? 'required_scope_missing' : 'sdk_rejected' });
      return response;
    }
    const extra = result.extra!;
    identities.set(result, Object.freeze({ principalId: extra.principalId as string, sessionId: extra.sessionId as string,
      clientId: result.clientId, capabilities: extra.capabilities as readonly string[] }));
    return result;
  };
}

/** Only the gate's verified request object is accepted; copying caller JSON cannot forge identity. */
export function verifiedMcpIdentity(authInfo: AuthInfo): McpIdentity {
  const identity = identities.get(authInfo);
  if (!identity) throw new DomainError('AUTH_REQUIRED', 'A verified Studio delegation is required.', 401);
  return identity;
}
export function requireMcpCapability(authInfo: AuthInfo, capability: string): void {
  if (!mcpCapabilityAllowed(capability, new Set(verifiedMcpIdentity(authInfo).capabilities))) {
    throw new DomainError('CAPABILITY_REQUIRED', 'This delegation does not permit that operation.', 403, { capability });
  }
}
