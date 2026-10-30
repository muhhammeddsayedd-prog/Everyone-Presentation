-- Synthetic issuer events and real DB roles, in the owned disposable DB only.
set local role supabase_auth_admin;
insert into auth.users(id,is_anonymous)values
 ('8c1a0000-0000-4000-8000-000000000001',false),('8c1a0000-0000-4000-8000-000000000002',false),('8c1a0000-0000-4000-8000-000000000003',false);
set local role postgres;
insert into public.app_capability_grants(principal_id,capability,active)values
 ('8c1a0000-0000-4000-8000-000000000001','workspaces.read',true),('8c1a0000-0000-4000-8000-000000000001','cast.read',true),
 ('8c1a0000-0000-4000-8000-000000000001','projects.read',true),('8c1a0000-0000-4000-8000-000000000001','cast.review',false),
 ('8c1a0000-0000-4000-8000-000000000002','settings.manage',true);
insert into eps.mcp_oauth_resources(resource,client_id,enabled)values
 ('http://127.0.0.1:3000/mcp','8c0a0000-0000-4000-8000-000000000001',true),
 ('https://previous.synthetic.invalid/mcp','8c0a0000-0000-4000-8000-000000000001',false),
 ('http://127.0.0.1:3000/mcp','8c0a0000-0000-4000-8000-000000000002',false),
 ('http://127.0.0.1:3000/mcp','8c0a0000-0000-4000-8000-000000000003',true),
 ('https://other.synthetic.invalid/mcp','8c0a0000-0000-4000-8000-000000000003',true);

create temp table hook30_events(event jsonb);
insert into hook30_events values(jsonb_build_object('user_id','8c1a0000-0000-4000-8000-000000000001','authentication_method','oauth_provider/authorization_code',
 'metadata',jsonb_build_object('source','synthetic-only'),'claims',jsonb_build_object(
 'iss','https://central.synthetic.invalid/auth/v1','aud','authenticated','exp',extract(epoch from clock_timestamp())::bigint+3600,'iat',extract(epoch from clock_timestamp())::bigint,
 'sub','8c1a0000-0000-4000-8000-000000000001','role','authenticated','aal','aal1','session_id','8c5e0000-0000-4000-8000-000000000001',
 'email','synthetic-hook-owner@example.invalid','phone','','is_anonymous',false,'client_id','8c0a0000-0000-4000-8000-000000000001','scope','openid email',
 'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',1800000000)),
 'user_metadata',jsonb_build_object('client_id','8c0a0000-0000-4000-8000-000000000002','principal_id','8c1a0000-0000-4000-8000-000000000002','capabilities',jsonb_build_array('settings.manage')),
 'app_metadata',jsonb_build_object('existing_business_value','preserved'),'future_claim',jsonb_build_object('preserve',jsonb_build_array(1,true,null)),
 'eps_delegation',jsonb_build_object('capabilities',jsonb_build_array('settings.manage')))));
grant select on hook30_events to supabase_auth_admin;
select set_config('request.jwt.claims','{}',true),set_config('request.jwt.claim.sub','',true);
set local role supabase_auth_admin;
do $$declare event jsonb;changed jsonb;result jsonb;cases jsonb[];entry jsonb;begin
 select e.event into event from pg_temp.hook30_events e;
 result:=eps.mcp_custom_access_token_hook(event);
 if result->'claims'->>'aud'<>'http://127.0.0.1:3000/mcp'
 or result->'claims'->'eps_delegation'<>jsonb_build_object('v',1,'resource','http://127.0.0.1:3000/mcp','client_id','8c0a0000-0000-4000-8000-000000000001',
 'capabilities',jsonb_build_array('cast.read','projects.read','workspaces.read'))
 or result->'claims'->>'scope'<>'openid email'
 or((result->'claims')-'aud'-'eps_delegation')<>((event->'claims')-'aud'-'eps_delegation')
 or(select count(*)from jsonb_object_keys(result))<>1 then raise exception'HOOK30_INITIAL_TRUSTED_SCOPE_AND_EXACT_CLAIM_PRESERVATION_FAILED';end if;
 -- Refresh and arbitrary method labels cannot erase the trusted client/scope.
 foreach entry in array array[to_jsonb('token_refresh'::text),to_jsonb('password'::text)]loop
  changed:=jsonb_set(event,'{authentication_method}',entry);
  if eps.mcp_custom_access_token_hook(changed)<>result then raise exception'HOOK30_REFRESH_CLIENT_SCOPE_CHANGED';end if;
 end loop;
 raise notice'HOOK30_INITIAL_REFRESH_CURRENT_GRANTS_AND_ONLY_TWO_CLAIMS_CHANGED_PASSED';

 -- Ordinary browser and unrelated OAuth output is byte-equivalent as JSONB,
 -- even with unknown optional claims and caller-looking metadata preserved.
 foreach changed in array array[
  jsonb_set(event,'{claims}',(event->'claims')-'client_id'),
  jsonb_set(event,'{claims,client_id}',to_jsonb('8c0a0000-0000-4000-8000-000000000099'::text)),
  jsonb_set(event,'{claims,client_id}',to_jsonb('unrelated-nonuuid-client'::text)),
  (jsonb_set(event,'{claims}',(event->'claims')-'client_id')||jsonb_build_object('client_id','8c0a0000-0000-4000-8000-000000000001'))]loop
  if eps.mcp_custom_access_token_hook(changed)<>jsonb_build_object('claims',changed->'claims')then raise exception'HOOK30_UNRELATED_BROWSER_OR_TOP_LEVEL_CLIENT_CHANGED';end if;
 end loop;
 raise notice'HOOK30_BROWSER_UNKNOWN_CLIENT_TOP_LEVEL_AND_OPTIONAL_CLAIMS_PRESERVED_PASSED';

 cases:=array[
  jsonb_set(event,'{claims,client_id}',to_jsonb('8c0a0000-0000-4000-8000-000000000002'::text)),
  jsonb_set(event,'{claims,client_id}',to_jsonb('8c0a0000-0000-4000-8000-000000000003'::text)),
  jsonb_set(event,'{claims,role}',to_jsonb('service_role'::text)),jsonb_set(event,'{claims,is_anonymous}','true'),
  jsonb_set(event,'{claims,is_anonymous}',to_jsonb('false'::text)),jsonb_set(event,'{claims,session_id}',to_jsonb('not-a-session'::text)),
  jsonb_set(event,'{claims,session_id}','null'),jsonb_set(event,'{claims,sub}',to_jsonb('8c1a0000-0000-4000-8000-000000000002'::text)),
  jsonb_set(event,'{user_id}',to_jsonb('not-a-principal'::text)),jsonb_set(event,'{claims,scope}',to_jsonb('email profile'::text)),
  jsonb_set(event,'{claims,scope}',to_jsonb('openid-not-exact'::text)),jsonb_set(event,'{claims,scope}',jsonb_build_array('openid')),
  jsonb_set(event,'{claims}',(event->'claims')-'scope'),jsonb_set(event,'{claims}',(event->'claims')-'exp'),jsonb_set(event,'{claims}','[]')];
 foreach changed in array cases loop
  begin perform eps.mcp_custom_access_token_hook(changed);raise exception'HOOK30_INVALID_REGISTERED_EVENT_ACCEPTED';
  exception when raise_exception then if sqlerrm<>'MCP_DELEGATION_UNAVAILABLE'then raise;end if;end;
 end loop;
 raise notice'HOOK30_DISABLED_AMBIGUOUS_IDENTITY_SCOPE_AND_REQUIRED_CLAIM_DENIALS_PASSED';

 changed:=jsonb_set(jsonb_set(event,'{user_id}',to_jsonb('8c1a0000-0000-4000-8000-000000000003'::text)),'{claims,sub}',to_jsonb('8c1a0000-0000-4000-8000-000000000003'::text));
 if eps.mcp_custom_access_token_hook(changed)->'claims'->'eps_delegation'->'capabilities'<>'[]'::jsonb then raise exception'HOOK30_ZERO_GRANTS_FABRICATED';end if;
 raise notice'HOOK30_EMPTY_CURRENT_GRANTS_REMAIN_EMPTY_PASSED';
end$$;

set local role postgres;
update public.app_capability_grants set active=false where principal_id='8c1a0000-0000-4000-8000-000000000001'and capability='cast.read';
set local role supabase_auth_admin;
do $$declare event jsonb;begin select e.event into event from pg_temp.hook30_events e;
 if eps.mcp_custom_access_token_hook(event)->'claims'->'eps_delegation'->'capabilities'<>jsonb_build_array('projects.read','workspaces.read')
 then raise exception'HOOK30_REVOKED_GRANT_STILL_ISSUED';end if;
 raise notice'HOOK30_CURRENT_CAPABILITY_REVOCATION_WITHOUT_USER_JWT_PASSED';end$$;

set local role postgres;
do $$begin
 if not has_function_privilege('supabase_auth_admin','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')
 or has_function_privilege('authenticated','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')
 or has_function_privilege('anon','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')
 or has_function_privilege('service_role','eps.mcp_custom_access_token_hook(jsonb)','EXECUTE')
 or exists(select 1 from pg_roles where rolname='eps_mcp_issuer_owner'and(rolcanlogin or rolsuper or rolbypassrls or rolinherit or rolcreaterole or rolcreatedb or rolreplication))
 or has_table_privilege('eps_mcp_issuer_owner','auth.users','SELECT')or has_table_privilege('eps_mcp_issuer_owner','auth.sessions','SELECT')
 or has_table_privilege('eps_mcp_issuer_owner','public.app_capability_grants','UPDATE')
 or has_schema_privilege('eps_mcp_issuer_owner','eps','CREATE')
 or has_column_privilege('eps_mcp_issuer_owner','public.app_capability_grants','created_at','SELECT')
 or not has_column_privilege('eps_mcp_issuer_owner','public.app_capability_grants','principal_id','SELECT')
 then raise exception'HOOK30_PRIVILEGE_BOUNDARY_FAILED';end if;
 if(select proowner::regrole::text from pg_proc where oid='eps.mcp_custom_access_token_hook(jsonb)'::regprocedure)<>'eps_mcp_issuer_owner'
 or not(select prosecdef and proconfig=array['search_path=""']from pg_proc where oid='eps.mcp_custom_access_token_hook(jsonb)'::regprocedure)
 then raise exception'HOOK30_FIXED_OWNER_OR_SEARCH_PATH_FAILED';end if;
 raise notice'HOOK30_NATIVE_AUTH_ONLY_EXECUTE_AND_NARROW_NONLOGIN_OWNER_PASSED';end$$;
set local role authenticated;
do $$begin begin perform eps.mcp_custom_access_token_hook('{}');raise exception'HOOK30_AUTHENTICATED_EXECUTED';exception when insufficient_privilege then null;end;end$$;
set local role anon;
do $$begin begin perform eps.mcp_custom_access_token_hook('{}');raise exception'HOOK30_ANON_EXECUTED';exception when insufficient_privilege then null;end;end$$;
set local role service_role;
do $$begin begin perform eps.mcp_custom_access_token_hook('{}');raise exception'HOOK30_SERVICE_ROLE_EXECUTED';exception when insufficient_privilege then null;end;end$$;
set local role postgres;
do $$begin raise notice'HOOK30_REAL_PUBLIC_CALLER_EXECUTION_DENIALS_PASSED';end$$;
