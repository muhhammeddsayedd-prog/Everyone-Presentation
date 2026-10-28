-- Fixed metadata/counts only. No user rows, keys, tokens or provider configuration.
begin read only;
set local statement_timeout='20s';
set local search_path='';
do $readback$
declare queue_counts jsonb; snapshot jsonb;
begin
  if to_regclass('eps.jobs') is not null and to_regclass('eps.outbox_events') is not null
    and to_regclass('eps.job_events') is not null then
    execute 'select jsonb_build_object(''jobs'',(select count(*) from eps.jobs),''outbox'',(select count(*) from eps.outbox_events),''events'',(select count(*) from eps.job_events))'
      into queue_counts;
  end if;
  select jsonb_build_object(
    'query_role',current_user,'database',current_database(),
    'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
    'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
    'functions',(select coalesce(jsonb_agg(jsonb_build_object(
      'name',namespace.nspname||'.'||routine.proname,
      'signature',namespace.nspname||'.'||routine.proname||'('||oidvectortypes(routine.proargtypes)||')',
      'identity_arguments',pg_get_function_identity_arguments(routine.oid),'returns',pg_get_function_result(routine.oid),
      'source',routine.prosrc,'owner',pg_get_userbyid(routine.proowner),
      'language',language.lanname,'definer',routine.prosecdef,'volatility',routine.provolatile,'config',routine.proconfig,
      'public_execute',exists(select 1 from aclexplode(coalesce(routine.proacl,acldefault('f',routine.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE'),
      'execute',(select jsonb_object_agg(role.rolname,has_function_privilege(role.oid,routine.oid,'EXECUTE')) from pg_roles role
        where role.rolname in('anon','authenticated','service_role','eps_api_owner','eps_logo_verify_owner','eps_jobs_owner','eps_jobs_dispatcher'))
    ) order by namespace.nspname,routine.proname,routine.oid),'[]'::jsonb)
    from pg_proc routine join pg_namespace namespace on namespace.oid=routine.pronamespace join pg_language language on language.oid=routine.prolang
    where namespace.nspname='public' and routine.proname like 'eps\_%' escape '\'
      or namespace.nspname='eps' and routine.proname in('idempotency_begin','jobs_can_access','jobs_dispatch_mode','jobs_dto','jobs_remember','jobs_hash_v1','jobs_add_dispatch','m02_enqueue_specs_job','claim_job_outbox','finish_job_outbox')),
    'relations',(select jsonb_agg(jsonb_build_object('name',namespace.nspname||'.'||relation.relname,
      'owner',pg_get_userbyid(relation.relowner),'rls',relation.relrowsecurity,'forced_rls',relation.relforcerowsecurity) order by namespace.nspname,relation.relname)
      from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace where relation.relkind='r' and
        (namespace.nspname='public' and relation.relname in('clients','projects','project_memberships','client_memberships','app_capability_grants')
        or namespace.nspname='eps' and relation.relname in('workspaces','user_workspace_preferences','media_assets','audience_presets','idempotency_records','audit_events','upload_sessions','logo_verification_keys','jobs','job_events','outbox_events'))),
    'queue_acls',(select coalesce(jsonb_agg(jsonb_build_object('table',namespace.nspname||'.'||relation.relname,'role',role.rolname,
      'select',has_table_privilege(role.oid,relation.oid,'SELECT'),'insert',has_table_privilege(role.oid,relation.oid,'INSERT'),
      'update',has_table_privilege(role.oid,relation.oid,'UPDATE'),'delete',has_table_privilege(role.oid,relation.oid,'DELETE'),
      'truncate',has_table_privilege(role.oid,relation.oid,'TRUNCATE'),'references',has_table_privilege(role.oid,relation.oid,'REFERENCES'),
      'trigger',has_table_privilege(role.oid,relation.oid,'TRIGGER')) order by relation.relname,role.rolname),'[]'::jsonb)
      from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace cross join pg_roles role
      where namespace.nspname='eps' and relation.relname in('jobs','job_events','outbox_events') and relation.relkind='r'
        and role.rolname in('anon','authenticated','service_role','eps_api_owner','eps_logo_verify_owner','eps_jobs_owner','eps_jobs_dispatcher')),
    'jobs_roles',(select coalesce(jsonb_agg(jsonb_build_object('name',role.rolname,'login',role.rolcanlogin,'inherit',role.rolinherit,
      'superuser',role.rolsuper,'bypass_rls',role.rolbypassrls,'create_db',role.rolcreatedb,'create_role',role.rolcreaterole,
      'eps_create',has_schema_privilege(role.oid,'eps','CREATE'),'public_create',has_schema_privilege(role.oid,'public','CREATE'),
      'key_select',has_table_privilege(role.oid,'eps.logo_verification_keys','SELECT'),
      'auth_usage',has_schema_privilege(role.oid,'auth','USAGE'),'uid_execute',has_function_privilege(role.oid,'auth.uid()','EXECUTE'),
      'jwt_execute',has_function_privilege(role.oid,'auth.jwt()','EXECUTE'),
      'authenticated_member',pg_has_role('authenticated',role.oid,'MEMBER'),
      'api_owner_member',pg_has_role('eps_api_owner',role.oid,'MEMBER'),
      'parents',(select coalesce(jsonb_agg(jsonb_build_object('name',parent.rolname,'admin',membership.admin_option,'inherit',membership.inherit_option,'set',membership.set_option) order by parent.rolname),'[]'::jsonb)
        from pg_auth_members membership join pg_roles parent on parent.oid=membership.roleid where membership.member=role.oid)
      ) order by role.rolname),'[]'::jsonb) from pg_roles role where role.rolname in('eps_jobs_owner','eps_jobs_dispatcher')),
    'jobs_policies',(select coalesce(jsonb_agg(jsonb_build_object('name',policy.polname,'table',namespace.nspname||'.'||relation.relname,
      'command',policy.polcmd,'permissive',policy.polpermissive,
      'roles',(select jsonb_agg(role.rolname order by role.rolname) from pg_roles role where role.oid=any(policy.polroles)),
      'using',pg_get_expr(policy.polqual,policy.polrelid),'check',pg_get_expr(policy.polwithcheck,policy.polrelid)) order by policy.polname),'[]'::jsonb)
      from pg_policy policy join pg_class relation on relation.oid=policy.polrelid join pg_namespace namespace on namespace.oid=relation.relnamespace
      where policy.polname in('jobs_workspace_identity','jobs_read','jobs_insert','jobs_update','job_events_read','outbox_read','outbox_insert','outbox_update','jobs_idempotency','jobs_audit','eps_jobs_no_objects','eps_jobs_no_buckets')
        or namespace.nspname='eps' and relation.relname in('jobs','job_events','outbox_events')),
    'counts',jsonb_build_object('auth',(select count(*) from auth.users),'clients',(select count(*) from public.clients),
      'projects',(select count(*) from public.projects),'project_memberships',(select count(*) from public.project_memberships),
      'client_memberships',(select count(*) from public.client_memberships),'capabilities',(select count(*) from public.app_capability_grants),
      'workspaces',(select count(*) from eps.workspaces),'media',(select count(*) from eps.media_assets),'uploads',(select count(*) from eps.upload_sessions),
      'audit',(select count(*) from eps.audit_events),'idempotency',(select count(*) from eps.idempotency_records),
      'audience_presets',(select count(*) from eps.audience_presets),'verification_keys',(select count(*) from eps.logo_verification_keys),
      'buckets',(select count(*) from storage.buckets),'storage_objects',(select count(*) from storage.objects)),
    'queue_counts',queue_counts
  ) into snapshot;
  perform set_config('eps.processing_release.metadata',snapshot::text,true);
end $readback$;
select current_setting('eps.processing_release.metadata')::jsonb as processing_release;
rollback;
