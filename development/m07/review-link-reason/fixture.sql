-- Only on the newly owned network-none PG17 restored synthetic39 clone.
do $fixture$begin
 if current_database()<>'project39'or current_setting('eps.reason40.run',true)is null
 or(pg_control_system()).system_identifier::text='7701520506262638626'
 or(select count(*)from supabase_migrations.schema_migrations)<>39
 or exists(select 1 from auth.users where id='a4400000-0000-4000-8000-000000000002')
 or not exists(select 1 from auth.users where id='a4400000-0000-4000-8000-000000000001'and not is_anonymous)
 or not exists(select 1 from eps.review_gateway_config where id and not enabled and backend_key is null)
 then raise exception'REASON40_OWNED_SYNTHETIC39_REQUIRED';end if;
end$fixture$;
create schema reason40_proof;
create table reason40_proof.gateway_before as select * from eps.review_gateway_config;
create table reason40_proof.expired_nonces as select * from eps.review_gateway_nonces where expires_at<=clock_timestamp();
create table reason40_proof.context as
 select s.id series,w.id workspace,p.id project,s.latest_ready_version_id version,e.id export_id,g.producing_attempt_id,
 (select pin.asset_id from eps.presentation_version_assets pin where pin.version_id=s.latest_ready_version_id and pin.asset_kind='candidate_video'order by pin.asset_id limit 1)video_id
 from eps.presentation_series s join eps.workspaces w on w.id=s.workspace_id join public.projects p on p.id=w.project_id
 join eps.audience_presets a on a.id=s.audience_preset_id
 join eps.presentation_exports e on e.version_id=s.latest_ready_version_id and e.status='ready'
 join eps.review_media_grants g on g.id=e.media_grant_id
 where not s.archived and w.archived_at is null and p.archived_at is null and a.scope='external'and s.latest_ready_version_id is not null
 order by s.id limit 1;
do $context$begin if(select count(*)from reason40_proof.context)<>1 then raise exception'REASON40_EXISTING_SYNTHETIC_READY_SERIES_REQUIRED';end if;end$context$;
insert into auth.users(id,is_anonymous)values('a4400000-0000-4000-8000-000000000002',false);
insert into public.app_capability_grants(principal_id,capability)
 select'a4400000-0000-4000-8000-000000000001'::uuid,c from unnest(array['workspaces.read','workspaces.write','review_links.manage'])c;
insert into public.app_capability_grants(principal_id,capability)values('a4400000-0000-4000-8000-000000000002','workspaces.read');
insert into public.project_memberships(project_id,principal_id,can_write)select project,'a4400000-0000-4000-8000-000000000001'::uuid,true from reason40_proof.context;
update eps.review_gateway_config set enabled=true,backend_key=decode(repeat('17',32),'hex')where id;
