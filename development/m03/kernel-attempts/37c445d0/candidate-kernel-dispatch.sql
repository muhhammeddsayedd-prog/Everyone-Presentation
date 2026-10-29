-- Private recovery plus guarded feature dispatch into the existing narrow port.
create function eps.recover_candidate_job_stages(p_limit integer) returns integer language plpgsql volatile security definer set search_path='' as $$
declare candidate record;job eps.jobs;recovered integer:=0;locked uuid;at_value timestamptz;obsolete boolean;attempts integer;begin
 perform eps.specs_stage_assert(p_limit between 0 and 100);if p_limit=0 then return 0;end if;
 for candidate in select j.id,j.workspace_id from eps.jobs j where j.kind='candidate_scan' and j.status in('queued','running')
  and (j.status='running' and j.lease_expires_at<=clock_timestamp() or not eps.candidate_stage_can_write(j.requested_by,j.workspace_id) or not eps.candidate_stage_source_matches(j))
  order by j.lease_expires_at nulls last,j.id limit 1000 loop
  exit when recovered>=p_limit;
  select id into locked from eps.workspaces where id=candidate.workspace_id for update skip locked;if not found then continue;end if;
  job:=eps.candidate_stage_lock(candidate.id,false);at_value:=clock_timestamp();if job.status not in('queued','running') then continue;end if;
  obsolete:=not eps.candidate_stage_can_write(job.requested_by,job.workspace_id) or not eps.candidate_stage_source_matches(job);
  if not obsolete and (job.status='queued' or job.lease_expires_at>at_value) then continue;end if;
  attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);
  if obsolete then job.status:='waiting_for_input';job.error:=eps.specs_stage_error('INPUT_CHANGED');
  elsif attempts>=3 then job.status:='failed';job.error:=jsonb_build_object('code','RETRY_EXHAUSTED','message','Candidate stage retry budget exhausted. Existing media and edits were retained.','details','{}'::jsonb,'retryable',false);
  else job.status:='queued';job.error:=eps.specs_stage_error('LEASE_EXPIRED');job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval '2 seconds';end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id;
  if job.status='queued' then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at) values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;
  recovered:=recovered+1;
 end loop;return recovered;
end $$;
grant create on schema eps to eps_candidate_stage_owner;
do $$declare routine regprocedure;begin
 foreach routine in array array['eps.candidate_stage_asset_reference(jsonb,eps.jobs,text,uuid)'::regprocedure,'eps.candidate_validate_stage(eps.jobs,text,jsonb)'::regprocedure,
 'eps.record_candidate_job_event(jsonb)'::regprocedure,'eps.recover_candidate_job_stages(integer)'::regprocedure] loop
  execute format('alter function %s owner to eps_candidate_stage_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);
 end loop;
end $$;
revoke create on schema eps from eps_candidate_stage_owner;
grant execute on function eps.record_candidate_job_event(jsonb),eps.recover_candidate_job_stages(integer) to eps_specs_stage_owner;

-- Preserve each proven specs implementation byte-for-byte except a closed
-- dispatch branch. Hash checks stop on any unexpected preceding implementation.
-- No new service EXECUTE grants or arbitrary kind/handler selection is added.
do $dispatch$
declare item record;source text;definition text;replacement text;begin
 for item in select * from (values
  ('eps.claim_job_stage(jsonb)','213bb7a05f3e0b60f8a1564cc2ccebf156c11d2fd776b17a4ece2a25e4b4c7ad',
   E'begin\n',E'begin\n if p_input->>''stage'' in(''prepare_candidate'',''transcribe_candidate'',''extract_candidate'',''select_frames'',''apply_candidate'') then return eps.claim_candidate_job_stage(p_input);end if;\n'),
  ('eps.record_job_event(jsonb)','53c3d545c77e401adb898635085ec14376bc671f2810220277b5dda42729d0d4',
   E'begin\n',E'begin\n if p_event->>''stage'' in(''prepare_candidate'',''transcribe_candidate'',''extract_candidate'',''select_frames'',''apply_candidate'') then return eps.record_candidate_job_event(p_event);end if;\n'),
  ('eps.get_specs_stage_input(uuid,uuid,text)','564b721ccaa4be5d13bcc765f638beb8ea4ad32d34ebc11386b4a125432d0bab',
   E'begin\n',E'begin\n if eps.candidate_is_job(p_job_id) then return eps.get_candidate_stage_input(p_job_id,p_attempt_id,p_lease_token);end if;\n'),
  ('eps.recover_job_stages(integer)','305343413bcf218e162b716aae4b38c88942303b1c9aa7a5da295784c5af956d',
   'return jsonb_build_object(''recovered'',recovered);','return jsonb_build_object(''recovered'',recovered+eps.recover_candidate_job_stages(p_limit-recovered));'),
  ('eps.get_job_asset_access(jsonb)','f11b9381b0e95e923e66984e83d416c7070c0db4f4314034c0334176108ecfcc',
   E'begin\n',E'begin\n if eps.candidate_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.get_candidate_asset_access(p_input);end if;\n'),
  ('eps.reserve_job_output(jsonb)','e663c98955de501a5c7c0ada5fdaf0f5129f5096562adc4057bdf10339622a03',
   E'begin\n',E'begin\n if eps.candidate_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.reserve_candidate_job_output(p_input);end if;\n'),
  ('eps.complete_job_output(jsonb)','00a65070176dd0d284c62da2ccebd09acf966de520e5c3ee04ff1bfb38518fce',
   E'begin\n',E'begin\n if eps.candidate_is_job(eps.input_uuid(p_input->>''job_id'')) then return eps.complete_candidate_job_output(p_input);end if;\n')
 ) as changes(signature,old_hash,anchor,insert_value) loop
  select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>item.old_hash then raise exception 'REVIEWED_M02_DISPATCH_SOURCE_REQUIRED: %',item.signature;end if;
  if position(E'\r\n' in source)>0 then item.anchor:=replace(item.anchor,E'\n',E'\r\n');item.insert_value:=replace(item.insert_value,E'\n',E'\r\n');end if;
  if position(item.anchor in source)=0 then raise exception 'REVIEWED_M02_DISPATCH_ANCHOR_REQUIRED: %',item.signature;end if;
  -- Only replace the first top-level BEGIN; nested parser blocks retain source.
  if item.anchor in(E'begin\n',E'begin\r\n') then replacement:=overlay(source placing item.insert_value from position(item.anchor in source) for length(item.anchor));
  else replacement:=replace(source,item.anchor,item.insert_value);end if;
  definition:=replace(definition,source,replacement);execute definition;
 end loop;
 -- Durable claim replay uses the same private record/ciphertext and current
 -- identity; only the per-kind resource/source checks are dispatched.
 select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid='eps.claim_job_stage_replay(jsonb,text,text,text)'::regprocedure;
 if encode(sha256(convert_to(replace(source,E'\r\n',E'\n'),'UTF8')),'hex')<>'e7ef7d1a6d2d83acb7d0c6520a8bf56ec5016ebf897adc85f033e1cef32eefe4' then raise exception 'REVIEWED_M02_REPLAY_SOURCE_REQUIRED';end if;
 replacement:=replace(source,'job:=eps.specs_stage_lock(old.job_id);','if eps.candidate_is_job(old.job_id) then job:=eps.candidate_stage_lock(old.job_id);else job:=eps.specs_stage_lock(old.job_id);end if;');
 replacement:=replace(replacement,'perform eps.specs_stage_configuration(job.input->''configuration'');','if job.kind=''specs_extract'' then perform eps.specs_stage_configuration(job.input->''configuration'');end if;');
 replacement:=replace(replacement,'eps.specs_stage_source_matches(job)','case when job.kind=''candidate_scan'' then eps.candidate_stage_source_matches(job) else eps.specs_stage_source_matches(job) end');
 if replacement=source then raise exception 'REPLAY_DISPATCH_ANCHORS_REQUIRED';end if;execute replace(definition,source,replacement);
end $dispatch$;
notify pgrst,'reload schema';
