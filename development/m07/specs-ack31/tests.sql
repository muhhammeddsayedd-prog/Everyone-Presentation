-- NEW owned-clone-only proof. The driver owns the outer rollback transaction.
-- Fixed synthetic identities; no original database, provider or actual token.
set local role postgres;
do $fixture_guard$begin
 if current_setting('eps.local_fixture_tests',true)is distinct from'eps-presentation-canonical-pg17-local'
 or coalesce(current_setting('eps.specs_ack31_phase',true),'')not in('red','green')
 or current_database()not like'eps_m07_issuer30_%'
 or exists(select 1 from auth.users where id in('a0310000-0000-4000-8000-000000000001','a0310000-0000-4000-8000-000000000002'))
 or exists(select 1 from public.projects where id in('a0310000-0000-4000-8000-000000000011','a0310000-0000-4000-8000-000000000012'))
 or exists(select 1 from eps.jobs where id in('a0310000-0000-4000-8000-000000000098','a0310000-0000-4000-8000-000000000099'))
 then raise exception'M07_ACK31_OWNED_SYNTHETIC_NAMESPACE_REQUIRED';end if;
end $fixture_guard$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until)values
 ('a0310000-0000-4000-8000-000000000001',false,null,null),('a0310000-0000-4000-8000-000000000002',false,null,null);
insert into public.projects(id,name)values('a0310000-0000-4000-8000-000000000011','Synthetic ACK31 source proof'),('a0310000-0000-4000-8000-000000000012','Synthetic ACK31 sibling proof');
insert into public.project_memberships(project_id,principal_id,can_write)values
 ('a0310000-0000-4000-8000-000000000011','a0310000-0000-4000-8000-000000000001',true),
 ('a0310000-0000-4000-8000-000000000012','a0310000-0000-4000-8000-000000000001',true),
 ('a0310000-0000-4000-8000-000000000011','a0310000-0000-4000-8000-000000000002',true);
insert into public.app_capability_grants(principal_id,capability)
 select 'a0310000-0000-4000-8000-000000000001'::uuid,unnest(array['projects.read','workspaces.read','workspaces.write'])
 union all select 'a0310000-0000-4000-8000-000000000002'::uuid,unnest(array['projects.read','workspaces.read']);
insert into eps.workspaces(id,project_id)values
 ('a0310000-0000-4000-8000-000000000021','a0310000-0000-4000-8000-000000000011'),
 ('a0310000-0000-4000-8000-000000000022','a0310000-0000-4000-8000-000000000012');
select set_config('eps.specs_ack31_spec',(select id::text from eps.specs where workspace_id='a0310000-0000-4000-8000-000000000021'),true),
 set_config('eps.specs_ack31_other_spec',(select id::text from eps.specs where workspace_id='a0310000-0000-4000-8000-000000000022'),true);
update eps.specs_pipeline_config set enabled=true,document_preparation_version='m07-ack31-local',model_version='m07-ack31-local',prompt_version='m07-ack31-local',result_schema_version='1.0'where id=1;
set local "request.jwt.claim.sub"='a0310000-0000-4000-8000-000000000001';
set local "request.jwt.claims"='{"sub":"a0310000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}';
set local role authenticated;
do $public_rpc$
declare phase text:=current_setting('eps.specs_ack31_phase');ack jsonb;again jsonb;message text;proof jsonb;
 source jsonb:=jsonb_build_object('source_text','Synthetic local acknowledgement projection proof. This public text requests two casting roles and remains inside a disposable rollback transaction.','row_version',1);
begin
 proof:=jsonb_build_object('phase',phase,'expected_failure_observed',false,'sqlstate',null,'permission_object',null,
  'checks',jsonb_build_object('ack',false,'idempotency',false,'stale',false,'denial',false,'invalid_relations',false));
 if phase='red'then
  begin
   perform public.eps_submit_specs('a0310000-0000-4000-8000-000000000021',source,'m07-ack31-local-submit-0001');
   raise exception'M07_ACK31_EXPECTED_PREDECESSOR_DENIAL';
  exception when insufficient_privilege then
   get stacked diagnostics message=message_text;
   if lower(message)not like'%permission denied for table jobs%'then raise exception'M07_ACK31_UNEXPECTED_DENIED_OBJECT';end if;
   proof:=proof||jsonb_build_object('expected_failure_observed',true,'sqlstate','42501','permission_object','jobs');
  end;
 else
  ack:=public.eps_submit_specs('a0310000-0000-4000-8000-000000000021',source,'m07-ack31-local-submit-0001');
  if jsonb_typeof(ack)is distinct from'object'or(select count(*)from jsonb_object_keys(ack))<>4
  or ack->>'resource_id'is distinct from current_setting('eps.specs_ack31_spec')
  or ack->>'status'is distinct from'queued'or ack->>'job_id'is null
  or ack->>'poll_url'is distinct from'/api/v1/jobs/'||(ack->>'job_id')
  then raise exception'M07_ACK31_CLOSED_ACK_FAILED';end if;
  perform(ack->>'job_id')::uuid;
  proof:=jsonb_set(proof,'{checks,ack}','true'::jsonb);
  again:=public.eps_submit_specs('a0310000-0000-4000-8000-000000000021',source,'m07-ack31-local-submit-0001');
  if again is distinct from ack then raise exception'M07_ACK31_IDEMPOTENCY_FAILED';end if;
  proof:=jsonb_set(proof,'{checks,idempotency}','true'::jsonb);
  begin
   perform public.eps_submit_specs('a0310000-0000-4000-8000-000000000021',source,'m07-ack31-local-stale-0002');
   raise exception'M07_ACK31_STALE_ACCEPTED';
  exception when raise_exception then if sqlerrm<>'STALE_RESOURCE_VERSION'then raise;end if;end;
  proof:=jsonb_set(proof,'{checks,stale}','true'::jsonb);
  perform set_config('request.jwt.claim.sub','a0310000-0000-4000-8000-000000000002',true);
  perform set_config('request.jwt.claims','{"sub":"a0310000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
  begin
   perform public.eps_submit_specs('a0310000-0000-4000-8000-000000000021',source||'{"row_version":2}'::jsonb,'m07-ack31-local-denied-0003');
   raise exception'M07_ACK31_DENIED_ACTOR_ACCEPTED';
  exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
  perform set_config('request.jwt.claim.sub','a0310000-0000-4000-8000-000000000001',true);
  perform set_config('request.jwt.claims','{"sub":"a0310000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
  proof:=jsonb_set(proof,'{checks,denial}','true'::jsonb);
  perform set_config('eps.specs_ack31_job',ack->>'job_id',true);
 end if;
 perform set_config('eps.specs_ack31_proof',proof::text,true);
end $public_rpc$;
set local role eps_specs_submit_owner;
do $private_relationships$
declare job_id uuid;spec_id uuid;other_id uuid;workspace_id uuid:='a0310000-0000-4000-8000-000000000021';
begin
 if current_setting('eps.specs_ack31_phase')='green'then
  job_id:=current_setting('eps.specs_ack31_job')::uuid;spec_id:=current_setting('eps.specs_ack31_spec')::uuid;other_id:=current_setting('eps.specs_ack31_other_spec')::uuid;
  begin perform eps.specs_submit_ack(job_id,other_id,workspace_id);raise exception'M07_ACK31_WRONG_SPEC_ACCEPTED';
  exception when raise_exception then if sqlerrm<>'SPECS_STATE_INVALID'then raise;end if;end;
  begin perform eps.specs_submit_ack(job_id,spec_id,'a0310000-0000-4000-8000-000000000022');raise exception'M07_ACK31_WRONG_WORKSPACE_ACCEPTED';
  exception when raise_exception then if sqlerrm<>'SPECS_STATE_INVALID'then raise;end if;end;
  begin perform eps.specs_submit_ack('a0310000-0000-4000-8000-000000000099',spec_id,workspace_id);raise exception'M07_ACK31_MISSING_JOB_ACCEPTED';
  exception when raise_exception then if sqlerrm<>'SPECS_STATE_INVALID'then raise;end if;end;
  perform set_config('eps.specs_ack31_proof',jsonb_set(current_setting('eps.specs_ack31_proof')::jsonb,'{checks,invalid_relations}','true'::jsonb)::text,true);
 end if;
end $private_relationships$;
set local role postgres;
do $cross_workspace_fixture$begin
 if current_setting('eps.specs_ack31_phase')='green'then
  -- Keep the accepted job and its retained-source FK intact. A separate local
  -- leaf row has no outbox or retained-source child and exists only to prove
  -- the acknowledgement rejects a job/Spec workspace disagreement.
  insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input_asset_id,input,input_hash,input_hash_version,dedupe_key,correlation_id,status,stage)
   select 'a0310000-0000-4000-8000-000000000098','a0310000-0000-4000-8000-000000000022',j.requested_by,j.kind,j.resource_id,j.input_asset_id,j.input,j.input_hash,j.input_hash_version,
    encode(sha256(convert_to('m07-ack31-local-badlink:'||j.id::text,'UTF8')),'hex'),'m07-ack31-local-bad-link',j.status,j.stage
   from eps.jobs j where j.id=current_setting('eps.specs_ack31_job')::uuid;
  if not found then raise exception'M07_ACK31_LOCAL_CROSS_WORKSPACE_FIXTURE_MISSING';end if;
 end if;
end $cross_workspace_fixture$;
set local role eps_specs_submit_owner;
do $cross_workspace_denied$begin
 if current_setting('eps.specs_ack31_phase')='green'then
  begin
   perform eps.specs_submit_ack('a0310000-0000-4000-8000-000000000098',current_setting('eps.specs_ack31_spec')::uuid,'a0310000-0000-4000-8000-000000000021');
   raise exception'M07_ACK31_CROSS_WORKSPACE_JOB_ACCEPTED';
  exception when raise_exception then if sqlerrm<>'SPECS_STATE_INVALID'then raise;end if;end;
 end if;
end $cross_workspace_denied$;
set local role postgres;
do $atomicity$
declare expected bigint:=case when current_setting('eps.specs_ack31_phase')='green'then 1 else 0 end;
begin
 if(select count(*)from eps.jobs where workspace_id='a0310000-0000-4000-8000-000000000021')<>expected
 or(select count(*)from eps.idempotency_records where principal_id='a0310000-0000-4000-8000-000000000001'and operation='specs.submit_specs')<>expected
 or(select count(*)from eps.idempotency_records where principal_id='a0310000-0000-4000-8000-000000000001'and operation='jobs.enqueue')<>expected
 or(select count(*)from eps.outbox_events where job_id in(select id from eps.jobs where workspace_id='a0310000-0000-4000-8000-000000000021'))<>expected
 or(select count(*)from eps.idempotency_records where principal_id='a0310000-0000-4000-8000-000000000002')<>0
 or(select row_version from eps.specs where workspace_id='a0310000-0000-4000-8000-000000000021')<>1+expected
 then raise exception'M07_ACK31_SOURCE_JOB_OUTBOX_IDEMPOTENCY_ATOMICITY_FAILED';end if;
end $atomicity$;
select jsonb_build_object('specs_ack31_proof',current_setting('eps.specs_ack31_proof')::jsonb);
