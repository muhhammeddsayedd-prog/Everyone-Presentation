-- Parent owns BEGIN/ROLLBACK. Direct authenticated RPC calls, no API adapter
-- validation, no upload reservation, provider, real identity or credentials.
do $$ begin
 if current_database()<>'postgres' or current_user<>'postgres'
  or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
  or current_setting('eps.specs_mime_guard_rehearsal',true) is distinct from 'rollback-only-v1'
  or exists(select 1 from auth.users where id='7a9c0000-0000-4000-8000-000000000001')
 then raise exception 'SPECS_MIME_GUARD_SYNTHETIC_ROLLBACK_REQUIRED'; end if;
end $$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until)
 values('7a9c0000-0000-4000-8000-000000000001',false,null,null);
insert into public.app_capability_grants(principal_id,capability)
 values('7a9c0000-0000-4000-8000-000000000001','workspaces.write');
select set_config('request.jwt.claim.sub','7a9c0000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"7a9c0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare base jsonb:='{"workspace_id":"7c9c0000-0000-4000-8000-000000000001","purpose":"specs","filename":"synthetic.pdf","size_bytes":17}';
 mime jsonb; body jsonb; detail_value text; message_value text; denied integer:=0;
begin
 -- Missing field plus four explicit non-string JSON types must fail through the
 -- safe domain boundary, before workspace/readiness checks or a table INSERT.
 for body in select base union all select base||jsonb_build_object('mime_type',value)
  from jsonb_array_elements('[null,17,{},[]]') entries(value) loop
  begin
   perform public.eps_reserve_specs_upload(body,'synthetic-mime-invalid-key');
   raise exception 'MIME_INVALID_REQUEST_NOT_REJECTED';
  exception when raise_exception then
   get stacked diagnostics message_value=message_text,detail_value=pg_exception_detail;
   if message_value<>'INVALID_REQUEST' or (detail_value::jsonb->>'status')::integer<>400
    or position('synthetic.pdf' in coalesce(detail_value,''))>0
   then raise exception 'MIME_SAFE_400_BOUNDARY_REQUIRED'; end if;
   denied:=denied+1;
  end;
 end loop;
 if denied<>5 then raise exception 'MIME_ALL_NON_STRING_CASES_REQUIRED'; end if;
 -- A supported string passes MIME validation and reaches the unchanged scoped
 -- workspace denial. It must not be confused with the new scalar rejection.
 begin
  perform public.eps_reserve_specs_upload(base||'{"mime_type":"application/pdf"}','synthetic-mime-valid-string');
  raise exception 'MIME_UNKNOWN_WORKSPACE_NOT_REJECTED';
 exception when raise_exception then
  get stacked diagnostics message_value=message_text,detail_value=pg_exception_detail;
  if message_value<>'RESOURCE_NOT_FOUND' or (detail_value::jsonb->>'status')::integer<>404
  then raise exception 'MIME_VALID_STRING_SCOPE_BEHAVIOR_CHANGED'; end if;
 end;
end $$;
set local role postgres;
do $$ begin
 if exists(select 1 from eps.specs_upload_sessions where principal_id='7a9c0000-0000-4000-8000-000000000001')
  or exists(select 1 from eps.idempotency_records where principal_id='7a9c0000-0000-4000-8000-000000000001')
  or exists(select 1 from eps.audit_events where principal_id='7a9c0000-0000-4000-8000-000000000001')
  or not exists(select 1 from pg_proc where oid='public.eps_reserve_specs_upload(jsonb,text)'::regprocedure
   and proowner='eps_specs_upload_owner'::regrole and prosecdef and provolatile='v' and proconfig=array['search_path=""'])
  or not has_function_privilege('authenticated','public.eps_reserve_specs_upload(jsonb,text)','EXECUTE')
  or has_function_privilege('anon','public.eps_reserve_specs_upload(jsonb,text)','EXECUTE')
  or has_function_privilege('service_role','public.eps_reserve_specs_upload(jsonb,text)','EXECUTE')
 then raise exception 'MIME_FIX_CHANGED_EFFECTS_OR_SECURITY'; end if;
end $$;
