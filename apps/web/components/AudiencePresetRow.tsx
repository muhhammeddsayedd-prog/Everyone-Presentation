'use client';

import { useState } from 'react';
import { api, errorMessage, mutation, type AudiencePreset } from './api';
import { ErrorNotice } from './Feedback';

export function AudiencePresetRow({ preset, canManage, onChanged }: { preset: AudiencePreset; canManage: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(preset.label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(archive = false) {
    setBusy(true); setError('');
    try {
      await api(`/api/v1/audience-presets/${preset.id}${archive ? '/archive' : ''}`, mutation(archive ? 'POST' : 'PATCH', { row_version: preset.row_version, ...(archive ? {} : { label: label.trim() }) }));
      setEditing(false); onChanged();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <div className="preset-entry"><div className="preset-row"><div>{editing ? <label className="field">Audience label<input value={label} maxLength={100} onChange={event => setLabel(event.target.value)} /></label> : <h3>{preset.label}</h3>}<span className="small muted">{['internal_production', 'agency', 'client'].includes(preset.key) ? 'Default preset' : 'Custom preset'}</span></div><div className="preset-actions"><span className="badge">{preset.scope === 'internal' ? 'Internal' : 'External'}</span>{canManage && (editing ? <><button className="button button-small" disabled={busy || !label.trim()} onClick={() => save()}>{busy ? 'Saving…' : 'Save label'}</button><button className="button button-small button-quiet" disabled={busy} onClick={() => { setEditing(false); setLabel(preset.label); }}>Cancel</button></> : <><button className="button button-small button-quiet" onClick={() => setEditing(true)} aria-label={`Edit ${preset.label}`}>Edit</button><button className="button button-small button-quiet" disabled={busy} onClick={() => save(true)} aria-label={`Archive ${preset.label}`}>Archive</button></>)}</div></div>{error && <ErrorNotice message={error} retry={onChanged} />}</div>;
}
