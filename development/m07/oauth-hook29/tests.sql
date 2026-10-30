-- Additional current29 native-role checks. All synthetic rows/events roll back.
set local role supabase_auth_admin;
do $$declare event jsonb;result jsonb;changed jsonb;begin
 select e.event into event from pg_temp.hook30_events e;
 changed:=jsonb_set(event,'{claims,scope}',to_jsonb(E'openid\tprofile\nemail'::text));
 result:=eps.mcp_custom_access_token_hook(changed);
 if result#>>'{claims,scope}'<>E'openid\tprofile\nemail' or result#>>'{claims,aud}'<>'http://127.0.0.1:3000/mcp'
 or result#>'{claims,eps_delegation,capabilities}'<>jsonb_build_array('projects.read','workspaces.read')
 then raise exception'HOOK29_CURRENT_SCOPE_AND_ACTIVE_GRANTS_FAILED';end if;
 changed:=jsonb_set(event,'{claims,aud}',to_jsonb('https://untrusted-requested-audience.invalid'::text));
 if eps.mcp_custom_access_token_hook(changed)#>>'{claims,aud}'<>'http://127.0.0.1:3000/mcp'then raise exception'HOOK29_RESOURCE_NOT_OPERATOR_BOUND';end if;
 foreach changed in array array[jsonb_set(event,'{claims,scope}',to_jsonb('OPENID'::text)),jsonb_set(event,'{claims,scope}',to_jsonb(repeat('a',257))),jsonb_set(event,'{claims}',(event->'claims')-'session_id')]loop
  begin perform eps.mcp_custom_access_token_hook(changed);raise exception'HOOK29_INVALID_SCOPE_SESSION_ACCEPTED';exception when raise_exception then if sqlerrm<>'MCP_DELEGATION_UNAVAILABLE'then raise;end if;end;
 end loop;
 raise notice'HOOK29_CURRENT29_RESOURCE_SCOPE_SESSION_AND_ACTIVE_GRANTS_PASSED';
end$$;
set local role postgres;
do $$begin
 if(select count(*)from supabase_migrations.schema_migrations)<>29
 or not exists(select 1 from eps.app_settings where singleton and row_version=1 and default_timezone='Africa/Cairo'and default_review_expiry_days=30)
 or exists(select 1 from pg_class where oid in('eps.mcp_oauth_resources'::regclass,'public.app_capability_grants'::regclass)and(not relrowsecurity or not relforcerowsecurity))
 then raise exception'HOOK29_CURRENT_BASELINE_OR_FORCED_RLS_CHANGED';end if;
 raise notice'HOOK29_HISTORY29_SETTINGS_AND_FORCED_RLS_PRESERVED_PASSED';
end$$;
