-- A4 (m20) appearance observations, enrichment batches and search facets. Disposable replica only:
--   set EPS_REPLICA_CONTAINER=eps-cycle7-a4 && python -X utf8 development/cycle7/staging/replica.py apply
-- Synthetic people only. Everything runs in one transaction that is rolled back; the last line is one JSON result.
\set ON_ERROR_STOP on
begin;
-- The bare replica image has an older auth.users shape; eps.job_requester_active reads these Auth columns.
alter table auth.users add column if not exists is_anonymous boolean not null default false,add column if not exists deleted_at timestamptz,add column if not exists banned_until timestamptz;

create temp table a4_result(key text primary key,value jsonb not null);
create function pg_temp.ok(p_key text,p_condition boolean,p_detail jsonb default null) returns void language plpgsql as $$begin
 if p_condition is distinct from true then raise exception 'A4_CHECK_FAILED:% %',p_key,coalesce(p_detail::text,'');end if;
 insert into a4_result values(p_key,coalesce(p_detail,'true'::jsonb)) on conflict(key) do update set value=excluded.value;
end$$;
create function pg_temp.as_user(p_user uuid,p_sql text) returns jsonb language plpgsql as $$declare r jsonb;begin
 perform set_config('request.jwt.claims',json_build_object('sub',p_user,'role','authenticated','is_anonymous',false)::text,true);
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 execute 'set local role authenticated';execute p_sql into r;execute 'reset role';
 perform set_config('request.jwt.claims','',true);perform set_config('request.jwt.claim.sub','',true);
 return r;
end$$;
create function pg_temp.user_error(p_user uuid,p_sql text) returns text language plpgsql as $$begin
 perform pg_temp.as_user(p_user,p_sql);return 'NO_ERROR';
exception when others then return sqlerrm;end$$;
create function pg_temp.anon_error(p_sql text) returns text language plpgsql as $$begin
 perform set_config('request.jwt.claims','{"role":"anon"}',true);execute 'set local role anon';execute p_sql;execute 'reset role';return 'NO_ERROR';
exception when others then return sqlerrm;end$$;
create function pg_temp.facets(p_user uuid,p_filters jsonb) returns jsonb language sql as $$select pg_temp.as_user(p_user,format('select public.eps_candidate_facets(%L::jsonb)',p_filters))->'data'$$;
create function pg_temp.facet_count(p_data jsonb,p_facet text,p_value text) returns bigint language sql as $$
 select coalesce((select (v->>'count')::bigint from jsonb_array_elements(p_data->'facets') f,jsonb_array_elements(f->'values') v where f->>'key'=p_facet and v->>'value'=p_value),0)$$;
create function pg_temp.facet_field(p_data jsonb,p_facet text,p_field text) returns bigint language sql as $$
 select (f->>p_field)::bigint from jsonb_array_elements(p_data->'facets') f where f->>'key'=p_facet$$;
-- Worker path: the existing service dispatchers (claim, input, asset access, event) exactly as the runtime calls them.
create function pg_temp.run_job(p_job uuid,p_people jsonb,p_in bigint,p_out bigint,p_category text default null) returns jsonb language plpgsql as $$
declare j eps.jobs;lease jsonb;input jsonb;media jsonb:='[]';ref jsonb;access jsonb;receipt jsonb;begin
 select * into j from eps.jobs where id=p_job;
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',j.id,'stage','analyze_appearance','input_hash',j.input_hash,'workflow_execution_id','synthetic-n8n-1'));
 input:=eps.get_specs_stage_input(j.id,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 if input->>'stage'<>'analyze_appearance' or input->>'candidate_id'<>j.resource_id::text then raise exception 'A4_INPUT_MISMATCH';end if;
 for ref in select value from jsonb_array_elements(input->'media') loop
  access:=eps.get_job_asset_access(jsonb_build_object('job_id',j.id,'attempt_id',lease->>'attempt_id','lease_token',lease->>'lease_token','asset_id',ref->>'asset_id'));
  if access->>'asset_id'<>ref->>'asset_id' or access->>'grant_token'!~'^[A-Za-z0-9_-]{43}$' then raise exception 'A4_ACCESS_MISMATCH';end if;
  media:=media||jsonb_build_array(jsonb_build_object('media_ref',ref->>'media_ref','asset_id',ref->>'asset_id',
   'media_category',coalesce(p_category,case when ref->>'source_kind'='frame' then 'video_frame' else 'portfolio_photo' end),
   'people_count',jsonb_array_length(p_people),'ambiguous',jsonb_array_length(p_people)>1,'quality_note',null,
   'people',(select coalesce(jsonb_agg(jsonb_build_object('person_index',n-1,'position_note',case when jsonb_array_length(p_people)>1 then 'person '||n else null end,'attributes',p) order by n),'[]')
     from jsonb_array_elements(p_people) with ordinality t(p,n))));
 end loop;
 receipt:=eps.record_job_event(jsonb_build_object('event_id',gen_random_uuid(),'job_id',j.id,'attempt_id',lease->>'attempt_id','lease_token',lease->>'lease_token','stage','analyze_appearance',
  'sequence',1,'event_type','succeeded','input_hash',j.input_hash,'result_schema','candidate-appearance-result.v1',
  'result',jsonb_build_object('schema_version','1.0','model','synthetic-model-2026','prompt_version','appearance-v1','taxonomy_version','appearance-taxonomy.v1',
   'usage',jsonb_build_object('input_tokens',p_in,'output_tokens',p_out),'media',media)));
 return receipt;
end$$;
create function pg_temp.fail_job(p_job uuid,p_in bigint,p_out bigint) returns jsonb language plpgsql as $$declare j eps.jobs;lease jsonb;begin
 select * into j from eps.jobs where id=p_job;
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',j.id,'stage','analyze_appearance','input_hash',j.input_hash));
 return eps.record_job_event(jsonb_build_object('event_id',gen_random_uuid(),'job_id',j.id,'attempt_id',lease->>'attempt_id','lease_token',lease->>'lease_token','stage','analyze_appearance',
  'sequence',1,'event_type','failed','input_hash',j.input_hash,'error',jsonb_build_object('code','PROCESSING_FAILED','message','Synthetic refusal.','details',
   jsonb_build_object('usage',jsonb_build_object('input_tokens',p_in,'output_tokens',p_out)),'retryable',false)));
end$$;
create function pg_temp.attr(p_value text,p_confidence text default 'high') returns jsonb language sql as $$select jsonb_build_object('value',p_value,'confidence',p_confidence,'evidence','Visible in the synthetic image.')$$;
create function pg_temp.obs(p_candidate uuid,p_attribute text,p_person int default 0) returns setof eps.candidate_observations language sql as $$
 select * from eps.candidate_observations where candidate_id=p_candidate and attribute=p_attribute and person_index=p_person order by media_id$$;
create function pg_temp.review(p_user uuid,p_observation uuid,p_body jsonb,p_key text) returns jsonb language sql as $$
 select pg_temp.as_user(p_user,format('select public.eps_review_candidate_observation(%L::uuid,%L::jsonb,%L)',p_observation,p_body,p_key))$$;

-- Seed (synthetic). Replica mode skips FK/trigger work for the canonical shells; m20 rows are created by m20 functions.
set local session_replication_role=replica;
insert into auth.users(id,instance_id,aud,role,email)values
 ('a4000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a4-producer@example.invalid'),
 ('a4000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a4-viewer@example.invalid');
insert into public.app_capability_grants(principal_id,capability,active)values
 ('a4000000-0000-4000-8000-000000000001','cast.read',true),('a4000000-0000-4000-8000-000000000001','cast.write',true),('a4000000-0000-4000-8000-000000000001','cast.review',true),
 ('a4000000-0000-4000-8000-000000000001','operations.read',true),('a4000000-0000-4000-8000-000000000002','cast.read',true);
insert into public.projects(id,name)values('a4000000-0000-4000-8000-0000000000a1','A4 synthetic project');
insert into public.project_memberships(project_id,principal_id,can_write,active)values('a4000000-0000-4000-8000-0000000000a1','a4000000-0000-4000-8000-000000000001',true,true);
insert into eps.workspaces(id,project_id)values('a4000000-0000-4000-8000-0000000000b1','a4000000-0000-4000-8000-0000000000a1');
insert into eps.candidates(id,casting_id,facts,source_kind,created_by,archived_at)
select ('a4000000-0000-4000-8000-0000000000c'||n)::uuid,'A4-SYN-'||n,jsonb_build_object('name',name,'casting_id','A4-SYN-'||n,'age_or_range',null,'stated_gender',gender,'height_measurements',null,
 'languages',langs,'accents','[]'::jsonb,'skills_experience',null,'city',city,'previous_projects_roles',null,'classification',null),'archive','a4000000-0000-4000-8000-000000000001',archived
from(values(1,'Synthetic One','Female','Dubai','["Arabic","English"]'::jsonb,null::timestamptz),(2,'Synthetic Two',null,'Dubai','["Arabic"]'::jsonb,null),
 (3,'Synthetic Three',null,'Cairo','[]'::jsonb,null),(4,'Synthetic Archived',null,'Dubai','[]'::jsonb,now()),(5,'Synthetic Five',null,'Abu Dhabi','[]'::jsonb,null))v(n,name,gender,city,langs,archived);
-- Photos: C1 one photo, C5 one photo. Frames: C3 two introduction tapes with one frame each.
insert into eps.media_assets(id,purpose,filename,bucket,object_key,mime_type,size_bytes,sha256,width,height,status,origin_workspace_id)
select ('a4000000-0000-4000-8000-0000000001'||k)::uuid,'candidate_photo',k||'.jpg','eps-candidate-photos','archive/'||k||'.jpg','image/jpeg',1000,repeat(k,32),400,500,'ready','a4000000-0000-4000-8000-0000000000b1'
from unnest(array['11','12','51','52']) k;
insert into eps.candidate_photos(id,candidate_id,position,asset_id,thumb_asset_id,width,height,source_key)values
 ('a4000000-0000-4000-8000-000000000211','a4000000-0000-4000-8000-0000000000c1',1,'a4000000-0000-4000-8000-000000000111','a4000000-0000-4000-8000-000000000112',400,500,'syn/1'),
 ('a4000000-0000-4000-8000-000000000251','a4000000-0000-4000-8000-0000000000c5',1,'a4000000-0000-4000-8000-000000000151','a4000000-0000-4000-8000-000000000152',400,500,'syn/5');
-- Archive look/nationality/country labels and identity-worded tags are seeded on purpose: they must stay attributed
-- profile labels and never become facet or search keys.
insert into eps.candidate_attributes(candidate_id,name_ar,talent_type,hair_colour,playing_age,tags,cover_photo_id,look,nationality,country,skin_tone)values
 ('a4000000-0000-4000-8000-0000000000c1','أَحْمَد',  'talent','{Black}','{"Age 25-34"}','{Dancer,"European Look",Khaleeji,"Model Look","Saudi Lookalikes",Utopian}','a4000000-0000-4000-8000-000000000211',
  'European Look','Utopian','Atlantis','Arab'),
 ('a4000000-0000-4000-8000-0000000000c2',null,'real_family','{Brown}','{}','{" DANCER ",رَقص,"Middle Eastern Look",Emirati,"مظهر خليجي",Atlantis}',null,'Middle Eastern Look',null,'Atlantis',null);
update eps.candidate_attributes set hair_length='{Long}' where candidate_id='a4000000-0000-4000-8000-0000000000c2';
insert into eps.media_assets(id,purpose,filename,bucket,object_key,mime_type,size_bytes,sha256,width,height,duration_ms,status,origin_workspace_id)values
 ('a4000000-0000-4000-8000-000000000301','candidate_video','t1.mp4','eps-candidate-assets','assets/t1/original.mp4','video/mp4',1000,repeat('c',64),640,360,5000,'ready','a4000000-0000-4000-8000-0000000000b1'),
 ('a4000000-0000-4000-8000-000000000302','candidate_video','t2.mp4','eps-candidate-assets','assets/t2/original.mp4','video/mp4',1000,repeat('d',64),640,360,5000,'ready','a4000000-0000-4000-8000-0000000000b1');
insert into eps.media_assets(id,purpose,filename,bucket,object_key,mime_type,size_bytes,sha256,width,height,status,origin_workspace_id,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key,source_timestamp_ms)
select ('a4000000-0000-4000-8000-00000000031'||n)::uuid,'candidate_frame','frame-0.jpg','eps-candidate-outputs','jobs/x/attempts/y/f'||n||'.jpg','image/jpeg',900,repeat(n::text,64),640,360,'ready',
 'a4000000-0000-4000-8000-0000000000b1',('a4000000-0000-4000-8000-00000000030'||n)::uuid,gen_random_uuid(),gen_random_uuid(),'prepare_candidate','frame_0',1500*n from generate_series(1,2) n;
insert into eps.candidate_media(id,candidate_id,source_asset_id,selected_frame_asset_ids,source_position)
select ('a4000000-0000-4000-8000-00000000032'||n)::uuid,'a4000000-0000-4000-8000-0000000000c3',('a4000000-0000-4000-8000-00000000030'||n)::uuid,array[('a4000000-0000-4000-8000-00000000031'||n)::uuid],n from generate_series(1,2) n;
insert into eps.candidate_media_frames(candidate_media_id,asset_id)select ('a4000000-0000-4000-8000-00000000032'||n)::uuid,('a4000000-0000-4000-8000-00000000031'||n)::uuid from generate_series(1,2) n;
set local session_replication_role=origin;
-- Seed bypassed triggers; build the derived projection once as the backfill does.
select eps.refresh_candidate_projection(id) from eps.candidates where id::text like 'a4000000-%';
update eps.appearance_config set enabled=true,model='synthetic-model',input_usd_per_mtok=1,output_usd_per_mtok=4;

do $test$declare producer uuid:='a4000000-0000-4000-8000-000000000001';viewer uuid:='a4000000-0000-4000-8000-000000000002';ws uuid:='a4000000-0000-4000-8000-0000000000b1';
 c1 uuid:='a4000000-0000-4000-8000-0000000000c1';c2 uuid:='a4000000-0000-4000-8000-0000000000c2';c3 uuid:='a4000000-0000-4000-8000-0000000000c3';c5 uuid:='a4000000-0000-4000-8000-0000000000c5';
 r jsonb;batch jsonb;again jsonb;b2 jsonb;b3 jsonb;job3 uuid;job1 uuid;f jsonb;o eps.candidate_observations;o2 eps.candidate_observations;m eps.candidate_observation_media;err text;keys text[];
 body text;begin
 -- Projection and normalisation.
 perform pg_temp.ok('arabic_name_normalised',(select name_ar_norm from eps.candidate_search_projection where candidate_id=c1)='احمد');
 perform pg_temp.ok('supplied_labels_mapped',(select facet_keys from eps.candidate_search_projection where candidate_id=c1) @> array['hair_colour:black','playing_age:age_25_34','tags:dancer','talent_type:talent','city:dubai','languages:arabic']);

 -- Start a batch (idempotent) and refuse a reused key with a different body.
 body:=jsonb_build_object('workspace_id',ws,'candidate_ids',jsonb_build_array(c3,c1),'limit',10,'spend_cap_cents',100)::text;
 batch:=pg_temp.as_user(producer,format('select public.eps_start_enrichment_batch(%L::jsonb,%L)',body,'a4-batch-key-0001'));
 perform pg_temp.ok('batch_created',(batch->>'created')::boolean and batch#>>'{data,status}'='running' and (batch#>>'{data,counts,queued}')::int=2,batch->'data'->'counts');
 again:=pg_temp.as_user(producer,format('select public.eps_start_enrichment_batch(%L::jsonb,%L)',body,'a4-batch-key-0001'));
 perform pg_temp.ok('batch_idempotent',not (again->>'created')::boolean and again#>>'{data,id}'=batch#>>'{data,id}');
 err:=pg_temp.user_error(producer,format('select public.eps_start_enrichment_batch(%L::jsonb,%L)',jsonb_build_object('workspace_id',ws,'candidate_ids',jsonb_build_array(c3),'limit',10,'spend_cap_cents',100),'a4-batch-key-0001'));
 perform pg_temp.ok('batch_key_reuse_refused',err='IDEMPOTENCY_KEY_REUSED',to_jsonb(err));
 err:=pg_temp.user_error(viewer,format('select public.eps_start_enrichment_batch(%L::jsonb,%L)',body,'a4-batch-key-0002'));
 perform pg_temp.ok('batch_requires_cast_write',err='CAPABILITY_REQUIRED',to_jsonb(err));
 select id into job3 from eps.jobs where kind='candidate_appearance' and resource_id=c3;
 select id into job1 from eps.jobs where kind='candidate_appearance' and resource_id=c1;
 perform pg_temp.ok('outbox_enqueued',(select count(*) from eps.outbox_events where job_id in(job1,job3) and stage='analyze_appearance' and status='pending')=2);
 perform pg_temp.ok('job_input_media',(select jsonb_array_length(input->'media') from eps.jobs where id=job3)=2 and (select input#>>'{media,0,source_kind}' from eps.jobs where id=job1)='photo');

 -- C3: two tapes, one person each, through the real worker dispatchers.
 r:=pg_temp.run_job(job3,jsonb_build_array(jsonb_build_object('hair_colour',pg_temp.attr('black'),'facial_hair',pg_temp.attr('beard','medium'),'playing_age',pg_temp.attr('age_25_34','low'),
  'glasses',pg_temp.attr('unknown','low'))),1000,200);
 perform pg_temp.ok('worker_event_applied',(r->>'applied')::boolean and r->>'job_status'='succeeded',r);
 perform pg_temp.ok('item_succeeded_with_cost',(select status='succeeded' and input_tokens=1000 and output_tokens=200 and cost_micro_usd=1800 from eps.enrichment_batch_items where job_id=job3));
 perform pg_temp.ok('observations_per_media',(select count(*) from eps.candidate_observations where candidate_id=c3)=8 and (select count(*) from eps.candidate_observation_media where candidate_id=c3)=2);
 perform pg_temp.ok('suggestions_not_in_facets',not exists(select 1 from eps.candidate_search_projection where candidate_id=c3 and facet_keys && array['hair_colour:black','facial_hair:beard']));

 -- C1: a photo with two people -> ambiguous, never merged.
 r:=pg_temp.run_job(job1,jsonb_build_array(jsonb_build_object('hair_colour',pg_temp.attr('blonde'),'glasses',pg_temp.attr('glasses')),
  jsonb_build_object('hair_colour',pg_temp.attr('dark'),'glasses',pg_temp.attr('none'))),500,100);
 select * into m from eps.candidate_observation_media where candidate_id=c1;
 perform pg_temp.ok('multi_person_ambiguous',m.ambiguous and m.people_count=2 and m.target_person_index is null);
 perform pg_temp.ok('batch_completed',(select status from eps.enrichment_batches where id=(batch#>>'{data,id}')::uuid)='completed'
  and (select spent_micro_usd from eps.enrichment_batches where id=(batch#>>'{data,id}')::uuid)=1800+900);

 -- Review: confirm C3 hair colour on both tapes; viewer cannot review.
 for o in select * from pg_temp.obs(c3,'hair_colour') loop
  r:=pg_temp.review(producer,o.id,jsonb_build_object('row_version',o.row_version,'action','confirm'),'a4-review-'||o.id);
  perform pg_temp.ok('confirm_tape_'||(select count(*) from a4_result where key like 'confirm_tape_%'),r#>>'{data,status}'='confirmed' and (r->>'changed')::boolean and r#>>'{data,reviewed_by}'=producer::text);
 end loop;
 select * into o from pg_temp.obs(c3,'hair_colour') limit 1;
 r:=pg_temp.review(producer,o.id,jsonb_build_object('row_version',1,'action','confirm'),'a4-review-repeat-0001');
 perform pg_temp.ok('review_idempotent_repeat',not (r->>'changed')::boolean and r#>>'{data,status}'='confirmed');
 err:=pg_temp.user_error(viewer,format('select public.eps_review_candidate_observation(%L::uuid,%L::jsonb,%L)',o.id,jsonb_build_object('row_version',o.row_version,'action','reject'),'a4-viewer-review-01'));
 perform pg_temp.ok('viewer_cannot_review',err='CAPABILITY_REQUIRED',to_jsonb(err));
 select * into o from pg_temp.obs(c3,'facial_hair') limit 1;
 err:=pg_temp.user_error(producer,format('select public.eps_review_candidate_observation(%L::uuid,%L::jsonb,%L)',o.id,jsonb_build_object('row_version',o.row_version+5,'action','reject'),'a4-stale-review-01'));
 perform pg_temp.ok('stale_review_refused',err='STALE_RESOURCE_VERSION',to_jsonb(err));
 err:=pg_temp.user_error(producer,format('select public.eps_review_candidate_observation(%L::uuid,%L::jsonb,%L)',o.id,jsonb_build_object('row_version',o.row_version,'action','override','value','purple'),'a4-bad-override-1'));
 perform pg_temp.ok('override_outside_vocabulary_refused',err='VALIDATION_FAILED',to_jsonb(err));
 r:=pg_temp.review(producer,o.id,jsonb_build_object('row_version',o.row_version,'action','override','value','stubble'),'a4-override-00001');
 perform pg_temp.ok('override_recorded',r#>>'{data,status}'='overridden' and r#>>'{data,effective_value}'='stubble' and r#>>'{data,suggested_value}'='beard');
 select * into o from pg_temp.obs(c3,'glasses') limit 1;
 err:=pg_temp.user_error(producer,format('select public.eps_review_candidate_observation(%L::uuid,%L::jsonb,%L)',o.id,jsonb_build_object('row_version',o.row_version,'action','confirm'),'a4-unknown-confirm'));
 perform pg_temp.ok('unknown_cannot_be_confirmed',err='VALIDATION_FAILED',to_jsonb(err));

 -- Ambiguous media: confirming person 1 selects the target; person 0 then conflicts and is never merged.
 select * into o from pg_temp.obs(c1,'hair_colour',1);
 r:=pg_temp.review(producer,o.id,jsonb_build_object('row_version',o.row_version,'action','confirm'),'a4-target-person-1');
 perform pg_temp.ok('target_person_selected',(select target_person_index from eps.candidate_observation_media where candidate_id=c1)=1);
 select * into o2 from pg_temp.obs(c1,'glasses',0);
 err:=pg_temp.user_error(producer,format('select public.eps_review_candidate_observation(%L::uuid,%L::jsonb,%L)',o2.id,jsonb_build_object('row_version',o2.row_version,'action','confirm'),'a4-target-person-0'));
 perform pg_temp.ok('other_person_conflicts',err='TARGET_PERSON_CONFLICT',to_jsonb(err));
 select facet_keys into keys from eps.candidate_search_projection where candidate_id=c1;
 perform pg_temp.ok('ambiguous_not_merged',keys @> array['hair_colour:dark','hair_colour:black'] and not keys && array['hair_colour:blonde','glasses:glasses'],to_jsonb(keys));

 -- Facets: people, not tapes; OR within, AND across; counts for a facet ignore its own filter; explicit unknown.
 f:=pg_temp.facets(viewer,'{}');
 perform pg_temp.ok('archived_not_counted',(f->>'total')::int=4 and pg_temp.facet_count(f,'city','dubai')=2,f->'total');
 perform pg_temp.ok('people_not_tapes',pg_temp.facet_count(f,'hair_colour','black')=2,to_jsonb(pg_temp.facet_count(f,'hair_colour','black')));
 perform pg_temp.ok('override_in_facets',pg_temp.facet_count(f,'facial_hair','stubble')=1 and pg_temp.facet_count(f,'facial_hair','beard')=0);
 perform pg_temp.ok('unknown_count',pg_temp.facet_field(f,'facial_hair','unknown')=3 and pg_temp.facet_field(f,'facial_hair','matched')=4);
 f:=pg_temp.facets(viewer,'{"facets":{"hair_colour":["black"]}}');
 perform pg_temp.ok('filter_single',(f->>'total')::int=2);
 f:=pg_temp.facets(viewer,'{"facets":{"hair_colour":["black","brown"]}}');
 perform pg_temp.ok('or_within_facet',(f->>'total')::int=3);
 f:=pg_temp.facets(viewer,'{"facets":{"hair_colour":["black"],"city":["Dubai"]}}');
 perform pg_temp.ok('and_across_facets',(f->>'total')::int=1);
 perform pg_temp.ok('own_facet_ignored_in_counts',pg_temp.facet_count(f,'hair_colour','brown')=1 and pg_temp.facet_count(f,'hair_colour','black')=1
  and pg_temp.facet_count(f,'city','cairo')=1 and pg_temp.facet_count(f,'city','dubai')=1);
 f:=pg_temp.facets(viewer,'{"facets":{"facial_hair":["stubble"]},"include_unknown":true}');
 perform pg_temp.ok('include_unknown',(f->>'total')::int=4);
 f:=pg_temp.facets(viewer,'{"facets":{"facial_hair":["unknown"]}}');
 perform pg_temp.ok('unknown_value_selectable',(f->>'total')::int=3);
 err:=pg_temp.user_error(viewer,$q$select public.eps_candidate_facets('{"facets":{"ethnicity":["x"]}}'::jsonb)$q$);
 perform pg_temp.ok('forbidden_facet_refused',err='VALIDATION_FAILED',to_jsonb(err));
 perform pg_temp.ok('cast_facet_match',eps.cast_facet_match(c1,'{"facets":{"city":["DUBAI"]}}') and not eps.cast_facet_match(c3,'{"facets":{"city":["Dubai"]}}')
  and eps.cast_facet_match(c3,'{}'));

 -- Search: normalised EN/AR names, casting id and tag aliases; facet totals agree with per-value counts and with cast_facet_match.
 f:=pg_temp.facets(viewer,'{}');
 perform pg_temp.ok('tag_aliases_merge',pg_temp.facet_count(f,'tags','dancer')=2 and pg_temp.facet_count(f,'tags','رقص')=1,f);
 perform pg_temp.ok('q_arabic_name',(pg_temp.facets(viewer,'{"q":"احمد"}')->>'total')::int=1 and (pg_temp.facets(viewer,'{"q":"أحمد"}')->>'total')::int=1);
 perform pg_temp.ok('q_english_name',(pg_temp.facets(viewer,'{"q":"  SYNTHETIC   three"}')->>'total')::int=1 and (pg_temp.facets(viewer,'{"q":"synthetic"}')->>'total')::int=4);
 perform pg_temp.ok('q_casting_id_and_tag',(pg_temp.facets(viewer,'{"q":"a4-syn-3"}')->>'total')::int=1 and (pg_temp.facets(viewer,'{"q":"رقص"}')->>'total')::int=1);
 perform pg_temp.ok('q_combines_with_facets',(pg_temp.facets(viewer,'{"q":"synthetic","facets":{"city":["dubai"]}}')->>'total')::int=2);
 perform pg_temp.ok('cast_text_match',eps.cast_text_match(c1,'أَحمد') and not eps.cast_text_match(c3,'احمد') and eps.cast_text_match(c3,'A4-SYN-3'));
 declare filt jsonb;v jsonb;sub jsonb;direct bigint;begin
  foreach filt in array array['{}'::jsonb,'{"facets":{"city":["Dubai"]}}'::jsonb,'{"facets":{"hair_colour":["black","brown"]},"include_unknown":true}'::jsonb] loop
   f:=pg_temp.facets(viewer,filt::text::jsonb);
   select count(*) into direct from eps.candidate_search_projection p where p.active and eps.cast_facet_match(p.candidate_id,filt);
   perform pg_temp.ok('total_matches_cast_facet_match_'||md5(filt::text),(f->>'total')::bigint=direct,jsonb_build_object('total',f->'total','direct',direct));
  end loop;
  -- Each value count equals the result total when that value is added as the facet's only filter.
  f:=pg_temp.facets(viewer,'{"facets":{"city":["Dubai","Cairo"]}}');
  for v in select x||jsonb_build_object('facet',fa->>'key') from jsonb_array_elements(f->'facets') fa,jsonb_array_elements(fa->'values') x where fa->>'key' in('hair_colour','tags','talent_type','playing_age') loop
   sub:=pg_temp.facets(viewer,jsonb_build_object('facets',jsonb_build_object('city',jsonb_build_array('Dubai','Cairo'),v->>'facet',jsonb_build_array(v->>'value'))));
   perform pg_temp.ok('value_count_equals_result_'||(v->>'facet')||'_'||(v->>'value'),(sub->>'total')::bigint=(v->>'count')::bigint,jsonb_build_object('value',v,'total',sub->'total'));
  end loop;
 end;
 -- A1 search (m16) with facets: result counts equal facet totals for the same filters; newest-first cursor still pages.
 declare spec jsonb;page jsonb;n_search integer;n_facets bigint;begin
  foreach spec in array array['{}'::jsonb,'{"facets":{"hair_colour":["black"]}}','{"facets":{"hair_colour":["black","brown"]}}','{"facets":{"hair_colour":["black"],"city":["Dubai"]}}',
   '{"facets":{"facial_hair":["stubble"]},"facet_include_unknown":true}','{"facets":{"facial_hair":["unknown"]}}','{"q":"احمد"}','{"q":"synthetic","facets":{"city":["dubai"]}}','{"q":"A4-SYN-3"}',
   '{"city":"Cairo"}','{"review_status":"unreviewed","facets":{"tags":["dancer"]}}','{"q":"رقص"}'] loop
   page:=pg_temp.as_user(viewer,format('select public.eps_search_candidates(%L::jsonb)',spec||'{"limit":100}'));n_search:=jsonb_array_length(page->'data');
   n_facets:=(pg_temp.facets(viewer,jsonb_build_object('facets',coalesce(spec->'facets','{}'::jsonb),'include_unknown',coalesce(spec->'facet_include_unknown','false'::jsonb),
    'search',spec-'facets'-'facet_include_unknown'))->>'total')::bigint;
   perform pg_temp.ok('search_count_equals_facet_total_'||md5(spec::text),n_search=n_facets,jsonb_build_object('spec',spec,'search',n_search,'facets',n_facets));
  end loop;
  page:=pg_temp.as_user(viewer,format('select public.eps_search_candidates(%L::jsonb)','{"q":"احمد","limit":100}'));
  perform pg_temp.ok('search_arabic_name',jsonb_array_length(page->'data')=1 and page#>>'{data,0,id}'=c1::text,page);
  page:=pg_temp.as_user(viewer,format('select public.eps_search_candidates(%L::jsonb)','{"facets":{"city":["Dubai"]},"limit":1}'));
  perform pg_temp.ok('search_facet_first_page',jsonb_array_length(page->'data')=1 and page#>>'{page,next_cursor}' is not null,page);
  page:=pg_temp.as_user(viewer,format('select public.eps_search_candidates(%L::jsonb)',jsonb_build_object('facets',jsonb_build_object('city',jsonb_build_array('Dubai')),'limit',1,'cursor',page#>>'{page,next_cursor}')));
  perform pg_temp.ok('search_facet_cursor_page',jsonb_array_length(page->'data')=1 and page#>>'{page,next_cursor}' is null,page);
  err:=pg_temp.user_error(viewer,format('select public.eps_search_candidates(%L::jsonb)','{"facets":{"ethnicity":["x"]}}'));
  perform pg_temp.ok('search_forbidden_facet_refused',err='VALIDATION_FAILED',to_jsonb(err));
 end;
 -- Provenance: archive labels keep their import source; supplied facts keep theirs; stated age is separate from playing age.
 r:=pg_temp.as_user(viewer,format('select public.eps_list_candidate_observations(%L::uuid)',c1));
 perform pg_temp.ok('archive_provenance',r#>>'{data,supplied,archive,source,kind}'='archive_import' and r#>'{data,supplied,archive,hair_colour}'='["Black"]'::jsonb
  and (select e->>'source' from jsonb_array_elements(r#>'{data,supplied,facts}') e where e->>'key'='stated_gender')='archive'
  and exists(select 1 from jsonb_array_elements(r#>'{data,supplied,facts}') e where e->>'key'='age_or_range'),r#>'{data,supplied}');

 -- Protected identity wording in model free text is refused and nothing is applied.
 b2:=pg_temp.as_user(producer,format('select public.eps_start_enrichment_batch(%L::jsonb,%L)',jsonb_build_object('workspace_id',ws,'candidate_ids',jsonb_build_array(c5),'limit',1,'spend_cap_cents',100),'a4-batch-key-0005'));
 select id into job1 from eps.jobs where kind='candidate_appearance' and resource_id=c5 and status='queued';
 r:=pg_temp.run_job(job1,jsonb_build_array(jsonb_build_object('skin_tone',jsonb_build_object('value','medium','confidence','low','evidence','Middle Eastern look'))),100,10);
 perform pg_temp.ok('forbidden_evidence_refused',r->>'job_status'='failed' and (select error->>'code' from eps.jobs where id=job1)='RESULT_INVALID'
  and not exists(select 1 from eps.candidate_observations where candidate_id=c5),r);
 perform pg_temp.ok('forbidden_text_guard',not eps.appearance_text_allowed('Saudi lookalike') and not eps.appearance_text_allowed('رجل') and not eps.appearance_text_allowed('a woman, left')
  and eps.appearance_text_allowed('white hair, left') and eps.appearance_text_allowed(null));

 -- Re-analysis keeps human decisions and only refreshes suggestions.
 b2:=pg_temp.as_user(producer,format('select public.eps_start_enrichment_batch(%L::jsonb,%L)',jsonb_build_object('workspace_id',ws,'candidate_ids',jsonb_build_array(c3),'limit',1,'spend_cap_cents',100),'a4-batch-key-0003'));
 select id into job3 from eps.jobs where kind='candidate_appearance' and resource_id=c3 and status='queued';
 r:=pg_temp.run_job(job3,jsonb_build_array(jsonb_build_object('hair_colour',pg_temp.attr('brown'),'facial_hair',pg_temp.attr('none'),'playing_age',pg_temp.attr('age_35_44'))),100,10);
 perform pg_temp.ok('confirmed_survives_reapply',(select bool_and(status='confirmed' and suggested_value='black') from pg_temp.obs(c3,'hair_colour')));
 perform pg_temp.ok('override_survives_reapply',(select bool_or(status='overridden' and override_value='stubble' and suggested_value='beard') from pg_temp.obs(c3,'facial_hair')));
 perform pg_temp.ok('suggestions_refreshed',(select bool_and(status='suggested' and suggested_value='age_35_44') from pg_temp.obs(c3,'playing_age')));

 -- Spend cap: a costly first analysis stops the rest of the batch; failures still count usage.
 b3:=pg_temp.as_user(producer,format('select public.eps_start_enrichment_batch(%L::jsonb,%L)',jsonb_build_object('workspace_id',ws,'candidate_ids',jsonb_build_array(c1,c2,c3,c5),'limit',10,'spend_cap_cents',1),'a4-batch-key-0004'));
 perform pg_temp.ok('no_media_skipped',(select status='skipped' and error_code='NO_READY_MEDIA' from eps.enrichment_batch_items where batch_id=(b3#>>'{data,id}')::uuid and candidate_id=c2));
 select id into job1 from eps.jobs where kind='candidate_appearance' and resource_id=c1 and status='queued';
 r:=pg_temp.fail_job(job1,20000,0);
 perform pg_temp.ok('failed_usage_counted',(select status='failed' and cost_micro_usd=20000 from eps.enrichment_batch_items where job_id=job1));
 perform pg_temp.ok('spend_cap_stops_batch',(select status from eps.enrichment_batches where id=(b3#>>'{data,id}')::uuid)='stopped_spend_cap'
  and (select status from eps.enrichment_batch_items where batch_id=(b3#>>'{data,id}')::uuid and candidate_id=c5)='pending');

 -- Reads and access.
 r:=pg_temp.as_user(viewer,format('select public.eps_list_candidate_observations(%L::uuid)',c3));
 perform pg_temp.ok('list_observations',jsonb_array_length(r#>'{data,media}')=2 and r#>>'{data,media,0,source_kind}'='frame' and (r#>>'{data,media,0,frame_timestamp_ms}')::int>0
  and jsonb_array_length(r#>'{data,media,0,observations}')=4);
 err:=pg_temp.user_error(viewer,format('select public.eps_get_enrichment_batch(%L::uuid)',batch#>>'{data,id}'));
 perform pg_temp.ok('batch_private_to_requester',err='RESOURCE_NOT_FOUND',to_jsonb(err));
 r:=pg_temp.as_user(producer,format('select public.eps_get_enrichment_batch(%L::uuid)',batch#>>'{data,id}'));
 perform pg_temp.ok('requester_reads_batch',(r#>>'{data,counts,succeeded}')::int=2);
 err:=pg_temp.anon_error(format('select public.eps_candidate_facets(%L::jsonb)','{}'));
 perform pg_temp.ok('anon_refused',err like 'permission denied%',to_jsonb(err));
 update eps.candidates set facts=jsonb_set(facts,'{city}','"Sharjah"') where id=c2;
 perform pg_temp.ok('canonical_update_refreshes_projection',(select facet_keys @> array['city:sharjah'] and not facet_keys @> array['city:dubai'] from eps.candidate_search_projection where candidate_id=c2));
 update eps.candidates set archived_at=now() where id=c5;
 perform pg_temp.ok('archive_refreshes_projection',not (select active from eps.candidate_search_projection where candidate_id=c5));
 perform pg_temp.ok('trace_recorded',(select count(*) from eps.job_stage_attempts where kind='candidate_appearance')>=4);
end$test$;

-- Review findings (second pass): look/nationality/country never facets, rerun keeps the established target person,
-- batch replay re-checks workspace authority, review Idempotency-Key is recorded, storage guards were composed.
do $test2$declare producer uuid:='a4000000-0000-4000-8000-000000000001';viewer uuid:='a4000000-0000-4000-8000-000000000002';ws uuid:='a4000000-0000-4000-8000-0000000000b1';
 c1 uuid:='a4000000-0000-4000-8000-0000000000c1';c2 uuid:='a4000000-0000-4000-8000-0000000000c2';c3 uuid:='a4000000-0000-4000-8000-0000000000c3';
 r jsonb;r2 jsonb;f jsonb;b jsonb;job uuid;o eps.candidate_observations;err text;keys text[];tags text[];target_media uuid;body text;begin
 -- 2. Supplied look / nationality / country labels and identity-worded tags are never facet or search keys.
 select array_agg(k) into keys from eps.candidate_search_projection p,unnest(p.facet_keys) k where p.candidate_id in(c1,c2);
 perform pg_temp.ok('no_look_facet_keys',not exists(select 1 from unnest(keys) k where k like 'look:%' or k like 'nationality:%' or k like 'country:%' or k like 'skin_tone:arab%'),to_jsonb(keys));
 perform pg_temp.ok('screened_tags_not_keys',not keys && array['tags:european look','tags:middle eastern look','tags:khaleeji','tags:emirati','tags:model look','tags:saudi lookalikes',
  'tags:utopian','tags:atlantis','tags:مظهر خليجي'] and keys @> array['tags:dancer','tags:رقص'],to_jsonb(keys));
 select array_agg(t) into tags from eps.candidate_search_projection p,unnest(p.tags) t where p.candidate_id in(c1,c2);
 perform pg_temp.ok('screened_tags_not_searchable',tags <@ array['dancer','رقص'],to_jsonb(tags));
 f:=pg_temp.facets(viewer,'{}');
 perform pg_temp.ok('look_facet_absent',not exists(select 1 from jsonb_array_elements(f->'facets') x where x->>'key' in('look','regional_look','nationality','country'))
  and not exists(select 1 from jsonb_array_elements(f->'facets') x,jsonb_array_elements(x->'values') v where x->>'key'='tags' and v->>'value' not in('dancer','رقص')),f->'facets');
 err:=pg_temp.user_error(viewer,$q$select public.eps_candidate_facets('{"facets":{"look":["european look"]}}'::jsonb)$q$);
 perform pg_temp.ok('look_filter_refused',err='VALIDATION_FAILED',to_jsonb(err));
 err:=pg_temp.user_error(viewer,format('select public.eps_search_candidates(%L::jsonb)','{"facets":{"look":["european look"]}}'));
 perform pg_temp.ok('search_look_filter_refused',err='VALIDATION_FAILED',to_jsonb(err));
 perform pg_temp.ok('screened_tag_q_matches_nobody',(pg_temp.facets(viewer,'{"q":"european"}')->>'total')::int=0 and (pg_temp.facets(viewer,'{"q":"khaleeji"}')->>'total')::int=0
  and (pg_temp.facets(viewer,'{"q":"utopian"}')->>'total')::int=0);
 perform pg_temp.ok('tag_screen_rule',not eps.appearance_tag_facet_ok('European Look',null,null) and not eps.appearance_tag_facet_ok('look-alike',null,null)
  and not eps.appearance_tag_facet_ok('Kuwaiti',null,null) and not eps.appearance_tag_facet_ok('Utopian','utopian',null) and not eps.appearance_tag_facet_ok(' ',null,null)
  and eps.appearance_tag_facet_ok('Lookout tower',null,null) and eps.appearance_tag_facet_ok('Dancer','Utopian','Atlantis'));
 r:=pg_temp.as_user(viewer,format('select public.eps_list_candidate_observations(%L::uuid)',c1));
 perform pg_temp.ok('archive_labels_still_attributed',r#>>'{data,supplied,archive,look}'='European Look' and r#>'{data,supplied,archive,tags}' ? 'European Look'
  and r#>>'{data,supplied,archive,source,kind}'='archive_import',r#>'{data,supplied,archive}');

 -- 1. Rerun with a different people count: confirmed/overridden person-0 rows stay searchable; new rows stay suggestions.
 b:=pg_temp.as_user(producer,format('select public.eps_start_enrichment_batch(%L::jsonb,%L)',jsonb_build_object('workspace_id',ws,'candidate_ids',jsonb_build_array(c3),'limit',1,'spend_cap_cents',100),'a4-batch-key-0006'));
 select job_id into job from eps.enrichment_batch_items where batch_id=(b#>>'{data,id}')::uuid;
 r:=pg_temp.run_job(job,jsonb_build_array(jsonb_build_object('hair_colour',pg_temp.attr('brown')),jsonb_build_object('hair_colour',pg_temp.attr('blonde'),'glasses',pg_temp.attr('glasses'))),100,10);
 perform pg_temp.ok('rerun_two_people_applied',r->>'job_status'='succeeded',r);
 perform pg_temp.ok('rerun_target_established',(select bool_and(ambiguous and people_count=2 and target_person_index=0) from eps.candidate_observation_media where candidate_id=c3)
  and (select count(*) from eps.candidate_observation_media where candidate_id=c3)=2);
 select facet_keys into keys from eps.candidate_search_projection where candidate_id=c3;
 perform pg_temp.ok('rerun_confirmed_still_faceted',keys @> array['hair_colour:black','facial_hair:stubble'] and not keys && array['hair_colour:blonde','hair_colour:brown','glasses:glasses'],to_jsonb(keys));
 perform pg_temp.ok('rerun_confirmed_still_searchable',eps.cast_facet_match(c3,'{"facets":{"hair_colour":["black"],"facial_hair":["stubble"]}}')
  and pg_temp.facet_count(pg_temp.facets(viewer,'{"facets":{"facial_hair":["stubble"]}}'),'hair_colour','black')>=1);
 perform pg_temp.ok('rerun_new_rows_suggested',(select bool_and(status='suggested') from eps.candidate_observations where candidate_id=c3 and person_index=1)
  and (select count(*) from eps.candidate_observations where candidate_id=c3 and person_index=1)=4
  and (select bool_and(status='confirmed' and suggested_value='black') from pg_temp.obs(c3,'hair_colour',0)));
 select * into o from pg_temp.obs(c3,'hair_colour',1) limit 1;
 err:=pg_temp.user_error(producer,format('select public.eps_review_candidate_observation(%L::uuid,%L::jsonb,%L)',o.id,jsonb_build_object('row_version',o.row_version,'action','confirm'),'a4-rerun-person-1-a'));
 perform pg_temp.ok('rerun_target_kept_until_reviewer_changes',err='TARGET_PERSON_CONFLICT',to_jsonb(err));
 -- A reviewer changes the target: reset the only confirmed person-0 row on a media, then confirm person 1 there.
 select m.id into target_media from eps.candidate_observation_media m where m.candidate_id=c3
  and (select count(*) from eps.candidate_observations x where x.media_id=m.id and x.status in('confirmed','overridden'))=1 limit 1;
 select * into o from eps.candidate_observations x where x.media_id=target_media and x.person_index=0 and x.attribute='hair_colour';
 r:=pg_temp.review(producer,o.id,jsonb_build_object('row_version',o.row_version,'action','reset'),'a4-rerun-reset-0001');
 perform pg_temp.ok('reviewer_reset_clears_target',(select target_person_index is null from eps.candidate_observation_media where id=target_media));
 select * into o from eps.candidate_observations x where x.media_id=target_media and x.person_index=1 and x.attribute='hair_colour';
 r:=pg_temp.review(producer,o.id,jsonb_build_object('row_version',o.row_version,'action','confirm'),'a4-rerun-person-1-b');
 perform pg_temp.ok('reviewer_selects_new_target',(select target_person_index=1 from eps.candidate_observation_media where id=target_media)
  and (select facet_keys @> array['hair_colour:blonde','hair_colour:black'] from eps.candidate_search_projection where candidate_id=c3));

 -- 3. A batch replay re-checks current workspace authority before advancing.
 body:=jsonb_build_object('workspace_id',ws,'candidate_ids',jsonb_build_array(c3,c1),'limit',10,'spend_cap_cents',100)::text;
 update public.project_memberships set can_write=false where principal_id=producer;
 err:=pg_temp.user_error(producer,format('select public.eps_start_enrichment_batch(%L::jsonb,%L)',body,'a4-batch-key-0001'));
 perform pg_temp.ok('batch_replay_rechecks_write',err='ACCESS_DENIED',to_jsonb(err));
 update public.project_memberships set can_write=true where principal_id=producer;
 r:=pg_temp.as_user(producer,format('select public.eps_start_enrichment_batch(%L::jsonb,%L)',body,'a4-batch-key-0001'));
 perform pg_temp.ok('batch_replay_after_restore',not (r->>'created')::boolean);

 -- 4. The review Idempotency-Key is recorded: replay returns the first response; a different body is refused.
 select * into o from pg_temp.obs(c3,'playing_age',0) limit 1;
 r:=pg_temp.review(producer,o.id,jsonb_build_object('row_version',o.row_version,'action','reject'),'a4-review-idem-0001');
 r2:=pg_temp.review(producer,o.id,jsonb_build_object('row_version',o.row_version,'action','reject'),'a4-review-idem-0001');
 perform pg_temp.ok('review_key_replayed',r2=r and (r->>'changed')::boolean and (r2#>>'{data,row_version}')::bigint=o.row_version+1,jsonb_build_object('first',r,'replay',r2));
 err:=pg_temp.user_error(producer,format('select public.eps_review_candidate_observation(%L::uuid,%L::jsonb,%L)',o.id,jsonb_build_object('row_version',o.row_version+1,'action','reset'),'a4-review-idem-0001'));
 perform pg_temp.ok('review_key_reuse_refused',err='IDEMPOTENCY_KEY_REUSED',to_jsonb(err));
 perform pg_temp.ok('review_key_recorded',exists(select 1 from eps.idempotency_records where principal_id=producer and operation='appearance.review_observation' and key='a4-review-idem-0001')
  and (select count(*) from eps.audit_events where principal_id=producer and action='appearance.review_observation' and resource_id=o.id)=1);
 err:=pg_temp.user_error(viewer,format('select public.eps_review_candidate_observation(%L::uuid,%L::jsonb,%L)',o.id,jsonb_build_object('row_version',o.row_version,'action','reject'),'a4-review-idem-0001'));
 perform pg_temp.ok('review_replay_needs_capability',err='CAPABILITY_REQUIRED',to_jsonb(err));

 -- 5. Storage readback (catalogue composition only; the replica has a minimal storage stub).
 perform pg_temp.ok('storage_guards_composed',exists(select 1 from pg_policy where polrelid='storage.objects'::regclass and polname='eps_appearance_read')
  and not exists(select 1 from pg_policy where polrelid='storage.objects'::regclass and polname in('eps_candidate_photos_read_guard','eps_candidate_read_guard')
   and pg_get_expr(polqual,polrelid) not like '%appearance_capability_allowed%')
  and exists(select 1 from pg_policy where polrelid='storage.objects'::regclass and polname='eps_candidate_photos_read_guard'));
end$test2$;

select json_build_object('result','passed','checks',(select count(*) from a4_result),'names',(select json_agg(key order by key) from a4_result))::text;
rollback;
