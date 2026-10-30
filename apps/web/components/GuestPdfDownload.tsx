'use client';

import { useEffect, useRef, useState } from 'react';
import type { ExportPreparation, ExternalPresentationVersion, GuestBrowserAccess, PresentationExport } from '../../../packages/domain/src/guest-types';
import type { PdfDownload } from '@eps/domain';
import { ErrorNotice } from './Feedback';
import { reviewError, reviewRequest, sameOriginReviewUrl, useReviewMutation } from './review-client';
import { GUEST_PDF_DOWNLOAD_ERROR, guestPdfFilename, readGuestPdfResponse } from './guest-pdf-transfer';

export function GuestPdfDownload({ version, access, onStateChange }: { version: ExternalPresentationVersion; access: GuestBrowserAccess; onStateChange: (locked: boolean) => void }) {
  const [exported, setExported] = useState<PresentationExport | null>(null), [download, setDownload] = useState('');
  const [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [transferring, setTransferring] = useState(false), [transferError, setTransferError] = useState('');
  const alive = useRef(false), transfer = useRef<AbortController | null>(null), sending = useRef(false);
  const blobUrl = useRef<{ value: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const context = access.guest_session_id, write = useReviewMutation(context);
  const exportId = exported?.id;
  const cancelled = exported?.status === 'failed' && exported.failure_code === 'JOB_CANCELLED';
  useEffect(() => { onStateChange(write.locked || transferring); }, [onStateChange, write.locked, transferring]);
  useEffect(() => () => onStateChange(false), [onStateChange]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; transfer.current?.abort();
      if (blobUrl.current) { clearTimeout(blobUrl.current.timer); URL.revokeObjectURL(blobUrl.current.value); blobUrl.current = null; }
    };
  }, []);
  async function savePdf() {
    if (sending.current || write.locked || !download || !exportId || !access.download_enabled) return;
    const controller = new AbortController(); transfer.current = controller; sending.current = true;
    setTransferring(true); setTransferError('');
    try {
      const response = await fetch(download, { method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
        headers: { 'X-Review-Context': context, 'X-EPS-Review-Browser': '1' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]) });
      const blob = await readGuestPdfResponse(response); if (!alive.current) return;
      if (blobUrl.current) { clearTimeout(blobUrl.current.timer); URL.revokeObjectURL(blobUrl.current.value); }
      const value = URL.createObjectURL(blob);
      blobUrl.current = { value, timer: setTimeout(() => { URL.revokeObjectURL(value); if (blobUrl.current?.value === value) blobUrl.current = null; }, 60000) };
      const anchor = document.createElement('a'); anchor.href = value; anchor.download = guestPdfFilename(exportId); anchor.hidden = true;
      document.body.append(anchor); try { anchor.click(); } finally { anchor.remove(); }
    } catch { if (alive.current) setTransferError(GUEST_PDF_DOWNLOAD_ERROR); }
    finally { sending.current = false; transfer.current = null; if (alive.current) setTransferring(false); }
  }
  function accepted(value: ExportPreparation | undefined) {
    if (!value) return;
    if (value.export.version_id !== version.id) { setError('The PDF response could not be confirmed for the viewed version.'); return; }
    setExported(value.export); setError(''); setRefresh(value => value + 1);
  }
  async function prepare() { setDownload(''); accepted(await write.send<ExportPreparation>(`/api/v1/review/versions/${version.id}/pdf-exports`, 'POST')); }
  useEffect(() => {
    if (!exportId || !access.download_enabled) return;
    let current = true, timer: ReturnType<typeof setTimeout> | undefined; const controller = new AbortController();
    const poll = async () => {
      try {
        const result = (await reviewRequest<PresentationExport>(`/api/v1/review/pdf-exports/${exportId}`, context, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })).data;
        if (result.id !== exportId || result.version_id !== version.id) throw new Error('The PDF response could not be confirmed for this version.');
        if (!current) return;
        setExported(result);
        if (result.status === 'ready') {
          const file = (await reviewRequest<PdfDownload>(`/api/v1/review/pdf-exports/${result.id}/download`, context, { method: 'POST', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })).data;
          if (file.version_id !== version.id) throw new Error('The PDF download belongs to another version.');
          const url = sameOriginReviewUrl(file.download_url, `/api/v1/review/pdf-exports/${result.id}/content`, context);
          if (current) { setDownload(url); setError(''); }
        } else if (result.status !== 'failed') timer = setTimeout(() => void poll(), 2500);
      } catch (reason) { if (current) { setDownload(''); setError(reviewError(reason)); } }
    }; void poll(); return () => { current = false; controller.abort(); if (timer) clearTimeout(timer); };
  }, [exportId, version.id, context, access.download_enabled, refresh]);
  if (!access.download_enabled) return <p className="small muted">PDF downloads are disabled for this link.</p>;
  return <div className="guest-pdf-control">
    {cancelled ? <p className="small" role="status">PDF preparation was cancelled.</p> : download ? <a className="button button-primary" href={download} download aria-disabled={transferring || write.locked} aria-busy={transferring} onClick={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); void savePdf();
    }}>{transferring ? 'Downloading PDF…' : 'Download guest PDF'}</a> : <button className="button button-primary" disabled={write.locked || !!exported && ['queued', 'rendering'].includes(exported.status) && !error} onClick={() => void prepare()}>{write.busy ? 'Preparing PDF…' : exported?.status === 'failed' ? 'Retry PDF preparation' : exported && exported.status !== 'ready' ? 'Preparing PDF…' : 'Prepare PDF'}</button>}
    {write.error && <ErrorNotice message={write.error} />}{error && <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} />}
    {transferError && <ErrorNotice message={transferError} retry={() => void savePdf()} />}
    {write.uncertain && <button className="button" disabled={write.busy} onClick={async () => accepted(await write.send<ExportPreparation>())}>Confirm PDF request</button>}
    {exported?.status === 'failed' && !cancelled && <p className="small" role="status">PDF preparation failed. Retry uses this saved version.</p>}
    {exported && ['queued', 'rendering'].includes(exported.status) && <p role="status" className="small">Preparing this version’s PDF. You can continue reviewing.</p>}
  </div>;
}
