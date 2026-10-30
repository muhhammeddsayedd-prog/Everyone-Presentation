set local role postgres;
select set_config('eps.m07.defaults_ready_before',coalesce((select jsonb_agg(to_jsonb(v)order by id)from eps.presentation_versions v where status='ready'),'[]'::jsonb)::text,true);
select set_config('request.jwt.claim.sub','8a1a0000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"8a1a0000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"aud":"authenticated"}',true);
set local role authenticated;
do $$declare current_settings jsonb;capabilities jsonb;begin
 current_settings:=public.eps_get_settings();
 perform public.eps_update_settings(jsonb_build_object('row_version',current_settings->'row_version','default_timezone','UTC'),'m07-synthetic-default-consumed');
 capabilities:=public.eps_get_capabilities();
 if capabilities->>'timezone'is distinct from'UTC'then raise exception'M07_SETTINGS_DEFAULT_NOT_CONSUMED';end if;
end$$;
set local role eps_api_owner;
do $$begin
 if(select default_timezone from eps.app_settings where singleton)is distinct from'UTC'then raise exception'M07_CAPABILITIES_NARROW_TIMEZONE_READ_FAILED';end if;
 begin perform template_version from eps.app_settings;raise exception'M07_CAPABILITIES_FULL_SETTINGS_READ_GRANTED';exception when insufficient_privilege then null;end;
 begin perform row_version from eps.app_settings;raise exception'M07_CAPABILITIES_SETTINGS_VERSION_READ_GRANTED';exception when insufficient_privilege then null;end;
end$$;
set local role postgres;
do $$begin
 if coalesce((select jsonb_agg(to_jsonb(v)order by id)from eps.presentation_versions v where status='ready'),'[]'::jsonb)is distinct from current_setting('eps.m07.defaults_ready_before')::jsonb
 or jsonb_array_length(current_setting('eps.m07.defaults_ready_before')::jsonb)=0 then raise exception'M07_DEFAULT_CHANGED_READY_VERSION';end if;
end$$;
select'M07_CAPABILITIES_SAVED_TIMEZONE_NARROW_READ_AND_READY_PRESERVATION_PASSED';
set local role supabase_auth_admin;
insert into auth.sessions(id,user_id,oauth_client_id,not_after,scopes)values('8b5e0000-0000-4000-8000-000000000001','8a1a0000-0000-4000-8000-000000000001','8bca0000-0000-4000-8000-000000000001',clock_timestamp()+interval'1hour','openid');
set local role postgres;
select set_config('request.jwt.claims',jsonb_set(current_setting('eps.m07.oauth_claims')::jsonb,'{eps_delegation,capabilities}','["workspaces.read"]')::text,true);
set local role authenticated;
do $$declare response jsonb;begin
 response:=public.eps_get_capabilities();
 if response->'capabilities'<>'["workspaces.read"]'::jsonb or response->>'timezone'<>'UTC'then raise exception'M07_CAPABILITIES_DELEGATED_PROJECTION_MISMATCH';end if;
end$$;
set local role postgres;
select'M07_CAPABILITIES_DIRECT_API_REDUCED_DELEGATION_PASSED';
