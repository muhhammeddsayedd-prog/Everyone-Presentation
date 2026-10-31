-- LOCAL SYNTHETIC SOURCE ONLY. Not executed during implementation.
-- Run only through a reviewed local owner after migration35; everything rolls back.
-- Artifact rows below are synthetic metadata, not PDF/media processing evidence.
begin;
do $$begin
 if current_user <> 'postgres' or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
 or to_regprocedure('public.eps_get_workspace_summary(uuid)') is null
 or exists(select 1 from public.projects where id::text like '66200000-%')
 or exists(select 1 from auth.users where id::text like '66100000-%')
 then raise exception 'SUMMARY_OWNED_LOCAL_FIXTURE_REQUIRED'; end if;
end$$;
create function pg_temp.summary_id(prefix text, n integer) returns uuid language sql immutable as $$
 select (prefix||'-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.summary_assert(value boolean, label text) returns void language plpgsql as $$begin
 if value is distinct from true then raise exception 'SUMMARY_ASSERTION_FAILED: %', label; end if;
end$$;
create function pg_temp.summary_error(query text, code text) returns void language plpgsql as $$begin
 begin execute query; exception when others then
  if sqlerrm=code or sqlstate=code then return; end if;
  raise exception 'SUMMARY_WRONG_ERROR: % / % expected %', sqlstate, sqlerrm, code;
 end;
 raise exception 'SUMMARY_EXPECTED_ERROR: %', code;
end$$;

insert into auth.users(id,is_anonymous) values
 ('66100000-0000-4000-8000-000000000001',false),('66100000-0000-4000-8000-000000000002',false);
insert into public.app_capability_grants(principal_id,capability)
 select '66100000-0000-4000-8000-000000000001'::uuid,c from unnest(array['projects.read','workspaces.read']) c;
insert into public.projects(id,name) select pg_temp.summary_id('66200000',n),'Synthetic summary project '||n from generate_series(1,3)n;
insert into public.project_memberships(project_id,principal_id,can_write)
 select pg_temp.summary_id('66200000',n),'66100000-0000-4000-8000-000000000001',true from unnest(array[1,3])n;
insert into eps.workspaces(id,project_id)
 select pg_temp.summary_id('66000000',n),pg_temp.summary_id('66200000',n) from generate_series(1,3)n;
select set_config('request.jwt.claim.sub','66100000-0000-4000-8000-000000000001',true),
 set_config('request.jwt.claims','{"sub":"66100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000003');
 perform pg_temp.summary_assert(r->'roles_needing_clarification'='0' and r->'project_candidate_count'='0'
  and r->'open_slot_count'='0' and r->'assignment_count'='{"selection":0,"shortlist":0}'
  and r->'latest_ready_versions'='[]' and r->'unreviewed_candidate_count'='null' and r->'review_issue_count'='null','empty');
 perform pg_temp.summary_error($q$select public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000002')$q$,'RESOURCE_NOT_FOUND');
end$$;
set local role postgres;

insert into eps.roles(id,workspace_id,name,headcount,sort_order,requirements,clarifications,archived_at)
 select pg_temp.summary_id('66300000',n),'66000000-0000-4000-8000-000000000001','Synthetic summary role '||n,
 case when n in(1,3,105) then null else 1 end,n,
 '{"age_range":null,"gender_requirement":null,"appearance_performance":null,"languages":[],"accents":[],"skills":[],"scene_references":[],"shoot_dates":[],"location":null,"availability_requirements":null,"other_instructions":null}'::jsonb,
 case when n=2 then '[{"field_path":"name","reason":"missing_information","source":null,"resolved":false},{"field_path":"requirements.location","reason":"missing_information","source":null,"resolved":false}]'::jsonb
 when n=3 then '[{"field_path":"headcount","reason":"missing_information","source":null,"resolved":true}]'::jsonb else '[]'::jsonb end,
 case when n=104 then clock_timestamp() end from generate_series(1,105)n;
insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order,provisional,archived_at)
 select pg_temp.summary_id('66400000',n),'66000000-0000-4000-8000-000000000001',pg_temp.summary_id('66300000',n),1,
 'Synthetic summary slot '||n,0,n in(1,3,105),case when n=103 then clock_timestamp() end from generate_series(1,105)n;
insert into eps.candidates(id,facts,casting_id,source_kind,created_by,archived_at)
 select pg_temp.summary_id('66500000',n),jsonb_build_object('name','Synthetic summary person '||n,'casting_id','SUMMARY35-'||n,
 'age_or_range',null,'stated_gender',null,'height_measurements',null,'languages','[]'::jsonb,'accents','[]'::jsonb,
 'skills_experience',null,'city',null,'previous_projects_roles',null,'classification',null),'SUMMARY35-'||n,'manual',
 '66100000-0000-4000-8000-000000000001',case when n=101 then clock_timestamp() end from generate_series(1,105)n;
update eps.candidates set reviewed_at=clock_timestamp(),reviewed_by='66100000-0000-4000-8000-000000000001',
 reviewed_facts_fingerprint=case when id=pg_temp.summary_id('66500000',1) then eps.cast_fingerprint(facts,field_sources) else repeat('0',64) end
 where id in(pg_temp.summary_id('66500000',1),pg_temp.summary_id('66500000',2));
insert into eps.workspace_candidates(id,workspace_id,candidate_id,archived_at)
 select pg_temp.summary_id('66600000',n),'66000000-0000-4000-8000-000000000001',pg_temp.summary_id('66500000',n),
 case when n=105 then clock_timestamp() end from generate_series(1,105)n;
insert into eps.assignments(id,workspace_id,slot_id,workspace_candidate_id,position,shortlist_included,archived_at)
 select pg_temp.summary_id('66700000',n),'66000000-0000-4000-8000-000000000001',pg_temp.summary_id('66400000',n),
 pg_temp.summary_id('66600000',case when n=102 then 1 else n end),case when n=1 then 'backup' when n=3 then 'main' else 'option' end,
 n%2=0 or n=3,case when n in(103,104) then clock_timestamp() end from generate_series(1,104)n;
update eps.workspaces set row_version=8,draft_revision=11 where id='66000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001');
 perform pg_temp.summary_assert(r->'row_version'='8' and r->'draft_revision'='11','revision identity');
 perform pg_temp.summary_assert(r->'roles_needing_clarification'='4','distinct role markers and unknown headcount');
 perform pg_temp.summary_assert(r->'project_candidate_count'='104','participation exceeds one page and retains globally archived person');
 perform pg_temp.summary_assert(r->'unreviewed_candidate_count'='null','no cast.read is unknown');
 perform pg_temp.summary_assert(r->'open_slot_count'='1','actual provisional open slot; Backup/Option fill Selection');
 perform pg_temp.summary_assert(r->'assignment_count'='{"selection":102,"shortlist":52}','all assignments; same person twice; explicit shortlist');
end$$;
set local role postgres;
insert into public.app_capability_grants(principal_id,capability)values('66100000-0000-4000-8000-000000000001','cast.read');
set local role authenticated;
select pg_temp.summary_assert(public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001')->'unreviewed_candidate_count'='103',
 'fingerprint is authoritative, not reviewed timestamp; retained globally archived person');
set local role postgres;

-- Distinct audience series for the same output, plus one series with no pointer.
insert into eps.audience_presets(id,key,label,scope)
 select pg_temp.summary_id('66800000',n),'summary35-'||n,'Synthetic summary audience '||n,'external' from generate_series(1,3)n;
insert into eps.presentation_series(id,workspace_id,output_type,audience_preset_id,audience_snapshot,scope_fingerprint,title,
 template_key,template_version,template_content_sha256,font_key)
 select pg_temp.summary_id('66900000',n),'66000000-0000-4000-8000-000000000001','selection',pg_temp.summary_id('66800000',n),
 '{}',lpad(n::text,64,'0'),'Synthetic summary series '||n,t.key,t.version,t.content_sha256,t.font_key
 from generate_series(1,3)n cross join lateral(select * from eps.presentation_templates where registered order by version desc limit 1)t;
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status)
 select pg_temp.summary_id('66a00000',n),'66000000-0000-4000-8000-000000000001',
 case when n%2=1 then 'presentation_manifest' else 'presentation_pdf' end,'synthetic-summary-'||n,
 case when n%2=1 then 'application/json' else 'application/pdf' end,'eps-presentation-outputs','synthetic-summary35/'||n,1,repeat('0',64),'ready'
 from generate_series(1,4)n;
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id,status)
 select pg_temp.summary_id('66b00000',n),'66000000-0000-4000-8000-000000000001','66100000-0000-4000-8000-000000000001',
 'presentation_render',pg_temp.summary_id('66c00000',n),'{}',repeat('0',64),'eps.presentation-job-input.cast-canonical.v1',
 lpad(n::text,64,'0'),'prepare_presentation','synthetic-summary35-'||n,'succeeded' from generate_series(1,2)n;
insert into eps.presentation_versions(id,series_id,workspace_id,project_id,version_number,status,input_workspace_row_version,
 source_draft_revision,input_fingerprint,snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,
 generation_job_id,generated_by,manifest_asset_id,pdf_asset_id,ready_at,created_at)
 select pg_temp.summary_id('66c00000',n),pg_temp.summary_id('66900000',n),'66000000-0000-4000-8000-000000000001',
 '66200000-0000-4000-8000-000000000001',case when n=1 then 4 else 2 end,'ready',8,11,repeat('0',64),'{}',repeat('0',64),'{}',repeat('0',64),repeat('0',64),2,
 pg_temp.summary_id('66b00000',n),'66100000-0000-4000-8000-000000000001',pg_temp.summary_id('66a00000',n*2-1),
 pg_temp.summary_id('66a00000',n*2),clock_timestamp(),clock_timestamp() from generate_series(1,2)n;
update eps.presentation_series s set latest_ready_version_id=v.id,latest_ready_version_no=v.version_number
 from eps.presentation_versions v where v.series_id=s.id and s.id::text like '66900000-%';
delete from public.app_capability_grants where principal_id='66100000-0000-4000-8000-000000000001' and capability='cast.read';
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001');
 perform pg_temp.summary_assert(r->'latest_ready_versions'='[{"series_id":"66900000-0000-4000-8000-000000000001","output_type":"selection","version_no":4},{"series_id":"66900000-0000-4000-8000-000000000002","output_type":"selection","version_no":2}]','distinct Ready audiences and deterministic order');
 perform pg_temp.summary_assert(r->'unreviewed_candidate_count'='null','Ready metadata does not require library facts permission');
end$$;
set local role postgres;

savepoint summary_series_budget;
insert into eps.presentation_series(id,workspace_id,output_type,audience_preset_id,audience_snapshot,scope_fingerprint,title,
 template_key,template_version,template_content_sha256,font_key)
 select pg_temp.summary_id('66d00000',n),s.workspace_id,s.output_type,s.audience_preset_id,s.audience_snapshot,
 lpad((n+1000)::text,64,'0'),'Synthetic budget series '||n,s.template_key,s.template_version,s.template_content_sha256,s.font_key
 from generate_series(1,1001)n cross join eps.presentation_series s where s.id='66900000-0000-4000-8000-000000000001';
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id,status)
 select pg_temp.summary_id('66e00000',n),j.workspace_id,j.requested_by,j.kind,pg_temp.summary_id('66f00000',n),j.input,j.input_hash,
 j.input_hash_version,lpad((n+1000)::text,64,'0'),j.stage,'synthetic-summary35-budget-'||n,j.status
 from generate_series(1,1001)n cross join eps.jobs j where j.id='66b00000-0000-4000-8000-000000000001';
insert into eps.presentation_versions(id,series_id,workspace_id,project_id,version_number,status,input_workspace_row_version,
 source_draft_revision,input_fingerprint,snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,
 generation_job_id,generated_by,manifest_asset_id,pdf_asset_id,ready_at,created_at)
 select pg_temp.summary_id('66f00000',n),pg_temp.summary_id('66d00000',n),v.workspace_id,v.project_id,1,'ready',v.input_workspace_row_version,
 v.source_draft_revision,v.input_fingerprint,v.snapshot,v.snapshot_sha256,v.manifest,v.manifest_sha256,v.inventory_sha256,v.page_count,
 pg_temp.summary_id('66e00000',n),v.generated_by,v.manifest_asset_id,v.pdf_asset_id,v.ready_at,v.created_at
 from generate_series(1,1001)n cross join eps.presentation_versions v where v.id='66c00000-0000-4000-8000-000000000001';
update eps.presentation_series s set latest_ready_version_id=v.id,latest_ready_version_no=v.version_number
 from eps.presentation_versions v where v.series_id=s.id and s.id::text like '66d00000-%';
set local role authenticated;
select pg_temp.summary_error($q$select public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001')$q$,'WORKSPACE_SUMMARY_LIMIT_EXCEEDED');
rollback to summary_series_budget;

-- Owner/constraint-protected inconsistent workspace binding: a Ready insert can
-- carry the same series but a foreign workspace. Do not disable any guard/RLS.
savepoint summary_invalid_pointer;
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id,status)
 values('66b00000-0000-4000-8000-000000000009','66000000-0000-4000-8000-000000000002','66100000-0000-4000-8000-000000000001',
 'presentation_render','66c00000-0000-4000-8000-000000000009','{}',repeat('9',64),'eps.presentation-job-input.cast-canonical.v1',repeat('9',64),'prepare_presentation','synthetic-summary35-invalid','succeeded');
insert into eps.presentation_versions(id,series_id,workspace_id,project_id,version_number,status,input_workspace_row_version,
 source_draft_revision,input_fingerprint,snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,
 generation_job_id,generated_by,manifest_asset_id,pdf_asset_id,ready_at,created_at)
 select '66c00000-0000-4000-8000-000000000009',series_id,'66000000-0000-4000-8000-000000000002',
 '66200000-0000-4000-8000-000000000002',9,'ready',input_workspace_row_version,source_draft_revision,input_fingerprint,
 snapshot,snapshot_sha256,manifest,manifest_sha256,inventory_sha256,page_count,'66b00000-0000-4000-8000-000000000009',
 generated_by,manifest_asset_id,pdf_asset_id,ready_at,created_at from eps.presentation_versions where id='66c00000-0000-4000-8000-000000000001';
update eps.presentation_series set latest_ready_version_id='66c00000-0000-4000-8000-000000000009',latest_ready_version_no=9
 where id='66900000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.summary_error($q$select public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001')$q$,'WORKSPACE_SUMMARY_INVALID');
rollback to summary_invalid_pointer;

-- Same actor's current authority is rechecked on every call.
set local role postgres;
delete from public.app_capability_grants where principal_id='66100000-0000-4000-8000-000000000001' and capability='workspaces.read';
set local role authenticated;
select pg_temp.summary_error($q$select public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001')$q$,'CAPABILITY_REQUIRED');
set local role postgres;
insert into public.app_capability_grants(principal_id,capability)values('66100000-0000-4000-8000-000000000001','workspaces.read');
delete from public.project_memberships where project_id='66200000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.summary_error($q$select public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001')$q$,'RESOURCE_NOT_FOUND');
set local role postgres;
insert into public.project_memberships(project_id,principal_id,can_write)values('66200000-0000-4000-8000-000000000001','66100000-0000-4000-8000-000000000001',true);
update eps.workspaces set archived_at=clock_timestamp() where id='66000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.summary_error($q$select public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001')$q$,'RESOURCE_NOT_FOUND');
set local role postgres;
update eps.workspaces set archived_at=null where id='66000000-0000-4000-8000-000000000001';
update public.projects set archived_at=clock_timestamp() where id='66200000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.summary_error($q$select public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001')$q$,'RESOURCE_NOT_FOUND');
select set_config('request.jwt.claims','{"sub":"66100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',true);
select pg_temp.summary_error($q$select public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001')$q$,'CAPABILITY_REQUIRED');
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
select pg_temp.summary_error($q$select public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001')$q$,'AUTH_REQUIRED');
set local role anon;
select pg_temp.summary_error($q$select public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001')$q$,'42501');
set local role service_role;
select pg_temp.summary_error($q$select public.eps_get_workspace_summary('66000000-0000-4000-8000-000000000001')$q$,'42501');
rollback;
