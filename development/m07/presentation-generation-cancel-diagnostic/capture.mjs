/** Custody first, then a closed projection. Raw context never reaches reports. */
import assert from 'node:assert/strict';
import {Buffer}from 'node:buffer';
const KEY='__owned_private_cancel';
const METRIC_KEYS=new Set(['ok','code','duration_ms','operation','role','job_id','resource_id','status']);
const PL_ALLOW=new Set(['public.eps_generate_version','eps.presentation_lock_sources','public.eps_get_workspace_review','eps.review_snapshot','eps.review_snapshot_data','eps.capture_presentation_video_transcripts','eps.capture_presentation_video_english_transcripts','eps.presentation_remember','eps.review_require','eps.require_capability','eps.has_capability','eps.mcp_token_permits_capability','public.eps_validate_own_oauth_session','eps.casting_lock_workspaces','eps.fail','pg_temp.locksource41_measure']);
const SQL_ALLOW=new Set(['jwt','uid','has_capability','project_scope','review_scope','presentation_scope','mcp_token_permits_capability','eps_validate_own_oauth_session']);
export function projectContext(context,stages){
 const frames=[];let unknown=0,matched=0;
 for(const line of context.split(/\r?\n/u)){
  let m=/^PL\/pgSQL function ([a-z_][a-z0-9_.]*)\([^\n]*\) line ([0-9]+) at /u.exec(line);
  if(m){matched++;let name=m[1].replace(/^pg_temp_[0-9]+\./u,'pg_temp.');if(PL_ALLOW.has(name)){if(frames.length<64)frames.push({language:'plpgsql',function:name,line:Number(m[2])});}else unknown++;continue;}
  m=/^SQL function "([a-z_][a-z0-9_.]*)" statement ([0-9]+)$/u.exec(line);
  if(m){matched++;if(SQL_ALLOW.has(m[1])){if(frames.length<64)frames.push({language:'sql',function:m[1],statement:Number(m[2])});}else unknown++;}
 }
 let stage='unknown';const has=name=>frames.some(x=>x.function===name);
 if(has('eps.capture_presentation_video_english_transcripts'))stage='english_companion_capture';
 else if(has('eps.capture_presentation_video_transcripts'))stage='raw_source_companion_capture';
 else if(has('eps.review_snapshot_data')||has('eps.review_snapshot')||has('public.eps_get_workspace_review'))stage='review_and_fit';
 else if(has('eps.presentation_lock_sources'))stage='source_locking';
 else{
  const outer=frames.find(x=>x.function==='public.eps_generate_version');
  if(outer)for(const item of stages.line_stages)if(outer.line>=item.line)stage=item.stage;
 }
 return{context_empty:context.length===0,allowlisted_frames:frames,unknown_frame_count:unknown,stack_frame_count:matched,frame_projection_truncated:matched>64,stage,candidate_body_sha256:stages.candidate_generate_body_sha256};
}
export async function custodyAndStrip(rows,sink,stages){
 assert(Array.isArray(rows)&&rows.length===1,'DIAG_SINGLE_RESULT_REQUIRED');
 const original=rows[0];assert(original&&typeof original==='object'&&!Array.isArray(original),'DIAG_RESULT_OBJECT_REQUIRED');
 // Remove the raw field before any further validation or public assignment.
 const clean=Object.fromEntries(Object.entries(original).filter(([key])=>METRIC_KEYS.has(key)));
 assert(Object.keys(original).every(key=>key===KEY||METRIC_KEYS.has(key)),'DIAG_METRIC_KEYS_UNEXPECTED');
 if(!Object.hasOwn(original,KEY)){
  assert(!(clean.ok===false&&clean.code==='57014'),'DIAG_CANCEL_CONTEXT_MISSING');
  return{result:clean,cancellation:null};
 }
 const raw=original[KEY];
 assert(raw&&typeof raw==='object'&&!Array.isArray(raw),'DIAG_CANCEL_SHAPE_INVALID');
 assert.deepEqual(Object.keys(raw).sort(),['context','message','sqlstate'],'DIAG_CANCEL_KEYS_INVALID');
 assert(clean.ok===false&&clean.code==='57014'&&raw.sqlstate==='57014','DIAG_CANCEL_CODE_INVALID');
 assert(typeof raw.context==='string'&&typeof raw.message==='string','DIAG_CANCEL_TEXT_REQUIRED');
 assert(Buffer.byteLength(JSON.stringify(raw))<=2*1024**2,'DIAG_CANCEL_PRIVATE_BOUND_EXCEEDED');
 let custody;
 try{custody=await sink({schema_version:'owned-private-query-cancellation.v1',...raw});}
 catch{throw Error('DIAG_PRIVATE_CUSTODY_FAILED');}
 assert(custody?.normal_return===true&&/^[a-f0-9]{64}$/u.test(custody.sha256)&&/^[a-z0-9_-]+\.json$/u.test(custody.private_file),'DIAG_PRIVATE_CUSTODY_UNCONFIRMED');
 const reason=raw.message==='canceling statement due to statement timeout'?'statement_timeout':raw.message==='canceling statement due to user request'?'user_cancel':'query_canceled_other';
 const closedCustody={normal_return:true,private_file:custody.private_file,sha256:custody.sha256};
 return{result:clean,cancellation:{sqlstate:'57014',message_class:reason,private_custody:closedCustody,...projectContext(raw.context,stages)}};
}
