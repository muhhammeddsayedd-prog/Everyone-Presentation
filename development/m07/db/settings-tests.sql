-- Real database roles; synthetic fixture data only. Parent owns transaction.
set local role postgres;
do $$begin if to_regprocedure('public.eps_get_settings()')is null then raise exception'M07_SETTINGS_CAPABILITY_MISSING';end if;end$$;
insert into public.app_capability_grants(principal_id,capability)values(current_setting('eps.casting.fixture.actor')::uuid,'settings.manage');
select set_config('eps.m07.preserved',jsonb_build_object(
 'series',(select jsonb_agg(to_jsonb(t)order by id)from eps.presentation_series t),
 'versions',(select jsonb_agg(to_jsonb(t)order by id)from eps.presentation_versions t),
 'assets',(select jsonb_agg(to_jsonb(t)order by id)from eps.media_assets t),
 'workspaces',(select jsonb_agg(to_jsonb(t)order by id)from eps.workspaces t),
 'jobs',(select jsonb_agg(to_jsonb(t)order by id)from eps.jobs t),
 'links',(select jsonb_agg(to_jsonb(t)order by id)from eps.review_links t),
 'templates',(select jsonb_agg(to_jsonb(t)order by key,version)from eps.presentation_templates t))::text,true);
set local role authenticated;
do $$declare row jsonb;begin
 row:=public.eps_get_settings();
 if row->>'template_version'<>'1.1.0'or row->>'default_timezone'<>'Africa/Cairo'or row->'default_review_expiry_days'<>'30'::jsonb
 or row->'row_version'<>'1'::jsonb or jsonb_typeof(row->'models')<>'object'or(select count(*)from jsonb_object_keys(row))<>5
 then raise exception'M07_SETTINGS_DEFAULTS_OR_CLOSED_DTO_FAILED';end if;
 begin perform 1 from eps.app_settings;raise exception'M07_SETTINGS_DIRECT_READ_ALLOWED';exception when insufficient_privilege then null;end;
 begin update eps.app_settings set default_timezone='Europe/London';raise exception'M07_SETTINGS_DIRECT_WRITE_ALLOWED';exception when insufficient_privilege then null;end;
end$$;
select'M07_SETTINGS_CLOSED_DTO_AND_DIRECT_DENIAL_PASSED';
set local request.headers='{"x-eps-request-id":"m07-synthetic-settings-request","x-eps-client-type":"mcp","authorization":"synthetic-discarded","unexpected":"synthetic-discarded"}';
do $$declare a jsonb;b jsonb;input jsonb:='{"row_version":1,"default_timezone":"Europe/London","template_version":"1.1.0"}';begin
 a:=public.eps_update_settings(input,'m07-synthetic-settings-write');b:=public.eps_update_settings(input,'m07-synthetic-settings-write');
 if a<>b or a->'row_version'<>'2'or a->>'default_timezone'<>'Europe/London'then raise exception'M07_SETTINGS_WRITE_REPLAY_FAILED';end if;
 begin perform public.eps_update_settings('{"row_version":1,"default_timezone":"Africa/Cairo"}','m07-synthetic-settings-stale');raise exception'M07_SETTINGS_STALE_ALLOWED';exception when raise_exception then if sqlerrm<>'STALE_RESOURCE_VERSION'then raise;end if;end;
 begin perform public.eps_update_settings('{"row_version":2,"default_timezone":"Africa/Cairo"}','m07-synthetic-settings-write');raise exception'M07_SETTINGS_KEY_REUSE_ALLOWED';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_KEY_REUSED'then raise;end if;end;
end$$;
do $$declare payload jsonb;begin
 foreach payload in array array[
 '{"row_version":2,"default_timezone":"GMT+4"}'::jsonb,'{"row_version":2,"default_timezone":"Never/Invented"}',
 '{"row_version":2,"default_timezone":null}','{"row_version":2,"template_version":"1.0.0"}',
 '{"row_version":2,"template_version":"9.9.9"}','{"row_version":2,"models":{}}',
 '{"row_version":2,"default_review_expiry_days":99}','{"row_version":0,"default_timezone":"UTC"}'
 ]loop
  begin perform public.eps_update_settings(payload,'m07-synthetic-invalid-'||md5(payload::text));raise exception'M07_SETTINGS_INVALID_ACCEPTED';exception when raise_exception then if sqlerrm<>'INVALID_REQUEST'then raise;end if;end;
 end loop;
 begin perform public.eps_update_settings('{"row_version":2,"default_timezone":"UTC"}',null);raise exception'M07_SETTINGS_NO_KEY_ACCEPTED';exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_KEY_REQUIRED'then raise;end if;end;
end$$;
select'M07_SETTINGS_VERSION_IDEMPOTENCY_AND_VALIDATION_PASSED';
set local role postgres;
do $$begin
 if(select count(*)from eps.audit_events where action='settings.update_settings')<>1
 or not exists(select 1 from eps.audit_events where action='settings.update_settings'and principal_id=current_setting('eps.casting.fixture.actor')::uuid and client_type='mcp'and request_id='m07-synthetic-settings-request')
 or(select count(*)from eps.idempotency_records where operation='settings.update_settings')<>1 then raise exception'M07_SETTINGS_AUDIT_ONCE_FAILED';end if;
 update public.app_capability_grants set active=false where principal_id=current_setting('eps.casting.fixture.actor')::uuid and capability='settings.manage';
end$$;
set local role authenticated;
do $$begin
 begin perform public.eps_get_settings();raise exception'M07_SETTINGS_REVOKED_READ_ALLOWED';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
 begin perform public.eps_update_settings('{"row_version":1,"default_timezone":"Europe/London","template_version":"1.1.0"}','m07-synthetic-settings-write');raise exception'M07_SETTINGS_REVOKED_REPLAY_ALLOWED';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;
end$$;
set local role postgres;
update public.app_capability_grants set active=true where principal_id=current_setting('eps.casting.fixture.actor')::uuid and capability='settings.manage';
update eps.presentation_templates set registered=false where key='everyone-casting'and version='1.1.0';
set local role authenticated;
do $$begin
 begin perform public.eps_update_settings('{"row_version":2,"template_version":"1.1.0"}','m07-synthetic-unregistered');raise exception'M07_SETTINGS_UNREGISTERED_ALLOWED';exception when raise_exception then if sqlerrm<>'INVALID_REQUEST'then raise;end if;end;
end$$;
set local role postgres;
update eps.presentation_templates set registered=true where key='everyone-casting'and version='1.1.0';
do $$declare after_data jsonb;begin
 after_data:=jsonb_build_object(
 'series',(select jsonb_agg(to_jsonb(t)order by id)from eps.presentation_series t),
 'versions',(select jsonb_agg(to_jsonb(t)order by id)from eps.presentation_versions t),
 'assets',(select jsonb_agg(to_jsonb(t)order by id)from eps.media_assets t),
 'workspaces',(select jsonb_agg(to_jsonb(t)order by id)from eps.workspaces t),
 'jobs',(select jsonb_agg(to_jsonb(t)order by id)from eps.jobs t),
 'links',(select jsonb_agg(to_jsonb(t)order by id)from eps.review_links t),
 'templates',(select jsonb_agg(to_jsonb(t)order by key,version)from eps.presentation_templates t));
 if after_data<>current_setting('eps.m07.preserved')::jsonb then raise exception'M07_SETTINGS_CHANGED_EXISTING_SERIES_VERSION_OR_BYTES';end if;
 if not exists(select 1 from eps.presentation_versions where status='ready')then raise exception'M07_SETTINGS_READY_FIXTURE_REQUIRED';end if;
end$$;
select'M07_SETTINGS_CURRENT_PERMISSIONS_AUDIT_AND_READY_PRESERVATION_PASSED';
set local request.jwt.claims='{"sub":"8a1a0000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}';
set local request.jwt.claim.sub='8a1a0000-0000-4000-8000-000000000002';
set local role authenticated;
do $$begin begin perform public.eps_get_settings();raise exception'M07_SETTINGS_SECOND_ACTOR_ALLOWED';exception when raise_exception then if sqlerrm<>'CAPABILITY_REQUIRED'then raise;end if;end;end$$;
set local role anon;
do $$begin begin perform public.eps_get_settings();raise exception'M07_SETTINGS_ANON_ALLOWED';exception when insufficient_privilege then null;end;end$$;
set local role postgres;
select'M07_SETTINGS_UNAUTHORIZED_ACTORS_PASSED';
