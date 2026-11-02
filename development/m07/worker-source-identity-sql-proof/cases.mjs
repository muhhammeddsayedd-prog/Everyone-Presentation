/** New owned40 proof only. Imports are inert; all execution is default off. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { clearTimeout, setTimeout } from 'node:timers';
import { pathToFileURL, URL } from 'node:url';
export const EXECUTION_ENABLED=false;
const sha=raw=>createHash('sha256').update(raw).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const json=value=>quote(JSON.stringify(value))+'::jsonb';
const only=text=>{const values=text.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(values.length,1);return values[0];};
const ACTOR='b9380001-0000-4000-8000-000000000001';
const REASON='Owned worker40 — preserve exact reason\nالعربية';

async function bridge(action,value,ctx){
 return new Promise((resolve,reject)=>{
  const child=spawn('D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe',['-X','utf8','-B',new URL('./local.py',import.meta.url).pathname.replace(/^\/([A-Z]:)/u,'$1'),action],{cwd:ctx.root,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
  let output='',error='',bytes=0,expired=false;const timer=setTimeout(()=>{expired=true;child.kill();},30000);
  for(const[stream,out]of[[child.stdout,true],[child.stderr,false]])stream.on('data',raw=>{bytes+=raw.length;if(bytes>32*1024**2)child.kill();else if(out)output+=raw;else error+=raw;});
  child.stdin.on('error',()=>{});child.once('error',()=>{clearTimeout(timer);reject(Error('WORKER40_BRIDGE_FAILED'));});child.once('close',code=>{clearTimeout(timer);if(code!==0||expired||bytes>32*1024**2||error)reject(Error('WORKER40_BRIDGE_FAILED'));else{try{resolve(JSON.parse(output));}catch{reject(Error('WORKER40_BRIDGE_FAILED'));}}});
  const raw=JSON.stringify(value);assert(Buffer.byteLength(raw)<=32*1024**2);child.stdin.end(raw);
 });
}
function acting(){return `do $actor$begin perform set_config('request.jwt.claim.sub','${ACTOR}',true);perform set_config('request.jwt.claims',jsonb_build_object('sub','${ACTOR}','role','authenticated','is_anonymous',false,'exp',floor(extract(epoch from clock_timestamp()))+600)::text,true);perform set_config('request.headers','{"x-eps-client-type":"mcp","x-eps-request-id":"worker40-owned-reason"}',true);end$actor$;`;}
export function reasonFixture(run){
 // The link is a declared NEW synthetic row. Real series creation and revoke
 // RPCs exercise current permission/reason handling without gateway mutation or
 // pruning any retained old nonce/session/media row.
 return `begin;set local search_path='';
create temporary table worker40_context as select s.workspace_id,w.project_id,ap.id audience_preset_id from eps.presentation_series s join eps.workspaces w on w.id=s.workspace_id join public.projects p on p.id=w.project_id cross join lateral(select a.id from eps.audience_presets a where a.scope='external'and not a.archived and not exists(select 1 from eps.presentation_series other where other.workspace_id=w.id and other.audience_preset_id=a.id and other.output_type='selection'and not other.archived)order by a.id limit 1)ap where not s.archived and s.latest_ready_version_id is not null and s.audience_snapshot->>'scope'='external'and w.archived_at is null and p.archived_at is null order by s.id limit 1;
do $context$begin if(select count(*)from worker40_context)<>1 then raise exception'WORKER40_RETAINED_SYNTHETIC_CONTEXT_REQUIRED';end if;end$context$;
insert into public.app_capability_grants(principal_id,capability)select '${ACTOR}'::uuid,cap from unnest(array['presentations.generate','review_links.manage'])cap;
insert into public.project_memberships(project_id,principal_id,can_write)select project_id,'${ACTOR}'::uuid,true from worker40_context;
create temporary table worker40_created(series jsonb,link uuid default gen_random_uuid(),result jsonb);grant select on worker40_context to authenticated;grant select,insert,update on worker40_created to authenticated;
${acting()}set local role authenticated;
insert into worker40_created(series)select public.eps_create_presentation_series(jsonb_build_object('workspace_id',workspace_id,'output_type','selection','audience_preset_id',audience_preset_id,'title','Owned worker40 reason fixture'),${quote('worker40-series-'+run)})from worker40_context;
reset role;
do $series$begin if(select count(*)from worker40_created)<>1 or exists(select 1 from worker40_created where series->'latest_ready_version_id'is distinct from'null'::jsonb or series#>>'{audience_snapshot,scope}'is distinct from'external')then raise exception'WORKER40_NORMAL_PREPARING_REQUIRED';end if;end$series$;
insert into eps.review_links(id,series_id,label,token_digest,expires_at,created_by)select link,(series->>'id')::uuid,'Owned worker40 synthetic link',encode(sha256(convert_to(${quote('worker40-nonsecret-link-'+run)},'UTF8')),'hex'),clock_timestamp()+interval'1day','${ACTOR}'::uuid from worker40_created;
set local role authenticated;update worker40_created set result=public.eps_revoke_review_link(link,${json({row_version:1,reason:REASON})},${quote('worker40-revoke-'+run)});reset role;
select jsonb_build_object('audit_id',a.id,'link_id',a.resource_id,'reason_exact',a.reason=${quote(REASON)},'client_mcp',a.client_type='mcp','request_exact',a.request_id='worker40-owned-reason','audit_count',(select count(*)from eps.audit_events e where e.resource_id=a.resource_id and e.action='review.revoke_link'),'new_series_no_versions',not exists(select 1 from eps.presentation_versions v where v.series_id=(c.series->>'id')::uuid))from worker40_created c join eps.audit_events a on a.resource_id=c.link and a.action='review.revoke_link';commit;`;
}
export async function runCases(ctx,cfg){
 assert(EXECUTION_ENABLED,'WORKER40_SQL_PROOF_DISABLED');assert.notEqual(ctx.system,'7701520506262638626');assert.equal(ctx.root,'D:/Everyone/Presentation/Everyone-Presentation-Studio');assert.equal(ctx.report.dispatch_once_claim_created,true);
 for(const[file,digest]of Object.entries(cfg.source_pins))assert.equal(sha(await readFile(file)),digest);
 const guard=`set session authorization postgres;set timezone='UTC';set eps.worker39.run=${quote(ctx.runId)};set eps.worker40.run=${quote(ctx.runId)};do $owned$begin if current_database()<>'project39'or(pg_control_system()).system_identifier::text<>${quote(ctx.system)}then raise exception'WORKER40_OWNED_TARGET_REQUIRED';end if;end$owned$;`;
 const query=async sql=>{await ctx.inspect();return only((await ctx.sql(guard+sql)).stdout);};
 const privateWrite=async(name,value)=>{assert(/^[a-z0-9-]+\.json$/u.test(name));const file=path.join(ctx.privateRoot,name);assert.equal(path.dirname(file),ctx.privateRoot);const raw=JSON.stringify(value);assert(Buffer.byteLength(raw)<=32*1024**2);await writeFile(file,raw,{flag:'wx',mode:0o600});return {path:path.relative(ctx.root,file).replaceAll('\\','/'),sha256:sha(raw)};};
 try{
  // Declared clone-only terminal/config/managed fixtures have already passed
  // their exact preimage checks in the sealed outer controller.
  const from="current_user<>'postgres'or current_database()<>'postgres'",to="current_user<>'postgres'or current_database()<>'project39'or(pg_control_system()).system_identifier::text<>"+quote(ctx.system)+"or current_setting('eps.worker40.run',true)is distinct from"+quote(ctx.runId);
  assert.equal(cfg.migration40.split(from).length,2);const migration=cfg.migration40.replace(from,to);assert.equal(migration.replace(to,from),cfg.migration40);
  await ctx.sql(guard+'begin;'+migration+"insert into supabase_migrations.schema_migrations(version,statements,name)values('20261102085405',array[]::text[],'m07_review_link_action_reason');commit;");
  const concurrency=await import(pathToFileURL(cfg.concurrency_file).href);assert.equal(sha(await readFile(cfg.concurrency_file)),cfg.concurrency_sha256);
  const raw=await readFile(cfg.worker_fixture_file);assert.equal(sha(raw),cfg.worker_fixture_sha256);const fixture=concurrency.adaptFixture(raw,{database:'project39',system_identifier:ctx.system},ctx.runId);await ctx.sql(guard+"begin;set local eps.worker38.concurrency='owned-local-v1';"+fixture.text+'reset role;commit;');const evidence={...fixture};delete evidence.text;ctx.report.worker40_fixture=evidence;
  const audit=await query(reasonFixture(ctx.runId));assert.equal(audit.reason_exact,true);assert.equal(audit.client_mcp,true);assert.equal(audit.request_exact,true);assert.equal(audit.audit_count,1);assert.equal(audit.new_series_no_versions,true);await privateWrite('reason-fixture.json',audit);
  const snapshot=()=>query("begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='60s';"+cfg.snapshot_sql+'as worker_identity_release;rollback;');
  const checkpoint=()=>query(cfg.checkpoint_sql);const initial=await snapshot();assert.deepEqual(await snapshot(),initial);assert(initial.schema40.reason.historical_nonnull>0);assert.equal((await bridge('check',{initial,observed:initial,system:ctx.system,run:ctx.runId},ctx)).result,'passed');
  let before=initial,beforeCheckpoint=await checkpoint();assert.deepEqual(beforeCheckpoint.state,before);assert(beforeCheckpoint.application_tables.audit_events.some(row=>row.id===audit.audit_id&&row.reason===REASON));await privateWrite('before-checkpoint.json',beforeCheckpoint);
  ctx.report.worker40_metadata_negatives=[];
  for(const[label,sql]of[['ACL','grant select on eps.oauth_consent_claims to anon;'],['function_value',"alter function eps.project_dto(uuid) set statement_timeout='1234ms';"]]){
   const observed=await query("begin;set local search_path='';"+sql+cfg.snapshot_sql+'as worker_identity_release;rollback;');assert.equal((await bridge('check',{initial,observed,system:ctx.system,run:ctx.runId},ctx)).result,'refused');assert.deepEqual(await snapshot(),initial);ctx.report.worker40_metadata_negatives.push({label,actual_guard_refused:true,exact_after_rollback:true});
  }
  // A real rollback-only reason mutation changes the full current row hash.
  // Render that observed image, then require its exact preimage refusal against
  // the restored database; no synthetic wrong hash or committed audit edit.
  const changed=await query("begin;update eps.audit_events set reason=reason||' changed'where id="+quote(audit.audit_id)+'::uuid;'+cfg.snapshot_sql+'as worker_identity_release;rollback;');assert.notEqual(changed.schema40.canonical.base.data.audit_events.sha256,initial.schema40.canonical.base.data.audit_events.sha256);assert.deepEqual(await snapshot(),initial);
  const negative=await bridge('render',{initial,before:changed,phase:'pause',marker:randomUUID(),system:ctx.system,run:ctx.runId},ctx);let refused=false;
  try{await query(negative.sql);}catch(error){refused=/WORKER_IDENTITY_PREIMAGE_CHANGED/u.test(error.diagnostic?.stderr??'');if(!refused)throw error;}
  assert(refused);assert.deepEqual(await snapshot(),initial);ctx.report.full_reason_actual_hash_preimage_refused=true;
  ctx.report.worker40_phases=[];
  for(const phase of['pause','pin','resume']){
   const marker=randomUUID(),request={initial,before,phase,marker,system:ctx.system,run:ctx.runId},rendered=await bridge('render',request,ctx);const phaseRecord={phase,sql_sha256:rendered.sql_sha256,normal_commit_nonce_observed:false};ctx.report.worker40_phases.push(phaseRecord);
   await privateWrite(phase+'-diagnostic-claim.json',{marker,before_sha256:sha(JSON.stringify(before)),sql_sha256:rendered.diagnostic_sha256,automatic_retry:false});const observed=await query(rendered.diagnostic_sql);phaseRecord.private_diagnostic=await privateWrite(phase+'-diagnostic-poststate.json',observed);const diagnostic=await bridge('diagnose',{...request,observed},ctx);phaseRecord.diagnostic=diagnostic;assert.equal(diagnostic.result,'passed');assert.equal(diagnostic.difference_count,0);assert.deepEqual(await snapshot(),before);
   await privateWrite(phase+'-claim.json',{marker,sql_sha256:rendered.sql_sha256,before_sha256:sha(JSON.stringify(before)),automatic_retry:false});assert.deepEqual(await snapshot(),before);assert.deepEqual(await query(rendered.sql),{phase,marker});phaseRecord.normal_commit_nonce_observed=true;await privateWrite(phase+'-normal.json',{phase,marker,normal_return_observed:true});const after=await snapshot();assert.deepEqual(await snapshot(),after);const afterCheckpoint=await checkpoint();assert.deepEqual(afterCheckpoint.state,after);phaseRecord.checkpoint=await privateWrite(phase+'-checkpoint.json',afterCheckpoint);const compared=await bridge('compare',{initial,before_checkpoint:beforeCheckpoint,after_checkpoint:afterCheckpoint,phase,system:ctx.system,run:ctx.runId},ctx);assert.equal(compared.result,'passed');phaseRecord.preservation=compared;phaseRecord.two_equal_independent_readbacks=true;before=after;beforeCheckpoint=afterCheckpoint;
  }
  assert.equal(before.schema40.canonical.processing_config.frame_extraction_config.public.native_image_id,cfg.native_pin_value);assert(Object.values(before.schema40.canonical.processing_config).every(row=>row.public.enabled));
  await concurrency.runCases(ctx,cfg);
  Object.assign(ctx.report,{history_count:40,native_pin_value:cfg.native_pin_value,full76_rows_preserved:true,full_nonnull_audit_reason_preserved:true,unknown_metadata_ACL_value_refused:true,actual_diagnostic_rollback_zero_difference:true,all_three_guarded_normal_nonces_and_equal_readbacks:true,owned_oauth_count_qualification:cfg.owned_oauth_count_qualification,canonical_identity_admission_claimed:false});
 }catch(error){try{await privateWrite('first-owned-error.json',{name:error?.name??null,message:error?.message??null,diagnostic:error?.diagnostic??null});ctx.report.first_owned_error_saved_privately=true;}catch{ctx.report.first_owned_error_capture_failed=true;}throw error;}
}
