'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReviewLink, ReviewLinkCreated } from '../../../packages/domain/src/guest-types';
import { api, type Actor, type Envelope } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { reviewError, sameOriginReviewUrl, useReviewMutation } from './review-client';
import { reviewLinkLocalExpiry } from './review-link-expiry';
import { StudioDateTime } from './StudioTimeZone';

interface Props { seriesId: string; workspaceId: string; actor: Actor; onDirtyChange: (value: boolean) => void }
export function ReviewLinksPanel(props: Props) { return <LinksScope key={`${props.actor.id}:${props.seriesId}`} {...props} />; }
function LinksScope({ seriesId, workspaceId, actor, onDirtyChange }: Props) {
  const [links, setLinks] = useState<ReviewLink[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [label, setLabel] = useState(''), [expiry, setExpiry] = useState(''), [downloads, setDownloads] = useState(true);
  const [editing, setEditing] = useState<ReviewLink | null>(null), [created, setCreated] = useState<{ id: string; url: string } | null>(null);
  const [notice, setNotice] = useState(''), [refresh, setRefresh] = useState(0);
  const [observedNow, setObservedNow] = useState(0);
  const [confirmation, setConfirmation] = useState<{ link: ReviewLink; action: 'rotate' | 'revoke' } | null>(null);
  const confirmationCancel = useRef<HTMLButtonElement>(null), confirmationTrigger = useRef<HTMLButtonElement | null>(null);
  const panelHeading = useRef<HTMLHeadingElement>(null), restoreFocus = useRef(false);
  const pendingAction = useRef(''), write = useReviewMutation();
  const locked = write.locked || confirmation !== null;
  const canManage = actor.capabilities?.includes('review_links.manage');
  useEffect(() => { const timer = setInterval(() => setObservedNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { onDirtyChange(locked); return () => onDirtyChange(false); }, [onDirtyChange, locked]);
  useEffect(() => {
    if (confirmation) confirmationCancel.current?.focus();
    else if (restoreFocus.current && !write.locked) {
      restoreFocus.current = false;
      if (confirmationTrigger.current?.isConnected && !confirmationTrigger.current.disabled) confirmationTrigger.current.focus();
      else panelHeading.current?.focus();
    }
  }, [confirmation, write.locked]);
  useEffect(() => {
    if (!canManage) return;
    let current = true; const controller = new AbortController();
    const load = async () => {
      try {
        const collected: ReviewLink[] = [], seen = new Set<string>(); let cursor: string | null = null;
        for (let n = 0; n < 100; n++) {
          const page: Envelope<ReviewLink[]> = await api(`/api/v1/review-links?workspace_id=${workspaceId}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
          collected.push(...page.data.filter(row => row.series_id === seriesId)); cursor = page.page?.next_cursor ?? null;
          if (!cursor) break; if (seen.has(cursor) || n === 99) throw new Error('The link list repeated. Refresh links to continue.'); seen.add(cursor);
        }
        if (current) { setLinks([...new Map(collected.map(row => [row.id, row])).values()]); setObservedNow(Date.now()); setError(''); }
      } catch (reason) { if (current) setError(reviewError(reason)); } finally { if (current) setLoading(false); }
    }; void load(); return () => { current = false; controller.abort(); };
  }, [seriesId, workspaceId, canManage, refresh]);
  function accepted(value: ReviewLinkCreated | ReviewLink | undefined) {
    if (!value) return;
    const link = 'link' in value ? value.link : value;
    if (link.series_id !== seriesId) { setError('The link response could not be confirmed for this series.'); return; }
    if ('url' in value) {
      const url = sameOriginReviewUrl(value.url, '/r/');
      setCreated({ id: link.id, url: window.location.origin + url }); setNotice('Copy this URL now. It is not stored in the link list.');
    } else { if (created?.id === link.id && (link.revoked_at || pendingAction.current === 'rotate')) setCreated(null); setNotice('Review link updated.'); }
    setLinks(rows => [link, ...rows.filter(row => row.id !== link.id)]); setEditing(null); setLabel(''); setExpiry(''); setDownloads(true);
  }
  async function createOrSave() {
    if (locked) return;
    setNotice(''); pendingAction.current = editing ? 'update' : 'create';
    const input = { ...(editing ? { row_version: editing.row_version } : { series_id: seriesId }), label: label.trim(), download_enabled: downloads,
      ...(expiry && (!editing || expiry !== reviewLinkLocalExpiry(editing.expires_at)) ? { expires_at: new Date(expiry).toISOString() } : {}) };
    accepted(await write.send<ReviewLinkCreated | ReviewLink>(editing ? `/api/v1/review-links/${editing.id}` : '/api/v1/review-links', editing ? 'PATCH' : 'POST', input));
  }
  function requestLifecycle(link: ReviewLink, action: 'revoke' | 'rotate', trigger: HTMLButtonElement) {
    if (locked || link.revoked_at) return;
    confirmationTrigger.current = trigger; setConfirmation({ link, action });
  }
  function cancelLifecycle() { restoreFocus.current = true; setConfirmation(null); }
  async function confirmLifecycle() {
    if (!confirmation || write.locked) return;
    const { link, action } = confirmation;
    restoreFocus.current = true; setConfirmation(null); pendingAction.current = action; setNotice('');
    accepted(await write.send<ReviewLinkCreated | ReviewLink>(`/api/v1/review-links/${link.id}/${action}`, 'POST', { row_version: link.row_version }));
  }
  if (!canManage) return <p className="small muted">Your account cannot manage review links.</p>;
  return <section className="review-links-panel" aria-label="Review links"><header className="section-heading"><div><h2 ref={panelHeading} tabIndex={-1}>Review links</h2><p>Anyone with an active URL can view this series until its expiry.</p></div><button className="button" disabled={locked || loading} onClick={() => { setLoading(true); setRefresh(value => value + 1); }}>Refresh links</button></header>
    <p className="small muted">Links follow this series’s newest ready version. The default is 30 days; generating a new version does not extend access.</p>
    {error && <ErrorNotice message={error} />}{write.error && <ErrorNotice message={write.error} />}
    {write.uncertain && <button className="button button-primary" disabled={write.busy} onClick={async () => accepted(await write.send<ReviewLinkCreated | ReviewLink>())}>Confirm link request</button>}
    {notice && <p role="status">{notice}</p>}
    {created && <div className="review-link-created"><label>New review URL<input readOnly value={created.url} autoComplete="off" spellCheck={false} onFocus={event => event.target.select()} /></label><div className="button-row"><button className="button button-primary" onClick={async () => { try { await navigator.clipboard.writeText(created.url); setNotice('Review URL copied.'); } catch { setNotice('Select and copy the URL from the field.'); } }}>Copy review URL</button><a className="button" href={created.url} target="_blank" rel="noreferrer">Open guest review</a><button className="button" disabled={locked} onClick={() => setCreated(null)}>Hide URL</button></div><p className="small">Save the URL privately. Later access requires your saved copy or an explicit rotation.</p></div>}
    <form className="review-link-create" onSubmit={event => { event.preventDefault(); void createOrSave(); }}><label>Link label<input maxLength={120} value={label} disabled={locked} onChange={event => setLabel(event.target.value)} placeholder="Client / agency" /></label><label>Access expires (your local time)<input type="datetime-local" value={expiry} disabled={locked} onChange={event => setExpiry(event.target.value)} /><span className="small muted">{editing ? 'Adjust expiry without rewriting downloaded PDFs.' : 'Leave empty for 30 days from creation.'}</span></label><label className="review-link-checkbox"><input type="checkbox" checked={downloads} disabled={locked} onChange={event => setDownloads(event.target.checked)} />Allow PDF downloads</label><div className="button-row"><button className="button button-primary" disabled={locked}>{editing ? 'Save review link' : 'Create review link'}</button>{editing && <button type="button" className="button" disabled={locked} onClick={() => { setEditing(null); setLabel(''); setExpiry(''); setDownloads(true); }}>Cancel editing</button>}</div></form>
    <p className="small muted">Expiry edits use your browser’s local time. Saved expiry dates use the Studio timezone.</p>
    <p className="small muted">Disabling downloads stops new PDF downloads. Previously downloaded PDFs remain saved; their videos follow the link’s viewing access.</p>
    {loading && !links.length ? <Loading label="Opening review links…" /> : !links.length ? <p>No review links in this series.</p> : <ul className="review-link-list">{links.map(link => <li key={link.id}><header className="section-heading"><div><h3 dir="auto">{link.label || 'Review link'}</h3><p className="small">{link.revoked_at ? 'Revoked' : new Date(link.expires_at).getTime() <= observedNow ? 'Expired' : 'Active'} · PDF downloads {link.download_enabled ? 'enabled' : 'disabled'}</p></div><span className="badge">{link.latest_ready_version_id ? 'Follows latest ready' : 'Preparing'}</span></header><p>Anyone with this link can view until <StudioDateTime value={link.expires_at} />.</p><div className="button-row"><button className="button" disabled={locked || !!link.revoked_at} onClick={() => { setEditing(link); setLabel(link.label); setExpiry(reviewLinkLocalExpiry(link.expires_at)); setDownloads(link.download_enabled); }}>Edit access</button><button className="button" disabled={locked || !!link.revoked_at} onClick={event => requestLifecycle(link, 'rotate', event.currentTarget)}>Rotate URL</button><button className="button" disabled={locked || !!link.revoked_at} onClick={event => requestLifecycle(link, 'revoke', event.currentTarget)}>Revoke link</button></div>{confirmation?.link.id === link.id && <div className="notice" role="group" aria-label={confirmation.action === 'rotate' ? 'Confirm URL rotation' : 'Confirm link revocation'} aria-describedby={`review-link-confirm-${link.id}`}>
      <p id={`review-link-confirm-${link.id}`}>{confirmation.action === 'rotate' ? 'Replace this review URL? The old URL, sessions and PDF video links will stop working.' : 'Revoke this review link? Future viewing and PDF video requests will be denied.'}</p>
      <div className="button-row"><button ref={confirmationCancel} type="button" className="button" disabled={write.locked} onClick={cancelLifecycle}>Cancel</button><button type="button" className="button button-primary" disabled={write.locked} onClick={() => void confirmLifecycle()}>Confirm {confirmation.action}</button></div>
    </div>}</li>)}</ul>}
  </section>;
}
