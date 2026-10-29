'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Candidate, CandidateFacts, CandidateMedia, DuplicateMatch } from '@eps/domain';
import { api, errorMessage, mutation, type Actor } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { CandidateFactsEditor, CandidateFactsView } from './CandidateFactsEditor';
import { CandidateProcessingIssues } from './CandidateProcessingIssues';
import { CandidateFrameImage } from './CandidateFrameImage';

type Playback = {asset_id:string;url:string;expires_at:string;mime_type:string;source_version_id:string|null};
export function CandidateDetailView({candidateId,actor,onDirtyChange}:{candidateId:string;actor:Actor;onDirtyChange:(dirty:boolean)=>void}) {
  const router=useRouter();
  const [mediaDirty,setMediaDirty]=useState<Record<string,boolean>>({});
  const mediaDirtyChanged=useCallback((key:string,value:boolean)=>setMediaDirty(current=>current[key]===value?current:{...current,[key]:value}),[]);
  const [candidate,setCandidate]=useState<Candidate|null>(null); const [media,setMedia]=useState<CandidateMedia[]>([]);
  const [duplicates,setDuplicates]=useState<DuplicateMatch[]>([]); const [facts,setFacts]=useState<CandidateFacts|null>(null);
  const [editing,setEditing]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(true); const intent=useRef<{path:string;body:string;init:RequestInit}|null>(null);
  const canWrite=actor.capabilities?.includes('cast.write'); const canReview=actor.capabilities?.includes('cast.review');
  const load=useCallback(async()=>{try{const [profile,sources,matches]=await Promise.all([
    api<Candidate>(`/api/v1/candidates/${candidateId}`),api<CandidateMedia[]>(`/api/v1/candidates/${candidateId}/media`),api<DuplicateMatch[]>(`/api/v1/candidates/${candidateId}/duplicates`)]);
    setCandidate(profile.data);setFacts(profile.data.facts);setMedia(sources.data);setDuplicates(matches.data);setError('');
  }catch(reason){setError(errorMessage(reason));}finally{setLoading(false);}},[candidateId]);
  useEffect(()=>{let current=true;Promise.all([api<Candidate>(`/api/v1/candidates/${candidateId}`),api<CandidateMedia[]>(`/api/v1/candidates/${candidateId}/media`),api<DuplicateMatch[]>(`/api/v1/candidates/${candidateId}/duplicates`)]).then(([profile,sources,matches])=>{if(current){setCandidate(profile.data);setFacts(profile.data.facts);setMedia(sources.data);setDuplicates(matches.data);setError('');}}).catch(reason=>{if(current)setError(errorMessage(reason));}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[candidateId]);
  useEffect(()=>{onDirtyChange(editing||busy||Object.values(mediaDirty).some(Boolean));return()=>onDirtyChange(false);},[editing,busy,mediaDirty,onDirtyChange]);
  const anyMediaDirty=Object.values(mediaDirty).some(Boolean);
  function retryRead(){if(editing||anyMediaDirty){setError('Save or discard your open edits before reloading this profile.');return;}void load();}
  async function save(path:string,method:string,body:unknown,success:string){
    setBusy(true);setError('');setMessage(''); const serialized=JSON.stringify(body);
    if(intent.current?.path!==path||intent.current.body!==serialized)intent.current={path,body:serialized,init:mutation(method,body)};
    try{await api(path,intent.current.init);intent.current=null;setEditing(false);if(path.endsWith('/archive')){router.push('/library/cast');return;}if(path.endsWith('/duplicates/resolve')&&(body as {action?:string}).action==='link_existing'){router.push(`/library/cast/${(body as {existing_candidate_id:string}).existing_candidate_id}`);return;}await load();setMessage(success);}
    catch(reason){setError(errorMessage(reason));}finally{setBusy(false);}
  }
  async function resolve(match?:DuplicateMatch){
    if(!candidate)return;
    if(!match)return save(`/api/v1/candidates/${candidateId}/duplicates/resolve`,'POST',{row_version:candidate.row_version,action:'keep_new'},'Kept as a separate candidate.');
    setBusy(true);try{const existing=(await api<Candidate>(`/api/v1/candidates/${match.candidate_id}`)).data;
      await save(`/api/v1/candidates/${candidateId}/duplicates/resolve`,'POST',{row_version:candidate.row_version,action:'link_existing',existing_candidate_id:existing.id,existing_candidate_row_version:existing.row_version},'Material linked to the existing profile.');
    }catch(reason){setError(errorMessage(reason));}finally{setBusy(false);}
  }
  if(loading&&!candidate)return <Loading label="Opening candidate…"/>;
  if(!candidate)return <ErrorNotice message={error||'Candidate unavailable.'} retry={retryRead}/>;
  return <section className="candidate-detail"><div className="workspace-breadcrumb"><Link href="/library/cast">Cast Library</Link><span>/</span><span dir="auto">{candidate.facts.name??'Name not provided'}</span></div><header className="page-heading"><div><h1 dir="auto">{candidate.facts.name??'Name not provided'}</h1><p>Shared facts · {candidate.review_status==='reviewed'?'Reviewed':'Unreviewed'}{candidate.archived?' · Archived':''}</p></div><div className="button-row">{canWrite&&!candidate.archived&&<button className="button" disabled={busy||anyMediaDirty} onClick={()=>{setFacts(candidate.facts);setEditing(value=>!value);}}>{editing?'Discard edits':'Edit facts'}</button>}{canReview&&!candidate.archived&&<button className="button button-primary" disabled={busy||editing||anyMediaDirty||candidate.review_status==='reviewed'} onClick={()=>void save(`/api/v1/candidates/${candidateId}/reviewed`,'POST',{row_version:candidate.row_version},'Facts confirmed as Reviewed.')}>Confirm Reviewed</button>}</div></header>
    <p className="small muted">Reviewed confirms the supplied facts. It does not approve a casting choice.</p>
    {error&&<ErrorNotice message={error} retry={retryRead}/>} {message&&<div className="notice" role="status"><p>{message}</p></div>}
    {candidate.merged_into_candidate_id&&<div className="notice"><p>This profile is linked to an existing candidate.</p><Link className="button" href={`/library/cast/${candidate.merged_into_candidate_id}`}>Open existing candidate</Link></div>}
    <section className="editor-section"><div className="section-heading"><h2>Supplied facts</h2>{candidate.reviewed_at&&<p>Confirmed {new Date(candidate.reviewed_at).toLocaleDateString()}</p>}</div>{editing&&facts?<form onSubmit={event=>{event.preventDefault();void save(`/api/v1/candidates/${candidateId}`,'PATCH',{row_version:candidate.row_version,facts},'Shared facts saved.');}}><CandidateFactsEditor facts={facts} onChange={setFacts} disabled={busy}/><p className="section-note">Changing facts resets Reviewed. Project availability is saved separately in each project.</p><div className="button-row"><button className="button button-primary" disabled={busy}>Save facts</button><button className="button" type="button" disabled={busy} onClick={()=>{setEditing(false);setFacts(candidate.facts);}}>Discard changes</button></div></form>:<CandidateFactsView facts={candidate.facts}/>}</section>
    {candidate.possible_duplicate&&canWrite&&!candidate.archived&&!candidate.merged_into_candidate_id&&<section className="editor-section"><div className="section-heading"><div><h2>Possible duplicate</h2><p>A matching name is a suggestion. Choose whether these are the same person.</p></div></div>{duplicates.map(match=><div className="preset-row" key={match.candidate_id}><div><Link href={`/library/cast/${match.candidate_id}`}>{match.display_name??'Name not provided'}</Link><p className="small muted">{match.match_reasons.join(' · ')}</p></div><button className="button" disabled={busy||editing||anyMediaDirty} onClick={()=>void resolve(match)}>Link to this profile</button></div>)}<div className="button-row"><button className="button" disabled={busy||editing||anyMediaDirty} onClick={()=>void resolve()}>Keep as a separate candidate</button></div></section>}
    <section className="editor-section"><div className="section-heading"><div><h2>Introductions &amp; frames</h2><p>Original transcript and actual video frames. Each project keeps its selected material.</p></div></div>{media.length?media.map(item=><CandidateMediaEditor key={`${item.id}/${item.row_version}`} media={item} canWrite={!!canWrite&&!candidate.archived&&!editing&&!Object.entries(mediaDirty).some(([key,value])=>key!==item.id&&value)} onSaved={async()=>{await load();}} onDirtyChange={mediaDirtyChanged}/>):<p className="muted">No introduction provided. Upload one from a project to add new material.</p>}</section>
    {canWrite&&!candidate.archived&&<button className="button" disabled={busy||editing||anyMediaDirty} onClick={()=>{if(window.confirm('Archive this profile from future Cast Library searches? Existing project selections and saved versions remain available.'))void save(`/api/v1/candidates/${candidateId}/archive`,'POST',{row_version:candidate.row_version},'Candidate archived.');}}>Archive candidate</button>}
  </section>;
}

export function CandidateMediaEditor({media,canWrite,onSaved,onDirtyChange}:{media:CandidateMedia;canWrite:boolean;onSaved:()=>Promise<void>;onDirtyChange:(key:string,dirty:boolean)=>void}){
  const [selected,setSelected]=useState(media.selected_frame_asset_ids);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [playback,setPlayback]=useState<Playback|null>(null);
  const dirty=JSON.stringify(selected)!==JSON.stringify(media.selected_frame_asset_ids);
  useEffect(()=>{onDirtyChange(media.id,dirty||busy);return()=>onDirtyChange(media.id,false);},[media.id,dirty,busy,onDirtyChange]);
  async function play(){setBusy(true);try{setPlayback((await api<Playback>(`/api/v1/media/${media.preview_asset_id??media.source_asset_id}/playback`,mutation('POST'))).data);}catch(reason){setError(errorMessage(reason));}finally{setBusy(false);}}
  async function save(){setBusy(true);setError('');try{await api(`/api/v1/candidate-media/${media.id}/frames`,mutation('PUT',{row_version:media.row_version,selected_frame_asset_ids:selected}));await onSaved();}catch(reason){setError(errorMessage(reason));}finally{setBusy(false);}}
  function move(index:number,offset:number){const next=[...selected];[next[index],next[index+offset]]=[next[index+offset],next[index]];setSelected(next);}
  return <article className="candidate-source"><div className="section-heading"><div><h3>Introduction</h3><p>{media.languages.join(', ')||'Language not provided'}</p></div><button className="button" disabled={busy} onClick={()=>void play()}>{playback?'Refresh playback link':'Play original video'}</button></div>{error&&<ErrorNotice message={error}/>}<CandidateProcessingIssues issues={media.processing_issues}/>{playback&&<video className="candidate-video" controls preload="metadata" src={playback.url} onError={()=>setError('Playback could not start. Refresh the playback link and try again.')}/>}
    <details className="requirements-details"><summary>Original transcript</summary><p className="candidate-transcript" dir="auto">{media.original_transcript??'Not provided'}</p></details>
    <fieldset disabled={!canWrite||busy}><legend>Choose up to three actual frames</legend><div className="candidate-frames">{media.available_frames.map(frame=><label className="candidate-frame" key={frame.asset_id}><CandidateFrameImage assetId={frame.asset_id} alt={`Video frame at ${(frame.timestamp_ms/1000).toFixed(2)} seconds`}/><span><input type="checkbox" checked={selected.includes(frame.asset_id)} disabled={!selected.includes(frame.asset_id)&&selected.length>=3} onChange={event=>setSelected(current=>event.target.checked?[...current,frame.asset_id]:current.filter(id=>id!==frame.asset_id))}/>{(frame.timestamp_ms/1000).toFixed(2)}s{selected.includes(frame.asset_id)?` · #${selected.indexOf(frame.asset_id)+1}`:''}</span>{!!frame.quality_flags.length&&<span className="small muted">{frame.quality_flags.join(', ')}</span>}</label>)}</div>{!media.available_frames.length&&<p className="muted">No usable frame was available. You may continue without frames.</p>}
      {!!selected.length&&<ol className="frame-order">{selected.map((id,index)=><li key={id}>Frame {index+1} · {(media.available_frames.find(frame=>frame.asset_id===id)!.timestamp_ms/1000).toFixed(2)}s <button className="button button-small" type="button" aria-label={`Move frame ${index+1} earlier`} disabled={index===0} onClick={()=>move(index,-1)}>Earlier</button> <button className="button button-small" type="button" aria-label={`Move frame ${index+1} later`} disabled={index===selected.length-1} onClick={()=>move(index,1)}>Later</button></li>)}</ol>}
      {canWrite&&dirty&&<div className="button-row"><button className="button button-primary" type="button" disabled={busy} onClick={()=>void save()}>Save frame selection</button><button className="button" type="button" onClick={()=>setSelected(media.selected_frame_asset_ids)}>Discard changes</button></div>}</fieldset>
  </article>;
}
