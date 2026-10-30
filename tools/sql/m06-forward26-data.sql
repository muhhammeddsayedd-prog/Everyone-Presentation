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
