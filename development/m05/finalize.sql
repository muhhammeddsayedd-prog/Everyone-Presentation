-- Extend existing constrained ports. No new runtime login or executable port.
create function eps.presentation_job_actions(p_job eps.jobs)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare operator boolean;principal uuid;begin
 principal:=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
 operator:=eps.job_requester_active(principal)and exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id join public.project_memberships m on m.project_id=p.id where w.id=p_job.workspace_id and w.archived_at is null and p.archived_at is null and m.principal_id=principal and m.active and m.can_write)
 and exists(select 1 from public.app_capability_grants where principal_id=principal and capability='operations.retry'and active);
 return jsonb_build_object('can_retry',coalesce(operator and p_job.status='failed'and p_job.cancel_requested_at is null and p_job.error->>'code'is distinct from'JOB_CANCELLED'and eps.presentation_stage_can_write(p_job.requested_by,p_job.workspace_id)and eps.presentation_stage_matches(p_job),false),'can_cancel',coalesce(operator and p_job.status in('queued','running','waiting_for_input'),false));
end$$;
do $dispatch$
declare item record;source text;definition text;replacement text;insertion text;at_value integer;begin
 for item in select * from(values
 ('eps.claim_job_stage(jsonb)','79700d4ec759eb26d67e5256ac146b7d3adcbd450c935ed8c6f36a78fd045338','if p_input->>''stage''in(''prepare_presentation'',''render_presentation'',''validate_presentation'',''publish_presentation'')then return eps.claim_presentation_job_stage(p_input);end if;'),
 ('eps.get_specs_stage_input(uuid,uuid,text)','32a84ecbec0d15d8b6aeaa795b52e9e59867e0daa8af4b04ff356c6831a0d81e','if eps.presentation_is_job(p_job_id)then return eps.get_presentation_stage_input(p_job_id,p_attempt_id,p_lease_token);end if;'),
 ('eps.record_job_event(jsonb)','2addc85893d7abaab1e8ce9402a91956f8b7591998b0ad48b0be8e88ae74d1ac','if p_event->>''stage''in(''prepare_presentation'',''render_presentation'',''validate_presentation'',''publish_presentation'')then return eps.record_presentation_job_event(p_event);end if;'),
 ('eps.get_job_asset_access(jsonb)','12411358d6a2d2199a4b7ad633d68af471780796c7f42323feaa88ca15c382f3','if eps.presentation_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.get_presentation_asset_access(p_input);end if;'),
 ('eps.reserve_job_output(jsonb)','61123aefca808a7fcfff25efa04522404066bf68876a2fcfa39be1cb848ba732','if eps.presentation_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.reserve_presentation_job_output(p_input);end if;'),
 ('eps.complete_job_output(jsonb)','952f8b48d70c69c3f583025e986116b30270e413fe94d08d6297ccf519418517','if eps.presentation_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.complete_presentation_job_output(p_input);end if;'),
 ('eps.recover_job_stages(integer)','6bf6d08b48682b377f408125b3a9c9cdeadce54a3f0b8b555009114d73a1e75a',''),
 ('eps.claim_job_stage_replay(jsonb,text,text,text)','b5fbff3b697fd1a575baa7209fe792b94256d765756172fe5878e9c8ae6a8f8e',''),
 ('eps.jobs_dto(uuid)','17158fb3e7895e526718a620a1d9c2cbab373062a25c347ea066d6bd27438431',''),
 ('public.eps_retry_job(uuid,jsonb,text)','db777cbd79d8965964fb3e9270e90c42c885d2d4821c32869d8413dd9e3eb8ed',''),
 ('public.eps_cancel_job(uuid,jsonb,text)','f08c474649140d9e00555c76687765976ecca1e91212b47955cf8d66a07cd4e7','')
 )v(signature,expected,dispatch)loop
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(source,'UTF8')),'hex')<>item.expected then raise exception'M05_EXACT_PRECEDING_PORT_SOURCE_REQUIRED:%',item.signature;end if;replacement:=source;
  if item.dispatch<>''then at_value:=position('begin'in source);replacement:=overlay(source placing E'begin\n '||item.dispatch||E'\n'from at_value for 6);
  elsif item.signature='eps.recover_job_stages(integer)'then replacement:=replace(source,'recovered:=eps.recover_review_job_stages(p_limit);','recovered:=eps.recover_presentation_job_stages(p_limit);recovered:=recovered+eps.recover_review_job_stages(p_limit-recovered);');
  elsif item.signature='eps.claim_job_stage_replay(jsonb,text,text,text)'then
   replacement:=replace(source,'if eps.frame_is_job(old.job_id) then','if eps.presentation_is_job(old.job_id)then job:=eps.presentation_stage_lock(old.job_id);elsif eps.frame_is_job(old.job_id) then');
   replacement:=replace(replacement,'case when job.kind=''frame_extract''','case when job.kind=''presentation_render''then eps.presentation_stage_matches(job)when job.kind=''frame_extract''');
  elsif item.signature='eps.jobs_dto(uuid)'then replacement:=replace(source,'  from eps.jobs where id=p_job','    ||case when kind=''presentation_render''then eps.presentation_job_actions(jobs)else''{}''::jsonb end'||E'\n  from eps.jobs where id=p_job');
  elsif item.signature='public.eps_retry_job(uuid,jsonb,text)'then
   replacement:=replace(source,'  if response is not null then return response; end if;',E'  if job.kind=''presentation_render''and not eps.presentation_stage_authorized(job)then perform eps.fail(''PERMISSION_CHANGED'',''The original requester no longer has generation authority.'',403);end if;\n  if response is not null then return response; end if;');
   replacement:=replace(replacement,E'  if job.status<>''failed'' or job.cancel_requested_at is not null or coalesce((job.error->>''retryable'')::boolean,false) is not true\n    or coalesce((job.stage_attempts->>job.stage)::integer,0)>=3 then',E'  if job.kind=''presentation_render''and(eps.presentation_job_actions(job)->''can_retry'')is distinct from''true''::jsonb or job.kind<>''presentation_render''and(job.status<>''failed'' or job.cancel_requested_at is not null or coalesce((job.error->>''retryable'')::boolean,false) is not true\n    or coalesce((job.stage_attempts->>job.stage)::integer,0)>=3)then');
   replacement:=replace(replacement,'  update eps.jobs set status=''queued'',error=null,','  update eps.jobs set stage_attempts=case when kind=''presentation_render''then stage_attempts-stage else stage_attempts end,status=''queued'',error=null,');
  else
   replacement:=replace(source,'  if job.status=''succeeded'' then',E'  if job.kind=''presentation_render''and job.status not in(''queued'',''running'',''waiting_for_input'',''cancelled'')then perform eps.fail(''INVALID_TRANSITION'',''This presentation job cannot be cancelled.'',409);end if;\n  if job.status=''succeeded'' then');
  end if;
  if replacement=source then raise exception'M05_PORT_DISPATCH_ANCHOR_REQUIRED:%',item.signature;end if;execute replace(definition,source,replacement);
 end loop;
end$dispatch$;
create function eps.presentation_stage_authorized(p_job eps.jobs)returns boolean language sql volatile security definer set search_path=''as $$select eps.presentation_stage_can_write(p_job.requested_by,p_job.workspace_id)and eps.presentation_stage_matches(p_job)$$;
-- Existing owners retain their unrelated privileges; new private helpers are closed.
grant create on schema eps,public to eps_review_owner,eps_review_stage_owner,eps_candidate_assets_owner;
do $owners$declare item record;owner_name text;begin
 for item in select p.oid::regprocedure signature,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='eps'and(p.proname like'presentation_%'or p.proname in('claim_presentation_job_stage','get_presentation_stage_input','record_presentation_job_event','recover_presentation_job_stages','get_presentation_asset_access','reserve_presentation_job_output','complete_presentation_job_output')))or(n.nspname='public'and p.proname in('eps_generate_version','eps_list_versions','eps_get_version','eps_get_version_asset'))loop
  owner_name:=case when item.nspname='public'or item.proname in('presentation_scope','presentation_hash','presentation_time','presentation_public_slide','presentation_manifest','presentation_render_context','presentation_version_dto','presentation_media_dto','presentation_remember','presentation_lock_sources','presentation_storage_read_allowed')then'eps_review_owner'
   when item.proname in('presentation_asset_member','presentation_capability_allowed','get_presentation_asset_access','reserve_presentation_job_output','complete_presentation_job_output')then'eps_candidate_assets_owner'else'eps_review_stage_owner'end;
  execute format('alter function %s owner to %I',item.signature,owner_name);execute format('revoke all on function %s from public,anon,authenticated,service_role',item.signature);
 end loop;
end$owners$;
revoke create on schema eps,public from eps_review_owner,eps_review_stage_owner,eps_candidate_assets_owner;
grant execute on function public.eps_generate_version(uuid,jsonb,text),public.eps_list_versions(uuid,jsonb),public.eps_get_version(uuid),public.eps_get_version_asset(uuid,uuid,text)to authenticated;
grant execute on function eps.presentation_scope(uuid,boolean),eps.presentation_hash(jsonb),eps.presentation_time(timestamptz),eps.presentation_media_dto(eps.media_assets)to eps_review_stage_owner,eps_candidate_assets_owner;
grant execute on function eps.presentation_immutable_version(),eps.presentation_immutable_row(),eps.presentation_protect_asset(),eps.presentation_ready_pointer()to eps_review_owner;
grant execute on function eps.presentation_hash(jsonb)to eps_review_owner;
grant execute on function eps.presentation_stage_current(uuid,uuid,text),eps.presentation_stage_live(uuid,uuid,text)to eps_candidate_assets_owner;
grant execute on function eps.presentation_is_job(uuid),eps.presentation_stage_lock(uuid,boolean),eps.presentation_stage_matches(eps.jobs),eps.claim_presentation_job_stage(jsonb),eps.get_presentation_stage_input(uuid,uuid,text),eps.record_presentation_job_event(jsonb),eps.recover_presentation_job_stages(integer)to eps_specs_stage_owner;
grant execute on function eps.presentation_is_job(uuid),eps.get_presentation_asset_access(jsonb),eps.reserve_presentation_job_output(jsonb),eps.complete_presentation_job_output(jsonb)to eps_specs_assets_owner;
grant execute on function eps.presentation_job_actions(eps.jobs),eps.presentation_stage_authorized(eps.jobs)to eps_jobs_owner;
grant execute on function eps.presentation_storage_read_allowed(text,text),eps.presentation_capability_allowed(text,text,text)to anon,authenticated;
grant execute on function eps.presentation_public_slide(jsonb),eps.presentation_manifest(jsonb),eps.presentation_render_context(jsonb)to eps_review_stage_owner;
notify pgrst,'reload schema';
