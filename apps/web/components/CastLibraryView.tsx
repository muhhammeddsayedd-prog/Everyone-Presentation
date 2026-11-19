'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Candidate, CandidateFacts, LibraryCandidate, WorkspaceCandidateAdded } from '@eps/domain';
import { api, ApiError, errorMessage, mutation, type Actor } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { CandidateFactsEditor, emptyCandidateFacts, factLabels } from './CandidateFactsEditor';
import { liveFilterDelay, liveFilterValues } from '../lib/live-search';
import { SearchField, useLiveResults, useLiveSearch, useSettledValue } from './ui/useLiveSearch';
import { RoleFilterSuggestions } from './RoleFilterSuggestions';
import { Icon } from './Icon';
import { cardCastingId, cardLines } from './candidate-card';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { glide, list as listVariants, listItem, seconds, settle } from './motion/presets';
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
  renderFacets?: (facets: { params: Record<string, string>; setParam: (key: string, value: string) => void; search: Record<string, string> }) => ReactNode };
type AddState = { status: 'adding' | 'added' | 'error'; already?: boolean; error?: string };
const TALENT_TYPE: Record<string, string> = { talent: 'Talent', real_family: 'Real family', group: 'Group' };
const filterFields = [{key:'age_or_range',label:'Age / range'},{key:'stated_gender',label:'Stated gender'}, {key:'height_measurements',label:'Height / measurements'},
  {key:'language',label:'Language'},{key:'accent',label:'Accent'},{key:'skill',label:'Skill / experience'},{key:'city',label:'City'}, {key:'previous_project_role',label:'Previous project / role'},{key:'classification',label:'Classification'}];
const TYPED_FILTERS = filterFields.map(field => field.key);

export function CastLibraryView({ actor, onDirtyChange, workspaceId, onAdded, membershipOverrides = {}, context, onAddAndReturn, onDone, renderFacets }: Props) {
  const [extraParams, setExtraParams] = useState<Record<string, string>>({});
  const setParam = useCallback((key: string, value: string) => setExtraParams(current => current[key] === value ? current : { ...current, [key]: value }), []);
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [batchBusy, setBatchBusy] = useState(false);
  const { confirmLeave } = useUnsavedChanges();
  const [adds, setAdds] = useState<Record<string, AddState>>({});
  // One stable Idempotency-Key per (project, person) until the add is confirmed: retries and repeat clicks converge.
  // The key is dropped once the add is confirmed or the membership is removed, so a later re-add is a new request.
  const addKeys = useRef(new Map<string, string>()); const inFlight = useRef(new Set<string>());
  const previousOverrides = useRef<Record<string, string | null>>({});
  useEffect(() => {
    const removed = Object.keys(membershipOverrides).filter(id => membershipOverrides[id] === null && previousOverrides.current[id] !== null);
    previousOverrides.current = { ...membershipOverrides };
    if (!removed.length) return;
    for (const id of removed) addKeys.current.delete(id);
    setAdds(current => removed.some(id => Object.hasOwn(current, id) && current[id].status !== 'adding')
      ? Object.fromEntries(Object.entries(current).filter(([id, state]) => !removed.includes(id) || state.status === 'adding')) : current);
  }, [membershipOverrides]);
  const [filters, setFilters] = useState<Record<string,string>>({include_unknown:'true'}); const [query,setQuery] = useState('');
  const [manualError,setManualError] = useState(''); const [busy,setBusy] = useState(false);
  const [layout,setLayout] = useState<'grid'|'list'>('grid'); const [creating,setCreating] = useState(false);
  const [facts,setFacts] = useState<CandidateFacts>(emptyCandidateFacts);
  const intent = useRef<{body:string; init:RequestInit}|null>(null);
  const canWrite = actor.capabilities?.includes('cast.write'); const canAdd = workspaceId && actor.capabilities?.includes('workspaces.write');
  // Live search: the box and the typed fact filters search ~250 ms after typing stops; clearing either, choosing a
  // radio/toggle or removing a chip applies at once. The previous results stay visible until the new ones arrive.
  const { term } = useLiveSearch(query);
  const typedFilters = useSettledValue(filters, (next, settled) => liveFilterDelay(next, settled, TYPED_FILTERS));
  const settledFilters = useMemo(() => liveFilterValues(typedFilters, TYPED_FILTERS), [typedFilters]);
  const filterQuery = new URLSearchParams(Object.entries({...extraParams,...settledFilters,q:term,...(workspaceId ? { workspace_id: workspaceId } : {})}).filter(([,value]) => value !== '')).toString();
  const search = useLiveResults<LibraryCandidate>(filterQuery, (cursor, signal) => api<LibraryCandidate[]>(`/api/v1/candidates?${filterQuery}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal }));
  const { items, next, loading, initial, reload } = search;
  const error = manualError || search.error;
  const facetSearch = useMemo(() => ({ ...settledFilters, q: term }), [settledFilters, term]);
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
    } catch (reason) {
      // An earlier add with this key was later removed from the project: refresh membership and allow a fresh add.
      if (reason instanceof ApiError && reason.status === 409 && reason.code === 'MEMBERSHIP_REMOVED') {
        addKeys.current.delete(candidate.id); reload();
        setAdds(current => ({ ...current, [candidate.id]: { status: 'error', error: 'This person was removed from the project after an earlier add. Add them again to rejoin.' } }));
      } else setAdds(current => ({ ...current, [candidate.id]: { status: 'error', error: errorMessage(reason) } }));
    }
    finally { inFlight.current.delete(candidate.id); }
  }
  /** Resolves only after the person is saved; on failure the entry stays open with its input. */
  async function persistManual() {
    setBusy(true); setManualError('');
    const body=JSON.stringify({facts}); if(intent.current?.body!==body) intent.current={body,init:mutation('POST',{facts})};
    try { const result=await api<Candidate>('/api/v1/candidates',intent.current.init); intent.current=null;
      setCreating(false); setFacts(emptyCandidateFacts()); reload(); if(workspaceId) void add(result.data); }
    catch(reason){setManualError(errorMessage(reason)); throw reason;}finally{setBusy(false);}
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
  const [facetsOpen, setFacetsOpen] = useState(false); const facetsId = useId(); const layoutPill = useId();
  // List view on the Library page: the row under the pointer or focus opens in the dark detail card (no new controls).
  const reduce = useReducedMotion(); const [openId, setOpenId] = useState<string | null>(null);
  const masterDetail = !workspaceId && layout === 'list';
  const openCandidate = masterDetail ? items.find(item => item.id === openId) ?? items[0] : undefined;
  const filterToggle = workspaceId ? <button type="button" className="icon-button filter-toggle" aria-label={activeCount ? `Filters · ${activeCount} applied` : 'Filters'} aria-expanded={facetsOpen} aria-controls={facetsId} data-tip={facetsOpen ? 'Hide filters' : 'Show filters'} data-tip-side="end" onClick={() => setFacetsOpen(value => !value)}><Icon name="filter" />{activeCount > 0 && <span className="filter-toggle-count" aria-hidden="true">{activeCount}</span>}</button> : <PanelToggle />;
  const heading = <header className={workspaceId ? 'section-heading' : 'page-heading'}><div>{workspaceId ? <h2>Choose from Library</h2> : <h1>Cast Library</h1>}<p>{workspaceId ? 'Newest added first. Add as many people as you need; this stays open until you are done.' : 'Reusable supplied facts and original introductions across all projects. Missing facts stay “Not provided.”'}</p></div><div className="button-row">{canWrite && <button className={creating ? 'button' : 'button button-primary'} onClick={() => creating ? cancelManual() : setCreating(true)} disabled={busy}><Icon name={creating ? 'close' : 'plus'} />{creating ? 'Close manual entry' : 'Add manually'}</button>}{workspaceId && onDone && <button type="button" className="button" onClick={onDone}><Icon name="chevron-left" />Done · Back to project</button>}</div></header>;
  const manual = creating && <form className="panel manual-candidate" onSubmit={create}><header className="panel-header"><div><h2>Manual candidate</h2><p className="small muted">Enter only information supplied by the candidate. A video and a name are optional.</p></div></header><div className="panel-body stack"><CandidateFactsEditor facts={facts} onChange={setFacts} disabled={busy} /><div className="button-row"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save candidate'}</button><button type="button" className="button" disabled={busy} onClick={cancelManual}>Cancel</button></div></div></form>;
  const clear = activeCount > 0 && <button type="button" className="text-button small" onClick={() => setFilters({ include_unknown: filters.include_unknown ?? 'true' })}>Clear {activeCount}</button>;
  const facets = <>
    <fieldset className="facet-group"><legend>Fact review</legend>{[['', 'All'], ['reviewed', 'Reviewed'], ['unreviewed', 'Unreviewed']].map(([value, label]) => <label key={value || 'all'} className="radio-line"><input type="radio" name="cast-review" value={value} checked={(filters.review_status ?? '') === value} onChange={() => setFilter('review_status', value)} />{label}</label>)}</fieldset>
    {filterFields.map(field => <div className="field facet-field" key={field.key}><label htmlFor={`cast-${field.key}`}>{field.label}</label><input id={`cast-${field.key}`} value={filters[field.key] ?? ''} maxLength={500} placeholder="Any" dir="auto" onChange={event => setFilter(field.key, event.target.value)} /></div>)}
    <label className="toggle facet-toggle"><input type="checkbox" checked={filters.include_unknown !== 'false'} onChange={event => setFilter('include_unknown', String(event.target.checked))} />Include candidates with missing filter values</label>
    <p className="small muted">Unknown facts never exclude someone silently.</p>
    {renderFacets?.({ params: extraParams, setParam, search: facetSearch })}
  </>;
  const results = <div className="stack-lg facet-results">
    <div className="cast-toolbar"><SearchField id="cast-search" label="Search cast" value={query} maxLength={500} onValueChange={setQuery} busy={loading} placeholder="Name, casting ID or supplied facts" />
      {filterToggle}
      <div className="cluster applied-filters" role="group" aria-label="Applied filters">{filters.review_status && <span className="chip on">{filters.review_status === 'reviewed' ? 'Reviewed' : 'Unreviewed'}<button type="button" aria-label="Remove Fact review filter" onClick={() => setFilter('review_status', '')}><Icon name="close" /></button></span>}{applied.map(field => <span key={field.key} className="chip on" dir="auto">{field.label}: {filters[field.key]}<button type="button" aria-label={`Remove ${field.label} filter`} onClick={() => setFilter(field.key, '')}><Icon name="close" /></button></span>)}</div>
      <div className="segmented cast-layout-toggle" role="group" aria-label="Cast layout">{(['grid', 'list'] as const).map(value => <button key={value} type="button" aria-pressed={layout === value} onClick={() => setLayout(value)}>{layout === value && <motion.span layoutId={layoutPill} className="segment-pill" transition={glide} aria-hidden="true" />}<span className="segment-label">{value === 'grid' ? 'Grid' : 'List'}</span></button>)}</div></div>
    {canAdd && selected.size > 0 && <div className="cluster batch-bar" role="group" aria-label="Selected people"><span className="small">{selected.size} selected</span>
      <button type="button" className="button button-small button-primary" disabled={batchBusy} onClick={() => void addSelected()}><Icon name="plus" />{batchBusy ? 'Adding…' : `Add ${selected.size} selected to project`}</button>
      <button type="button" className="button button-small button-quiet" disabled={batchBusy} onClick={() => setSelected(new Set())}>Clear selection</button></div>}
    <p className="small muted" role="status" aria-live="polite">{loading ? 'Searching…' : `${items.length}${next ? '+' : ''} ${items.length === 1 ? 'profile' : 'profiles'} shown`}</p>
    {initial || (loading && items.length === 0) ? <Loading label="Opening Cast Library…" /> : !items.length && !error ? <div className="empty-state"><Icon name="people" /><h2>No matching candidates</h2><p>Upload an introduction in a project, add a manual candidate, or adjust the filters.</p></div>
      : <div className={masterDetail ? 'cast-master-detail' : 'cast-results-wrap'}><motion.ul key={layout} className={`cast-results cast-results-${layout}`} aria-label="Cast Library results" variants={listVariants} initial={reduce ? false : 'hidden'} animate="shown"><AnimatePresence mode="popLayout" initial={false}>{items.map(candidate => <motion.li key={candidate.id} className="cast-card notched" layout={reduce ? false : 'position'} variants={listItem} transition={settle} exit={reduce ? undefined : { opacity: 0, scale: 0.96, transition: { duration: seconds.fast } }}
        data-open={openCandidate?.id === candidate.id ? '' : undefined} onMouseEnter={masterDetail ? () => setOpenId(candidate.id) : undefined} onFocus={masterDetail ? () => setOpenId(candidate.id) : undefined}>
        {layout === 'grid' && <span className="notched-corner" aria-hidden="true"><Link className="notched-go" href={`/library/cast/${candidate.id}`} tabIndex={-1}><Icon name="arrow" /></Link></span>}
        <Link className="cast-card-portrait" href={`/library/cast/${candidate.id}`} tabIndex={-1} aria-hidden="true"><CandidatePortrait candidateId={candidate.id} name={candidate.facts.name} hint={'portrait_photo' in candidate ? { photo: candidate.portrait_photo, frameAssetId: candidate.portrait_frame_asset_id } : undefined} />{candidate.possible_duplicate && <span className="badge badge-warn cast-card-flag">Possible duplicate</span>}{candidate.review_status === 'reviewed' && <span className="cast-card-reviewed"><Icon name="check" />Reviewed</span>}</Link>
        <div className="cast-result-details">{candidate.talent_type && <span className="cast-card-type small muted">{TALENT_TYPE[candidate.talent_type] ?? candidate.talent_type}</span>}<h3 dir="auto"><Link href={`/library/cast/${candidate.id}`}>{candidate.facts.name ?? 'Name not provided'}</Link>{candidate.review_status === 'reviewed' && <span className="reviewed-mark" title="Reviewed facts"><Icon name="check" /></span>}</h3>
          {candidate.name_ar && <p className="cast-card-name-ar" dir="rtl" lang="ar">{candidate.name_ar}</p>}
          {(() => { const lines = cardLines(candidate.facts); const castingId = cardCastingId(candidate.facts.casting_id); return <>
            {(lines.primary || castingId) && <p className="small muted cast-card-facts" dir="auto">{[lines.primary, castingId].filter(Boolean).join(' · ')}</p>}
            {lines.secondary && <p className="small cast-card-facts" dir="auto">{lines.secondary}</p>}</>; })()}
          <span className="sr-only">{candidate.review_status === 'reviewed' ? 'Reviewed' : 'Unreviewed'}</span>
          {typeof candidate.tape_count === 'number' && <p className="small muted cast-card-tapes"><Icon name="film" />{candidate.tape_count === 0 ? 'No tapes yet' : `${candidate.tape_count} ${candidate.tape_count === 1 ? 'tape' : 'tapes'}`}{candidate.processing ? ' · new tape processing' : ''}</p>}
          {!!candidate.search_match?.unknown_filter_fields.length && <p className="small text-warn">Unknown: {candidate.search_match.unknown_filter_fields.join(', ')}</p>}</div>
        <div className="button-row cast-card-actions">{canAdd && !(Object.hasOwn(membershipOverrides, candidate.id) ? membershipOverrides[candidate.id] : candidate.membership) && adds[candidate.id]?.status !== 'adding'
          && <label className="check-line cast-card-select"><input type="checkbox" checked={selected.has(candidate.id)} aria-label={`Select ${candidate.facts.name ?? 'this person'}`} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(candidate.id); else next.delete(candidate.id); return next; })} />Select</label>}
          <Link className="button button-small button-quiet" href={`/library/cast/${candidate.id}`}>Open profile</Link>{canAdd && <MembershipControl state={adds[candidate.id]}
          member={Object.hasOwn(membershipOverrides, candidate.id) ? membershipOverrides[candidate.id] : candidate.membership?.workspace_candidate_id ?? null}
          name={candidate.facts.name ?? 'this person'} onAdd={() => void add(candidate)} onAddAndReturn={context && onAddAndReturn ? () => void add(candidate, onAddAndReturn) : undefined} />}</div></motion.li>)}</AnimatePresence></motion.ul>
        {openCandidate && <CastDetailCard candidate={openCandidate} />}</div>}
    {next && <div className="load-more"><button className="button" disabled={search.loadingMore} onClick={() => void search.loadMore()}>{search.loadingMore ? 'Loading…' : 'Load more'}</button></div>}
  </div>;
  if (workspaceId) return <section className="cast-library cast-library-embedded">{heading}
    {error && <ErrorNotice message={error} retry={() => { setManualError(''); reload(); }} />}
    <RoleFilterSuggestions workspaceId={workspaceId} onApply={(field, value) => setFilter(field, value)} />
    {manual}
    <div className="facet-layout">
      <aside id={facetsId} className="facet-panel" aria-labelledby="cast-filters-heading" hidden={!facetsOpen}><div className="facet-head"><h2 id="cast-filters-heading">Filters</h2>{clear}</div>{facets}</aside>
      {results}
    </div>
  </section>;
  return <PageFrame className="cast-library cast-library-page" panel={{ title: 'Filters', subtitle: activeCount ? `${activeCount} applied` : 'Supplied facts', label: 'Filters', actions: clear || undefined, body: facets, filters: { count: activeCount } }}>
    {heading}
    {error && <ErrorNotice message={error} retry={() => { setManualError(''); reload(); }} />}
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

const DETAIL_FACTS = ['age_or_range', 'stated_gender', 'height_measurements', 'languages', 'accents', 'city'] as const;
/** List view: the open person as a dark detail card. It repeats facts already in the row; missing ones read "Not provided". */
function CastDetailCard({ candidate }: { candidate: LibraryCandidate }) {
  const facts = candidate.facts; const reviewed = candidate.review_status === 'reviewed';
  return <section className="cast-detail-card" aria-label={`${facts.name ?? 'Name not provided'} details`}>
    <header className="cast-detail-head">
      <div><span className="cast-detail-label">Casting ID</span><p className="cast-detail-id" dir="auto">{facts.casting_id ?? 'Not provided'}{reviewed && <span className="badge badge-dot badge-ok">Reviewed</span>}</p></div>
      <div><span className="cast-detail-label">Talent type</span><p className={`cast-detail-type${candidate.talent_type ? '' : ' is-missing'}`}>{candidate.talent_type ? TALENT_TYPE[candidate.talent_type] ?? candidate.talent_type : 'Not provided'}</p>{facts.city && <p className="small muted" dir="auto">{facts.city}</p>}</div>
    </header>
    <div className="cast-detail-body">
      <div className="cast-detail-portrait"><CandidatePortrait key={candidate.id} candidateId={candidate.id} name={facts.name} size="large" hint={'portrait_photo' in candidate ? { photo: candidate.portrait_photo, frameAssetId: candidate.portrait_frame_asset_id } : undefined} /></div>
      <div className="cast-detail-identity">
        <p className="cast-detail-name" dir="auto">{facts.name ?? 'Name not provided'}</p>
        {candidate.name_ar && <p className="cast-card-name-ar" dir="rtl" lang="ar">{candidate.name_ar}</p>}
        <dl className="cast-detail-facts">{DETAIL_FACTS.map(key => { const value = Array.isArray(facts[key]) ? (facts[key] as string[]).join(', ') : facts[key] as string | null;
          return <div key={key} className={value ? undefined : 'is-missing'}><dt>{factLabels[key]}</dt><dd dir="auto">{value || 'Not provided'}</dd></div>; })}</dl>
        <Link className="button button-small cast-detail-open" href={`/library/cast/${candidate.id}`}>Open full profile<Icon name="arrow" /></Link>
      </div>
    </div>
  </section>;
}
