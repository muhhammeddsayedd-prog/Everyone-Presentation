'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage, mutation, type Actor, type AudiencePreset } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { AudiencePresetRow } from './AudiencePresetRow';
import { useRuntimeMode } from './RuntimeMode';

export function SettingsView({ actor }: { actor: Actor }) {
  const central = useRuntimeMode() === 'supabase';
  const [presets, setPresets] = useState<AudiencePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<'internal' | 'external'>('external');
  const [refresh, setRefresh] = useState(0);
  const canManage = actor.capabilities?.includes('settings.manage') ?? false;
  useEffect(() => {
    let current = true;
    api<AudiencePreset[]>('/api/v1/audience-presets').then(result => { if (current) { setPresets(result.data); setError(''); } }).catch(reason => { if (current) setError(errorMessage(reason)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [refresh]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (!label.trim()) return; setBusy(true); setError('');
    try { await api('/api/v1/audience-presets', mutation('POST', { label: label.trim(), scope, settings: {} })); setLabel(''); setRefresh(value => value + 1); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <><header className="page-heading"><div><h1>Settings</h1><p>Audience presets and environment connections.</p></div></header><section className="editor-section"><div className="section-heading"><div><h2>Audience presets</h2><p>Starting defaults for future presentation series. Preset changes will apply to future selections.</p></div></div>{error && <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} />}{loading ? <Loading label="Loading audience presets…" /> : <div className="preset-list">{presets.filter(item => !item.archived).map(item => <AudiencePresetRow key={`${item.id}/${item.row_version}`} preset={item} canManage={canManage} onChanged={() => setRefresh(value => value + 1)} />)}</div>}{canManage && <form className="preset-create" onSubmit={create}><div className="field"><label htmlFor="preset-label">New audience preset</label><input id="preset-label" value={label} maxLength={100} onChange={event => setLabel(event.target.value)} placeholder="Audience label" required /></div><div className="field"><label htmlFor="preset-scope">Scope</label><select id="preset-scope" value={scope} onChange={event => setScope(event.target.value as 'internal' | 'external')}><option value="external">External</option><option value="internal">Internal</option></select></div><button className="button" disabled={busy || !label.trim()}>{busy ? 'Saving…' : 'Add preset'}</button></form>}</section><section className="editor-section"><div className="section-heading"><div><h2>Connections</h2><p>{central ? "Central records use your Everyone account. Processing integrations are still being verified." : "Observed development state. Provider integration has not been verified."}</p></div></div><dl className="connection-list"><div><dt>Central business records</dt><dd><span className="badge">{central ? "Supabase canonical records" : "Synthetic development adapter"}</span></dd></div><div><dt>Business authentication</dt><dd>{central ? "Supabase account and explicit project grants" : "Synthetic development identities"}</dd></div><div><dt>OpenAI processing</dt><dd>Specs extraction tested locally</dd></div><div><dt>n8n orchestration</dt><dd>Specs orchestration tested locally</dd></div><div><dt>Media and PDF worker</dt><dd>Document preparation tested; candidate video workflow and presentation PDF rendering are in development</dd></div><div><dt>Typography</dt><dd>System fallback · brand font files not supplied</dd></div></dl></section></>;
}
