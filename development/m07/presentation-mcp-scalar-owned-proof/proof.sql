-- SYNTHETIC owned PG17 only; GUC claims are not signed OAuth or hosted evidence.
begin;
set local search_path='';set local statement_timeout='8s';set local lock_timeout='2s';
do $guard$begin
 if current_setting('eps.local_fixture_tests',true)is distinct from'eps-presentation-canonical-pg17-local'
 or current_database()<>'project39'or current_user<>'supabase_admin'or session_user<>'supabase_admin'
 or not(select rolsuper from pg_roles where rolname=current_user)
 or(select system_identifier::text from pg_control_system())<>'__OWNED_SYSTEM__'
 or(select system_identifier::text from pg_control_system())='__ORIGINAL_SYSTEM__'
 or(select count(*)from supabase_migrations.schema_migrations)<>40
 then raise exception'SCALAR_EXACT_OWNED40_REQUIRED';end if;
end$guard$;
-- Required minimal INSERT columns and actual owned FK/PK are verified first.
do $authshape$begin
 if exists(select 1 from(values('auth.users','id','uuid',true),('auth.users','is_anonymous','boolean',true),('auth.sessions','id','uuid',true),('auth.sessions','user_id','uuid',true),('auth.sessions','oauth_client_id','uuid',false),('auth.sessions','not_after','timestamp with time zone',false),('auth.sessions','scopes','text',false))v(rel,name,kind,nonnull)where not exists(select 1 from pg_attribute a where a.attrelid=v.rel::regclass and a.attname=v.name and format_type(a.atttypid,a.atttypmod)=v.kind and a.attnotnull=v.nonnull and not a.attisdropped))
 or exists(select 1 from pg_attribute a where a.attrelid in('auth.users'::regclass,'auth.sessions'::regclass)and a.attnum>0 and not a.attisdropped and a.attnotnull and not a.atthasdef and a.attname not in('id','user_id'))
 or not exists(select 1 from pg_constraint where conrelid='auth.sessions'::regclass and confrelid='auth.users'::regclass and contype='f'and convalidated and not condeferrable and not condeferred and conkey=array[(select attnum from pg_attribute where attrelid='auth.sessions'::regclass and attname='user_id')]::smallint[] and confkey=array[(select attnum from pg_attribute where attrelid='auth.users'::regclass and attname='id')]::smallint[])
 then raise exception'SCALAR_OWNED_AUTH_SHAPE_REQUIRED';end if;
end$authshape$;
select set_config('eps.scalar.proof_run','__RUN__',true);
create function pg_temp.scalar_uid(label text)returns uuid language sql stable as $$select md5(current_setting('eps.scalar.proof_run')||':'||label)::uuid$$;
create function pg_temp.scalar_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception'SCALAR_PARITY_ASSERTION: %',label;end if;end$$;
create function pg_temp.scalar_base()returns jsonb language sql stable as $$select current_setting('eps.scalar.base_claims')::jsonb$$;
create function pg_temp.scalar_case(variant text,label text,claims jsonb,capability text,wanted text,mode text default'normal')returns jsonb language plpgsql security invoker as $$
declare actual boolean;state text;code text;dto jsonb;dto_hash text;
begin
 perform pg_temp.scalar_assert(current_user in('authenticated','anon'),'actual caller role');
 perform set_config('request.jwt.claim.sub',case when mode='invalid-principal'then'not-a-uuid'else coalesce(claims->>'sub','')end,true);
 perform set_config('request.jwt.claims',case when mode='invalid-claims'then'{'else claims::text end,true);
 begin
  if wanted='dto'then
   dto:=public.eps_validate_own_oauth_session('http://127.0.0.1:3000/mcp');
   perform pg_temp.scalar_assert((select array_agg(k order by k)from jsonb_object_keys(dto)k)=array['active','capabilities','client_id','principal_id','session_id'],'public DTO keys');
   perform pg_temp.scalar_assert(dto->'active'='true'::jsonb and dto->'capabilities'='["settings.manage","workspaces.read"]'::jsonb,'public DTO current capabilities');
   perform pg_temp.scalar_assert(dto->>'principal_id'=pg_temp.scalar_uid('actor')::text and dto->>'session_id'=pg_temp.scalar_uid('session')::text and dto->>'client_id'=pg_temp.scalar_uid('client')::text,'public DTO identity');
   dto_hash:=encode(sha256(convert_to(dto::text,'UTF8')),'hex');state:='dto';
  else
   actual:=eps.mcp_token_permits_capability(capability);
   state:=case when actual is null then'null'when actual then'true'else'false'end;
  end if;
 exception when others then get stacked diagnostics code=returned_sqlstate;state:='native'||code;end;
 perform pg_temp.scalar_assert(state=wanted,label);
 return jsonb_build_object('variant',variant,'case',label,'outcome',state,'native_code',code,'dto_sha256',dto_hash);
end$$;
-- Exact full metadata except this ONE declared temporary prosrc delta.
create temporary table scalar_target_before as select to_jsonb(p)as metadata,pg_get_functiondef(p.oid)as definition from pg_proc p where p.oid='eps.mcp_token_permits_capability(text)'::regprocedure;
create temporary table scalar_catalogue_before as select coalesce(jsonb_agg(to_jsonb(p)-case when p.oid='eps.mcp_token_permits_capability(text)'::regprocedure then array['prosrc']else array[]::text[]end order by p.oid),'[]'::jsonb)as value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public');
create function pg_temp.scalar_check_catalogue()returns void language plpgsql as $$begin
 perform pg_temp.scalar_assert((select coalesce(jsonb_agg(to_jsonb(p)-case when p.oid='eps.mcp_token_permits_capability(text)'::regprocedure then array['prosrc']else array[]::text[]end order by p.oid),'[]'::jsonb)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public'))=(select value from scalar_catalogue_before),'full function catalogue only one prosrc delta');
 perform pg_temp.scalar_assert((select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='__VALIDATOR_SHA__'from pg_proc where oid='public.eps_validate_own_oauth_session(text)'::regprocedure),'public validator unchanged');
end$$;
select pg_temp.scalar_assert((select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='__BEFORE_SHA__'from pg_proc where oid='eps.mcp_token_permits_capability(text)'::regprocedure),'old scalar source');
select pg_temp.scalar_assert((select prosecdef and provolatile='s'and proowner='eps_mcp_session_owner'::regrole and proconfig=array['search_path=""']from pg_proc where oid='eps.mcp_token_permits_capability(text)'::regprocedure),'original scalar attributes');
select pg_temp.scalar_assert((select a.attcollation=c.oid and c.collisdeterministic from pg_attribute a cross join pg_collation c join pg_namespace n on n.oid=c.collnamespace where a.attrelid='public.app_capability_grants'::regclass and a.attname='capability'and not a.attisdropped and n.nspname='pg_catalog'and c.collname='default'),'actual grant column and default collation deterministic');
select pg_temp.scalar_assert(not exists(select 1 from auth.users where id in(pg_temp.scalar_uid('actor'),pg_temp.scalar_uid('other'))),'fresh owned actors');
insert into auth.users(id,is_anonymous)values(pg_temp.scalar_uid('actor'),false),(pg_temp.scalar_uid('other'),false);
insert into public.app_capability_grants(principal_id,capability)select pg_temp.scalar_uid('actor'),capability from unnest(array['workspaces.read','settings.manage'])capability;
insert into eps.mcp_oauth_resources(resource,client_id,enabled)values('http://127.0.0.1:3000/mcp',pg_temp.scalar_uid('client'),true);
insert into auth.sessions(id,user_id,oauth_client_id,not_after,scopes)values
 (pg_temp.scalar_uid('session'),pg_temp.scalar_uid('actor'),pg_temp.scalar_uid('client'),null,'openid profile'),
 (pg_temp.scalar_uid('other-session'),pg_temp.scalar_uid('other'),pg_temp.scalar_uid('client'),null,'openid');
do $claims$begin perform set_config('eps.scalar.base_claims',jsonb_build_object('sub',pg_temp.scalar_uid('actor'),'role','authenticated','is_anonymous',false,'session_id',pg_temp.scalar_uid('session'),'client_id',pg_temp.scalar_uid('client'),'aud','http://127.0.0.1:3000/mcp','scope','openid','iat',floor(extract(epoch from clock_timestamp()))-10,'exp',floor(extract(epoch from clock_timestamp()))+300,'eps_delegation',jsonb_build_object('v',1,'resource','http://127.0.0.1:3000/mcp','client_id',pg_temp.scalar_uid('client'),'capabilities',jsonb_build_array('workspaces.read','settings.manage','cast.read')))::text,true);end$claims$;
set local role authenticated;
__OLD_CASES__
-- OLD/new comparisons use the same synthetic inputs, roles and authority mutations.
__AFTER_DEFINITION__
select pg_temp.scalar_assert((select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='__AFTER_SHA__'from pg_proc where oid='eps.mcp_token_permits_capability(text)'::regprocedure),'candidate scalar source');
select pg_temp.scalar_check_catalogue();
set local role authenticated;
__NEW_CASES__
__BEFORE_DEFINITION__
select pg_temp.scalar_check_catalogue();
select pg_temp.scalar_assert((select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='__RESTORED_SHA__'and to_jsonb(p)=(select metadata from scalar_target_before)from pg_proc p where oid='eps.mcp_token_permits_capability(text)'::regprocedure),'actual full scalar metadata/source restored');
select jsonb_build_object('result','passed_local_scalar_parity','signed_OAuth_or_hosted_acceptance',false,'rollback_required',true,'target_function_restored_before_rollback',true,'deterministic_collation_verified',true,'one_target_prosrc_only',true,'public_validator_unchanged',true);
rollback;
