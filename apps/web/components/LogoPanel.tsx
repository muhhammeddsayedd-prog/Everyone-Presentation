'use client';

import { useEffect, useRef, useState } from 'react';
import { useDraftValue } from './workspace/WorkspaceDraftProvider';
import { draftKey } from './workspace/draft-review';
import { ApiError, api, errorMessage, mutation, type Workspace } from './api';
import { ErrorNotice } from './Feedback';
import { Icon } from './Icon';
import { captureLogoUpload, finishLogoUpload, logoRecoveryKey, parseLogoUpload, LogoSelectionConflict, type LogoUploadIntent } from './logo-upload-recovery';
import { SegmentIndicator } from './motion/SegmentIndicator';

export function LogoPanel({ actorId, workspace, clientLogoAssetId, canWrite, canUpload, onSaved, onDirtyChange, projectName, clientName }: { actorId: string; workspace: Workspace; clientLogoAssetId: string | null; canWrite: boolean; canUpload: boolean; onSaved: (workspace: Workspace) => void; onDirtyChange: (dirty: boolean) => void; projectName?: string; clientName?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pendingPlacement, setPendingPlacement] = useState<Workspace['logo_placement'] | null>(null);
  const [availableClientLogo, setAvailableClientLogo] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Pick<LogoUploadIntent, 'stage' | 'transferAttempted'> | null>(null);
  const hasUpload = uploadProgress !== null;
  const closedUpload = uploadProgress?.stage === 'closed';
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [selectionConflict, setSelectionConflict] = useState<'reload' | 'choose' | null>(null);
  const request = useRef<LogoUploadIntent | null>(null);
  const selectedFile = useRef<File | undefined>(undefined);
  const running = useRef(false);
  const recoveryKey = logoRecoveryKey(actorId, workspace.id);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    try {
      request.current = parseLogoUpload(sessionStorage.getItem(recoveryKey), actorId, workspace.id);
      setUploadProgress(request.current ? { stage: request.current.stage, transferAttempted: request.current.transferAttempted } : null);
      if (request.current) setStatus('A stored logo upload is kept in this tab. Check and resume to finish it.');
      setRecoveryReady(true);
    } catch (reason) { setError(errorMessage(reason)); }
  }, [recoveryKey, actorId, workspace.id]);
  useEffect(() => { onDirtyChange(busy || hasUpload); return () => onDirtyChange(false); }, [busy, hasUpload, onDirtyChange]);
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

  function checkpoint(intent: LogoUploadIntent) {
    const previous = parseLogoUpload(sessionStorage.getItem(recoveryKey), actorId, workspace.id);
    if (previous && previous.reserve.key !== intent.reserve.key) throw new Error('Another stored logo upload needs to be resolved first.');
    const serialized = JSON.stringify(intent); parseLogoUpload(serialized, actorId, workspace.id);
    sessionStorage.setItem(recoveryKey, serialized);
    if (sessionStorage.getItem(recoveryKey) !== serialized) throw new Error('Logo progress could not be kept in this tab. No further request was sent.');
    request.current = intent;
    if (mounted.current) { setUploadProgress({ stage: intent.stage, transferAttempted: intent.transferAttempted }); }
  }
  function clearUpload() {
    const saved = parseLogoUpload(sessionStorage.getItem(recoveryKey), actorId, workspace.id);
    if (saved && saved.reserve.key !== request.current?.reserve.key) throw new Error('Another stored logo upload needs to be resolved first.');
    sessionStorage.removeItem(recoveryKey);
    if (sessionStorage.getItem(recoveryKey) !== null) throw new Error('The saved logo progress could not be cleared.');
    request.current = null; selectedFile.current = undefined;
    if (mounted.current) { setUploadProgress(null); setSelectionConflict(null); if (input.current) input.current.value = ''; }
  }
  async function finish(file?: File, useCurrentBranding = false) {
    if (!canUpload || !recoveryReady || running.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      if (!request.current) {
        if (!file) return;
        request.current = await captureLogoUpload(actorId, workspace, file); checkpoint(request.current);
      }
      if (file) selectedFile.current = file;
      const saved = await finishLogoUpload(request.current, { json: api<unknown>, put: (url, init) => fetch(url, init), origin: location.origin, checkpoint,
        active: () => mounted.current,
        stage: stage => { if (mounted.current) setStatus({ reserving: 'Creating a private upload.', uploading: 'Uploading logo.', verifying: 'Checking stored logo.', selecting: 'Applying verified logo.', closed: 'This stored upload is closed.' }[stage]); }
      }, selectedFile.current, useCurrentBranding ? workspace : undefined);
      clearUpload();
      if (mounted.current) { onSaved(saved); setStatus('Logo saved'); }
    } catch (reason) {
      if (mounted.current) {
        setError(errorMessage(reason));
        if (reason instanceof LogoSelectionConflict || reason instanceof ApiError && reason.code === 'STALE_RESOURCE_VERSION') setSelectionConflict('reload');
        setStatus(request.current ? 'Your stored logo is kept. Check and resume to finish it.' : '');
      }
    } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  async function upload(file: File) {
    setError(''); setStatus('');
    if (!canUpload || running.current || request.current?.transferAttempted) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Choose a PNG, JPEG or WebP logo. SVG and other file types are not supported.'); return; }
    if (file.size > 5 * 1024 * 1024 || file.size === 0) { setError('Choose a non-empty logo smaller than 5 MB.'); return; }
    await finish(file);
  }
  function forgetClosedUpload() {
    if (request.current?.stage !== 'closed') return;
    try { clearUpload(); setError(''); setStatus('Choose another logo. Any stored original is kept.'); }
    catch (reason) { setError(errorMessage(reason)); }
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
    try { onSaved((await api<Workspace>(`/api/v1/workspaces/${workspace.id}`)).data); setPendingPlacement(null); setError(''); if (selectionConflict) setSelectionConflict('choose'); setStatus('Saved branding reloaded'); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  const placement = pendingPlacement ?? workspace.logo_placement;
  useDraftValue(draftKey.logoPlacement, placement, placement !== workspace.logo_placement);
  const offerClientLogo = clientLogoAssetId && availableClientLogo === clientLogoAssetId && clientLogoAssetId !== workspace.logo_asset_id;
  return <section className="panel" aria-labelledby="client-branding-heading" data-draft-focus="cover">
    <header className="panel-header"><h2 id="client-branding-heading">Client branding</h2><span className="small muted">Optional</span></header>
    <div className="panel-body stack-lg">
      <figure className="cover-preview" aria-label="Live cover preview">
        <div className="cover-preview-top">{workspace.logo_asset_id ? <img className="cover-preview-logo" src={`/api/v1/media/${workspace.logo_asset_id}/content`} alt="Selected client logo" /> : <div className="logo-missing"><Icon name="image" /><span>No client logo selected</span></div>}<img className="cover-preview-brand" src="/brand/everyone-logotype.svg" alt="" /></div>
        <div className="cover-preview-title"><span>{workspace.active_output === 'shortlist' ? 'Cast Shortlist' : 'Cast Selection'}{clientName ? ` · ${clientName}` : ''}</span><strong>{projectName ?? 'Casting presentation'}</strong></div>
        <figcaption className="preview-label">Live cover preview</figcaption>
      </figure>
      <div className="logo-file-row"><div><label className="field-label" htmlFor="client-logo">Client logo</label><p className="small muted">PNG, JPEG or WebP · up to 5 MB. Aspect ratio and transparency are preserved.</p></div>
        <input ref={input} id="client-logo" className="file-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || !canUpload || !recoveryReady || Boolean(uploadProgress?.transferAttempted)} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
        <div className="button-row"><button className="button" disabled={busy || !canUpload || !recoveryReady || Boolean(uploadProgress?.transferAttempted)} onClick={() => input.current?.click()}><Icon name="upload" />{hasUpload ? 'Select original logo' : workspace.logo_asset_id ? 'Replace logo' : 'Upload logo'}</button>{workspace.logo_asset_id && !hasUpload && <button className="button button-quiet" disabled={busy || !canWrite} onClick={() => change({ logo_asset_id: null })}>Remove</button>}</div></div>
      {hasUpload && <div className="notice notice-info"><p>The stored file is kept while you finish checking and applying this logo.</p><div className="button-row">
        {!closedUpload && !selectionConflict && <button className="button" disabled={busy || !canUpload} onClick={() => void finish()}>Check and resume logo</button>}
        {selectionConflict === 'choose' && <button className="button" disabled={busy || !canUpload} onClick={() => void finish(undefined, true)}>Use verified logo with current branding</button>}
        {closedUpload && <button className="button" disabled={busy} onClick={forgetClosedUpload}>Choose another logo</button>}
      </div></div>}
      {canWrite && !canUpload && <p className="permission-note"><Icon name="lock" />Logo uploads are not available yet. You can continue without a logo.</p>}
      <fieldset className="logo-placement" disabled={busy || hasUpload || !canWrite}><legend>Logo appears on</legend><div className="segmented"><SegmentIndicator /><label><input type="radio" name="logo-placement" checked={placement === 'cover'} onChange={() => change({ logo_placement: 'cover' })} />Cover only</label><label><input type="radio" name="logo-placement" checked={placement === 'every_slide'} onChange={() => change({ logo_placement: 'every_slide' })} />Every slide</label></div></fieldset>
      {offerClientLogo && <div className="notice notice-info"><p>The client already has a shared logo in Everyone. Use it instead of a separate upload.</p><button className="button button-small" disabled={busy || hasUpload || !canWrite} onClick={() => change({ logo_asset_id: clientLogoAssetId })}>Use client logo</button></div>}
      <p className="small muted">Removing the selection keeps the original asset. This does not replace a shared client logo.</p>
      {status && <p className="save-state" data-state="saved" role="status" aria-live="polite">{status}</p>}
      {error && <><ErrorNotice message={error} /><div className="button-row">{pendingPlacement && <button className="button" disabled={busy || !canWrite} onClick={() => change({ logo_placement: pendingPlacement })}>Retry branding</button>}<button className="button button-quiet" disabled={busy} onClick={reloadBranding}>Reload saved branding</button></div></>}
    </div>
  </section>;
}
