'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError, mutation } from './api';

export function reviewRequest<T>(path: string, context?: string, init: RequestInit = {}) {
  return api<T>(path, { ...init, headers: { ...init.headers, ...(context ? { 'X-Review-Context': context, 'X-EPS-Review-Browser': '1' } : {}) } });
}

export function reviewError(reason: unknown) {
  if (reason instanceof ApiError && reason.status === 429) return 'Too many requests. Please wait a moment, then retry the same request.';
  if (reason instanceof Error && ['AbortError', 'TimeoutError'].includes(reason.name)) return 'The response was interrupted. Confirm the same request before making another change.';
  return reason instanceof Error ? reason.message : 'This request could not be completed.';
}

/** Retain the whole original request after an unknown write, including later denials. */
export function useReviewMutation(context?: string) {
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState('');
  const alive = useRef(false), sending = useRef(false), sticky = useRef(false);
  const intent = useRef<{ path: string; init: RequestInit; validate?: (value: unknown) => unknown } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function send<T>(path?: string, method?: string, body?: unknown, validate?: (value: unknown) => T): Promise<T | undefined> {
    if (sending.current || path && intent.current) return;
    if (path && method) intent.current = { path, init: mutation(method, body), validate };
    const request = intent.current; if (!request) return;
    sending.current = true; setBusy(true); setError('');
    try {
      const result = await reviewRequest<T>(request.path, context, { ...request.init, signal: AbortSignal.timeout(30000) });
      const accepted = request.validate ? request.validate(result.data) as T : result.data;
      intent.current = null; sticky.current = false;
      if (alive.current) setUncertain(false);
      return accepted;
    } catch (reason) {
      const unknown = sticky.current || !(reason instanceof ApiError) || reason.status >= 500 || [408, 429].includes(reason.status);
      sticky.current = unknown;
      if (!unknown) intent.current = null;
      if (alive.current) { setUncertain(unknown); setError(`${unknown ? 'The change may have been saved. Confirm the same request. ' : ''}${reviewError(reason)}`); }
    } finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  return { send, busy, uncertain, error, locked: busy || uncertain };
}

export function sameOriginReviewUrl(value: string, pathname: string, context?: string) {
  const parsed = new URL(value, window.location.origin);
  const sharedLink = pathname === '/r/';
  const pathMatches = sharedLink ? /^\/r\/[A-Za-z0-9_-]{43}$/u.test(parsed.pathname) : parsed.pathname === pathname;
  const queryMatches = context ? parsed.searchParams.getAll('review_context').length === 1 && parsed.searchParams.get('review_context') === context
    && [...parsed.searchParams.keys()].every(key => key === 'review_context') : parsed.search === '';
  if (parsed.origin !== window.location.origin || !pathMatches || !queryMatches || parsed.username || parsed.password || parsed.hash) throw new Error('The media access response could not be confirmed.');
  return parsed.pathname + parsed.search;
}
