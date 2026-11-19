'use client';

import { useId, useState } from 'react';
import { api, errorMessage, mutation } from './api';

/** A template 1.4.0/1.4.1 presentation note on a role or slot: the highlighted "Note:" printed on that role's last page
 * (or the page with the slot's last person). Saved on its own with the record's row_version; empty clears it. */
export function PresentationNoteField<T extends { id: string; row_version: number; presentation_note?: string | null }>({ record, path, label, canWrite, onSaved }: {
  record: T; path: string; label: string; canWrite: boolean; onSaved: (value: T) => void;
}) {
  const id = useId(); const saved = record.presentation_note ?? '';
  const [value, setValue] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  // Servers before m18 do not report the note; the field is then hidden rather than guessed.
  if (!Object.hasOwn(record, 'presentation_note')) return null;
  const shown = value ?? saved; const dirty = value !== null && value.trim() !== saved.trim();
  async function save(next: string | null) {
    setBusy(true); setError('');
    try { const result = (await api<T>(path, { ...mutation('PATCH', { row_version: record.row_version, presentation_note: next }), signal: AbortSignal.timeout(20_000) })).data;
      if (result.id !== record.id || (result.presentation_note ?? null) !== next) throw new Error('The saved note could not be confirmed. Reload and try again.');
      setValue(null); onSaved(result);
    } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); }
  }
  return <form className="field presentation-note-field" onSubmit={event => { event.preventDefault(); void save(shown.trim() || null); }}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type="text" maxLength={500} value={shown} readOnly={!canWrite || busy} placeholder="No note" dir="auto" onChange={event => setValue(event.target.value)} />
    <span className="small muted">Printed highlighted on the presentation page (templates 1.4.0 and 1.4.1). Leave empty for no note.</span>
    {canWrite && <span className="button-row"><button className="button button-small" type="submit" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save note'}</button>
      {saved && <button className="button button-small button-quiet" type="button" disabled={busy} onClick={() => { setValue(''); void save(null); }}>Remove note</button>}</span>}
    {error && <span className="small" role="alert">{error}</span>}
  </form>;
}
