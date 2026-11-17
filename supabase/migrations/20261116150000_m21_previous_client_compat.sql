-- m21: response compatibility for the previous web/MCP release during rollout and rollback.
--
-- Cycle 7 adds fields to seven response objects (settings, role, slot, series, project candidate, Library candidate,
-- job). The previous release (081e2dee) parses those objects with exact key sets and answers
-- CENTRAL_RESPONSE_INVALID when it meets a new key (observed on the staging rehearsal after m16/m18). Requests that
-- arrive through the Data API WITHOUT the `X-EPS-Contract` header (every previous-release request) therefore receive
-- the previous shape; the current release sends the header and receives the full shape. Direct SQL callers (the
-- worker runtime, SQL tests) are not Data API requests and always receive the full shape.
-- Nothing is hidden from authorization's point of view: the stripped keys are additive presentation fields the
-- previous release never displays; every write path and permission check is unchanged.
-- Requires m20. Refuses a second run.
set local search_path='';
do $m21_guard$begin
 if to_regprocedure('eps.previous_client()') is not null then raise exception 'M21_ALREADY_APPLIED'; end if;
 if to_regclass('eps.candidate_observations') is null or to_regprocedure('eps.cast_pool_dto(uuid)') is null then raise exception 'M21_REQUIRES_M20'; end if;
end$m21_guard$;

-- True only for a Data API request that does not declare the current contract.
create function eps.previous_client() returns boolean language sql stable parallel safe set search_path='' as $$
 select case when nullif(current_setting('request.headers',true),'') is null then false
  else not coalesce((current_setting('request.headers',true))::jsonb ? 'x-eps-contract',false) end
$$;
revoke all on function eps.previous_client() from public,anon,authenticated,service_role;

grant create on schema eps to eps_settings_owner,eps_specs_owner,eps_review_owner,eps_cast_owner,eps_jobs_owner;
-- Wrap each response builder: the original is kept as <name>_cycle7; the wrapper (same name/signature/owner/grants)
-- removes the cycle-7 keys for a previous client only.
do $m21_wrap$
declare item record;fn record;inner_name text;args text;call_args text;grantee record;
begin
 for item in select * from(values
  ('eps.settings_dto()',array['default_audience_preset_id']),
  ('eps.specs_role_dto(uuid)',array['presentation_note']),
  ('eps.specs_slot_dto(uuid)',array['presentation_note']),
  ('eps.review_series_dto(eps.presentation_series)',array['cover_note']),
  ('eps.cast_pool_dto(uuid)',array['portrait_asset_id','portrait_source','portrait_crop','media_selection_state']),
  ('eps.cast_library_dto(uuid,jsonb,uuid,boolean)',array['name_ar','talent_type','tape_count','portrait_photo','portrait_frame_asset_id','processing','membership']),
  ('eps.jobs_dto(uuid)',array['candidate_result'])
 )v(signature,keys)loop
  select p.oid,p.proname,p.proowner::regrole::text owner,p.pronargs,pg_get_function_arguments(p.oid) arguments,pg_get_function_result(p.oid) result,p.proacl
   into fn from pg_proc p where p.oid=item.signature::regprocedure;
  if fn.result<>'jsonb' then raise exception 'M21_JSONB_REQUIRED:%',item.signature; end if;
  inner_name:=fn.proname||'_cycle7';
  if to_regproc('eps.'||inner_name) is not null then raise exception 'M21_NAME_TAKEN:%',inner_name; end if;
  execute format('alter function %s rename to %I',item.signature,inner_name);
  select coalesce(string_agg('$'||n,',' order by n),'') into call_args from generate_series(1,fn.pronargs) n;
  execute format($f$create function eps.%I(%s) returns jsonb language sql stable set search_path='' as $w$
 select case when eps.previous_client() then full_value-%L::text[] else full_value end from(select eps.%I(%s) full_value)s
$w$$f$,fn.proname,fn.arguments,item.keys,inner_name,call_args);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',item.signature);
  execute format('alter function %s owner to %s',item.signature,fn.owner);
  for grantee in select distinct a.grantee::regrole::text role from aclexplode(fn.proacl) a where a.privilege_type='EXECUTE' and a.grantee<>0 loop
   execute format('grant execute on function %s to %s',item.signature,grantee.role);
   execute format('grant execute on function eps.previous_client() to %s',grantee.role);
  end loop;
 end loop;
end$m21_wrap$;
revoke create on schema eps from eps_settings_owner,eps_specs_owner,eps_review_owner,eps_cast_owner,eps_jobs_owner;

-- Adding someone already in the project answers with that membership; the previous release does not know the flag.
do $m21_member$declare source text;definition text;
 needle text:=$n$jsonb_build_object('already_member',already)$n$;
 patch text:=$r$(case when eps.previous_client() then '{}'::jsonb else jsonb_build_object('already_member',already) end)$r$;
begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n') into source,definition from pg_proc where oid='eps.cast_mutate(text,uuid,jsonb,text)'::regprocedure;
 if (length(source)-length(replace(source,needle,'')))/length(needle)<>1 then raise exception 'M21_ANCHOR_REQUIRED:eps.cast_mutate'; end if;
 execute replace(definition,source,replace(source,needle,patch));
end$m21_member$;

-- Readback: wrappers in place, originals kept, nothing executable by PUBLIC, previous-client test.
do $m21_readback$declare n integer;begin
 select count(*) into n from pg_proc p where p.pronamespace='eps'::regnamespace and p.proname in('settings_dto_cycle7','specs_role_dto_cycle7','specs_slot_dto_cycle7','review_series_dto_cycle7','cast_pool_dto_cycle7','cast_library_dto_cycle7','jobs_dto_cycle7');
 if n<>7 then raise exception 'M21_READBACK_ORIGINALS:%',n; end if;
 if exists(select 1 from pg_proc p where p.pronamespace='eps'::regnamespace and (p.proname='previous_client' or p.proname in('settings_dto','specs_role_dto','specs_slot_dto','review_series_dto','cast_pool_dto','cast_library_dto','jobs_dto'))
  and has_function_privilege('public',p.oid,'EXECUTE')) then raise exception 'M21_READBACK_PUBLIC_EXECUTE'; end if;
 perform set_config('request.headers','{"accept":"application/json"}',true);
 if not eps.previous_client() then raise exception 'M21_READBACK_PREVIOUS'; end if;
 perform set_config('request.headers','{"x-eps-contract":"2026-11-cycle7"}',true);
 if eps.previous_client() then raise exception 'M21_READBACK_CURRENT'; end if;
 perform set_config('request.headers','',true);
 if eps.previous_client() then raise exception 'M21_READBACK_DIRECT'; end if;
 if (select prosrc from pg_proc where oid='eps.cast_mutate(text,uuid,jsonb,text)'::regprocedure)!~'previous_client' then raise exception 'M21_READBACK_MEMBER'; end if;
end$m21_readback$;
