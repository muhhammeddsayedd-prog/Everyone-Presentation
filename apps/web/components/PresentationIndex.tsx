'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import type { PresentationSeries } from '@eps/domain';
import { api, ApiError, errorMessage, mutation, type Actor, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Icon } from './Icon';
import { ActionMenu } from './ui/Menu';
import { Modal } from './ui/Overlay';
import { useConfirm } from './ui/Confirm';
import { useToast } from './ui/Toast';
import { stagger } from './motion/motion';
import { SegmentIndicator } from './motion/SegmentIndicator';
import { PageFrame } from './shell/PageFrame';
import { CoverThumb } from './shell/Cover';

export function PresentationIndex({ actor }: { actor: Actor }) { return <IndexScope key={actor.id} canManage={actor.capabilities?.includes('presentations.generate') === true} />; }
function IndexScope({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<PresentationSeries[]>([]); const [workspaces, setWorkspaces] = useState<Record<string, Workspace>>({});
  const [cursor, setCursor] = useState<string | null>(null); const [next, setNext] = useState<string | null>(null); const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [showArchived, setShowArchived] = useState(false); const [output, setOutput] = useState<'all' | 'selection' | 'shortlist'>('all'); const countId = useId();
  const [renaming, setRenaming] = useState<PresentationSeries | null>(null); const [busyId, setBusyId] = useState<string | null>(null); const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const seen = useRef(new Set<string>()); const confirm = useConfirm(); const toast = useToast(); const router = useRouter();
  useEffect(() => { let current = true; const controller = new AbortController(); const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
    const load = async () => {
      try {
        const result = await api<PresentationSeries[]>(`/api/v1/presentation-series?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal });
        const nextCursor = result.page?.next_cursor ?? null;
        if (nextCursor && (nextCursor === cursor || seen.current.has(nextCursor))) throw new Error('The series page repeated. Reload the list to continue.');
        const ids = [...new Set(result.data.map(row => row.workspace_id))];
        const values = await Promise.all(ids.map(async id => { const value = (await api<Workspace>(`/api/v1/workspaces/${id}`, { signal })).data; if (value.id !== id) throw new Error('Workspace identity changed.'); return value; }));
        if (!current) return; setItems(rows => cursor ? [...new Map([...rows, ...result.data].map(row => [row.id, row])).values()] : result.data);
        if (cursor) seen.current.add(cursor);
        setWorkspaces(rows => ({ ...rows, ...Object.fromEntries(values.map(row => [row.id, row])) })); setNext(nextCursor); setError('');
      } catch (reason) { if (current) setError(errorMessage(reason)); } finally { if (current) setLoading(false); }
    }; void load(); return () => { current = false; controller.abort(); };
  }, [cursor, refresh]);
  function reloadAll() { seen.current.clear(); setItems([]); setWorkspaces({}); setCursor(null); setNext(null); setRowError(null); setLoading(true); setRefresh(value => value + 1); }
  async function patch(series: PresentationSeries, body: { title?: string; archived?: boolean }, done: string) {
    setBusyId(series.id); setRowError(null);
    try {
      const saved = (await api<PresentationSeries>(`/api/v1/presentation-series/${encodeURIComponent(series.id)}`, mutation('PATCH', { row_version: series.row_version, ...body }))).data;
      if (saved.id !== series.id) throw new Error('The saved series could not be confirmed. Reload the list.');
      setItems(rows => rows.map(row => row.id === saved.id ? saved : row)); toast({ message: done }); return true;
    } catch (reason) {
      setRowError({ id: series.id, message: reason instanceof ApiError && reason.status === 409 ? 'This series changed since the list loaded. Reload the list, then try again.' : errorMessage(reason) });
      return false;
    } finally { setBusyId(null); }
  }
  async function archive(series: PresentationSeries) {
    if (!await confirm({ title: `Archive “${series.title}”?`, description: 'The series leaves the active list. Its saved versions, PDFs and review feedback are kept, and existing guest links follow their own expiry.', confirmLabel: 'Archive series', danger: true })) return;
    await patch(series, { archived: true }, `${series.title} archived. Saved versions are kept.`);
  }
  const visible = items.filter(row => (showArchived || !row.archived) && (output === 'all' || row.output_type === output));
  const archivedCount = items.filter(row => row.archived).length;
  const outputCount = (value: 'all' | 'selection' | 'shortlist') => items.filter(row => (showArchived || !row.archived) && (value === 'all' || row.output_type === value)).length;
  const panelBody = <>
    <div className="panel-section"><h3 className="panel-eyebrow">Output</h3>
      <div className="segmented segmented-vertical" role="group" aria-label="Filter loaded series by output"><SegmentIndicator />{([['all', 'All series', 'slides'], ['selection', 'Cast Selection', 'board'], ['shortlist', 'Cast Shortlist', 'star']] as const).map(([value, label, icon]) => <button key={value} type="button" aria-pressed={output === value} aria-describedby={loading ? undefined : `${countId}-${value}`} onClick={() => setOutput(value)}><Icon name={icon} /><span className="segment-label">{label}</span>{!loading && <><span className="segment-count" aria-hidden="true">{outputCount(value)}</span><span id={`${countId}-${value}`} hidden>{outputCount(value)} loaded</span></>}</button>)}</div>
      {next && <p className="small muted">Counts cover the series loaded so far.</p>}
    </div>
    {archivedCount > 0 && <label className="toggle"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />Show archived ({archivedCount} loaded)</label>}
    <div className="section-note"><Icon name="lock" /><p>{canManage ? 'Each saved version is immutable. Renaming or archiving a series never changes its versions.' : 'Renaming and archiving series requires presentation generation permission.'}</p></div>
  </>;
  return <PageFrame className="presentations-page" panel={{ title: 'Filters', subtitle: 'Saved presentation series', label: 'Series filters', body: panelBody }}>
    <header className="page-heading"><div><h1>Presentations</h1><p>Saved versions follow their own output and audience series. Each version is immutable; new work creates the next version.</p></div><Link className="button" href="/projects">Open Projects</Link></header>
    {error && <ErrorNotice message={error} retry={reloadAll} />}
    {items.length > 0 && <p className="small muted" role="status">{visible.length} series shown{next ? ' · more available' : ''}</p>}
    {loading && !items.length ? <Loading label="Opening presentation series…" /> : !items.length && !error ? <div className="empty-state"><Icon name="slides" /><h2>No presentation series yet</h2><p>Open a project, choose a review context and generate its first saved version.</p><Link className="button button-primary" href="/projects">Open Projects</Link></div>
      : visible.length ? <ul ref={stagger} className="series-grid" aria-label="Presentation series">{visible.map(series => { const workspace = workspaces[series.workspace_id]; const history = workspace ? `/projects/${workspace.project_id}/casting/${series.workspace_id}/presentations?series_id=${series.id}` : null;
        const outputLabel = series.output_type === 'selection' ? 'Cast Selection' : 'Cast Shortlist';
        return <li key={series.id} className={`series-card${series.archived ? ' is-archived' : ''}`} aria-busy={busyId === series.id || undefined}>
          <div className="series-card-cover"><CoverThumb title={series.title} subtitle={series.latest_ready_version_no ? `${outputLabel} · Version ${series.latest_ready_version_no}` : outputLabel} client={series.audience_snapshot.label} tone={series.archived || !series.latest_ready_version_no ? 'muted' : 'default'} /></div>
          <div className="series-card-body">
            <div className="series-identity"><h2 dir="auto">{series.title}</h2><p className="small muted">{outputLabel} · {series.audience_snapshot.label} ({series.audience_snapshot.scope}) · template {series.template_version}</p></div>
            {canManage && <ActionMenu label={`Series actions for ${series.title}`} disabled={busyId !== null} items={[{ label: 'Rename series', onSelect: () => setRenaming(series) }, { label: 'Share and review', onSelect: () => router.push(`/presentations/series/${series.id}/sharing`) }, { kind: 'separator' as const }, series.archived ? { label: 'Restore series', onSelect: () => void patch(series, { archived: false }, `${series.title} restored.`) } : { label: 'Archive series', danger: true, onSelect: () => void archive(series) }]} />}
          </div>
          <div className="series-state">{series.archived ? <span className="badge">Archived</span> : series.latest_ready_version_no ? <span className="badge badge-dot badge-ok">Version {series.latest_ready_version_no} ready</span> : <span className="badge badge-pending">No ready version yet</span>}</div>
          <div className="button-row series-actions">{series.latest_ready_version_id && <Link className="button button-small button-primary" href={`/presentations/versions/${series.latest_ready_version_id}`}>Open latest ready</Link>}{history && <Link className="button button-small" href={history}>Open workspace history</Link>}</div>
          {rowError?.id === series.id && !renaming && <div className="series-error"><ErrorNotice message={rowError.message} retry={reloadAll} /></div>}
        </li>; })}</ul>
      : <div className="empty-state"><Icon name="slides" /><h2>No series in this view</h2><p>Choose All series{archivedCount > 0 && !showArchived ? ' or show archived series' : ''} to see the others that are loaded.</p></div>}
    {next && !error && <button className="button" disabled={loading} onClick={() => { setLoading(true); setCursor(next); }}>Load more series</button>}
    {renaming && <RenameSeries series={renaming} busy={busyId === renaming.id} error={rowError?.id === renaming.id ? rowError.message : ''} onCancel={() => { setRenaming(null); setRowError(null); }} onSave={async title => { if (await patch(renaming, { title }, `Series renamed to ${title}.`)) setRenaming(null); }} />}
  </PageFrame>;
}

function RenameSeries({ series, busy, error, onCancel, onSave }: { series: PresentationSeries; busy: boolean; error: string; onCancel: () => void; onSave: (title: string) => void }) {
  const [title, setTitle] = useState(series.title); const [touched, setTouched] = useState(false);
  const trimmed = title.trim(); const invalid = !trimmed ? 'Enter a series title.' : trimmed === series.title ? 'Enter a different title to rename.' : '';
  return <Modal title="Rename series" description="The new title applies to this series. Saved versions are immutable and are not changed." onClose={onCancel} busy={busy}
    footer={<><button type="button" className="button" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" form="rename-series" className="button button-primary" disabled={busy || Boolean(invalid)}>{busy ? 'Saving…' : 'Save title'}</button></>}>
    <form id="rename-series" className="field" data-invalid={(touched && Boolean(invalid)) || undefined} onSubmit={event => { event.preventDefault(); setTouched(true); if (!invalid) onSave(trimmed); }}>
      <label htmlFor="series-title">Series title</label><input id="series-title" data-autofocus value={title} maxLength={200} dir="auto" aria-invalid={(touched && Boolean(invalid)) || undefined} aria-describedby="series-title-hint" onChange={event => { setTitle(event.target.value); setTouched(true); }} />
      <span id="series-title-hint" className={touched && invalid ? 'field-error' : 'field-hint'}>{touched && invalid ? invalid : 'Up to 200 characters.'}</span>
    </form>
    {error && <ErrorNotice message={error} />}
  </Modal>;
}
