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
-- Metadata only: no source text, names, account rows or key material are returned.
-- Sources: https://www.postgresql.org/docs/17/functions-info.html
-- https://www.postgresql.org/docs/17/catalog-pg-trigger.html
-- All dynamic text below is fixed, conditional count-only SQL for the before7 state.
set local timezone='UTC';
do $manual$
declare snapshot jsonb; data_counts jsonb; begin
  if (select count(*) from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace
      where ns.nspname='eps' and relation.relname in('specs','roles','slots') and relation.relkind='r')=3 then
    execute $counts$select jsonb_build_object(
      'specs',(select count(*) from eps.specs),'roles',(select count(*) from eps.roles),'slots',(select count(*) from eps.slots),
      'workspace_coverage',(select count(*) from eps.workspaces workspace join eps.specs spec on spec.workspace_id=workspace.id),
      'archived_workspace_coverage',(select count(*) from eps.workspaces workspace join eps.specs spec on spec.workspace_id=workspace.id where workspace.archived_at is not null),
      'pristine_specs',(select count(*) from eps.specs where source_asset_id is null and source_text is null and normalized_instructions is null
        and clarifications='[]'::jsonb and source_extraction is null and source_language_codes='{}'::text[]
        and source_row_version=1 and processing_job_id is null and row_version=1))$counts$ into data_counts;
  end if;
  select jsonb_build_object(
    'functions',(select coalesce(jsonb_agg(jsonb_build_object(
      'name',ns.nspname||'.'||routine.proname,
      'signature',ns.nspname||'.'||routine.proname||'('||oidvectortypes(routine.proargtypes)||')',
      'identity_arguments',pg_get_function_identity_arguments(routine.oid),'returns',pg_get_function_result(routine.oid),
      'source',routine.prosrc,'owner',pg_get_userbyid(routine.proowner),'language',language.lanname,
      'definer',routine.prosecdef,'volatility',routine.provolatile,'config',routine.proconfig,
      'public_execute',exists(select 1 from aclexplode(coalesce(routine.proacl,acldefault('f',routine.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE'),
      'execute',(select jsonb_object_agg(role.rolname,has_function_privilege(role.oid,routine.oid,'EXECUTE')) from pg_roles role where role.rolname in
        ('anon','authenticated','service_role','eps_api_owner','eps_logo_verify_owner','eps_jobs_owner','eps_jobs_dispatcher','eps_specs_owner','eps_specs_initializer'))
      ) order by ns.nspname,routine.proname,routine.oid),'[]'::jsonb)
      from pg_proc routine join pg_namespace ns on ns.oid=routine.pronamespace join pg_language language on language.oid=routine.prolang
      where ns.nspname='eps' and routine.proname like 'specs\_%' escape '\'
        or ns.nspname='public' and routine.proname in('eps_get_specs','eps_update_specs','eps_list_roles','eps_create_role','eps_update_role','eps_list_slots','eps_resize_role_slots','eps_archive_role','eps_update_slot')),
    'relations',(select coalesce(jsonb_agg(jsonb_build_object('name','eps.'||relation.relname,'kind',relation.relkind,'owner',pg_get_userbyid(relation.relowner),
      'rls',relation.relrowsecurity,'forced_rls',relation.relforcerowsecurity) order by relation.relname),'[]'::jsonb)
      from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace where ns.nspname='eps' and relation.relname in('specs','roles','slots')),
    'table_acls',(select coalesce(jsonb_agg(jsonb_build_object('table','eps.'||relation.relname,'role',role.rolname,
      'select',has_table_privilege(role.oid,relation.oid,'SELECT'),'insert',has_table_privilege(role.oid,relation.oid,'INSERT'),
      'update',has_table_privilege(role.oid,relation.oid,'UPDATE'),'delete',has_table_privilege(role.oid,relation.oid,'DELETE'),
      'truncate',has_table_privilege(role.oid,relation.oid,'TRUNCATE'),'references',has_table_privilege(role.oid,relation.oid,'REFERENCES'),
      'trigger',has_table_privilege(role.oid,relation.oid,'TRIGGER')) order by relation.relname,role.rolname),'[]'::jsonb)
      from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace cross join pg_roles role
      where ns.nspname='eps' and relation.relname in('specs','roles','slots') and relation.relkind='r'
        and role.rolname in('anon','authenticated','service_role','eps_api_owner','eps_logo_verify_owner','eps_jobs_owner','eps_jobs_dispatcher','eps_specs_owner','eps_specs_initializer')),
    'column_acls',(select coalesce(jsonb_agg(jsonb_build_object('table','eps.'||relation.relname,'column',attribute.attname,'role',role.rolname,
      'select',has_column_privilege(role.oid,relation.oid,attribute.attnum,'SELECT'),'insert',has_column_privilege(role.oid,relation.oid,attribute.attnum,'INSERT'),
      'update',has_column_privilege(role.oid,relation.oid,attribute.attnum,'UPDATE'),'references',has_column_privilege(role.oid,relation.oid,attribute.attnum,'REFERENCES'))
      order by relation.relname,attribute.attname,role.rolname),'[]'::jsonb)
      from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace join pg_attribute attribute on attribute.attrelid=relation.oid cross join pg_roles role
      where ns.nspname='eps' and relation.relname in('specs','roles','slots') and relation.relkind='r' and attribute.attnum>0 and not attribute.attisdropped
        and role.rolname in('anon','authenticated','service_role','eps_api_owner','eps_logo_verify_owner','eps_jobs_owner','eps_jobs_dispatcher','eps_specs_owner','eps_specs_initializer')),
    'roles',(select coalesce(jsonb_agg(jsonb_build_object('name',role.rolname,'login',role.rolcanlogin,'inherit',role.rolinherit,
      'superuser',role.rolsuper,'bypass_rls',role.rolbypassrls,'create_db',role.rolcreatedb,'create_role',role.rolcreaterole,
      'eps_create',has_schema_privilege(role.oid,'eps','CREATE'),'public_create',has_schema_privilege(role.oid,'public','CREATE'),
      'auth_usage',has_schema_privilege(role.oid,'auth','USAGE'),'eps_usage',has_schema_privilege(role.oid,'eps','USAGE'),
      'authenticated_member',pg_has_role('authenticated',role.oid,'MEMBER'),'api_owner_member',pg_has_role('eps_api_owner',role.oid,'MEMBER'),
      'sensitive_authority',exists(select 1 from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace where
        (ns.nspname='auth' and relation.relname='users' or ns.nspname='eps' and relation.relname in('logo_verification_keys','jobs','job_events','outbox_events')
        or role.rolname='eps_specs_initializer' and ns.nspname='storage' and relation.relname in('buckets','objects'))
        and (has_any_column_privilege(role.oid,relation.oid,'SELECT,INSERT,UPDATE,REFERENCES') or has_table_privilege(role.oid,relation.oid,'DELETE,TRUNCATE,TRIGGER'))),
      'enqueue',has_function_privilege(role.oid,'eps.m02_enqueue_specs_job(uuid,jsonb,text)','EXECUTE'),
      'claim',has_function_privilege(role.oid,'eps.claim_job_outbox(integer)','EXECUTE'),
      'finish',has_function_privilege(role.oid,'eps.finish_job_outbox(uuid,text,boolean)','EXECUTE'),
      'parents',(select coalesce(jsonb_agg(jsonb_build_object('name',parent.rolname,'admin',member.admin_option,'inherit',member.inherit_option,'set',member.set_option) order by parent.rolname),'[]'::jsonb)
        from pg_auth_members member join pg_roles parent on parent.oid=member.roleid where member.member=role.oid)
      ) order by role.rolname),'[]'::jsonb) from pg_roles role where role.rolname in('eps_specs_owner','eps_specs_initializer')),
    'support_acls',(select coalesce(jsonb_agg(jsonb_build_object('table',ns.nspname||'.'||relation.relname,'role',role.rolname,
      'select',has_table_privilege(role.oid,relation.oid,'SELECT'),'insert',has_table_privilege(role.oid,relation.oid,'INSERT'),
      'update',has_table_privilege(role.oid,relation.oid,'UPDATE'),'delete',has_table_privilege(role.oid,relation.oid,'DELETE'),
      'truncate',has_table_privilege(role.oid,relation.oid,'TRUNCATE'),'references',has_table_privilege(role.oid,relation.oid,'REFERENCES'),
      'trigger',has_table_privilege(role.oid,relation.oid,'TRIGGER')) order by ns.nspname,relation.relname,role.rolname),'[]'::jsonb)
      from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace cross join pg_roles role where relation.relkind='r'
        and role.rolname in('eps_specs_owner','eps_specs_initializer')
        and (ns.nspname='public' and relation.relname in('clients','projects','project_memberships','client_memberships','app_capability_grants')
          or ns.nspname='eps' and relation.relname in('workspaces','idempotency_records','audit_events','media_assets','upload_sessions','logo_verification_keys','jobs','job_events','outbox_events')
          or ns.nspname='auth' and relation.relname='users' or ns.nspname='storage' and relation.relname in('buckets','objects'))),
    'workspace_column_acls',(select coalesce(jsonb_agg(jsonb_build_object('column',attribute.attname,'role',role.rolname,
      'select',has_column_privilege(role.oid,relation.oid,attribute.attnum,'SELECT'),'insert',has_column_privilege(role.oid,relation.oid,attribute.attnum,'INSERT'),
      'update',has_column_privilege(role.oid,relation.oid,attribute.attnum,'UPDATE'),'references',has_column_privilege(role.oid,relation.oid,attribute.attnum,'REFERENCES'))
      order by attribute.attname,role.rolname),'[]'::jsonb)
      from pg_class relation join pg_namespace ns on ns.oid=relation.relnamespace join pg_attribute attribute on attribute.attrelid=relation.oid cross join pg_roles role
      where ns.nspname='eps' and relation.relname='workspaces' and attribute.attnum>0 and not attribute.attisdropped
        and role.rolname in('eps_specs_owner','eps_specs_initializer')),
    'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',policy.polname,'table',ns.nspname||'.'||relation.relname,
      'command',policy.polcmd,'permissive',policy.polpermissive,
      'roles',(select jsonb_agg(role.rolname order by role.rolname) from pg_roles role where role.oid=any(policy.polroles)),
      'using',pg_get_expr(policy.polqual,policy.polrelid),'check',pg_get_expr(policy.polwithcheck,policy.polrelid)) order by policy.polname),'[]'::jsonb)
      from pg_policy policy join pg_class relation on relation.oid=policy.polrelid join pg_namespace ns on ns.oid=relation.relnamespace
      where policy.polname like 'specs\_%' escape '\' or policy.polname like 'eps_specs\_%' escape '\'
        or ns.nspname='eps' and relation.relname in('specs','roles','slots')),
    'triggers',(select coalesce(jsonb_agg(jsonb_build_object('name',trigger.tgname,'table',ns.nspname||'.'||relation.relname,'enabled',trigger.tgenabled,
      'type',trigger.tgtype,'function',procns.nspname||'.'||routine.proname,'arguments',encode(trigger.tgargs,'hex'),
      'when',pg_get_expr(trigger.tgqual,trigger.tgrelid)) order by trigger.tgname),'[]'::jsonb)
      from pg_trigger trigger join pg_class relation on relation.oid=trigger.tgrelid join pg_namespace ns on ns.oid=relation.relnamespace
      join pg_proc routine on routine.oid=trigger.tgfoid join pg_namespace procns on procns.oid=routine.pronamespace
      where not trigger.tgisinternal and (trigger.tgname like 'specs\_%' escape '\' or procns.nspname='eps' and routine.proname like 'specs\_%' escape '\')),
    'counts',data_counts,'archived_workspaces',(select count(*) from eps.workspaces where archived_at is not null),
    'workspace_state_sha256',(select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(id,project_id,logo_asset_id,logo_placement,row_version,draft_revision,has_unpublished_changes,archived_at) order by id)::text,'[]'),'UTF8')),'hex') from eps.workspaces)
  ) into snapshot;
  perform set_config('eps.manual_specs_release.metadata',snapshot::text,true);
end $manual$;
-- Role-only order release metadata; all business/source rows remain private.
-- Exact existing8 projection is validated separately by the frozen manual helper.
do $role_order$
declare snapshot jsonb; begin
 select jsonb_build_object(
  'functions',(select coalesce(jsonb_agg(jsonb_build_object(
   'name',ns.nspname||'.'||routine.proname,'signature',ns.nspname||'.'||routine.proname||'('||oidvectortypes(routine.proargtypes)||')',
   'identity_arguments',pg_get_function_identity_arguments(routine.oid),'returns',pg_get_function_result(routine.oid),
   'source',routine.prosrc,'owner',pg_get_userbyid(routine.proowner),'language',language.lanname,
   'definer',routine.prosecdef,'volatility',routine.provolatile,'config',routine.proconfig,
   'public_execute',exists(select 1 from aclexplode(coalesce(routine.proacl,acldefault('f',routine.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE'),
   'execute',(select jsonb_object_agg(role.rolname,has_function_privilege(role.oid,routine.oid,'EXECUTE')) from pg_roles role where role.rolname in
    ('anon','authenticated','service_role','eps_api_owner','eps_logo_verify_owner','eps_jobs_owner','eps_jobs_dispatcher','eps_specs_owner','eps_specs_initializer'))
   ) order by ns.nspname,routine.proname,routine.oid),'[]'::jsonb)
   from pg_proc routine join pg_namespace ns on ns.oid=routine.pronamespace join pg_language language on language.oid=routine.prolang
   where ns.nspname='eps' and routine.proname='specs_order_workspace_dto' or ns.nspname='public' and routine.proname='eps_reorder_workspace'),
  'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',policy.polname,'table',ns.nspname||'.'||relation.relname,
   'command',policy.polcmd,'permissive',policy.polpermissive,
   'roles',(select jsonb_agg(role.rolname order by role.rolname) from pg_roles role where role.oid=any(policy.polroles)),
   'using',pg_get_expr(policy.polqual,policy.polrelid),'check',pg_get_expr(policy.polwithcheck,policy.polrelid)) order by policy.polname),'[]'::jsonb)
   from pg_policy policy join pg_class relation on relation.oid=policy.polrelid join pg_namespace ns on ns.oid=relation.relnamespace
   where policy.polname in('specs_order_replay_read','specs_order_replay_insert','specs_order_audit')),
  'sort_order_acl',(select jsonb_agg(jsonb_build_object('role',role.rolname,
   'select',has_column_privilege(role.oid,'eps.roles','sort_order','SELECT'),
   'insert',has_column_privilege(role.oid,'eps.roles','sort_order','INSERT'),
   'update',has_column_privilege(role.oid,'eps.roles','sort_order','UPDATE'),
   'references',has_column_privilege(role.oid,'eps.roles','sort_order','REFERENCES')) order by role.rolname)
   from pg_roles role where role.rolname in('anon','authenticated','service_role','eps_api_owner','eps_logo_verify_owner','eps_jobs_owner','eps_jobs_dispatcher','eps_specs_owner','eps_specs_initializer')),
  'data_sha256',jsonb_build_object(
   'specs',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(row) order by id),'[]'::jsonb)::text,'UTF8')),'hex') from eps.specs row),
   'roles',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(row) order by id),'[]'::jsonb)::text,'UTF8')),'hex') from eps.roles row),
   'slots',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(row) order by id),'[]'::jsonb)::text,'UTF8')),'hex') from eps.slots row),
   'preferences',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(row) order by principal_id,workspace_id),'[]'::jsonb)::text,'UTF8')),'hex') from eps.user_workspace_preferences row))
 ) into snapshot;
 perform set_config('eps.role_order_release.metadata',snapshot::text,true);
end $role_order$;
select jsonb_build_object('base',current_setting('eps.processing_release.metadata')::jsonb,
 'manual',current_setting('eps.manual_specs_release.metadata')::jsonb,
 'role_order',current_setting('eps.role_order_release.metadata')::jsonb) as role_order_release;
rollback;
