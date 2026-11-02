-- Only the fresh disposable network-none target after exact39 and40.
do $owned$begin
 if current_database()<>'project39'or(pg_control_system()).system_identifier::text='7701520506262638626'
 or current_setting('eps.locksource41.run',true)is null
 or(select count(*)from supabase_migrations.schema_migrations)<>40
 or exists(select 1 from auth.users where id='a4410000-0000-4000-8000-000000000002')
 then raise exception'LOCKSOURCE41_OWNED40_REQUIRED';end if;
end$owned$;
create schema locksource41_proof;
create table locksource41_proof.context(label text primary key,project uuid not null,workspace uuid not null,series uuid);
create table locksource41_proof.config_before as select * from eps.presentation_processing_config;
create function locksource41_proof.uid(label text)returns uuid language sql stable set search_path=''as
 $$select md5(current_setting('eps.locksource41.run')||':'||label)::uuid$$;
insert into auth.users(id,is_anonymous)values('a4410000-0000-4000-8000-000000000002',false);
insert into public.app_capability_grants(principal_id,capability)
 select actor,cap from unnest(array['a4410000-0000-4000-8000-000000000001'::uuid,'a4410000-0000-4000-8000-000000000002'::uuid])actor
 cross join unnest(array['workspaces.read','workspaces.write','cast.read','cast.write','cast.review','cast.upload','presentations.generate','review_links.manage'])cap;
insert into public.app_capability_grants(principal_id,capability)select'a4410000-0000-4000-8000-000000000002'::uuid,cap from unnest(array['projects.read','projects.write'])cap;
insert into auth.oauth_clients(id,client_name,redirect_uris,client_type,token_endpoint_auth_method,grant_types,response_types,registration_type)
 values('a4410000-0000-4000-8000-000000000003','Synthetic local lock-source proof','http://localhost:3199/callback','public','none',array['authorization_code','refresh_token'],array['code'],'manual');
insert into eps.mcp_oauth_resources(resource,client_id,enabled)values('https://everyone-presentation-pilot.vercel.app/mcp','a4410000-0000-4000-8000-000000000003',true);
insert into auth.sessions(id,user_id,oauth_client_id,not_after,scopes)values('a4410000-0000-4000-8000-000000000004','a4410000-0000-4000-8000-000000000001','a4410000-0000-4000-8000-000000000003',clock_timestamp()+interval'2hours','openid');
-- A declared post40 fixture row, never a claim of an actual business operation.
-- Future41 preservation must retain existing nonnull reason bytes, too.
insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type,reason)
 values('a4410000-0000-4000-8000-000000000001','review.synthetic_locksource41_fixture',locksource41_proof.uid('prior-reason'),'synthetic-locksource41-baseline','mcp','Synthetic existing reason must remain exact.');
-- Explicit owned-only fixture qualification; restore this whole singleton later.
update eps.presentation_processing_config set enabled=true,
 renderer_version=coalesce(renderer_version,'synthetic-locksource-v1'),
 application_origin=coalesce(application_origin,'https://synthetic-locksource.invalid');

-- Full fresh post40 preservation includes reason, private auth/session metadata
-- and all application rows. Only hashes/counts leave this disposable target.
create function locksource41_proof.row_hashes()returns jsonb language plpgsql stable security invoker set search_path=''as $hashes$
declare r record;v_rows bigint;v_hash text;v_result jsonb:='{}';begin
 if current_user<>'postgres'then raise exception'LOCKSOURCE41_PRIVATE_OBSERVER_REQUIRED';end if;
 for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'and n.nspname in('eps','public','auth','storage','supabase_migrations')order by n.nspname,c.relname loop
  execute format('select count(*),encode(sha256(convert_to(coalesce(string_agg(h,''''order by h),''''),''UTF8'')),''hex'')from(select encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')h from %I.%I t)s',r.nspname,r.relname)into v_rows,v_hash;
  v_result:=v_result||jsonb_build_object(r.nspname||'.'||r.relname,jsonb_build_object('count',v_rows,'sha256',v_hash));
 end loop;
 return jsonb_build_object('tables',v_result,'reason_nonnull_rows',(select count(*)from eps.audit_events where reason is not null),'ready_versions',(select count(*)from eps.presentation_versions where status='ready'),'pins',(select count(*)from eps.presentation_version_assets),'application_catalogue_sha256',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(p)-case when p.oid='eps.presentation_lock_sources(uuid,text,text)'::regprocedure then array['prosrc']else array[]::text[]end order by p.oid),'[]')::text,'UTF8')),'hex')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')));
end$hashes$;
