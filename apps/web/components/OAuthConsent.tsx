'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorNotice, Loading } from './Feedback';
import { parseOAuthConsentEnvelope, type OAuthConsentView } from '../lib/oauth-consent-contract';
import styles from './OAuthConsent.module.css';

class ConsentRequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super('The authorization request could not be completed.'); }
}
async function send(path: string, value: Record<string, unknown>, signal?: AbortSignal): Promise<OAuthConsentView> {
  const requestId = crypto.randomUUID();
  const response = await fetch(path, { method: 'POST', cache: 'no-store', signal, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...value, request_id: requestId }) });
  const text = await response.text();
  if (text.length > 8192) throw new Error('The authorization response could not be verified.');
  let result: unknown;
  try { result = JSON.parse(text); } catch { throw new Error('The authorization response could not be verified.'); }
  if (!response.ok) {
    const error = result && typeof result === 'object' && 'error' in result ? (result as { error?: { code?: unknown } }).error : undefined;
    throw new ConsentRequestError(response.status, typeof error?.code === 'string' ? error.code : 'REQUEST_FAILED');
  }
  return parseOAuthConsentEnvelope(result, requestId);
}
function message(error: unknown) {
  if (error instanceof ConsentRequestError && error.status === 429) return 'Sign-in requests are temporarily limited. Check your inbox for a recent link, then try again later.';
  if (error instanceof ConsentRequestError && error.code === 'OAUTH_PROVIDER_RESPONSE_INVALID') return 'This connection request could not be verified. Return to your client and start the connection again.';
  if (error instanceof ConsentRequestError && error.code === 'OAUTH_AUTHORIZATION_IN_PROGRESS') return 'This connection request is already being checked. Wait briefly, then check its status.';
  if (error instanceof ConsentRequestError && error.code === 'OAUTH_AUTHORIZATION_PROCESSED') return 'This connection request has already been processed. Return to your client and start a fresh connection.';
  return 'The authorization service could not be reached. Check the request status or restart the connection from your client.';
}

export function OAuthConsent({ authorizationId, callbackFailed = false }: { authorizationId: string | null; callbackFailed?: boolean }) {
  const [view, setView] = useState<OAuthConsentView | null>(null);
  const [loading, setLoading] = useState(Boolean(authorizationId));
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(callbackFailed ? 'This sign-in link could not be used. Request a new link in this browser.' : '');
  const [email, setEmail] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const sequence = useRef(0);
  const apply = useCallback((data: OAuthConsentView) => {
    if (data.state === 'redirect') { window.location.assign(data.redirect_url); return; }
    setView(data); setSignedOut(false);
    if (data.state === 'uncertain') setUncertain(true);
  }, []);
  const inspect = useCallback(async (signal?: AbortSignal) => {
    if (!authorizationId) return;
    const current = ++sequence.current;
    try {
      const data = await send('/api/oauth/authorization', { authorization_id: authorizationId, action: 'details' }, signal);
      if (!signal?.aborted && current === sequence.current) apply(data);
    } catch (reason) {
      if (signal?.aborted || current !== sequence.current) return;
      if (reason instanceof ConsentRequestError && reason.status === 401) setSignedOut(true);
      else setError(message(reason));
    } finally { if (!signal?.aborted && current === sequence.current) setLoading(false); }
  }, [authorizationId, apply]);
  useEffect(() => {
    if (!authorizationId) return;
    const controller = new AbortController(); const current = ++sequence.current;
    // A discarded Strict Mode mount must not send a second provider authorization read.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      send('/api/oauth/authorization', { authorization_id: authorizationId, action: 'details' }, controller.signal)
        .then(data => { if (!controller.signal.aborted && current === sequence.current) apply(data); })
        .catch(reason => {
          if (controller.signal.aborted || current !== sequence.current) return;
          if (reason instanceof ConsentRequestError && reason.status === 401) setSignedOut(true);
          else setError(message(reason));
        }).finally(() => { if (!controller.signal.aborted && current === sequence.current) setLoading(false); });
    });
    return () => controller.abort();
  }, [authorizationId, apply]);
  async function decide(action: 'approve' | 'deny') {
    if (!authorizationId || busy || uncertain) return;
    setBusy(true); setError('');
    try { apply(await send('/api/oauth/authorization', { authorization_id: authorizationId, action })); }
    catch (reason) {
      if (reason instanceof ConsentRequestError && reason.status === 401) { setSignedOut(true); setError('Your browser session expired. Sign in to check this request.'); }
      else { setUncertain(true); setError('The decision may have been received. Check its status without submitting another decision.'); }
    } finally { setBusy(false); }
  }
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); if (!authorizationId || busy) return;
    setBusy(true); setError('');
    try { setView(await send('/api/oauth/sign-in', { authorization_id: authorizationId, email: email.trim() })); }
    catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }
  const consent = view?.state === 'consent' ? view : null;
  return <main className={styles.page} id="main-content">
    <header className={styles.header}><Link href="/projects" aria-label="Everyone Presentation Studio home"><img src="/brand/everyone-logotype.svg" alt="everyone." width={160} height={45} /></Link><span>Presentation Studio</span></header>
    <div className={styles.layout}>
      <div className={styles.intro}><p className={styles.eyebrow}>Connect your tools</p><h1>Your workspace.<br />Your permissions.</h1>
        <p>Connect a client to the Everyone projects and casting library your account can already access.</p>
        <p className="small muted">Your account permissions still apply to every read, edit, generation and shared link.</p></div>
      <section className={styles.card} aria-labelledby="consent-heading" aria-busy={busy || loading}>
        <h2 id="consent-heading">Connect to Everyone</h2>
        {!authorizationId ? <ErrorNotice message="This authorization request is unavailable. Return to your client and start the connection again." />
          : loading ? <Loading label="Checking the connection request…" />
          : signedOut ? <><p>Sign in with your existing Everyone account to review this connection.</p><form onSubmit={signIn} className={styles.form}>
            <label className="field" htmlFor="oauth-email">Email address<input id="oauth-email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
            <button className="button button-primary" disabled={busy || view?.state === 'sign_in_sent'}>{busy ? 'Requesting link…' : 'Email me a sign-in link'}</button></form>
            {view?.state === 'sign_in_sent' && <p role="status">Check your inbox and open the link in this browser. It returns you to this connection request. Only existing accounts can sign in.</p>}</>
          : consent ? <><p className={styles.requested}>Requested by <strong dir="auto">{consent.client.name}</strong></p>
            {consent.client.website && <p className="small muted">Registered client website: <span dir="ltr">{consent.client.website}</span></p>}
            <dl className={styles.details}><div><dt>Everyone account</dt><dd dir="auto">{consent.account_email ?? 'Signed-in business account'}</dd></div><div><dt>Identity scope</dt><dd><code>openid</code> · Identify your signed-in account</dd></div></dl>
            <h3>What this connection can do</h3><p>Read and change only the projects, casting records, presentations and sharing controls your Everyone account can access. Confirming facts and generating versions follow your current permissions.</p>
            {!uncertain && <div className={styles.actions}><button type="button" className="button button-primary" disabled={busy} onClick={() => void decide('approve')}>{busy ? 'Sending decision…' : 'Approve connection'}</button><button type="button" className="button" disabled={busy} onClick={() => void decide('deny')}>Deny connection</button></div>}</>
          : null}
        {uncertain && <div className="notice" role="status"><p>The decision could not be confirmed. Check its status; a second approval will not be sent from this page.</p></div>}
        {error && <ErrorNotice message={error} />}
        {authorizationId && !loading && !busy && !signedOut && (uncertain || error) && <button type="button" className="button" onClick={() => { setLoading(true); setError(''); void inspect(); }}>Check authorization status</button>}
      </section>
    </div>
  </main>;
}
