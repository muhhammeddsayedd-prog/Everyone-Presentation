-- SOURCE ONLY, not a runnable cloud migration or an HTTP acceptance proof.
-- Future Root-owned isolated PG17 bootstrap must restore exact38->39->40 first.
-- Storage operation/JWT GUCs simulate server context; no token/HTTP/physical bytes.
begin;
set local search_path='';set local statement_timeout='8s';set local lock_timeout='2s';
do $guard$ begin
 if current_setting('eps.local_fixture_tests',true)is distinct from 'eps-presentation-canonical-pg17-local'
  or current_database()<>'postgres' or current_user<>'postgres'
  or (select count(*)from supabase_migrations.schema_migrations)<>40 then raise exception 'OWNED_CANONICAL40_FIXTURE_REQUIRED';end if;
end $guard$;
select set_config('eps.logo_info_run','__RUN__',true);
create function pg_temp.uid(label text)returns uuid language sql stable as $$select md5(current_setting('eps.logo_info_run')||':'||label)::uuid$$;
create function pg_temp.assert_true(value boolean,label text)returns void language plpgsql as $$begin if value is distinct from true then raise exception 'LOGO_INFO_ASSERTION: %',label;end if;end$$;
create function pg_temp.actor(subject uuid)returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub',coalesce(subject::text,''),true);
 perform set_config('request.jwt.claims',case when subject is null then '{"role":"anon"}'else jsonb_build_object('sub',subject,'role','authenticated','is_anonymous',false)::text end,true);
 perform set_config('request.headers','{}',true);
end$$;
create function pg_temp.logo_key(which text)returns text language sql stable as $$select current_setting('eps.logo_info.'||which)::jsonb->>'object_key'$$;
create function pg_temp.logo_asset(which text)returns uuid language sql stable as $$select(current_setting('eps.logo_info.'||which)::jsonb#>>'{asset,id}')::uuid$$;
create function pg_temp.check_row(label text,operation text,which text,wanted boolean,bucket text default 'eps-brand-assets',missing boolean default false,helper_wanted boolean default null)returns jsonb language plpgsql as $$
declare object_key text:=pg_temp.logo_key(which)||case when missing then '-missing'else''end;helper boolean;visible integer;denied boolean:=false;table_denied boolean:=false;
begin
 perform set_config('storage.operation',operation,true);
 begin helper:=eps.logo_storage_read_allowed(bucket,object_key);exception when insufficient_privilege then denied:=true;helper:=false;end;
 begin select count(*)into visible from storage.objects o where o.bucket_id=bucket and o.name=object_key;exception when insufficient_privilege then table_denied:=true;visible:=0;end;
 perform pg_temp.assert_true(helper=coalesce(helper_wanted,wanted) and visible=case when wanted then 1 else 0 end,label);
 return jsonb_build_object('case',label,'operation',operation,'helper_allowed',helper,'helper_execute_denied',denied,'table_select_denied',table_denied,'selected_count',visible,'passed',true);
end$$;
-- Complete existing function metadata (OID/owner/ACL/config/volatility/etc) is
-- captured before any replacement. Only prosrc is allowed to differ afterward.
create temporary table logo_info_function_before as select to_jsonb(p)-'prosrc'as metadata from pg_proc p where p.oid='eps.logo_storage_read_allowed(text,text)'::regprocedure;
create temporary table logo_info_policies_before as select coalesce(jsonb_agg(to_jsonb(p)order by p.oid),'[]'::jsonb)as metadata from pg_policy p where p.polrelid in('storage.objects'::regclass,'storage.buckets'::regclass,'eps.media_assets'::regclass,'eps.upload_sessions'::regclass,'eps.workspaces'::regclass);
select pg_temp.assert_true((select encode(sha256(convert_to(prosrc,'UTF8')),'hex')='__BASE_BODY_SHA__'from pg_proc where oid='eps.logo_storage_read_allowed(text,text)'::regprocedure),'exact original helper body');
select pg_temp.assert_true((select prosecdef and provolatile='s'and proowner='eps_api_owner'::regrole from pg_proc where oid='eps.logo_storage_read_allowed(text,text)'::regprocedure),'original owner/definer/stability');
select pg_temp.assert_true((select bool_and(relrowsecurity and relforcerowsecurity)from pg_class where oid in('eps.media_assets'::regclass,'eps.upload_sessions'::regclass,'eps.workspaces'::regclass)),'existing forced row security');
select pg_temp.assert_true(not exists(select 1 from auth.users where id in(pg_temp.uid('owner'),pg_temp.uid('writer'),pg_temp.uid('reader'),pg_temp.uid('unrelated'))),'fresh fixture actors');
insert into auth.users(id)select pg_temp.uid(label)from unnest(array['owner','writer','reader','unrelated'])label;
insert into public.projects(id,name)values(pg_temp.uid('project'),'Synthetic logo info project'),(pg_temp.uid('unrelated-project'),'Synthetic unrelated project');
insert into public.project_memberships(project_id,principal_id,can_write)values
 (pg_temp.uid('project'),pg_temp.uid('owner'),true),(pg_temp.uid('project'),pg_temp.uid('writer'),true),
 (pg_temp.uid('project'),pg_temp.uid('reader'),false),(pg_temp.uid('unrelated-project'),pg_temp.uid('unrelated'),true);
insert into public.app_capability_grants(principal_id,capability)select pg_temp.uid(label),capability from unnest(array['owner','writer','unrelated'])label cross join unnest(array['projects.read','workspaces.read','workspaces.write'])capability;
insert into public.app_capability_grants(principal_id,capability)select pg_temp.uid('reader'),capability from unnest(array['projects.read','workspaces.read'])capability;
insert into eps.workspaces(id,project_id)values(pg_temp.uid('workspace'),pg_temp.uid('project'));
set local role authenticated;
select pg_temp.actor(pg_temp.uid('owner'));
-- Normal application reservations: no fake capability bypass or Ready transition.
select set_config('eps.logo_info.open',public.eps_reserve_logo_upload(jsonb_build_object('workspace_id',pg_temp.uid('workspace'),'purpose','client_logo','filename','synthetic-open.png','mime_type','image/png','size_bytes',8),'logo-info-open-'||current_setting('eps.logo_info_run'))::text,true);
select set_config('eps.logo_info.ready',public.eps_reserve_logo_upload(jsonb_build_object('workspace_id',pg_temp.uid('workspace'),'purpose','client_logo','filename','synthetic-ready.png','mime_type','image/png','size_bytes',8),'logo-info-ready-'||current_setting('eps.logo_info_run'))::text,true);
reset role;
-- Only this run's newly created synthetic Ready asset is declared by the trusted
-- fixture owner. This is deliberately NOT normal completion/signature acceptance.
update eps.media_assets set status='ready',sha256=repeat('a',64),width=1,height=1 where id=pg_temp.logo_asset('ready');
insert into storage.objects(bucket_id,name,owner,owner_id,metadata)select 'eps-brand-assets',pg_temp.logo_key(which),pg_temp.uid('owner'),pg_temp.uid('owner')::text,'{"size":8,"mimetype":"image/png"}'::jsonb from unnest(array['open','ready'])which;
-- Actual restrictive-policy control: a permissive test policy cannot by itself
-- expand access while the existing restrictive logo guard remains authoritative.
create policy logo_info_test_broad on storage.objects for select to authenticated using(true);
set local role authenticated;
select pg_temp.actor(pg_temp.uid('owner'));
select pg_temp.check_row('baseline-own-open-GET','storage.object.get_authenticated','open',true);
select pg_temp.check_row('baseline-own-open-INFO-denied','object.get_authenticated_info','open',false);
select pg_temp.check_row('baseline-ready-GET','storage.object.get_authenticated','ready',true);
select pg_temp.check_row('baseline-ready-INFO-denied','object.get_authenticated_info','ready',false);
reset role;
set local role eps_logo_verify_owner;
-- The verifier inherits authenticated and may evaluate the same public helper
-- with the acting user's JWT. Its independent restrictive Storage policy must
-- still return zero rows even when that helper is true.
select pg_temp.check_row('baseline-verifier-storage-denied','storage.object.get_authenticated','ready',false,helper_wanted=>true);
reset role;
-- __CANDIDATE_DEFINITION__
select pg_temp.assert_true((select encode(sha256(convert_to(prosrc,'UTF8')),'hex')='__CANDIDATE_BODY_SHA__'from pg_proc where oid='eps.logo_storage_read_allowed(text,text)'::regprocedure),'exact new helper body');
select pg_temp.assert_true((select to_jsonb(p)-'prosrc'=b.metadata from pg_proc p cross join logo_info_function_before b where p.oid='eps.logo_storage_read_allowed(text,text)'::regprocedure),'all function metadata/OID/ACL unchanged');
set local role authenticated;
select pg_temp.actor(pg_temp.uid('owner'));
select pg_temp.check_row('own-open-GET','storage.object.get_authenticated','open',true);
select pg_temp.check_row('own-open-INFO','object.get_authenticated_info','open',true);
select pg_temp.check_row('own-open-INFO-prefixed','storage.object.get_authenticated_info','open',true);
select pg_temp.check_row('own-ready-GET','storage.object.get_authenticated','ready',true);
select pg_temp.check_row('own-ready-INFO','object.get_authenticated_info','ready',true);
select pg_temp.check_row('wrong-key','object.get_authenticated_info','open',false,'eps-brand-assets',true);
select pg_temp.check_row('wrong-bucket','object.get_authenticated_info','open',false,'synthetic-wrong-bucket');
select pg_temp.check_row('sign-denied','storage.object.sign','open',false);
select pg_temp.check_row('upload-denied','storage.object.upload','open',false);
select pg_temp.check_row('list-denied','storage.object.list','open',false);
select pg_temp.check_row('unused-info-name-denied','storage.object.info_authenticated','open',false);
-- A caller header cannot substitute the trusted server operation or upload actor.
select set_config('request.headers','{"x-storage-operation":"storage.object.get_authenticated_info"}',true);
select pg_temp.check_row('spoofed-operation-header-denied','storage.object.sign','open',false);
select pg_temp.actor(pg_temp.uid('writer'));
select pg_temp.check_row('same-project-wrong-owner-open-GET','storage.object.get_authenticated','open',false);
select pg_temp.check_row('same-project-wrong-owner-open-INFO','object.get_authenticated_info','open',false);
select pg_temp.check_row('same-project-authorized-nonowner-ready-INFO','object.get_authenticated_info','ready',true);
select pg_temp.actor(pg_temp.uid('reader'));
select pg_temp.check_row('reader-open-denied','object.get_authenticated_info','open',false);
select pg_temp.check_row('reader-ready-GET','storage.object.get_authenticated','ready',true);
select pg_temp.check_row('reader-ready-INFO','object.get_authenticated_info','ready',true);
select pg_temp.actor(pg_temp.uid('unrelated'));
select pg_temp.check_row('unrelated-open-denied','object.get_authenticated_info','open',false);
select pg_temp.check_row('unrelated-ready-denied','object.get_authenticated_info','ready',false);
reset role;
set local role anon;
select pg_temp.actor(null);
select pg_temp.check_row('anonymous-open-denied','object.get_authenticated_info','open',false);
select pg_temp.check_row('anonymous-ready-denied','object.get_authenticated_info','ready',false);
reset role;
update eps.upload_sessions set created_at=clock_timestamp()-interval '3 hours',expires_at=clock_timestamp()-interval '1 second'where asset_id=pg_temp.logo_asset('open');
set local role authenticated;
select pg_temp.actor(pg_temp.uid('owner'));
select pg_temp.check_row('expired-open-GET-denied','storage.object.get_authenticated','open',false);
select pg_temp.check_row('expired-open-INFO-denied','object.get_authenticated_info','open',false);
reset role;
update eps.upload_sessions set created_at=clock_timestamp(),expires_at=clock_timestamp()+interval '2 hours'where asset_id=pg_temp.logo_asset('open');
update public.app_capability_grants set active=false where principal_id=pg_temp.uid('owner')and capability='workspaces.write';
set local role authenticated;
select pg_temp.check_row('revoked-write-open-denied','object.get_authenticated_info','open',false);
select pg_temp.check_row('revoked-write-ready-remains-readable','object.get_authenticated_info','ready',true);
reset role;
update public.app_capability_grants set active=true where principal_id=pg_temp.uid('owner')and capability='workspaces.write';
update public.app_capability_grants set active=false where principal_id=pg_temp.uid('owner')and capability='workspaces.read';
set local role authenticated;
select pg_temp.check_row('revoked-read-open-denied','object.get_authenticated_info','open',false);
select pg_temp.check_row('revoked-read-ready-denied','object.get_authenticated_info','ready',false);
reset role;
update public.app_capability_grants set active=true where principal_id=pg_temp.uid('owner')and capability='workspaces.read';
update public.project_memberships set active=false where principal_id=pg_temp.uid('owner')and project_id=pg_temp.uid('project');
set local role authenticated;
select pg_temp.check_row('revoked-membership-open-denied','object.get_authenticated_info','open',false);
select pg_temp.check_row('revoked-membership-ready-denied','object.get_authenticated_info','ready',false);
reset role;
update public.project_memberships set active=true where principal_id=pg_temp.uid('owner')and project_id=pg_temp.uid('project');
update eps.upload_sessions set status='cancelled'where asset_id=pg_temp.logo_asset('open');
set local role authenticated;
select pg_temp.check_row('cancelled-open-denied','object.get_authenticated_info','open',false);
reset role;
-- Verifier role must never gain Storage read authority from the operation change.
set local role eps_logo_verify_owner;
select pg_temp.check_row('verifier-storage-denied','object.get_authenticated_info','ready',false,helper_wanted=>true);
reset role;
drop policy logo_info_test_broad on storage.objects;
select pg_temp.assert_true((select coalesce(jsonb_agg(to_jsonb(p)order by p.oid),'[]'::jsonb)=b.metadata from pg_policy p cross join logo_info_policies_before b where p.polrelid in('storage.objects'::regclass,'storage.buckets'::regclass,'eps.media_assets'::regclass,'eps.upload_sessions'::regclass,'eps.workspaces'::regclass)group by b.metadata),'all original policies unchanged');
select jsonb_build_object('result','passed_local_SQL_simulation','http_or_physical_Storage_acceptance',false,'rollback_required',true,'existing_Ready_rows_modified',false)as logo_info_local_proof;
rollback;
