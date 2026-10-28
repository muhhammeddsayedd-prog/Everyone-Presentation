'use client';

import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, mutation, type Workspace } from './api';
import { ErrorNotice } from './Feedback';
import { Icon } from './Icon';

type Upload = { id: string; upload_url: string | null; upload_headers: Record<string, string> };

export function LogoPanel({ workspace, canWrite, canUpload, onSaved, onDirtyChange }: { workspace: Workspace; canWrite: boolean; canUpload: boolean; onSaved: (workspace: Workspace) => void; onDirtyChange: (dirty: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pendingPlacement, setPendingPlacement] = useState<Workspace['logo_placement'] | null>(null);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onDirtyChange(busy); return () => onDirtyChange(false); }, [busy, onDirtyChange]);

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
      const target = new URL(session.upload_url, location.origin);
      if (target.origin !== location.origin || !target.pathname.startsWith('/api/dev/uploads/')) throw new Error('The development upload destination is unavailable.');
      setStatus('Uploading and checking logo…');
      const response = await fetch(target, { method: 'PUT', headers: { ...session.upload_headers, 'Content-Type': file.type }, body: file });
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

  return <section className="editor-section"><div className="section-heading"><div><h2>Client branding</h2><p>Choose the logo used in this presentation workspace.</p></div><span className="small muted">Optional</span></div><div className="branding-grid"><div className="logo-preview">{workspace.logo_asset_id ? <img src={`/api/v1/media/${workspace.logo_asset_id}/content`} alt="Selected client logo" /> : <div className="logo-missing"><Icon name="slides" /><span>No client logo selected</span></div>}<span className="preview-label">Cover background</span></div><div className="branding-controls"><label className="field-label" htmlFor="client-logo">Client logo</label><p className="small muted">PNG, JPEG or WebP · up to 5 MB.<br />Aspect ratio and transparency are preserved.</p><input ref={input} id="client-logo" className="file-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || !canUpload} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} /><div className="button-row"><button className="button" disabled={busy || !canUpload} onClick={() => input.current?.click()}><Icon name="upload" />{workspace.logo_asset_id ? 'Replace logo' : 'Upload logo'}</button>{workspace.logo_asset_id && <button className="button button-quiet" disabled={busy || !canWrite} onClick={() => change({ logo_asset_id: null })}>Remove</button>}</div>{canWrite && !canUpload && <p className="small muted">Logo uploads are not available yet. You can continue without a logo.</p>}<fieldset disabled={busy || !canWrite}><legend>Logo placement</legend><label className="radio-line"><input type="radio" name="logo-placement" checked={(pendingPlacement ?? workspace.logo_placement) === 'cover'} onChange={() => change({ logo_placement: 'cover' })} />Cover only</label><label className="radio-line"><input type="radio" name="logo-placement" checked={(pendingPlacement ?? workspace.logo_placement) === 'every_slide'} onChange={() => change({ logo_placement: 'every_slide' })} />Every slide</label></fieldset><p className="small muted">Removing the selection keeps the original asset. This does not replace a shared client logo.</p></div></div>{status && <p className="save-state" role="status" aria-live="polite">{status}</p>}{error && <><ErrorNotice message={error} /><div className="button-row">{pendingPlacement && <button className="button" disabled={busy || !canWrite} onClick={() => change({ logo_placement: pendingPlacement })}>Retry branding</button>}<button className="button button-quiet" disabled={busy} onClick={reloadBranding}>Reload saved branding</button></div></>}</section>;
}
