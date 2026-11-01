'use client';

import { useState } from 'react';
import { api, errorMessage, mutation, type Actor, type Session } from './api';
import { ErrorNotice } from './Feedback';
import { Icon } from './Icon';
import { TextReveal } from './motion/TextReveal';

export function SessionGate({ actors, onSignedIn }: { actors: Actor[]; onSignedIn: (session: Session) => void }) {
  const [selected, setSelected] = useState(actors[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function signIn() {
    setSaving(true); setError('');
    try { const result = await api<Session>('/api/dev/session', mutation('POST', { actor_id: selected })); onSignedIn(result.data); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }
  return <div className="session-page"><div className="session-intro"><h1><TextReveal text="From casting material" /><br /><TextReveal text="to a clear presentation." /></h1><p>One workspace for Cast Selection and Cast Shortlist. Built around your project, your casting choices, and the facts you review.</p><div className="session-flow"><span>Project</span><Icon name="arrow" /><span>Casting</span><Icon name="arrow" /><span>Presentation</span></div></div><section className="session-form"><h2>Open the development workspace</h2><p>Choose a synthetic identity to test project permissions. Use central mode for business sign-in.</p><label htmlFor="development-identity">Development identity</label><select id="development-identity" value={selected} onChange={event => setSelected(event.target.value)}>{actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select><p className="small muted">{actors.find(actor => actor.id === selected)?.description ?? 'Synthetic data only. No connection to central business records.'}</p>{error && <ErrorNotice message={error} />}<button className="button button-primary" disabled={saving || !selected} onClick={signIn}>{saving ? 'Opening…' : 'Enter development workspace'}<Icon name="arrow" /></button></section></div>;
}
