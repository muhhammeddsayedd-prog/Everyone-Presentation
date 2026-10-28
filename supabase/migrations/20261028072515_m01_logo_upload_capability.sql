-- Advertise implemented logo operations to ordinary scoped users.
-- This is capability metadata, not proof of live Storage acceptance or a feature
-- flag. The app intersects it with configured decoder+signer readiness; every
-- target reservation, Storage request and completion retains its existing checks.
do $prerequisites$ begin
  if to_regprocedure('public.eps_get_capabilities()') is null
    or to_regprocedure('public.eps_reserve_logo_upload(jsonb,text)') is null
    or to_regprocedure('public.eps_prepare_logo_completion(uuid,jsonb,text)') is null
    or to_regprocedure('public.eps_finalize_logo_completion(uuid,jsonb,text,text,text)') is null then
    raise exception 'EXISTING_PRIVATE_LOGO_BOUNDARY_REQUIRED';
  end if;
end $prerequisites$;

-- CREATE OR REPLACE retains the existing owner and execute grants.
create or replace function public.eps_get_capabilities() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare upload_purposes jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or coalesce(auth.jwt()->'is_anonymous','false'::jsonb)<>'false'::jsonb then
    perform eps.fail('AUTH_REQUIRED','An internal signed-in user is required.',401);
  end if;
  if eps.has_capability('workspaces.read') and eps.has_capability('workspaces.write')
    and exists(select 1 from public.projects project
      where project.archived_at is null and eps.project_scope(project.id,true)) then
    upload_purposes:=jsonb_build_array('client_logo');
  end if;
  return jsonb_build_object(
    'principal_id',auth.uid(),
    'capabilities',coalesce((select jsonb_agg(grant_row.capability order by grant_row.capability)
      from public.app_capability_grants grant_row where grant_row.principal_id=auth.uid() and grant_row.active),'[]'::jsonb),
    'timezone','Africa/Cairo','enabled_modules',jsonb_build_array('casting'),
    'upload_policy',jsonb_build_object('allowed_mime_types',jsonb_build_array('image/png','image/jpeg','image/webp'),
      'maximum_file_bytes',5242880,'recommended_batch_size',200,'available_purposes',upload_purposes));
end $$;

do $security$ begin
  if not exists(select 1 from pg_proc where oid='public.eps_get_capabilities()'::regprocedure
    and pg_get_userbyid(proowner)='eps_api_owner' and prosecdef and 'search_path=""'=any(proconfig))
    or has_function_privilege('anon','public.eps_get_capabilities()','EXECUTE')
    or has_function_privilege('service_role','public.eps_get_capabilities()','EXECUTE')
    or not has_function_privilege('authenticated','public.eps_get_capabilities()','EXECUTE') then
    raise exception 'CAPABILITY_RPC_SECURITY_BOUNDARY_CHANGED';
  end if;
end $security$;
notify pgrst,'reload schema';
