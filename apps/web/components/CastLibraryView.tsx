'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Candidate, CandidateFacts, WorkspaceCandidate } from '@eps/domain';
import { api, errorMessage, mutation, type Actor } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { CandidateFactsEditor, emptyCandidateFacts } from './CandidateFactsEditor';
import { createCastLibraryRequests } from '../lib/cast-library-requests';
import { RoleFilterSuggestions } from './RoleFilterSuggestions';

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
  return <section className="cast-library"><header className={workspaceId ? 'section-heading' : 'page-heading'}><div>{workspaceId ? <h2>Reuse from Cast Library</h2> : <h1>Cast Library</h1>}<p>Reusable supplied facts and original introductions. Missing facts stay “Not provided.”</p></div>{canWrite && <button className="button" onClick={()=>setCreating(value=>!value)} disabled={busy}>{creating?'Close manual entry':'Add manually'}</button>}</header>
    {error && <ErrorNotice message={error} retry={()=>void load()} />}
    {workspaceId && <RoleFilterSuggestions workspaceId={workspaceId} onApply={(field,value)=>setFilters(current=>({...current,[field]:value}))} />}
    {creating && <form className="role-editor" onSubmit={create}><div className="section-heading"><div><h2>Manual candidate</h2><p>Enter only information supplied by the candidate. A video and a name are optional.</p></div></div><CandidateFactsEditor facts={facts} onChange={setFacts} disabled={busy} /><div className="button-row"><button className="button button-primary" disabled={busy}>{busy?'Saving…':'Save candidate'}</button><button type="button" className="button" disabled={busy} onClick={()=>setCreating(false)}>Cancel</button></div></form>}
    <div className="cast-toolbar"><div className="field"><label htmlFor="cast-search">Search cast</label><input id="cast-search" type="search" value={query} maxLength={500} onChange={event=>setQuery(event.target.value)} placeholder="Name, casting ID or supplied facts" /></div><div className="field"><label htmlFor="cast-review">Fact review</label><select id="cast-review" value={filters.review_status??''} onChange={event=>setFilters(current=>({...current,review_status:event.target.value}))}><option value="">All</option><option value="unreviewed">Unreviewed</option><option value="reviewed">Reviewed</option></select></div><div className="button-row" aria-label="Cast layout"><button className="button" aria-pressed={layout==='grid'} onClick={()=>setLayout('grid')}>Grid</button><button className="button" aria-pressed={layout==='list'} onClick={()=>setLayout('list')}>List</button></div></div>
    <details className="requirements-details"><summary>Filter supplied facts</summary><div className="form-grid">{filterFields.map(field=><div className="field" key={field.key}><label htmlFor={`cast-${field.key}`}>{field.label}</label><input id={`cast-${field.key}`} value={filters[field.key]??''} maxLength={500} onChange={event=>setFilters(current=>({...current,[field.key]:event.target.value}))} /></div>)}</div><label className="radio-line"><input type="checkbox" checked={filters.include_unknown!=='false'} onChange={event=>setFilters(current=>({...current,include_unknown:String(event.target.checked)}))} />Include candidates with missing filter values</label><button className="button button-small" onClick={()=>setFilters({include_unknown:'true'})}>Clear filters</button></details>
    {loading && items.length===0 ? <Loading label="Opening Cast Library…"/> : !items.length && !error ? <div className="empty-state"><h2>No matching candidates</h2><p>Upload an introduction in a project, add a manual candidate, or adjust the filters.</p></div> : <ul className={`cast-results cast-results-${layout}`} aria-label="Cast Library results">{items.map(candidate=><li key={candidate.id}><div className="cast-profile-mark" aria-hidden="true">{candidate.facts.name?.slice(0,1)??'?'}</div><div className="cast-result-details"><Link href={`/library/cast/${candidate.id}`}><h3 dir="auto">{candidate.facts.name??'Name not provided'}</h3></Link><p dir="auto">{candidate.facts.casting_id??'Casting ID not provided'}</p><p>{[candidate.facts.age_or_range,candidate.facts.city,...candidate.facts.languages].filter(Boolean).join(' · ')||'Details not provided'}</p><span className="badge">{candidate.review_status==='reviewed'?'Reviewed':'Unreviewed'}</span>{candidate.possible_duplicate && <span className="badge">Possible duplicate</span>}{!!candidate.search_match?.unknown_filter_fields.length && <p className="small muted">Unknown: {candidate.search_match.unknown_filter_fields.join(', ')}</p>}</div><div className="button-row"><Link className="button button-small" href={`/library/cast/${candidate.id}`}>Open profile</Link>{canAdd && <button className="button button-small" disabled={busy} onClick={()=>void add(candidate)}>Add to project</button>}</div></li>)}</ul>}
    {next && resultsQuery===filterQuery && <div className="load-more"><button className="button" disabled={loading} onClick={()=>void load(next)}>{loading?'Loading…':'Load more'}</button></div>}
  </section>;
}
