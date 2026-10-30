-- Separate one-shot operational transition. No key/capability/schema write.
begin;
set local search_path='';set local timezone='UTC';set local lock_timeout='3s';set local statement_timeout='15s';
-- Keep the idle observation stable until the single flag update commits.
lock table eps.jobs in share mode;
lock table eps.outbox_events in share mode;
do $enable_guest26$
declare configuration record;changed integer;begin
 if current_user<>'postgres'or current_database()<>'postgres'
 or not exists(select 1 from pg_roles where rolname=current_user and(rolsuper or rolbypassrls))
 or(select count(*)from supabase_migrations.schema_migrations)<>26
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261030004643'
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20261030004643'and name='m06_credential_admission_guest_retry')
 then raise exception'M06_GUEST26_EXACT_RELEASE_REQUIRED';end if;
 select id,enabled,octet_length(backend_key)as key_bytes,replay_ttl_seconds,session_ttl_seconds into configuration from eps.review_gateway_config where id for update;
 if not found or configuration.enabled or configuration.key_bytes is distinct from 32 or configuration.replay_ttl_seconds<>86400 or configuration.session_ttl_seconds<>3600
 or(select count(*)from eps.review_gateway_config)<>1 then raise exception'M06_GUEST26_EXPECTED_DISABLED_KEYED_CONFIGURATION_REQUIRED';end if;
 if exists(select 1 from pg_trigger where tgrelid='eps.review_gateway_config'::regclass and not tgisinternal)
 or exists(select 1 from pg_rewrite where ev_class='eps.review_gateway_config'::regclass)then raise exception'M06_GUEST26_UNEXPECTED_CONFIGURATION_HOOK';end if;
 if not exists(select 1 from eps.presentation_processing_config where id and enabled)then raise exception'M06_GUEST26_PRESENTATION_PROCESSING_REQUIRED';end if;
 if not exists(select 1 from eps.jobs j join eps.specs s on s.id=j.resource_id and s.workspace_id=j.workspace_id where j.id='b3f90268-147d-41d4-8875-2a6435df1496'and j.status='waiting_for_input'and j.error->>'code'='INPUT_CHANGED'
 and position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0)then raise exception'M06_GUEST26_PROTECTED_M02_REQUIRED';end if;
 if exists(select 1 from eps.jobs where status in('queued','running'))or exists(select 1 from eps.outbox_events where status='leased')then raise exception'M06_GUEST26_GLOBAL_IDLE_REQUIRED';end if;
 update eps.review_gateway_config set enabled=true where id and not enabled;
 get diagnostics changed=row_count;if changed<>1 then raise exception'M06_GUEST26_SINGLE_FLAG_REQUIRED';end if;
end$enable_guest26$;
select jsonb_build_object('schema_version','1.0','release_version','20261030004643',
 'gateway',(select jsonb_build_object('enabled',enabled,'key_present',backend_key is not null,'key_bytes',octet_length(backend_key),'replay_ttl_seconds',replay_ttl_seconds,'session_ttl_seconds',session_ttl_seconds)from eps.review_gateway_config where id),
 'enabled_projection_sha256',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(safe)::text,E'\n'order by to_jsonb(safe)::text),''),'UTF8')),'hex')from(select id,enabled,replay_ttl_seconds,session_ttl_seconds from eps.review_gateway_config)safe),
 'presentation_processing_enabled',(select enabled from eps.presentation_processing_config where id),'queued_or_running_jobs',(select count(*)from eps.jobs where status in('queued','running')),
 'protected_m02_status',(select status from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'))as m06_guest26_enabled;
commit;
