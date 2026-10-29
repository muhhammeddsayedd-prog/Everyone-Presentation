-- Synthetic managed-Storage catalog/RLS proof ONLY; no HTTP/bytes/provider.
-- Persisted13: parent owns BEGIN/ROLLBACK; no candidate or migration DDL runs.
do $$ begin
 if (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038']::text[]
  or current_user<>'postgres' or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
  or current_setting('eps.specs_read_operation_rehearsal',true) is distinct from 'rollback-only-v1'
  or exists(select 1 from auth.users where id::text like '7a9d0000-%')
  or exists(select 1 from public.projects where id::text like '7b9d0000-%')
  or exists(select 1 from eps.media_assets where id::text like '7d9d0000-%')
 then raise exception 'SPECS_READ_OPERATION_OWNED_ROLLBACK_REQUIRED'; end if;
end $$;
create function pg_temp.read_assert(value boolean,label text) returns void language plpgsql as $$ begin
 if value is distinct from true then raise exception 'READ_OPERATION_ASSERTION: %',label; end if;
end $$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until) values
 ('7a9d0000-0000-4000-8000-000000000001',false,null,null),('7a9d0000-0000-4000-8000-000000000002',false,null,null);
insert into public.projects(id,name) values('7b9d0000-0000-4000-8000-000000000001','Synthetic read-operation policy test');
insert into eps.workspaces(id,project_id) values('7c9d0000-0000-4000-8000-000000000001','7b9d0000-0000-4000-8000-000000000001');
insert into public.project_memberships(project_id,principal_id,can_write) values
 ('7b9d0000-0000-4000-8000-000000000001','7a9d0000-0000-4000-8000-000000000001',true);
insert into public.app_capability_grants(principal_id,capability)
 select '7a9d0000-0000-4000-8000-000000000001'::uuid,c from unnest(array['projects.read','workspaces.read','workspaces.write']) c;
update eps.specs_asset_config set uploads_enabled=true,capabilities_enabled=true,file_pipeline_enabled=true where id=1;
update eps.specs_pipeline_config set enabled=true,document_preparation_version='document-preparation.v1',model_version='synthetic-model',prompt_version='spec_extract_v1.0.0',result_schema_version='1.0' where id=1;
-- Direct metadata fixtures do NOT assert byte verification; the test is RLS only.
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,sha256) values
 ('7d9d0000-0000-4000-8000-000000000001','7c9d0000-0000-4000-8000-000000000001','specs','ready.pdf','application/pdf','eps-specs-assets','assets/7d9d0000-0000-4000-8000-000000000001/original.pdf',17,'ready',repeat('a',64)),
 ('7d9d0000-0000-4000-8000-000000000002','7c9d0000-0000-4000-8000-000000000001','specs','uploading.pdf','application/pdf','eps-specs-assets','assets/7d9d0000-0000-4000-8000-000000000002/original.pdf',17,'uploading',null);
insert into eps.specs_upload_sessions(id,asset_id,principal_id,workspace_id,spec_row_version,bucket,object_key,expected_size_bytes,expected_mime_type) values
 ('7e9d0000-0000-4000-8000-000000000001','7d9d0000-0000-4000-8000-000000000002','7a9d0000-0000-4000-8000-000000000001','7c9d0000-0000-4000-8000-000000000001',1,'eps-specs-assets','assets/7d9d0000-0000-4000-8000-000000000002/original.pdf',17,'application/pdf');
insert into storage.objects(bucket_id,name) select bucket,object_key from eps.media_assets where id::text like '7d9d0000-%';
select set_config('request.jwt.claim.sub','7a9d0000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"7a9d0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('eps.read_info.accepted',public.eps_submit_specs('7c9d0000-0000-4000-8000-000000000001','{"source_asset_id":"7d9d0000-0000-4000-8000-000000000001","row_version":1}','synthetic-read-operation-submit')::text,true);
set local role postgres;
do $$ declare job_id uuid:=(current_setting('eps.read_info.accepted')::jsonb->>'job_id')::uuid; lease jsonb; digest text; begin
 select input_hash into strict digest from eps.jobs where id=job_id;
 execute 'set local role eps_jobs_executor';
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',job_id,'stage','prepare_document','input_hash',digest));
 execute 'set local role postgres';
 perform set_config('eps.read_info.lease',lease::text,true);
 -- An attempt-owned pending derivative fixture, not a fake successful result.
 insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key)
 values('7d9d0000-0000-4000-8000-000000000003','7c9d0000-0000-4000-8000-000000000001','document_text','prepared.json','application/json','eps-specs-outputs',
  'jobs/'||job_id::text||'/attempts/'||(lease->>'attempt_id')||'/7d9d0000-0000-4000-8000-000000000003.json',17,'uploading','7d9d0000-0000-4000-8000-000000000001',job_id,(lease->>'attempt_id')::uuid,'prepare_document','document_text');
 insert into storage.objects(bucket_id,name) select bucket,object_key from eps.media_assets where id='7d9d0000-0000-4000-8000-000000000003';
 -- Known synthetic opaque grants. Only local SQL metadata policies are tested.
 insert into eps.specs_asset_grants(token_digest,job_id,attempt_id,input_hash,asset_id,bucket,object_key,permission,expires_at)
 select encode(sha256(convert_to(case when a.purpose='specs' then repeat('A',43) else repeat('B',43) end,'UTF8')),'hex'),job_id,(lease->>'attempt_id')::uuid,digest,a.id,a.bucket,a.object_key,'read',clock_timestamp()+interval '60 seconds'
 from eps.media_assets a where a.id in('7d9d0000-0000-4000-8000-000000000001','7d9d0000-0000-4000-8000-000000000003');
end $$;
create function pg_temp.read_operations(info_allowed boolean) returns void language plpgsql as $$
declare operation text; expected bigint; begin
 foreach operation in array array['object.get_authenticated','storage.object.get_authenticated','object.get_authenticated_info','storage.object.get_authenticated_info'] loop
  expected:=case when operation in('object.get_authenticated','storage.object.get_authenticated') or info_allowed then 1 else 0 end;
  perform set_config('storage.operation',operation,true);
  perform set_config('request.jwt.claim.sub','7a9d0000-0000-4000-8000-000000000001',true);
  perform set_config('request.jwt.claims','{"sub":"7a9d0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  perform set_config('request.headers','{}',true); execute 'set local role authenticated';
  perform pg_temp.read_assert((select count(*)=expected from storage.objects where bucket_id='eps-specs-assets' and name='assets/7d9d0000-0000-4000-8000-000000000001/original.pdf'),'owner Ready read: '||operation);
  perform pg_temp.read_assert((select count(*)=expected from storage.objects where bucket_id='eps-specs-assets' and name='assets/7d9d0000-0000-4000-8000-000000000002/original.pdf'),'owner uploading read: '||operation);
  execute 'set local role postgres';
  perform set_config('request.jwt.claim.sub','7a9d0000-0000-4000-8000-000000000002',true);
  perform set_config('request.jwt.claims','{"sub":"7a9d0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  execute 'set local role authenticated';
  perform pg_temp.read_assert((select count(*)=0 from storage.objects where bucket_id in('eps-specs-assets','eps-specs-outputs')),'outsider remains denied');
  execute 'set local role postgres'; perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims','{}',true);
  execute 'set local role anon';
  perform pg_temp.read_assert((select count(*)=0 from storage.objects where bucket_id in('eps-specs-assets','eps-specs-outputs')),'absent capability denied');
  perform set_config('request.headers',jsonb_build_object('x-eps-asset-grant',repeat('C',43))::text,true);
  perform pg_temp.read_assert((select count(*)=0 from storage.objects where bucket_id in('eps-specs-assets','eps-specs-outputs')),'unknown capability denied');
  perform set_config('request.headers',jsonb_build_object('x-eps-asset-grant',repeat('A',43))::text,true);
  perform pg_temp.read_assert((select count(*)=expected from storage.objects where bucket_id='eps-specs-assets' and name='assets/7d9d0000-0000-4000-8000-000000000001/original.pdf'),'lease-scoped original read');
  perform pg_temp.read_assert((select count(*)=0 from storage.objects where bucket_id='eps-specs-outputs' or name='assets/7d9d0000-0000-4000-8000-000000000002/original.pdf'),'original proof cannot read other asset/output');
  perform set_config('request.headers',jsonb_build_object('x-eps-asset-grant',repeat('B',43))::text,true);
  perform pg_temp.read_assert((select count(*)=expected from storage.objects where bucket_id='eps-specs-outputs'),'lease-scoped derivative read');
  execute 'set local role postgres';
 end loop;
 foreach operation in array array['','unknown','object.list','object.list_v2','object.sign','object.sign_many','object.get_public','object.info_public','object.info_authenticated','object.head_authenticated_info',
   'object.upload','object.upload_update','object.upload_signed','object.sign_upload_url','object.copy','object.move','object.delete','object.delete_many','object.get_authenticated_info.extra'] loop
  perform set_config('storage.operation',operation,true);
  perform set_config('request.jwt.claim.sub','7a9d0000-0000-4000-8000-000000000001',true);
  perform set_config('request.jwt.claims','{"sub":"7a9d0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  execute 'set local role authenticated';
  perform pg_temp.read_assert((select count(*)=0 from storage.objects where bucket_id in('eps-specs-assets','eps-specs-outputs')),'non-read operation denied to user: '||operation);
  execute 'set local role postgres'; perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims','{}',true);
  perform set_config('request.headers',jsonb_build_object('x-eps-asset-grant',repeat('A',43))::text,true); execute 'set local role anon';
  perform pg_temp.read_assert((select count(*)=0 from storage.objects where bucket_id in('eps-specs-assets','eps-specs-outputs')),'non-read operation denied with valid proof: '||operation);
  execute 'set local role postgres';
 end loop;
end $$;
select pg_temp.read_operations(true);
select 'READ_INFO_GREEN_BODY_AND_INFO_ALLOWED' as proof;
-- Revoke/expiry gates are tested independently so one failed condition cannot
-- accidentally make a later negative assertion pass without reaching its gate.
do $$ declare operation text; fixture_job_id uuid:=(current_setting('eps.read_info.accepted')::jsonb->>'job_id')::uuid; begin
 foreach operation in array array['object.get_authenticated','object.get_authenticated_info'] loop
  perform set_config('storage.operation',operation,true); perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims','{}',true);
  perform set_config('request.headers',jsonb_build_object('x-eps-asset-grant',repeat('A',43))::text,true);
  update public.project_memberships set active=false where project_id='7b9d0000-0000-4000-8000-000000000001';
  execute 'set local role anon'; perform pg_temp.read_assert((select count(*)=0 from storage.objects where bucket_id='eps-specs-assets'),'revoked requester denies proof'); execute 'set local role postgres';
  update public.project_memberships set active=true where project_id='7b9d0000-0000-4000-8000-000000000001';
  update eps.specs_asset_grants g set revoked_at=clock_timestamp() where g.job_id=fixture_job_id and g.asset_id='7d9d0000-0000-4000-8000-000000000001';
  execute 'set local role anon'; perform pg_temp.read_assert((select count(*)=0 from storage.objects where bucket_id='eps-specs-assets'),'revoked capability denied'); execute 'set local role postgres';
  update eps.specs_asset_grants set revoked_at=null where asset_id='7d9d0000-0000-4000-8000-000000000001';
  update eps.jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=fixture_job_id;
  execute 'set local role anon'; perform pg_temp.read_assert((select count(*)=0 from storage.objects where bucket_id='eps-specs-assets'),'expired stage lease denied'); execute 'set local role postgres';
  update eps.jobs set lease_expires_at=clock_timestamp()+interval '60 seconds' where id=fixture_job_id;
  update eps.specs_asset_grants set created_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute' where asset_id='7d9d0000-0000-4000-8000-000000000001';
  execute 'set local role anon'; perform pg_temp.read_assert((select count(*)=0 from storage.objects where bucket_id='eps-specs-assets'),'expired capability denied'); execute 'set local role postgres';
  update eps.specs_asset_grants set created_at=clock_timestamp(),expires_at=clock_timestamp()+interval '60 seconds' where asset_id='7d9d0000-0000-4000-8000-000000000001';
  update eps.specs_upload_sessions set created_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute' where id='7e9d0000-0000-4000-8000-000000000001';
  perform set_config('request.jwt.claim.sub','7a9d0000-0000-4000-8000-000000000001',true); perform set_config('request.jwt.claims','{"sub":"7a9d0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  execute 'set local role authenticated'; perform pg_temp.read_assert((select count(*)=0 from storage.objects where name='assets/7d9d0000-0000-4000-8000-000000000002/original.pdf'),'expired uploading session denied'); execute 'set local role postgres';
  update eps.specs_upload_sessions set created_at=clock_timestamp(),expires_at=clock_timestamp()+interval '2 hours' where id='7e9d0000-0000-4000-8000-000000000001';
 end loop;
end $$;
select 'READ_INFO_SCOPE_AND_LEASE_NEGATIVES_PASSED' as proof;
