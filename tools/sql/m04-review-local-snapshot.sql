begin isolation level repeatable read read only;
set local search_path='';set local timezone='UTC';
do $snapshot$
declare item record;rows bigint;digest text;business jsonb:='{}';catalog text;roles text;begin
 if current_user<>'postgres'or current_database()<>'postgres'or inet_client_addr()is not null
 or(select system_identifier::text from pg_control_system())<>'7701520506262638626'then raise exception'EXACT_OWNED_LOCAL_REQUIRED';end if;
 for item in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in('public','eps')and c.relkind='r'order by n.nspname,c.relname loop
  execute format($query$select count(*),encode(sha256(convert_to(coalesce(string_agg(row_hash,''order by row_hash),''),'UTF8')),'hex')from(select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')row_hash from %I.%I t)r$query$,item.nspname,item.relname)into rows,digest;
  business:=business||jsonb_build_object(item.nspname||'.'||item.relname,jsonb_build_object('rows',rows,'sha256',digest));
 end loop;
 select encode(sha256(convert_to(jsonb_build_object(
  'functions',(select jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,p.proowner::regrole::text,p.prosecdef,p.provolatile,p.proconfig,p.proacl::text,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))order by p.oid::regprocedure::text)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','eps')),
  'tables',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relowner::regrole::text,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text)order by n.nspname,c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','eps')and c.relkind='r'),
  'policies',(select jsonb_agg(to_jsonb(p)order by schemaname,tablename,policyname)from pg_policies p where schemaname in('public','eps','storage')),
  'constraints',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid))order by n.nspname,c.relname,k.conname)from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','eps')),
  'managed_auth',(select jsonb_build_array(relowner::regrole::text,relrowsecurity,relforcerowsecurity,relacl::text)from pg_class where oid='auth.users'::regclass)
 )::text,'UTF8')),'hex')into catalog;
 select encode(sha256(convert_to(jsonb_build_object('roles',(select jsonb_agg(jsonb_build_array(rolname,rolcanlogin,rolsuper,rolinherit,rolbypassrls,rolcreaterole,rolcreatedb)order by rolname)from pg_roles where rolname like'eps_%'),'memberships',(select jsonb_agg(jsonb_build_array(roleid::regrole::text,member::regrole::text,grantor::regrole::text,admin_option,inherit_option,set_option)order by roleid::regrole::text,member::regrole::text,grantor::regrole::text)from pg_auth_members where roleid::regrole::text like'eps_%'or member::regrole::text like'eps_%'))::text,'UTF8')),'hex')into roles;
 perform set_config('eps.local.review_snapshot',jsonb_build_object('business',business,'catalog_sha256',catalog,'roles_sha256',roles,'versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations))::text,true);
end$snapshot$;
select current_setting('eps.local.review_snapshot')::jsonb;
rollback;
