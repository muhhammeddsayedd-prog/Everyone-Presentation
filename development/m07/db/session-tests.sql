set local role postgres;
do $$begin if to_regprocedure('public.eps_validate_own_oauth_session(text)')is null then raise exception'M07_OWN_OAUTH_SESSION_CAPABILITY_MISSING';end if;end$$;
insert into eps.mcp_oauth_resources(resource,client_id,enabled)values('http://127.0.0.1:3000/mcp','8bca0000-0000-4000-8000-000000000001',true);
set local role supabase_auth_admin;
insert into auth.sessions(id,user_id,oauth_client_id,not_after,scopes,user_agent,refresh_token_hmac_key)values
 ('8b5e0000-0000-4000-8000-000000000001','8a1a0000-0000-4000-8000-000000000001','8bca0000-0000-4000-8000-000000000001',clock_timestamp()+interval'1hour','openid profile','synthetic-private-agent','synthetic-private-unused'),
 ('8b5e0000-0000-4000-8000-000000000002','8a1a0000-0000-4000-8000-000000000002','8bca0000-0000-4000-8000-000000000001',null,'openid',null,null),
 ('8b5e0000-0000-4000-8000-000000000003','8a1a0000-0000-4000-8000-000000000001','8bca0000-0000-4000-8000-000000000002',null,'openid',null,null);
set local role postgres;
select set_config('request.jwt.claim.sub','8a1a0000-0000-4000-8000-000000000001',true);
select set_config('eps.m07.oauth_claims',jsonb_build_object('sub','8a1a0000-0000-4000-8000-000000000001','role','authenticated','is_anonymous',false,
 'session_id','8b5e0000-0000-4000-8000-000000000001','client_id','8bca0000-0000-4000-8000-000000000001',
 'aud','http://127.0.0.1:3000/mcp','scope','openid','iat',floor(extract(epoch from clock_timestamp()))-10,'exp',floor(extract(epoch from clock_timestamp()))+3600,
 'eps_delegation',jsonb_build_object('v',1,'resource','http://127.0.0.1:3000/mcp','client_id','8bca0000-0000-4000-8000-000000000001','capabilities',jsonb_build_array('workspaces.read','settings.manage')))::text,true);
select set_config('request.jwt.claims',current_setting('eps.m07.oauth_claims'),true);
set local role authenticated;
do $$declare state jsonb;begin
 state:=public.eps_validate_own_oauth_session('http://127.0.0.1:3000/mcp');
 if state->'active'<>'true'or state->>'principal_id'<>'8a1a0000-0000-4000-8000-000000000001'
 or state->>'session_id'<>'8b5e0000-0000-4000-8000-000000000001'or state->>'client_id'<>'8bca0000-0000-4000-8000-000000000001'
 or state->'capabilities'<>'["settings.manage","workspaces.read"]'or(select count(*)from jsonb_object_keys(state))<>5 then raise exception'M07_SESSION_VALID_OWN_PROJECTION_FAILED';end if;
 perform public.eps_get_settings();
 begin perform 1 from auth.sessions;raise exception'M07_SESSION_AUTHENTICATED_TABLE_READ_ALLOWED';exception when insufficient_privilege then null;end;
end$$;
set local role eps_mcp_session_owner;
do $$begin
 if(select count(id)from auth.sessions)<>1 then raise exception'M07_SESSION_RLS_NOT_EXACT_OWN_SIGNED_ROW';end if;
 begin perform refresh_token_hmac_key from auth.sessions;raise exception'M07_SESSION_SECRET_COLUMN_GRANTED';exception when insufficient_privilege then null;end;
 begin perform user_agent from auth.sessions;raise exception'M07_SESSION_AGENT_COLUMN_GRANTED';exception when insufficient_privilege then null;end;
end$$;
select'M07_SESSION_OWN_SIGNED_IDENTITY_NARROW_RLS_AND_COLUMN_GRANTS_PASSED';
set local role authenticated;
do $$declare claims jsonb;modified jsonb;begin
 claims:=current_setting('eps.m07.oauth_claims')::jsonb;
 foreach modified in array array[
  claims||'{"session_id":"8b5e0000-0000-4000-8000-000000000002"}',
  claims||'{"session_id":"8b5e0000-0000-4000-8000-000000000003"}',
  claims||'{"session_id":"malformed"}',claims||'{"is_anonymous":true}',
  claims||'{"aud":"authenticated"}',claims||'{"scope":"profile"}',claims||'{"exp":1}',
  jsonb_set(claims,'{eps_delegation,resource}','"https://foreign.example.invalid/mcp"'),
  jsonb_set(claims,'{eps_delegation,client_id}','"8bca0000-0000-4000-8000-000000000002"'),
  jsonb_set(claims,'{eps_delegation,capabilities}','["service_role"]'),
  (claims-'eps_delegation')||jsonb_build_object('user_metadata',jsonb_build_object('eps_delegation',claims->'eps_delegation'))
 ]loop
  perform set_config('request.jwt.claims',modified::text,true);
  if public.eps_validate_own_oauth_session('http://127.0.0.1:3000/mcp')->'active'<>'false'then raise exception'M07_SESSION_INVALID_CLAIMS_ACCEPTED';end if;
  begin perform public.eps_get_settings();raise exception'M07_DIRECT_RPC_INVALID_DELEGATION_ALLOWED';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
 end loop;
 perform set_config('request.jwt.claims',jsonb_set(claims,'{eps_delegation,capabilities}','["workspaces.read"]')::text,true);
 begin perform public.eps_get_settings();raise exception'M07_DIRECT_RPC_REDUCED_DELEGATION_BYPASS';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
 perform set_config('request.jwt.claims',claims::text,true);
 if public.eps_validate_own_oauth_session('https://foreign.example.invalid/mcp')->'active'<>'false'then raise exception'M07_SESSION_FOREIGN_RESOURCE_ALLOWED';end if;
end$$;
select'M07_SESSION_INVALID_CLAIMS_AND_DIRECT_RPC_DELEGATION_BOUNDARY_PASSED';
set local role postgres;
update public.app_capability_grants set active=false where principal_id='8a1a0000-0000-4000-8000-000000000001'and capability='settings.manage';
set local role authenticated;
do $$begin
 if public.eps_validate_own_oauth_session('http://127.0.0.1:3000/mcp')->'capabilities'<>'["workspaces.read"]'then raise exception'M07_SESSION_CAPABILITIES_NOT_CURRENT';end if;
 begin perform public.eps_get_settings();raise exception'M07_DIRECT_RPC_REVOKED_CAPABILITY_ALLOWED';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
end$$;
set local role postgres;
update public.app_capability_grants set active=true where principal_id='8a1a0000-0000-4000-8000-000000000001'and capability='settings.manage';
update eps.mcp_oauth_resources set enabled=false;
set local role authenticated;
do $$begin
 if public.eps_validate_own_oauth_session('http://127.0.0.1:3000/mcp')->'active'<>'false'then raise exception'M07_SESSION_DISABLED_RESOURCE_ALLOWED';end if;
 begin perform public.eps_get_settings();raise exception'M07_DIRECT_RPC_DISABLED_CLIENT_ALLOWED';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
end$$;
set local role postgres;
update eps.mcp_oauth_resources set enabled=true;
set local role supabase_auth_admin;
update auth.sessions set not_after=clock_timestamp()-interval'1second'where id='8b5e0000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin
 if public.eps_validate_own_oauth_session('http://127.0.0.1:3000/mcp')->'active'<>'false'then raise exception'M07_SESSION_EXPIRED_SESSION_ALLOWED';end if;
 begin perform public.eps_get_settings();raise exception'M07_DIRECT_RPC_EXPIRED_SESSION_ALLOWED';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
end$$;
set local role supabase_auth_admin;
delete from auth.sessions where id='8b5e0000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin
 if public.eps_validate_own_oauth_session('http://127.0.0.1:3000/mcp')->'active'<>'false'then raise exception'M07_SESSION_REVOKED_SESSION_ALLOWED';end if;
 begin perform public.eps_get_settings();raise exception'M07_DIRECT_RPC_REVOKED_SESSION_ALLOWED';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
end$$;
select'M07_SESSION_CURRENT_GRANTS_RESOURCE_DISABLE_EXPIRY_AND_REVOCATION_PASSED';
do $$declare claims jsonb;state jsonb;begin
 claims:=current_setting('eps.m07.oauth_claims')::jsonb;
 perform set_config('request.jwt.claims','{"sub":"8a1a0000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"aud":"authenticated"}',true);
 perform public.eps_get_settings();
 state:=public.eps_validate_own_oauth_session('http://127.0.0.1:3000/mcp');
 if state->'active'<>'false'or state->'session_id'<>'null'or state->'client_id'<>'null'or state->'capabilities'<>'[]'then raise exception'M07_SESSION_NORMAL_BROWSER_FABRICATED_IDENTITY';end if;
 perform set_config('request.jwt.claims','{"sub":"8a1a0000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"aud":"authenticated","client_id":"8bca0000-0000-4000-8000-000000000099"}',true);
 perform public.eps_get_settings();
end$$;
set local role anon;
do $$begin begin perform public.eps_validate_own_oauth_session('http://127.0.0.1:3000/mcp');raise exception'M07_SESSION_ANON_RPC_ALLOWED';exception when insufficient_privilege then null;end;end$$;
set local role postgres;
select'M07_SESSION_BROWSER_UNRELATED_OAUTH_PRESERVED_NO_ANON_OR_INVENTED_IDENTITY_PASSED';
