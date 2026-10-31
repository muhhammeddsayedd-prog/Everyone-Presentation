-- Metadata only. Never select Auth rows, selectors, codes, tokens or business data.
begin isolation level repeatable read read only;
set local search_path='';set local statement_timeout='20s';set local timezone='UTC';
select jsonb_build_object(
 'database',current_database(),'operator',current_user,'observed_at',clock_timestamp(),
 'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'history_columns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type,'nullable',is_nullable,'default',column_default)order by ordinal_position)from information_schema.columns where table_schema='supabase_migrations'and table_name='schema_migrations'),
 'relations',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),
   'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text,
   'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'acl',a.attacl::text)order by a.attnum)from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
   'constraints',(select coalesce(jsonb_agg(pg_get_constraintdef(k.oid)order by k.conname),'[]')from pg_constraint k where k.conrelid=c.oid),
   'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'roles',(select array_agg(rolname order by rolname)from pg_roles where oid=any(p.polroles)),'command',p.polcmd,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))order by p.polname),'[]')from pg_policy p where p.polrelid=c.oid)
  )order by n.nspname,c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where(c.relnamespace,c.relname)in(('auth'::regnamespace,'sessions'),('auth'::regnamespace,'oauth_authorizations'),('auth'::regnamespace,'oauth_clients'),('eps'::regnamespace,'mcp_oauth_resources'))),
 'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'inherit',rolinherit,'superuser',rolsuper,'bypass_rls',rolbypassrls,'create_db',rolcreatedb,'create_role',rolcreaterole,'replication',rolreplication)order by rolname)from pg_roles where rolname in('postgres','authenticated','anon','service_role')or rolname like'eps%owner'),
 'required_functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig)order by p.oid::regprocedure::text)from pg_proc p where p.oid in(to_regprocedure('auth.uid()'),to_regprocedure('auth.jwt()'),to_regprocedure('eps.mcp_claim_uuid(text)')))
)as oauth_consent_catalogue;
rollback;
