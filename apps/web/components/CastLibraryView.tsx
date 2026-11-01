'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Candidate, CandidateFacts, WorkspaceCandidate } from '@eps/domain';
import { api, errorMessage, mutation, type Actor } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { CandidateFactsEditor, emptyCandidateFacts } from './CandidateFactsEditor';
import { createCastLibraryRequests } from '../lib/cast-library-requests';
import { RoleFilterSuggestions } from './RoleFilterSuggestions';
import { Icon } from './Icon';
import { SegmentIndicator } from './motion/SegmentIndicator';
import { stagger } from './motion/motion';

type Props = { actor: Actor; onDirtyChange: (dirty: boolean) => void; workspaceId?: string; onAdded?: (candidate: WorkspaceCandidate) => void };
const filterFields = [{key:'age_or_range',label:'Age / range'},{key:'stated_gender',label:'Stated gender'}, {key:'height_measurements',label:'Height / measurements'},
  {key:'language',label:'Language'},{key:'accent',label:'Accent'},{key:'skill',label:'Skill / experience'},{key:'city',label:'City'}, {key:'previous_project_role',label:'Previous project / role'},{key:'classification',label:'Classification'}];

export function CastLibraryView({ actor, onDirtyChange, workspaceId, onAdded }: Props) {
  const [items, setItems] = useState<Candidate[]>([]); const [next, setNext] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string,string>>({include_unknown:'true'}); const [query,setQuery] = useState('');
  const [loading,setLoading] = useState(true); const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  const [layout,setLayout] = useState<'grid'|'list'>('grid'); const [creating,setCreating] = useState(false);
  const [facts,setFacts] = useState<CandidateFacts>(emptyCandidateFacts); const [revision,setRevision] = useState(0);
  const [requests] = useState(createCastLibraryRequests); const [resultsQuery,setResultsQuery] = useState<string|null>(null);
  const intent = useRef<{body:string; init:RequestInit}|null>(null);
  const canWrite = actor.capabilities?.includes('cast.write'); const canAdd = workspaceId && actor.capabilities?.includes('workspaces.write');
  const filterQuery = new URLSearchParams(Object.entries({...filters,q:query}).filter(([,value]) => value !== '')).toString();
  const load = useCallback(async (cursor?: string) => {
    const request = requests.start(); setLoading(true);
    try { const result = await api<Candidate[]>(`/api/v1/candidates?${filterQuery}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, {signal:request.signal});
      if (request.isCurrent()) { setItems(current => cursor ? [...current, ...result.data] : result.data); setNext(result.page?.next_cursor ?? null); setResultsQuery(filterQuery); setError(''); } }
    catch (reason) { if (request.isCurrent()) setError(errorMessage(reason)); } finally { if (request.isCurrent()) setLoading(false); }
  },[filterQuery,requests]);
  useEffect(() => { const timer=setTimeout(() => { void load(); },250); return () => { clearTimeout(timer); requests.cancel(); }; },[load,revision,requests]);
  useEffect(() => { onDirtyChange(creating || busy); return () => onDirtyChange(false); },[creating,busy,onDirtyChange]);
  async function add(candidate: Candidate) {
    setBusy(true); setError('');
    try { const result=await api<WorkspaceCandidate>(`/api/v1/workspaces/${workspaceId}/candidates`,mutation('POST',{candidate_id:candidate.id})); onAdded?.(result.data); }
    catch(reason){setError(errorMessage(reason));}finally{setBusy(false);}
  }
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const body=JSON.stringify({facts}); if(intent.current?.body!==body) intent.current={body,init:mutation('POST',{facts})};
    try { const result=await api<Candidate>('/api/v1/candidates',intent.current.init); intent.current=null;
      setCreating(false); setFacts(emptyCandidateFacts()); setRevision(value=>value+1); if(workspaceId) await add(result.data); }
    catch(reason){setError(errorMessage(reason));}finally{setBusy(false);}
  }
  const applied = filterFields.filter(field => filters[field.key]);
  const activeCount = applied.length + (filters.review_status ? 1 : 0);
  function setFilter(key: string, value: string) { setFilters(current => ({ ...current, [key]: value })); }
  return <section className={`cast-library${workspaceId ? ' cast-library-embedded' : ''}`}><header className={workspaceId ? 'section-heading' : 'page-heading'}><div>{workspaceId ? <h2>Reuse from Cast Library</h2> : <h1>Cast Library</h1>}<p>Reusable supplied facts and original introductions across all projects. Missing facts stay “Not provided.”</p></div>{canWrite && <button className={creating ? 'button' : 'button button-primary'} onClick={() => setCreating(value => !value)} disabled={busy}><Icon name={creating ? 'close' : 'plus'} />{creating ? 'Close manual entry' : 'Add manually'}</button>}</header>
    {error && <ErrorNotice message={error} retry={() => void load()} />}
    {workspaceId && <RoleFilterSuggestions workspaceId={workspaceId} onApply={(field, value) => setFilter(field, value)} />}
    {creating && <form className="panel manual-candidate" onSubmit={create}><header className="panel-header"><div><h2>Manual candidate</h2><p className="small muted">Enter only information supplied by the candidate. A video and a name are optional.</p></div></header><div className="panel-body stack"><CandidateFactsEditor facts={facts} onChange={setFacts} disabled={busy} /><div className="button-row"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save candidate'}</button><button type="button" className="button" disabled={busy} onClick={() => setCreating(false)}>Cancel</button></div></div></form>}
    <div className="facet-layout">
      <aside className="facet-panel" aria-labelledby="cast-filters-heading"><div className="facet-head"><h2 id="cast-filters-heading">Filters</h2>{activeCount > 0 && <button type="button" className="text-button small" onClick={() => setFilters({ include_unknown: filters.include_unknown ?? 'true' })}>Clear {activeCount}</button>}</div>
        <fieldset className="facet-group"><legend>Fact review</legend>{[['', 'All'], ['reviewed', 'Reviewed'], ['unreviewed', 'Unreviewed']].map(([value, label]) => <label key={value || 'all'} className="radio-line"><input type="radio" name="cast-review" value={value} checked={(filters.review_status ?? '') === value} onChange={() => setFilter('review_status', value)} />{label}</label>)}</fieldset>
        {filterFields.map(field => <div className="field facet-field" key={field.key}><label htmlFor={`cast-${field.key}`}>{field.label}</label><input id={`cast-${field.key}`} value={filters[field.key] ?? ''} maxLength={500} placeholder="Any" dir="auto" onChange={event => setFilter(field.key, event.target.value)} /></div>)}
        <label className="toggle facet-toggle"><input type="checkbox" checked={filters.include_unknown !== 'false'} onChange={event => setFilter('include_unknown', String(event.target.checked))} />Include candidates with missing filter values</label>
        <p className="small muted">Unknown facts never exclude someone silently.</p>
      </aside>
      <div className="stack-lg facet-results">
        <div className="cast-toolbar"><label className="search-field"><Icon name="search" /><span className="sr-only">Search cast</span><input id="cast-search" type="search" value={query} maxLength={500} onChange={event => setQuery(event.target.value)} placeholder="Name, casting ID or supplied facts" /></label>
          <div className="cluster applied-filters" role="group" aria-label="Applied filters">{filters.review_status && <span className="chip on">{filters.review_status === 'reviewed' ? 'Reviewed' : 'Unreviewed'}<button type="button" aria-label="Remove Fact review filter" onClick={() => setFilter('review_status', '')}><Icon name="close" /></button></span>}{applied.map(field => <span key={field.key} className="chip on" dir="auto">{field.label}: {filters[field.key]}<button type="button" aria-label={`Remove ${field.label} filter`} onClick={() => setFilter(field.key, '')}><Icon name="close" /></button></span>)}</div>
          <div className="segmented" role="group" aria-label="Cast layout"><SegmentIndicator /><button type="button" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>Grid</button><button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>List</button></div></div>
        <p className="small muted" role="status" aria-live="polite">{loading ? 'Searching…' : `${items.length}${next ? '+' : ''} ${items.length === 1 ? 'profile' : 'profiles'} shown`}</p>
        {loading && items.length === 0 ? <Loading label="Opening Cast Library…" /> : !items.length && !error ? <div className="empty-state"><Icon name="people" /><h2>No matching candidates</h2><p>Upload an introduction in a project, add a manual candidate, or adjust the filters.</p></div>
          : <ul ref={stagger} className={`cast-results cast-results-${layout}`} aria-label="Cast Library results">{items.map(candidate => <li key={candidate.id} className="cast-card">
            <Link className="cast-card-portrait" href={`/library/cast/${candidate.id}`} tabIndex={-1} aria-hidden="true"><span>{candidate.facts.name?.slice(0, 1) ?? '?'}</span>{candidate.possible_duplicate && <span className="badge badge-warn cast-card-flag">Possible duplicate</span>}</Link>
            <div className="cast-result-details"><h3 dir="auto"><Link href={`/library/cast/${candidate.id}`}>{candidate.facts.name ?? 'Name not provided'}</Link>{candidate.review_status === 'reviewed' && <span className="reviewed-mark" title="Reviewed facts"><Icon name="check" /></span>}</h3>
              <p className="small muted" dir="auto">{[candidate.facts.casting_id ?? 'Casting ID not provided', candidate.facts.age_or_range, candidate.facts.city].filter(Boolean).join(' · ')}</p>
              <p className="small" dir="auto">{candidate.facts.languages.join(' · ') || 'Languages not provided'}</p>
              <span className="sr-only">{candidate.review_status === 'reviewed' ? 'Reviewed' : 'Unreviewed'}</span>
              {!!candidate.search_match?.unknown_filter_fields.length && <p className="small text-warn">Unknown: {candidate.search_match.unknown_filter_fields.join(', ')}</p>}</div>
            <div className="button-row cast-card-actions"><Link className="button button-small button-quiet" href={`/library/cast/${candidate.id}`}>Open profile</Link>{canAdd && <button className="button button-small" disabled={busy} onClick={() => void add(candidate)}><Icon name="plus" />Add to project</button>}</div></li>)}</ul>}
        {next && resultsQuery === filterQuery && <div className="load-more"><button className="button" disabled={loading} onClick={() => void load(next)}>{loading ? 'Loading…' : 'Load more'}</button></div>}
      </div>
    </div>
  </section>;
}
