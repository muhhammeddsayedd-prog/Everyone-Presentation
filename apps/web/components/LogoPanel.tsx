'use client';

import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, mutation, type Workspace } from './api';
import { ErrorNotice } from './Feedback';
import { Icon } from './Icon';
import { logoTransferDestination } from '../lib/logo-transfer';

type Upload = { id: string; upload_url: string | null; upload_headers: Record<string, string> };

export function LogoPanel({ workspace, clientLogoAssetId, canWrite, canUpload, onSaved, onDirtyChange, projectName, clientName }: { workspace: Workspace; clientLogoAssetId: string | null; canWrite: boolean; canUpload: boolean; onSaved: (workspace: Workspace) => void; onDirtyChange: (dirty: boolean) => void; projectName?: string; clientName?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pendingPlacement, setPendingPlacement] = useState<Workspace['logo_placement'] | null>(null);
  const [availableClientLogo, setAvailableClientLogo] = useState<string | null>(null);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onDirtyChange(busy); return () => onDirtyChange(false); }, [busy, onDirtyChange]);
  useEffect(() => {
    if (!clientLogoAssetId || clientLogoAssetId === workspace.logo_asset_id) return;
    let current = true;
    api<{ status: string }>(`/api/v1/media/${clientLogoAssetId}`).then(result => {
      if (current) setAvailableClientLogo(result.data.status === 'ready' ? clientLogoAssetId : null);
    }).catch(() => { if (current) setAvailableClientLogo(null); });
    return () => { current = false; };
  }, [clientLogoAssetId, workspace.logo_asset_id]);

  async function patch(values: Partial<Workspace>) {
    const result = await api<Workspace>(`/api/v1/workspaces/${workspace.id}`, mutation('PATCH', { row_version: workspace.row_version, ...values }));
    if (mounted.current) onSaved(result.data);
  }

  async function upload(file: File) {
    setError(''); setStatus('');
    if (!canUpload) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Choose a PNG, JPEG or WebP logo. SVG and other file types are not supported.'); return; }
    if (file.size > 5 * 1024 * 1024 || file.size === 0) { setError('Choose a non-empty logo smaller than 5 MB.'); return; }
    setBusy(true);
    let uploadId: string | undefined;
    try {
      setStatus('Creating private upload…');
      const session = (await api<Upload>('/api/v1/uploads', mutation('POST', { workspace_id: workspace.id, purpose: 'client_logo', filename: file.name, mime_type: file.type, size_bytes: file.size }))).data;
      uploadId = session.id;
      if (!session.upload_url) throw new Error('This upload session is closed. Choose the file again to start a new upload.');
      const target = logoTransferDestination(session.upload_url, location.origin, session.id);
      setStatus('Uploading and checking logo…');
      const response = await fetch(target.url, { method: 'PUT', credentials: target.credentials, redirect: 'error', cache: 'no-store',
        referrerPolicy: 'no-referrer', headers: { ...session.upload_headers, 'Content-Type': file.type }, body: file });
      if (!response.ok) { const failure = await response.json().catch(() => null); throw new Error(failure?.error?.message ?? 'Logo upload failed. Please try again.'); }
      if (!mounted.current) { await api(`/api/v1/uploads/${session.id}/cancel`, mutation('POST', {})); return; }
      const completion = (await api<{ asset: { id: string } }>(`/api/v1/uploads/${session.id}/complete`, mutation('POST', { actual_size_bytes: file.size, start_processing: false }))).data;
      if (!mounted.current) return;
      await patch({ logo_asset_id: completion.asset.id }); setStatus('Logo saved');
    } catch (reason) {
      if (mounted.current) { setError(errorMessage(reason)); setStatus(''); }
      if (uploadId) await api(`/api/v1/uploads/${uploadId}/cancel`, mutation('POST', {})).catch(() => undefined);
    } finally { if (mounted.current) { setBusy(false); if (input.current) input.current.value = ''; } }
  }

  async function change(values: Partial<Workspace>) {
    if (values.logo_placement) setPendingPlacement(values.logo_placement);
    setBusy(true); setError(''); setStatus('Saving branding…');
    try { await patch(values); setPendingPlacement(null); setStatus('Branding saved'); }
    catch (reason) { setError(errorMessage(reason)); setStatus(''); }
    finally { setBusy(false); }
  }
  async function reloadBranding() {
    setBusy(true);
    try { onSaved((await api<Workspace>(`/api/v1/workspaces/${workspace.id}`)).data); setPendingPlacement(null); setError(''); setStatus('Saved branding reloaded'); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  const placement = pendingPlacement ?? workspace.logo_placement;
  const offerClientLogo = clientLogoAssetId && availableClientLogo === clientLogoAssetId && clientLogoAssetId !== workspace.logo_asset_id;
  return <section className="panel" aria-labelledby="client-branding-heading">
    <header className="panel-header"><h2 id="client-branding-heading">Client branding</h2><span className="small muted">Optional</span></header>
    <div className="panel-body stack-lg">
      <figure className="cover-preview" aria-label="Live cover preview">
        <div className="cover-preview-top">{workspace.logo_asset_id ? <img className="cover-preview-logo" src={`/api/v1/media/${workspace.logo_asset_id}/content`} alt="Selected client logo" /> : <div className="logo-missing"><Icon name="image" /><span>No client logo selected</span></div>}<img className="cover-preview-brand" src="/brand/everyone-logotype.svg" alt="" /></div>
        <div className="cover-preview-title"><span>{workspace.active_output === 'shortlist' ? 'Cast Shortlist' : 'Cast Selection'}{clientName ? ` · ${clientName}` : ''}</span><strong>{projectName ?? 'Casting presentation'}</strong></div>
        <figcaption className="preview-label">Live cover preview</figcaption>
      </figure>
      <div className="logo-file-row"><div><label className="field-label" htmlFor="client-logo">Client logo</label><p className="small muted">PNG, JPEG or WebP · up to 5 MB. Aspect ratio and transparency are preserved.</p></div>
        <input ref={input} id="client-logo" className="file-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || !canUpload} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
        <div className="button-row"><button className="button" disabled={busy || !canUpload} onClick={() => input.current?.click()}><Icon name="upload" />{workspace.logo_asset_id ? 'Replace logo' : 'Upload logo'}</button>{workspace.logo_asset_id && <button className="button button-quiet" disabled={busy || !canWrite} onClick={() => change({ logo_asset_id: null })}>Remove</button>}</div></div>
      {canWrite && !canUpload && <p className="permission-note"><Icon name="lock" />Logo uploads are not available yet. You can continue without a logo.</p>}
      <fieldset className="logo-placement" disabled={busy || !canWrite}><legend>Logo appears on</legend><div className="segmented"><label><input type="radio" name="logo-placement" checked={placement === 'cover'} onChange={() => change({ logo_placement: 'cover' })} />Cover only</label><label><input type="radio" name="logo-placement" checked={placement === 'every_slide'} onChange={() => change({ logo_placement: 'every_slide' })} />Every slide</label></div></fieldset>
      {offerClientLogo && <div className="notice notice-info"><p>The client already has a shared logo in Everyone. Use it instead of a separate upload.</p><button className="button button-small" disabled={busy || !canWrite} onClick={() => change({ logo_asset_id: clientLogoAssetId })}>Use client logo</button></div>}
      <p className="small muted">Removing the selection keeps the original asset. This does not replace a shared client logo.</p>
      {status && <p className="save-state" data-state="saved" role="status" aria-live="polite">{status}</p>}
      {error && <><ErrorNotice message={error} /><div className="button-row">{pendingPlacement && <button className="button" disabled={busy || !canWrite} onClick={() => change({ logo_placement: pendingPlacement })}>Retry branding</button>}<button className="button button-quiet" disabled={busy} onClick={reloadBranding}>Reload saved branding</button></div></>}
    </div>
  </section>;
}
