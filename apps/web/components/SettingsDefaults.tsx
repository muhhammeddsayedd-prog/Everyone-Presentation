'use client';

import { useEffect, useState } from 'react';
import type { Settings } from '../../../packages/domain/src/settings-types';
import { settingsDto } from '../../../packages/domain/src/settings';
import { api, errorMessage } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { useReviewMutation } from './review-client';

export function SettingsDefaults({ onDirtyChange }: { onDirtyChange: (value: boolean) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true; const controller = new AbortController();
    void api<Settings>('/api/v1/settings', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })
      .then(result => { const next = settingsDto(result.data); if (current) { setSettings(next); setError(''); } })
      .catch(reason => { if (current) setError(errorMessage(reason)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [refresh]);
  function reload() { setLoading(true); setNotice(''); setRefresh(value => value + 1); }
  return <section className="editor-section" aria-labelledby="studio-defaults-heading">
    <div className="section-heading"><div><h2 id="studio-defaults-heading">Studio defaults</h2><p>Defaults for future work. Saved presentations keep their original content.</p></div></div>
    {notice && <p role="status">{notice}</p>}
    {error && <ErrorNotice message={error} retry={reload} />}
    {loading ? <Loading label="Loading Studio defaults..." /> : settings && <DefaultsEditor key={settings.row_version} settings={settings} onDirtyChange={onDirtyChange}
      onReload={reload}
      onSaved={next => { setSettings(next); setNotice('Studio defaults saved.'); }} />}
  </section>;
}
function DefaultsEditor({ settings, onDirtyChange, onReload, onSaved }: {
  settings: Settings; onDirtyChange: (value: boolean) => void; onReload: () => void; onSaved: (value: Settings) => void;
}) {
  const [timezone, setTimezone] = useState(settings.default_timezone);
  const [template, setTemplate] = useState(settings.template_version);
  const write = useReviewMutation();
  const dirty = timezone !== settings.default_timezone || template !== settings.template_version;
  useEffect(() => { onDirtyChange(dirty || write.locked); return () => onDirtyChange(false); }, [dirty, write.locked, onDirtyChange]);
  async function save(retry = false) {
    const accepted = (value: unknown) => {
      const result = settingsDto(value);
      if (result.row_version !== settings.row_version + 1 || result.default_timezone !== timezone.trim() || result.template_version !== template) {
        throw new Error('The saved settings could not be confirmed. Retry the same save.');
      }
      return result;
    };
    const result = retry ? await write.send<Settings>() : await write.send('/api/v1/settings', 'PATCH', {
      row_version: settings.row_version, default_timezone: timezone.trim(), template_version: template,
    }, accepted);
    if (result) onSaved(result);
  }
  return <form onSubmit={event => { event.preventDefault(); void save(); }}>
    <div className="form-grid"><div className="field"><label htmlFor="studio-default-timezone">Default timezone</label>
      <input id="studio-default-timezone" value={timezone} maxLength={100} disabled={write.locked} onChange={event => setTimezone(event.target.value)} required aria-describedby="studio-timezone-help" />
      <p id="studio-timezone-help" className="small muted">Use an IANA timezone, such as Africa/Cairo, or UTC. Link expiry inputs use your browser's local time.</p>
    </div><div className="field"><label htmlFor="studio-template-version">Default presentation template</label>
      <select id="studio-template-version" value={template} disabled={write.locked} onChange={event => setTemplate(event.target.value)}>
        {[...new Set([settings.template_version, '1.2.0', '1.1.0'])].map(version => <option key={version} value={version}>{version === '1.2.0' ? 'Everyone Film Editorial 1.2.0' : `Everyone Casting ${version}`}</option>)}
      </select></div></div>
    <dl className="connection-list"><div><dt>Default review access</dt><dd>30 days</dd></div>
      {Object.entries(settings.models).map(([name, model]) => <div key={name}><dt>{name.replaceAll('_', ' ')} model</dt><dd>{model}</dd></div>)}
    </dl>
    {write.error && <ErrorNotice message={write.error} />}
    <div className="action-row"><button className="button" type="submit" disabled={write.locked || !dirty || !timezone.trim()}>{write.busy ? 'Saving...' : 'Save defaults'}</button>
      {write.uncertain && <button className="button" type="button" disabled={write.busy} onClick={() => void save(true)}>Confirm same save</button>}
      <button className="button button-quiet" type="button" disabled={write.locked} onClick={onReload}>Reload saved defaults</button>
    </div>
  </form>;
}
