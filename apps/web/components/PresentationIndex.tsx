'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { PresentationSeries } from '@eps/domain';
import { api, errorMessage, type Actor, type Workspace } from './api';
import { ErrorNotice, Loading } from './Feedback';

export function PresentationIndex({ actor }: { actor: Actor }) { return <IndexScope key={actor.id} />; }
function IndexScope() {
  const [items, setItems] = useState<PresentationSeries[]>([]); const [workspaces, setWorkspaces] = useState<Record<string, Workspace>>({});
  const [cursor, setCursor] = useState<string | null>(null); const [next, setNext] = useState<string | null>(null); const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const seen = useRef(new Set<string>());
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
  return <><header className="page-heading"><div><h1>Presentations</h1><p>Saved versions follow their own output and audience series.</p></div><Link className="button" href="/projects">Open Projects</Link></header>{error && <ErrorNotice message={error} retry={() => { seen.current.clear(); setItems([]); setWorkspaces({}); setCursor(null); setNext(null); setLoading(true); setRefresh(value => value + 1); }} />}
    {loading && !items.length ? <Loading /> : !items.length && !error ? <div className="empty-state"><h2>No presentation series yet</h2><p>Open a project, choose a review context and generate its first saved version.</p><Link className="button button-primary" href="/projects">Open Projects</Link></div> : <div className="presentation-index">{items.map(series => <article key={series.id}><h2>{series.title}</h2><p>{series.output_type === 'selection' ? 'Cast Selection' : 'Cast Shortlist'} · {series.audience_snapshot.label}</p><p>{series.latest_ready_version_no ? `Latest ready: version ${series.latest_ready_version_no}` : 'No ready version yet'}</p><div className="button-row">{series.latest_ready_version_id && <Link className="button button-primary" href={`/presentations/versions/${series.latest_ready_version_id}`}>Open latest ready</Link>}{workspaces[series.workspace_id] && <Link className="button" href={`/projects/${workspaces[series.workspace_id].project_id}/casting/${series.workspace_id}/presentations?series_id=${series.id}`}>Open workspace history</Link>}</div></article>)}</div>}
    {next && !error && <button className="button" disabled={loading} onClick={() => { setLoading(true); setCursor(next); }}>Load more series</button>}
  </>;
}
