import { createHash } from 'node:crypto';
import { DomainError, type Actor, type MutationContext } from '@eps/domain';
import type { GuestAccess, GuestContent, GuestMutationContext, GuestReviewOperations, ReviewLinkOperations } from '../../../packages/domain/src/guest-types';
import { guestIdentifier, parseCommentCreate, parseCommentPatch, parseExportPrepare, parseGuestCommentCreate, parseGuestCommentPatch,
  parseGuestIdentity, parseGuestListOptions, parseGuestRowVersion, parsePreferenceSet, parseReviewLinkCreate, parseReviewLinkListOptions, parseReviewLinkPatch } from '../../../packages/domain/src/guest';
import { json, NO_STORE, readBoundedBody, readJson } from './http';

type Context = MutationContext & { requestId: string };
const PRIVATE_HEADERS = { ...NO_STORE, 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' };
function invalid(): never { throw new DomainError('INVALID_REQUEST', 'Use the supported scoped review request.', 400); }
function denied(): never { throw new DomainError('REVIEW_ACCESS_DENIED', 'This review session is invalid or unavailable.', 401); }
function requiredKey(context: Context): GuestMutationContext { if (!context.idempotencyKey || context.idempotencyKey.length < 16 || context.idempotencyKey.length > 200) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Provide an Idempotency-Key between 16 and 200 characters.', 400); return { ...context, idempotencyKey: context.idempotencyKey }; }
function optionalKey(context: Context): GuestMutationContext | undefined { return context.idempotencyKey === undefined ? undefined : requiredKey(context); }
function parameters(request: Request, names: string[]) {
  const params = new URL(request.url).searchParams; const value: Record<string, unknown> = {};
  for (const [key, entry] of params) {
    if (!names.includes(key) || params.getAll(key).length !== 1 || !entry) invalid();
    if (key === 'limit') { if (!/^[1-9][0-9]*$/u.test(entry)) invalid(); value[key] = Number(entry); } else value[key] = entry;
  }
  return value;
}
export function isReviewLinkRoute(s: string[]): boolean {
  return s[0] === 'review-links' && (s.length === 1 || s.length === 2 || s.length === 3 && ['revoke', 'rotate'].includes(s[2]))
    || s[0] === 'versions' && s.length === 3 && ['feedback', 'comments', 'preferences'].includes(s[2])
    || s[0] === 'comments' && s.length === 2
    || s[0] === 'pdf-exports' && (s.length === 1 || s.length === 2 || s.length === 3 && ['download', 'content'].includes(s[2]));
}
function binary(content: GuestContent): Response {
  return new Response(content.body, { status: content.status, headers: { ...PRIVATE_HEADERS, 'Content-Type': content.mimeType, 'Content-Length': String(content.size), 'Accept-Ranges': 'bytes',
    ...(content.contentRange ? { 'Content-Range': content.contentRange } : {}), ...(content.filename ? { 'Content-Disposition': `attachment; filename="${content.filename.replace(/[^A-Za-z0-9._-]/gu, '_')}"` } : {}) } });
}
export async function handleReviewLinkRequest(request: Request, s: string[], actor: Actor, service: ReviewLinkOperations, context: Context): Promise<Response> {
  if (!isReviewLinkRoute(s)) invalid(); s.forEach(guestIdentifier);
  const method = request.method;
  if (method === 'GET' && s[0] === 'review-links' && s.length === 1) return Response.json({ request_id: context.requestId, ...await service.listReviewLinks(actor, parseReviewLinkListOptions(parameters(request, ['workspace_id', 'cursor', 'limit']))) }, { headers: PRIVATE_HEADERS });
  if (method === 'GET' && s[0] === 'versions' && s[2] === 'feedback') return json(await service.listFeedback(actor, s[1], parseGuestListOptions(parameters(request, ['cursor', 'limit']))), context.requestId);
  parameters(request, []);
  if (s[0] === 'review-links') {
    if (method === 'POST' && s.length === 1) return json(await service.createReviewLink(actor, parseReviewLinkCreate(await readJson(request)), requiredKey(context)), context.requestId, 201);
    if (method === 'PATCH' && s.length === 2) return json(await service.updateReviewLink(actor, s[1], parseReviewLinkPatch(await readJson(request)), optionalKey(context)), context.requestId);
    if (method === 'POST' && s.length === 3) { const input = parseGuestRowVersion(await readJson(request)); const metadata = requiredKey(context); return json(s[2] === 'rotate' ? await service.rotateReviewLink(actor, s[1], input, metadata) : await service.revokeReviewLink(actor, s[1], input, metadata), context.requestId); }
  }
  if (s[0] === 'versions' && s.length === 3) {
    if (method === 'POST' && s[2] === 'comments') return json(await service.createComment(actor, s[1], parseCommentCreate(await readJson(request)), requiredKey(context)), context.requestId, 201);
    if (method === 'PUT' && s[2] === 'preferences') return json(await service.setPreference(actor, s[1], parsePreferenceSet(await readJson(request)), requiredKey(context)), context.requestId);
  }
  if (s[0] === 'comments' && method === 'PATCH') return json(await service.updateComment(actor, s[1], parseCommentPatch(await readJson(request)), optionalKey(context)), context.requestId);
  if (s[0] === 'pdf-exports') {
    if (method === 'POST' && s.length === 1) { const result = await service.preparePdfExport(actor, parseExportPrepare(await readJson(request)), requiredKey(context)); return json(result, context.requestId, result.cached ? 200 : 202); }
    if (method === 'GET' && s.length === 2) return json(await service.getPdfExport(actor, s[1]), context.requestId);
    if (method === 'POST' && s.length === 3 && s[2] === 'download') { await readBoundedBody(request, 0); return json(await service.downloadPdfExport(actor, s[1]), context.requestId); }
    if (method === 'GET' && s.length === 3 && s[2] === 'content') return binary(await service.getPdfExportContent(actor, s[1], request.headers.get('range')));
  }
  throw new DomainError('RESOURCE_NOT_FOUND', 'This review operation is unavailable.', 404);
}
export function isGuestReviewRoute(s: string[]): boolean { return s[0] === 'review' || s[0] === 'review-media'; }
function token(value: string | null | undefined): string { if (!value || !/^[A-Za-z0-9_-]{43}$/u.test(value) || Buffer.from(value, 'base64url').toString('base64url') !== value) denied(); return value; }
function contextId(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value)) invalid(); return value; }
export function guestSessionCookieName(id: string): string { return `eps_review_${contextId(id).replaceAll('-', '')}`; }
function grantCookieName(versionId: string, assetId: string): string { return `eps_media_${contextId(versionId).replaceAll('-', '')}_${contextId(assetId).replaceAll('-', '')}`; }
function readCookie(request: Request, name: string): string | null {
  const matches = (request.headers.get('cookie') ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  if (matches.length > 1) denied(); return matches.length ? token(matches[0].slice(name.length + 1)) : null;
}
function browser(request: Request): boolean { const value = request.headers.get('x-eps-review-browser'); if (value !== null && value !== '1') invalid(); return value === '1'; }
function authorization(request: Request, s: string[]) {
  const query = new URL(request.url).searchParams; const publicContext = request.headers.get('x-review-context') ?? query.get('review_context');
  if (request.headers.has('x-review-context') && query.has('review_context') && request.headers.get('x-review-context') !== query.get('review_context')) invalid();
  if (s[0] === 'review-media') return { credential: token(request.headers.get('x-media-grant') ?? readCookie(request, grantCookieName(s[2], s[4]))), cookie: !request.headers.has('x-media-grant') };
  const supplied = request.headers.get('x-review-session');
  if (supplied !== null) return { credential: token(supplied), cookie: false };
  if (!publicContext) denied(); return { credential: token(readCookie(request, guestSessionCookieName(contextId(publicContext)))), cookie: true };
}
function authorizeOrigin(request: Request, origin: string, cookie: boolean, browserMode: boolean) {
  if (request.headers.get('host') !== new URL(origin).host) throw new DomainError('ACCESS_DENIED', 'Use the configured review origin.', 403);
  const supplied = request.headers.get('origin');
  if (supplied !== null && supplied !== origin || request.method !== 'GET' && (cookie || browserMode) && supplied !== origin) throw new DomainError('ACCESS_DENIED', 'Use the configured review origin for this request.', 403);
}
function browserAccess(access: GuestAccess) { const { access_token: _, ...safe } = access; void _; return safe; }
function cookie(name: string, value: string, path: string, expires: string, origin: string) { return `${name}=${token(value)}; Path=${path}; HttpOnly; SameSite=Strict; Expires=${new Date(expires).toUTCString()}${origin.startsWith('https:') ? '; Secure' : ''}`; }
export function createGuestRateLimiter(now: () => number = Date.now) {
  const buckets = new Map<string, { start: number; count: number }>();
  return (credential: string, open = false) => {
    const timestamp = now(); const key = (open ? 'open:' : 'session:') + createHash('sha256').update(credential).digest('hex');
    for (const [name, value] of buckets) if (timestamp - value.start >= 60000) buckets.delete(name);
    for (const [name, maximum] of [[open ? 'global-open' : 'global-session', open ? 300 : 3000], [key, open ? 20 : 240]] as const) {
      let bucket = buckets.get(name); if (!bucket) { if (buckets.size >= 4000) throw new DomainError('RATE_LIMITED', 'Too many review requests. Try again shortly.', 429, { retry_after_seconds: 60 }, true); bucket = { start: timestamp, count: 0 }; buckets.set(name, bucket); }
      if (++bucket.count > maximum) throw new DomainError('RATE_LIMITED', 'Too many review requests. Try again shortly.', 429, { retry_after_seconds: 60 }, true);
    }
  };
}
const throttle = createGuestRateLimiter();
export async function handleGuestReviewRequest(request: Request, s: string[], service: GuestReviewOperations, context: Context,
  options: { origin: string; rateLimit?: ReturnType<typeof createGuestRateLimiter> }): Promise<Response> {
  if (!isGuestReviewRoute(s)) invalid(); s.forEach(guestIdentifier); const method = request.method; const browserMode = browser(request);
  const emit = (value: unknown, status = 200) => Response.json({ request_id: context.requestId, data: value }, { status, headers: PRIVATE_HEADERS });
  if (s[0] === 'review' && s.length === 2 && s[1] === 'open' && method === 'POST') {
    parameters(request, []); authorizeOrigin(request, options.origin, false, browserMode); await readBoundedBody(request, 0);
    const raw = token(request.headers.get('x-review-token')); (options.rateLimit ?? throttle)(raw, true); const access = await service.openReview(raw);
    const result = emit(browserMode ? browserAccess(access) : access);
    if (browserMode) result.headers.set('Set-Cookie', cookie(guestSessionCookieName(access.guest_session_id), access.access_token, '/api/v1/review', access.expires_at, options.origin)); return result;
  }
  const grantRoute = s[0] === 'review-media' && s.length === 6 && s[1] === 'versions' && s[3] === 'media' && ['playback', 'content'].includes(s[5]);
  if (s[0] === 'review-media' && !grantRoute) invalid();
  const auth = authorization(request, s); authorizeOrigin(request, options.origin, auth.cookie, browserMode); (options.rateLimit ?? throttle)(auth.credential);
  if (grantRoute) {
    parameters(request, []);
    if (method === 'POST' && s[5] === 'playback') { await readBoundedBody(request, 0); const result = await service.playGrantMedia(auth.credential, s[2], s[4]); const response = emit(result);
      if (browserMode || auth.cookie) response.headers.set('Set-Cookie', cookie(grantCookieName(s[2], s[4]), auth.credential, `/api/v1/review-media/versions/${s[2]}/media/${s[4]}`, result.expires_at, options.origin)); return response; }
    if (method === 'GET' && s[5] === 'content') return binary(await service.getGrantMediaContent(auth.credential, s[2], s[4], request.headers.get('range')));
    invalid();
  }
  const binaryRoute = method === 'GET' && (s.length === 6 && s[1] === 'versions' && s[3] === 'media' && s[5] === 'content' || s.length === 4 && s[1] === 'pdf-exports' && s[3] === 'content');
  if (binaryRoute) {
    parameters(request, ['review_context']);
    return binary(s[1] === 'versions' ? await service.getMediaContent(auth.credential, s[2], s[4], request.headers.get('range')) : await service.getPdfExportContent(auth.credential, s[2], request.headers.get('range')));
  }
  if (method === 'GET' && s.length === 4 && s[1] === 'versions' && s[3] === 'feedback') return emit(await service.listFeedback(auth.credential, s[2], parseGuestListOptions(parameters(request, ['cursor', 'limit']))));
  parameters(request, []);
  if (s.length === 2) {
    if (method === 'GET' && s[1] === 'session') return emit(browserAccess(await service.getSession(auth.credential)));
    if (method === 'PUT' && s[1] === 'identity') { const access = await service.identify(auth.credential, parseGuestIdentity(await readJson(request)), optionalKey(context)); return emit(browserMode || auth.cookie ? browserAccess(access) : access); }
    if (method === 'GET' && s[1] === 'presentation') return emit(await service.getCurrentVersion(auth.credential));
  }
  if (s[1] === 'versions') {
    if (method === 'GET' && s.length === 3) return emit(await service.getVersion(auth.credential, s[2]));
    if (s.length === 4) {
      if (method === 'POST' && s[3] === 'comments') return emit(await service.createComment(auth.credential, s[2], parseGuestCommentCreate(await readJson(request)), requiredKey(context)), 201);
      if (method === 'PUT' && s[3] === 'preferences') return emit(await service.setPreference(auth.credential, s[2], parsePreferenceSet(await readJson(request)), requiredKey(context)));
      if (method === 'POST' && s[3] === 'pdf-exports') { await readBoundedBody(request, 0); const result = await service.preparePdfExport(auth.credential, s[2], requiredKey(context)); return emit(result, result.cached ? 200 : 202); }
    }
    if (method === 'POST' && s.length === 5 && s[3] === 'media') { await readBoundedBody(request, 0); return emit(await service.playMedia(auth.credential, s[2], s[4])); }
  }
  if (method === 'PATCH' && s.length === 3 && s[1] === 'comments') return emit(await service.updateComment(auth.credential, s[2], parseGuestCommentPatch(await readJson(request)), optionalKey(context)));
  if (s[1] === 'pdf-exports') {
    if (method === 'GET' && s.length === 3) return emit(await service.getPdfExport(auth.credential, s[2]));
    if (method === 'POST' && s.length === 4 && s[3] === 'download') { await readBoundedBody(request, 0); return emit(await service.downloadPdfExport(auth.credential, s[2])); }
  }
  throw new DomainError('RESOURCE_NOT_FOUND', 'This guest review operation is unavailable.', 404);
}
