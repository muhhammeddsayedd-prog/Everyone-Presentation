-- M06 compact read-only preflight/readback; excluded fields are exact proven additions/changes.
-- No rawkey, credential digest, ciphertext, managed Auth payload or secret-derived hash.
begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';
-- Forward26 read-only projection includes established M06 rows and excludes key columns before SELECT. Never hashes or emits
-- managed Auth bodies, verification keys, bearer digests or replay ciphertext.
do $m06_data$
declare item record;amount bigint;fingerprint text;column_names text;counts jsonb:='{}';hashes jsonb:='{}';new_tables text[]:=array[]::text[];
begin
 for item in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
 and(n.nspname='eps'and not c.relname=any(new_tables)or n.nspname='public'and c.relname in('clients','projects','project_memberships','client_memberships','app_capability_grants')or n.nspname='storage'and c.relname in('buckets','objects'))order by n.nspname,c.relname loop
  execute format('select count(*)from %I.%I',item.nspname,item.relname)into amount;
  counts:=counts||jsonb_build_object(item.nspname||'.'||item.relname,amount);
  -- Credential columns are absent from the SELECT before serialization.
  select string_agg(format('%I',a.attname),','order by a.attnum)into column_names from pg_attribute a where a.attrelid=format('%I.%I',item.nspname,item.relname)::regclass and a.attnum>0 and not a.attisdropped
   and not a.attname=any(array['secret','backend_key','token_digest','session_token_digest','lease_token_digest','response_encrypted','response_ciphertext','encrypted_response','password','key_material']);
  execute format($q$select encode(sha256(convert_to(coalesce(string_agg(safe::text,E'\n'order by safe::text),''),'UTF8')),'hex')from(select to_jsonb(r)as safe from(select %s from %I.%I)r)s$q$,column_names,item.nspname,item.relname)into fingerprint;
  hashes:=hashes||jsonb_build_object(item.nspname||'.'||item.relname,fingerprint);
 end loop;
 perform set_config('eps.m06_readback.old_data',jsonb_build_object('counts',counts,'hashes',hashes,'managed_auth',jsonb_build_object('user_count',(select count(*)from auth.users),'users_metadata',(select jsonb_build_object('owner',relowner::regrole::text,'rls',relrowsecurity,'force_rls',relforcerowsecurity,'acl',relacl::text)from pg_class where oid='auth.users'::regclass)),'versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations))::text,true);
end$m06_data$;

-- Dynamic relation discovery permits an exact reviewed24 preflight. Key bytes
-- are never projected, hashed, serialized or placed in a derived checksum.
do $m06_state$
declare name text;metadata jsonb;tables jsonb:='{}';config jsonb;begin
 foreach name in array array['review_gateway_config','review_gateway_nonces','review_gateway_rates','review_links','review_link_replays','guest_sessions','feedback_comments','feedback_preferences','presentation_exports','review_media_grants','guest_asset_grants','guest_idempotency']loop
  if to_regclass('eps.'||name)is null then metadata:=null;else execute format('select jsonb_build_object(''count'',count(*))from eps.%I',name)into metadata;end if;
  tables:=tables||jsonb_build_object(name,metadata);
 end loop;
 if to_regclass('eps.review_gateway_config')is not null then
  execute 'select jsonb_build_object(''enabled'',enabled,''key_present'',backend_key is not null,''key_bytes'',case when backend_key is null then null else octet_length(backend_key)end,''replay_ttl_seconds'',replay_ttl_seconds,''session_ttl_seconds'',session_ttl_seconds)from eps.review_gateway_config where id'into config;
 end if;
 perform set_config('eps.m06_readback.new_state',jsonb_build_object('tables',tables,'config',config)::text,true);
end$m06_state$;

do $m06_catalog$declare mapped jsonb;protected jsonb;selected jsonb;excluded jsonb:='["policies|eps.media_assets.m06_internal_export_asset_read|cmd","policies|eps.media_assets.m06_internal_export_asset_read|permissive","policies|eps.media_assets.m06_internal_export_asset_read|qual","policies|eps.media_assets.m06_internal_export_asset_read|roles","policies|eps.media_assets.m06_internal_export_asset_read|with_check","policies|storage.objects.eps_candidate_read_guard|qual","policies|storage.objects.eps_logo_read_guard|qual","policies|storage.objects.m06_guest_storage_select|qual","policies|storage.objects.presentation_output_read_guard|qual"]'::jsonb;begin
-- Metadata only. No source bodies, Auth identities, credentials or business rows.
-- Caller fixes search_path and owns the transaction. Object keys exclude OIDs.
with nested as(select jsonb_build_object(
 'functions',(select coalesce(jsonb_object_agg(signature,metadata),'{}')from(
  select p.oid::regprocedure::text signature,jsonb_build_object('owner',p.proowner::regrole::text,'language',(select lanname from pg_language where oid=p.prolang),'returns',pg_get_function_result(p.oid),'identity_arguments',pg_get_function_identity_arguments(p.oid),'argument_defaults',pg_get_expr(p.proargdefaults,0),'strict',p.proisstrict,'parallel',p.proparallel,'leakproof',p.proleakproof,'kind',p.prokind,'support',case when p.prosupport=0 then null else p.prosupport::regproc::text end,'definer',p.prosecdef,'volatility',p.provolatile,'config',p.proconfig,'acl',p.proacl::text,'source_sha256',encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex'))metadata
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')or n.nspname='storage'and p.proname in('operation','allow_only_operation','allow_any_operation'))s),
 'tables',(select coalesce(jsonb_object_agg(name,metadata),'{}')from(
  select n.nspname||'.'||c.relname name,jsonb_build_object('owner',c.relowner::regrole::text,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text)metadata
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where(n.nspname in('eps','public')or n.nspname='storage'and c.relname in('objects','buckets'))and c.relkind='r')s),
 'columns',(select coalesce(jsonb_object_agg(n.nspname||'.'||c.relname||'.'||a.attname,jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'acl',a.attacl::text,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid))),'{}')from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where(n.nspname in('eps','public')or n.nspname='storage'and c.relname in('objects','buckets'))and c.relkind='r'and a.attnum>0 and not a.attisdropped),
 'policies',(select coalesce(jsonb_object_agg(schemaname||'.'||tablename||'.'||policyname,to_jsonb(p)-'schemaname'-'tablename'-'policyname'),'{}')from pg_policies p where schemaname in('eps','public','storage')),
 'constraints',(select coalesce(jsonb_object_agg(n.nspname||'.'||c.relname||'.'||k.conname,jsonb_build_object('definition',replace(pg_get_constraintdef(k.oid),E'\r\n',E'\n'))),'{}')from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('eps','public')or n.nspname='storage'and c.relname in('objects','buckets')),
 'indexes',(select coalesce(jsonb_object_agg(n.nspname||'.'||c.relname,jsonb_build_object('definition',replace(pg_get_indexdef(c.oid),E'\r\n',E'\n'),'valid',i.indisvalid,'ready',i.indisready,'live',i.indislive)),'{}')from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace join pg_class t on t.oid=i.indrelid where n.nspname in('eps','public')or n.nspname='storage'and t.relname in('objects','buckets')),
 'triggers',(select coalesce(jsonb_object_agg(n.nspname||'.'||c.relname||'.'||t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)),'{}')from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where(n.nspname in('eps','public')or n.nspname='storage'and c.relname in('objects','buckets'))and not t.tgisinternal),
 'schemas',(select coalesce(jsonb_object_agg(nspname,jsonb_build_object('owner',nspowner::regrole::text,'acl',nspacl::text)),'{}')from pg_namespace where nspname in('eps','public','storage','auth','extensions')),
 'types',(select coalesce(jsonb_object_agg(n.nspname||'.'||t.typname,jsonb_build_object('owner',t.typowner::regrole::text,'kind',t.typtype,'acl',t.typacl::text,'base',case when t.typbasetype=0 then null else format_type(t.typbasetype,t.typtypmod)end,'not_null',t.typnotnull,'default',t.typdefault,'enum_labels',(select jsonb_agg(enumlabel order by enumsortorder)from pg_enum where enumtypid=t.oid))),'{}')from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in('eps','public')and t.typelem=0),
 'default_acl',(select coalesce(jsonb_object_agg(d.defaclrole::regrole::text||'/'||coalesce(n.nspname,'*')||'/'||d.defaclobjtype::text,jsonb_build_object('acl',d.defaclacl::text)),'{}')from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname in('eps','public','storage','auth','extensions')or d.defaclrole::regrole::text like'eps_%'),
 'roles',(select coalesce(jsonb_object_agg(rolname,jsonb_build_object('login',rolcanlogin,'super',rolsuper,'inherit',rolinherit,'bypassrls',rolbypassrls,'create_role',rolcreaterole,'create_db',rolcreatedb,'replication',rolreplication,'connection_limit',rolconnlimit,'valid_until',rolvaliduntil)),'{}')from pg_roles where rolname like'eps_%'),
 'memberships',(select coalesce(jsonb_object_agg(roleid::regrole::text||'>'||member::regrole::text||'/'||grantor::regrole::text,jsonb_build_object('grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option)),'{}')from pg_auth_members where roleid::regrole::text like'eps_%'or member::regrole::text like'eps_%')
)payload),flat as(select category.key||'|'||object.key||'|'||field.key key,field.value from nested cross join lateral jsonb_each(payload)category cross join lateral jsonb_each(category.value)object cross join lateral jsonb_each(object.value)field)
select coalesce(jsonb_object_agg(key,value),'{}')into mapped from flat;

select coalesce(jsonb_object_agg(key,value),'{}')into protected from jsonb_each(mapped)where not excluded?key;select coalesce(jsonb_object_agg(key,value),'{}')into selected from jsonb_each(mapped)where excluded?key;
perform set_config('eps.m06_readback.catalog',jsonb_build_object('catalog_protected_sha256',encode(sha256(convert_to(protected::text,'UTF8')),'hex'),'catalog_full_sha256',encode(sha256(convert_to(mapped::text,'UTF8')),'hex'),'catalog_count',(select count(*)from jsonb_each(mapped)),'catalog_delta_values',selected)::text,true);end$m06_catalog$;
select jsonb_build_object('query_role',current_user,'unrestricted_visibility',current_user='postgres','old_data',current_setting('eps.m06_readback.old_data')::jsonb,'new_state',current_setting('eps.m06_readback.new_state')::jsonb)||current_setting('eps.m06_readback.catalog')::jsonb;rollback;
