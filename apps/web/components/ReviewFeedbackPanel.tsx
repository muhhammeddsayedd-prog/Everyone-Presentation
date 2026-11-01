'use client';
import { useConfirm } from './ui/Confirm';

import { useEffect, useRef, useState } from 'react';
import type { Feedback, FeedbackComment, GuestBrowserAccess, PreferenceValue } from '../../../packages/domain/src/guest-types';
import type { VersionSlide } from '@eps/domain';
import { ErrorNotice, Loading } from './Feedback';
import { StudioDateTime } from './StudioTimeZone';
import { reviewError, reviewRequest, useReviewMutation } from './review-client';
import { SegmentIndicator } from './motion/SegmentIndicator';
import { feedbackSummaryDto, type FeedbackSummary } from '../../../packages/domain/src/feedback-summary.ts';

const preferenceLabels: Record<PreferenceValue, string> = { preferred: 'Preferred', maybe: 'Maybe', not_preferred: 'Not preferred' };
interface Props {
  versionId: string; versionNo: number; slides: VersionSlide[]; slideId?: string;
  access?: GuestBrowserAccess; canWrite?: boolean; onIdentified?: (value: GuestBrowserAccess) => void;
  onStateChange?: (value: { locked: boolean; dirty: boolean }) => void;
}
export function ReviewFeedbackPanel(props: Props) { return <FeedbackScope key={`${props.versionId}:${props.access?.guest_session_id ?? 'internal'}:${props.slideId ?? ''}`} {...props} />; }
function FeedbackScope({ versionId, versionNo, slides, slideId, access, canWrite = true, onIdentified, onStateChange }: Props) {
  const guest = !!access, context = access?.guest_session_id, prefix = guest ? '/api/v1/review' : '/api/v1';
  const candidates = slides.filter(slide => slide.kind === 'candidate');
  const [selected, setSelected] = useState(slideId ?? candidates[0]?.id ?? '');
  const active = slideId ?? selected, slide = slides.find(value => value.id === active);
  const [feedback, setFeedback] = useState<Feedback | null>(null), [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true), [cursor, setCursor] = useState<string | null>(null);
  const [opened, setOpened] = useState(false), [body, setBody] = useState(''), [name, setName] = useState(''), [company, setCompany] = useState('');
  const [visibility, setVisibility] = useState<'internal' | 'external'>('internal');
  const [editing, setEditing] = useState<FeedbackComment | null>(null), [reply, setReply] = useState<FeedbackComment | null>(null);
  const history = useRef(new Set<string>()), pendingKind = useRef('');
  const confirm = useConfirm(); const [preferenceNote, setPreferenceNote] = useState(''); const [preferencePending, setPreferencePending] = useState(false);
  const write = useReviewMutation(context);
  // Whole-version counts for the viewed version only (guests receive external counts only).
  // Unavailable leaves the loaded-page counts with their partial-count note.
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  useEffect(() => {
    let current = true; const controller = new AbortController();
    reviewRequest<unknown>(`${prefix}/versions/${versionId}/feedback/summary`, context, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })
      .then(result => { const parsed = feedbackSummaryDto(result.data); if (parsed.version_id !== versionId) throw new Error('mismatched version'); if (current) setSummary(parsed); })
      .catch(() => { if (current) setSummary(null); });
    return () => { current = false; controller.abort(); };
  }, [prefix, versionId, context, refresh]);
  useEffect(() => { onStateChange?.({ locked: write.locked, dirty: !!body.trim() }); }, [write.locked, body, onStateChange]);
  function openComposer() {
    setOpened(true);
    if (!guest) return;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('eps-review-label') ?? 'null');
      if (saved && typeof saved === 'object') {
        const value = saved as Record<string, unknown>;
        if (typeof value.display_name === 'string') setName(value.display_name.slice(0, 120));
        if (typeof value.company === 'string') setCompany(value.company.slice(0, 160));
      }
    } catch { /* Remembered labels are optional and never credentials. */ }
  }
  useEffect(() => {
    let current = true; const controller = new AbortController();
    const load = async () => {
      try {
        const result = (await reviewRequest<Feedback>(`${prefix}/versions/${versionId}/feedback?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, context,
          { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })).data;
        if (result.version_id !== versionId || guest && result.comments.some(comment => comment.visibility !== 'external')) throw new Error('The feedback response could not be confirmed for this version.');
        const next = result.page.next_cursor;
        if (next && (next === cursor || history.current.has(next))) throw new Error('Feedback repeated a page. Refresh feedback to continue.');
        if (!current) return;
        if (cursor) history.current.add(cursor);
        setFeedback(previous => cursor && previous ? { ...result,
          comments: [...new Map([...previous.comments, ...result.comments].map(row => [row.id, row])).values()],
          preferences: [...new Map([...previous.preferences, ...result.preferences].map(row => [row.id, row])).values()] } : result);
        setError('');
      } catch (reason) { if (current) setError(reviewError(reason)); }
      finally { if (current) setLoading(false); }
    }; void load(); return () => { current = false; controller.abort(); };
  }, [prefix, versionId, context, cursor, refresh, guest]);
  function reload() { history.current.clear(); setCursor(null); setLoading(true); setRefresh(value => value + 1); }
  function acknowledge(value: unknown) {
    if (!value) return;
    if (pendingKind.current === 'identity') {
      const identified = value as GuestBrowserAccess;
      if (identified.guest_session_id !== context || !identified.display_name) { setError('The reviewer identity could not be confirmed.'); return; }
      onIdentified?.(identified);
      try { localStorage.setItem('eps-review-label', JSON.stringify({ display_name: name.trim(), company: company.trim() })); } catch { /* Viewing and feedback do not depend on local storage. */ }
    } else {
      if (pendingKind.current === 'comment') { setBody(''); setEditing(null); setReply(null); }
      reload();
    }
    pendingKind.current = '';
  }
  async function identify() {
    if (!name.trim()) return;
    pendingKind.current = 'identity';
    acknowledge(await write.send(`${prefix}/identity`, 'PUT', { display_name: name.trim(), company: company.trim() || null }));
  }
  async function comment() {
    if (!body.trim() || !slide || slide.kind !== 'candidate') return;
    pendingKind.current = 'comment';
    const path = editing ? `${prefix}/comments/${editing.id}` : `${prefix}/versions/${versionId}/comments`;
    const input = editing ? { row_version: editing.row_version, body: body.trim() } : { version_slide_id: slide.id, body: body.trim(),
      ...(!guest ? { visibility: reply?.visibility ?? visibility } : {}), ...(reply ? { parent_comment_id: reply.id } : {}) };
    acknowledge(await write.send(path, editing ? 'PATCH' : 'POST', input));
  }
  async function prefer(value: PreferenceValue | null) {
    if (!slide || !access?.display_name) { openComposer(); return; }
    // Keep focus in the group while a save runs; a change made meanwhile is ignored, not queued.
    if (write.busy) return;
    const own = feedback?.preferences.find(item => item.version_slide_id === slide.id && item.guest_session_id === context);
    pendingKind.current = 'preference'; setPreferenceNote(''); setPreferencePending(true);
    const saved = await write.send(`${prefix}/versions/${versionId}/preferences`, 'PUT', { version_slide_id: slide.id, value, ...(own ? { row_version: own.row_version } : {}) });
    setPreferencePending(false); acknowledge(saved);
    if (saved) setPreferenceNote(value ? `Preference saved: ${preferenceLabels[value]}.` : 'Preference cleared.');
  }
  const comments = feedback?.comments.filter(item => item.version_slide_id === active) ?? [];
  const preferences = feedback?.preferences.filter(item => item.version_slide_id === active) ?? [];
  const ownPreference = preferences.find(item => item.guest_session_id === context);
  const slideCounts = summary?.per_slide.find(item => item.version_slide_id === active);
  const optionLabel = (item: VersionSlide) => { const counts = summary?.per_slide.find(row => row.version_slide_id === item.id); return `${item.role_label} / ${item.slot_label}${counts?.comment_count ? ` · ${counts.comment_count} ${counts.comment_count === 1 ? 'comment' : 'comments'}` : ''}`; };
  const canCompose = canWrite && (!guest || access.display_name);
  return <section className="review-feedback" aria-label={`Feedback on version ${versionNo}`}>
    <header className="section-heading"><div><h2>Feedback</h2><p>Version {versionNo} · {slide?.role_label ?? 'Choose a candidate'}{slide?.slot_label ? ` / ${slide.slot_label}` : ''}</p></div><button className="button" disabled={write.locked || loading} onClick={reload}>Refresh feedback</button></header>
    {!slideId && <label className="field">Role / slot<select value={selected} disabled={write.locked} onChange={async event => { const next = event.target.value; if (body.trim() && !await confirm({ title: 'Discard your unsent comment?', description: 'Opening feedback for another role or slot discards the comment you have not posted.', confirmLabel: 'Discard comment', cancelLabel: 'Keep writing', danger: true })) return; setSelected(next); setBody(''); setEditing(null); setReply(null); }}>{candidates.map(item => <option key={item.id} value={item.id}>{optionLabel(item)}</option>)}</select></label>}
    <p className="small muted">External feedback is shared with reviewers of this presentation. Preferences do not change casting positions.</p>
    {summary && <p className="small review-feedback-totals" aria-label={`Version ${versionNo} feedback totals`}>Version {versionNo}{guest ? ' (shared feedback)' : ''}: {summary.totals.preferred} preferred · {summary.totals.maybe} maybe · {summary.totals.not_preferred} not preferred · {summary.totals.comment_count} {summary.totals.comment_count === 1 ? 'comment' : 'comments'}{summary.totals.unresolved_count ? ` (${summary.totals.unresolved_count} unresolved)` : ''}</p>}
    {error && <ErrorNotice message={error} retry={!write.locked ? reload : undefined} />}
    {write.error && <ErrorNotice message={write.error} />}
    {write.uncertain && <button className="button button-primary" disabled={write.busy} onClick={async () => acknowledge(await write.send())}>Confirm feedback request</button>}
    {loading && !feedback ? <Loading label="Opening feedback…" /> : slide?.kind !== 'candidate' ? <p>Select a candidate slide to review its role and slot.</p> : <>
      <dl className="review-preference-counts">{Object.entries(preferenceLabels).map(([value, label]) => <div key={value}><dt>{label}</dt><dd>{slideCounts ? slideCounts[value as PreferenceValue] : preferences.filter(item => item.value === value).length}</dd></div>)}{slideCounts && <div><dt>Comments</dt><dd>{slideCounts.comment_count}{slideCounts.unresolved_count ? <span className="small muted"> · {slideCounts.unresolved_count} unresolved</span> : null}</dd></div>}</dl>
      {!slideCounts && feedback?.page.next_cursor && <p className="small muted">Counts include loaded responses. Load more feedback to include the remaining responses.</p>}
      {guest && <fieldset className="preference-group" disabled={write.uncertain} aria-busy={preferencePending} aria-describedby="preference-note"><legend>Your preference for this candidate</legend>
        <div className="segmented preference-options"><SegmentIndicator />{Object.entries(preferenceLabels).map(([value, label]) => <label key={value} className={`preference-${value}`}><input type="radio" name={`preference-${active}`} value={value} checked={ownPreference?.value === value} onChange={() => void prefer(value as PreferenceValue)} />{label}</label>)}</div>
        <div className="preference-meta"><p id="preference-note" className="small muted" role="status" aria-live="polite">{preferencePending ? 'Saving preference…' : preferenceNote || (ownPreference ? `Your saved preference: ${preferenceLabels[ownPreference.value]}.` : access?.display_name ? 'No preference saved for this candidate.' : 'Choose a preference to introduce yourself first.')}</p>{ownPreference && <button type="button" className="text-button small" onClick={() => void prefer(null)}>Clear preference</button>}</div>
      </fieldset>}
      {canWrite && !opened && <button className="button button-primary" disabled={write.locked} onClick={openComposer}>Add feedback</button>}
      {opened && guest && !access.display_name ? <form className="review-feedback-form" onSubmit={event => { event.preventDefault(); void identify(); }}><h3>Introduce yourself</h3><p className="small">Your name is self-declared and appears with your feedback.</p><label>Your name<input autoComplete="name" maxLength={120} required value={name} disabled={write.locked} onChange={event => setName(event.target.value)} /></label><label>Company / agency (optional)<input autoComplete="organization" maxLength={160} value={company} disabled={write.locked} onChange={event => setCompany(event.target.value)} /></label><div className="button-row"><button className="button button-primary" disabled={write.locked || !name.trim()}>Continue to feedback</button><button type="button" className="button" disabled={write.locked} onClick={() => setOpened(false)}>Continue viewing</button></div></form> : opened && canCompose && <form className="review-feedback-form" onSubmit={event => { event.preventDefault(); void comment(); }}>
        {guest && <p className="small">Posting as {access.display_name} · self-declared</p>}
        {!guest && !editing && !reply && <label>Visibility<select value={visibility} disabled={write.locked} onChange={event => setVisibility(event.target.value as 'internal' | 'external')}><option value="internal">Internal production note</option><option value="external">External reviewer comment</option></select></label>}
        {reply && <p className="small">Replying to {reply.author_display_name}: {reply.body.slice(0, 160)}</p>}
        <label>{editing ? 'Edit comment' : 'Comment'}<textarea maxLength={10000} rows={4} required value={body} disabled={write.locked} onChange={event => setBody(event.target.value)} /></label><div className="button-row"><button className="button button-primary" disabled={write.locked || !body.trim()}>{editing ? 'Save comment' : reply ? 'Post reply' : 'Post comment'}</button><button type="button" className="button" disabled={write.locked} onClick={() => { setEditing(null); setReply(null); setBody(''); setOpened(false); }}>Cancel</button></div>
      </form>}
      <ol className="review-comments">{comments.map(item => <li key={item.id} className={item.parent_comment_id ? 'review-comment-reply' : undefined}><header><strong dir="auto">{item.author_display_name}</strong>{item.company && <span dir="auto">{item.company}</span>}<span className="badge">{item.visibility === 'internal' ? 'Internal note' : 'External'}{item.resolved ? ' · Resolved' : ''}</span><StudioDateTime value={item.created_at} /></header><p dir="auto">{item.body}</p><div className="button-row">{canCompose && <button className="button button-small" disabled={write.locked} onClick={() => { setReply(item); setEditing(null); setBody(''); setOpened(true); }}>Reply</button>}{canWrite && (!guest || item.guest_session_id === context) && <button className="button button-small" disabled={write.locked} onClick={() => { setEditing(item); setReply(null); setBody(item.body); setOpened(true); }}>Edit comment</button>}{!guest && canWrite && <button className="button button-small" disabled={write.locked} onClick={async () => { pendingKind.current = 'resolve'; acknowledge(await write.send(`/api/v1/comments/${item.id}`, 'PATCH', { row_version: item.row_version, resolved: !item.resolved })); }}>{item.resolved ? 'Reopen' : 'Resolve'}</button>}</div></li>)}</ol>
      {!comments.length && <p className="small muted">No comments for this candidate in version {versionNo}.</p>}
      {feedback?.page.next_cursor && <button className="button" disabled={write.locked || loading} onClick={() => { setLoading(true); setCursor(feedback.page.next_cursor); }}>Load more feedback</button>}
    </>}
  </section>;
}
