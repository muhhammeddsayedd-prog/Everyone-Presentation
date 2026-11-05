'use client';
import { Icon } from './Icon';

import { useEffect, useState } from 'react';
import { api, errorMessage, mutation, type Actor, type AudiencePreset } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { AudiencePresetRow } from './AudiencePresetRow';
import { useRuntimeMode } from './RuntimeMode';
import { SettingsDefaults } from './SettingsDefaults';
import { PageFrame } from './shell/PageFrame';

const noDirtyChange = () => {};
export function SettingsView({ actor, onDirtyChange = noDirtyChange }: { actor: Actor; onDirtyChange?: (value: boolean) => void }) {
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
  const sections = [{ id: 'audience-presets', label: 'Audience presets', icon: 'people' as const }, ...(central && canManage ? [{ id: 'studio-defaults', label: 'Studio defaults', icon: 'settings' as const }] : []), { id: 'connections', label: 'Connections', icon: 'link' as const }];
  const panelBody = <>
    <nav aria-label="Settings sections"><ul className="panel-links">{sections.map(item => <li key={item.id}><a href={`#${item.id}`}><Icon name={item.icon} /><span>{item.label}</span></a></li>)}</ul></nav>
    <div className="section-note"><Icon name="lock" /><p>{canManage ? 'Settings change future presentation work only. Saved versions are never changed.' : 'You can view these settings. Changing them requires settings permission.'}</p></div>
  </>;
  return <PageFrame className="settings-page" panel={{ title: 'Sections', subtitle: 'Studio-wide configuration', label: 'Settings sections panel', body: panelBody }}>
    <header className="page-heading"><div><h1>Settings</h1><p>Studio-wide defaults for future presentation work. Saved versions are never changed by settings.</p></div></header>
    <section className="editor-section settings-section" id="audience-presets"><div className="section-heading"><div><h2>Audience presets</h2><p>Starting defaults for future presentation series. Preset changes will apply to future selections.</p></div></div><ul className="settings-scope-list" aria-label="What audience presets change"><li>The audience you choose when creating a series in Review.</li><li>External audiences can be shared with guests; internal ones cannot.</li><li>Existing series keep the audience captured when they were created.</li></ul>{error && <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} />}{loading ? <Loading label="Loading audience presets…" /> : <div className="preset-list">{presets.filter(item => !item.archived).map(item => <AudiencePresetRow key={`${item.id}/${item.row_version}`} preset={item} canManage={canManage} onChanged={() => setRefresh(value => value + 1)} />)}</div>}{canManage && <form className="preset-create" onSubmit={create}><div className="field"><label htmlFor="preset-label">New audience preset</label><input id="preset-label" value={label} maxLength={100} onChange={event => setLabel(event.target.value)} placeholder="Audience label" required /></div><div className="field"><label htmlFor="preset-scope">Scope</label><select id="preset-scope" value={scope} onChange={event => setScope(event.target.value as 'internal' | 'external')}><option value="external">External</option><option value="internal">Internal</option></select></div><button className="button" disabled={busy || !label.trim()}>{busy ? 'Saving…' : 'Add preset'}</button></form>}</section>
    {central && canManage && <div className="settings-section" id="studio-defaults"><ul className="settings-scope-list" aria-label="What Studio defaults change"><li>The template new presentation series start from.</li><li>The timezone Studio uses to show dates and times.</li><li>Saved versions keep the template and content they were generated with.</li></ul><SettingsDefaults onDirtyChange={onDirtyChange} /></div>}
    <section className="editor-section settings-section" id="connections"><div className="section-heading"><div><h2>Connections</h2><p>{central ? "Central records use your Everyone account. Processing reports are available in Processing." : "Observed development state. Provider integration has not been verified."}</p></div></div><ul className="settings-scope-list" aria-label="About connections"><li>Where Studio reads records and runs processing. These are set by the deployment, not here.</li></ul><dl className="connection-list"><div><dt>Central business records</dt><dd><span className="badge">{central ? "Supabase canonical records" : "Synthetic development adapter"}</span></dd></div><div><dt>Business authentication</dt><dd>{central ? "Supabase account and explicit project grants" : "Synthetic development identities"}</dd></div><div><dt>OpenAI processing</dt><dd>Specs and video processing use OpenAI</dd></div><div><dt>n8n orchestration</dt><dd>Existing n8n Cloud workflows</dd></div><div><dt>Media and PDF worker</dt><dd>Separate worker for documents, videos and presentation PDFs</dd></div><div><dt>Typography</dt><dd>General Sans (self-hosted) for the interface; IBM Plex Sans Arabic for Arabic text</dd></div></dl></section>
  </PageFrame>;
}
