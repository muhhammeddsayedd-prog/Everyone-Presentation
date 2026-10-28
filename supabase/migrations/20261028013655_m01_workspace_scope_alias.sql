-- Forward fix for an actual local PL/pgSQL name-resolution failure.
-- Preserve the already-applied foundation and inheritance migration bytes.
-- CREATE OR REPLACE retains the current eps_api_owner ownership and grants.
-- https://www.postgresql.org/docs/17/sql-createfunction.html
set local lock_timeout = '5s';
create or replace function public.eps_update_workspace(p_workspace_id uuid,p_input jsonb,p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare w eps.workspaces; logo uuid; result jsonb; payload jsonb; output text; placement text;
begin
  perform eps.require_capability('workspaces.write');
  perform eps.check_input(p_input,array['row_version','logo_asset_id','logo_placement','active_output']);
  -- scope_w must differ from local record variable w; alias/record ambiguity
  -- otherwise prevents the actual mutation from compiling on first execution.
  if not exists(select 1 from eps.workspaces scope_w where scope_w.id=p_workspace_id and eps.project_scope(scope_w.project_id,true)) then
    perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404);
  end if;
  payload:=jsonb_build_object('id',p_workspace_id,'input',p_input);
  result:=eps.idempotency_begin('update_workspace',p_idempotency_key,payload);
  if result is not null then return result; end if;
  select * into w from eps.workspaces where id=p_workspace_id and eps.project_scope(project_id,true) for update;
  if not found then perform eps.fail('RESOURCE_NOT_FOUND','Writable workspace not found.',404); end if;
  if eps.expected_version(p_input)<>w.row_version then perform eps.fail('STALE_RESOURCE_VERSION','Reload the workspace before saving.',409,w.row_version); end if;
  if p_input?'logo_asset_id' then
    if p_input->'logo_asset_id'='null'::jsonb then logo:=null; else logo:=eps.input_uuid(eps.input_text(p_input,'logo_asset_id',200)); end if;
    perform eps.require_ready_logo(logo);
  else logo:=w.logo_asset_id; end if;
  placement:=case when p_input?'logo_placement' then eps.input_text(p_input,'logo_placement',30) else w.logo_placement end;
  if placement not in ('cover','every_slide') then perform eps.fail('INVALID_REQUEST','Unsupported logo placement.',400); end if;
  if p_input?'active_output' then
    output:=eps.input_text(p_input,'active_output',20);
    if output not in ('selection','shortlist') then perform eps.fail('INVALID_REQUEST','Unsupported output.',400); end if;
    insert into eps.user_workspace_preferences(principal_id,workspace_id,active_output) values(auth.uid(),w.id,output)
      on conflict(principal_id,workspace_id) do update set active_output=excluded.active_output;
  end if;
  if p_input?'logo_asset_id' or p_input?'logo_placement' then
    update eps.workspaces set logo_asset_id=logo,logo_placement=placement,row_version=row_version+1,draft_revision=draft_revision+1,has_unpublished_changes=true,updated_at=now() where id=w.id;
  end if;
  result:=eps.workspace_dto(w.id);
  return eps.finish_mutation('update_workspace',p_idempotency_key,payload,result,w.id);
end $$;
do $verify$ begin
  if not exists(select 1 from pg_proc p join pg_roles r on r.oid=p.proowner
    where p.oid='public.eps_update_workspace(uuid,jsonb,text)'::regprocedure
      and r.rolname='eps_api_owner' and p.prosecdef and p.proconfig @> array['search_path=""'])
    or not has_function_privilege('authenticated','public.eps_update_workspace(uuid,jsonb,text)','EXECUTE')
    or has_function_privilege('anon','public.eps_update_workspace(uuid,jsonb,text)','EXECUTE')
  then raise exception 'WORKSPACE_RPC_SECURITY_PROPERTIES_CHANGED'; end if;
end $verify$;
