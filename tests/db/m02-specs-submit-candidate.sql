-- Synthetic owned-local assertions only. The fixed driver owns BEGIN/ROLLBACK.
-- These job statuses/configurations are fixtures, never provider/stage evidence.
do $$ begin
 if current_user<>'postgres' or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
  or current_setting('eps.specs_submit_candidate_rehearsal',true) is distinct from 'rollback-only-v1'
  or exists(select 1 from auth.users where id::text like '7a970000-%')
  or exists(select 1 from public.projects where id::text like '7b970000-%')
  or exists(select 1 from eps.workspaces where id::text like '7c970000-%')
 then raise exception 'SPECS_SUBMIT_LOCAL_ROLLBACK_COLLISION_OR_TARGET'; end if;
end $$;
create function pg_temp.submit_assert(value boolean,label text) returns void language plpgsql as $$ begin
 if value is distinct from true then raise exception 'SPECS_SUBMIT_ASSERTION: %',label; end if;
end $$;
create function pg_temp.submit_expect(query text,expected text) returns void language plpgsql as $$ begin
 begin execute query; exception when others then
  if expected='ANY_FAILURE' or sqlerrm=expected or sqlstate=expected then return; end if;
  raise exception 'SPECS_SUBMIT_WRONG_ERROR expected %, got % / %',expected,sqlstate,sqlerrm;
 end;
 raise exception 'SPECS_SUBMIT_EXPECTED_ERROR_NOT_RAISED: %',expected;
end $$;
create function pg_temp.submit_actor(principal uuid) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claim.sub',coalesce(principal::text,''),true);
 perform set_config('request.jwt.claims',case when principal is null then '{}' else jsonb_build_object('sub',principal,'role','authenticated','is_anonymous',false)::text end,true);
end $$;
create function pg_temp.submit_snapshot() returns jsonb language sql stable as $$
 select jsonb_build_object(
  'specs',(select jsonb_agg(to_jsonb(source) order by id) from eps.specs source where workspace_id::text like '7c970000-%'),
  'workspaces',(select jsonb_agg(to_jsonb(workspace) order by id) from eps.workspaces workspace where id::text like '7c970000-%'),
  'roles',(select jsonb_agg(to_jsonb(role) order by id) from eps.roles role where workspace_id::text like '7c970000-%'),
  'slots',(select jsonb_agg(to_jsonb(slot) order by id) from eps.slots slot where workspace_id::text like '7c970000-%'),
  'jobs',(select jsonb_agg(to_jsonb(job) order by id) from eps.jobs job where workspace_id::text like '7c970000-%'),
  'outbox',(select jsonb_agg(to_jsonb(event) order by id) from eps.outbox_events event where exists(select 1 from eps.jobs job where job.id=event.job_id and job.workspace_id::text like '7c970000-%')),
  'audit',(select jsonb_agg(to_jsonb(event) order by id) from eps.audit_events event where principal_id::text like '7a970000-%'),
  'idem',(select jsonb_agg(to_jsonb(receipt) order by principal_id,operation,key) from eps.idempotency_records receipt where principal_id::text like '7a970000-%'))
$$;
create function pg_temp.submit_save_snapshot() returns void language plpgsql as $$ begin
 perform set_config('eps.submit.before',pg_temp.submit_snapshot()::text,true);
end $$;
create function pg_temp.submit_unchanged(label text) returns void language plpgsql as $$ begin
 perform pg_temp.submit_assert(pg_temp.submit_snapshot()=current_setting('eps.submit.before')::jsonb,label);
end $$;

insert into auth.users(id) values('7a970000-0000-4000-8000-000000000001'),('7a970000-0000-4000-8000-000000000002'),('7a970000-0000-4000-8000-000000000003'),('7a970000-0000-4000-8000-000000000004');
insert into public.projects(id,name) select ('7b970000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,'Synthetic submit '||number from generate_series(1,12) number;
insert into eps.workspaces(id,project_id) select ('7c970000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,('7b970000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid from generate_series(1,12) number;
insert into public.project_memberships(project_id,principal_id,can_write)
 select ('7b970000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,'7a970000-0000-4000-8000-000000000001',true from generate_series(1,11) number;
insert into public.project_memberships(project_id,principal_id,can_write) values('7b970000-0000-4000-8000-000000000001','7a970000-0000-4000-8000-000000000002',false);
insert into public.app_capability_grants(principal_id,capability)
 select principal,capability from unnest(array['7a970000-0000-4000-8000-000000000001'::uuid,'7a970000-0000-4000-8000-000000000002','7a970000-0000-4000-8000-000000000003']) principal
 cross join unnest(array['projects.read','workspaces.write']) capability;
insert into public.app_capability_grants(principal_id,capability) values('7a970000-0000-4000-8000-000000000004','projects.read');

-- Missing/forged authority cannot reveal readiness or enqueue.
select pg_temp.submit_actor(null);
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":"Synthetic source"}'',''anonymous-0000000000000000'')','AUTH_REQUIRED');
reset role;
select pg_temp.submit_actor('7a970000-0000-4000-8000-000000000004');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":"Synthetic source"}'',''nocap-0000000000000000'')','CAPABILITY_REQUIRED');
reset role;
select pg_temp.submit_actor('7a970000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":"Synthetic source"}'',''readonly-0000000000000000'')','RESOURCE_NOT_FOUND');
reset role;
select pg_temp.submit_actor('7a970000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":"Synthetic source"}'',''nonmember-0000000000000000'')','RESOURCE_NOT_FOUND');
reset role;
select pg_temp.submit_actor('7a970000-0000-4000-8000-000000000001');
select pg_temp.submit_save_snapshot();
set local role authenticated;
select pg_temp.submit_expect('select * from eps.specs_pipeline_config','42501');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":"Synthetic source"}'',''too-short'')','INVALID_REQUEST');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":"Synthetic source"}'',''disabled-0000000000000000'')','DEPENDENCY_UNAVAILABLE');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000012'',''{"source_text":"Synthetic source"}'',''foreign-0000000000000000'')','RESOURCE_NOT_FOUND');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_asset_id":"7f970000-0000-4000-8000-000000000001"}'',''asset-0000000000000000'')','FEATURE_NOT_IMPLEMENTED');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":"Synthetic","source_asset_id":"7f970000-0000-4000-8000-000000000001"}'',''both-0000000000000000'')','INVALID_REQUEST');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":"Synthetic","configuration":{"model_version":"caller-chosen"}}'',''inject-0000000000000000'')','INVALID_REQUEST');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":null}'',''null-0000000000000000'')','INVALID_REQUEST');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":"Synthetic","row_version":null}'',''nullversion-0000000000000000'')','INVALID_REQUEST');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',jsonb_build_object(''source_text'',chr(65279)||chr(160)||E''\t\r\n''),''space-0000000000000000'')','INVALID_REQUEST');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',jsonb_build_object(''source_text'',''bad''||chr(1)),''control-0000000000000000'')','INVALID_REQUEST');
reset role;
select pg_temp.submit_unchanged('disabled, unauthorized, malformed and asset requests create no source/job/receipt');
select pg_temp.submit_assert((select not enabled and document_preparation_version is null and model_version is null and prompt_version is null and result_schema_version is null from eps.specs_pipeline_config where id=1),'default metadata is disabled and contains no invented provider version');

-- Synthetic local metadata only: deliberately not the real configured model.
update eps.specs_pipeline_config set document_preparation_version='synthetic-document-v1',model_version='synthetic-model-v1',prompt_version='synthetic-prompt-v1',result_schema_version='synthetic-result-v1',enabled=true where id=1;
do $$ begin perform set_config('eps.submit.text',chr(65279)||'Synthetic original requirements'||E'\r\n\r\n'||'ثلاثة أشخاص. Keep exact wording.',true); end $$;
select set_config('request.headers','{"x-eps-request-id":"synthetic-source-submit","x-eps-client-type":"mcp","authorization":"SYNTHETIC_PRIVATE_HEADER_NOT_PERSISTED"}',true);
set local role authenticated;
do $$ begin perform set_config('eps.submit.first',public.eps_submit_specs('7c970000-0000-4000-8000-000000000001',jsonb_build_object('source_text',current_setting('eps.submit.text')),'first-source-0000000000000000')::text,true); end $$;
reset role;
do $$ declare source eps.specs; job eps.jobs; begin
 select * into strict source from eps.specs where workspace_id='7c970000-0000-4000-8000-000000000001';
 select * into strict job from eps.jobs where id=source.processing_job_id;
 perform pg_temp.submit_assert(source.source_asset_id is null and source.source_text=current_setting('eps.submit.text') and source.source_row_version=2 and source.row_version=2,'original UTF8/BOM/CRLF stored once with separate source epoch');
 perform pg_temp.submit_assert((select row_version=2 and draft_revision=1 and has_unpublished_changes from eps.workspaces where id=source.workspace_id),'one coupled workspace/draft bump');
 perform pg_temp.submit_assert(job.input=jsonb_build_object('schema_version','1.0','specs_id',source.id,'source_hash',encode(sha256(convert_to(current_setting('eps.submit.text'),'UTF8')),'hex'),
  'source_row_version',2,'workspace_row_version',2,'configuration',jsonb_build_object('document_preparation_version','synthetic-document-v1','model_version','synthetic-model-v1','prompt_version','synthetic-prompt-v1','result_schema_version','synthetic-result-v1')),'strict frozen metadata contains no source text or caller config');
 perform pg_temp.submit_assert(job.input_hash=eps.jobs_hash_v1(job.input) and job.status='queued' and job.requested_by='7a970000-0000-4000-8000-000000000001','actual durable job bound to actor/hash');
 perform pg_temp.submit_assert((select count(*)=1 from eps.outbox_events where job_id=job.id and status='pending'),'one actual outbox');
 perform pg_temp.submit_assert((select count(*)=1 from eps.audit_events where action='jobs.enqueue' and resource_id=job.id)
  and (select count(*)=1 from eps.audit_events where action='specs.submit_specs' and resource_id=source.id and request_id='synthetic-source-submit' and client_type='mcp'),'source and enqueue audits without full headers');
 perform pg_temp.submit_assert((select count(*)=2 from eps.idempotency_records where principal_id='7a970000-0000-4000-8000-000000000001'),'internal plus external idempotency receipts');
 perform pg_temp.submit_assert(current_setting('eps.submit.first')::jsonb=jsonb_build_object('job_id',job.id,'resource_id',source.id,'poll_url','/api/v1/jobs/'||job.id::text,'status','queued'),'JobAccepted uses actual row identities');
end $$;
select pg_temp.submit_save_snapshot();
set local role authenticated;
do $$ begin perform pg_temp.submit_assert(public.eps_submit_specs('7c970000-0000-4000-8000-000000000001',jsonb_build_object('source_text',current_setting('eps.submit.text')),'first-source-0000000000000000')=current_setting('eps.submit.first')::jsonb,'same key exact cached acknowledgement'); end $$;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":"Changed source"}'',''first-source-0000000000000000'')','IDEMPOTENCY_KEY_REUSED');
reset role;
select pg_temp.submit_unchanged('cached replay and changed-body key reuse never requeue');

-- Existing manual edits and source evidence survive new-key reuse, including
-- a finished job: actual status is returned rather than claiming queued again.
set local role authenticated;
select public.eps_update_specs('7c970000-0000-4000-8000-000000000001','{"row_version":2,"normalized_instructions":"Manual producer instructions"}','manual-after-source');
reset role;
update eps.specs set source_extraction='{"synthetic_source_evidence":true}',source_language_codes=array['en','ar'] where workspace_id='7c970000-0000-4000-8000-000000000001';
update eps.jobs set status='succeeded',progress_completed=1,progress_total=1 where id=(current_setting('eps.submit.first')::jsonb->>'job_id')::uuid;
select pg_temp.submit_save_snapshot();
set local role authenticated;
do $$ declare response jsonb; begin
 response:=public.eps_submit_specs('7c970000-0000-4000-8000-000000000001',jsonb_build_object('source_text',current_setting('eps.submit.text'),'row_version',3),'same-source-new-key');
 perform pg_temp.submit_assert(response->>'job_id'=current_setting('eps.submit.first')::jsonb->>'job_id' and response->>'status'='succeeded','finished current job returned with honest durable status');
end $$;
reset role;
select pg_temp.submit_assert((select row_version=3 and source_row_version=2 and normalized_instructions='Manual producer instructions' and source_extraction='{"synthetic_source_evidence":true}'::jsonb and source_language_codes=array['en','ar'] from eps.specs where workspace_id='7c970000-0000-4000-8000-000000000001')
 and (select count(*)=1 from eps.jobs where workspace_id='7c970000-0000-4000-8000-000000000001')
 and (select count(*)=1 from eps.audit_events where action='specs.submit_specs'),'manual edits/source provenance and job count survive reuse');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',jsonb_build_object(''source_text'',current_setting(''eps.submit.text''),''row_version'',2),''stale-new-key-0000000000000000'')','STALE_RESOURCE_VERSION');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',jsonb_build_object(''source_text'',current_setting(''eps.submit.text'')),''missing-version-0000000000000000'')','INVALID_REQUEST');
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',''{"source_text":"Different original","row_version":3}'',''different-original'')','FEATURE_NOT_IMPLEMENTED');
reset role;
update eps.specs_pipeline_config set model_version='synthetic-model-v2' where id=1;
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',jsonb_build_object(''source_text'',current_setting(''eps.submit.text''),''row_version'',3),''different-config'')','FEATURE_NOT_IMPLEMENTED');
reset role;
update eps.specs_pipeline_config set model_version='synthetic-model-v1' where id=1;

-- Source epoch and pointer inconsistencies cannot reuse a plausible-looking job.
update eps.specs set source_row_version=3 where workspace_id='7c970000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',jsonb_build_object(''source_text'',current_setting(''eps.submit.text''),''row_version'',3),''bad-epoch-0000000000000000'')','SPECS_STATE_INVALID');
reset role;
update eps.specs set source_row_version=2 where workspace_id='7c970000-0000-4000-8000-000000000001';
update eps.specs set processing_job_id=null where workspace_id='7c970000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',jsonb_build_object(''source_text'',current_setting(''eps.submit.text''),''row_version'',3),''missing-job-pointer'')','SPECS_STATE_INVALID');
reset role;
update eps.specs set processing_job_id=(current_setting('eps.submit.first')::jsonb->>'job_id')::uuid where workspace_id='7c970000-0000-4000-8000-000000000001';
update public.project_memberships set active=false where project_id='7b970000-0000-4000-8000-000000000001' and principal_id='7a970000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',jsonb_build_object(''source_text'',current_setting(''eps.submit.text'')),''first-source-0000000000000000'')','RESOURCE_NOT_FOUND');
reset role;
update public.project_memberships set active=true where project_id='7b970000-0000-4000-8000-000000000001' and principal_id='7a970000-0000-4000-8000-000000000001';
update public.app_capability_grants set active=false where principal_id='7a970000-0000-4000-8000-000000000001' and capability='workspaces.write';
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',jsonb_build_object(''source_text'',current_setting(''eps.submit.text'')),''first-source-0000000000000000'')','CAPABILITY_REQUIRED');
reset role;
update public.app_capability_grants set active=true where principal_id='7a970000-0000-4000-8000-000000000001' and capability='workspaces.write';
update eps.specs_pipeline_config set enabled=false where id=1;
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000001'',jsonb_build_object(''source_text'',current_setting(''eps.submit.text'')),''first-source-0000000000000000'')','DEPENDENCY_UNAVAILABLE');
reset role;
update eps.specs_pipeline_config set enabled=true where id=1;

-- First source with a supplied current Spec revision preserves pre-existing
-- working facts. Omitted revisions never assume an existing/archived role empty.
set local role authenticated;
select public.eps_update_specs('7c970000-0000-4000-8000-000000000002','{"row_version":1,"normalized_instructions":"Keep these working instructions"}','manual-before-source');
reset role;
insert into eps.roles(id,workspace_id,name,headcount,requirements,sort_order,archived_at)
 values('7d970000-0000-4000-8000-000000000001','7c970000-0000-4000-8000-000000000002','Existing archived role',1,'{}',0,clock_timestamp());
insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order,archived_at)
 values('7e970000-0000-4000-8000-000000000001','7c970000-0000-4000-8000-000000000002','7d970000-0000-4000-8000-000000000001',1,'Existing archived slot',0,clock_timestamp());
do $$ begin perform set_config('eps.submit.working',jsonb_build_object('roles',(select jsonb_agg(to_jsonb(role)) from eps.roles role where workspace_id='7c970000-0000-4000-8000-000000000002'),
 'slots',(select jsonb_agg(to_jsonb(slot)) from eps.slots slot where workspace_id='7c970000-0000-4000-8000-000000000002'))::text,true); end $$;
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000002'',''{"source_text":"Initial source alongside manual facts"}'',''nonpristine-0000000000000000'')','INVALID_REQUEST');
select public.eps_submit_specs('7c970000-0000-4000-8000-000000000002','{"source_text":"Initial source alongside manual facts","row_version":2}','manual-source-0000000000000000');
reset role;
select pg_temp.submit_assert((select normalized_instructions='Keep these working instructions' and source_row_version=2 and row_version=3 from eps.specs where workspace_id='7c970000-0000-4000-8000-000000000002')
 and current_setting('eps.submit.working')::jsonb=jsonb_build_object('roles',(select jsonb_agg(to_jsonb(role)) from eps.roles role where workspace_id='7c970000-0000-4000-8000-000000000002'),
 'slots',(select jsonb_agg(to_jsonb(slot)) from eps.slots slot where workspace_id='7c970000-0000-4000-8000-000000000002')),'initial source preserves working facts and archived identities exactly');

-- Every silent write fault must abort the entire source/job/outbox/audit/cache
-- operation. Existing generic enqueue helpers are deliberately tested through.
create function pg_temp.submit_suppress() returns trigger language plpgsql as $$ begin
 if tg_argv[0]='pointer' then
  if new.processing_job_id is null then return new; end if;
 elsif tg_argv[0]='job_audit' then
  if new.action<>'jobs.enqueue' then return new; end if;
 elsif tg_argv[0]='source_audit' then
  if new.action<>'specs.submit_specs' then return new; end if;
 elsif tg_argv[0]='internal_idem' then
  if new.operation<>'jobs.enqueue' then return new; end if;
 elsif tg_argv[0]='external_idem' then
  if new.operation<>'specs.submit_specs' then return new; end if;
 end if;
 return null;
end $$;
select pg_temp.submit_save_snapshot();
create trigger submit_suppress before update on eps.specs for each row execute function pg_temp.submit_suppress('all');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000003'',''{"source_text":"Synthetic fault source"}'',''fault-source-0000000000000000'')','SPECS_STATE_INVALID');
reset role;
drop trigger submit_suppress on eps.specs;
select pg_temp.submit_unchanged('suppressed source write rolls everything back');
create trigger submit_suppress before update on eps.workspaces for each row execute function pg_temp.submit_suppress('all');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000004'',''{"source_text":"Synthetic fault source"}'',''fault-workspace-0000000000000000'')','RESOURCE_NOT_FOUND');
reset role;
drop trigger submit_suppress on eps.workspaces;
select pg_temp.submit_unchanged('suppressed workspace bump rolls original text back');
create trigger submit_suppress before insert on eps.jobs for each row execute function pg_temp.submit_suppress('all');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000005'',''{"source_text":"Synthetic fault source"}'',''fault-job-0000000000000000'')','ANY_FAILURE');
reset role;
drop trigger submit_suppress on eps.jobs;
select pg_temp.submit_unchanged('suppressed job insertion never returns a fake acceptance');
create trigger submit_suppress before insert on eps.outbox_events for each row execute function pg_temp.submit_suppress('all');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000006'',''{"source_text":"Synthetic fault source"}'',''fault-outbox-0000000000000000'')','SPECS_STATE_INVALID');
reset role;
drop trigger submit_suppress on eps.outbox_events;
select pg_temp.submit_unchanged('suppressed dispatch rolls source and job back');
create trigger submit_suppress before insert on eps.audit_events for each row execute function pg_temp.submit_suppress('job_audit');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000007'',''{"source_text":"Synthetic fault source"}'',''fault-job-audit-0000000000000000'')','SPECS_STATE_INVALID');
reset role;
drop trigger submit_suppress on eps.audit_events;
select pg_temp.submit_unchanged('suppressed enqueue audit rolls source/job/outbox/internal receipt back');
create trigger submit_suppress before insert on eps.idempotency_records for each row execute function pg_temp.submit_suppress('internal_idem');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000008'',''{"source_text":"Synthetic fault source"}'',''fault-internal-idem'')','SPECS_STATE_INVALID');
reset role;
drop trigger submit_suppress on eps.idempotency_records;
select pg_temp.submit_unchanged('suppressed internal receipt rolls source/job/outbox/audit back');
create trigger submit_suppress before update on eps.specs for each row execute function pg_temp.submit_suppress('pointer');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000009'',''{"source_text":"Synthetic fault source"}'',''fault-pointer-0000000000000000'')','SPECS_STATE_INVALID');
reset role;
drop trigger submit_suppress on eps.specs;
select pg_temp.submit_unchanged('suppressed final pointer rolls source/job/outbox/all receipts back');
create trigger submit_suppress before insert on eps.idempotency_records for each row execute function pg_temp.submit_suppress('external_idem');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000010'',''{"source_text":"Synthetic fault source"}'',''fault-external-idem'')','SPECS_STATE_INVALID');
reset role;
drop trigger submit_suppress on eps.idempotency_records;
select pg_temp.submit_unchanged('suppressed public receipt rolls entire transaction back');
create trigger submit_suppress before insert on eps.audit_events for each row execute function pg_temp.submit_suppress('source_audit');
set local role authenticated;
select pg_temp.submit_expect('select public.eps_submit_specs(''7c970000-0000-4000-8000-000000000011'',''{"source_text":"Synthetic fault source"}'',''fault-source-audit'')','SPECS_STATE_INVALID');
reset role;
drop trigger submit_suppress on eps.audit_events;
select pg_temp.submit_unchanged('suppressed source audit rolls public/internal receipts and source/job/outbox back');

-- Privilege boundaries are genuine column/role checks, including zero-row DML.
set local role eps_specs_submit_owner;
select pg_temp.submit_expect('update eps.specs_pipeline_config set enabled=true where false','42501');
select pg_temp.submit_expect('update eps.specs set source_extraction=''{}'' where false','42501');
select pg_temp.submit_expect('update eps.roles set name=''forbidden'' where false','42501');
reset role;
set local role eps_specs_owner;
select pg_temp.submit_expect('update eps.specs set source_text=''forbidden'' where false','42501');
reset role;
set local role authenticated;
select pg_temp.submit_expect('select eps.m02_enqueue_specs_job(''7c970000-0000-4000-8000-000000000001'',''{}'',''forged'')','42501');
reset role;
select pg_temp.submit_assert(not pg_has_role('authenticated','eps_specs_submit_owner','MEMBER')
 and not has_function_privilege('service_role','public.eps_submit_specs(uuid,jsonb,text)','EXECUTE')
 and not has_function_privilege('anon','public.eps_submit_specs(uuid,jsonb,text)','EXECUTE')
 and not has_function_privilege('eps_api_owner','eps.m02_enqueue_specs_job(uuid,jsonb,text)','EXECUTE')
 and not has_function_privilege('eps_specs_owner','eps.m02_enqueue_specs_job(uuid,jsonb,text)','EXECUTE')
 and has_function_privilege('eps_specs_submit_owner','eps.m02_enqueue_specs_job(uuid,jsonb,text)','EXECUTE')
 and (select not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole from pg_roles where rolname='eps_specs_submit_owner'),
 'new submit authority is narrow/non-login/non-bypass and never granted to acting users');
select pg_temp.submit_assert(not exists(select 1 from eps.audit_events where principal_id::text like '7a970000-%' and to_jsonb(audit_events)::text like '%SYNTHETIC_PRIVATE_HEADER_NOT_PERSISTED%'), 'authorization header never enters audit');
select jsonb_build_object('initial_text_and_exact_reuse_assertions',true,'silent_write_faults',9,'different_source_correction_implemented',false,
 'provider_called',false,'stage_callbacks_tested',false,'concurrent_sessions_tested',false,'rollback_required',true);
