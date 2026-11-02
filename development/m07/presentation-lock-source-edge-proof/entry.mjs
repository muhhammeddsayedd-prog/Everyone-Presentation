/** Disabled edge-template correction. No old controller or claim is invoked. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import * as previous from '../presentation-lock-source-dedupe-proof/entry.mjs';
import { idFor,literal,sha } from '../presentation-lock-source-proof/proof.mjs';
export const EXECUTION_ENABLED=false;
export const PROBE_SHA='8973de4f38895f2497b46d87d6dda0fe929f2652d8cebb870c9d402587bf21b4';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
export function qualifyEdge(text,run){
 assert(UUID.test(run),'EDGE_RUN_UNCONFIRMED');
 if(!text.includes('::uuidwhere')&&!text.includes('::uuidand'))return{text,phase:null,spaces:0};
 const id=label=>literal(idFor(run,label))+'::uuid';let phase,spaces;
 const updatePrefix="begin;reset role;set local statement_timeout='8s';set local lock_timeout='8s';\nupdate eps.assignments set workspace_candidate_id=";
 if(text.startsWith(updatePrefix)){
  const match=/and workspace_id=('[a-f0-9-]{36}'::uuid);$/u.exec(text);assert(match&&UUID.test(match[1].slice(1,37)),'EDGE_WORKSPACE_UNCONFIRMED');
  assert(text===updatePrefix+id('pool-2-12')+'where id='+id('assignment-2-1')+'and workspace_id='+match[1]+';','EDGE_TEMPLATE_UNCONFIRMED');phase='edge_assignment_update';spaces=2;
 }else{
  assert(text==="select jsonb_build_object('archived_pool',p.archived_at is not null,'active_reference',a.archived_at is null)from eps.assignments a join eps.workspace_candidates p on p.id=a.workspace_candidate_id where a.id="+id('assignment-2-1')+'and p.id='+id('pool-2-12')+';','EDGE_TEMPLATE_UNCONFIRMED');phase='edge_pool_state';spaces=1;
 }
 const corrected=text.replaceAll('::uuidwhere','::uuid where').replaceAll('::uuidand','::uuid and');
 assert(corrected.replaceAll('::uuid where','::uuidwhere').replaceAll('::uuid and','::uuidand')===text,'EDGE_INVERSE_UNCONFIRMED');
 return{text:corrected,phase,spaces};
}
const SQLSTATES=new Set(['42601','42703','42704','42501','23503','23505','57014','55P03','P0001']);
const TRANSPORT=new Map([['LOCKSOURCE41_SESSION_FAILED','OWNED_SESSION_FAILED'],['LOCKSOURCE41_SESSION_TIMEOUT','OWNED_SESSION_TIMEOUT'],['LOCKSOURCE41_SESSION_CLEANUP_UNCONFIRMED','OWNED_SESSION_CLEANUP_UNCONFIRMED'],['EDGE_RUN_UNCONFIRMED','EDGE_RUN_UNCONFIRMED'],['EDGE_TEMPLATE_UNCONFIRMED','EDGE_TEMPLATE_UNCONFIRMED'],['EDGE_INVERSE_UNCONFIRMED','EDGE_INVERSE_UNCONFIRMED'],['EDGE_WORKSPACE_UNCONFIRMED','EDGE_WORKSPACE_UNCONFIRMED']]);
export function trackedSessions(target,report,run){
 const wrapped=new WeakSet();
 return new Proxy(target,{get(array,key,receiver){
  if(key!=='push')return Reflect.get(array,key,receiver);
  return(...values)=>{for(const value of values){
   assert(value&&typeof value.request==='function');if(wrapped.has(value))continue;wrapped.add(value);
   const request=value.request,tag=/(?:^|_)(holder|contender|observer|writer)$/u.exec(value.application??'')?.[1]??'session';
   value.request=async(text,...args)=>{let phase=text.trim()==='rollback;'?'cleanup_rollback':tag+'_request';
    try{
     const qualified=qualifyEdge(text,run);if(qualified.phase){phase=qualified.phase;report.edge_template_qualification.actual_requests.push({phase,space_insertions:qualified.spaces,inverse_byte_equal:true});}
     return await request.call(value,qualified.text,...args);
    }catch(error){
     if(report.first_owned_request_error===undefined){const sqlstate=SQLSTATES.has(error?.code)?error.code:null;report.first_owned_request_error={phase,code:sqlstate??TRANSPORT.get(error?.message)??'REQUEST_FAILED_UNCLASSIFIED',code_kind:sqlstate?'validated_sqlstate':'closed_transport_or_unknown',scope:'first observed owned request rejection; not a recovered primary error'};}
     throw error;
    }
   };
  }return Reflect.apply(Array.prototype.push,array,values);};
 }});
}
export async function runCases(ctx){
 assert(EXECUTION_ENABLED,'LOCKSOURCE41_EDGE_EXECUTION_DISABLED');
 assert.equal(sha(await readFile(new URL('../presentation-lock-source-proof/probes.mjs',import.meta.url))),PROBE_SHA);
 ctx.report.edge_template_qualification={frozen_probe_sha256:PROBE_SHA,only_three_whitespace_sites_in_two_templates:true,acceptance_and_SQL_semantics_unchanged:true,actual_requests:[]};
 await previous.runCases({...ctx,sessions:trackedSessions(ctx.sessions,ctx.report,ctx.runId)});
}
