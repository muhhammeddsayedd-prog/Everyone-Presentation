/** Focused owned-only rollback cases. Imported definitions have no side effects. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { URL } from 'node:url';
import { ACTOR,literal,json,sha } from '../presentation-lock-source-proof/proof.mjs';
const only=rows=>{assert.equal(rows.length,1);return rows[0];};
const metric=(operation,p,input=null,key=null)=>`select pg_temp.locksource41_measure(${literal(operation)},${literal(p.workspace)}::uuid,${literal(p.series)}::uuid,${input===null?'null':json(input)},${key===null?'null':literal(key)});`;
const meta=p=>`select pg_temp.locksource41_review_meta(${literal(p.workspace)}::uuid,${literal(p.series)}::uuid);`;
const fingerprint=p=>`select jsonb_build_object('fingerprint',eps.review_snapshot_data(${literal(p.workspace)}::uuid,${literal(p.series)}::uuid,null)->>'input_fingerprint');`;

export function englishSetup(id,status){
 assert(['not_captured','not_provided','available','unavailable'].includes(status));
 const available=['available','unavailable'].includes(status),text=available?'Controlled synthetic source transcript.':null;
 return `update eps.candidate_media set original_transcript=${text===null?'null':literal(text)},english_transcript=${status==='available'?literal('Controlled synthetic English transcript.'):'null'},english_transcript_status=${literal(status)},english_transcript_source_sha256=${available?'encode(sha256(convert_to('+literal(text)+",'UTF8')),'hex')":'null'},english_transcript_input_hash=${status==='not_captured'?'null':"repeat('e',64)"},english_transcript_metadata=${status==='available'?"'[{}]'::jsonb":"'[]'::jsonb"} where id=${literal(id('media-1'))}::uuid;`;
}

async function refreshDeclaredFit(ctx,p){
 const {holder,acting}=ctx;
 await holder.request(acting('api'));const current=only(await holder.request(fingerprint(p)));
 await holder.request(`reset role;update eps.review_fit_results set input_fingerprint=${literal(current.fingerprint)}where series_id=${literal(p.series)}::uuid and workspace_id=${literal(p.workspace)}::uuid;`);
 await holder.request(acting('api'));const result=only(await holder.request(meta(p)));assert.equal(result.can_generate,true);return result;
}

async function generationCase(ctx,records,name,setup,expectedEnglish,expectedCompanions,onVersion=null){
 const {holder,acting,profiles,variant}=ctx,p=profiles.control;
 const record={name,fixture_changes_rolled_back:false,synthetic_fit_metadata_only:true};records.push(record);
 await holder.request('reset role;begin;'+setup);
 try{
  const current=await refreshDeclaredFit(ctx,p);
  await holder.request(acting('api','authenticated'));
  const result=only(await holder.request(metric('generate',p,current.input,'data-reuse-'+ctx.runId+'-'+variant+'-'+name)));
  record.generation=result;assert.equal(result.ok,true);
  await holder.request('reset role;');
  record.projection=only(await holder.request(`select pg_temp.locksource41_generated_projection(${literal(result.resource_id)}::uuid);`));
  record.pins=only(await holder.request(`select pg_temp.data_reuse_pin_projection(${literal(result.resource_id)}::uuid);`));
  assert.equal(record.pins.private_filename_in_output,false);assert.equal(record.pins.raw_count,expectedCompanions);assert.equal(record.pins.english_count,expectedCompanions);
  assert.equal(record.pins.private_filename_examined_count,expectedCompanions);
  assert.deepEqual(record.pins.english_states,expectedEnglish);
  if(onVersion!==null)await onVersion(result.resource_id);
  return result.resource_id;
 }finally{await holder.request('rollback;reset role;');record.fixture_changes_rolled_back=true;}
}

export function associationCloneSQL(ctx,source,name){
 assert(['duplicate','ambiguous','unrelated_malformed','matched_malformed','mismatched_media','absent_media'].includes(name));
 const {id,profiles,variant}=ctx,version=id('data-reuse-'+variant+'-'+name),job=id('data-reuse-job-'+variant+'-'+name),extra=id('data-reuse-slide-'+variant+'-'+name);
 const tag='data-reuse-'+ctx.runId+'-'+variant+'-'+name;
 let snapshot='d.snapshot';
 if(['matched_malformed','mismatched_media','absent_media'].includes(name)){
  const media=name==='matched_malformed'?'NOT-A-UUID':name==='mismatched_media'?id('media-2'):id('absent-data-reuse-media');
  snapshot=`case when d.kind='candidate'then jsonb_set(d.snapshot,'{candidate_media_id}',to_jsonb(${literal(media)}::text))else d.snapshot end`;
 }
 const additional=['duplicate','ambiguous','unrelated_malformed'].includes(name);
 const extraSnapshot=name==='unrelated_malformed'?`d.snapshot||jsonb_build_object('video_asset_id','UNRELATED-NON-UUID','candidate_media_id','UNRELATED-NON-UUID')`:`jsonb_set(d.snapshot,'{candidate_media_id}',to_jsonb(${literal(id(name==='ambiguous'?'media-2':'media-1'))}::text))`;
 return `reset role;savepoint data_reuse_association;
do $owned$begin
 if current_user<>'postgres'or not exists(select 1 from eps.presentation_versions where id=${literal(source)}::uuid and workspace_id=${literal(profiles.control.workspace)}::uuid and status='queued'and generated_by=${literal(ACTOR)}::uuid)
 then raise exception'DATA_REUSE_NEW_VERSION_SOURCE_REQUIRED';end if;
end$owned$;
insert into eps.jobs select(populated).*from eps.presentation_versions v join eps.jobs j on j.id=v.generation_job_id cross join lateral jsonb_populate_record(null::eps.jobs,to_jsonb(j)||jsonb_build_object('id',${literal(job)},'resource_id',${literal(version)},'dedupe_key',encode(sha256(convert_to(${literal(tag)},'UTF8')),'hex'),'correlation_id',${literal(tag)}))populated where v.id=${literal(source)}::uuid;
insert into eps.presentation_versions select(populated).*from eps.presentation_versions v cross join lateral jsonb_populate_record(null::eps.presentation_versions,to_jsonb(v)||jsonb_build_object('id',${literal(version)},'generation_job_id',${literal(job)},'version_number',v.version_number+100000))populated where v.id=${literal(source)}::uuid;
insert into eps.version_slides(id,version_id,ordinal,kind,source_assignment_id,source_slot_id,snapshot,content_sha256)
 select md5(d.id::text||${literal(tag)})::uuid,${literal(version)}::uuid,d.ordinal,d.kind,d.source_assignment_id,d.source_slot_id,${snapshot},eps.presentation_hash(${snapshot})from eps.version_slides d where d.version_id=${literal(source)}::uuid;
insert into eps.presentation_version_assets select(populated).*from eps.presentation_version_assets p cross join lateral jsonb_populate_record(null::eps.presentation_version_assets,to_jsonb(p)||jsonb_build_object('version_id',${literal(version)}))populated where p.version_id=${literal(source)}::uuid;
${additional?`insert into eps.version_slides(id,version_id,ordinal,kind,source_assignment_id,source_slot_id,snapshot,content_sha256)select ${literal(extra)}::uuid,${literal(version)}::uuid,999,'candidate',d.source_assignment_id,d.source_slot_id,${extraSnapshot},eps.presentation_hash(${extraSnapshot})from eps.version_slides d where d.version_id=${literal(source)}::uuid and d.kind='candidate'order by d.ordinal limit 1;`:''}
select jsonb_build_object('version',${literal(version)}::uuid,'declared_owned_queued_metadata_only',true);`;
}

async function captureAssociations(ctx,records,source){
 const {holder,acting}=ctx;
 for(const name of['duplicate','ambiguous','unrelated_malformed','matched_malformed','mismatched_media','absent_media']){
  const record={name,declared_owned_queued_metadata_only:true,old_ready_dml_issued:false,rolled_back:false};records.push(record);
  const clone=only(await holder.request(associationCloneSQL(ctx,source,name)));
  try{
   await holder.request(acting('api'));record.result=only(await holder.request(`select pg_temp.data_reuse_capture(${literal(clone.version)}::uuid);`));
   const success=['duplicate','unrelated_malformed'].includes(name);assert.equal(record.result.ok,success);
   if(success){assert.equal(record.result.captured,1);await holder.request('reset role;');record.pins=only(await holder.request(`select pg_temp.data_reuse_pin_projection(${literal(clone.version)}::uuid);`));assert.equal(record.pins.raw_count,1);assert.equal(record.pins.english_count,1);}
   else assert.equal(record.result.code,name==='matched_malformed'?'22P02':'SNAPSHOT_INVALID');
  }finally{await holder.request('reset role;rollback to savepoint data_reuse_association;release savepoint data_reuse_association;');record.rolled_back=true;}
 }
}

export async function verifyDataReuseCases(ctx){
 const {holder,contender,observer,profiles,acting,id,variant,value,baseline}=ctx;
 const evidence=ctx.report.data_reuse_cases[variant]={budget:[],generation:[],expiry:{},capture_associations:[]};
 const helpers=await readFile(new URL('./cases.sql',import.meta.url),'utf8');await holder.request('reset role;'+helpers);
 const noteId=id('candidate-2'),large=profiles.large;
 const budget={name:'actual_oversize_private_row',note_bytes:4194304,rolled_back:false};evidence.budget.push(budget);
 await holder.request(`reset role;begin;update eps.candidates set confirmation_note=repeat('x',4194304)where id=${literal(noteId)}::uuid;`);
 try{
  const cost=only(await holder.request(`select jsonb_build_object('over_budget',pg_column_size(c)::bigint+octet_length(c::text)::bigint+octet_length(c.id::text)+256>4194304,'note_bytes',octet_length(c.confirmation_note))from eps.candidates c where c.id=${literal(noteId)}::uuid;`));
  budget.cost=cost;assert.equal(cost.over_budget,true);assert.equal(cost.note_bytes,4194304);
  await holder.request(acting('api'));budget.snapshot=only(await holder.request(metric('snapshot',large)));assert.equal(budget.snapshot.ok,true);
 }finally{await holder.request('rollback;reset role;');budget.rolled_back=true;}
 assert.deepEqual(await value('select locksource41_proof.row_hashes();'),baseline);

 // Source video1 is already retained by synthetic Ready metadata. Observe its
 // unchanged filename privately; never mutate that protected source asset.
 await generationCase(ctx,evidence.generation,'private_asset_metadata','',['not_captured'],1,version=>captureAssociations(ctx,evidence.capture_associations,version));
 await generationCase(ctx,evidence.generation,'no_video',`update eps.workspace_candidates set selected_candidate_media_id=null,selected_frame_asset_ids='{}'where id=${literal(id('pool-1-1'))}::uuid;`,[],0);
 for(const status of['not_captured','not_provided','available','unavailable'])await generationCase(ctx,evidence.generation,'english_'+status,englishSetup(id,status),[status],1);
 assert.deepEqual(await value('select locksource41_proof.row_hashes();'),baseline);

 // Independent relation barrier proves that the call has entered projection
 // after its initial authority checks. The controlled JWT expires during wait.
 const dbClock=async()=>only(await observer.request("reset role;select jsonb_build_object('epoch',extract(epoch from clock_timestamp()));"));
 const expires=Math.floor(Number((await dbClock()).epoch))+4;
 await holder.request('reset role;begin;lock table eps.candidate_media_frames in access exclusive mode;');
 await contender.request('begin;'+acting('mcp','eps_review_owner',ACTOR,{exp:expires}));
 const pending=contender.request(metric('review',profiles.control));let observed=false;
 for(let i=0;i<80;i++){
  const wait=only(await observer.request(`reset role;select jsonb_build_object('waiting',exists(select 1 from pg_locks where pid=${contender.pid} and not granted and relation='eps.candidate_media_frames'::regclass)and ${holder.pid}=any(pg_blocking_pids(${contender.pid})));`));
  if(wait.waiting){observed=true;break;}await setTimeout(20);
 }
 evidence.expiry.actual_distinct_pid_relation_wait=observed;
 if(observed){const clock=await dbClock();await setTimeout(Math.max(0,expires*1000+125-Number(clock.epoch)*1000));}
 const afterClock=await dbClock();evidence.expiry.database_clock_expired=Number(afterClock.epoch)>expires;
 evidence.expiry.seconds_after_expiry=Number(afterClock.epoch)-expires;
 await holder.request('rollback;reset role;');const response=only(await pending);evidence.expiry.response=response;
 await contender.request('rollback;reset role;');
 assert(observed,'DATA_REUSE_ACTUAL_EXPIRY_WAIT_REQUIRED');
 assert.equal(evidence.expiry.database_clock_expired,true);
 if(variant==='candidate'){assert.equal(response.ok,false);assert(['CAPABILITY_REQUIRED','RESOURCE_NOT_FOUND','AUTH_REQUIRED','42501'].includes(response.code));}
 assert.deepEqual(await value('select locksource41_proof.row_hashes();'),baseline);
}

export function assertDataReuseEquality(evidence){
 assert(evidence.old&&evidence.candidate);
 assert.equal(evidence.old.budget[0].snapshot.contract_hash,evidence.candidate.budget[0].snapshot.contract_hash);
 assert.equal(evidence.old.generation.length,6);assert.equal(evidence.candidate.generation.length,6);
 for(let i=0;i<6;i++){
  const before=evidence.old.generation[i],after=evidence.candidate.generation[i];
  assert.equal(before.name,after.name);assert.deepEqual(before.projection,after.projection);assert.deepEqual(before.pins,after.pins);
 }
 assert.equal(evidence.old.capture_associations.length,6);assert.equal(evidence.candidate.capture_associations.length,6);
 for(let i=0;i<6;i++){
  const before=evidence.old.capture_associations[i],after=evidence.candidate.capture_associations[i];
  assert.equal(before.name,after.name);assert.equal(before.result.ok,after.result.ok);assert.equal(before.result.code,after.result.code);
  if(before.result.ok){assert.equal(before.result.captured,after.result.captured);assert.deepEqual(before.pins,after.pins);}
 }
 assert.equal(evidence.candidate.expiry.actual_distinct_pid_relation_wait,true);
 assert.equal(evidence.candidate.expiry.response.ok,false);
 assert(sha(JSON.stringify(evidence)).length===64);
}
