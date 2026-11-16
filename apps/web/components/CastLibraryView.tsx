'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Candidate, CandidateFacts, LibraryCandidate, WorkspaceCandidateAdded } from '@eps/domain';
import { api, errorMessage, mutation, type Actor } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { CandidateFactsEditor, emptyCandidateFacts } from './CandidateFactsEditor';
import { createCastLibraryRequests } from '../lib/cast-library-requests';
import { RoleFilterSuggestions } from './RoleFilterSuggestions';
import { Icon } from './Icon';
import { cardCastingId, cardLines } from './candidate-card';
import { SegmentIndicator } from './motion/SegmentIndicator';
import { stagger } from './motion/motion';
import { PageFrame, PanelToggle } from './shell/PageFrame';
import { CandidatePortrait } from './CandidatePortrait';
import { useUnsavedChanges, useUnsavedEditor } from './ui/UnsavedChanges';

type Props = { actor: Actor; onDirtyChange: (dirty: boolean) => void; workspaceId?: string; onAdded?: (candidate: WorkspaceCandidateAdded) => void;
  /** Membership changed in this session (added: row id, removed: null); wins over the loaded rows. */
  membershipOverrides?: Record<string, string | null>;
  /** Opened from a role or scene: offer "Add and return". Adding never assigns anyone or changes Main. */
  context?: { roleId: string | null; sceneId: string | null }; onAddAndReturn?: () => void; onDone?: () => void;
  /** Mount point for additional facet filters (e.g. LibraryFacetFilters). Values set here are passed through as
   * search parameters unchanged; the search endpoint must accept them. */
  renderFacets?: (facets: { params: Record<string, string>; setParam: (key: string, value: string) => void }) => ReactNode };
type AddState = { status: 'adding' | 'added' | 'error'; already?: boolean; error?: string };
const TALENT_TYPE: Record<string, string> = { talent: 'Talent', real_family: 'Real family', group: 'Group' };
const filterFields = [{key:'age_or_range',label:'Age / range'},{key:'stated_gender',label:'Stated gender'}, {key:'height_measurements',label:'Height / measurements'},
  {key:'language',label:'Language'},{key:'accent',label:'Accent'},{key:'skill',label:'Skill / experience'},{key:'city',label:'City'}, {key:'previous_project_role',label:'Previous project / role'},{key:'classification',label:'Classification'}];

export function CastLibraryView({ actor, onDirtyChange, workspaceId, onAdded, membershipOverrides = {}, context, onAddAndReturn, onDone, renderFacets }: Props) {
  const [extraParams, setExtraParams] = useState<Record<string, string>>({});
  const setParam = useCallback((key: string, value: string) => setExtraParams(current => current[key] === value ? current : { ...current, [key]: value }), []);
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [batchBusy, setBatchBusy] = useState(false);
  const { confirmLeave } = useUnsavedChanges();
  const [items, setItems] = useState<LibraryCandidate[]>([]); const [next, setNext] = useState<string | null>(null);
  const [adds, setAdds] = useState<Record<string, AddState>>({});
  // One stable Idempotency-Key per (project, person) until the add is confirmed: retries and repeat clicks converge.
  const addKeys = useRef(new Map<string, string>()); const inFlight = useRef(new Set<string>());
  const [filters, setFilters] = useState<Record<string,string>>({include_unknown:'true'}); const [query,setQuery] = useState('');
  const [loading,setLoading] = useState(true); const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  const [layout,setLayout] = useState<'grid'|'list'>('grid'); const [creating,setCreating] = useState(false);
  const [facts,setFacts] = useState<CandidateFacts>(emptyCandidateFacts); const [revision,setRevision] = useState(0);
  const [requests] = useState(createCastLibraryRequests); const [resultsQuery,setResultsQuery] = useState<string|null>(null);
  const intent = useRef<{body:string; init:RequestInit}|null>(null);
  const canWrite = actor.capabilities?.includes('cast.write'); const canAdd = workspaceId && actor.capabilities?.includes('workspaces.write');
  const filterQuery = new URLSearchParams(Object.entries({...extraParams,...filters,q:query,...(workspaceId ? { workspace_id: workspaceId } : {})}).filter(([,value]) => value !== '')).toString();
  const load = useCallback(async (cursor?: string) => {
    const request = requests.start(); setLoading(true);
    try { const result = await api<LibraryCandidate[]>(`/api/v1/candidates?${filterQuery}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, {signal:request.signal});
      if (request.isCurrent()) { setItems(current => cursor ? [...current, ...result.data] : result.data); setNext(result.page?.next_cursor ?? null); setResultsQuery(filterQuery); setError(''); } }
    catch (reason) { if (request.isCurrent()) setError(errorMessage(reason)); } finally { if (request.isCurrent()) setLoading(false); }
  },[filterQuery,requests]);
  useEffect(() => { const timer=setTimeout(() => { void load(); },250); return () => { clearTimeout(timer); requests.cancel(); }; },[load,revision,requests]);
  const manualDirty = creating && JSON.stringify(facts) !== JSON.stringify(emptyCandidateFacts());
  useEffect(() => { onDirtyChange(manualDirty || busy); return () => onDirtyChange(false); },[manualDirty,busy,onDirtyChange]);
  /** Adds one person; other cards stay usable. An existing membership comes back as already_member, never an error. */
  async function add(candidate: { id: string }, afterwards?: () => void) {
    if (!workspaceId || inFlight.current.has(candidate.id)) return;
    inFlight.current.add(candidate.id);
    const key = addKeys.current.get(candidate.id) ?? crypto.randomUUID(); addKeys.current.set(candidate.id, key);
    setAdds(current => ({ ...current, [candidate.id]: { status: 'adding' } }));
    try {
      const result = await api<WorkspaceCandidateAdded>(`/api/v1/workspaces/${workspaceId}/candidates`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ candidate_id: candidate.id }) });
      addKeys.current.delete(candidate.id);
      setAdds(current => ({ ...current, [candidate.id]: { status: 'added', already: result.data.already_member } }));
      onAdded?.(result.data); afterwards?.();
    } catch (reason) { setAdds(current => ({ ...current, [candidate.id]: { status: 'error', error: errorMessage(reason) } })); }
    finally { inFlight.current.delete(candidate.id); }
  }
  /** Resolves only after the person is saved; on failure the entry stays open with its input. */
  async function persistManual() {
    setBusy(true); setError('');
    const body=JSON.stringify({facts}); if(intent.current?.body!==body) intent.current={body,init:mutation('POST',{facts})};
    try { const result=await api<Candidate>('/api/v1/candidates',intent.current.init); intent.current=null;
      setCreating(false); setFacts(emptyCandidateFacts()); setRevision(value=>value+1); if(workspaceId) void add(result.data); }
    catch(reason){setError(errorMessage(reason)); throw reason;}finally{setBusy(false);}
  }
  function create(event: React.FormEvent) { event.preventDefault(); void persistManual().catch(() => undefined); }
  function discardManual() { setCreating(false); setFacts(emptyCandidateFacts()); intent.current = null; }
  useUnsavedEditor('library-manual', { scope: 'editor:library:manual', label: 'the manual candidate entry', dirty: manualDirty, save: persistManual, discard: discardManual });
  /** Batch mode: add every selected person, one at a time, each with its own stable key. */
  async function addSelected() {
    setBatchBusy(true);
    try { for (const id of [...selected]) { await add({ id }); setSelected(current => { const next = new Set(current); next.delete(id); return next; }); } }
    finally { setBatchBusy(false); }
  }
  function cancelManual() { void confirmLeave({ scope: 'editor:library:manual' }).then(proceed => { if (proceed) discardManual(); }); }
  const applied = filterFields.filter(field => filters[field.key]);
  const activeCount = applied.length + (filters.review_status ? 1 : 0);
  function setFilter(key: string, value: string) { setFilters(current => ({ ...current, [key]: value })); }
  // Filters start closed. The page uses its filter panel; inside a workspace the facets open in place.
  const [facetsOpen, setFacetsOpen] = useState(false); const facetsId = useId();
  const filterToggle = workspaceId ? <button type="button" className="icon-button filter-toggle" aria-label={activeCount ? `Filters · ${activeCount} applied` : 'Filters'} aria-expanded={facetsOpen} aria-controls={facetsId} data-tip={facetsOpen ? 'Hide filters' : 'Show filters'} data-tip-side="end" onClick={() => setFacetsOpen(value => !value)}><Icon name="filter" />{activeCount > 0 && <span className="filter-toggle-count" aria-hidden="true">{activeCount}</span>}</button> : <PanelToggle />;
  const heading = <header className={workspaceId ? 'section-heading' : 'page-heading'}><div>{workspaceId ? <h2>Choose from Library</h2> : <h1>Cast Library</h1>}<p>{workspaceId ? 'Newest added first. Add as many people as you need; this stays open until you are done.' : 'Reusable supplied facts and original introductions across all projects. Missing facts stay “Not provided.”'}</p></div><div className="button-row">{canWrite && <button className={creating ? 'button' : 'button button-primary'} onClick={() => creating ? cancelManual() : setCreating(true)} disabled={busy}><Icon name={creating ? 'close' : 'plus'} />{creating ? 'Close manual entry' : 'Add manually'}</button>}{workspaceId && onDone && <button type="button" className="button" onClick={onDone}><Icon name="chevron-left" />Done · Back to project</button>}</div></header>;
  const manual = creating && <form className="panel manual-candidate" onSubmit={create}><header className="panel-header"><div><h2>Manual candidate</h2><p className="small muted">Enter only information supplied by the candidate. A video and a name are optional.</p></div></header><div className="panel-body stack"><CandidateFactsEditor facts={facts} onChange={setFacts} disabled={busy} /><div className="button-row"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save candidate'}</button><button type="button" className="button" disabled={busy} onClick={cancelManual}>Cancel</button></div></div></form>;
  const clear = activeCount > 0 && <button type="button" className="text-button small" onClick={() => setFilters({ include_unknown: filters.include_unknown ?? 'true' })}>Clear {activeCount}</button>;
  const facets = <>
    <fieldset className="facet-group"><legend>Fact review</legend>{[['', 'All'], ['reviewed', 'Reviewed'], ['unreviewed', 'Unreviewed']].map(([value, label]) => <label key={value || 'all'} className="radio-line"><input type="radio" name="cast-review" value={value} checked={(filters.review_status ?? '') === value} onChange={() => setFilter('review_status', value)} />{label}</label>)}</fieldset>
    {filterFields.map(field => <div className="field facet-field" key={field.key}><label htmlFor={`cast-${field.key}`}>{field.label}</label><input id={`cast-${field.key}`} value={filters[field.key] ?? ''} maxLength={500} placeholder="Any" dir="auto" onChange={event => setFilter(field.key, event.target.value)} /></div>)}
    <label className="toggle facet-toggle"><input type="checkbox" checked={filters.include_unknown !== 'false'} onChange={event => setFilter('include_unknown', String(event.target.checked))} />Include candidates with missing filter values</label>
    <p className="small muted">Unknown facts never exclude someone silently.</p>
    {renderFacets?.({ params: extraParams, setParam })}
  </>;
  const results = <div className="stack-lg facet-results">
    <div className="cast-toolbar"><label className="search-field"><Icon name="search" /><span className="sr-only">Search cast</span><input id="cast-search" type="search" value={query} maxLength={500} onChange={event => setQuery(event.target.value)} placeholder="Name, casting ID or supplied facts" /></label>
      {filterToggle}
      <div className="cluster applied-filters" role="group" aria-label="Applied filters">{filters.review_status && <span className="chip on">{filters.review_status === 'reviewed' ? 'Reviewed' : 'Unreviewed'}<button type="button" aria-label="Remove Fact review filter" onClick={() => setFilter('review_status', '')}><Icon name="close" /></button></span>}{applied.map(field => <span key={field.key} className="chip on" dir="auto">{field.label}: {filters[field.key]}<button type="button" aria-label={`Remove ${field.label} filter`} onClick={() => setFilter(field.key, '')}><Icon name="close" /></button></span>)}</div>
      <div className="segmented" role="group" aria-label="Cast layout"><SegmentIndicator /><button type="button" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>Grid</button><button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>List</button></div></div>
    {canAdd && selected.size > 0 && <div className="cluster batch-bar" role="group" aria-label="Selected people"><span className="small">{selected.size} selected</span>
      <button type="button" className="button button-small button-primary" disabled={batchBusy} onClick={() => void addSelected()}><Icon name="plus" />{batchBusy ? 'Adding…' : `Add ${selected.size} selected to project`}</button>
      <button type="button" className="button button-small button-quiet" disabled={batchBusy} onClick={() => setSelected(new Set())}>Clear selection</button></div>}
    <p className="small muted" role="status" aria-live="polite">{loading ? 'Searching…' : `${items.length}${next ? '+' : ''} ${items.length === 1 ? 'profile' : 'profiles'} shown`}</p>
    {loading && items.length === 0 ? <Loading label="Opening Cast Library…" /> : !items.length && !error ? <div className="empty-state"><Icon name="people" /><h2>No matching candidates</h2><p>Upload an introduction in a project, add a manual candidate, or adjust the filters.</p></div>
      : <ul ref={stagger} className={`cast-results cast-results-${layout}`} aria-label="Cast Library results">{items.map(candidate => <li key={candidate.id} className="cast-card">
        <Link className="cast-card-portrait" href={`/library/cast/${candidate.id}`} tabIndex={-1} aria-hidden="true"><CandidatePortrait candidateId={candidate.id} name={candidate.facts.name} hint={'portrait_photo' in candidate ? { photo: candidate.portrait_photo, frameAssetId: candidate.portrait_frame_asset_id } : undefined} />{candidate.possible_duplicate && <span className="badge badge-warn cast-card-flag">Possible duplicate</span>}{candidate.review_status === 'reviewed' && <span className="cast-card-reviewed"><Icon name="check" />Reviewed</span>}</Link>
        <div className="cast-result-details">{candidate.talent_type && <span className="cast-card-type small muted">{TALENT_TYPE[candidate.talent_type] ?? candidate.talent_type}</span>}<h3 dir="auto"><Link href={`/library/cast/${candidate.id}`}>{candidate.facts.name ?? 'Name not provided'}</Link>{candidate.review_status === 'reviewed' && <span className="reviewed-mark" title="Reviewed facts"><Icon name="check" /></span>}</h3>
          {candidate.name_ar && <p className="cast-card-name-ar" dir="rtl" lang="ar">{candidate.name_ar}</p>}
          {(() => { const lines = cardLines(candidate.facts); const castingId = cardCastingId(candidate.facts.casting_id); return <>
            {(lines.primary || castingId) && <p className="small muted cast-card-facts" dir="auto">{[lines.primary, castingId].filter(Boolean).join(' · ')}</p>}
            {lines.secondary && <p className="small cast-card-facts" dir="auto">{lines.secondary}</p>}</>; })()}
          <span className="sr-only">{candidate.review_status === 'reviewed' ? 'Reviewed' : 'Unreviewed'}</span>
          {typeof candidate.tape_count === 'number' && <p className="small muted cast-card-tapes">{candidate.tape_count === 0 ? 'No tapes yet' : `${candidate.tape_count} ${candidate.tape_count === 1 ? 'tape' : 'tapes'}`}{candidate.processing ? ' · new tape processing' : ''}</p>}
          {!!candidate.search_match?.unknown_filter_fields.length && <p className="small text-warn">Unknown: {candidate.search_match.unknown_filter_fields.join(', ')}</p>}</div>
        <div className="button-row cast-card-actions">{canAdd && !(Object.hasOwn(membershipOverrides, candidate.id) ? membershipOverrides[candidate.id] : candidate.membership) && adds[candidate.id]?.status !== 'adding'
          && <label className="check-line cast-card-select"><input type="checkbox" checked={selected.has(candidate.id)} aria-label={`Select ${candidate.facts.name ?? 'this person'}`} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(candidate.id); else next.delete(candidate.id); return next; })} />Select</label>}
          <Link className="button button-small button-quiet" href={`/library/cast/${candidate.id}`}>Open profile</Link>{canAdd && <MembershipControl state={adds[candidate.id]}
          member={Object.hasOwn(membershipOverrides, candidate.id) ? membershipOverrides[candidate.id] : candidate.membership?.workspace_candidate_id ?? null}
          name={candidate.facts.name ?? 'this person'} onAdd={() => void add(candidate)} onAddAndReturn={context && onAddAndReturn ? () => void add(candidate, onAddAndReturn) : undefined} />}</div></li>)}</ul>}
    {next && resultsQuery === filterQuery && <div className="load-more"><button className="button" disabled={loading} onClick={() => void load(next)}>{loading ? 'Loading…' : 'Load more'}</button></div>}
  </div>;
  if (workspaceId) return <section className="cast-library cast-library-embedded">{heading}
    {error && <ErrorNotice message={error} retry={() => void load()} />}
    <RoleFilterSuggestions workspaceId={workspaceId} onApply={(field, value) => setFilter(field, value)} />
    {manual}
    <div className="facet-layout">
      <aside id={facetsId} className="facet-panel" aria-labelledby="cast-filters-heading" hidden={!facetsOpen}><div className="facet-head"><h2 id="cast-filters-heading">Filters</h2>{clear}</div>{facets}</aside>
      {results}
    </div>
  </section>;
  return <PageFrame className="cast-library cast-library-page" panel={{ title: 'Filters', subtitle: activeCount ? `${activeCount} applied` : 'Supplied facts', label: 'Filters', actions: clear || undefined, body: facets, filters: { count: activeCount } }}>
    {heading}
    {error && <ErrorNotice message={error} retry={() => void load()} />}
    {manual}
    {results}
  </PageFrame>;
}

/** Membership chip: icon and words, never colour alone. Only this card changes while it is being added. */
function MembershipControl({ state, member, name, onAdd, onAddAndReturn }: { state?: AddState; member: string | null; name: string; onAdd: () => void; onAddAndReturn?: () => void }) {
  if (state?.status === 'adding') return <span className="membership-chip is-busy" role="status" aria-live="polite"><Icon name="clock" />Adding…</span>;
  if (member) return <span className="membership-chip is-member" role="status"><Icon name="check" />{state?.status === 'added' && !state.already ? 'Added to project' : 'In this project'}</span>;
  if (state?.status === 'error') return <span className="membership-chip is-error"><span role="alert"><Icon name="alert" />Not added: {state.error}</span><button type="button" className="button button-small" onClick={onAdd} aria-label={`Retry adding ${name}`}>Retry</button></span>;
  return <><button type="button" className="button button-small" onClick={onAdd} aria-label={`Add ${name} to project`}><Icon name="plus" />Add to project</button>
    {onAddAndReturn && <button type="button" className="button button-small button-quiet" onClick={onAddAndReturn} aria-label={`Add ${name} and return`}>Add and return</button>}</>;
}
