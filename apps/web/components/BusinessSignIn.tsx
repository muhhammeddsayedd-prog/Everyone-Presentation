'use client';
import { useState } from 'react';
import { api, errorMessage, mutation } from './api';
import { ErrorNotice } from './Feedback';

export function BusinessSignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState(() => typeof window !== 'undefined' && new URL(window.location.href).searchParams.get('auth') === 'failed'
    ? 'This sign-in link could not be used. Request a new link in this browser.' : '');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state !== 'idle') return;
    setState('sending'); setError('');
    try { await api('/api/auth/sign-in', mutation('POST', { email: email.trim() })); setState('sent'); }
    catch (reason) { setError(errorMessage(reason)); setState('idle'); }
  }
  return <div className="session-page">
    <div className="session-intro">
      <h1>Your casting workspace.</h1>
      <p>Sign in to Everyone to access the projects and library your account is authorized to use.</p>
    </div>
    <section className="session-form">
      <h2>Sign in to Everyone</h2>
      <p>We’ll email you a secure sign-in link.</p>
      <form className="business-sign-in-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="business-email">Email address</label>
          <input id="business-email" type="email" autoComplete="email" required maxLength={254} value={email}
            onChange={event => { setEmail(event.target.value); if (state === 'sent') setState('idle'); }}
            disabled={state === 'sending'} />
        </div>
        {error && <ErrorNotice message={error} />}
        {state === 'sent'
          ? <p role="status">Check your inbox for the sign-in link. Your account’s project permissions are checked after sign-in. Edit the email address to request a different link.</p>
          : <button className="button button-primary" disabled={state === 'sending'}>{state === 'sending' ? 'Requesting link…' : 'Email me a sign-in link'}</button>}
      </form>
    </section>
  </div>;
}
