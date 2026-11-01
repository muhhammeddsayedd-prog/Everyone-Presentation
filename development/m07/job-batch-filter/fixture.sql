-- Synthetic native-SQL assertions only; UNEXECUTED by the author. Root supplies
-- the exact name/OID/marker-owned source and rolls all DDL/data/roles back.
set local role postgres;
do $jbf_fixture$begin
 if current_database()!~'^eps_m07_r33_source_[a-f0-9]{32}$'
 or current_user<>'postgres'or session_user<>'postgres'
 or current_setting('eps.job_batch_filter.proof',true)is distinct from'owned-local-rollback-v1'
 or(pg_control_system()).system_identifier::text<>'7701520506262638626'
 or to_regprocedure('public.eps_list_jobs_by_batch(uuid,text,uuid,integer,uuid)')is null
 or exists(select 1 from auth.users where id::text like'b8380001-%')
 or exists(select 1 from public.projects where id::text like'b8380002-%')
 or exists(select 1 from eps.workspaces where id::text like'b8380003-%')
 or exists(select 1 from eps.jobs where id::text like'b8380006-%')
 then raise exception'JOB_BATCH_FILTER_OWNED_FIXTURE_REQUIRED';end if;
end$jbf_fixture$;
create function pg_temp.jbf_id(prefix text,n integer)returns uuid language sql immutable as $$
 select(prefix||'-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.jbf_assert(value boolean,label text)returns void language plpgsql as $$begin
 if value is distinct from true then raise exception'JOB_BATCH_FILTER_ASSERTION:%',label;end if;
end$$;
create function pg_temp.jbf_error(query text,code text)returns void language plpgsql as $$begin
 begin execute query;exception when others then if sqlerrm=code or sqlstate=code then return;end if;raise exception'JOB_BATCH_FILTER_WRONG_ERROR:%/% EXPECTED %',sqlstate,sqlerrm,code;end;
 raise exception'JOB_BATCH_FILTER_EXPECTED_ERROR:%',code;
end$$;
create function pg_temp.jbf_actor(principal uuid)returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub',principal::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',principal,'role','authenticated','is_anonymous',false)::text,true);
end$$;
create function pg_temp.jbf_ids(page jsonb)returns jsonb language sql immutable as $$
 select coalesce(jsonb_agg(v->>'id'order by ord),'[]'::jsonb)from jsonb_array_elements(page->'data')with ordinality row(v,ord)
$$;
insert into auth.users(id,is_anonymous)select pg_temp.jbf_id('b8380001',n),false from generate_series(1,7)n;
insert into public.projects(id,name)select pg_temp.jbf_id('b8380002',n),'Synthetic job-batch project '||n from generate_series(1,2)n;
insert into public.project_memberships(project_id,principal_id,can_write)values
 (pg_temp.jbf_id('b8380002',1),pg_temp.jbf_id('b8380001',1),false),
 (pg_temp.jbf_id('b8380002',2),pg_temp.jbf_id('b8380001',2),false),
 (pg_temp.jbf_id('b8380002',1),pg_temp.jbf_id('b8380001',3),false),
 (pg_temp.jbf_id('b8380002',1),pg_temp.jbf_id('b8380001',7),false);
insert into public.app_capability_grants(principal_id,capability)
 select pg_temp.jbf_id('b8380001',n),'projects.read'from unnest(array[1,2,3,4,7])n;
insert into public.app_capability_grants(principal_id,capability)values
 (pg_temp.jbf_id('b8380001',1),'workspaces.read'),
 (pg_temp.jbf_id('b8380001',2),'operations.read'),
 (pg_temp.jbf_id('b8380001',4),'operations.read'),
 (pg_temp.jbf_id('b8380001',5),'cast.read'),
 (pg_temp.jbf_id('b8380001',6),'cast.read'),
 (pg_temp.jbf_id('b8380001',7),'workspaces.read'),
 (pg_temp.jbf_id('b8380001',7),'operations.read'),
 (pg_temp.jbf_id('b8380001',7),'cast.read');
insert into eps.workspaces(id,project_id)select pg_temp.jbf_id('b8380003',n),pg_temp.jbf_id('b8380002',n)from generate_series(1,2)n;
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,batch_id,input,input_hash,input_hash_version,dedupe_key,status,stage,correlation_id)
 select pg_temp.jbf_id('b8380006',n),pg_temp.jbf_id('b8380003',case when n=6 then 2 else 1 end),pg_temp.jbf_id('b8380001',case when n=6 then 2 else 1 end),
 'specs_extract',pg_temp.jbf_id('b8380008',n),case when n=4 then null when n=2 then pg_temp.jbf_id('b8380005',2)else pg_temp.jbf_id('b8380005',1)end,
 '{}',repeat('0',64),'eps.specs-input.pg-jsonb.v1',encode(sha256(convert_to('job-batch-filter-seed-'||n,'UTF8')),'hex'),
 case when n=3 then'succeeded'else'queued'end,'prepare_document','synthetic-job-batch-'||n from generate_series(1,6)n;
-- Queued frame jobs exercise requester-only metadata reads, not extraction.
-- The canonical frame_is_job read helper checks job kind, not a request row.
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,batch_id,input,input_hash,input_hash_version,dedupe_key,status,stage,correlation_id)
 select pg_temp.jbf_id('b8380006',n),pg_temp.jbf_id('b8380003',1),pg_temp.jbf_id('b8380001',case when n=7 then 5 when n=8 then 6 else 1 end),
 'frame_extract',pg_temp.jbf_id('b8380008',n),pg_temp.jbf_id('b8380005',1),'{}',repeat('0',64),'eps.frame-input.pg-jsonb.v1',
 encode(sha256(convert_to('job-batch-filter-seed-'||n,'UTF8')),'hex'),'queued','extract_frames','synthetic-job-batch-'||n from generate_series(7,9)n;

set local role authenticated;
select pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',1));
do $jbf_pages$declare first jsonb;second jsonb;third jsonb;all_rows jsonb;begin
 all_rows:=public.eps_list_jobs_by_batch(pg_temp.jbf_id('b8380003',1),null,null,100,pg_temp.jbf_id('b8380005',1));
 perform pg_temp.jbf_assert(pg_temp.jbf_ids(all_rows)=jsonb_build_array(pg_temp.jbf_id('b8380006',1),pg_temp.jbf_id('b8380006',3),pg_temp.jbf_id('b8380006',5)),'exact batch excludes other/null batch and foreign project');
 first:=public.eps_list_jobs_by_batch(pg_temp.jbf_id('b8380003',1),null,null,1,pg_temp.jbf_id('b8380005',1));
 second:=public.eps_list_jobs_by_batch(pg_temp.jbf_id('b8380003',1),null,(first#>>'{page,next_cursor}')::uuid,1,pg_temp.jbf_id('b8380005',1));
 third:=public.eps_list_jobs_by_batch(pg_temp.jbf_id('b8380003',1),null,(second#>>'{page,next_cursor}')::uuid,1,pg_temp.jbf_id('b8380005',1));
 perform pg_temp.jbf_assert(first#>>'{page,next_cursor}'=pg_temp.jbf_id('b8380006',1)::text and second#>>'{page,next_cursor}'=pg_temp.jbf_id('b8380006',3)::text and third#>'{page,next_cursor}'='null'::jsonb,'unchanged ascending UUID cursor and terminal null');
 perform pg_temp.jbf_assert(pg_temp.jbf_ids(first)||pg_temp.jbf_ids(second)||pg_temp.jbf_ids(third)=pg_temp.jbf_ids(all_rows),'stable filtered pages have no skip or duplicate');
 perform pg_temp.jbf_assert(pg_temp.jbf_ids(public.eps_list_jobs_by_batch(pg_temp.jbf_id('b8380003',1),'queued',null,100,pg_temp.jbf_id('b8380005',1)))=jsonb_build_array(pg_temp.jbf_id('b8380006',1),pg_temp.jbf_id('b8380006',5)),'status and batch intersect');
 perform pg_temp.jbf_assert(jsonb_array_length(public.eps_list_jobs(pg_temp.jbf_id('b8380003',1),null,null,100)->'data')=5,'old four-argument RPC retains unfiltered behavior');
 perform pg_temp.jbf_assert(public.eps_list_jobs_by_batch(pg_temp.jbf_id('b8380003',2),null,null,25,pg_temp.jbf_id('b8380005',1))->'data'='[]'::jsonb,'known foreign workspace and batch grant no access');
 perform pg_temp.jbf_error('select public.eps_list_jobs_by_batch(null,null,null,25,null)','INVALID_REQUEST');
 perform pg_temp.jbf_error('select public.eps_list_jobs_by_batch(null,null,null,101,pg_temp.jbf_id(''b8380005'',1))','INVALID_REQUEST');
 perform pg_temp.jbf_error('select*from eps.jobs','42501');
 perform pg_temp.jbf_error('select public.eps_get_job(pg_temp.jbf_id(''b8380006'',9))','RESOURCE_NOT_FOUND');
end$jbf_pages$;
select pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',2));
select pg_temp.jbf_assert(pg_temp.jbf_ids(public.eps_list_jobs_by_batch(null,null,null,25,pg_temp.jbf_id('b8380005',1)))=jsonb_build_array(pg_temp.jbf_id('b8380006',6)),'operations.read is still limited to current project membership');
select pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',3));
select pg_temp.jbf_error('select public.eps_list_jobs_by_batch(null,null,null,25,pg_temp.jbf_id(''b8380005'',1))','CAPABILITY_REQUIRED');
select pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',4));
select pg_temp.jbf_assert(public.eps_list_jobs_by_batch(null,null,null,25,pg_temp.jbf_id('b8380005',1))->'data'='[]'::jsonb,'operations.read without membership cannot observe global batch rows or totals');

select pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',5));
select pg_temp.jbf_assert(pg_temp.jbf_ids(public.eps_list_jobs_by_batch(null,null,null,25,pg_temp.jbf_id('b8380005',1)))=jsonb_build_array(pg_temp.jbf_id('b8380006',7)),'cast.read-only requester sees own frame without origin membership, no ordinary or foreign frame');
select pg_temp.jbf_assert(pg_temp.jbf_ids(public.eps_list_jobs_by_batch(pg_temp.jbf_id('b8380003',1),null,null,25,pg_temp.jbf_id('b8380005',1)))=jsonb_build_array(pg_temp.jbf_id('b8380006',7)),'origin workspace filter does not remove legitimate global requester frame');
select pg_temp.jbf_assert(public.eps_get_job(pg_temp.jbf_id('b8380006',7))->>'id'=pg_temp.jbf_id('b8380006',7)::text,'old get_job retains cast-only own-frame read');
select pg_temp.jbf_error('select public.eps_get_job(pg_temp.jbf_id(''b8380006'',8))','RESOURCE_NOT_FOUND');
select pg_temp.jbf_error('select public.eps_get_job(pg_temp.jbf_id(''b8380006'',1))','RESOURCE_NOT_FOUND');
select pg_temp.jbf_error('select*from eps.jobs','42501');
select pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',6));
select pg_temp.jbf_assert(pg_temp.jbf_ids(public.eps_list_jobs_by_batch(null,null,null,25,pg_temp.jbf_id('b8380005',1)))=jsonb_build_array(pg_temp.jbf_id('b8380006',8)),'second cast requester sees only their own frame within shared batch');
select pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',7));
select pg_temp.jbf_assert(pg_temp.jbf_ids(public.eps_list_jobs_by_batch(pg_temp.jbf_id('b8380003',1),null,null,25,pg_temp.jbf_id('b8380005',1)))=jsonb_build_array(pg_temp.jbf_id('b8380006',1),pg_temp.jbf_id('b8380006',3),pg_temp.jbf_id('b8380006',5)),'origin project operator with cast.read still cannot list another requester frame');
select pg_temp.jbf_error('select public.eps_get_job(pg_temp.jbf_id(''b8380006'',7))','RESOURCE_NOT_FOUND');

savepoint jbf_cast_revocation;
set local role postgres;
delete from public.app_capability_grants where principal_id=pg_temp.jbf_id('b8380001',5)and capability='cast.read';
set local role authenticated;
select pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',5));
select pg_temp.jbf_error('select public.eps_list_jobs_by_batch(null,null,null,25,pg_temp.jbf_id(''b8380005'',1))','CAPABILITY_REQUIRED');
select pg_temp.jbf_error('select public.eps_get_job(pg_temp.jbf_id(''b8380006'',7))','CAPABILITY_REQUIRED');
rollback to savepoint jbf_cast_revocation;
release savepoint jbf_cast_revocation;

savepoint jbf_membership;
set local role postgres;
delete from public.project_memberships where project_id=pg_temp.jbf_id('b8380002',1)and principal_id=pg_temp.jbf_id('b8380001',1);
set local role authenticated;
select pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',1));
select pg_temp.jbf_assert(public.eps_list_jobs_by_batch(null,null,null,25,pg_temp.jbf_id('b8380005',1))->'data'='[]'::jsonb,'revoked current membership immediately filters batch rows');
rollback to savepoint jbf_membership;
release savepoint jbf_membership;

-- Metadata pagination only: no stages are claimed or dispatched. Accessible
-- even UUIDs interleave both inaccessible same-batch and accessible other-batch
-- odd UUIDs, so filtering after the page boundary cannot satisfy these checks.
set local role postgres;
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,batch_id,input,input_hash,input_hash_version,dedupe_key,status,stage,correlation_id)
 select pg_temp.jbf_id('b8380006',1000+2*n),pg_temp.jbf_id('b8380003',1),pg_temp.jbf_id('b8380001',7),
 'specs_extract',pg_temp.jbf_id('b8380008',1000+2*n),pg_temp.jbf_id('b8380005',3),'{}',repeat('0',64),'eps.specs-input.pg-jsonb.v1',
 encode(sha256(convert_to('job-batch-filter-large-accessible-'||n,'UTF8')),'hex'),'queued','prepare_document','synthetic-large-accessible-'||n from generate_series(1,205)n;
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,batch_id,input,input_hash,input_hash_version,dedupe_key,status,stage,correlation_id)
 select pg_temp.jbf_id('b8380006',1000+2*n-1),pg_temp.jbf_id('b8380003',2),pg_temp.jbf_id('b8380001',2),
 'specs_extract',pg_temp.jbf_id('b8380008',1000+2*n-1),pg_temp.jbf_id('b8380005',3),'{}',repeat('0',64),'eps.specs-input.pg-jsonb.v1',
 encode(sha256(convert_to('job-batch-filter-large-foreign-'||n,'UTF8')),'hex'),'queued','prepare_document','synthetic-large-foreign-'||n from generate_series(1,7)n;
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,batch_id,input,input_hash,input_hash_version,dedupe_key,status,stage,correlation_id)
 select pg_temp.jbf_id('b8380006',1300+2*n-1),pg_temp.jbf_id('b8380003',1),pg_temp.jbf_id('b8380001',7),
 'specs_extract',pg_temp.jbf_id('b8380008',1300+2*n-1),pg_temp.jbf_id('b8380005',4),'{}',repeat('0',64),'eps.specs-input.pg-jsonb.v1',
 encode(sha256(convert_to('job-batch-filter-large-other-'||n,'UTF8')),'hex'),'queued','prepare_document','synthetic-large-other-'||n from generate_series(1,8)n;
set local role authenticated;
select pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',7));
do $jbf_large_pages$declare first jsonb;second jsonb;third jsonb;expected_ids jsonb;actual_ids jsonb;begin
 first:=public.eps_list_jobs_by_batch(pg_temp.jbf_id('b8380003',1),null,null,100,pg_temp.jbf_id('b8380005',3));
 second:=public.eps_list_jobs_by_batch(pg_temp.jbf_id('b8380003',1),null,(first#>>'{page,next_cursor}')::uuid,100,pg_temp.jbf_id('b8380005',3));
 third:=public.eps_list_jobs_by_batch(pg_temp.jbf_id('b8380003',1),null,(second#>>'{page,next_cursor}')::uuid,100,pg_temp.jbf_id('b8380005',3));
 select jsonb_agg(pg_temp.jbf_id('b8380006',1000+2*n)::text order by n)into expected_ids from generate_series(1,205)n;
 actual_ids:=pg_temp.jbf_ids(first)||pg_temp.jbf_ids(second)||pg_temp.jbf_ids(third);
 perform pg_temp.jbf_assert(jsonb_array_length(first->'data')=100 and jsonb_array_length(second->'data')=100 and jsonb_array_length(third->'data')=5,'100 + 100 + 5 accessible rows across maximum pages');
 perform pg_temp.jbf_assert(actual_ids=expected_ids,'all 205 expected IDs exactly once in ascending order; foreign workspace and other batch excluded');
 perform pg_temp.jbf_assert(first#>>'{page,next_cursor}'=pg_temp.jbf_id('b8380006',1200)::text and second#>>'{page,next_cursor}'=pg_temp.jbf_id('b8380006',1400)::text and third#>'{page,next_cursor}'='null'::jsonb,'maximum-page cursors advance and the third page is terminal');
end$jbf_large_pages$;

set local role anon;
select pg_temp.jbf_error('select public.eps_list_jobs_by_batch(null,null,null,25,pg_temp.jbf_id(''b8380005'',1))','42501');
set local role postgres;
select pg_temp.jbf_assert(not has_schema_privilege('eps_jobs_owner','public','CREATE')and not has_function_privilege('service_role','public.eps_list_jobs_by_batch(uuid,text,uuid,integer,uuid)','EXECUTE'),'no persistent schema CREATE or service bypass');
select jsonb_build_object('job_batch_filter_assertions_passed_synthetic_only',true)as job_batch_filter_fixture;
