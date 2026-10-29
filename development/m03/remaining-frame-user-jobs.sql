-- Compose AFTER remaining-frames.sql. Frame jobs are requester-only global library work;
-- their origin workspace is lineage, not an extra project-membership requirement.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $baseline$
declare item record;actual text;begin
  for item in select * from (values
    ('public.eps_get_job(uuid)','12b0ca41408f90e234e572e141a1f4c29b5974f56901d47e24fb9b156b70a810'),
    ('public.eps_list_jobs(uuid,text,uuid,integer)','582adfd0958de33dc0d1eac0ffb55feb7be303bf7fd7f3a46d5850cfe530352d'),
    ('public.eps_retry_job(uuid,jsonb,text)','f5ef70c8cff5621f603712d6bebe5b50775a5669112d4921dc3183aa348db41a'),
    ('public.eps_cancel_job(uuid,jsonb,text)','601b0246f5ef907f9e02f5f39fc11c9b650cc42baa81bab31dbcb08d0faa2403')
  ) expected(signature,sha) loop
    select encode(sha256(convert_to(replace(proc.prosrc,E'\r\n',E'\n'),'UTF8')),'hex') into actual
      from pg_proc proc where proc.oid=to_regprocedure(item.signature) and proc.proowner='eps_jobs_owner'::regrole
      and proc.prosecdef and proc.proconfig=array['search_path=""'] and proc.provolatile='v' and proc.prokind='f'
      and not proc.proleakproof and proc.prorettype='jsonb'::regtype;
    if actual is distinct from item.sha then raise exception 'FRAME_USER_JOB_WRAPPER_BASELINE_CHANGED';end if;
  end loop;
  for item in select * from (values
    ('eps.jobs','jobs_read','r','0dba772a7e4cdea132233564c66d74c28d99fb4994c5fa02de7e0602cdb0e22e'),
    ('eps.jobs','jobs_update','w','3acaca0bc88fd65a9b9630de87f5c8775a4317aab6a273bf449e7919c781ee20'),
    ('eps.outbox_events','outbox_insert','a','7c72cba3563f1fda88acc24b44afc864d678b6140ead0358a84f5106e90a978b')
  ) expected(relation_name,policy_name,command,sha) loop
    select encode(sha256(convert_to(coalesce(pg_get_expr(policy.polqual,policy.polrelid),'')||E'\n'||coalesce(pg_get_expr(policy.polwithcheck,policy.polrelid),''),'UTF8')),'hex') into actual
      from pg_policy policy where policy.polrelid=to_regclass(item.relation_name) and policy.polname=item.policy_name
      and policy.polroles=array['eps_jobs_owner'::regrole::oid] and policy.polpermissive and policy.polcmd::text=item.command;
    if actual is distinct from item.sha then raise exception 'FRAME_USER_JOB_POLICY_BASELINE_CHANGED';end if;
  end loop;
  if not exists(select 1 from pg_proc proc where proc.oid='eps.jobs_dto(uuid)'::regprocedure
    and proc.proowner='eps_jobs_owner'::regrole and not proc.prosecdef and proc.provolatile='s'
    and proc.proconfig=array['search_path=""'] and proc.prorettype='jsonb'::regtype
    and encode(sha256(convert_to(replace(proc.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='f543148bb07b8f572bddad844555dca82bddf36af99fdae84dbb46517117590a')
  then raise exception 'FRAME_JOB_DTO_BASELINE_CHANGED';end if;
end $baseline$;

create function eps.frame_user_can_read(p_job eps.jobs) returns boolean language sql volatile security invoker set search_path='' as $$
  select (p_job).kind='frame_extract' and (p_job).requested_by=auth.uid() and eps.has_capability('cast.read')
    and eps.frame_is_job((p_job).id)
$$;
create function eps.frame_user_can_operate(p_job eps.jobs,p_retry boolean) returns boolean language sql volatile security invoker set search_path='' as $$
  select eps.frame_user_can_read(p_job) and eps.has_capability('operations.retry')
    and (not p_retry or eps.frame_stage_can_execute((p_job).requested_by) and eps.frame_source_matches(p_job))
$$;
-- Result-only safe projection: no private stage-table grants, raw warnings or source payloads.
create function eps.frame_user_outcome(p_job eps.jobs) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:=p_job.result;requested integer;extracted integer;unavailable integer;duration integer;item jsonb;warning_values jsonb:='[]';begin
  if p_job.kind<>'frame_extract' or p_job.status<>'succeeded' then return null;end if;
  if jsonb_typeof(result) is distinct from 'object' or (select count(*) from jsonb_object_keys(result))<>8
    or result->>'candidate_media_id' is distinct from p_job.resource_id::text or result->>'source_asset_id' is distinct from p_job.input_asset_id::text
    or jsonb_typeof(result->'frame_asset_ids') is distinct from 'array' or jsonb_array_length(result->'frame_asset_ids')>10
    or jsonb_typeof(result->'unavailable_timestamps_ms') is distinct from 'array' or jsonb_array_length(result->'unavailable_timestamps_ms')>10
    or jsonb_typeof(result->'warnings') is distinct from 'array' or jsonb_array_length(result->'warnings')>2
    or jsonb_typeof(p_job.input->'timestamps_ms') is distinct from 'array' or jsonb_array_length(p_job.input->'timestamps_ms') not between 1 and 10
  then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
  foreach item in array array[result->'requested_count',result->'frame_count',result->'unavailable_count',p_job.input->'source_duration_ms'] loop
    if jsonb_typeof(item) is distinct from 'number' or item::text!~'^[0-9]{1,7}$' then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
  end loop;
  requested:=(result->>'requested_count')::integer;extracted:=(result->>'frame_count')::integer;unavailable:=(result->>'unavailable_count')::integer;duration:=(p_job.input->>'source_duration_ms')::integer;
  if requested not between 1 and 10 or extracted not between 0 and 10 or unavailable not between 0 and 10 or duration not between 1 and 1800000
    or requested<>jsonb_array_length(p_job.input->'timestamps_ms') or extracted<>jsonb_array_length(result->'frame_asset_ids')
    or unavailable<>jsonb_array_length(result->'unavailable_timestamps_ms') or extracted+unavailable>requested
    or exists(select 1 from jsonb_array_elements(result->'frame_asset_ids') value where jsonb_typeof(value)<>'string' or value#>>'{}'!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
    or (select count(*)<>count(distinct value) from jsonb_array_elements(result->'frame_asset_ids'))
    or exists(select 1 from jsonb_array_elements(result->'warnings') value where jsonb_typeof(value)<>'string' or value#>>'{}' not in('FRAME_TIMESTAMP_SHARED','FRAME_TIMESTAMP_UNAVAILABLE'))
    or (select count(*)<>count(distinct value) from jsonb_array_elements(result->'warnings'))
  then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
  for item in select value from jsonb_array_elements(result->'unavailable_timestamps_ms') loop
    if jsonb_typeof(item) is distinct from 'number' or item::text!~'^[0-9]{1,7}$' then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
    if item::text::integer>=duration or not(p_job.input->'timestamps_ms' @> jsonb_build_array(item)) then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
  end loop;
  if (select count(*)<>count(distinct value) from jsonb_array_elements(result->'unavailable_timestamps_ms')) then perform eps.fail('RESULT_INVALID','Frame extraction outcome is unavailable.',503);end if;
  if extracted<requested-unavailable then warning_values:=warning_values||'"FRAME_TIMESTAMP_SHARED"'::jsonb;end if;
  if unavailable>0 then warning_values:=warning_values||'"FRAME_TIMESTAMP_UNAVAILABLE"'::jsonb;end if;
  return jsonb_build_object('requested_count',requested,'extracted_count',extracted,'unavailable_timestamps_ms',result->'unavailable_timestamps_ms','warnings',warning_values);
end $$;
revoke all on function eps.frame_user_can_read(eps.jobs),eps.frame_user_can_operate(eps.jobs,boolean),eps.frame_user_outcome(eps.jobs) from public,anon,authenticated,service_role;
grant create on schema eps to eps_jobs_owner;
alter function eps.frame_user_can_read(eps.jobs) owner to eps_jobs_owner;
alter function eps.frame_user_can_operate(eps.jobs,boolean) owner to eps_jobs_owner;
alter function eps.frame_user_outcome(eps.jobs) owner to eps_jobs_owner;
revoke create on schema eps from eps_jobs_owner;
create or replace function eps.jobs_dto(p_job uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',id,'workspace_id',workspace_id,'kind',kind,'status',status,'stage',stage,'attempt',attempt,
    'progress_completed',progress_completed,'progress_total',progress_total,'batch_id',batch_id,'input_asset_id',input_asset_id,'resource_id',resource_id,
    'error',error,'created_at',created_at,'updated_at',updated_at,'row_version',row_version)
    ||case when kind='frame_extract' and status='succeeded' then jsonb_build_object('frame_extraction',eps.frame_user_outcome(jobs)) else '{}'::jsonb end
  from eps.jobs where id=p_job
$$;

-- Dispatcher paths retain their original authority. User paths cannot fall back to
-- origin-project access for frame jobs belonging to somebody else.
alter policy jobs_read on eps.jobs using(
  eps.jobs_dispatch_mode()
  or kind<>'frame_extract' and (eps.jobs_can_access(workspace_id,'read') or eps.jobs_can_access(workspace_id,'enqueue') or eps.jobs_can_access(workspace_id,'operate'))
  or kind='frame_extract' and requested_by=auth.uid() and eps.has_capability('cast.read'));
alter policy jobs_update on eps.jobs using(
  eps.jobs_dispatch_mode() or kind<>'frame_extract' and eps.jobs_can_access(workspace_id,'operate')
  or kind='frame_extract' and requested_by=auth.uid() and eps.has_capability('cast.read') and eps.has_capability('operations.retry'))
  with check(eps.jobs_dispatch_mode() or kind<>'frame_extract' and eps.jobs_can_access(workspace_id,'operate')
  or kind='frame_extract' and requested_by=auth.uid() and eps.has_capability('cast.read') and eps.has_capability('operations.retry'));
alter policy outbox_insert on eps.outbox_events with check(eps.jobs_dispatch_mode() or exists(
  select 1 from eps.jobs job where job.id=outbox_events.job_id and (
    job.kind<>'frame_extract' and (eps.jobs_can_access(job.workspace_id,'enqueue') or eps.jobs_can_access(job.workspace_id,'operate'))
    or job.kind='frame_extract' and eps.frame_user_can_operate(job,true))));

-- Exact source guards above and bounded single replacements preserve all original
-- ordinary-job validation, lifecycle, versioning, idempotency, audit and DTO logic.
do $wrappers$
declare signature text;definition text;old_text text;new_text text;operation text;retry boolean;begin
  foreach signature in array array['public.eps_get_job(uuid)','public.eps_list_jobs(uuid,text,uuid,integer)'] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    old_text:='if not(eps.has_capability(''workspaces.read'') or eps.has_capability(''operations.read'')) then';
    new_text:='if not(eps.has_capability(''workspaces.read'') or eps.has_capability(''operations.read'') or eps.has_capability(''cast.read'')) then';
    if length(definition)-length(replace(definition,old_text,''))<>length(old_text) then raise exception 'FRAME_JOB_READ_CAPABILITY_SEAM_CHANGED';end if;
    definition:=replace(definition,old_text,new_text);
    old_text:='and eps.jobs_can_access(workspace_id,''read'')';
    new_text:='and (kind=''frame_extract'' and eps.frame_user_can_read(jobs) or kind<>''frame_extract'' and eps.jobs_can_access(workspace_id,''read''))';
    if length(definition)-length(replace(definition,old_text,''))<>length(old_text) then raise exception 'FRAME_JOB_READ_SCOPE_SEAM_CHANGED';end if;
    execute replace(definition,old_text,new_text);
  end loop;
  foreach operation in array array['retry','cancel'] loop
    retry:=operation='retry';signature:='public.eps_'||operation||'_job(uuid,jsonb,text)';definition:=pg_get_functiondef(signature::regprocedure);
    old_text:='select * into job from eps.jobs where id=p_job_id and eps.jobs_can_access(workspace_id,''operate'') for update;';
    new_text:='select * into job from eps.jobs where id=p_job_id and (case when kind=''frame_extract'' then eps.frame_user_can_operate(jobs,'||retry::text||') else eps.jobs_can_access(workspace_id,''operate'') end) for update;';
    if length(definition)-length(replace(definition,old_text,''))<>length(old_text) then raise exception 'FRAME_JOB_OPERATE_SCOPE_SEAM_CHANGED';end if;
    definition:=replace(definition,old_text,new_text);
    old_text:='if not eps.jobs_can_access(job.workspace_id,''operate'') then';
    new_text:='if not(case when job.kind=''frame_extract'' then eps.frame_user_can_operate(job,'||retry::text||') else eps.jobs_can_access(job.workspace_id,''operate'') end) then';
    if length(definition)-length(replace(definition,old_text,''))<>length(old_text) then raise exception 'FRAME_JOB_OPERATE_REPLAY_SEAM_CHANGED';end if;
    execute replace(definition,old_text,new_text);
  end loop;
end $wrappers$;
