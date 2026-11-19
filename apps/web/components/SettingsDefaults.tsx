'use client';

import { CURRENT_TEMPLATE, templateName } from './workspace/template-names';
import { useEffect, useState, type ReactNode } from 'react';
import type { Settings } from '../../../packages/domain/src/settings-types';
import type { AudiencePreset, Envelope } from './api';
import { settingsDto } from '../../../packages/domain/src/settings';
import { api, errorMessage } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { useReviewMutation } from './review-client';
import { Icon } from './Icon';

export function SettingsDefaults({ onDirtyChange, intro }: { onDirtyChange: (value: boolean) => void; intro?: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null); const [presets, setPresets] = useState<AudiencePreset[]>([]);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true; const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
    // Active audience presets for the default review audience (the first page holds every preset in practice).
    void api<AudiencePreset[]>('/api/v1/audience-presets?limit=100', { signal }).then((result: Envelope<AudiencePreset[]>) => { if (current && Array.isArray(result.data)) setPresets(result.data.filter(row => !row.archived)); }).catch(() => undefined);
    void api<Settings>('/api/v1/settings', { signal })
      .then(result => { const next = settingsDto(result.data); if (current) { setSettings(next); setError(''); } })
      .catch(reason => { if (current) setError(errorMessage(reason)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [refresh]);
  function reload() { setLoading(true); setNotice(''); setRefresh(value => value + 1); }
  return <section className="editor-section" aria-labelledby="studio-defaults-heading">
    <div className="section-heading"><span className="section-icon" aria-hidden="true"><Icon name="settings" /></span><div><h2 id="studio-defaults-heading">Studio defaults</h2><p>Defaults for future work. Saved presentations keep their original content.</p></div></div>
    {intro}
    {notice && <p role="status">{notice}</p>}
    {error && <ErrorNotice message={error} retry={reload} />}
    {loading ? <Loading label="Loading Studio defaults..." /> : settings && <DefaultsEditor key={settings.row_version} settings={settings} presets={presets} onDirtyChange={onDirtyChange}
      onReload={reload}
      onSaved={next => { setSettings(next); setNotice('Studio defaults saved.'); }} />}
  </section>;
}
function DefaultsEditor({ settings, presets, onDirtyChange, onReload, onSaved }: {
  settings: Settings; presets: AudiencePreset[]; onDirtyChange: (value: boolean) => void; onReload: () => void; onSaved: (value: Settings) => void;
}) {
  const [timezone, setTimezone] = useState(settings.default_timezone);
  const [template, setTemplate] = useState(settings.template_version);
  // Older servers (before m18) do not report a default review audience; the selector is then hidden.
  const audienceSupported = Object.hasOwn(settings, 'default_audience_preset_id'); const savedAudience = settings.default_audience_preset_id ?? '';
  const [audience, setAudience] = useState(savedAudience);
  const write = useReviewMutation();
  const dirty = timezone !== settings.default_timezone || template !== settings.template_version || audienceSupported && audience !== savedAudience;
  useEffect(() => { onDirtyChange(dirty || write.locked); return () => onDirtyChange(false); }, [dirty, write.locked, onDirtyChange]);
  async function save(retry = false) {
    const accepted = (value: unknown) => {
      const result = settingsDto(value);
      if (result.row_version !== settings.row_version + 1 || result.default_timezone !== timezone.trim() || result.template_version !== template || audienceSupported && (result.default_audience_preset_id ?? '') !== audience) {
        throw new Error('The saved settings could not be confirmed. Retry the same save.');
      }
      return result;
    };
    const result = retry ? await write.send<Settings>() : await write.send('/api/v1/settings', 'PATCH', {
      row_version: settings.row_version, default_timezone: timezone.trim(), template_version: template,
      ...(audienceSupported && audience !== savedAudience ? { default_audience_preset_id: audience || null } : {}),
    }, accepted);
    if (result) onSaved(result);
  }
  return <form onSubmit={event => { event.preventDefault(); void save(); }}>
    <div className="form-grid"><div className="field"><label htmlFor="studio-default-timezone">Default timezone</label>
      <input id="studio-default-timezone" value={timezone} maxLength={100} disabled={write.locked} onChange={event => setTimezone(event.target.value)} required aria-describedby="studio-timezone-help" />
      <p id="studio-timezone-help" className="small muted">Use an IANA timezone, such as Africa/Cairo, or UTC. Link expiry inputs use your browser's local time.</p>
    </div><div className="field"><label htmlFor="studio-template-version">Default presentation template</label>
      <select id="studio-template-version" aria-describedby="studio-template-help" value={template} disabled={write.locked} onChange={event => setTemplate(event.target.value)}>
        {[...new Set([settings.template_version, CURRENT_TEMPLATE])].map(version => <option key={version} value={version}>{templateName(version)}</option>)}
      </select>
      <p id="studio-template-help" className="small muted">New series use this template once it is saved here. {templateName(CURRENT_TEMPLATE)} is the template offered for new series: cast pages with portraits (Main and Backup labelled, options side by side), each person&apos;s name, age and height under their portrait (only what was provided), scene dividers and highlighted notes; other candidate facts stay in the app. Series and saved versions made with an earlier template, including 1.4.0 and 1.3.0, keep it and stay readable.</p>
      {template !== CURRENT_TEMPLATE && <p className="small text-warn">The saved default is an earlier template. Choose {templateName(CURRENT_TEMPLATE)} and save.</p>}</div>
    {audienceSupported && <div className="field"><label htmlFor="studio-default-audience">Default review audience</label>
      <select id="studio-default-audience" aria-describedby="studio-audience-help" value={audience} disabled={write.locked} onChange={event => setAudience(event.target.value)}>
        <option value="">Not set</option>
        {savedAudience && !presets.some(row => row.id === savedAudience) && <option value={savedAudience}>Unavailable audience (choose another)</option>}
        {presets.map(row => <option key={row.id} value={row.id}>{row.label} ({row.scope})</option>)}
      </select>
      <p id="studio-audience-help" className="small muted">Ordinary review series use this audience; Client is the usual choice. Until one is set, Review asks for it before creating a series. Other review contexts are chosen in Share and keep their own series.</p></div>}
    </div>
    <dl className="connection-list"><div><dt>Default review access</dt><dd>30 days</dd></div>
      {Object.entries(settings.models).map(([name, model]) => <div key={name}><dt>{`${name.charAt(0).toUpperCase()}${name.slice(1).replaceAll('_', ' ')}`} model</dt><dd>{model}</dd></div>)}
    </dl>
    {write.error && <ErrorNotice message={write.error} />}
    <div className="action-row"><button className="button button-primary" type="submit" disabled={write.locked || !dirty || !timezone.trim()}>{write.busy ? 'Saving...' : 'Save defaults'}</button>
      {write.uncertain && <button className="button" type="button" disabled={write.busy} onClick={() => void save(true)}>Confirm same save</button>}
      <button className="button button-quiet" type="button" disabled={write.locked} onClick={onReload}>Reload saved defaults</button>
    </div>
  </form>;
}
