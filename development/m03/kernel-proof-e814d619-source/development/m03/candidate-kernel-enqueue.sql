-- Narrow authorized completion hook. Parent upload API performs actual transfer
-- metadata checks; native preparation independently verifies bytes/checksum.
grant select,insert on eps.jobs to eps_candidate_upload_owner;
grant insert on eps.outbox_events to eps_candidate_upload_owner;
grant select on eps.candidate_uploads to eps_candidate_upload_owner;
grant update(status,completed_at,completed_input,job_id) on eps.candidate_uploads to eps_candidate_upload_owner;
grant select(id,project_id,archived_at),update(id) on eps.workspaces to eps_candidate_upload_owner;
grant execute on function eps.candidate_job_hash(jsonb),eps.candidate_stage_can_write(uuid,uuid),eps.require_capability(text),eps.fail(text,text,integer,bigint),eps.specs_stage_assert(boolean,text) to eps_candidate_upload_owner;
create policy candidate_upload_enqueue_job_read on eps.jobs for select to eps_candidate_upload_owner using(kind='candidate_scan' and requested_by=auth.uid());
create policy candidate_upload_enqueue_job_insert on eps.jobs for insert to eps_candidate_upload_owner with check(kind='candidate_scan' and requested_by=auth.uid()
 and stage='prepare_candidate' and status='queued' and attempt=0 and current_attempt_id is null and lease_token_digest is null and dispatch_generation=1
 and exists(select 1 from eps.candidate_uploads u where u.id=resource_id and u.asset_id=input_asset_id and u.workspace_id=jobs.workspace_id and u.principal_id=auth.uid()));
create policy candidate_upload_enqueue_outbox on eps.outbox_events for insert to eps_candidate_upload_owner with check(exists(select 1 from eps.jobs j where j.id=job_id and j.kind='candidate_scan' and j.requested_by=auth.uid() and stage='prepare_candidate' and dispatch_generation=1));
create policy candidate_upload_self_read on eps.candidate_uploads for select to eps_candidate_upload_owner using(principal_id=auth.uid());
create policy candidate_upload_self_update on eps.candidate_uploads for update to eps_candidate_upload_owner
 using(principal_id=auth.uid() and eps.candidate_stage_can_write(auth.uid(),workspace_id))
 with check(principal_id=auth.uid() and status='completed' and completed_input is not null and job_id is not null and eps.candidate_stage_can_write(auth.uid(),workspace_id));
create policy candidate_upload_enqueue_workspace_read on eps.workspaces for select to eps_candidate_upload_owner using(eps.candidate_stage_can_write(auth.uid(),id));
create policy candidate_upload_enqueue_workspace_lock on eps.workspaces for update to eps_candidate_upload_owner using(eps.candidate_stage_can_write(auth.uid(),id)) with check(false);
create function eps.enqueue_candidate_scan(p_upload_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare intent eps.candidate_uploads; workspace eps.workspaces; config eps.candidate_asset_config; job eps.jobs; input_value jsonb; job_id uuid:=gen_random_uuid();hash_value text;begin
 perform eps.require_capability('cast.read');perform eps.require_capability('cast.upload');perform eps.require_capability('workspaces.write');perform eps.require_capability('projects.read');
 select * into intent from eps.candidate_uploads where id=p_upload_id and principal_id=auth.uid();
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Candidate upload not found.',404);end if;
 select * into workspace from eps.workspaces where id=intent.workspace_id for update;
 perform eps.specs_stage_assert(found and eps.candidate_stage_can_write(auth.uid(),workspace.id),'RESOURCE_NOT_FOUND');
 select * into intent from eps.candidate_uploads where id=p_upload_id and workspace_id=workspace.id and principal_id=auth.uid() for update;
 if intent.status='completed' then
  select * into job from eps.jobs where id=intent.job_id and kind='candidate_scan' and requested_by=auth.uid();perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
  return jsonb_build_object('job_id',job.id,'resource_id',intent.asset_id,'status',job.status,'poll_url','/api/v1/jobs/'||job.id::text);
 end if;
 perform eps.specs_stage_assert(intent.status='open' and intent.expires_at>clock_timestamp(),'INVALID_TRANSITION');
 select * into config from eps.candidate_asset_config where id and enabled;
 if not found then perform eps.fail('DEPENDENCY_UNAVAILABLE','Candidate processing is not configured.',503);end if;
 input_value:=jsonb_build_object('schema_version','1.0','workspace_id',workspace.id,'project_id',workspace.project_id,'source_asset_id',intent.asset_id,
  'source_size_bytes',intent.expected_size_bytes,'source_mime_type',intent.expected_mime_type,'source_declared_sha256',intent.expected_sha256,
  'target_candidate_id',intent.target_candidate_id,'target_candidate_row_version',intent.target_candidate_row_version,
  'configuration',jsonb_build_object('transcription_model',config.transcription_model,'extraction_model',config.extraction_model,'prompt_version',config.prompt_version,
   'schema_version',config.schema_version,'media_implementation_version',config.media_implementation_version));
 hash_value:=eps.candidate_job_hash(input_value);
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input_asset_id,batch_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id)
 values(job_id,workspace.id,auth.uid(),'candidate_scan',intent.id,intent.asset_id,intent.batch_id,input_value,hash_value,'eps.candidate-input.pg-jsonb.v1',
  encode(sha256(convert_to('candidate_scan:'||intent.id::text,'UTF8')),'hex'),'prepare_candidate','candidate:'||job_id::text) returning * into job;
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key) values(job.id,job.stage,job.input_hash,1,job.id::text||':1');
 update eps.candidate_uploads set status='completed',completed_at=clock_timestamp(),completed_input=input_value,job_id=job.id where id=intent.id and status='open';
 perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
 return jsonb_build_object('job_id',job.id,'resource_id',intent.asset_id,'status',job.status,'poll_url','/api/v1/jobs/'||job.id::text);
end $$;
grant create on schema eps to eps_candidate_upload_owner;
alter function eps.enqueue_candidate_scan(uuid) owner to eps_candidate_upload_owner;
revoke create on schema eps from eps_candidate_upload_owner;
revoke all on function eps.enqueue_candidate_scan(uuid) from public,anon,authenticated,service_role;
-- Only the authenticated upload completion definer may invoke this hook.
