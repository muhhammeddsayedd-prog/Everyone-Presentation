/** Fresh owned PG17 proof. Importing is inert; no historical entry is called. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { session } from './session.mjs';
import { verifyHeld, verifyEdges } from './probes.mjs';
export const EXECUTION_ENABLED=false;
export const ACTOR='a4410000-0000-4000-8000-000000000001',OTHER='a4410000-0000-4000-8000-000000000002';
const CLIENT='a4410000-0000-4000-8000-000000000003',SID='a4410000-0000-4000-8000-000000000004';
const RESOURCE='https://everyone-presentation-pilot.vercel.app/mcp';
const CAPABILITIES=['projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review','presentations.generate','review_links.manage'];
const EXPECTED_GENERATE='b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08';
export const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
export const json=value=>literal(JSON.stringify(value))+'::jsonb';
export const sha=value=>createHash('sha256').update(value).digest('hex');
const only=value=>{assert.equal(value.length,1);return value[0];};
const rows=text=>text.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
export const idFor=(run,label)=>{const h=createHash('md5').update(run+':'+label).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
export function acting(mode='api',role='eps_review_owner',actor=ACTOR,override={}){
 assert(['api','mcp'].includes(mode)&&['eps_review_owner','authenticated'].includes(role));
 assert([ACTOR,OTHER].includes(actor));
 const now=Math.floor(Date.now()/1000),claims={sub:actor,role:'authenticated',is_anonymous:false,...(mode==='mcp'?{client_id:CLIENT,session_id:SID,aud:RESOURCE,scope:'openid',iat:now-1,exp:now+3600,eps_delegation:{v:1,resource:RESOURCE,client_id:CLIENT,capabilities:CAPABILITIES}}:{}),...override};
 return `reset role;set statement_timeout='8s';do $actor$begin perform set_config('request.jwt.claim.sub',${literal(actor)},false);perform set_config('request.jwt.claims',${json(claims)}::text,false);perform set_config('request.headers',${json({'x-eps-client-type':mode,'x-eps-request-id':'synthetic-locksource41'})}::text,false);end$actor$;set role ${role};`;
}
export function owned40(migration,system,run){
 assert(/^\d{10,30}$/u.test(system)&&system!=='7701520506262638626'&&/^[0-9a-f-]{36}$/u.test(run));
 const from="current_user<>'postgres'or current_database()<>'postgres'";
 const to="current_user<>'postgres'or current_database()<>'project39'or(pg_control_system()).system_identifier::text<>"+literal(system)+"or current_setting('eps.locksource41.run',true)is distinct from"+literal(run);
 assert.equal(migration.split(from).length,2);const adapted=migration.replace(from,to);
 assert.equal(adapted.replace(to,from),migration);return adapted;
}
const measure=(operation,profile,input,key)=>`select pg_temp.locksource41_measure(${literal(operation)},${literal(profile.workspace)}::uuid,${literal(profile.series)}::uuid,${input?json(input):'null'},${key?literal(key):'null'});`;
const meta=profile=>`select pg_temp.locksource41_review_meta(${literal(profile.workspace)}::uuid,${literal(profile.series)}::uuid);`;
const SNAPSHOT_SQL=`select locksource41_proof.row_hashes();`;

export async function runCases(ctx){
 assert(EXECUTION_ENABLED,'LOCKSOURCE41_EXECUTION_DISABLED');assert.notEqual(ctx.system,'7701520506262638626');
 const sessions=[],start=async tag=>{const s=session(ctx,tag);sessions.push(s);return s.start();};
 const value=async text=>only(rows((await ctx.sql('set session authorization postgres;'+text)).stdout));
 const local=async file=>readFile(new URL('./'+file,import.meta.url),'utf8');
 const id=label=>idFor(ctx.runId,label),key=tag=>'locksource41-'+ctx.runId+'-'+tag;
 const install=async source=>ctx.sql('set session authorization postgres;'+source.replace('create function eps.presentation_lock_sources','create or replace function eps.presentation_lock_sources'));
 let baseline,sourceBefore;
 try{
  ctx.report.checkpoint='locksource41-exact40';
  const migration=await readFile(ctx.bindings.migration40,'utf8');assert.equal(sha(migration),ctx.bindings.migration40Sha);
  await ctx.sql('set session authorization postgres;begin;set local eps.locksource41.run='+literal(ctx.runId)+';'+owned40(migration,ctx.system,ctx.runId)+"insert into supabase_migrations.schema_migrations(version,statements,name)values('20261102085405',array[]::text[],'m07_review_link_action_reason');commit;");
  ctx.report.exact40_owned_adapter={source_sha256:sha(migration),only_database_system_run_predicate_adapted:true,inverse_byte_equal:true};
  ctx.report.checkpoint='locksource41-fixture-prelude';await ctx.sql('set session authorization postgres;begin;set local eps.locksource41.run='+literal(ctx.runId)+';'+await local('fixture.sql')+'commit;');
  const observer=await start('observer'),holder=await start('holder'),contender=await start('contender'),writer=await start('writer');
  assert.equal(new Set(sessions.map(s=>s.pid)).size,4);
  const temporary=await local('temporary.sql'),cohorts=await local('cohorts.sql');
  for(const s of sessions)await s.request(temporary+cohorts);
  const preset=await value("select jsonb_build_object('id',id)from eps.audience_presets where not archived and scope='external'order by id limit 1;");assert(preset.id);
  const profiles={};
  for(const label of['control','large','background']){
   ctx.report.checkpoint='locksource41-context-'+label;
   const actor=label==='background'?OTHER:ACTOR;await holder.request(acting('api','authenticated',actor));
   const project=only(await holder.request(`select public.eps_create_project(${json({name:'Synthetic lock-source '+label,presentation_type:'casting'})},${literal(key(label+'-project'))});`));assert(project.id);
   const workspace=only(await holder.request(`select public.eps_create_workspace(${json({project_id:project.id,initial_output:'selection'})},${literal(key(label+'-workspace'))});`));assert(workspace.id);
   const series=only(await holder.request(`select public.eps_create_presentation_series(${json({workspace_id:workspace.id,output_type:'selection',audience_preset_id:preset.id,title:'Synthetic lock-source '+label})},${literal(key(label+'-series'))});`));assert(series.id);assert.equal(series.template_version,'1.1.0');
   profiles[label]={project:project.id,workspace:workspace.id,series:series.id};
   await ctx.sql(`set session authorization postgres;insert into locksource41_proof.context values(${literal(label)},${literal(project.id)}::uuid,${literal(workspace.id)}::uuid,${literal(series.id)}::uuid);`);
  }
  await holder.request('reset role;');
  for(const file of['scale.sql','background.sql']){ctx.report.checkpoint='locksource41-fixture-'+file;await ctx.sql('set session authorization postgres;begin;set local eps.locksource41.run='+literal(ctx.runId)+';'+await local(file)+'commit;');}
  const counts=await value(await local('counts.sql'));
  assert.deepEqual(Object.fromEntries(Object.entries(counts).filter(([k])=>k!=='profiles')),{candidates:28,media:27,frames:328,assets:501,ready_versions:13,total_versions:14,slides:63,pins:60});
  const large=counts.profiles.find(p=>p.label==='large');assert.deepEqual(Object.fromEntries(Object.entries(large).filter(([k])=>!['label','assignment_weighted_fact_source_bytes'].includes(k))),{active_roles:2,archived_roles:34,active_slots:16,archived_slots:547,active_assignments:19,archived_assignments:1,active_pools:11,archived_pools:4,selected_candidates:11,selected_media:11,selected_frames:33});
  ctx.report.performance={fixture_counts:counts,fit_is_declared_synthetic_metadata_not_renderer_measurement:true,background_is_synthetic_metadata_not_render_storage_or_provider_acceptance:true,api_and_mcp_are_actual_local_RLS_with_controlled_claims_not_signed_OAuth_protocol:true};
  // These declared fit rows qualify metadata only. No DOM/renderer measurement is claimed.
  for(const label of['control','large']){
   ctx.report.checkpoint='locksource41-synthetic-fit-'+label;
   const p=profiles[label];await holder.request(acting('mcp'));const before=only(await holder.request(meta(p)));assert.equal(before.fit_status,'unmeasured');
   const fitJob=id(label+'-fit-job');
   await ctx.sql(`set session authorization postgres;begin;insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,dedupe_key,status,stage,correlation_id)values(${literal(fitJob)}::uuid,${literal(p.workspace)}::uuid,${literal(ACTOR)}::uuid,'review_fit',${literal(p.series)}::uuid,'{}',repeat('f',64),${literal(key(label+'-fit'))},'succeeded','measure_review_fit',${literal(key(label+'-fit'))});insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,result)values(${literal(fitJob)}::uuid,${literal(p.workspace)}::uuid,${literal(p.series)}::uuid,${literal(before.input.expected_input_fingerprint)},'measured','{"overflows":[],"measured_at":"2026-11-02T00:00:00Z"}');commit;`);
   const after=only(await holder.request(meta(p)));assert.equal(after.fit_status,'measured');assert.equal(after.can_generate,true);assert.deepEqual(after.input,before.input);p.meta=after;
  }
  await holder.request('reset role;');
  sourceBefore=await value("select jsonb_build_object('lock_source',encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'authority',to_jsonb(p)-'prosrc','generate_source',(select encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')from pg_proc where oid='public.eps_generate_version(uuid,jsonb,text)'::regprocedure))from pg_proc p where oid='eps.presentation_lock_sources(uuid,text,text)'::regprocedure;");
  assert.equal(sourceBefore.lock_source,ctx.bindings.baseSha);assert.equal(sourceBefore.generate_source,EXPECTED_GENERATE);
  baseline=await value(SNAPSHOT_SQL);assert.equal(baseline.reason_nonnull_rows,1);assert.equal(baseline.ready_versions,13);assert.equal(baseline.pins,60);
  const results={},security={},locks={},edges={},races={};Object.assign(ctx.report.performance,{results,security,locks,edges,races,post40_complete_baseline:baseline});
  for(const variant of['old','candidate']){
   await install(variant==='old'?ctx.bindings.baseSource:ctx.bindings.candidateSource);
   const changed=await value("select jsonb_build_object('source',encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'authority',to_jsonb(p)-'prosrc')from pg_proc p where oid='eps.presentation_lock_sources(uuid,text,text)'::regprocedure;");
   assert.equal(changed.source,variant==='old'?ctx.bindings.baseSha:ctx.bindings.candidateSha);assert.deepEqual(changed.authority,sourceBefore.authority);
   results[variant]={};
   for(const mode of['api','mcp'])for(const label of['control','large']){
    const p=profiles[label],record={};results[variant][mode+'_'+label]=record;
    for(const operation of['locks','review','snapshot','hash']){
     record[operation]=[];
     for(let sample=0;sample<2;sample++){
      ctx.report.checkpoint='locksource41-'+variant+'-'+mode+'-'+label+'-'+operation+'-'+sample;
      await holder.request('begin;'+acting(mode));const result=only(await holder.request(measure(operation,p)));await holder.request('rollback;reset role;');
      record[operation].push(result);assert(result.ok||result.code==='57014');if(variant==='candidate')assert.equal(result.ok,true,'LOCKSOURCE41_CANDIDATE_COMPONENT_FAILED');
     }
    }
    await holder.request('begin;'+acting(mode));const current=only(await holder.request(meta(p)));record.current_review=current;await holder.request('rollback;reset role;');assert.deepEqual(current,p.meta);
    ctx.report.checkpoint='locksource41-'+variant+'-'+mode+'-'+label+'-generate';await holder.request('begin;'+acting(mode,'authenticated'));const generation=only(await holder.request(measure('generate',p,p.meta.input,key(variant+'-'+mode+'-'+label))));
    record.generation=generation;assert(generation.ok||generation.code==='57014');
    if(generation.ok){assert(generation.resource_id);await holder.request('reset role;');generation.projection=only(await holder.request(`select pg_temp.locksource41_generated_projection(${literal(generation.resource_id)}::uuid);`));assert.equal(generation.projection.job_status,'queued');assert.equal(generation.projection.outbox_rows,1);}
    await holder.request('rollback;reset role;');if(variant==='candidate')assert.equal(generation.ok,true,'LOCKSOURCE41_CANDIDATE_GENERATION_FAILED');record.generation=generation;
    results[variant][mode+'_'+label]=record;
   }
   security[variant]=[];
   for(const denied of[
    {name:'unrelated_project_actor',actor:OTHER,mode:'api',override:{}},
    {name:'mcp_capability_intersection',actor:ACTOR,mode:'mcp',override:{eps_delegation:{v:1,resource:RESOURCE,client_id:CLIENT,capabilities:['workspaces.read']}}},
    {name:'mcp_wrong_session',actor:ACTOR,mode:'mcp',override:{session_id:id('absent-session')}}
   ]){
    await holder.request('begin;'+acting(denied.mode,'authenticated',denied.actor,denied.override));const deniedResult=only(await holder.request(measure('generate',profiles.large,profiles.large.meta.input,key(variant+'-'+denied.name))));await holder.request('rollback;reset role;');
    security[variant].push({name:denied.name,ok:deniedResult.ok,code:deniedResult.code});assert.equal(deniedResult.ok,false);assert(['42501','CAPABILITY_REQUIRED','RESOURCE_NOT_FOUND','AUTH_REQUIRED'].includes(deniedResult.code));
   }
   const context={...ctx,holder,contender,observer,writer,workspace:profiles.large.workspace,series:profiles.large.series,profiles,acting,id,variant:variant==='candidate'?'new':'old',value};
   ctx.report.checkpoint='locksource41-'+variant+'-cohorts';locks[variant]=await verifyHeld(context);if(variant==='candidate')assert.equal(locks[variant].result,'passed');
   ctx.report.checkpoint='locksource41-'+variant+'-edges';edges[variant]=await verifyEdges(context);if(variant==='candidate')assert.equal(edges[variant].result,'passed');
   await holder.request(`reset role;begin;delete from eps.candidate_media_frames where candidate_media_id=${literal(id('media-2'))}::uuid and asset_id=${literal(id('frame-4'))}::uuid;`+acting('mcp'));
   const missingLock=only(await holder.request(measure('locks',profiles.large))),missingSnapshot=only(await holder.request(measure('snapshot',profiles.large)));
   await holder.request('rollback;reset role;');edges[variant].missing_selected_frame={lock:missingLock,snapshot:missingSnapshot,removed_pair_restored_by_rollback:true};assert.equal(missingSnapshot.ok,true);assert.equal(missingSnapshot.can_generate,false);assert(missingSnapshot.blocking_codes.includes('FRAME_UNAVAILABLE'));
   if(variant==='candidate')assert.equal(missingLock.ok,true);
   ctx.report.checkpoint='locksource41-'+variant+'-races';context.raceEvidence=races[variant]=[];await changedSourceRaces(context);
   assert.deepEqual(await value(SNAPSHOT_SQL),baseline,'LOCKSOURCE41_FULL_BASELINE_CHANGED');
  }
  for(const key of Object.keys(results.candidate)){
   const a=results.old[key],b=results.candidate[key];
   for(const operation of['review','snapshot','hash'])for(let i=0;i<2;i++)if(a[operation][i].ok)assert.equal(a[operation][i].contract_hash,b[operation][i].contract_hash);
   if(a.generation.ok)assert.deepEqual(a.generation.projection,b.generation.projection);
  }
  assert.deepEqual(security.old,security.candidate);
  assert.equal(edges.old.missing_selected_frame.snapshot.contract_hash,edges.candidate.missing_selected_frame.snapshot.contract_hash);
  if(locks.old.result==='passed')assert.equal(locks.old.rowset_sha256,locks.candidate.rowset_sha256);
  await install(ctx.bindings.baseSource);assert.deepEqual(await value(SNAPSHOT_SQL),baseline);
  await ctx.sql("set session authorization postgres;update eps.presentation_processing_config c set enabled=b.enabled,renderer_version=b.renderer_version,application_origin=b.application_origin,max_manifest_bytes=b.max_manifest_bytes,max_pdf_bytes=b.max_pdf_bytes,max_pages=b.max_pages from locksource41_proof.config_before b where c.id=b.id;do $restore$begin if(select to_jsonb(c)from eps.presentation_processing_config c)is distinct from(select to_jsonb(b)from locksource41_proof.config_before b)then raise exception'LOCKSOURCE41_CONFIG_RESTORE_UNCONFIRMED';end if;end$restore$;");
  ctx.report.performance={results,security,locks,edges,races,fixture_counts:counts,post40_complete_baseline:baseline,full_reason_column_preserved:true,source_authority_unchanged:true,old_function_restored:true,original_presentation_config_restored:true,fit_is_declared_synthetic_metadata_not_renderer_measurement:true,background_is_synthetic_metadata_not_render_storage_or_provider_acceptance:true,api_and_mcp_are_actual_local_RLS_with_controlled_claims_not_signed_OAuth_protocol:true,active_and_archived_counts_separate:true};
  ctx.report.old_new_equality={standalone_review_and_fingerprint_equal:true,generated_projection_equal_where_old_generation_completed:true,old_generation_comparison_unavailable:Object.entries(results.old).filter(([,r])=>!r.generation.ok).map(([name])=>name),candidate_all_components_and_generations_passed:true,exact_original_predicate_cohorts_held_by_candidate:true,old_completed_lock_cohort_equal:locks.old.result==='passed'};
 }finally{for(const s of sessions)await s.finish();}
}

export async function changedSourceRaces(ctx){
 const {holder,contender,observer,writer,profiles,variant,id,value}=ctx,p=profiles.large,answers=ctx.raceEvidence??[];
 const mutations=[
  {name:'candidate_fact',sql:`update eps.candidates set facts=jsonb_set(facts,'{skills_summary}','"Synthetic concurrent change"')where id=${literal(id('candidate-2'))}::uuid;`},
  {name:'selected_frame_pair',sql:`delete from eps.candidate_media_frames where candidate_media_id=${literal(id('media-2'))}::uuid and asset_id=${literal(id('frame-4'))}::uuid;`},
  {name:'selected_pool',sql:`update eps.workspace_candidates set media_confirmed=false where id=${literal(id('pool-2-1'))}::uuid;`}
 ];
 for(const mutation of mutations){
  await writer.request('reset role;begin;'+mutation.sql);
  await contender.request('begin;'+acting('mcp'));const result=only(await contender.request(measure('locks',p)));await contender.request('rollback;reset role;');await writer.request('rollback;');
  answers.push({case:mutation.name,ok:result.ok,code:result.code,changed_rows_rolled_back:true});assert.equal(result.ok,false);assert(['INPUT_CHANGED','55P03','57014'].includes(result.code));if(variant==='new')assert.notEqual(result.code,'57014');
 }
 await writer.request(`reset role;begin;delete from eps.candidate_media_frames where candidate_media_id=${literal(id('media-2'))}::uuid and asset_id=${literal(id('frame-80'))}::uuid;`);
 await contender.request('begin;'+acting('mcp'));const unselected=only(await contender.request(measure('locks',p)));await contender.request('rollback;reset role;');await writer.request('rollback;');
 answers.push({case:'unselected_frame_change',ok:unselected.ok,...(unselected.code?{code:unselected.code}:{}),changed_rows_rolled_back:true});assert(unselected.ok||unselected.code==='57014');if(variant==='new')assert.equal(unselected.ok,true);
 // Real public generation waits on a separately held workspace row, then must
 // recheck membership/capabilities after that lock. Nothing is synthesized in SQL.
 for(const change of['membership','capability']){
  await holder.request(`reset role;begin;select jsonb_build_object('held',id)from eps.workspaces where id=${literal(p.workspace)}::uuid for update;`);
  await contender.request('begin;'+acting('mcp','authenticated'));
  const pending=contender.request(measure('generate',p,p.meta.input,'locksource41-'+ctx.runId+'-'+variant+'-race-'+change));
  let observed=false;
  for(let i=0;i<60;i++){
   const wait=only(await observer.request(`reset role;select jsonb_build_object('waiting',coalesce((select wait_event_type='Lock'and ${holder.pid}=any(pg_blocking_pids(pid))from pg_stat_activity where pid=${contender.pid}),false));`));
   if(wait.waiting){observed=true;break;}await setTimeout(25);
  }
  assert(observed,'LOCKSOURCE41_ACTUAL_WORKSPACE_WAIT_REQUIRED');
  const pre=await value(change==='membership'?`select to_jsonb(m)from public.project_memberships m where project_id=${literal(p.project)}::uuid and principal_id=${literal(ACTOR)}::uuid;`:`select to_jsonb(g)from public.app_capability_grants g where principal_id=${literal(ACTOR)}::uuid and capability='presentations.generate';`);
  const table=change==='membership'?'public.project_memberships':'public.app_capability_grants';
  await writer.request('reset role;'+(change==='membership'?`delete from ${table} where project_id=${literal(p.project)}::uuid and principal_id=${literal(ACTOR)}::uuid;`:`update ${table} set active=false where principal_id=${literal(ACTOR)}::uuid and capability='presentations.generate';`));
  await holder.request('rollback;');const result=only(await pending);await contender.request('rollback;reset role;');
  // Restore only the exact new synthetic authority preimage, never old rows.
  await writer.request('reset role;'+(change==='capability'?`delete from ${table} where principal_id=${literal(ACTOR)}::uuid and capability='presentations.generate';`:'')+`insert into ${table} select(populate).*from jsonb_populate_record(null::${table},${json(pre)})populate;`);
  answers.push({case:change+'_revoked_while_waiting',actual_distinct_pid_lock_wait:true,ok:result.ok,code:result.code,exact_new_authority_preimage_restored:true});assert.equal(result.ok,false);assert(['CAPABILITY_REQUIRED','RESOURCE_NOT_FOUND','42501','AUTH_REQUIRED'].includes(result.code));
 }
 // A real relation barrier pauses an already-entered helper. Revocation must
 // remain effective before it can return, including its preserved final check.
 await holder.request('reset role;begin;lock table eps.media_assets in access exclusive mode;');
 await contender.request('begin;'+acting('mcp'));
 const pending=contender.request(measure('locks',p));let observed=false;
 for(let i=0;i<150;i++){
  const wait=only(await observer.request(`reset role;select jsonb_build_object('waiting',exists(select 1 from pg_locks where pid=${contender.pid} and not granted and relation='eps.media_assets'::regclass)and ${holder.pid}=any(pg_blocking_pids(${contender.pid})));`));
  if(wait.waiting){observed=true;break;}await setTimeout(50);
 }
 let grant;
 if(observed){grant=await value(`select to_jsonb(g)from public.app_capability_grants g where principal_id=${literal(ACTOR)}::uuid and capability='presentations.generate';`);await writer.request(`reset role;update public.app_capability_grants set active=false where principal_id=${literal(ACTOR)}::uuid and capability='presentations.generate';`);}
 await holder.request('rollback;');const final=only(await pending);await contender.request('rollback;reset role;');
 if(grant)await writer.request(`reset role;delete from public.app_capability_grants where principal_id=${literal(ACTOR)}::uuid and capability='presentations.generate';insert into public.app_capability_grants select(populate).*from jsonb_populate_record(null::public.app_capability_grants,${json(grant)})populate;`);
 answers.push({case:'capability_revoked_inside_helper',actual_relation_wait:observed,ok:final.ok,code:final.code,authority_was_changed:observed});
 if(variant==='new')assert(observed,'LOCKSOURCE41_ACTUAL_IN_HELPER_RELATION_WAIT_REQUIRED');
 assert.equal(final.ok,false);assert((observed?['CAPABILITY_REQUIRED','RESOURCE_NOT_FOUND','42501','AUTH_REQUIRED']:['57014']).includes(final.code));
 return answers;
}
