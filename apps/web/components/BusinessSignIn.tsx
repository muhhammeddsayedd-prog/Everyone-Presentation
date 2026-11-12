'use client';
import { useState, useSyncExternalStore } from 'react';
import { api, errorMessage, mutation } from './api';
import { ErrorNotice } from './Feedback';
import { TextReveal } from './motion/TextReveal';

function subscribeToLocationChange(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}
function callbackFailure() { return new URL(window.location.href).searchParams.get('auth') ?? ''; }
function noServerCallbackFailure() { return ''; }
const CALLBACK_MESSAGES: Record<string, string> = {
  failed: 'Sign-in could not be completed. Request a new email link, or continue with Google, in this browser.',
  google_failed: 'Google sign-in is not available right now. Use the email link, or ask your workspace administrator to check Google sign-in.',
};
/** Google's standard "G" mark for the sign-in button. */
function GoogleMark() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>;
}

export function BusinessSignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  // React uses the same false snapshot on the server and during hydration.
  const callbackCode = useSyncExternalStore(subscribeToLocationChange, callbackFailure, noServerCallbackFailure);
  const [leaving, setLeaving] = useState(false);
  const [requestError, setError] = useState<string | null>(null);
  const error = requestError ?? CALLBACK_MESSAGES[callbackCode] ?? '';
  async function google() {
    if (leaving) return;
    setLeaving(true); setError('');
    try {
      const { data } = await api<{ url: string }>('/api/auth/google', mutation('POST', {}));
      // The server only returns the central project's own Google authorize URL.
      if (!data?.url?.startsWith('https://')) throw new Error('Google sign-in could not be started.');
      window.location.assign(data.url);
    } catch (reason) { setError(errorMessage(reason)); setLeaving(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state !== 'idle') return;
    setState('sending'); setError('');
    try { await api('/api/auth/sign-in', mutation('POST', { email: email.trim() })); setState('sent'); }
    catch (reason) { setError(errorMessage(reason)); setState('idle'); }
  }
  return <div className="session-page">
    <div className="session-intro">
      <h1><TextReveal text="Your casting workspace." /></h1>
      <p>Sign in to Everyone to access the projects and library your account is authorized to use.</p>
    </div>
    <section className="session-form">
      <h2>Sign in to Everyone</h2>
      <div className="google-sign-in-form">
        <button className="button google-sign-in" type="button" disabled={leaving || state === 'sending'} onClick={() => void google()}><GoogleMark />{leaving ? 'Opening Google…' : 'Continue with Google'}</button>
      </div>
      <p className="sign-in-divider" role="separator" aria-label="or"><span aria-hidden="true">or</span></p>
      <p>We’ll email you a secure sign-in link. Request it in the browser you want to use, then open the email link in that browser.</p>
      <form className="business-sign-in-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="business-email">Email address</label>
          <input id="business-email" type="email" autoComplete="email" required maxLength={254} value={email}
            onChange={event => { setEmail(event.target.value); setError(''); if (state === 'sent') setState('idle'); }}
            disabled={state === 'sending'} />
        </div>
        {error && <ErrorNotice message={error} />}
        {state === 'sent'
          ? <><p role="status">Check your inbox and spam folder, then open the sign-in link in this browser. Your account’s project permissions are checked after sign-in.</p>
            <button type="button" className="button" onClick={() => setState('idle')}>Back to sign-in</button></>
          : <button className="button button-primary" disabled={state === 'sending'}>{state === 'sending' ? 'Requesting link…' : error ? 'Try requesting a link again' : 'Email me a sign-in link'}</button>}
      </form>
    </section>
  </div>;
}
