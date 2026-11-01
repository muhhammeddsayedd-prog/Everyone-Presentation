'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { api, ApiError, errorMessage, type Project } from './api';
import { ErrorNotice, Loading } from './Feedback';
import type { PresentationType } from './project-presentation';
import { Drawer } from './ui/Overlay';
import { useConfirm } from './ui/Confirm';
import { clearProjectCreateIntent, persistProjectCreateIntent, type ProjectCreateIntent } from '../lib/project-create-intent';

type Client = { id: string; name: string; row_version: number };
export function NewProject({ actorId, pendingIntent, onClose, onCreated, onDirtyChange }: { actorId: string; pendingIntent: ProjectCreateIntent | null; onClose: () => void; onCreated: (project: Project) => void; onDirtyChange: (dirty: boolean) => void }) {
  const id = useId(); const confirm = useConfirm();
  const [name, setName] = useState(pendingIntent?.body.name ?? ''), [type, setType] = useState<string>(pendingIntent?.body.presentation_type ?? 'casting'), [clientId, setClientId] = useState(pendingIntent?.body.client_id ?? '');
  const [types, setTypes] = useState<PresentationType[] | null>(null), [typesError, setTypesError] = useState(''), [refresh, setRefresh] = useState(0);
  const [clients, setClients] = useState<Client[]>([]), [clientQuery, setClientQuery] = useState(''), [clientCursor, setClientCursor] = useState<string | null>(null);
  const [clientsError, setClientsError] = useState(''), [clientsBusy, setClientsBusy] = useState(false);
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(Boolean(pendingIntent)), [error, setError] = useState('');
  const intent = useRef<ProjectCreateIntent | null>(pendingIntent), active = useRef(false), mounted = useRef(true);
  const chosen = types?.find(item => item.key === type); const dirty = Boolean(name || clientId || type !== 'casting' || busy || uncertain);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    let current = true;
    api<PresentationType[]>('/api/v1/presentation-types').then(result => {
      if (!Array.isArray(result.data) || !result.data.length || result.data.some(item => !item || typeof item.key !== 'string' || typeof item.label !== 'string' || !['available', 'planned'].includes(item.status))) throw new Error('Presentation types could not be confirmed.');
      if (current) { setTypes(result.data); setTypesError(''); }
    }).catch(reason => { if (current) setTypesError(errorMessage(reason)); });
    return () => { current = false; };
  }, [refresh]);
  useEffect(() => {
    let current = true; const controller = new AbortController();
    const timer = setTimeout(() => {
      setClientsBusy(true);
      api<Client[]>(`/api/v1/clients?q=${encodeURIComponent(clientQuery)}&limit=25`, { signal: controller.signal }).then(result => {
        if (current) { setClients(previous => { const selected = previous.find(item => item.id === clientId); return selected && !result.data.some(item => item.id === selected.id) ? [selected, ...result.data] : result.data; }); setClientCursor(result.page?.next_cursor ?? null); setClientsError(''); }
      }).catch(reason => { if (current) setClientsError(errorMessage(reason)); }).finally(() => { if (current) setClientsBusy(false); });
    }, 180);
    return () => { current = false; controller.abort(); clearTimeout(timer); };
  }, [clientQuery, clientId, refresh]);
  async function moreClients() {
    if (!clientCursor || clientsBusy) return; setClientsBusy(true);
    try { const result = await api<Client[]>(`/api/v1/clients?q=${encodeURIComponent(clientQuery)}&limit=25&cursor=${encodeURIComponent(clientCursor)}`); if (mounted.current) { setClients(previous => [...new Map([...previous, ...result.data].map(item => [item.id, item])).values()]); setClientCursor(result.page?.next_cursor ?? null); setClientsError(''); } }
    catch (reason) { if (mounted.current) setClientsError(errorMessage(reason)); }
    finally { if (mounted.current) setClientsBusy(false); }
  }
  async function close() {
    if (active.current || uncertain) return;
    if (dirty && !await confirm({ title: 'Discard this new project?', description: 'The details you entered have not been saved.', confirmLabel: 'Discard details', cancelLabel: 'Keep editing', danger: true })) return;
    onClose();
  }
  async function create() {
    if (active.current || !intent.current && (!name.trim() || !chosen)) return;
    let request: ProjectCreateIntent;
    try { request = persistProjectCreateIntent(actorId, intent.current ?? { key: crypto.randomUUID(), body: { name: name.trim(), presentation_type: type, ...(clientId ? { client_id: clientId } : {}) } }); }
    catch (reason) { setError(`The request was not sent. ${errorMessage(reason)}`); return; }
    intent.current = request; active.current = true; setBusy(true); setError('');
    try {
      const result = await api<Project>('/api/v1/projects', { method: 'POST', body: JSON.stringify(request.body), headers: { 'Idempotency-Key': request.key }, signal: AbortSignal.timeout(30000) });
      if (!result.data || typeof result.data.id !== 'string' || !result.data.id || result.data.name !== request.body.name || result.data.presentation_type !== request.body.presentation_type || result.data.client_id !== (request.body.client_id ?? null)) throw new Error('The created project could not be confirmed.');
      if (!clearProjectCreateIntent(actorId, request.key)) {
        if (mounted.current) { setUncertain(true); setError('The project is saved, but this tab could not clear its recovery record. Confirm this saved request again when tab storage is available.'); }
        return;
      }
      intent.current = null;
      if (mounted.current) { setUncertain(false); onDirtyChange(false); onCreated(result.data); }
    } catch (reason) {
      if (reason instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(reason.status)) {
        const cleared = clearProjectCreateIntent(actorId, request.key); if (cleared) intent.current = null;
        if (mounted.current) { setUncertain(!cleared); setError(`${errorMessage(reason)}${cleared ? '' : ' The request was rejected, but its tab recovery record could not be cleared. Confirm it again when tab storage is available.'}`); }
      } else if (mounted.current) { setUncertain(true); setError('The create request could not be confirmed. Confirm the same request to find its saved result before creating another project.'); }
    } finally { active.current = false; if (mounted.current) setBusy(false); }
  }
  return <Drawer title="New project" description="Create a shared Everyone project, then prepare its presentation." onClose={() => void close()} busy={busy || uncertain}>
    <form className="stack-lg" onSubmit={event => { event.preventDefault(); void create(); }}>
      {uncertain && <p className="notice" role="status">An earlier create request needs confirmation. Its details are retained; confirm the same request to check its saved result.</p>}
      <div className="field"><label htmlFor={`${id}-name`}>Project name</label><input id={`${id}-name`} data-autofocus value={name} maxLength={500} required disabled={busy || uncertain} onChange={event => setName(event.target.value)} /></div>
      <div className="field"><label htmlFor={`${id}-type`}>Presentation type</label>{types ? <select id={`${id}-type`} value={type} disabled={busy || uncertain} onChange={event => setType(event.target.value)}>{types.map(item => <option key={item.key} value={item.key}>{item.label}{item.status === 'planned' ? ' · Planned' : ''}</option>)}</select> : !typesError && <Loading label="Loading presentation types…" />}
        {chosen?.status === 'planned' && <p className="field-hint">The project can be created now. {chosen.label} preparation and generation are Planned.</p>}</div>
      {typesError && <ErrorNotice message={typesError} retry={() => setRefresh(value => value + 1)} />}
      <fieldset className="stack" disabled={busy || uncertain}><legend>Client (optional)</legend>
        <div className="field"><label htmlFor={`${id}-search`}>Find an existing client</label><input id={`${id}-search`} type="search" value={clientQuery} onChange={event => setClientQuery(event.target.value)} /></div>
        <div className="field"><label htmlFor={`${id}-client`}>Shared client</label><select id={`${id}-client`} value={clientId} onChange={event => setClientId(event.target.value)}><option value="">No client</option>{clientId && !clients.some(item => item.id === clientId) && <option value={clientId}>Previously selected client</option>}{clients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        {clientsBusy && <p className="small muted" role="status">Finding permitted clients…</p>}{clientCursor && <button type="button" className="button button-small" disabled={clientsBusy} onClick={() => void moreClients()}>Load more clients</button>}
        {clientsError && <ErrorNotice message={clientsError} retry={() => setRefresh(value => value + 1)} />}<p className="small muted">Choose an existing client your account may use, or leave this project without one.</p>
      </fieldset>
      {error && <ErrorNotice message={error} />}
      <div className="button-row"><button className="button button-primary" disabled={busy || !uncertain && (!name.trim() || !chosen)}>{busy ? 'Confirming project…' : uncertain ? 'Confirm create request' : 'Create project'}</button><button type="button" className="button button-quiet" disabled={busy || uncertain} onClick={() => void close()}>Cancel</button></div>
    </form>
  </Drawer>;
}
